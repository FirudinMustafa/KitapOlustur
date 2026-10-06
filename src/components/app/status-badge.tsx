import { AlertTriangleIcon, CheckIcon, Clock3Icon, LoaderIcon, PauseIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AWAITING_STATUSES, STATUS_LABELS } from "@/lib/run-status";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

// Single source of truth for how a run status is colored - replaces the
// green/amber/red ternaries that used to be re-typed in every list/view.
export function statusTone(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  if (status === "done") return "success";
  if (status === "failed") return "danger";
  if (AWAITING_STATUSES.has(status) || status === "changes_requested") return "warning";
  if (status === "pending") return "neutral";
  return "info";
}

const TONE_VARIANT = {
  success: "success",
  warning: "warning",
  danger: "destructive",
  info: "info",
  neutral: "secondary",
} as const;

export const TONE_DOT: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted-foreground/50",
};

function ToneIcon({ status, tone }: { status: string; tone: StatusTone }) {
  if (tone === "success") return <CheckIcon />;
  if (tone === "danger") return <XIcon />;
  if (status === "changes_requested") return <AlertTriangleIcon />;
  if (tone === "warning") return <PauseIcon />;
  if (tone === "info") return <LoaderIcon className="animate-spin [animation-duration:2.5s]" />;
  return <Clock3Icon />;
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string | null | undefined;
  label?: string;
  className?: string;
}) {
  const tone = statusTone(status);
  return (
    <Badge variant={TONE_VARIANT[tone]} className={cn("h-6 gap-1.5 px-2.5", className)}>
      {status ? <ToneIcon status={status} tone={tone} /> : null}
      {label ?? (status ? (STATUS_LABELS[status] ?? status) : "—")}
    </Badge>
  );
}

// Small pulsing dot for dense places (sidebar rows, chips).
export function StatusDot({ status, className }: { status: string | null | undefined; className?: string }) {
  const tone = statusTone(status);
  const live = tone === "info" || tone === "warning";
  return (
    <span className={cn("relative flex size-2 shrink-0", className)} title={status ? STATUS_LABELS[status] : undefined}>
      {live && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", TONE_DOT[tone])} />}
      <span className={cn("relative inline-flex size-2 rounded-full", TONE_DOT[tone])} />
    </span>
  );
}
