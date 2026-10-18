import type { ComponentProps } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { BookDocument } from "./BookDocument";
import { resetBookFonts } from "./fonts";
import { countPdfPages, pageContentBottoms } from "./rasterize";
import { MARGIN_BOTTOM } from "@/lib/design/layouts";
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
// Faz G2: a page that runs over is first set tighter in its own layout -
// tighter activity and diagram sizes (live E2E 2026-10-10), and on a
// mirrored page smaller text and pictures inside the source's arrangement
// (planZones `tight`). Only what still runs over then goes to plain flow
// (still tight). Plain flow used to come first, and a measured KIYAS-7
// lost the source's layout on 5 of its 6 pages that way.
export async function renderBookFitted(input: BookProps): Promise<{ pdf: Buffer; flattened: string[]; compacted: string[] }> {
  // Activity pictures are drawn from Twemoji; fetched once per book.
  const props = { ...input, pictureSrc: input.pictureSrc ?? (await loadEmojiIcons(activityEmojis(input.units))) };

  async function render(forcePlain?: Set<string>, compact?: Set<string>, slack?: Map<string, number>) {
    const starts: Record<string, number> = {};
    resetBookFonts();
    const pdf = await renderToBuffer(
      <BookDocument {...props} forcePlain={forcePlain} compact={compact} slack={slack} onPageStart={(key, n) => (starts[key] = Math.min(starts[key] ?? n, n))} />,
    );
    const spills = buildPageSpans(starts, await countPdfPages(new Uint8Array(pdf)))
      .filter((s) => /^\d+:\d+$/.test(s.key) && s.pageCount > 1)
      .map((s) => s.key);
    return { pdf, spills, starts };
  }

  const result = await (async () => {
    const first = await render();
    if (!first.spills.length) return { ...first, flattened: [] as string[], compacted: [] as string[] };
    const tight = new Set(first.spills);
    const second = await render(undefined, tight);
    if (!second.spills.length) return { ...second, flattened: [] as string[], compacted: [...tight] };
    const plain = new Set(second.spills);
    const third = await render(plain, tight);
    return { ...third, flattened: [...plain], compacted: [...tight] };
  })();

  // Faz G3: the height estimate keeps a margin, and a mirrored page that
  // ended well short of its foot had its pictures shrunk for nothing. Each
  // page's real slack is measured and the page laid out again with it -
  // bigger pictures, up to the source's size; a page that then runs over
  // goes back to its earlier layout.
  const plain = new Set(result.flattened);
  const tight = new Set(result.compacted);
  let slack = await measureSlack(result.pdf, result.starts, plain, props.bleed ?? 0);
  let final: { pdf: Buffer; starts: Record<string, number>; spills: string[] } = result;
  if (slack.size) {
    const grown = await render(plain, tight, slack);
    if (grown.spills.length) {
      for (const key of grown.spills) slack.delete(key);
      final = slack.size ? await render(plain, tight, slack) : result;
      if (final.spills.length) {
        slack = new Map();
        final = result;
      }
    } else {
      final = grown;
    }
  }

  // Faz B5: the contents page lists where each unit is printed. The ranges
  // are only known after layout, so the final layout is rendered once more
  // with them - same pages, the contents table just gains its page column.
  const contentsUnits = withUnitPages(props.contentsUnits, final.starts);
  if (!contentsUnits) return { pdf: final.pdf, flattened: result.flattened, compacted: result.compacted };
  props.contentsUnits = contentsUnits;
  const numbered = await render(plain, tight, slack);
  return { pdf: numbered.pdf, flattened: result.flattened, compacted: result.compacted };
}

// Empty height at the foot of every one-sheet content page, worth growing
// into (more than a line or two after a margin for card padding). Pages in
// plain flow are left alone.
const SLACK_MARGIN = 14;
const MIN_SLACK = 30;

async function measureSlack(pdf: Buffer, starts: Record<string, number>, plain: Set<string>, bleed: number): Promise<Map<string, number>> {
  const keys = Object.keys(starts).filter((k) => /^\d+:\d+$/.test(k) && !plain.has(k));
  const sheets = new Map(keys.map((k) => [k, starts[k]]));
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(new Uint8Array(pdf), "application/pdf");
  const sheetHeight = doc.loadPage(0).getBounds()[3];
  doc.destroy();
  const contentFoot = sheetHeight - bleed - MARGIN_BOTTOM;
  const bottoms = await pageContentBottoms(new Uint8Array(pdf), [...sheets.values()], contentFoot);
  const out = new Map<string, number>();
  for (const [key, sheet] of sheets) {
    const bottom = bottoms.get(sheet);
    if (bottom === undefined || bottom === 0) continue;
    const free = contentFoot - bottom - SLACK_MARGIN;
    if (free >= MIN_SLACK) out.set(key, free);
  }
  return out;
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
