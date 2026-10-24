import sharp from "sharp";

// Pictures drawn as one object on a white ground (2026-10-24, hand-made i5
// comparison). A mirrored page's picture slots took the source's big
// frames, but most generated pictures were a globe, a desk or a window on
// plain white - set in a frame, they printed as a mostly empty page (ink
// 44% of the source's). The hand-set reference put such objects on tinted
// tiles. Here the white ground of a picture - the near-white region joined
// to its border - is printed in the book's panel tint instead, multiplied
// so soft shadows stay; a scene with colour to its edges is left alone.
// The image keeps its size and stays opaque (a JPEG), so the print PDF's
// 300 DPI images are tinted the same way without growing.

export type Rgb = [number, number, number];

const BORDER_WHITE = 0.8; // share of the border pixels that must be near-white
const NEAR_WHITE = 232; // every channel at least this...
const NEAR_GREY = 22; // ...and no more colour than this (max - min)

const isGround = (r: number, g: number, b: number) => Math.min(r, g, b) >= NEAR_WHITE && Math.max(r, g, b) - Math.min(r, g, b) <= NEAR_GREY;

// The ground mask of an RGB(A) raster: 1 where a pixel belongs to the white
// ground joined to the border (plus a pixel of anti-aliased edge), null when
// the picture has no white ground (its border is mostly colour).
export function whiteGroundMask(data: Uint8Array | Buffer, width: number, height: number, channels: number): Uint8Array | null {
  const at = (x: number, y: number) => (y * width + x) * channels;
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);
  const white = border.filter((p) => {
    const i = p * channels;
    return isGround(data[i], data[i + 1], data[i + 2]);
  });
  if (white.length < border.length * BORDER_WHITE) return null;
  const mask = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  for (const p of white) {
    if (!mask[p]) {
      mask[p] = 1;
      queue[tail++] = p;
    }
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = (p - x) / width;
    const next = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1];
    for (const n of next) {
      if (n < 0 || mask[n]) continue;
      const i = at(n % width, Math.floor(n / width));
      if (!isGround(data[i], data[i + 1], data[i + 2])) continue;
      mask[n] = 1;
      queue[tail++] = n;
    }
  }
  // One pixel of the object's anti-aliased edge goes with the ground.
  const grown = mask.slice();
  for (let p = 0; p < mask.length; p++) {
    if (mask[p]) continue;
    const x = p % width;
    if ((x > 0 && mask[p - 1]) || (x < width - 1 && mask[p + 1]) || (p >= width && mask[p - width]) || (p + width < mask.length && mask[p + width])) grown[p] = 1;
  }
  return grown;
}

// Multiply the ground by the tint, in place.
export function tintGround(data: Uint8Array | Buffer, mask: Uint8Array, channels: number, tint: Rgb): void {
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    const i = p * channels;
    data[i] = Math.round((data[i] * tint[0]) / 255);
    data[i + 1] = Math.round((data[i + 1] * tint[1]) / 255);
    data[i + 2] = Math.round((data[i + 2] * tint[2]) / 255);
  }
}

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

// A tile in the picture's own main colour, as a designer picks one: the
// commonest strong hue of the object (12 hue bins), lifted toward white -
// a blue globe on pale blue, an orange desk on pale orange. Null when the
// object has no strong colour.
const TILE_LIFT = 0.6;
export function pictureTint(data: Uint8Array | Buffer, mask: Uint8Array, channels: number): Rgb | null {
  const bins = Array.from({ length: 12 }, () => ({ n: 0, r: 0, g: 0, b: 0 }));
  let total = 0;
  for (let p = 0; p < mask.length; p += 3) {
    if (mask[p]) continue;
    const i = p * channels;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    total++;
    if (max < 60 || (max - min) / max < 0.35) continue;
    const d = max - min;
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    const e = bins[Math.floor((h / 6) * 12) % 12];
    e.n++;
    e.r += r;
    e.g += g;
    e.b += b;
  }
  const top = [...bins].sort((a, b) => b.n - a.n)[0];
  if (!total || top.n < total * 0.08) return null;
  return [top.r, top.g, top.b].map((v) => Math.round(v / top.n + (255 - v / top.n) * TILE_LIFT)) as Rgb;
}

// One picture with its white ground tinted, as a JPEG data URI - or null
// when it has none (or cannot be read): the caller keeps the original. The
// tile takes the picture's own colour where it has one, else `tint`.
export async function tintPictureGround(src: string, tint: Rgb): Promise<string | null> {
  const input = await load(src);
  if (!input) return null;
  try {
    const { data, info } = await sharp(input).flatten({ background: "#ffffff" }).raw().toBuffer({ resolveWithObject: true });
    const mask = whiteGroundMask(data, info.width, info.height, info.channels);
    if (!mask) return null;
    tintGround(data, mask, info.channels, pictureTint(data, mask, info.channels) ?? tint);
    const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

// The tint a picture's ground prints in: the book's panel tone, or - a
// panel tone so pale it reads as paper - its primary lifted toward white.
export function pictureGroundTint(palette: { primary: string; primaryLight: string }): Rgb {
  const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  const light = rgb(palette.primaryLight);
  if (light.some((v) => Number.isNaN(v))) return [247, 240, 225];
  if (light.some((v) => v <= 235)) return light;
  const primary = rgb(palette.primary);
  if (primary.some((v) => Number.isNaN(v))) return light;
  return primary.map((v) => Math.round(v + (255 - v) * 0.85)) as Rgb;
}

// The tiles a book's pictures take in turn, as the hand-set reference
// varied them: the panel tone, then pastels of the accent and the primary
// (light enough for a picture, coloured enough to print as colour).
export function pictureGroundTints(palette: { primary: string; primaryLight: string; accent: string }): Rgb[] {
  const rgb = (hex: string): Rgb | null => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return c.some((v) => Number.isNaN(v)) ? null : (c as Rgb);
  };
  const pastel = (hex: string, t: number) => rgb(hex)?.map((v) => Math.round(v + (255 - v) * t)) as Rgb | undefined;
  return [pictureGroundTint(palette), pastel(palette.accent, 0.6), pastel(palette.primary, 0.7)].filter((c): c is Rgb => !!c);
}

// Every distinct picture once, each on the next tile colour; original src
// -> tinted src for the ones that had a white ground.
export async function tintPictureGrounds(srcs: string[], tints: Rgb[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let k = 0;
  for (const src of new Set(srcs)) {
    const tinted = await tintPictureGround(src, tints[k % tints.length]);
    if (tinted) {
      out.set(src, tinted);
      k++;
    }
  }
  return out;
}
