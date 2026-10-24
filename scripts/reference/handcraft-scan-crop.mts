// Clean page images of the phone-scanned coursebook (.spike/scan/scan.pdf,
// CamScanner, no text layer): each scan sheet is rendered, the book page is
// cut out of it (content bounding box, the CamScanner badge left out),
// de-skewed (the angle whose row profile is sharpest) and printed on a page
// of the hand-made book's size - the reference handcraft-scan.tsx is scored
// against (scripts/fidelity.mts).
//   npx tsx scripts/reference/handcraft-scan-crop.mts [firstSheet] [lastSheet]
//     -> .handmade-scan/scan-pages.pdf, .handmade-scan/scan-crop/*.png
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import React from "react";
import { Document, Page, Image, renderToBuffer } from "@react-pdf/renderer";
import * as m from "mupdf";

const MM = 72 / 25.4;
const W = 205 * MM;
const H = 297 * MM;
const OUT = path.join(process.cwd(), ".handmade-scan");
const CROP = path.join(OUT, "scan-crop");
fs.mkdirSync(CROP, { recursive: true });

// Rows/columns holding "ink" (anything clearly darker or more coloured than paper).
async function inkMask(buf: Buffer) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(info.width * info.height);
  for (let i = 0, p = 0; i < data.length; i += 3, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    mask[p] = mn < 225 || mx - mn > 28 ? 1 : 0;
  }
  return { mask, w: info.width, h: info.height };
}

function bbox(mask: Uint8Array, w: number, h: number, maxY: number) {
  const rows = new Array(h).fill(0), cols = new Array(w).fill(0);
  for (let y = 0; y < maxY; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { rows[y]++; cols[x]++; }
  const rowMin = w * 0.04, colMin = maxY * 0.04;
  let y0 = 0, y1 = maxY - 1, x0 = 0, x1 = w - 1;
  while (y0 < y1 && rows[y0] < rowMin) y0++;
  while (y1 > y0 && rows[y1] < rowMin) y1--;
  while (x0 < x1 && cols[x0] < colMin) x0++;
  while (x1 > x0 && cols[x1] < colMin) x1--;
  return { x0, y0, x1, y1 };
}

// Sharpness of the horizontal ink profile: text lines and box edges give a
// spiky profile when the page is level.
async function profileScore(buf: Buffer, angle: number) {
  const rot = await sharp(buf).rotate(angle, { background: "#ffffff" }).png().toBuffer();
  const { mask, w, h } = await inkMask(rot);
  const rows = new Array(h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rows[y] += mask[y * w + x];
  let s = 0;
  for (let y = 1; y < h; y++) s += (rows[y] - rows[y - 1]) ** 2;
  return s;
}

async function main() {
  const [f = "3", l = "18"] = process.argv.slice(2);
  const doc = m.Document.openDocument(fs.readFileSync(path.join(process.cwd(), ".spike", "scan", "scan.pdf")), "application/pdf");
  const pages: Buffer[] = [];
  for (let i = Number(f) - 1; i < Number(l); i++) {
    const sheet = Buffer.from(doc.loadPage(i).toPixmap(m.Matrix.scale(3, 3), m.ColorSpace.DeviceRGB, false, true).asPNG());
    const { mask, w, h } = await inkMask(sheet);
    const box = bbox(mask, w, h, Math.round(h * 0.947));
    const cut = await sharp(sheet).extract({ left: box.x0, top: box.y0, width: box.x1 - box.x0 + 1, height: box.y1 - box.y0 + 1 }).png().toBuffer();
    const small = await sharp(cut).resize({ width: 500 }).png().toBuffer();
    let best = 0, bestScore = -1;
    for (let a = -1.5; a <= 1.5001; a += 0.25) {
      const s = await profileScore(small, a);
      if (s > bestScore) { bestScore = s; best = a; }
    }
    let page = cut;
    if (Math.abs(best) > 0.01) {
      const rot = await sharp(cut).rotate(best, { background: "#ffffff" }).png().toBuffer();
      const r = await inkMask(rot);
      const b2 = bbox(r.mask, r.w, r.h, r.h);
      page = await sharp(rot).extract({ left: b2.x0, top: b2.y0, width: b2.x1 - b2.x0 + 1, height: b2.y1 - b2.y0 + 1 }).png().toBuffer();
    }
    const meta = await sharp(page).metadata();
    const out = await sharp(page).resize(Math.round(W * 2.5), Math.round(H * 2.5), { fit: "fill" }).png().toBuffer();
    fs.writeFileSync(path.join(CROP, `s${String(i + 1).padStart(2, "0")}.png`), out);
    pages.push(out);
    console.log(`sheet ${i + 1}: box ${box.x0},${box.y0}-${box.x1},${box.y1} angle ${best.toFixed(2)} aspect ${((meta.width ?? 1) / (meta.height ?? 1)).toFixed(3)}`);
  }
  const pdf = await renderToBuffer(
    React.createElement(
      Document,
      { title: "Scan pages (cropped, de-skewed)" },
      pages.map((p, i) =>
        React.createElement(Page, { key: i, size: [W, H] }, React.createElement(Image, { src: { data: p, format: "png" }, style: { position: "absolute", left: 0, top: 0, width: W, height: H - 1 } })),
      ),
    ),
  );
  fs.writeFileSync(path.join(OUT, "scan-pages.pdf"), pdf);
  console.log("->", path.join(OUT, "scan-pages.pdf"));
}
void main();
