// Re-typesets a finished run's Student Book PDF from its stored content,
// pictures and theme - no AI calls, nothing written to the database or Blob.
// For checking layout changes against real books (Faz G2):
//
//   npx tsx --env-file=.env.local scripts/relayout.mts <runId-prefix> <out.pdf> [variant] [--zones-from <source.pdf>]
//
// --zones-from rebuilds every mirrored page's zone plan from the source as
// it is measured today, as a fresh run would (stored plans predate later
// analyzer fixes), and sets the book in the source's measured colours and
// type (Faz G1), and drops exercise tables that give the answers away
// (dropLeakingTable - a fresh run does that while writing). --no-style keeps
// the run's own palette and theme type.
//
// Then score it: npx tsx scripts/fidelity.mts <source.pdf> <out.pdf> ...
import fs from "node:fs";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { extractedOutlines, generatedBooks, generationRuns, projects } from "../src/db/schema";
import type { BookOutline, GeneratedUnit } from "../src/lib/ai/schemas";
import { renderBookFitted } from "../src/lib/pdf/render-fitted";
import { resolveTrimSize } from "../src/lib/pdf/page-geometry";
import type { Variant } from "../src/lib/pdf/BookDocument";
import { analyzeSourceLayout } from "../src/lib/source-layout-pdf";
import { buildZonePlan } from "../src/lib/design/zones";
import { deriveSourceTheme, type SourceTheme } from "../src/lib/design/source-theme";
import { dropLeakingTable } from "../src/lib/answer-leak";
import { dropWriterLayouts } from "../src/lib/writer-layout";
import { dropRepeatedBlocks } from "../src/lib/dedupe-blocks";

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
  const run = await db.query.generationRuns.findFirst({
    where: sql`${generationRuns.id}::text like ${`${prefix}%`}`,
  });
  if (!run) throw new Error(`no run ${prefix}`);
  const project = await db.query.projects.findFirst({ where: eq(projects.id, run.projectId) });
  const outlineRow = await db.query.extractedOutlines.findFirst({ where: eq(extractedOutlines.runId, run.id) });
  const book = await db.query.generatedBooks.findFirst({
    where: eq(generatedBooks.runId, run.id),
    orderBy: [desc(generatedBooks.createdAt)],
  });
  if (!outlineRow || !book?.content) throw new Error("run has no outline or book content");
  const outline = (outlineRow.outline as { outline: BookOutline }).outline;
  // Clean-ups a fresh run now applies while writing (applyDiagramFixes).
  let units = (book.content as GeneratedUnit[]).map((u) => ({
    ...u,
    studentBookPages: u.studentBookPages.map(dropRepeatedBlocks),
    workbookPages: u.workbookPages?.map(dropRepeatedBlocks),
  }));
  let measured: SourceTheme | null = null;
  if (zonesFrom) {
    const layouts = await analyzeSourceLayout(new Uint8Array(fs.readFileSync(zonesFrom)));
    if (!noStyle) measured = deriveSourceTheme(layouts);
    const rezone = <P extends { sourcePageNumber: number; zonePlan?: unknown; blocks: GeneratedUnit["studentBookPages"][number]["blocks"] }>(p: P): P => {
      const layout = layouts[p.sourcePageNumber - 1];
      const clean = dropWriterLayouts(p);
      return layout ? { ...clean, zonePlan: buildZonePlan(layout), blocks: clean.blocks.map(dropLeakingTable) } : p;
    };
    units = units.map((u) => ({ ...u, studentBookPages: u.studentBookPages.map(rezone) }));
  }
  const paletteColors = measured?.colors.length ? measured.colors : ((run.paletteColors as string[] | null) ?? null);

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
  console.log(`${outPath}: ${Math.round((Date.now() - started) / 1000)}s, plain flow: ${flattened.join(" ") || "-"}, compacted: ${compacted.join(" ") || "-"}`);
}
void main();
