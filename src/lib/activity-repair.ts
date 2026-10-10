import type { GeneratedPage, GeneratedUnit } from "@/lib/ai/schemas";
import { letterFor, type ActivityPicture } from "@/lib/activities";
import { itemText } from "@/lib/item-text";

// Live E2E 2026-10-10: the writer chose a picture_label activity but left
// activity.pictures empty through every structural retry, so the grid
// printed descriptions instead of pictures. Like the answer-key backfill
// (src/lib/answer-keys.ts), these helpers find exactly those blocks so one
// small model call can pick the pictures (fillMissingPictures in
// workflows/book-pipeline.tsx).

const PAGE_FIELDS = ["studentBookPages", "workbookPages", "teacherBookPages", "testBookletPages"] as const;
type PageField = (typeof PAGE_FIELDS)[number];

export type PictureGap = {
  id: string;
  type: "picture_label" | "picture_match";
  /** What each picture must show, in item order. */
  shows: string[];
};

type Block = GeneratedPage["blocks"][number];

function needsPictures(b: Block): boolean {
  const a = b.activity;
  return !!a && (a.type === "picture_label" || a.type === "picture_match") && !!b.items?.length && (a.pictures?.length ?? 0) !== b.items.length;
}

function gapId(field: PageField, p: number, b: number) {
  return `${field}:${p}:${b}`;
}

export function findPictureGaps(unit: GeneratedUnit): PictureGap[] {
  const gaps: PictureGap[] = [];
  for (const field of PAGE_FIELDS) {
    (unit[field] ?? []).forEach((page: GeneratedPage, p) =>
      page.blocks.forEach((block, b) => {
        if (!needsPictures(block)) return;
        const items = block.items!.map(itemText);
        // picture_label: the picture shows the answer (the word learners
        // write); picture_match: it shows the item itself.
        const shows =
          block.activity!.type === "picture_label" ? items.map((item, i) => block.answerKey?.[i] ? itemText(block.answerKey[i]) : item) : items;
        gaps.push({ id: gapId(field, p, b), type: block.activity!.type as PictureGap["type"], shows });
      }),
    );
  }
  return gaps;
}

// Order for picture_match pictures: a fixed derangement-ish rotation by a
// seed, so no picture sits beside its own word and the result is stable.
export function matchOrder(n: number, seed: string): number[] {
  if (n < 2) return [...Array(n).keys()];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const shift = 1 + (h % (n - 1));
  return [...Array(n).keys()].map((i) => (i + shift) % n);
}

// Applies pictures (one per item, in item order) only where the count
// matches. picture_match pictures are then placed in mixed order and the
// answer key is rewritten to the letters that order produces.
export function applyPictures(unit: GeneratedUnit, picked: { id: string; pictures: ActivityPicture[] }[]): GeneratedUnit {
  const byId = new Map(picked.map((p) => [p.id, p.pictures]));
  const next: GeneratedUnit = { ...unit };
  for (const field of PAGE_FIELDS) {
    const pages = unit[field];
    if (!pages) continue;
    (next as Record<PageField, GeneratedPage[] | undefined>)[field] = pages.map((page, p) => ({
      ...page,
      blocks: page.blocks.map((block, b) => {
        const pics = byId.get(gapId(field, p, b));
        if (!pics || !needsPictures(block) || pics.length !== block.items!.length) return block;
        if (block.activity!.type === "picture_label") return { ...block, activity: { ...block.activity!, pictures: pics } };
        // shown[k] = picture of item order[k]; item i's answer = letter of k where order[k] === i
        const order = matchOrder(pics.length, block.heading);
        const shown = order.map((i) => pics[i]);
        const answerKey = block.items!.map((_, i) => letterFor(order.indexOf(i)));
        return { ...block, answerKey, activity: { ...block.activity!, pictures: shown } };
      }),
    }));
  }
  return next;
}
