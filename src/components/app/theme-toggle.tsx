"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Açık", Icon: SunIcon },
  { value: "dark", label: "Koyu", Icon: MoonIcon },
  { value: "system", label: "Sistem", Icon: MonitorIcon },
] as const;

// Segmented light/dark/system switch. In the collapsed (icon-only) sidebar
// there's no room for three buttons, so it degrades to a single button that
// cycles through the same three options.
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // next-themes only knows the stored theme on the client; rendering the
  // active state before mount would cause a hydration mismatch.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const current = mounted ? (theme ?? "system") : null;
  const currentIndex = OPTIONS.findIndex((o) => o.value === current);
  const CycleIcon = OPTIONS[currentIndex === -1 ? 2 : currentIndex].Icon;

  return (
    <div className={className}>
      <div
        role="radiogroup"
        aria-label="Tema"
        className="flex items-center gap-0.5 rounded-lg bg-sidebar-accent/60 p-0.5 ring-1 ring-sidebar-border group-data-[collapsible=icon]:hidden"
      >
        {OPTIONS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={current === value}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-xs text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground",
              current === value && "bg-background text-sidebar-foreground shadow-sm ring-1 ring-sidebar-border",
            )}
          >
            <Icon className="size-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        title="Temayı değiştir"
        aria-label="Temayı değiştir"
        onClick={() => setTheme(OPTIONS[(currentIndex + 1) % OPTIONS.length].value)}
        className="hidden size-8 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:flex"
      >
        <CycleIcon className="size-4" />
      </button>
    </div>
  );
}
