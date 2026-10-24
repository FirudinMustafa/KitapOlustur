// Print geometry, the page grid and print-resolution pictures for the
// hand-made book re-made from the phone scan (handcraft-scan.tsx).
//
// The book is laid out in TRIM coordinates (A4, 210 x 297 mm, origin at
// the trim's top-left). Every box comes from the grid below - columns for
// x, a vertical unit for y, or the trim edges - so nothing sits at a
// hand-typed position. The page wrapper offsets everything by the bleed
// (and, for the press file, the slug that carries the crop marks), and a
// box that touches a trim edge runs on to the bleed edge.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fitPicture, type FitOptions, type FractionBox, type PictureInfo } from "../../src/lib/pdf/picture-fit";
import { measureSubject } from "../../src/lib/pdf/picture-info";

export const MM = 72 / 25.4;
export const W = 210 * MM; // trim width, 595.28 pt
export const H = 297 * MM; // trim height, 841.89 pt
export const BLEED = 3 * MM;
export const SLUG = 10 * MM; // outside the bleed: crop marks and the page slug line

// --- the grid ----------------------------------------------------------------------------
// 12 columns of 10 mm with 6 mm gutters between 12 mm side margins
// (12 + 12 x 10 + 11 x 6 + 12 = 210); a 2.5 mm vertical unit from the
// 12 mm top margin down to the 15 mm bottom margin (108 units).
export const GRID = { marginX: 12 * MM, marginTop: 12 * MM, marginBottom: 15 * MM, cols: 12, col: 10 * MM, gutter: 6 * MM, unit: 2.5 * MM } as const;
export const SAFE = 5 * MM; // text stays this far inside the trim
const STEP = GRID.col + GRID.gutter;
/** Left edge of column c (1..12). */
export const cx = (c: number) => GRID.marginX + (c - 1) * STEP;
/** Right edge of column c (1..12). */
export const ce = (c: number) => cx(c) + GRID.col;
/** Width from the left of column a to the right of column b. */
export const span = (a: number, b: number) => ce(b) - cx(a);
/** The y of vertical unit r (r = 0 is the top margin; negative runs up into it). */
export const ry = (r: number) => GRID.marginTop + r * GRID.unit;
/** The last vertical unit above the bottom margin. */
export const LAST_ROW = Math.round((H - GRID.marginTop - GRID.marginBottom) / GRID.unit); // 108
/** n equal cells across [x0, x1] with gutter g: the left edge and width of cell i. */
export const cells = (x0: number, x1: number, n: number, g = GRID.gutter) => {
  const w = (x1 - x0 - g * (n - 1)) / n;
  return { w, at: (i: number) => x0 + i * (w + g) };
};

export type Box = { x: number; y: number; w: number; h?: number };
/** A box from its edges (pt, trim coordinates); y1 omitted = height from content. */
export const B = (x0: number, x1: number, y0: number, y1?: number): Box => ({ x: x0, y: y0, w: x1 - x0, ...(y1 !== undefined ? { h: y1 - y0 } : {}) });
/** The box grown into the bleed on each side that touches the trim edge. */
export function bleedOut(b: Box): Box & { h: number } {
  const h = b.h ?? 0;
  const L = b.x <= 0.01;
  const R = b.x + b.w >= W - 0.01;
  const T = b.y <= 0.01;
  const Bo = b.h !== undefined && b.y + h >= H - 0.01;
  return { x: b.x - (L ? BLEED : 0), y: b.y - (T ? BLEED : 0), w: b.w + (L ? BLEED : 0) + (R ? BLEED : 0), h: h + (T ? BLEED : 0) + (Bo ? BLEED : 0) };
}

// --- pictures at print resolution -------------------------------------------------------------
export const DPI = Number(process.env.PRINT_DPI ?? 300);
const CACHE = path.join(process.cwd(), ".handmade-scan", `print-cache-${DPI}`);

export type DpiRow = { name: string; widthMm: number; heightMm: number; nativePx: string; nativeDpi: number; outDpi: number; upscale: number };
export const dpiTable: DpiRow[] = [];

export type PicOptions = FitOptions & {
  name?: string;
  /** Measure the object on a plain ground and keep all of it in the frame (fitPicture's subject rule). */
  subject?: boolean;
  /** Fill where the picture does not reach (contain / subject fit); default transparent. */
  ground?: string;
};

/** The picture cut and resampled (Lanczos) to exactly the frame at DPI: what the PDF embeds. */
export async function printPicture(input: Buffer, wPt: number, hPt: number, opt: PicOptions = {}): Promise<{ data: Buffer; format: "png" | "jpg" }> {
  const meta = await sharp(input).metadata();
  const iw = meta.width ?? 1;
  const ih = meta.height ?? 1;
  let info: Pick<PictureInfo, "aspect" | "subject"> = { aspect: iw / ih };
  let ground = opt.ground;
  if (opt.subject) {
    const { data, info: ri } = await sharp(input).flatten({ background: "#ffffff" }).resize(256, 256, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const m = measureSubject(data, ri.width, ri.height, ri.channels);
    if (m) {
      info = { aspect: iw / ih, subject: m.subject as FractionBox };
      ground ??= meta.hasAlpha ? undefined : m.ground;
    }
  }
  const rect = fitPicture(wPt, hPt, info, opt);
  const tw = Math.max(1, Math.ceil((wPt / 72) * DPI));
  const th = Math.max(1, Math.ceil((hPt / 72) * DPI));
  const k = tw / wPt; // px per pt
  const nativeDpi = Math.round(iw / (rect.width / 72));
  dpiTable.push({ name: opt.name ?? "?", widthMm: +(wPt / MM).toFixed(1), heightMm: +(hPt / MM).toFixed(1), nativePx: `${iw}x${ih}`, nativeDpi, outDpi: DPI, upscale: +(DPI / nativeDpi).toFixed(2) });
  const key = crypto.createHash("sha1").update(input).update(JSON.stringify([tw, th, rect, ground ?? ""])).digest("hex").slice(0, 20);
  fs.mkdirSync(CACHE, { recursive: true });
  for (const format of ["jpg", "png"] as const) {
    const f = path.join(CACHE, `${key}.${format}`);
    if (fs.existsSync(f)) return { data: fs.readFileSync(f), format };
  }
  const dw = Math.max(1, Math.round(rect.width * k));
  const dh = Math.max(1, Math.round(rect.height * k));
  const left = Math.round(rect.left * k);
  const top = Math.round(rect.top * k);
  // the part of the drawn picture inside the frame
  const ex = { left: Math.max(0, -left), top: Math.max(0, -top) };
  const ew = Math.min(dw - ex.left, tw - Math.max(0, left));
  const eh = Math.min(dh - ex.top, th - Math.max(0, top));
  const drawn = await sharp(input).ensureAlpha().resize(dw, dh, { kernel: "lanczos3", fit: "fill" }).extract({ left: ex.left, top: ex.top, width: Math.max(1, ew), height: Math.max(1, eh) }).png().toBuffer();
  const bg = ground ? { ...hexRgb(ground) } : { r: 255, g: 255, b: 255, alpha: 0 };
  const out = await sharp({ create: { width: tw, height: th, channels: 4, background: bg } })
    .composite([{ input: drawn, left: Math.max(0, left), top: Math.max(0, top) }])
    .png()
    .toBuffer();
  const opaque = (await sharp(out).stats()).isOpaque;
  const data = opaque ? await sharp(out).flatten({ background: "#ffffff" }).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer() : await sharp(out).png({ compressionLevel: 9 }).toBuffer();
  const format = opaque ? "jpg" : "png";
  fs.writeFileSync(path.join(CACHE, `${key}.${format}`), data);
  return { data, format };
}
function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, alpha: 1 };
}

/**
 * The white card ground knocked out - only the white that reaches the
 * picture's edge, so a white apron, sock or eye stays white on a tinted
 * page (the old knockout cleared every white pixel and the page colour
 * showed through the figure). RGBA in place.
 */
export function knockOutside(px: Uint8Array | Buffer, w: number, h: number) {
  const light = (i: number) => px[i * 4 + 3] === 0 || Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) > 228;
  const seen = new Uint8Array(w * h);
  const st: number[] = [];
  const push = (i: number) => {
    if (!seen[i] && light(i)) {
      seen[i] = 1;
      st.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (st.length) {
    const p = st.pop()!;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  for (let i = 0; i < w * h; i++) {
    if (!seen[i]) continue;
    const m = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    px[i * 4 + 3] = m > 246 || px[i * 4 + 3] === 0 ? 0 : Math.min(px[i * 4 + 3], Math.round(((246 - m) / 18) * 255));
  }
}

/** An RGBA cut-out of a picture drawn on white (outside white only). */
export async function cutOut(buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  knockOutside(data, info.width, info.height);
  return sharp(data, { raw: info }).trim({ threshold: 1 }).png().toBuffer();
}

// --- figures re-cut from a card sheet ---------------------------------------------------------
// The card sheets were cut on a plain cols x rows grid, so a figure that
// reached past its cell lost a piece (the bus's right thruster, the owl's
// wing) and its neighbour's piece came along (a propeller beside Maya).
// Here each figure is the inked region round its cell's centre, taken
// from the whole sheet, with the white ground knocked out.
export async function sheetFigures(sheet: Buffer, cols: number, rows: number, n: number): Promise<Buffer[]> {
  const meta = await sharp(sheet).metadata();
  const SW = meta.width ?? 1;
  const SH = meta.height ?? 1;
  const S = 4;
  const w = Math.round(SW / S);
  const h = Math.round(SH / S);
  const { data, info } = await sharp(sheet).flatten({ background: "#ffffff" }).resize(w, h, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const c = info.channels;
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) ink[i] = Math.min(data[i * c], data[i * c + 1], data[i * c + 2]) < 238 ? 1 : 0;
  // components of ink (8-connected, one pixel of slack for antialiased gaps)
  const lab = new Int32Array(w * h).fill(-1);
  const comps: { x0: number; y0: number; x1: number; y1: number; n: number; cx: number; cy: number }[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!ink[i] || lab[i] >= 0) continue;
    const id = comps.length;
    const st = [i];
    lab[i] = id;
    const cc = { x0: w, y0: h, x1: 0, y1: 0, n: 0, cx: 0, cy: 0 };
    while (st.length) {
      const p = st.pop()!;
      const x = p % w;
      const y = (p / w) | 0;
      cc.n++;
      cc.cx += x;
      cc.cy += y;
      cc.x0 = Math.min(cc.x0, x);
      cc.x1 = Math.max(cc.x1, x);
      cc.y0 = Math.min(cc.y0, y);
      cc.y1 = Math.max(cc.y1, y);
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const X = x + dx;
          const Y = y + dy;
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const q = Y * w + X;
          if (ink[q] && lab[q] < 0) {
            lab[q] = id;
            st.push(q);
          }
        }
    }
    cc.cx /= cc.n;
    cc.cy /= cc.n;
    comps.push(cc);
  }
  const cw = w / cols;
  const ch = h / rows;
  const out: Buffer[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // a component belongs to the cell its centre of mass lies in
    const mine = comps.map((cc, id) => ({ cc, id })).filter(({ cc }) => cc.n > 6 && Math.floor(cc.cx / cw) === col && Math.floor(cc.cy / ch) === row);
    const x0 = Math.min(...mine.map((m) => m.cc.x0));
    const y0 = Math.min(...mine.map((m) => m.cc.y0));
    const x1 = Math.max(...mine.map((m) => m.cc.x1));
    const y1 = Math.max(...mine.map((m) => m.cc.y1));
    const ids = new Set(mine.map((m) => m.id));
    // full-resolution crop, pixels of other components cleared
    const pad = 2;
    const L = Math.max(0, (x0 - pad) * S);
    const T = Math.max(0, (y0 - pad) * S);
    const R = Math.min(SW, (x1 + pad + 1) * S);
    const Bm = Math.min(SH, (y1 + pad + 1) * S);
    const { data: full, info: fi } = await sharp(sheet).ensureAlpha().extract({ left: L, top: T, width: R - L, height: Bm - T }).raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < fi.height; y++)
      for (let x = 0; x < fi.width; x++) {
        const lx = Math.min(w - 1, Math.floor((L + x) / S));
        const ly = Math.min(h - 1, Math.floor((T + y) / S));
        // near a cell's own ink keep; on another figure's ink clear
        let keep = false;
        let other = false;
        for (let dy = -1; dy <= 1 && !keep; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const X = lx + dx;
            const Y = ly + dy;
            if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
            const l = lab[Y * w + X];
            if (l >= 0 && ids.has(l)) {
              keep = true;
              break;
            }
            if (l >= 0) other = true;
          }
        if (!keep && other) full[(y * fi.width + x) * 4 + 3] = 0;
      }
    knockOutside(full, fi.width, fi.height);
    out.push(await sharp(full, { raw: fi }).trim({ threshold: 1 }).png().toBuffer());
  }
  return out;
}
