"use client";

import { PIPELINE_STAGES, STATUS_LABELS, getPipelineNodeStates } from "@/lib/run-status";
import type { UnitProgress, UnitChipStatus } from "@/lib/unit-progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const CHIP_STATUS_STYLES: Record<UnitChipStatus, string> = {
  pending: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  attention: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

const CHIP_STATUS_TEXT: Record<UnitChipStatus, string> = {
  pending: "Beklemede",
  active: "Devam ediyor",
  done: "Tamam",
  attention: "Dikkat gerekiyor",
};

function StageRail({ status }: { status: string }) {
  const states = getPipelineNodeStates(status);
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {PIPELINE_STAGES.map((stage, i) => (
        <div key={stage.key} className="flex items-center gap-1">
          <span
            className={`flex h-7 items-center whitespace-nowrap rounded-full px-3 text-xs font-medium ${
              states[i] === "done"
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                : states[i] === "active"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {stage.label}
          </span>
          {i < PIPELINE_STAGES.length - 1 && (
            <span
              className={`h-px w-4 shrink-0 ${
                states[i] === "done" ? "bg-green-300 dark:bg-green-800" : "bg-zinc-200 dark:bg-zinc-700"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function UnitChip({ label, status }: { label: string; status: UnitChipStatus }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="outline" className={`border-transparent ${CHIP_STATUS_STYLES[status]}`}>
          {label}
        </Badge>
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
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Pipeline durumu</span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            status === "done"
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
              : status === "failed"
                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      <div className="mt-3">
        <StageRail status={status} />
      </div>

      {currentStage && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{currentStage}</p>}
      {status === "failed" && errorMessage && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
      )}
      {unitCount !== undefined && <p className="mt-2 text-xs text-zinc-500">Dizelgede {unitCount} ünite bulundu.</p>}
      {!!tokenUsageTotal && (
        <p className="mt-1 text-xs text-zinc-400">
          Tahmini kullanım: ~{tokenUsageTotal.toLocaleString("tr-TR")} token
          {modelVersion ? ` · ${modelVersion}` : ""}
        </p>
      )}
      {!!flaggedImageCount && (
        <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          {flaggedImageCount} görsel otomatik kalite kontrolünden geçemedi — manuel incelemesi önerilir.
        </p>
      )}
      {!!flaggedOriginalityCount && (
        <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
          {flaggedOriginalityCount} sayfada kaynak kitapla yüksek metin benzerliği tespit edildi — bu bir hukuki
          değerlendirme değildir, manuel incelemesi önerilir.
        </p>
      )}

      {!!unitProgress?.length && (
        <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {unitProgress.map((u) => (
            <div key={u.unitNumber} className="flex items-center justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                Ünite {u.unitNumber}: {u.title}
              </span>
              <div className="flex shrink-0 gap-1.5">
                <UnitChip label="İçerik" status={u.content} />
                <UnitChip label="Görsel" status={u.image} />
                <UnitChip label="Ses" status={u.audio} />
                <UnitChip label="İnceleme" status={u.review} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
