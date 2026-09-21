import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, generationRuns } from "@/db/schema";
import { STATUS_LABELS, AWAITING_STATUSES, formatElapsedTurkish } from "@/lib/run-status";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  // Faz G3: middleware already requires sign-in for this route, so userId is
  // always set here - the redirect() path only guards against calling this
  // page directly in a context middleware didn't run (defense in depth).
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const allProjects = await db.query.projects.findMany({
    where: eq(projects.ownerId, userId),
    orderBy: [desc(projects.createdAt)],
  });

  const withRuns = await Promise.all(
    allProjects.map(async (project) => {
      const latestRun = await db.query.generationRuns.findFirst({
        where: eq(generationRuns.projectId, project.id),
        orderBy: [desc(generationRuns.createdAt)],
      });
      return { project, latestRun };
    }),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Projeler</h1>
        <Button render={<Link href="/projects/new" />}>Yeni kitap yükle</Button>
      </div>

      {withRuns.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">Henüz bir proje yok. Başlamak için bir PDF yükle.</p>
      )}

      <ul className="mt-8 flex flex-col gap-3">
        {withRuns.map(({ project, latestRun }) => (
          <li key={project.id}>
            <Link
              href={`/projects/${project.id}`}
              className="flex items-center justify-between gap-4 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 transition-colors hover:bg-accent hover:ring-primary/30"
            >
              <div>
                <p className="font-medium text-foreground">{project.name}</p>
                <p className="text-xs text-muted-foreground">
                  {project.level ? `${project.level} · ` : ""}
                  {new Date(project.createdAt).toLocaleString("tr-TR")}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    latestRun?.status === "done"
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                      : latestRun?.status === "failed"
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        : latestRun && AWAITING_STATUSES.has(latestRun.status)
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {latestRun ? STATUS_LABELS[latestRun.status] ?? latestRun.status : "—"}
                </span>
                {latestRun && AWAITING_STATUSES.has(latestRun.status) && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-400">
                    {formatElapsedTurkish(new Date(latestRun.updatedAt))} bekliyor
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
