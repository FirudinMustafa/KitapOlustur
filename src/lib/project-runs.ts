import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";

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
