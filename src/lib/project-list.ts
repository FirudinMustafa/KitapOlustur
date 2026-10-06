import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, generationRuns } from "@/db/schema";

export type LatestRunSummary = {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

// Owner's projects (newest first) paired with a slim summary of each one's
// latest run - shared by the home dashboard, the /projects list and the
// sidebar's GET /api/projects.
//
// QA fix (2026-10-06): this used to run one query per project and return
// the FULL generationRuns row (pending content approvals with whole units,
// page image maps, token usage...) to the sidebar on every navigation,
// although every caller only reads status/timestamps. Now two queries and
// only the columns the list views use.
export async function listProjectsWithLatestRun(ownerId: string, limit?: number) {
  const rows = await db.query.projects.findMany({
    where: eq(projects.ownerId, ownerId),
    orderBy: [desc(projects.createdAt)],
    ...(limit ? { limit } : {}),
  });
  if (!rows.length) return [];

  const runs = await db
    .select({
      id: generationRuns.id,
      projectId: generationRuns.projectId,
      status: generationRuns.status,
      createdAt: generationRuns.createdAt,
      updatedAt: generationRuns.updatedAt,
    })
    .from(generationRuns)
    .where(
      inArray(
        generationRuns.projectId,
        rows.map((p) => p.id),
      ),
    )
    .orderBy(desc(generationRuns.createdAt));

  const latestByProject = new Map<string, LatestRunSummary>();
  for (const run of runs) {
    if (!latestByProject.has(run.projectId)) {
      latestByProject.set(run.projectId, {
        id: run.id,
        status: run.status,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      });
    }
  }

  return rows.map((project) => ({ project, latestRun: latestByProject.get(project.id) ?? null }));
}

export type ProjectWithLatestRun = Awaited<ReturnType<typeof listProjectsWithLatestRun>>[number];
