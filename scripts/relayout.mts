// Re-typesets a finished run's Student Book PDF from its stored content,
// pictures and theme - no AI calls, nothing written to the database or Blob.
// For checking layout changes against real books (Faz G2):
//
//   npx tsx --env-file=.env.local scripts/relayout.mts <runId-prefix> <out.pdf> [variant] [--zones-from <source.pdf>]
//
// --zones-from rebuilds every mirrored page's zone plan from the source as
// it is measured today, as a fresh run would, and sets the book in the
// source's measured colours and type (see stored-run.mts). --no-style keeps
// the run's own palette and theme type.
//
// Then score it: npx tsx scripts/fidelity.mts <source.pdf> <out.pdf> ...
import fs from "node:fs";
import { renderBookFitted } from "../src/lib/pdf/render-fitted";
import { resolveTrimSize } from "../src/lib/pdf/page-geometry";
import type { Variant } from "../src/lib/pdf/BookDocument";
import { loadStoredBook } from "./stored-run.mjs";

async function main() {
  const args = process.argv.slice(2);
  const zonesAt = args.indexOf("--zones-from");
  const zonesFrom = zonesAt >= 0 ? args.splice(zonesAt, 2)[1] : null;
  const noStyleAt = args.indexOf("--no-style");
  const noStyle = noStyleAt >= 0 && !!args.splice(noStyleAt, 1).length;
  const [prefix, outPath, variant = "student_book"] = args;
  if (!prefix || !outPath) {
    console.error("usage: npx tsx --env-file=.env.local scripts/relayout.mts <runId-prefix> <out.pdf> [variant]");
    process.exit(1);
  }
  const { run, project, outline, units, measured, paletteColors, trimmed } = await loadStoredBook(prefix, { zonesFrom, noStyle });

  const started = Date.now();
  const { pdf, flattened, compacted } = await renderBookFitted({
    bookTitle: outline.bookTitle,
    variant: variant as Variant,
    units,
    level: outline.level,
    contentsUnits: outline.units.map((u) => ({
      number: u.number,
      title: u.title,
      topic: u.learningObjectives[0] ?? "",
      keyTerms: u.keyTerms.join(", "),
      objectives: u.learningObjectives.join("; "),
      level: u.level,
    })),
    coverImageSrc: run.coverImageUrl ?? "",
    pageImages: (run.pageImageUrls as Record<number, string> | null) ?? {},
    generatedAt: new Date().toLocaleDateString("tr-TR"),
    trimSize: resolveTrimSize(project?.trimSize ?? "a4"),
    sourceStyle: paletteColors?.length || measured ? { dominantColors: paletteColors ?? undefined, type: measured } : undefined,
    contentLanguage: outline.contentLanguage,
    designTheme: run.designTheme,
    bookKind: run.bookKind,
  });
  fs.writeFileSync(outPath, pdf);
  console.log(`${outPath}: ${Math.round((Date.now() - started) / 1000)}s, plain flow: ${flattened.join(" ") || "-"}, compacted: ${compacted.join(" ") || "-"}, word-trimmed SB pages: ${trimmed}`);
}
void main();
