import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { AWAITING_STATUSES, formatElapsedTurkish } from "@/lib/run-status";
import type { ProjectWithLatestRun } from "@/lib/project-list";
import { cn } from "@/lib/utils";

// Stable per-project hue so each "book spine" gets its own color.
function spineHue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function ProjectCard({ project, latestRun, className }: ProjectWithLatestRun & { className?: string }) {
  const hue = spineHue(project.id);
  const awaiting = latestRun && AWAITING_STATUSES.has(latestRun.status);

  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        "group relative flex items-center gap-4 overflow-hidden rounded-xl border bg-card p-4 pl-5 text-card-foreground transition-all hover:-translate-y-px hover:border-primary/30 hover:shadow-md hover:shadow-primary/5",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: `linear-gradient(to bottom, oklch(0.62 0.13 ${hue}), oklch(0.5 0.12 ${(hue + 40) % 360}))` }}
      />
      <span
        aria-hidden
        className="flex h-12 w-9 shrink-0 items-end justify-center rounded-[3px_6px_6px_3px] pb-1.5 font-heading text-sm text-white shadow-sm ring-1 ring-black/5"
        style={{ background: `linear-gradient(135deg, oklch(0.6 0.12 ${hue}), oklch(0.45 0.11 ${(hue + 40) % 360}))` }}
      >
        {(project.name.match(/[\p{L}\p{N}]/u)?.[0] ?? "•").toLocaleUpperCase("tr-TR")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-base font-medium text-foreground">{project.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {project.level ? `${project.level} · ` : ""}
          {new Date(project.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <StatusBadge status={latestRun?.status} />
        {awaiting && (
          <span className="text-[11px] text-warning-soft-foreground">
            {formatElapsedTurkish(new Date(latestRun.updatedAt))} bekliyor
          </span>
        )}
      </div>
      <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary max-sm:hidden" />
    </Link>
  );
}
