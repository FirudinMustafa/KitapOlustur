// Print QA for a book PDF: measures every text line and every picture on
// every page and reports what a press check would catch.
//
//   npx tsx scripts/reference/print-qa.mts <pdf> [--dpi 300] [--out dir]
//
// The trim is found from the TrimBox, or else taken as the page centred
// on an A4 trim (a press sheet with slug, a bleed-only page, or a
// trimmed page). Checks (pt, trim coordinates):
//   off-grid   a picture edge, or a painted box's left/top edge, 0.5-3 pt
//              from a grid line (column edges and their 4 mm insets, the
//              vertical units and their insets, the trim and bleed edges):
//              a near miss. Edges further than 3 pt from every line are
//              free-placed (a picture centred in a derived cell) - counted.
//              Text is checked by the alignment rule; its containers are
//              placed on the grid by the layout code.
//   align      two neighbouring left edges (text of different blocks, or
//              pictures), or picture tops/bottoms/right edges in a row,
//              1-3 pt apart: a shared alignment that slipped.
//   overlap    text on text; text half on, half off a picture; two
//              opaque pictures partly over each other.
//   hidden     text that a box or picture painted after it covers.
//   safe       text closer than 5 mm to the trim.
//   dpi        a picture below the target resolution at its printed size.
//   bleed      a picture or painted box reaching the trim edge (or within
//              2 mm of it) without running on to the bleed edge.
// Writes <out>/report.txt, <out>/report.json and an annotated PNG per page
// with a warning (red: warning, orange: the other edge of an alignment).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as m from "mupdf";

const MM = 72 / 25.4;
const TRIM = { w: 210 * MM, h: 297 * MM };
const BLEED = 3 * MM;
const SAFE = 5 * MM;
const INSET = 4 * MM;
// the grid of print-kit.ts
const GRID = { marginX: 12 * MM, marginTop: 12 * MM, col: 10 * MM, gutter: 6 * MM, unit: 2.5 * MM };

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) throw new Error("usage: print-qa.mts <pdf> [--dpi 300] [--out dir]");
const opt = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const TARGET_DPI = Number(opt("dpi", "300"));
const OUT = opt("out", path.join(path.dirname(file), "qa", path.basename(file, ".pdf")));
fs.mkdirSync(OUT, { recursive: true });

type R = { x0: number; y0: number; x1: number; y1: number };
type Line = R & { text: string; block: number; size: number };
type Img = R & { pxW: number; pxH: number; alpha: boolean; dpi: number };
type Paint = R & { color: string; boxLike: boolean };
type Warn = { kind: string; msg: string; box: R; other?: R };

const xLines: number[] = [0, TRIM.w, -BLEED, TRIM.w + BLEED];
for (let c = 1; c <= 12; c++) {
  const l = GRID.marginX + (c - 1) * (GRID.col + GRID.gutter);
  const r = l + GRID.col;
  xLines.push(l, r, l + INSET, r - INSET, l - INSET, r + INSET);
}
const yLines: number[] = [0, TRIM.h, -BLEED, TRIM.h + BLEED];
for (let r = -6; r <= 116; r++) {
  const y = GRID.marginTop + r * GRID.unit;
  yLines.push(y, y + INSET, y - INSET);
}
const nearest = (v: number, lines: number[]) => lines.reduce((b, l) => Math.min(b, Math.abs(v - l)), Infinity);
const fmt = (v: number) => v.toFixed(1);
const boxStr = (b: R) => `[${fmt(b.x0 / MM)}, ${fmt(b.y0 / MM)} - ${fmt(b.x1 / MM)}, ${fmt(b.y1 / MM)}] mm`;
const inter = (a: R, b: R) => ({ w: Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h: Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) });

const doc = m.Document.openDocument(fs.readFileSync(file), "application/pdf") as m.PDFDocument;
const n = doc.countPages();
const report: { page: number; panel: string; warnings: Warn[]; free: number; images: number; lines: number }[] = [];

for (let p = 0; p < n; p++) {
  const page = doc.loadPage(p) as m.PDFPage;
  const [bx0, by0, bx1, by1] = page.getBounds();
  const pw = bx1 - bx0;
  const ph = by1 - by0;
  // trim offset: TrimBox (relative to the MediaBox) if set, else the page centred on A4
  let tx = (pw - TRIM.w) / 2;
  let oy = (ph - TRIM.h) / 2;
  let trimW = TRIM.w;
  const tb = page.getObject().get("TrimBox");
  const mb = page.getObject().get("MediaBox");
  if (tb && tb.isArray && tb.isArray()) {
    const v = [0, 1, 2, 3].map((i) => tb.get(i).asNumber());
    const mv = [0, 1, 2, 3].map((i) => mb.get(i).asNumber());
    tx = v[0] - mv[0];
    oy = mv[3] - v[3]; // PDF y up -> page y down
    trimW = v[2] - v[0];
  }
  // a cover spread (back | spine | front) is checked as its two A4 panels;
  // at the spine the art runs to the spine's middle, not 3 mm on
  const spine = trimW - 2 * TRIM.w;
  const panels = trimW > 1.5 * TRIM.w ? [{ ox: tx, name: "back", bl: BLEED, br: spine / 2 }, { ox: tx + TRIM.w + spine, name: "front", bl: spine / 2, br: BLEED }] : [{ ox: tx, name: "", bl: BLEED, br: BLEED }];
  for (const panel of panels) {
  const ox = panel.ox;
  const T = (x: number, y: number) => ({ x: x - bx0 - ox, y: y - by0 - oy });

  // --- text lines
  const lines: Line[] = [];
  const st = page.toStructuredText("preserve-whitespace");
  let block = -1;
  let cur: Line | null = null;
  st.walk({
    beginTextBlock: () => void block++,
    beginLine: () => {
      cur = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, text: "", block, size: 0 };
    },
    // each glyph as its ink band: the advance box across, cap height to
    // descender down (the font's ascent/descent box is taller than the ink
    // and made stacked lines "overlap")
    onChar: (c: string, origin: number[], _font: unknown, size: number, quad: number[]) => {
      if (!cur) return;
      cur.text += c;
      if (!c.trim()) return;
      const xs = [quad[0], quad[2], quad[4], quad[6]];
      const o = T(origin[0], origin[1]);
      const a = T(Math.min(...xs), 0);
      const b = T(Math.max(...xs), 0);
      cur.x0 = Math.min(cur.x0, a.x);
      cur.y0 = Math.min(cur.y0, o.y - 0.72 * size);
      cur.x1 = Math.max(cur.x1, b.x);
      cur.y1 = Math.max(cur.y1, o.y + 0.2 * size);
      cur.size = Math.max(cur.size, size);
    },
    endLine: () => {
      if (cur && cur.text.trim() && cur.x1 > cur.x0) lines.push(cur);
      cur = null;
    },
  });
  // the slug line and crop marks live outside the trim + bleed: not page content
  const inPage = lines.filter((l) => l.x1 > -panel.bl && l.x0 < TRIM.w + panel.br && l.y1 > -BLEED && l.y0 < TRIM.h + BLEED);
  // an outlined title is one text drawn 9 times a point apart: keep the middle copy
  const content: Line[] = [];
  const used = new Set<Line>();
  for (const l of inPage) {
    if (used.has(l)) continue;
    const group = inPage.filter((k) => !used.has(k) && k.text.trim() === l.text.trim() && Math.abs(k.x0 - l.x0) < 4 && Math.abs(k.y0 - l.y0) < 4);
    group.forEach((k) => used.add(k));
    if (group.length > 2) content.push([...group].sort((u, v) => u.x0 - v.x0 || u.y0 - v.y0)[Math.floor(group.length / 2)]);
    else content.push(...group);
  }

  // --- pictures and painted boxes
  const imgs: Img[] = [];
  const paints: Paint[] = [];
  // paint order, to find text that something painted later covers
  let z = 0;
  const spans: (R & { z: number; text: string })[] = [];
  const covers: (R & { z: number; what: string })[] = [];
  const dev = new m.Device({
    fillText: (text: m.Text, ctm: number[]) => {
      const s = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, z: z++, text: "" };
      text.walk({
        showGlyph: (_f: unknown, trm: number[], _g: number, unicode: number) => {
          const px = ctm[0] * trm[4] + ctm[2] * trm[5] + ctm[4];
          const py = ctm[1] * trm[4] + ctm[3] * trm[5] + ctm[5];
          const size = Math.hypot(trm[2], trm[3]) * Math.hypot(ctm[2], ctm[3]);
          const o = T(px, py);
          s.x0 = Math.min(s.x0, o.x);
          s.x1 = Math.max(s.x1, o.x + 0.5 * size);
          s.y0 = Math.min(s.y0, o.y - 0.7 * size);
          s.y1 = Math.max(s.y1, o.y + 0.15 * size);
          s.text += String.fromCodePoint(unicode);
        },
      });
      if (s.x1 > s.x0 && s.text.trim()) spans.push(s);
    },
    fillImage: (image: m.Image, ctm: number[]) => {
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => T(ctm[0] * u + ctm[2] * v + ctm[4], ctm[1] * u + ctm[3] * v + ctm[5]));
      const r = { x0: Math.min(...pts.map((q) => q.x)), y0: Math.min(...pts.map((q) => q.y)), x1: Math.max(...pts.map((q) => q.x)), y1: Math.max(...pts.map((q) => q.y)) };
      const pxW = image.getWidth();
      const pxH = image.getHeight();
      const dpi = Math.min(pxW / ((r.x1 - r.x0) / 72), pxH / ((r.y1 - r.y0) / 72));
      imgs.push({ ...r, pxW, pxH, alpha: !!image.getMask(), dpi });
      // a cut-out covers only where it is drawn: not measured as a cover
      if (!image.getMask()) covers.push({ ...r, z: z++, what: "a picture" });
    },
    fillPath: (pathObj: m.Path, _eo: boolean, ctm: number[], cs: m.ColorSpace, color: number[], alpha: number) => {
      if (alpha < 0.1) return;
      const b = pathObj.getBounds(null as never, ctm as m.Matrix);
      // only box-like paths (a rectangle, or one with rounded corners): every
      // point on the bounding box's edge; a drawn shape (a curve, a wedge) is
      // decoration, not a box to align
      let boxLike = true;
      const onEdge = (x: number, y: number) => {
        const px = ctm[0] * x + ctm[2] * y + ctm[4];
        const py = ctm[1] * x + ctm[3] * y + ctm[5];
        if (Math.min(Math.abs(px - b[0]), Math.abs(px - b[2]), Math.abs(py - b[1]), Math.abs(py - b[3])) > 0.2) boxLike = false;
      };
      // a rounded corner's control points lie on the box's edges too; a drawn
      // curve's do not. A box has no curves, or one per corner.
      let curves = 0;
      pathObj.walk({ moveTo: onEdge, lineTo: onEdge, curveTo: (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => (curves++, onEdge(x1, y1), onEdge(x2, y2), onEdge(x3, y3)) });
      if (curves !== 0 && curves % 4 !== 0) boxLike = false;

      const a = T(b[0], b[1]);
      const c = T(b[2], b[3]);
      const hex = `#${color.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
      if (cs.getNumberOfComponents() === 3) paints.push({ x0: a.x, y0: a.y, x1: c.x, y1: c.y, color: hex, boxLike });
      if (alpha > 0.5 && boxLike) covers.push({ x0: a.x, y0: a.y, x1: c.x, y1: c.y, z: z++, what: `a ${hex} box` });
    },
  });
  page.run(dev, m.Matrix.identity);
  dev.close();
  const pageImgs = imgs.filter((i) => i.x1 > -panel.bl + 0.1 && i.x0 < TRIM.w + panel.br - 0.1);
  // painted boxes of some size inside the bleed (crop marks and hairlines are not boxes)
  const boxes = paints.filter((q) => q.x1 - q.x0 > 6 * MM && q.y1 - q.y0 > 6 * MM && q.x0 > -panel.bl - 1 && q.x1 < TRIM.w + panel.br + 1 && q.y0 > -BLEED - 1 && q.y1 < TRIM.h + BLEED + 1);

  const W: Warn[] = [];
  let free = 0;
  const isGround = (r: R) => (r.x1 - r.x0) * (r.y1 - r.y0) > 0.55 * TRIM.w * TRIM.h;

  // off-grid
  const gridCheck = (what: string, r: R, edges: ("l" | "r" | "t" | "b")[]) => {
    for (const e of edges) {
      const v = e === "l" ? r.x0 : e === "r" ? r.x1 : e === "t" ? r.y0 : r.y1;
      const d = nearest(v, e === "l" || e === "r" ? [...xLines, -panel.bl, TRIM.w + panel.br] : yLines);
      if (d > 0.5 && d <= 3) W.push({ kind: "off-grid", msg: `${what} ${{ l: "left", r: "right", t: "top", b: "bottom" }[e]} edge ${fmt(d)} pt off the grid`, box: r });
      else if (d > 3) free++;
    }
  };
  for (const i of pageImgs) gridCheck("picture", i, ["l", "r", "t", "b"]);
  // a painted box is placed by its top-left corner; its size may follow its
  // text (a speech bubble). White fills print no ink - their edge is the
  // border drawn round them, measured as a box of its own.
  for (const b of boxes) if (b.boxLike && b.color !== "#ffffff") gridCheck(`painted box ${b.color}`, b, ["l", "t"]);

  // shared alignments that slipped
  const lh = (l: Line) => l.y1 - l.y0;
  for (let i = 0; i < content.length; i++)
    for (let j = i + 1; j < content.length; j++) {
      const a = content[i];
      const b = content[j];
      if (a.block === b.block || a.text.trim() === b.text.trim()) continue;
      if (a.text.trim().length < 2 || b.text.trim().length < 2) continue;
      // centred lines share a centre, not a left edge
      if (Math.abs((a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2) < 0.6) continue;
      const vgap = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1);
      if (vgap > 1.5 * Math.max(lh(a), lh(b))) continue;
      const d = Math.abs(a.x0 - b.x0);
      if (d > 1 && d <= 3) W.push({ kind: "align", msg: `left edges of "${a.text.trim().slice(0, 24)}" and "${b.text.trim().slice(0, 24)}" ${fmt(d)} pt apart`, box: a, other: b });
    }
  for (let i = 0; i < pageImgs.length; i++)
    for (let j = i + 1; j < pageImgs.length; j++) {
      const a = pageImgs[i];
      const b = pageImgs[j];
      const sameRow = inter(a, b).h > 0 || Math.abs(a.y0 - b.y0) < 3;
      const sameCol = inter(a, b).w > 0 || Math.abs(a.x0 - b.x0) < 3;
      const near = (e: string, d: number, ok: boolean) => ok && d > 1 && d <= 3 && W.push({ kind: "align", msg: `picture ${e} edges ${fmt(d)} pt apart`, box: a, other: b });
      near("top", Math.abs(a.y0 - b.y0), sameRow);
      near("bottom", Math.abs(a.y1 - b.y1), sameRow);
      near("left", Math.abs(a.x0 - b.x0), sameCol);
      near("right", Math.abs(a.x1 - b.x1), sameCol);
    }

  // overlaps
  for (let i = 0; i < content.length; i++)
    for (let j = i + 1; j < content.length; j++) {
      const a = content[i];
      const b = content[j];
      if (a.block === b.block && Math.abs(a.y0 - b.y0) < 0.5) continue;
      if (a.text.trim() === b.text.trim()) continue; // outlined titles: copies of one text
      const o = inter(a, b);
      if (o.w > 1 && o.h > 0.3 * Math.min(lh(a), lh(b))) W.push({ kind: "overlap", msg: `text "${a.text.trim().slice(0, 24)}" overlaps "${b.text.trim().slice(0, 24)}"`, box: a, other: b });
    }
  for (const l of content)
    for (const i of pageImgs) {
      if (isGround(i)) continue;
      const o = inter(l, i);
      if (o.w <= 1 || o.h <= 1) continue;
      const inside = l.x0 >= i.x0 - 1 && l.x1 <= i.x1 + 1 && l.y0 >= i.y0 - 1 && l.y1 <= i.y1 + 1;
      if (!inside && !i.alpha) W.push({ kind: "overlap", msg: `text "${l.text.trim().slice(0, 30)}" runs over a picture edge`, box: l, other: i });
    }
  for (let i = 0; i < pageImgs.length; i++)
    for (let j = i + 1; j < pageImgs.length; j++) {
      const a = pageImgs[i];
      const b = pageImgs[j];
      if (a.alpha || b.alpha || isGround(a) || isGround(b)) continue;
      const o = inter(a, b);
      const contained = (x: R, y: R) => x.x0 >= y.x0 - 0.5 && x.x1 <= y.x1 + 0.5 && x.y0 >= y.y0 - 0.5 && x.y1 <= y.y1 + 0.5;
      if (o.w > 1 && o.h > 1 && !contained(a, b) && !contained(b, a)) W.push({ kind: "overlap", msg: "two opaque pictures partly overlap", box: a, other: b });
    }

  // text that a box or picture painted after it covers (a bubble over a bubble's words)
  for (const s of spans) {
    const area = (s.x1 - s.x0) * (s.y1 - s.y0);
    for (const c of covers) {
      if (c.z < s.z) continue;
      const o = inter(s, c);
      if (o.w > 0 && o.h > 0 && o.w * o.h > 0.25 * area) {
        W.push({ kind: "hidden", msg: `text "${s.text.trim().slice(0, 30)}" is covered by ${c.what} painted over it`, box: s, other: c });
        break;
      }
    }
  }

  // safe area
  for (const l of content) if (l.x0 < SAFE - 0.1 || l.x1 > TRIM.w - SAFE + 0.1 || l.y0 < SAFE - 0.1 || l.y1 > TRIM.h - SAFE + 0.1) W.push({ kind: "safe", msg: `text "${l.text.trim().slice(0, 30)}" is within 5 mm of the trim`, box: l });

  // resolution
  for (const i of pageImgs) if (i.dpi < TARGET_DPI - 1) W.push({ kind: "dpi", msg: `picture at ${Math.round(i.dpi)} dpi (${i.pxW}x${i.pxH} px on ${fmt((i.x1 - i.x0) / MM)} x ${fmt((i.y1 - i.y0) / MM)} mm)`, box: i });

  // bleed
  const bleedCheck = (what: string, r: R) => {
    const near = 2 * MM;
    const miss = (v: number, edge: number, out: number) => Math.abs(v - edge) <= near && Math.abs(v - out) > 0.5;
    if (miss(r.x0, 0, -panel.bl) && r.x0 > -panel.bl + 0.5) W.push({ kind: "bleed", msg: `${what} stops at the left trim edge (${fmt(r.x0 / MM)} mm), not the bleed`, box: r });
    if (miss(r.x1, TRIM.w, TRIM.w + panel.br) && r.x1 < TRIM.w + panel.br - 0.5) W.push({ kind: "bleed", msg: `${what} stops at the right trim edge, not the bleed`, box: r });
    if (miss(r.y0, 0, -BLEED) && r.y0 > -BLEED + 0.5) W.push({ kind: "bleed", msg: `${what} stops at the top trim edge, not the bleed`, box: r });
    if (miss(r.y1, TRIM.h, TRIM.h + BLEED) && r.y1 < TRIM.h + BLEED - 0.5) W.push({ kind: "bleed", msg: `${what} stops at the bottom trim edge, not the bleed`, box: r });
  };
  for (const i of pageImgs) if (!i.alpha) bleedCheck("picture", i);
  for (const b of boxes) if (b.color !== "#ffffff") bleedCheck(`painted box ${b.color}`, b);

  report.push({ page: p + 1, panel: panel.name, warnings: W, free, images: pageImgs.length, lines: content.length });

  // annotated PNG
  if (W.length) {
    const z = 100 / 72;
    const pix = page.toPixmap(m.Matrix.scale(z, z), m.ColorSpace.DeviceRGB, false, true);
    const png = Buffer.from(pix.asPNG());
    const rect = (r: R, c: string) => `<rect x="${(r.x0 + ox) * z}" y="${(r.y0 + oy) * z}" width="${Math.max(2, (r.x1 - r.x0) * z)}" height="${Math.max(2, (r.y1 - r.y0) * z)}" fill="none" stroke="${c}" stroke-width="2"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pix.getWidth()}" height="${pix.getHeight()}">${W.map((w) => rect(w.box, "#ff0000") + (w.other ? rect(w.other, "#ff9800") : "")).join("")}</svg>`;
    await sharp(png).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile(path.join(OUT, `p${String(p + 1).padStart(2, "0")}${panel.name ? `-${panel.name}` : ""}.png`));
  }
  }
  page.destroy();
}

const total = report.reduce((s, r) => s + r.warnings.length, 0);
const byKind: Record<string, number> = {};
for (const r of report) for (const w of r.warnings) byKind[w.kind] = (byKind[w.kind] ?? 0) + 1;
const txt = [
  `print-qa ${path.basename(file)}: ${n} pages, ${total} warnings ${JSON.stringify(byKind)}`,
  `target ${TARGET_DPI} dpi; safe area ${SAFE / MM} mm; grid near-miss 0.5-3 pt; alignment near-miss 1-3 pt`,
  ...report.flatMap((r) => [`p${r.page}${r.panel ? ` ${r.panel}` : ""}: ${r.warnings.length} warnings (${r.images} pictures, ${r.lines} text lines, ${r.free} free-placed edges)`, ...r.warnings.map((w) => `  [${w.kind}] ${w.msg} at ${boxStr(w.box)}${w.other ? ` / ${boxStr(w.other)}` : ""}`)]),
].join("\n");
fs.writeFileSync(path.join(OUT, "report.txt"), txt);
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
console.log(txt);
