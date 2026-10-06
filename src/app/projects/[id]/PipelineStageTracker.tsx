"use client";

import {
  AlertTriangleIcon,
  BookCheckIcon,
  CheckIcon,
  ClipboardCheckIcon,
  FileSearchIcon,
  ImageIcon,
  LayersIcon,
  PackageIcon,
  type LucideIcon,
} from "lucide-react";
import { PIPELINE_STAGES, getPipelineNodeStates, type PipelineStageKey } from "@/lib/run-status";
import type { UnitProgress, UnitChipStatus } from "@/lib/unit-progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/app/status-badge";
import { cn } from "@/lib/utils";

const STAGE_ICONS: Record<PipelineStageKey, LucideIcon> = {
  extract: FileSearchIcon,
  approval: ClipboardCheckIcon,
  generate: LayersIcon,
  coherence: BookCheckIcon,
  assemble: PackageIcon,
  done: CheckIcon,
};

const CHIP_STATUS_STYLES: Record<UnitChipStatus, string> = {
  pending: "bg-secondary text-muted-foreground",
  active: "bg-info-soft text-info-soft-foreground",
  done: "bg-success-soft text-success-soft-foreground",
  attention: "bg-warning-soft text-warning-soft-foreground",
};

const CHIP_STATUS_TEXT: Record<UnitChipStatus, string> = {
  pending: "Beklemede",
  active: "Devam ediyor",
  done: "Tamam",
  attention: "Dikkat gerekiyor",
};

// Raw workflow errors ("FatalError: Step "step//./workflows/..." failed after
// 3 retries: AI did not return a schema-valid object ...") are developer
// detail; the card leads with a plain-language summary and keeps the raw text
// behind a disclosure for debugging.
function friendlyError(message: string): string {
  if (/schema-valid|did not return/i.test(message)) {
    return "Yapay zekâ geçerli bir içerik döndürmedi ve otomatik denemeler tükendi. Yeniden çalıştırmak genellikle sorunu çözer; tamamlanan adımlar tekrar ücretlendirilmez.";
  }
  if (/credit|balance|402|quota|rate.?limit|429/i.test(message)) {
    return "Yapay zekâ sağlayıcısı kota veya kredi sınırına takıldı. Bir süre sonra yeniden çalıştırabilirsin.";
  }
  if (/onaylamadı|iptal/i.test(message)) return message;
  if (/No outline found|not found/i.test(message)) {
    return "Bu üretim için gerekli bir önceki adımın verisi bulunamadı. Projeyi yeniden çalıştır.";
  }
  return message.length > 160 ? "Üretim sırasında beklenmeyen bir hata oluştu. Yeniden çalıştırmayı dene." : message;
}

function StageRail({ status }: { status: string }) {
  const states = getPipelineNodeStates(status);
  return (
    <ol className="grid gap-3 sm:grid-cols-6 sm:gap-0">
      {PIPELINE_STAGES.map((stage, i) => {
        const state = states[i];
        const Icon = state === "done" ? CheckIcon : STAGE_ICONS[stage.key];
        const last = i === PIPELINE_STAGES.length - 1;
        return (
          <li key={stage.key} className="relative flex items-start gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center">
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-9 bottom-[-12px] left-[17px] w-px sm:top-[17px] sm:right-[-50%] sm:bottom-auto sm:left-1/2 sm:h-px sm:w-auto",
                  state === "done" ? "bg-success/60" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 bg-card transition-colors",
                state === "done" && "border-success bg-success text-success-foreground",
                state === "active" && "border-primary text-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_15%,transparent)]",
                state === "pending" && "border-border text-muted-foreground",
              )}
            >
              {state === "active" && (
                <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/20 [animation-duration:2s]" />
              )}
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 sm:px-1">
              <span
                className={cn(
                  "block text-sm font-medium",
                  state === "pending" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {stage.label}
              </span>
              {/* Faz "Onay Zinciri Görünürlüğü": bu aşamada zaten çalışan
                  otomatik AI denetimlerini isimlendirilmiş bir editöryel
                  persona anlatısı olarak gösterir - bkz. src/lib/personas.ts. */}
              {stage.persona && (
                <span className="line-clamp-2 block text-[11px] text-muted-foreground" title={stage.persona}>
                  {stage.persona}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function UnitChip({ label, status }: { label: string; status: UnitChipStatus }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium",
              CHIP_STATUS_STYLES[status],
            )}
          />
        }
      >
        {status === "done" && <CheckIcon className="size-3" />}
        {status === "attention" && <AlertTriangleIcon className="size-3" />}
        {status === "active" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
        {label}
      </TooltipTrigger>
      <TooltipContent>
        {label}: {CHIP_STATUS_TEXT[status]}
      </TooltipContent>
    </Tooltip>
  );
}

export function PipelineStageTracker({
  status,
  currentStage,
  errorMessage,
  unitCount,
  tokenUsageTotal,
  modelVersion,
  flaggedImageCount,
  flaggedOriginalityCount,
  unitProgress,
}: {
  status: string;
  currentStage: string | null;
  errorMessage?: string | null;
  unitCount?: number;
  tokenUsageTotal?: number;
  modelVersion?: string | null;
  flaggedImageCount?: number;
  flaggedOriginalityCount?: number;
  unitProgress?: UnitProgress[];
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 text-card-foreground shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-medium text-foreground">Üretim akışı</h2>
        <StatusBadge status={status} />
      </div>

      <div className="mt-5">
        <StageRail status={status} />
      </div>

      {(currentStage || (status === "failed" && errorMessage)) && (
        <div className="mt-5 flex flex-col gap-2 border-t pt-4">
          {currentStage && status !== "failed" && <p className="text-sm text-muted-foreground">{currentStage}</p>}
          {status === "failed" && errorMessage && (
            <div className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger-soft-foreground">
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                {friendlyError(errorMessage)}
              </p>
              {friendlyError(errorMessage) !== errorMessage && (
                <details className="mt-2 text-xs opacity-80">
                  <summary className="cursor-pointer">Teknik ayrıntı</summary>
                  <p className="mt-1 break-words font-mono">{errorMessage}</p>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {(unitCount !== undefined || !!tokenUsageTotal) && (
        <p className="mt-3 text-xs text-muted-foreground">
          {unitCount !== undefined && <>Dizelgede {unitCount} ünite.</>}
          {!!tokenUsageTotal && (
            <>
              {" "}
              Kullanım: ~{tokenUsageTotal.toLocaleString("tr-TR")} token
              {modelVersion ? ` · ${modelVersion}` : ""}
            </>
          )}
        </p>
      )}
      {(!!flaggedImageCount || !!flaggedOriginalityCount) && (
        <div className="mt-3 flex flex-col gap-1.5">
          {!!flaggedImageCount && (
            <p className="flex items-start gap-2 text-xs font-medium text-warning-soft-foreground">
              <ImageIcon className="mt-px size-3.5 shrink-0" />
              {flaggedImageCount} görsel otomatik kalite kontrolünden geçemedi - manuel incelemesi önerilir.
            </p>
          )}
          {!!flaggedOriginalityCount && (
            <p className="flex items-start gap-2 text-xs font-medium text-warning-soft-foreground">
              <AlertTriangleIcon className="mt-px size-3.5 shrink-0" />
              {flaggedOriginalityCount} sayfada kaynak kitapla yüksek metin benzerliği tespit edildi - hukuki bir
              değerlendirme değildir, manuel incelemesi önerilir.
            </p>
          )}
        </div>
      )}

      {!!unitProgress?.length && (
        <ul className="mt-4 flex flex-col gap-2 border-t pt-4">
          {unitProgress.map((u) => (
            <li key={u.unitNumber} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                <span className="text-muted-foreground">Ünite {u.unitNumber} · </span>
                {u.title}
              </span>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <UnitChip label="İçerik" status={u.content} />
                <UnitChip label="Görsel" status={u.image} />
                <UnitChip label="Ses" status={u.audio} />
                <UnitChip label="İnceleme" status={u.review} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
