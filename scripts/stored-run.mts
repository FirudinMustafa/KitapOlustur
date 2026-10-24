// A finished run's Student Book content as a fresh run would print it today -
// read from the database, never written. Shared by relayout.mts and
// agent-designer.mts.
//
// zonesFrom rebuilds every mirrored page's zone plan from the source as it
// is measured today, as a fresh run would (stored plans predate later
// analyzer fixes), and sets the book in the source's measured colours and
// type (Faz G1), and drops exercise tables that give the answers away
// (dropLeakingTable - a fresh run does that while writing), and takes each
// page's word budget from the source as measured today. Pages over their
// budget are trimmed as a fresh run trims them (trimUnitToBudget). noStyle
// keeps the run's own palette and theme type.
import fs from "node:fs";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { extractedOutlines, generatedBooks, generationRuns, projects } from "../src/db/schema";
import type { BookOutline, GeneratedPage, GeneratedUnit } from "../src/lib/ai/schemas";
import { analyzeSourceLayout } from "../src/lib/source-layout-pdf";
import type { SourcePageLayout } from "../src/lib/source-layout";
import { buildZonePlan, zonePictureCount } from "../src/lib/design/zones";
import { classifyPageType } from "../src/lib/design/page-types";
import { deriveSourceTheme, type SourceTheme } from "../src/lib/design/source-theme";
import { dropLeakingTable } from "../src/lib/answer-leak";
import { dropWriterLayouts } from "../src/lib/writer-layout";
import { dropRepeatedBlocks } from "../src/lib/dedupe-blocks";
import { dropMissingPictureRefs } from "../src/lib/picture-refs";
import { continuesLesson, lessonOf, measuredWords } from "../src/lib/source-blueprint";
import { numberUnitExercises } from "../src/lib/exercise-numbers";
import { trimUnitToBudget } from "../src/lib/word-trim";

export type StoredBook = {
  run: typeof generationRuns.$inferSelect;
  project: typeof projects.$inferSelect | undefined;
  outline: BookOutline;
  units: GeneratedUnit[];
  /** The source measured today (zonesFrom), else null. */
  layouts: SourcePageLayout[] | null;
  measured: SourceTheme | null;
  paletteColors: string[] | null;
  /** Student Book pages trimmed to their word budget. */
  trimmed: number;
};

export async function loadStoredBook(prefix: string, { zonesFrom, noStyle = false }: { zonesFrom?: string | null; noStyle?: boolean } = {}): Promise<StoredBook> {
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
    studentBookPages: u.studentBookPages.map((p) => dropMissingPictureRefs(dropRepeatedBlocks(p))),
    workbookPages: u.workbookPages?.map((p) => dropMissingPictureRefs(dropRepeatedBlocks(p))),
  }));
  let measured: SourceTheme | null = null;
  let layouts: SourcePageLayout[] | null = null;
  if (zonesFrom) {
    const measuredLayouts = await analyzeSourceLayout(new Uint8Array(fs.readFileSync(zonesFrom)));
    layouts = measuredLayouts;
    if (!noStyle) measured = deriveSourceTheme(measuredLayouts);
    const rezone = <P extends GeneratedPage>(p: P): P => {
      const layout = measuredLayouts[p.sourcePageNumber - 1];
      const clean = dropWriterLayouts(p);
      if (!layout) return p;
      const zonePlan = buildZonePlan(layout);
      // The page type as a fresh run stores it (applyZonePlans).
      const pageType = classifyPageType(layout);
      const shape = clean.sourceShape ?? { exercises: layout.exerciseCount, pictures: zonePlan ? zonePictureCount(zonePlan) : 0 };
      // The word budget as the source measures today (older runs stored none).
      const words = measuredWords(layout);
      return { ...clean, zonePlan, sourceShape: { ...shape, pageType, words, ...continuesLesson(layout), ...lessonOf(layout) }, blocks: clean.blocks.map(dropLeakingTable) };
    };
    // Exercise numbers go on across a lesson's pages, as a fresh run numbers them.
    units = units.map((u) => ({ ...u, studentBookPages: numberUnitExercises(u.studentBookPages.map(rezone)) }));
  }
  // A fresh run trims a page still over its word budget (trimUnitToBudget).
  let trimmed = 0;
  units = units.map((u) => {
    const out = trimUnitToBudget(u, outline.level);
    trimmed += out.studentBookPages.filter((p, i) => p !== u.studentBookPages[i]).length;
    return out;
  });
  const paletteColors = measured?.colors.length ? measured.colors : ((run.paletteColors as string[] | null) ?? null);
  return { run, project, outline, units, layouts, measured, paletteColors, trimmed };
}
