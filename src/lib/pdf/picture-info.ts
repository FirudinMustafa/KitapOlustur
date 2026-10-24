import sharp from "sharp";
import type { FractionBox, PictureInfo } from "./picture-fit";

// What the PDF needs to know about a stored picture before placing it
// (picture-fit.ts): its real shape, and - for one object drawn on a plain
// ground (a vocabulary picture, a globe, a desk; white or tinted by
// picture-ground.ts) - where that object is and the ground's colour.

const SAMPLE = 256; // px, longest side measured
const GROUND_SHARE = 0.8; // share of border pixels that must be the ground colour
const GROUND_DIST = 24; // per-channel distance still "the ground"
const INK_DIST = 40; // per-channel distance that counts as the object
// An "object" this wide and tall fills its picture - placed like a scene
// (a window above a desk reaching the foot, KIYAS-11 p.9: fitted whole it
// printed small in a big frame; cropped it reads as the room).
const SCENE_SPAN = 0.85;

async function load(src: string): Promise<Buffer | null> {
  const data = /^data:[^;]+;base64,(.*)$/.exec(src);
  if (data) return Buffer.from(data[1], "base64");
  try {
    const res = await fetch(src);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const hex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

// The plain ground and the object's box of an RGB raster, or null for a
// scene (a border of many colours, or "ink" from edge to edge).
export function measureSubject(data: Uint8Array | Buffer, width: number, height: number, channels: number): { subject: FractionBox; ground: string } | null {
  const px = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const border: number[][] = [];
  for (let x = 0; x < width; x++) border.push(px(x, 0), px(x, height - 1));
  for (let y = 1; y < height - 1; y++) border.push(px(0, y), px(width - 1, y));
  const ground = [0, 1, 2].map((c) => median(border.map((p) => p[c])));
  const near = (p: number[], d: number) => Math.abs(p[0] - ground[0]) <= d && Math.abs(p[1] - ground[1]) <= d && Math.abs(p[2] - ground[2]) <= d;
  if (border.filter((p) => near(p, GROUND_DIST)).length < border.length * GROUND_SHARE) return null;
  // Rows and columns holding at least two object pixels (a stray speck is not the object).
  const rows = new Array<number>(height).fill(0);
  const cols = new Array<number>(width).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!near(px(x, y), INK_DIST)) {
        rows[y]++;
        cols[x]++;
      }
    }
  }
  const first = (a: number[]) => a.findIndex((n) => n >= 2);
  const last = (a: number[]) => a.length - 1 - [...a].reverse().findIndex((n) => n >= 2);
  const y0 = first(rows);
  const x0 = first(cols);
  if (y0 < 0 || x0 < 0) return null;
  const subject = { x0: x0 / width, y0: y0 / height, x1: (last(cols) + 1) / width, y1: (last(rows) + 1) / height };
  if (subject.x1 - subject.x0 >= SCENE_SPAN && subject.y1 - subject.y0 >= SCENE_SPAN) return null;
  return { subject, ground: hex(ground) };
}

export async function measurePicture(src: string): Promise<PictureInfo | null> {
  const input = await load(src);
  if (!input) return null;
  try {
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) return null;
    const { data, info } = await sharp(input)
      .flatten({ background: "#ffffff" })
      .resize(SAMPLE, SAMPLE, { fit: "inside" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const object = measureSubject(data, info.width, info.height, info.channels);
    return { aspect: meta.width / meta.height, ...(object ?? {}) };
  } catch {
    return null;
  }
}

// Every distinct picture once; src -> what was measured (unreadable ones left out).
export async function measurePictures(srcs: string[]): Promise<Record<string, PictureInfo>> {
  const out: Record<string, PictureInfo> = {};
  const queue = [...new Set(srcs.filter(Boolean))];
  // A few downloads at a time.
  const worker = async () => {
    for (let src = queue.shift(); src; src = queue.shift()) {
      const info = await measurePicture(src);
      if (info) out[src] = info;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return out;
}
