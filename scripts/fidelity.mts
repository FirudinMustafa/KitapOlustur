// Faz B7: fidelity of a generated book against its source. Since Faz G5,
// structure and look (colours, ink, picture areas, type size) are two
// separate scores (src/lib/fidelity.ts, src/lib/page-look.ts).
//
//   npx tsx scripts/fidelity.mts <source.pdf> <generated.pdf> [firstSourcePage] [firstGeneratedPage] [lastSourcePage] [lastGeneratedPage]
//
// Pairs pages in order from the given first pages (default: source page 1,
// generated page 4 - after cover, imprint and contents) and prints the
// page-by-page comparison and the overall scores.
// With the last pages given it also compares the two ranges as a whole -
// a generated page that ran onto a second sheet shifts the page pairing,
// the totals are not affected by that.
import fs from "node:fs";
import { analyzeSourceLayout } from "../src/lib/source-layout-pdf";
import { compareLayouts } from "../src/lib/fidelity";
import { measurePdfLooks } from "../src/lib/page-look-pdf";

// Wrapped in main(): the workflow bundler scans the project as CJS, where
// top-level await fails the dev server.
async function main() {
const [sourcePath, generatedPath, s0 = "1", g0 = "4", s1, g1] = process.argv.slice(2);
if (!sourcePath || !generatedPath) {
  console.error("usage: npx tsx scripts/fidelity.mts <source.pdf> <generated.pdf> [firstSourcePage] [firstGeneratedPage]");
  process.exit(1);
}
const sourcePdf = new Uint8Array(fs.readFileSync(sourcePath));
const generatedPdf = new Uint8Array(fs.readFileSync(generatedPath));
const source = await analyzeSourceLayout(sourcePdf);
const generated = await analyzeSourceLayout(generatedPdf);
const looks = { source: await measurePdfLooks(sourcePdf), generated: await measurePdfLooks(generatedPdf) };
const pairs: [number, number | null][] = [];
const sEnd = s1 ? Number(s1) : source.length;
for (let s = Number(s0), g = Number(g0); s <= sEnd; s++, g++) pairs.push([s, g <= generated.length ? g : null]);

const result = compareLayouts(source, generated, pairs, looks);
const pct = (x: number) => `${Math.round(x * 100)}%`;
console.log("source\tgen\tpics\texerc\titems\twords\tcols\tzone\tstructure\tlook");
for (const p of result.pages) {
  console.log(
    [
      p.sourcePage,
      p.generatedPage ?? "-",
      p.pictures.join("/"),
      p.exercises.join("/"),
      p.items.join("/"),
      p.words.join("/"),
      p.columns.join("/"),
      p.zone[0] === p.zone[1] ? "=" : "≠",
      pct(p.structureScore),
      p.lookScore === null ? "-" : pct(p.lookScore),
    ].join("\t"),
  );
}
const aspects = Object.entries(result.byAspect)
  .map(([k, v]) => `${k} ${pct(v)}`)
  .join(", ");
console.log(`\nby aspect (pages where it does not apply left out): ${aspects}`);
console.log(`structure fidelity: ${pct(result.structureScore)}`);
console.log(`look fidelity:      ${result.lookScore === null ? "-" : pct(result.lookScore)}`);
// What "same design, different content" scores: each source page against
// the next one. A generated book that looks like the source should come
// close to this, not to 100%.
const neighbours: [number, number | null][] = pairs.filter(([s]) => s < sEnd).map(([s]) => [s, s + 1]);
if (neighbours.length) {
  const ref = compareLayouts(source, source, neighbours, { source: looks.source, generated: looks.source });
  console.log(`reference - source pages against each other (same design, other content): look ${pct(ref.lookScore ?? 0)}`);
}
if (s1 && g1) {
  const sum = (ls: typeof source, a: number, b: number) => ls.slice(a - 1, b).reduce((t, l) => ({ pages: t.pages + 1, ex: t.ex + l.exerciseCount, pics: t.pics + l.images.length }), { pages: 0, ex: 0, pics: 0 });
  const a = sum(source, Number(s0), Number(s1));
  const b = sum(generated, Number(g0), Number(g1));
  console.log(`range totals (source -> generated): pages ${a.pages} -> ${b.pages}, numbered exercises ${a.ex} -> ${b.ex}, pictures ${a.pics} -> ${b.pics}`);
}
}
void main();
