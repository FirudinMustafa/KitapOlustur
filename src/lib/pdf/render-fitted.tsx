import type { ComponentProps } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { BookDocument } from "./BookDocument";
import { resetBookFonts } from "./fonts";
import { countPdfPages } from "./rasterize";
import { buildPageSpans } from "@/lib/design/page-review";

type BookProps = Omit<ComponentProps<typeof BookDocument>, "onPageStart" | "forcePlain">;

// Measured, not estimated: renders the book, finds every page that ran onto
// a second PDF page and renders again with those pages in plain flow.
// A designed (multi-column) page that doesn't fit pushes its whole row to
// the next page and leaves a near-blank page behind (live E2E 2026-10-10);
// plain flow paginates naturally. The height estimate keeps most pages
// designed - this pass guarantees the ones it got wrong never print broken.
export async function renderBookFitted(props: BookProps): Promise<{ pdf: Buffer; flattened: string[] }> {
  const starts: Record<string, number> = {};
  resetBookFonts();
  const first = await renderToBuffer(
    <BookDocument {...props} onPageStart={(key, n) => (starts[key] = Math.min(starts[key] ?? n, n))} />,
  );
  const spills = buildPageSpans(starts, await countPdfPages(new Uint8Array(first)))
    .filter((s) => /^\d+:\d+$/.test(s.key) && s.pageCount > 1)
    .map((s) => s.key);
  if (!spills.length) return { pdf: first, flattened: [] };
  resetBookFonts();
  const second = await renderToBuffer(<BookDocument {...props} forcePlain={new Set(spills)} />);
  return { pdf: second, flattened: spills };
}
