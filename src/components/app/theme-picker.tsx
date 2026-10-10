"use client";

import { cn } from "@/lib/utils";
import { DESIGN_THEMES, DESIGN_THEME_IDS, type DesignTheme, type DesignThemeId } from "@/lib/design/themes";

// Faz 1 "Tasarım sistemi": theme chooser with a tiny page mock-up per theme
// - cover treatment, card style, corner radius and palette - so the choice
// is made by looking, not by reading a name.

function MiniPage({ theme }: { theme: DesignTheme }) {
  const p = theme.palettes.student_book;
  const r = Math.min(theme.radius, 8);
  const card =
    theme.cardStyle === "tinted"
      ? { background: p.primaryLight, borderRadius: r }
      : theme.cardStyle === "outlined"
        ? { border: "1px solid #d1d5db", borderRadius: r }
        : { borderLeft: `2px solid ${p.primary}` };
  return (
    <div className="flex gap-1.5" aria-hidden>
      {/* cover */}
      <div className="relative h-20 w-14 overflow-hidden rounded-sm bg-white shadow-sm ring-1 ring-black/10">
        {theme.coverStyle === "band" && (
          <>
            <div className="h-[38%]" style={{ background: p.primaryDark }} />
            <div className="mx-1.5 mt-1 h-8 rounded-sm" style={{ background: `linear-gradient(135deg, ${p.primaryLight}, ${p.primary})` }} />
          </>
        )}
        {theme.coverStyle === "full-bleed" && (
          <>
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.primary})` }} />
            <div className="absolute inset-x-0 bottom-0 h-5" style={{ background: p.primaryDark, opacity: 0.9 }} />
          </>
        )}
        {theme.coverStyle === "framed" && (
          <div className="absolute inset-1 border p-1" style={{ borderColor: p.primary }}>
            <div className="h-1 w-6" style={{ background: p.primaryDark }} />
            <div className="mt-1 h-9" style={{ background: `linear-gradient(135deg, ${p.primaryLight}, ${p.primary})` }} />
          </div>
        )}
      </div>
      {/* inner page */}
      <div className="flex h-20 w-14 flex-col gap-1 rounded-sm bg-white p-1 shadow-sm ring-1 ring-black/10">
        <div className="h-1 w-6 rounded-full" style={{ background: p.primary }} />
        <div className="flex gap-0.5">
          <div className="h-6 flex-1 p-0.5" style={card}>
            <div className="h-0.5 w-3/4 bg-gray-300" />
          </div>
          <div className="h-6 flex-1 p-0.5" style={card}>
            <div className="h-0.5 w-2/3 bg-gray-300" />
          </div>
        </div>
        <div className="h-5 p-0.5" style={card}>
          <div className="h-0.5 w-1/2 bg-gray-300" />
        </div>
      </div>
    </div>
  );
}

export function ThemePicker({ value, onChange }: { value: DesignThemeId; onChange: (id: DesignThemeId) => void }) {
  return (
    <div role="radiogroup" aria-label="Tasarım teması" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {DESIGN_THEME_IDS.map((id) => {
        const theme = DESIGN_THEMES[id];
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors",
              selected ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-input hover:bg-accent",
            )}
          >
            <MiniPage theme={theme} />
            <span className="min-w-0">
              <span className={cn("block font-medium", theme.headingFont === "serif" && "font-serif")}>{theme.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{theme.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
