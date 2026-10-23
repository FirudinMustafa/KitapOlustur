import type { SourcePageLayout } from "@/lib/source-layout";

// "Önce sayfa tasarımı" (plan 2026-10-23): a young learners' coursebook
// builds its pages from pictures - a full-page scene with the rubric on a
// pill over it, a grid of numbered object cards, a numbered story-panel
// grid - where our zone plans (zones.ts) set text first and add pictures
// beside it (KIYAS-13: pictures 28% of the page, the source's 70-90%).
// Each measured source page is put in one of four types; the writer is
// told what each type needs (source-blueprint.ts) and the PDF sets the
// three picture types with their own templates (pdf/type-templates.tsx).
// "mixed" is everything else and keeps the zone layout.
//
// Pure TS, no react-pdf/Node imports.

export const PAGE_LAYOUT_TYPES = ["scene", "cards", "panels", "mixed"] as const;
export type PageLayoutType = (typeof PAGE_LAYOUT_TYPES)[number];

type Box = SourcePageLayout["images"][number];

// A scene: one picture (or one row of at most SCENE_ROW_MAX pictures that
// together cover the page's width - a scene the analyzer cut around a
// character, Super Minds p.1) of at least this share of the page...
const SCENE_AREA = 0.45;
const SCENE_ROW_MAX = 3;
const SCENE_ROW_SPAN = 0.85;
// ...on a page with little text: a coursebook page with a big picture and
// 200 words (i5 Team 2) is a reading page, not a scene.
const SCENE_MAX_WORDS = 45;
const SCENE_MAX_EXERCISES = 2;
// Cards and panels: at least this many pictures of about the same size.
const GRID_MIN = 4;
const SIMILAR = 0.6; // the smaller of two similar pictures' widths, heights and areas is at least this share of the larger
const CARD_MAX_AREA = 0.2; // a card is an object, not a scene
// Panels are bigger than cards (Super Minds p.5: 6 panels of 12% each,
// the p.10 picture row 4% each).
const PANEL_MIN_AREA = 0.05;
const STORY_RUBRIC = /\b(story|comic|watch)\b/i;
// A card page's words: a word or two per card plus the rubrics.
const CARD_WORDS_PER_CARD = 8;
const CARD_RUBRIC_WORDS = 20;
// A card strip drawn as vectors comes out of the analyzer as one band
// (Super Minds p.4: ten kites and ten number tiles, one 45% "picture"):
// a page of one or two pictures whose exercises are long lists of single
// words or numbers is a card page too.
const STRIP_MIN_ITEMS = 6;
const STRIP_MAX_WORDS_PER_ITEM = 2.5;
const STRIP_MIN_AREA = 0.2;

const area = (b: Box) => b.w * b.h;

function similar(a: Box, b: Box): boolean {
  const ratio = (x: number, y: number) => Math.min(x, y) / Math.max(x, y);
  return ratio(a.w, b.w) >= SIMILAR && ratio(a.h, b.h) >= SIMILAR && ratio(area(a), area(b)) >= SIMILAR;
}

// The largest set of pictures about the same size as one another (each
// similar to the set's first picture, tried from every picture).
export function similarGroup(images: Box[]): Box[] {
  let best: Box[] = [];
  for (const seed of images) {
    const group = images.filter((b) => similar(seed, b));
    if (group.length > best.length) best = group;
  }
  return best;
}

// The page's biggest picture area: one picture, or one row of a few
// pictures side by side across the page (their bounding box).
export function sceneArea(images: Box[]): number {
  let best = Math.max(0, ...images.map(area));
  for (const seed of images) {
    const row = images.filter((b) => Math.min(seed.y + seed.h, b.y + b.h) - Math.max(seed.y, b.y) >= 0.5 * Math.min(seed.h, b.h));
    if (row.length > SCENE_ROW_MAX) continue;
    const left = Math.min(...row.map((b) => b.x));
    const right = Math.max(...row.map((b) => b.x + b.w));
    if (right - left < SCENE_ROW_SPAN) continue;
    const top = Math.min(...row.map((b) => b.y));
    const bottom = Math.max(...row.map((b) => b.y + b.h));
    best = Math.max(best, (right - left) * (bottom - top));
  }
  return best;
}

export function classifyPageType(layout: SourcePageLayout): PageLayoutType {
  const images = layout.images;
  if (!images.length) return "mixed";
  const group = similarGroup(images);
  if (group.length >= GRID_MIN) {
    const mean = group.reduce((n, b) => n + area(b), 0) / group.length;
    if (mean >= PANEL_MIN_AREA && layout.exerciseRubrics.some((r) => STORY_RUBRIC.test(r))) return "panels";
    if (mean <= CARD_MAX_AREA && layout.wordCount <= CARD_WORDS_PER_CARD * group.length + CARD_RUBRIC_WORDS) return "cards";
  }
  if (
    images.length <= 2 &&
    layout.itemCount >= STRIP_MIN_ITEMS &&
    layout.wordCount <= STRIP_MAX_WORDS_PER_ITEM * layout.itemCount &&
    Math.max(...images.map(area)) >= STRIP_MIN_AREA
  ) {
    return "cards";
  }
  if (sceneArea(images) >= SCENE_AREA && layout.wordCount <= SCENE_MAX_WORDS && layout.exerciseCount <= SCENE_MAX_EXERCISES) return "scene";
  return "mixed";
}

// A card or panel picture is one of the page's extra pictures
// (extraImagePrompts, at most 5 - schemas.ts), in order.
export const MAX_TYPE_PICTURES = 5;

// How many cards (or panels) the source page shows: its grid of similar
// pictures, or for a card strip measured as one band, its items per
// exercise.
export function cardCount(layout: SourcePageLayout): number {
  const group = similarGroup(layout.images);
  if (group.length >= GRID_MIN) return group.length;
  return layout.exerciseCount ? Math.round(layout.itemCount / layout.exerciseCount) : layout.itemCount;
}

// The pictures a page of this type carries: on a card or panel page the
// main picture plus one per card / panel (as many as there are extra
// picture slots), however few frames the zone plan has (a vector card
// strip measures as one picture); other types keep the zone plan's.
export function typedPictureCount(type: PageLayoutType, layout: SourcePageLayout, planPictures: number): number {
  if (type === "cards") return Math.max(planPictures, 1 + Math.min(MAX_TYPE_PICTURES, cardCount(layout)));
  if (type === "panels") return Math.max(planPictures, Math.min(1 + MAX_TYPE_PICTURES, cardCount(layout)));
  return planPictures;
}

// The type a stored page was given from its source page (applyZonePlans);
// pages written before types existed are "mixed".
export function pageLayoutType(page: { sourceShape?: { pageType?: PageLayoutType } | null }): PageLayoutType {
  return page.sourceShape?.pageType ?? "mixed";
}
