import type { ComponentProps } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { BookDocument } from "./BookDocument";
import { resetBookFonts } from "./fonts";
import { countPdfPages, pageContentBottoms } from "./rasterize";
import { MARGIN_BOTTOM } from "@/lib/design/layouts";
import { buildPageSpans } from "@/lib/design/page-review";
import { activityEmojis, loadEmojiIcons } from "./emoji-icons";
import type { CourseUnitSummary } from "./ContentsDocument";
import { pictureGroundTints, tintPictureGrounds } from "./picture-ground";
import { derivePaletteFromColors } from "./derive-palette";
import { resolveDesignTheme } from "@/lib/design/themes";
import { pageLayoutType } from "@/lib/design/page-types";
import { resolvePageImageUrls } from "@/lib/page-image";
import { measurePictures } from "./picture-info";
import { pagesForVariant } from "@/lib/content-html";
import { tintSpecPictures } from "./spec-design";

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
export async function renderBookFitted(input: BookProps & { tintPictures?: boolean }): Promise<{ pdf: Buffer; flattened: string[]; compacted: string[] }> {
  const { tintPictures = true, ...rest } = input;
  const zoned = tintPictures ? await tintZonedPictures(rest) : rest.pageImages;
  // Pages laid out by the agent designer print their pictures' grounds in
  // the colours their specs ask for.
  const pageImages = await tintDesignedPictures(rest.units, rest.variant, zoned);
  // Activity pictures are drawn from Twemoji; fetched once per book.
  const props = {
    ...rest,
    pictureSrc: input.pictureSrc ?? (await loadEmojiIcons(activityEmojis(input.units))),
    pageImages,
    // Each page picture's real shape and object, measured once as printed
    // (tinted): every frame places its picture by them (picture-fit.ts).
    pictures: input.pictures ?? (await measurePictures(bookPictures(rest.units, rest.variant, pageImages))),
  };

  async function render(forcePlain?: Set<string>, compact?: Set<string>, slack?: Map<string, number>) {
    const starts: Record<string, number> = {};
    resetBookFonts();
    const pdf = await renderToBuffer(
      <BookDocument {...props} forcePlain={forcePlain} compact={compact} slack={slack} onPageStart={(key, n) => (starts[key] = Math.min(starts[key] ?? n, n))} />,
    );
    // A page printed on several sheets (a workbook page, sheetKey) spills
    // when any of its sheets does.
    const spills = buildPageSpans(starts, await countPdfPages(new Uint8Array(pdf)))
      .filter((s) => SHEET_KEY.test(s.key) && s.pageCount > 1)
      .map((s) => pageOf(s.key));
    return { pdf, spills: [...new Set(spills)], starts };
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
  // bigger pictures, up to the source's size and past it (KIYAS-13), more
  // text and space spread between blocks (planZones); a page that then runs over
  // goes back to its earlier layout.
  // A page left in plain flow runs onto more sheets by design: it gets no
  // slack, and only a page that newly runs over counts as grown too far
  // (it used to throw away every page's slack). A workbook page split over
  // sheets (sheetKey) is measured sheet by sheet.
  const plain = new Set(result.flattened);
  const tight = new Set(result.compacted);
  const flowing = new Set(result.spills);
  const overrun = (spills: string[]) => spills.filter((k) => !flowing.has(k));
  let slack = await measureSlack(result.pdf, result.starts, flowing, props.bleed ?? 0);
  let final: { pdf: Buffer; starts: Record<string, number>; spills: string[] } = result;
  if (slack.size) {
    let grown = await render(plain, tight, slack);
    // A page that grew too far gets half its slack first (KIYAS-11 p.8:
    // 140 pt measured, grown past its foot, and dropped back to a page
    // half empty); only one that still runs over goes back.
    if (overrun(grown.spills).length) {
      for (const key of [...slack.keys()]) if (grown.spills.includes(pageOf(key))) slack.set(key, slack.get(key)! / 2);
      grown = await render(plain, tight, slack);
    }
    if (overrun(grown.spills).length) {
      for (const key of [...slack.keys()]) if (grown.spills.includes(pageOf(key))) slack.delete(key);
      final = slack.size ? await render(plain, tight, slack) : result;
      if (overrun(final.spills).length) {
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
// into (more than a line or two after a margin for card padding). Pages
// still running over (plain flow) are left alone.
const SLACK_MARGIN = 14;
const MIN_SLACK = 30;

// A book mirroring a source: the pictures in its zoned pages' frames get
// their white ground printed in the panel tint (picture-ground.ts). Typed
// pages (scene, cards, panels) and other books keep their pictures as drawn.
async function tintZonedPictures(props: BookProps): Promise<BookProps["pageImages"]> {
  const pageImages = props.pageImages;
  if (!pageImages || !props.sourceStyle?.type || props.bookKind === "picturebook") return pageImages;
  const pages = props.units.flatMap((u) => [...u.studentBookPages, ...u.workbookPages, ...(u.teacherBookPages ?? []), ...(u.testBookletPages ?? [])]);
  // (a page with a design spec tints its pictures as the spec says, below)
  const srcs = pages.filter((p) => p.zonePlan && !p.designSpec && pageLayoutType(p) === "mixed").flatMap((p) => resolvePageImageUrls(p, pageImages));
  if (!srcs.length) return pageImages;
  const palette = derivePaletteFromColors(props.sourceStyle.dominantColors) ?? resolveDesignTheme(props.designTheme).palettes[props.variant];
  const tinted = await tintPictureGrounds(srcs, pictureGroundTints(palette));
  if (!tinted.size) return pageImages;
  return Object.fromEntries(Object.entries(pageImages).map(([k, src]) => [k, tinted.get(src) ?? src]));
}

// A page with a design spec (agent designer): the pictures whose spec box
// has a ground colour print their white ground in it (tintSpecPictures).
// Without such pages the map is returned as it came.
async function tintDesignedPictures(units: BookProps["units"], variant: BookProps["variant"], pageImages: BookProps["pageImages"]): Promise<BookProps["pageImages"]> {
  if (!pageImages) return pageImages;
  const designed = units.flatMap((u) => pagesForVariant(u, variant)).filter((p) => p.designSpec?.pictures.some((pic) => pic.ground));
  if (!designed.length) return pageImages;
  const out = { ...pageImages };
  for (const page of designed) {
    const srcs = resolvePageImageUrls(page, pageImages);
    const tinted = await tintSpecPictures(page.designSpec!, srcs);
    tinted.forEach((src, i) => {
      if (src === srcs[i]) return;
      for (const [key, url] of Object.entries(pageImages)) if (url === srcs[i]) out[Number(key)] = src;
    });
  }
  return out;
}

// Every picture the book's pages print, main pictures and extras.
function bookPictures(units: BookProps["units"], variant: BookProps["variant"], pageImages: BookProps["pageImages"]): string[] {
  if (!pageImages) return [];
  return units.flatMap((u) => pagesForVariant(u, variant)).flatMap((p) => resolvePageImageUrls(p, pageImages));
}

// "<unit>:<page>" or a later sheet of it, "<unit>:<page>/<k>" (BookDocument sheetKey).
const SHEET_KEY = /^\d+:\d+(\/\d+)?$/;
export const pageOf = (key: string) => key.replace(/\/\d+$/, "");

async function measureSlack(pdf: Buffer, starts: Record<string, number>, flowing: Set<string>, bleed: number): Promise<Map<string, number>> {
  const keys = Object.keys(starts).filter((k) => SHEET_KEY.test(k) && !flowing.has(pageOf(k)));
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
