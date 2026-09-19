import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, generationRuns } from "@/db/schema";
import { STATUS_LABELS, AWAITING_STATUSES, formatElapsedTurkish } from "@/lib/run-status";

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
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Projeler</h1>
        <Link
          href="/projects/new"
          className="flex h-9 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Yeni kitap yükle
        </Link>
      </div>

      {withRuns.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500">Henüz bir proje yok. Başlamak için bir PDF yükle.</p>
      )}

      <ul className="mt-8 flex flex-col gap-3">
        {withRuns.map(({ project, latestRun }) => (
          <li key={project.id}>
            <Link
              href={`/projects/${project.id}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{project.name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
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
