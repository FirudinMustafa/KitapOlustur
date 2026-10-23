import { z } from "zod";
import type { CharacterSheet } from "@/db/schema";
import { pictureAreas } from "@/lib/design/zones";
import { layoutPageType } from "./page-labels";
import type { GeneratedPage, GeneratedUnit } from "./schemas";

// A scene's dialogue set as speech bubbles on its picture, each pointing at
// its speaker (source i_5_team_2.pdf p.14 "It's party time!": every family
// member's line in a bubble by them). After the picture is made a cheap
// vision model finds each speaker's head (locateSpeakers in
// workflows/book-pipeline.tsx); the PDF draws the bubbles
// (src/lib/pdf/bubble-overlay.tsx) and leaves the lines out under the
// picture.

export type PageBubble = NonNullable<GeneratedPage["bubbles"]>[number];

export const MIN_BUBBLES = 2;
export const MAX_BUBBLES = 8;
// A longer line is a reading text, not a speech bubble.
export const MAX_BUBBLE_WORDS = 14;
// A mirrored page's main picture takes at least this share of the page to
// carry bubbles (a scene page's picture is the whole page).
export const MIN_BUBBLE_PICTURE_AREA = 0.18;

type DialogueLine = { speaker: string; line: string };

// Whether the page's main picture is big enough to carry bubbles: a scene,
// or a mirrored page whose main picture's slot is large.
export function hasBigMainPicture(page: Pick<GeneratedPage, "zonePlan" | "extraImagePrompts"> & object): boolean {
  if (layoutPageType(page) === "scene") return true;
  if (!page.zonePlan) return false;
  return (pictureAreas(page.zonePlan, 1 + (page.extraImagePrompts?.length ?? 0))[0] ?? 0) >= MIN_BUBBLE_PICTURE_AREA;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

// The page's dialogue to set as bubbles: the first block whose dialogue has
// 2-8 short turns, all with a speaker. Null when none suits.
export function bubbleDialogue(page: Pick<GeneratedPage, "blocks">): DialogueLine[] | null {
  for (const block of page.blocks) {
    const lines = block.dialogue ?? [];
    if (lines.length < MIN_BUBBLES || lines.length > MAX_BUBBLES) continue;
    if (lines.every((l) => l.speaker.trim() && l.line.trim() && words(l.line) <= MAX_BUBBLE_WORDS)) return lines;
  }
  return null;
}

// Diacritics folded: the writer spells "Ayşe" as "Ayse" as often as not.
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();

export type Speaker = { name: string; description?: string };

// Each speaker once, in order of their first line; a recurring character
// (by name) carries their character sheet's looks so the model can find
// them, anyone else ("Mum", "the cat") goes by name.
export function speakersOf(lines: DialogueLine[], sheets: Pick<CharacterSheet, "name" | "visualDescription" | "outfit">[]): Speaker[] {
  const seen = new Set<string>();
  const speakers: Speaker[] = [];
  for (const { speaker } of lines) {
    const name = speaker.trim();
    const key = fold(name);
    if (seen.has(key)) continue;
    seen.add(key);
    const sheet = sheets.find((c) => fold(c.name) === key || fold(c.name).split(/\s+/)[0] === key);
    speakers.push(sheet ? { name, description: `${sheet.visualDescription}; wearing ${sheet.outfit}` } : { name });
  }
  return speakers;
}

// What the vision model answers. Boxes in Gemini's native form: [ymin, xmin,
// ymax, xmax] on a 0-1000 scale (no numeric limits in the schema - Gemini
// rejects those, see storedPageSchema's note).
export const speakerLocationSchema = z.object({
  speakers: z.array(
    z.object({
      name: z.string(),
      found: z.boolean().describe("true only if this person or animal is clearly visible in the picture"),
      head: z.array(z.number()).describe("[ymin, xmin, ymax, xmax] of their HEAD (face and hair only), each 0-1000 (0,0 = top-left); empty when not found"),
    }),
  ),
});

export function speakerLocationPrompt(speakers: Speaker[]): string {
  return [
    "This is an illustration from an English coursebook. Speech bubbles with what these people (or animals) say will be printed on it, each pointing at the speaker's head:",
    speakers.map((s) => `- ${s.name}${s.description ? ` (looks like: ${s.description})` : ""}`).join("\n"),
    "For each speaker, find the one person or animal in the picture it is (use the description, the name - Mum, Dad, Grandma, the cat - and what they are doing). Each speaker is a different figure. Return the bounding box of their head only (face and hair) as [ymin, xmin, ymax, xmax] on a 0-1000 scale of the picture (0,0 = top-left corner). If the speaker is not clearly visible, set found=false and leave head empty - never guess. Return every speaker, in the same order.",
  ].join("\n\n");
}

// The model's head boxes -> one bubble per line whose speaker was found
// (head centre and size, fractions of the picture). Two speakers given the
// same head are both dropped - one of them is wrong.
export function bubblesFromBoxes(lines: DialogueLine[], located: z.infer<typeof speakerLocationSchema>): PageBubble[] {
  const heads = new Map<string, { x: number; y: number; r: number }>();
  for (const hit of located.speakers) {
    if (!hit.found || hit.head.length !== 4 || !hit.head.every(Number.isFinite)) continue;
    const [ymin, xmin, ymax, xmax] = hit.head;
    if (ymax <= ymin || xmax <= xmin) continue;
    // A head covering a quarter of the picture is no head.
    if ((ymax - ymin) * (xmax - xmin) > 0.25 * 1000 * 1000) continue;
    const clamp = (v: number) => Math.min(1, Math.max(0, v / 1000));
    heads.set(fold(hit.name), { x: clamp((xmin + xmax) / 2), y: clamp((ymin + ymax) / 2), r: clamp((ymax - ymin) / 2) });
  }
  const spots = [...heads.entries()];
  for (const [name, head] of spots) {
    if (spots.some(([other, h]) => other !== name && Math.hypot(h.x - head.x, h.y - head.y) < 0.02)) heads.delete(name);
  }
  return lines.flatMap((l) => {
    const head = heads.get(fold(l.speaker));
    return head ? [{ speaker: l.speaker.trim(), line: l.line.trim(), x: head.x, y: head.y, r: head.r }] : [];
  });
}

const sameLine = (b: PageBubble, l: DialogueLine) => fold(b.speaker) === fold(l.speaker) && b.line.trim() === l.line.trim();

// Stores located bubbles (keyed by sourcePageNumber) on the unit's pages
// that carry that dialogue on a big main picture - only when every line
// got one (see pageBubbles). Returns the unit unchanged when nothing
// applies.
export function withPageBubbles(unit: GeneratedUnit, bubbles: Record<number, PageBubble[]>): GeneratedUnit {
  let changed = false;
  const apply = (pages: GeneratedPage[] | undefined) =>
    pages?.map((page) => {
      const found = bubbles[page.sourcePageNumber];
      const lines = bubbleDialogue(page);
      if (!found?.length || !lines || !hasBigMainPicture(page)) return page;
      if (!found.every((b) => lines.some((l) => sameLine(b, l))) || !lines.every((l) => found.some((b) => sameLine(b, l)))) return page;
      changed = true;
      return { ...page, bubbles: found };
    });
  const next: GeneratedUnit = {
    ...unit,
    studentBookPages: apply(unit.studentBookPages) ?? [],
    workbookPages: apply(unit.workbookPages) ?? [],
    ...(unit.teacherBookPages ? { teacherBookPages: apply(unit.teacherBookPages) } : {}),
    ...(unit.testBookletPages ? { testBookletPages: apply(unit.testBookletPages) } : {}),
  };
  return changed ? next : unit;
}

// The page's bubbles to draw: those of a dialogue whose every line has
// one. A dialogue is set either all in bubbles or all as lines - never
// half and half, which would print some lines twice. (A design rewrite
// after the pictures may have reworded a line; its bubble then no longer
// says what the page says, and the dialogue prints as lines.)
export function pageBubbles(page: Pick<GeneratedPage, "blocks" | "bubbles">): PageBubble[] {
  const bubbles = page.bubbles ?? [];
  if (!bubbles.length) return [];
  const complete = page.blocks.map((b) => b.dialogue ?? []).filter((lines) => lines.length && lines.every((l) => bubbles.some((b) => sameLine(b, l))));
  return bubbles.filter((b) => complete.some((lines) => lines.some((l) => sameLine(b, l))));
}

// The page as printed under a picture carrying its bubbles: a dialogue
// whose every line is in a bubble keeps its heading and rubric but not its
// lines. The same page when nothing is bubbled.
export function withoutBubbledDialogue<P extends Pick<GeneratedPage, "blocks" | "bubbles">>(page: P): P {
  const bubbles = pageBubbles(page);
  if (!bubbles.length) return page;
  let changed = false;
  const blocks = page.blocks.map((block) => {
    const lines = block.dialogue ?? [];
    if (!lines.length || !lines.every((l) => bubbles.some((b) => sameLine(b, l)))) return block;
    changed = true;
    return { ...block, dialogue: undefined };
  });
  return changed ? { ...page, blocks } : page;
}
