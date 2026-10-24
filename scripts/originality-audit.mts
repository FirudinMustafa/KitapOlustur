// What the originality guards make of a finished run - no AI calls, nothing
// written to the database or Blob:
//   - the source's people and feature names, the pages that use them and
//     the fixed new names they get (src/lib/source-names.ts),
//   - mirrored pages that follow their source page item by item or repeat
//     its instructions (src/lib/mirroring.ts),
//   - picture prompts extended to show their exercise (src/lib/exercise-picture.ts).
//
//   npx tsx --env-file=.env.local scripts/originality-audit.mts <runId-prefix> [--reference <book.pdf> --offset <n>]
//
// --reference checks a hand-made book's pages against the run's source
// pages instead (reference page k = source page k + offset): every text line
// is taken as a possible instruction, since a PDF has no headings.
import fs from "node:fs";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { generatedBooks, generationRuns, sourcePageMaps } from "../src/db/schema";
import type { GeneratedPage, GeneratedUnit, SourcePage } from "../src/lib/ai/schemas";
import { extractSourceNames, sourceNameIssues, sourceNameReplacements, usedFeatures, usedNames } from "../src/lib/source-names";
import { structuralMirroring, type MirroringReport } from "../src/lib/mirroring";
import { alignPictureWithExercise } from "../src/lib/exercise-picture";
import { classifyPageType } from "../src/lib/design/page-types";

function showMirror(tag: string, r: MirroringReport) {
  console.log(`${r.flagged ? "FLAG" : "  ok"} ${tag}: ${r.mirroredItems}/${r.comparedItems} sentence frames in source order, ${r.sharedRubrics.length} source instructions${r.sharedRubrics.length ? ` ${JSON.stringify(r.sharedRubrics)}` : ""}`);
  if (r.flagged) for (const e of r.examples) console.log(`       "${e.source}"  ~  "${e.generated}"`);
}

async function referenceText(pdfPath: string): Promise<string[]> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(fs.readFileSync(pdfPath), "application/pdf");
  return Array.from({ length: doc.countPages() }, (_, i) => doc.loadPage(i).toStructuredText("preserve-whitespace").asText());
}

async function main() {
  const args = process.argv.slice(2);
  const refAt = args.indexOf("--reference");
  const reference = refAt >= 0 ? args.splice(refAt, 2)[1] : null;
  const offAt = args.indexOf("--offset");
  const offset = offAt >= 0 ? Number(args.splice(offAt, 2)[1]) : 0;
  const [prefix] = args;
  if (!prefix) {
    console.error("usage: npx tsx --env-file=.env.local scripts/originality-audit.mts <runId-prefix> [--reference <book.pdf> --offset <n>]");
    process.exit(1);
  }
  const run = await db.query.generationRuns.findFirst({ where: sql`${generationRuns.id}::text like ${`${prefix}%`}` });
  if (!run) throw new Error(`no run ${prefix}`);
  const map = await db.query.sourcePageMaps.findFirst({ where: eq(sourcePageMaps.runId, run.id) });
  const sourcePages = (map?.pages ?? []) as SourcePage[];
  const names = extractSourceNames(sourcePages);
  console.log(`source characters: ${names.characters.join(", ") || "-"}`);
  console.log(`source names:      ${names.names.join(", ") || "-"}`);
  console.log(`source features:   ${names.features.join(" | ") || "-"}`);
  console.log(`new names:         ${JSON.stringify(sourceNameReplacements(names))}\n`);

  if (reference) {
    const pages = await referenceText(reference);
    let flagged = 0;
    let compared = 0;
    for (const [i, text] of pages.entries()) {
      const source = sourcePages.find((s) => s.pageNumber === i + 1 + offset);
      if (!source?.sourceText) continue;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const report = structuralMirroring({ text: source.sourceText, rubrics: source.layout?.exerciseRubrics }, { blocks: lines.map((heading) => ({ heading })) });
      compared++;
      if (report.flagged) flagged++;
      const features = [...usedFeatures(lines, names.features), ...usedNames(text, names.names)];
      showMirror(`reference p${i + 1} vs source p${source.pageNumber}${features.length ? ` (source names: ${features.join(", ")})` : ""}`, report);
    }
    console.log(`\nreference pages mirroring their source: ${flagged}/${compared}`);
    return;
  }

  const book = await db.query.generatedBooks.findFirst({ where: eq(generatedBooks.runId, run.id), orderBy: [desc(generatedBooks.createdAt)] });
  const units = (book?.content ?? []) as GeneratedUnit[];
  let flagged = 0;
  let compared = 0;
  let pictures = 0;
  let aligned = 0;
  for (const unit of units) {
    for (const [label, pages] of [["Student Book", unit.studentBookPages], ["Workbook", unit.workbookPages]] as const) {
      for (const stored of pages ?? []) {
        const layout = sourcePages.find((s) => s.pageNumber === stored.sourcePageNumber)?.layout;
        // Stored runs predate sourceShape.pageType on every page.
        const page: GeneratedPage = layout && !stored.sourceShape?.pageType ? { ...stored, sourceShape: { ...stored.sourceShape, pageType: classifyPageType(layout) } as GeneratedPage["sourceShape"] } : stored;
        for (const issue of sourceNameIssues(page, names, label)) console.log(`NAME ${issue}`);
        const source = sourcePages.find((s) => s.pageNumber === page.sourcePageNumber && page.sourcePageNumber < 300);
        if (source?.sourceText) {
          const report = structuralMirroring({ text: source.sourceText, rubrics: source.layout?.exerciseRubrics }, page);
          compared++;
          if (report.flagged) flagged++;
          showMirror(`${label} p${page.sourcePageNumber}`, report);
        }
        if (page.imagePrompt) {
          pictures++;
          const after = alignPictureWithExercise(page);
          if (after.imagePrompt !== page.imagePrompt) {
            aligned++;
            console.log(`PICTURE ${label} p${page.sourcePageNumber}\n   before: ${page.imagePrompt}\n   after:  ${after.imagePrompt}`);
          }
        }
      }
    }
  }
  console.log(`\nmirrored pages flagged: ${flagged}/${compared}; picture prompts extended: ${aligned}/${pictures}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
