// Faz B7: structural fidelity of a generated book against its source.
//
//   npx tsx scripts/fidelity.mts <source.pdf> <generated.pdf> [firstSourcePage] [firstGeneratedPage]
//
// Pairs pages in order from the given first pages (default: source page 1,
// generated page 4 - after cover, imprint and contents) and prints the
// page-by-page comparison and the overall score (src/lib/fidelity.ts).
import fs from "node:fs";
import { analyzeSourceLayout } from "../src/lib/source-layout-pdf";
import { compareLayouts } from "../src/lib/fidelity";

// Wrapped in main(): the workflow bundler scans the project as CJS, where
// top-level await fails the dev server.
async function main() {
const [sourcePath, generatedPath, s0 = "1", g0 = "4"] = process.argv.slice(2);
if (!sourcePath || !generatedPath) {
  console.error("usage: npx tsx scripts/fidelity.mts <source.pdf> <generated.pdf> [firstSourcePage] [firstGeneratedPage]");
  process.exit(1);
}
const source = await analyzeSourceLayout(new Uint8Array(fs.readFileSync(sourcePath)));
const generated = await analyzeSourceLayout(new Uint8Array(fs.readFileSync(generatedPath)));
const pairs: [number, number | null][] = [];
for (let s = Number(s0), g = Number(g0); s <= source.length; s++, g++) pairs.push([s, g <= generated.length ? g : null]);

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
}
void main();
