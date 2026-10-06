import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import {
  ArrowRightIcon,
  BookCheckIcon,
  FileUpIcon,
  HourglassIcon,
  LibraryBigIcon,
  SearchIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";

import { listProjectsWithLatestRun } from "@/lib/project-list";
import { AWAITING_STATUSES } from "@/lib/run-status";
import { Button } from "@/components/ui/button";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { BlurFade } from "@/components/ui/blur-fade";
import { DotPattern } from "@/components/ui/dot-pattern";
import { PageContainer, PageSection } from "@/components/app/page-header";
import { ProjectCard } from "@/components/app/project-card";
import { StatCard } from "@/components/app/stat-card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Bento quick-action grid - layout pattern adapted from Magic UI's /
// Kokonut UI's bento grids (MIT): one wide lead tile + smaller tiles.
const ACTIONS = [
  {
    href: "/projects/new",
    title: "Kaynak PDF'ten üret",
    description:
      "Mevcut bir ders kitabını yükle; konu ve dil otomatik tespit edilir, aynı yapıdan özgün bir seri üretilir.",
    Icon: FileUpIcon,
    className: "sm:col-span-2 sm:row-span-2",
    lead: true,
  },
  {
    href: "/projects/new?mode=scratch",
    title: "Sıfırdan tasarla",
    description: "Sadece konu, seviye ve ünite sayısı ver.",
    Icon: WandSparklesIcon,
  },
  {
    href: "/studio",
    title: "Hikaye Stüdyosu",
    description: "Sohbet ederek resimli hikayeler yaz.",
    Icon: SparklesIcon,
  },
  {
    href: "/search",
    title: "Kütüphanede ara",
    description: "Üretilen tüm içerikte anlamsal arama.",
    Icon: SearchIcon,
    className: "sm:col-span-2",
  },
];

export default async function Home() {
  const { userId } = await auth();
  const rows = userId ? await listProjectsWithLatestRun(userId) : [];
  const recent = rows.slice(0, 4);
  const done = rows.filter((r) => r.latestRun?.status === "done").length;
  const awaiting = rows.filter((r) => r.latestRun && AWAITING_STATUSES.has(r.latestRun.status)).length;

  return (
    <div className="relative">
      <DotPattern
        width={22}
        height={22}
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] text-foreground/[0.07] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,white,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent),radial-gradient(ellipse_40%_40%_at_85%_10%,color-mix(in_oklch,var(--warm)_12%,transparent),transparent)]"
      />

      <PageContainer size="wide" className="relative">
        <section className="flex flex-col items-center pt-6 pb-12 text-center sm:pt-12">
          <BlurFade delay={0.05} inView>
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3.5 py-1 text-xs shadow-sm backdrop-blur">
              <SparklesIcon className="size-3.5 text-warm" />
              <AnimatedShinyText className="mx-0">Yapay zekâ destekli kitap atölyesi</AnimatedShinyText>
            </div>
          </BlurFade>
          <BlurFade delay={0.12} inView>
            <h1 className="mt-6 max-w-3xl font-heading text-4xl leading-[1.05] font-medium tracking-tight text-foreground sm:text-6xl">
              Bir ders kitabından,{" "}
              <em className="bg-gradient-to-r from-primary to-warm bg-clip-text font-normal text-transparent">
                yepyeni bir seri.
              </em>
            </h1>
          </BlurFade>
          <BlurFade delay={0.2} inView>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Student book, workbook, öğretmen kitabı ve test kitapçığı. Editoryal onay adımlarıyla, baskıya
              hazır PDF olarak.
            </p>
          </BlurFade>
          <BlurFade delay={0.28} inView>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="xl" render={<Link href="/projects/new" />}>
                Yeni kitap oluştur
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <Button size="xl" variant="outline" render={<Link href="/projects" />}>
                <LibraryBigIcon data-icon="inline-start" />
                Projelerim
              </Button>
            </div>
          </BlurFade>
        </section>

        {rows.length > 0 && (
          <BlurFade delay={0.32} inView>
            <div className="mx-auto mb-12 grid max-w-3xl grid-cols-3 gap-3">
              <StatCard label="Toplam proje" value={rows.length} icon={LibraryBigIcon} />
              <StatCard label="Tamamlanan" value={done} icon={BookCheckIcon} />
              <StatCard
                label="Onay bekleyen"
                value={awaiting}
                icon={HourglassIcon}
                className={cn(awaiting > 0 && "border-warning/40 bg-warning-soft/50")}
              />
            </div>
          </BlurFade>
        )}

        <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr]">
          <PageSection title="Ne yapmak istersin?">
            <div className="grid auto-rows-[minmax(8.5rem,auto)] gap-3 sm:grid-cols-3">
              {ACTIONS.map(({ href, title, description, Icon, className, lead }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-5 text-card-foreground transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
                    className,
                  )}
                >
                  {lead && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -right-10 -bottom-12 size-56 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_70%)] transition-transform duration-500 group-hover:scale-110"
                    />
                  )}
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15",
                      lead && "size-12 bg-primary text-primary-foreground ring-0",
                    )}
                  >
                    <Icon className={lead ? "size-6" : "size-5"} />
                  </span>
                  <div className="relative mt-4">
                    <h3 className={cn("font-heading font-medium text-foreground", lead ? "text-2xl" : "text-base")}>
                      {title}
                    </h3>
                    <p className={cn("mt-1 text-muted-foreground", lead ? "max-w-xs text-sm" : "text-xs")}>
                      {description}
                    </p>
                    {lead && (
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Başla
                        <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </PageSection>

          <PageSection
            title="Son projeler"
            actions={
              rows.length > 0 ? (
                <Button variant="ghost" size="sm" render={<Link href="/projects" />}>
                  Tümü
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              ) : null
            }
          >
            {recent.length === 0 ? (
              <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                <LibraryBigIcon className="mb-2 size-6 text-muted-foreground/60" />
                Henüz proje yok. İlk kitabın burada görünecek.
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {recent.map((row) => (
                  <li key={row.project.id}>
                    <ProjectCard {...row} />
                  </li>
                ))}
              </ul>
            )}
          </PageSection>
        </div>
      </PageContainer>
    </div>
  );
}
