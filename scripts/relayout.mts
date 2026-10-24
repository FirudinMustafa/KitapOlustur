// Re-typesets a finished run's Student Book PDF from its stored content,
// pictures and theme - no AI calls, nothing written to the database or Blob.
// For checking layout changes against real books (Faz G2):
//
//   npx tsx --env-file=.env.local scripts/relayout.mts <runId-prefix> <out.pdf> [variant] [--zones-from <source.pdf>]
//
// --zones-from rebuilds every mirrored page's zone plan from the source as
// it is measured today, as a fresh run would, and sets the book in the
// source's measured colours and type (see stored-run.mts). --no-style keeps
// the run's own palette and theme type. --specs-from <dir> gives every
// Student Book page that has a design spec there (<runId-prefix>-p<source
// page>.json, as scripts/agent-designer.mts writes them and its fixtures
// are) that spec, as the workflow's agent designer would store it.
//
// Then score it: npx tsx scripts/fidelity.mts <source.pdf> <out.pdf> ...
import fs from "node:fs";
import path from "node:path";
import type { GeneratedPage } from "../src/lib/ai/schemas";
import { parseSpec } from "../src/lib/design/page-layout-spec";
import { renderBookFitted } from "../src/lib/pdf/render-fitted";
import { resolveTrimSize } from "../src/lib/pdf/page-geometry";
import type { Variant } from "../src/lib/pdf/BookDocument";
import { loadStoredBook } from "./stored-run.mjs";

function withSpec(page: GeneratedPage, dir: string, prefix: string): GeneratedPage {
  const file = path.join(dir, `${prefix}-p${page.sourcePageNumber}.json`);
  if (!fs.existsSync(file)) return page;
  const parsed = parseSpec(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!parsed.spec) throw new Error(`${file}: ${parsed.issues.join("; ")}`);
  return { ...page, designSpec: parsed.spec };
}

async function main() {
  const args = process.argv.slice(2);
  const zonesAt = args.indexOf("--zones-from");
  const zonesFrom = zonesAt >= 0 ? args.splice(zonesAt, 2)[1] : null;
  const specsAt = args.indexOf("--specs-from");
  const specsFrom = specsAt >= 0 ? args.splice(specsAt, 2)[1] : null;
  const noStyleAt = args.indexOf("--no-style");
  const noStyle = noStyleAt >= 0 && !!args.splice(noStyleAt, 1).length;
  const [prefix, outPath, variant = "student_book"] = args;
  if (!prefix || !outPath) {
    console.error("usage: npx tsx --env-file=.env.local scripts/relayout.mts <runId-prefix> <out.pdf> [variant]");
    process.exit(1);
  }
  const book = await loadStoredBook(prefix, { zonesFrom, noStyle });
  const { run, project, outline, measured, paletteColors, trimmed } = book;
  const units = specsFrom ? book.units.map((u) => ({ ...u, studentBookPages: u.studentBookPages.map((p) => withSpec(p, specsFrom, prefix)) })) : book.units;

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
