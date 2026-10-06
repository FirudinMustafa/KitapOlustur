import { cn } from "@/lib/utils";

// Shared page frame: replaces the `mx-auto w-full max-w-* px-6 py-12`
// wrapper + bare <h1> that every page used to re-type.
export function PageContainer({
  size = "default",
  className,
  ...props
}: React.ComponentProps<"div"> & { size?: "narrow" | "default" | "wide" | "full" }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-8 sm:px-6 sm:py-10",
        size === "narrow" && "max-w-2xl",
        size === "default" && "max-w-4xl",
        size === "wide" && "max-w-6xl",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow && (
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{eyebrow}</div>
        )}
        <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-[2.1rem]">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// Titled content section inside a page (lighter than a Card).
export function PageSection({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-medium text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
