import type { ComponentProps } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { BookDocument } from "./BookDocument";
import { resetBookFonts } from "./fonts";
import { countPdfPages } from "./rasterize";
import { buildPageSpans } from "@/lib/design/page-review";
import { activityEmojis, loadEmojiIcons } from "./emoji-icons";
import type { CourseUnitSummary } from "./ContentsDocument";

type BookProps = Omit<ComponentProps<typeof BookDocument>, "onPageStart" | "forcePlain" | "compact">;

// Measured, not estimated: renders the book, finds every page that ran onto
// a second PDF page and renders again with those pages in plain flow.
// A designed (multi-column) page that doesn't fit pushes its whole row to
// the next page and leaves a near-blank page behind (live E2E 2026-10-10);
// plain flow paginates naturally. The height estimate keeps most pages
// designed - this pass guarantees the ones it got wrong never print broken.
//
// A page that still runs over in plain flow gets one more pass with
// tighter activity and diagram sizes (live E2E 2026-10-10: the last row of
// a preposition exercise printed alone on an otherwise empty page). Kept
// only for pages it actually pulls back onto one sheet.
export async function renderBookFitted(input: BookProps): Promise<{ pdf: Buffer; flattened: string[]; compacted: string[] }> {
  // Activity pictures are drawn from Twemoji; fetched once per book.
  const props = { ...input, pictureSrc: input.pictureSrc ?? (await loadEmojiIcons(activityEmojis(input.units))) };

  async function render(forcePlain?: Set<string>, compact?: Set<string>) {
    const starts: Record<string, number> = {};
    resetBookFonts();
    const pdf = await renderToBuffer(
      <BookDocument {...props} forcePlain={forcePlain} compact={compact} onPageStart={(key, n) => (starts[key] = Math.min(starts[key] ?? n, n))} />,
    );
    const spills = buildPageSpans(starts, await countPdfPages(new Uint8Array(pdf)))
      .filter((s) => /^\d+:\d+$/.test(s.key) && s.pageCount > 1)
      .map((s) => s.key);
    return { pdf, spills, starts };
  }

  const result = await (async () => {
    const first = await render();
    if (!first.spills.length) return { ...first, flattened: [] as string[], compacted: [] as string[] };
    const plain = new Set(first.spills);
    const second = await render(plain);
    if (!second.spills.length) return { ...second, flattened: [...plain], compacted: [] as string[] };
    const third = await render(plain, new Set(second.spills));
    const fixed = second.spills.filter((k) => !third.spills.includes(k));
    return fixed.length ? { ...third, flattened: [...plain], compacted: fixed } : { ...second, flattened: [...plain], compacted: [] as string[] };
  })();

  // Faz B5: the contents page lists where each unit is printed. The ranges
  // are only known after layout, so the final layout is rendered once more
  // with them - same pages, the contents table just gains its page column.
  const contentsUnits = withUnitPages(props.contentsUnits, result.starts);
  if (!contentsUnits) return { pdf: result.pdf, flattened: result.flattened, compacted: result.compacted };
  props.contentsUnits = contentsUnits;
  const numbered = await render(new Set(result.flattened), new Set(result.compacted));
  return { pdf: numbered.pdf, flattened: result.flattened, compacted: result.compacted };
}

// Each unit's printed page range from the page markers ("unit:pageIndex"
// and "answer_key"), or null when nothing could be placed.
export function withUnitPages(units: CourseUnitSummary[], starts: Record<string, number>): CourseUnitSummary[] | null {
  const firstPage = new Map<number, number>();
  for (const [key, page] of Object.entries(starts)) {
    const m = /^(\d+):\d+$/.exec(key);
    if (!m) continue;
    const unit = Number(m[1]);
    firstPage.set(unit, Math.min(firstPage.get(unit) ?? page, page));
  }
  if (!units.some((u) => firstPage.has(u.number))) return null;
  const ordered = [...firstPage.entries()].sort((a, b) => a[1] - b[1]);
  const lastPage = Math.max(...Object.values(starts));
  return units.map((u) => {
    const from = firstPage.get(u.number);
    if (from === undefined) return u;
    const next = ordered.find(([, p]) => p > from)?.[1] ?? starts.answer_key ?? lastPage + 1;
    return { ...u, pages: { from, to: Math.max(from, next - 1) } };
  });
}
