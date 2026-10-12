import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { generatedBooks, generationRuns } from "@/db/schema";

type GeneratedBookRow = typeof generatedBooks.$inferSelect;

// The newest run of a project that actually finished. Reader views use this
// rather than the newest run overall: a rerun that failed (or is still
// running) shouldn't make an already-built book unreadable (QA fix,
// 2026-10-06).
export async function latestDoneRun(projectId: string) {
  return db.query.generationRuns.findFirst({
    where: and(eq(generationRuns.projectId, projectId), eq(generationRuns.status, "done")),
    orderBy: [desc(generationRuns.createdAt)],
  });
}

// The books the project page offers for download. While a newer run is
// working (or after it failed) its own book rows are missing or partial, so
// the last finished run's books stay visible instead of every download
// button disappearing.
export async function deliveredBooks(
  projectId: string,
  latestRun: { id: string; status: string } | null | undefined,
  latestRunBooks: GeneratedBookRow[],
): Promise<{ books: GeneratedBookRow[]; fromRunId: string | null }> {
  if (!latestRun || latestRun.status === "done") return { books: latestRunBooks, fromRunId: latestRun?.id ?? null };
  const done = await latestDoneRun(projectId);
  if (!done) return { books: latestRunBooks, fromRunId: latestRun.id };
  const books = await db.query.generatedBooks.findMany({ where: eq(generatedBooks.runId, done.id) });
  return { books, fromRunId: done.id };
}
