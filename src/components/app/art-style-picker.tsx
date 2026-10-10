"use client";

import { cn } from "@/lib/utils";
import { ART_STYLES, ART_STYLE_IDS, type ArtStyleId } from "@/lib/ai/art-styles";

// Faz 2 "İllüstrasyon stili": art-direction chooser. Swatches are CSS-only
// hints of each style's palette/texture - no sample images are shipped.
export function ArtStylePicker({ value, onChange }: { value: ArtStyleId; onChange: (id: ArtStyleId) => void }) {
  return (
    <div role="radiogroup" aria-label="İllüstrasyon stili" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {ART_STYLE_IDS.map((id) => {
        const style = ART_STYLES[id];
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors",
              selected ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-input hover:bg-accent",
            )}
          >
            <span aria-hidden className="h-12 w-12 shrink-0 rounded-lg ring-1 ring-black/10" style={{ background: style.swatch }} />
            <span className="min-w-0">
              <span className="block font-medium">{style.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{style.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
