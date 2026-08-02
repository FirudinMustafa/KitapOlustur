import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, generationRuns } from "@/db/schema";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  extracting: "Dizelge çıkarılıyor",
  analyzing: "Analiz ediliyor",
  generating: "Üretiliyor",
  reviewing: "İnceleniyor",
  assembling: "Birleştiriliyor",
  done: "Tamamlandı",
  failed: "Hata",
};

export default async function ProjectsPage() {
  const allProjects = await db.query.projects.findMany({ orderBy: [desc(projects.createdAt)] });

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
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  latestRun?.status === "done"
                    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                    : latestRun?.status === "failed"
                      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {latestRun ? STATUS_LABELS[latestRun.status] ?? latestRun.status : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
