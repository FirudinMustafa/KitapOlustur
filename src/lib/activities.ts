// Print-workbook activity formats that a plain numbered list can't show:
// labelling pictures, matching words to pictures, choosing from a word
// bank, writing on ruled lines, drawing in a box. One optional `activity`
// field on a content block (src/lib/ai/schemas.ts) picks the format; the
// block's items/answerKey keep their meaning, so the answer key, the
// structural checks and every export that only knows items keep working.
//
// Shared by the PDF (src/lib/pdf/blocks.tsx), the web reader
// (src/components/book/PageContent.tsx) and the page-fit estimate
// (src/lib/design/layouts.ts), so all three agree on what a format needs.

export const ACTIVITY_TYPES = ["picture_label", "picture_match", "word_bank", "write_lines", "draw_box"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type ActivityPicture = { emoji?: string; label: string };

export type Activity = {
  type: ActivityType;
  words?: string[];
  pictures?: ActivityPicture[];
  lines?: number;
};

type ActivityBlock = { heading: string; items?: string[]; answerKey?: string[]; activity?: Activity };

export const ACTIVITY_PROMPT = [
  `Workbook activity formats - set a block's "activity" field when an exercise is naturally one of these (a printed workbook uses them on most pages; a plain numbered list is the fallback, not the default):`,
  `- picture_label: learners write the word under each picture. "items" = a short description of each picture (e.g. "a building with books"), "answerKey" = the word, "activity.pictures" = one entry per item in the same order: {label: what the picture shows, emoji: ONE emoji that depicts it}. Add "activity.words" for a word bank when the level needs one - every answer must then be one of its words, spelt the same.`,
  `- picture_match: learners match words/sentences to lettered pictures. "items" = the words/sentences, "activity.pictures" = one picture per item in a DIFFERENT (mixed) order, lettered a, b, c...; "answerKey" = the matching letter for each item ("c"). Pictures show concrete things (animals, objects, places) - never arrows or symbols; to match prepositions use the "prepositions" diagram instead.`,
  `- word_bank: gap-fill or choose-the-word items whose answers come from a box of words. "activity.words" = the words in the box (mixed order, may include one extra distractor).`,
  `- write_lines: learners write full answers or a short text. "activity.lines" = ruled lines per item (1-3), or the number of lines for one free-writing task when there are no items. Open items get a model answer starting "e.g." in answerKey.`,
  `- draw_box: "draw and write" tasks - prints an empty frame to draw in. "activity.lines" = frame height in lines (6-10).`,
  `Use 4-8 pictures per picture activity, and pick emoji that a child can tell apart at a glance (not two similar buildings for "museum" and "bank" - choose the most recognisable object instead, e.g. 🦖 for a museum, 💰 for a bank). Never describe a picture as text in "items" without setting "activity" - "Picture of a ..." items print as words, not pictures.`,
].join("\n");

export function activityIssues(block: ActivityBlock): string[] {
  const a = block.activity;
  if (!a) return [];
  const n = block.items?.length ?? 0;
  const where = `block "${block.heading}"`;
  const issues: string[] = [];
  if ((a.type === "picture_label" || a.type === "picture_match") && (a.pictures?.length ?? 0) !== n) {
    issues.push(`${where}: activity "${a.type}" needs exactly one entry in activity.pictures per item (${n} items, ${a.pictures?.length ?? 0} pictures).`);
  }
  if (a.type === "word_bank" && !a.words?.length) {
    issues.push(`${where}: activity "word_bank" needs the box's words in activity.words.`);
  }
  // Live E2E 2026-10-10: the box offered "sports centre", the key said
  // "stadium" - a learner can't find the answer in the box.
  if (a.type === "picture_label" && a.words?.length && block.answerKey?.length) {
    const box = new Set(a.words.map((w) => w.trim().toLowerCase()));
    const missing = block.answerKey.filter((ans) => !box.has(ans.trim().toLowerCase()));
    if (missing.length) {
      issues.push(`${where}: every answer must be one of the word-bank words (activity.words); not in the box: ${missing.map((m) => `"${m}"`).join(", ")}.`);
    }
  }
  // ...and a picture match came back answered with phrases ("at the back
  // of") instead of the letters of its pictures.
  if (a.type === "picture_match" && block.answerKey?.some((ans) => !/^\s*[a-z]\s*$/i.test(ans))) {
    issues.push(`${where}: a picture_match answerKey holds the letter of the matching picture for each item ("a", "b", ...), nothing else.`);
  }
  return issues;
}

export function letterFor(i: number): string {
  return String.fromCharCode(97 + i);
}

export function pictureColumns(width: number): number {
  return width > 380 ? 4 : width > 240 ? 3 : 2;
}

// Height of what the activity adds to (or, for picture formats, replaces
// in) the block, in pt - mirrors the PDF drawing in src/lib/pdf/blocks.tsx.
export const RULE_GAP = 20;
export const PICTURE_CELL = 84;
export const MATCH_ROW = 48;
export const DRAW_LINE = 18;

export function activityHeight(block: ActivityBlock, width: number, size: number): { extra: number; replacesItems: boolean } {
  const a = block.activity;
  if (!a) return { extra: 0, replacesItems: false };
  const n = block.items?.length ?? 0;
  const bank = a.words?.length ? 26 + Math.ceil(a.words.join("   ").length / Math.max(20, width / (size * 0.55))) * size * 1.5 : 0;
  switch (a.type) {
    case "picture_label":
      return { extra: bank + Math.ceil(n / pictureColumns(width)) * (PICTURE_CELL + 8), replacesItems: true };
    case "picture_match":
      return { extra: bank + n * MATCH_ROW, replacesItems: true };
    case "write_lines":
      return { extra: bank + (n ? n : 1) * (a.lines ?? (n ? 1 : 5)) * RULE_GAP, replacesItems: false };
    case "draw_box":
      return { extra: bank + (a.lines ?? 8) * DRAW_LINE + 10, replacesItems: false };
    default:
      return { extra: bank, replacesItems: false };
  }
}

// Imprint-page credit for the Twemoji activity pictures (src/lib/pdf/emoji-icons.ts).
export const TWEMOJI_CREDIT = "Activity icons: Twemoji (jdecked/twemoji), CC-BY 4.0.";

export const TWEMOJI_VERSION = "15.1.0";

// Twemoji file names: the code points in hex joined by "-", without the
// variation selector U+FE0F unless the emoji is a ZWJ sequence.
export function twemojiFileName(emoji: string): string {
  const points = [...emoji.trim()].map((c) => c.codePointAt(0)!);
  const keep = points.includes(0x200d) ? points : points.filter((p) => p !== 0xfe0f);
  return keep.map((p) => p.toString(16)).join("-");
}

export function twemojiUrl(emoji: string): string {
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}/assets/svg/${twemojiFileName(emoji)}.svg`;
}

export function isEmoji(text: string): boolean {
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(text);
}

// Backstop for a labelling grid whose key and word bank disagree (live E2E
// 2026-10-10: box "sports centre", key "stadium", through every retry).
// One answer missing from the box and one box word unused -> they are the
// same thing named twice; the box's wording wins (it is what the learner
// sees). Otherwise missing answers are added to the box so every answer
// can be found.
export function reconcileWordBank<B extends ActivityBlock>(block: B): B {
  const a = block.activity;
  if (a?.type !== "picture_label" || !a.words?.length || !block.answerKey?.length) return block;
  const key = (s: string) => s.trim().toLowerCase();
  const box = new Set(a.words.map(key));
  const missing = block.answerKey.map((ans, i) => ({ ans, i })).filter(({ ans }) => !box.has(key(ans)));
  if (!missing.length) return block;
  const used = new Set(block.answerKey.map(key));
  const unused = a.words.filter((w) => !used.has(key(w)));
  if (missing.length === 1 && unused.length === 1) {
    const answerKey = block.answerKey.map((ans, i) => (i === missing[0].i ? unused[0] : ans));
    return { ...block, answerKey };
  }
  return { ...block, activity: { ...a, words: [...a.words, ...missing.map((m) => m.ans)] } };
}
