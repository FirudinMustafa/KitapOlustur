import { buildCrossword, buildWordSearch, oddOneOutOptions, puzzleLetters, tickAnswer } from "@/lib/puzzles";

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

export const ACTIVITY_TYPES = [
  "picture_label",
  "picture_match",
  "word_bank",
  "write_lines",
  "draw_box",
  // Faz B4: the formats real workbooks use most that a numbered list can't
  // show. Grids are built in code (src/lib/puzzles.ts), never by the model.
  "crossword",
  "wordsearch",
  "unscramble",
  "odd_one_out",
  "tick_cross",
  "ordering",
  "match_lines",
] as const;
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
  `- crossword: "items" = one clue per word (a definition, a sentence with a gap, or a picture description), "answerKey" = the single word. 5-8 words that share letters with each other. The grid is drawn for you.`,
  `- wordsearch: "items" = the words to find, "answerKey" = the same words. 6-10 single words of 3-10 letters, all from the unit's vocabulary. The grid is drawn for you.`,
  `- unscramble: learners put the letters in order. "items" = a short hint per word (a definition or a sentence with a gap), "answerKey" = the word. The scrambled letters are printed for you.`,
  `- odd_one_out: "items" = groups of 4 words separated by " / " (e.g. "apple / banana / chair / pear"), "answerKey" = the word that doesn't belong (one of that group's words).`,
  `- tick_cross: learners tick (✓) true statements and cross (✗) false ones. "items" = statements (often about a text or picture on the page), "answerKey" = "✓" or "✗".`,
  `- ordering: learners number sentences/pictures in order. "items" = the steps in MIXED order, "answerKey" = each item's position as a number ("3").`,
  `- match_lines: learners draw lines between two columns. "items" = the left-hand parts (words, sentence beginnings, questions), "answerKey" = the matching right-hand part for each item (the column is mixed when printed).`,
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
  if (a.type === "crossword" || a.type === "wordsearch" || a.type === "unscramble") {
    const notWords = (block.answerKey ?? []).filter((ans) => puzzleLetters(ans).length < 2 || /\s/.test(ans.trim()));
    if (notWords.length) issues.push(`${where}: activity "${a.type}" needs single-word answers; not single words: ${notWords.map((w) => `"${w}"`).join(", ")}.`);
  }
  if (a.type === "crossword" && block.answerKey?.length) {
    const missing = buildCrossword(block.answerKey).unplaced.map((i) => block.answerKey![i]);
    if (missing.length) issues.push(`${where}: these crossword words share no letters with the others and don't fit the grid: ${missing.map((w) => `"${w}"`).join(", ")} - choose words that share letters.`);
  }
  if (a.type === "odd_one_out") {
    block.items?.forEach((item, i) => {
      const options = oddOneOutOptions(item);
      const answer = block.answerKey?.[i]?.trim().toLowerCase();
      if (options.length < 3) issues.push(`${where}, item ${i + 1}: an odd_one_out item lists 3-5 words separated by " / ".`);
      else if (answer && !options.some((o) => o.toLowerCase() === answer)) issues.push(`${where}, item ${i + 1}: the answer "${block.answerKey?.[i]}" must be one of the item's words.`);
    });
  }
  if (a.type === "tick_cross" && block.answerKey?.some((ans) => tickAnswer(ans) === null)) {
    issues.push(`${where}: a tick_cross answerKey holds "✓" or "✗" for each statement.`);
  }
  if (a.type === "ordering" && block.answerKey?.length) {
    const n = block.answerKey.length;
    const positions = block.answerKey.map((ans) => Number(ans.trim()));
    if (positions.some((p) => !Number.isInteger(p)) || new Set(positions).size !== n || positions.some((p) => p < 1 || p > n)) {
      issues.push(`${where}: an ordering answerKey gives each item's position, using each number 1-${n} once.`);
    }
  }
  return issues;
}

// Deterministic backstop for puzzle blocks the model still got wrong:
// crossword / word-search words that can't be placed are dropped (item and
// answer together, so the key stays paired), tick answers are normalised
// to ✓/✗. A puzzle left with fewer than 3 words becomes a plain exercise.
export function repairPuzzle<B extends ActivityBlock>(block: B): B {
  const a = block.activity;
  if (!a || !block.answerKey?.length) return block;
  if (a.type === "tick_cross") {
    return { ...block, answerKey: block.answerKey.map((ans) => (tickAnswer(ans) === false ? "✗" : tickAnswer(ans) ? "✓" : ans)) };
  }
  if (a.type !== "crossword" && a.type !== "wordsearch") return block;
  const unplaced = a.type === "crossword" ? buildCrossword(block.answerKey).unplaced : buildWordSearch(block.answerKey, block.heading).unplaced;
  if (!unplaced.length) return block;
  const keep = (_: unknown, i: number) => !unplaced.includes(i);
  const answerKey = block.answerKey.filter(keep);
  const items = block.items?.filter(keep);
  if (answerKey.length < 3) return { ...block, activity: undefined };
  return { ...block, items, answerKey };
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
export const GRID_CELL = 16;
export const MARK_BOX = 12;
// Puzzle grids are sized for a column this wide (src/lib/pdf/puzzle-blocks.tsx).
export const PUZZLE_WIDTH = 230;

// Puzzle grid cell size for a given width.
export function gridCell(cols: number, width: number): number {
  return Math.max(10, Math.min(GRID_CELL, Math.floor(width / Math.max(1, cols))));
}

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
    case "crossword": {
      const cw = buildCrossword(block.answerKey ?? []);
      const clueLines = n * size * 1.45 + 24;
      return { extra: bank + cw.rows * gridCell(cw.cols, Math.min(width, PUZZLE_WIDTH)) + 10 + clueLines, replacesItems: true };
    }
    case "wordsearch": {
      const ws = buildWordSearch(block.answerKey ?? block.items ?? [], block.heading);
      return { extra: bank + ws.size * gridCell(ws.size, Math.min(width, PUZZLE_WIDTH) * 0.62) + 10, replacesItems: true };
    }
    case "unscramble":
    case "odd_one_out":
    case "tick_cross":
    case "ordering":
      return { extra: bank + n * (size * 1.45 + 7), replacesItems: true };
    case "match_lines":
      return { extra: bank + n * Math.max(size * 1.45 + 8, 20), replacesItems: true };
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
