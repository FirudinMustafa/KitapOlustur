import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { LibraryBigIcon, PlusIcon } from "lucide-react";

import { listProjectsWithLatestRun } from "@/lib/project-list";
import { AWAITING_STATUSES } from "@/lib/run-status";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { ProjectCard } from "@/components/app/project-card";
import { EmptyState } from "@/components/app/empty-state";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  // Faz G3: middleware already requires sign-in for this route, so userId is
  // always set here - the redirect() path only guards against calling this
  // page directly in a context middleware didn't run (defense in depth).
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const withRuns = await listProjectsWithLatestRun(userId);
  const awaitingCount = withRuns.filter((r) => r.latestRun && AWAITING_STATUSES.has(r.latestRun.status)).length;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Kütüphane"
        title="Kitap projeleri"
        description={
          withRuns.length
            ? `${withRuns.length} proje${awaitingCount ? ` · ${awaitingCount} tanesi onayını bekliyor` : ""}`
            : "Ürettiğin tüm kitaplar burada listelenir."
        }
        actions={
          <Button render={<Link href="/projects/new" />}>
            <PlusIcon data-icon="inline-start" />
            Yeni kitap
          </Button>
        }
      />

      {withRuns.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={LibraryBigIcon}
          title="Henüz bir proje yok"
          description="Bir kaynak PDF yükle ya da sıfırdan bir kitap tasarla; orkestra gerisini halleder."
          action={
            <Button render={<Link href="/projects/new" />}>
              <PlusIcon data-icon="inline-start" />
              İlk kitabını oluştur
            </Button>
          }
        />
      ) : (
        <ul className="mt-8 flex flex-col gap-2.5">
          {withRuns.map((row) => (
            <li key={row.project.id}>
              <ProjectCard {...row} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
