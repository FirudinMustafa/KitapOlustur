import { HourglassIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// One shared look for every human-in-the-loop wait state on the run page
// (outline / logo / variant / content / image / final approval) - these were
// six copy-pasted amber boxes before.
export function ApprovalGate({
  title,
  waiting,
  description,
  children,
  actions,
  className,
}: {
  title: React.ReactNode;
  /** Already-formatted "n dakikadır" style text, shown as "… bekliyor". */
  waiting?: string | null;
  description?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-warning/40 bg-warning-soft/60 text-foreground shadow-sm",
        className,
      )}
    >
      <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-warning" />
      <div className="flex flex-col gap-3 p-4 pl-5 sm:p-5 sm:pl-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning-soft-foreground ring-1 ring-warning/30">
            <HourglassIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h2 className="font-heading text-base font-medium text-foreground">{title}</h2>
              {waiting && <span className="text-xs text-warning-soft-foreground">{waiting} bekliyor</span>}
            </div>
            {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
          </div>
        </div>
        {children}
        {actions && <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>}
      </div>
    </section>
  );
}
