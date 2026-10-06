import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, generationRuns } from "@/db/schema";

// Owner's projects (newest first) paired with each one's latest run - shared
// by the home dashboard and the /projects list.
export async function listProjectsWithLatestRun(ownerId: string, limit?: number) {
  const rows = await db.query.projects.findMany({
    where: eq(projects.ownerId, ownerId),
    orderBy: [desc(projects.createdAt)],
    ...(limit ? { limit } : {}),
  });

  return Promise.all(
    rows.map(async (project) => {
      const latestRun = await db.query.generationRuns.findFirst({
        where: eq(generationRuns.projectId, project.id),
        orderBy: [desc(generationRuns.createdAt)],
      });
      return { project, latestRun: latestRun ?? null };
    }),
  );
}

export type ProjectWithLatestRun = Awaited<ReturnType<typeof listProjectsWithLatestRun>>[number];
