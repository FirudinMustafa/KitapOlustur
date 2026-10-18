// Re-typesets a finished run's Student Book PDF from its stored content,
// pictures and theme - no AI calls, nothing written to the database or Blob.
// For checking layout changes against real books (Faz G2):
//
//   npx tsx --env-file=.env.local scripts/relayout.mts <runId-prefix> <out.pdf> [variant] [--zones-from <source.pdf>]
//
// --zones-from rebuilds every mirrored page's zone plan from the source as
// it is measured today, as a fresh run would (stored plans predate later
// analyzer fixes).
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

async function main() {
  const args = process.argv.slice(2);
  const zonesAt = args.indexOf("--zones-from");
  const zonesFrom = zonesAt >= 0 ? args.splice(zonesAt, 2)[1] : null;
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
  let units = book.content as GeneratedUnit[];
  if (zonesFrom) {
    const layouts = await analyzeSourceLayout(new Uint8Array(fs.readFileSync(zonesFrom)));
    const rezone = <P extends { sourcePageNumber: number; zonePlan?: unknown }>(p: P): P => {
      const layout = layouts[p.sourcePageNumber - 1];
      return layout ? { ...p, zonePlan: buildZonePlan(layout) } : p;
    };
    units = units.map((u) => ({ ...u, studentBookPages: u.studentBookPages.map(rezone) }));
  }
  const paletteColors = (run.paletteColors as string[] | null) ?? null;

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
    sourceStyle: paletteColors?.length ? { dominantColors: paletteColors } : undefined,
    contentLanguage: outline.contentLanguage,
    designTheme: run.designTheme,
    bookKind: run.bookKind,
  });
  fs.writeFileSync(outPath, pdf);
  console.log(`${outPath}: ${Math.round((Date.now() - started) / 1000)}s, plain flow: ${flattened.join(" ") || "-"}, compacted: ${compacted.join(" ") || "-"}`);
}
void main();
