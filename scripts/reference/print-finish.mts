// Press files from the hand-made book's raw print render
// (handcraft-scan.tsx print): sets every page's BleedBox and TrimBox, checks
// that every font is embedded, and writes
//   print/kitap-ic-sayfalar.pdf            interior: sheet = trim + 3 mm bleed + 10 mm slug with crop marks
//   print/kitap-ic-sayfalar-isaretsiz.pdf  the same pages cut to the bleed (216 x 303 mm, no marks) - for printers who add their own
//   print/kitap-kapak.pdf                  cover spread back | spine | front with bleed, crop and fold marks
//
//   npx tsx scripts/reference/print-finish.mts
import fs from "node:fs";
import path from "node:path";
import * as m from "mupdf";

const MM = 72 / 25.4;
const BLEED = 3 * MM;
const SLUG = 10 * MM;
let OUT = path.join(process.cwd(), "print");

type Rect = [number, number, number, number];

// react-pdf selects Helvetica (a standard font, never embedded) at the start
// of some text objects although no glyph is ever shown in it - every Text
// has an embedded family. An unembedded font in the file is a preflight
// warning, so when the page shows no glyph in Helvetica its resource is
// pointed at an embedded font of the same page.
function dropUnusedFonts(page: m.PDFPage) {
  const res = page.getObject().get("Resources");
  const fonts = res.isNull() ? null : res.get("Font");
  if (!fonts || fonts.isNull()) return;
  let shown = false;
  page.toStructuredText("preserve-whitespace").walk({ onChar: (_c: string, _o: unknown, font: m.Font) => void (/Helvetica/.test(font.getName()) && (shown = true)) });
  if (shown) return;
  const std: string[] = [];
  let embedded: m.PDFObject | null = null;
  fonts.forEach((v: m.PDFObject, key: string | number) => {
    const f = v.resolve();
    if (/Helvetica|Times|Courier/.test(f.get("BaseFont").toString()) && f.get("FontDescriptor").isNull()) std.push(String(key));
    else embedded ??= v;
  });
  if (embedded) for (const k of std) fonts.put(k, embedded);
}
/** trimW 0: each page's own trim width (a cover file of spreads with different spines). */
function finish(src: string, dst: string, trimWidth: number, cropToBleed = false) {
  const doc = new m.PDFDocument(fs.readFileSync(path.join(OUT, src)));
  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i);
    const [x0, y0, x1, y1] = page.getBounds();
    const off = SLUG + BLEED;
    const trimW = trimWidth || x1 - x0 - 2 * off;
    const trim: Rect = [x0 + off, y0 + off, x0 + off + trimW, y1 - off];
    const bleed: Rect = [trim[0] - BLEED, trim[1] - BLEED, trim[2] + BLEED, trim[3] + BLEED];
    if (Math.abs(x1 - x0 - (trimW + 2 * off)) > 0.5) throw new Error(`${src} p${i + 1}: unexpected sheet width ${x1 - x0}`);
    dropUnusedFonts(page);
    // the boxes are given in the page's current coordinates: trim and bleed
    // first, the media box (which moves those coordinates) last
    page.setPageBox("BleedBox", bleed);
    page.setPageBox("TrimBox", trim);
    if (cropToBleed) {
      // written as PDF user space (y up) from the BleedBox just set
      const pdfBleed = page.getObject().get("BleedBox");
      const arr = doc.newArray();
      for (let k = 0; k < 4; k++) arr.push(doc.newReal(pdfBleed.get(k).asNumber()));
      page.getObject().put("MediaBox", arr);
      page.getObject().delete("CropBox");
    }
  }
  fs.writeFileSync(path.join(OUT, dst), doc.saveToBuffer("compress,garbage=2").asUint8Array());
  // check: boxes as written, fonts embedded
  const check = new m.PDFDocument(fs.readFileSync(path.join(OUT, dst)));
  const p0 = check.loadPage(0);
  const box = (k: string) => p0.getObject().get(k).toString();
  const fonts = new Map<string, boolean>();
  const n = check.countObjects();
  for (let k = 1; k < n; k++) {
    const o = check.newIndirect(k).resolve();
    if (!o.isDictionary() || o.get("Type").toString() !== "/Font") continue;
    const sub = o.get("Subtype").toString();
    const name = o.get("BaseFont").toString();
    if (sub === "/Type0") continue; // checked through its descendant
    const fd = o.get("FontDescriptor");
    const embedded = !fd.isNull() && (!fd.get("FontFile2").isNull() || !fd.get("FontFile3").isNull() || !fd.get("FontFile").isNull());
    fonts.set(name, (fonts.get(name) ?? true) && embedded);
  }
  const notEmbedded = [...fonts].filter(([, e]) => !e).map(([f]) => f);
  console.log(`${dst}: ${check.countPages()} pages, MediaBox ${box("MediaBox")}, BleedBox ${box("BleedBox")}, TrimBox ${box("TrimBox")}`);
  console.log(`  fonts: ${fonts.size} (${[...fonts.keys()].map((f) => f.replace(/^\/[A-Z]{6}\+/, "/")).filter((f, i, a) => a.indexOf(f) === i).join(" ")}), not embedded: ${notEmbedded.length ? notEmbedded.join(" ") : "none"}`);
}

// Other books: --dir <out dir> raw.pdf:final.pdf[:cover or :cover=<spine mm>] ...
// (an interior also gets a "-isaretsiz" copy cut to the bleed).
const argv = process.argv.slice(2);
if (argv[0] === "--dir") {
  OUT = path.resolve(argv[1]);
  for (const job of argv.slice(2)) {
    const [src, dst, cover] = job.split(":");
    if (cover === "cover") finish(src, dst, 0);
    else if (cover?.startsWith("cover=")) finish(src, dst, (2 * 210 + Number(cover.slice(6))) * MM);
    else {
      finish(src, dst, 210 * MM);
      finish(src, dst.replace(/\.pdf$/, "-isaretsiz.pdf"), 210 * MM, true);
    }
  }
} else {
  finish("raw-interior.pdf", "kitap-ic-sayfalar.pdf", 210 * MM);
  finish("raw-interior.pdf", "kitap-ic-sayfalar-isaretsiz.pdf", 210 * MM, true);
  // the spine the cover was drawn with (handcraft-scan.tsx SPINE)
  const { spineMm } = JSON.parse(fs.readFileSync(path.join(OUT, "spec.json"), "utf8")) as { spineMm: number };
  finish("raw-cover.pdf", "kitap-kapak.pdf", (2 * 210 + spineMm) * MM);
}
