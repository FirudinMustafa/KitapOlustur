import type { LucideIcon } from "lucide-react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("relative overflow-hidden rounded-2xl border border-dashed bg-card/50 py-14", className)}>
      <DotPattern
        width={18}
        height={18}
        className="text-foreground/10 [mask-image:radial-gradient(260px_circle_at_center,white,transparent)]"
      />
      <EmptyHeader className="relative">
        <EmptyMedia variant="icon" className="size-12 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-6" />
        </EmptyMedia>
        <EmptyTitle className="font-heading text-xl font-medium">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent className="relative">{action}</EmptyContent>}
    </Empty>
  );
}
