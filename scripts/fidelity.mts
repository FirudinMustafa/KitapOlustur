// Faz B7: structural fidelity of a generated book against its source.
//
//   npx tsx scripts/fidelity.mts <source.pdf> <generated.pdf> [firstSourcePage] [firstGeneratedPage] [lastSourcePage] [lastGeneratedPage]
//
// Pairs pages in order from the given first pages (default: source page 1,
// generated page 4 - after cover, imprint and contents) and prints the
// page-by-page comparison and the overall score (src/lib/fidelity.ts).
// With the last pages given it also compares the two ranges as a whole -
// a generated page that ran onto a second sheet shifts the page pairing,
// the totals are not affected by that.
import fs from "node:fs";
import { analyzeSourceLayout } from "../src/lib/source-layout-pdf";
import { compareLayouts } from "../src/lib/fidelity";

// Wrapped in main(): the workflow bundler scans the project as CJS, where
// top-level await fails the dev server.
async function main() {
const [sourcePath, generatedPath, s0 = "1", g0 = "4", s1, g1] = process.argv.slice(2);
if (!sourcePath || !generatedPath) {
  console.error("usage: npx tsx scripts/fidelity.mts <source.pdf> <generated.pdf> [firstSourcePage] [firstGeneratedPage]");
  process.exit(1);
}
const source = await analyzeSourceLayout(new Uint8Array(fs.readFileSync(sourcePath)));
const generated = await analyzeSourceLayout(new Uint8Array(fs.readFileSync(generatedPath)));
const pairs: [number, number | null][] = [];
const sEnd = s1 ? Number(s1) : source.length;
for (let s = Number(s0), g = Number(g0); s <= sEnd; s++, g++) pairs.push([s, g <= generated.length ? g : null]);

const result = compareLayouts(source, generated, pairs);
const pct = (x: number) => `${Math.round(x * 100)}%`;
console.log("source  generated  pictures  exercises  columns  zone");
for (const p of result.pages) {
  console.log(
    [p.sourcePage, p.generatedPage ?? "-", p.pictures.join("/"), p.exercises.join("/"), p.columns.join("/"), p.zone[0] === p.zone[1] ? "=" : `${p.zone[0]} vs ${p.zone[1]}`, pct(p.score)].join("\t"),
  );
}
console.log(`\nby aspect: pictures ${pct(result.byAspect.pictures)}, exercises ${pct(result.byAspect.exercises)}, columns ${pct(result.byAspect.columns)}, zone ${pct(result.byAspect.zone)}`);
console.log(`structural fidelity: ${pct(result.score)}`);
if (s1 && g1) {
  const sum = (ls: typeof source, a: number, b: number) => ls.slice(a - 1, b).reduce((t, l) => ({ pages: t.pages + 1, ex: t.ex + l.exerciseCount, pics: t.pics + l.images.length }), { pages: 0, ex: 0, pics: 0 });
  const a = sum(source, Number(s0), Number(s1));
  const b = sum(generated, Number(g0), Number(g1));
  console.log(`range totals (source -> generated): pages ${a.pages} -> ${b.pages}, numbered exercises ${a.ex} -> ${b.ex}, pictures ${a.pics} -> ${b.pics}`);
}
}
void main();
