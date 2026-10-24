// Jury finding (2026-10-24): the hand-made copies kept the source's items in
// the same order with only the nouns swapped ("Where's the Park Hotel?" ->
// "Where's the bus station?"), its rubrics word for word and its series'
// feature names. The 5-gram overlap (originality.ts) never sees that - the
// words differ, the sentence frames do not.
//
// Deterministic, no model call: every sentence on the written page and on its
// source page is reduced to its frame - the grammar words kept, every other
// word one slot ("where 's the _"). A page whose frames follow the source's
// in the same order, or that repeats the source's own (non-generic)
// instructions, mirrors the source and is sent back.
import { GENERIC_HEADING } from "@/lib/source-names";

// The words a sentence frame is made of: pronouns, determiners, prepositions,
// auxiliaries, question words and the commonest verbs.
const FRAME_WORDS = new Set([
  "i", "me", "my", "mine", "you", "your", "yours", "he", "him", "his", "she", "her", "hers", "it", "its", "we", "us",
  "our", "ours", "they", "them", "their", "theirs", "this", "that", "these", "those", "there", "here", "a", "an", "the",
  "some", "any", "no", "every", "each", "all", "both", "many", "much", "more", "most", "few", "lot", "lots", "of",
  "another", "other", "in", "on", "at", "to", "from", "with", "by", "for", "about", "under", "over", "into", "onto", "out",
  "up", "down", "near", "next", "behind", "between", "across", "through", "along", "past", "around", "before", "after",
  "and", "or", "but", "so", "because", "if", "when", "while", "than", "then", "be", "am", "is", "are", "was", "were",
  "been", "do", "does", "did", "have", "has", "had", "can", "could", "will", "would", "shall", "should", "may", "might",
  "must", "'s", "'re", "'m", "'ve", "'ll", "'d", "n't", "not", "what", "where", "who", "whose", "which", "why", "how",
  "go", "goes", "going", "like", "likes", "want", "wants", "let", "please", "yes", "very", "too", "also", "often",
  "always", "usually", "sometimes", "never",
]);

const SLOT = "_";

export function frameTokens(sentence: string): string[] {
  const words = sentence
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/_{2,}|\.{3,}|…/g, " ___ ")
    .match(/___|\d[\d,.]*|[\p{L}]+(?:'[\p{L}]+)?/gu) ?? [];
  const tokens: string[] = [];
  for (const w of words) {
    const m = w.match(/^([\p{L}]+?)(n't|'s|'re|'m|'ve|'ll|'d)$/u);
    if (m) tokens.push(m[1] === "ca" ? "can" : m[1] === "wo" ? "will" : m[1], m[2]);
    else tokens.push(w);
  }
  const frame: string[] = [];
  for (const t of tokens) {
    const mapped = /^\d/.test(t) ? "#" : FRAME_WORDS.has(t) ? t : SLOT;
    if (mapped === SLOT && frame.at(-1) === SLOT) continue;
    frame.push(mapped);
  }
  return frame;
}

// A frame worth comparing: four or more tokens, two of them grammar words and
// at least one slot - "how are you" or a bare word list says nothing.
function telling(frame: string[]): boolean {
  const grammar = frame.filter((t) => t !== SLOT && t !== "#").length;
  return frame.length >= 4 && grammar >= 2 && frame.some((t) => t === SLOT || t === "#");
}

// The sentences of a page's text: one per line and sentence, without item
// numbers, letters and speaker labels ("1 A: ...", "b) ...", "Sue: ...").
export function sentences(text: string): string[] {
  return text
    .replace(/[’‘]/g, "'")
    .split(/\n+|(?<=[.?!])\s+(?=\S)|\s+(?=\b[A-Z]:\s)|\s+(?=\b[a-f]\)\s)/)
    .map((s) =>
      s
        .replace(/^\s*(?:\d{1,2}[.)]?|[a-f][.)]|[A-Z]:|[\p{Lu}][\p{Ll}]+:)\s+/u, "")
        .replace(/^\s*(?:[A-Z]:|[a-f][.)])\s+/, "")
        .trim(),
    )
    .filter((s) => s && !/^(?:\d{1,2}|[a-f])[.)]?$/.test(s) && !/^[\p{Lu}][\p{Ll}]*:$/u.test(s));
}

function lcsLength<T>(a: T[], b: T[], same: (x: T, y: T) => boolean): { length: number; pairs: [number, number][] } {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = same(a[i - 1], b[j - 1]) ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const pairs: [number, number][] = [];
  for (let i = a.length, j = b.length; i > 0 && j > 0; ) {
    if (same(a[i - 1], b[j - 1]) && dp[i][j] === dp[i - 1][j - 1] + 1) {
      pairs.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return { length: dp[a.length][b.length], pairs };
}

// Two frames are the same frame when they share 85% of their tokens in order.
function sameFrame(a: string[], b: string[]): boolean {
  if (Math.abs(a.length - b.length) > Math.max(2, a.length * 0.3)) return false;
  return (2 * lcsLength(a, b, (x, y) => x === y).length) / (a.length + b.length) >= 0.85;
}

// ---- rubrics ----

const rubricKey = (s: string) =>
  s
    .replace(/[’‘]/g, "'")
    .replace(/^\s*\d{1,2}\s*(?:[a-f]\))?\s*/, "")
    .replace(/(?<=\p{Ll}[^.?!]*\s)\p{Lu}[\p{Ll}]+(?:'s)?/gu, "_") // names inside a sentence
    .toLowerCase()
    .replace(/[^\p{L}\d'_ ]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

// An instruction any coursebook prints ("Listen and repeat.", "Read and
// choose. Then listen and check.") is fine to share; a longer one, or one
// with its own words ("What's the subject? Look, choose and write."), is the
// source's.
const RUBRIC_WORDS = new Set([
  "names", "name", "numbers", "colours", "colors", "below", "missing", "correct", "right", "wrong", "letter", "letters",
  "gap", "gaps", "blank", "blanks", "friend", "friends", "class", "title", "answers", "roles", "role", "true", "false",
  "underline", "fill", "use", "using", "best", "each", "item", "items", "ex", "box", "boxes", "notes", "note", "chart",
  "information", "ideas", "following", "words", "phrases", "sounds", "sound", "options", "option", "mark", "marks",
  "watch", "video", "say", "sing", "chant", "stick", "colour", "color", "draw", "trace", "copy", "spell",
]);

function ownRubric(key: string[]): boolean {
  if (key.length < 5) return false;
  return key.length >= 9 || key.some((w) => w !== "_" && w.length > 1 && !/^\d+[a-z]?$/.test(w) && !GENERIC_HEADING.has(w) && !FRAME_WORDS.has(w) && !RUBRIC_WORDS.has(w));
}

function sameRubric(a: string[], b: string[]): boolean {
  const n = Math.min(a.length, b.length);
  if (n < 5) return false;
  // The source's rubrics are often cut at the line end ("Complete the short
  // dialogues. Then take") - a shared opening of five or more words counts.
  return a.slice(0, n).join(" ") === b.slice(0, n).join(" ") && (a.length === b.length || n >= 6);
}

// ---- the report ----

type MirrorBlock = { heading?: string; body?: string; items?: string[]; dialogue?: { speaker: string; line: string }[] };
type MirrorPage = { blocks: MirrorBlock[] };

export type MirroringReport = {
  // Written sentences whose frame repeats a source sentence's, in the source's order.
  mirroredItems: number;
  // Written sentences with a frame worth comparing.
  comparedItems: number;
  // The source's own instructions repeated (after names are masked).
  sharedRubrics: string[];
  examples: { source: string; generated: string }[];
  flagged: boolean;
};

// Thresholds, tuned on stored runs and the hand-made i5 (2026-10-24, see
// YAYINEVI-KALITESI.md): four mirrored frames making up a third of the page,
// or two of the source's own instructions, or one with three mirrored frames.
export const MIRROR_MIN_ITEMS = 4;
export const MIRROR_MIN_SHARE = 0.3;

export function pageSentences(page: MirrorPage): { rubrics: string[]; lines: string[] } {
  const rubrics = page.blocks.map((b) => b.heading ?? "").filter(Boolean);
  const lines = page.blocks.flatMap((b) => [
    ...sentences(b.heading ?? ""),
    ...sentences(b.body ?? ""),
    ...(b.items ?? []).flatMap(sentences),
    ...(b.dialogue ?? []).flatMap((d) => sentences(d.line)),
  ]);
  return { rubrics, lines };
}

export function structuralMirroring(source: { text: string; rubrics?: string[] }, page: MirrorPage): MirroringReport {
  const src = sentences(source.text).map((s) => ({ s, f: frameTokens(s) })).filter((x) => telling(x.f));
  const { rubrics, lines } = pageSentences(page);
  const gen = lines.map((s) => ({ s, f: frameTokens(s) })).filter((x) => telling(x.f));
  const { length, pairs } = lcsLength(src, gen, (a, b) => sameFrame(a.f, b.f));

  const sourceRubrics = [...(source.rubrics ?? []), ...sentences(source.text)].map(rubricKey).filter(ownRubric);
  const sharedRubrics = rubrics.filter((r) => {
    const key = rubricKey(r);
    return ownRubric(key) && sourceRubrics.some((s) => sameRubric(s, key));
  });

  const share = gen.length ? length / gen.length : 0;
  const flagged =
    (length >= MIRROR_MIN_ITEMS && share >= MIRROR_MIN_SHARE) || sharedRubrics.length >= 2 || (sharedRubrics.length >= 1 && length >= 3);
  return {
    mirroredItems: length,
    comparedItems: gen.length,
    sharedRubrics,
    examples: pairs.slice(0, 3).map(([i, j]) => ({ source: src[i].s, generated: gen[j].s })),
    flagged,
  };
}

export function mirroringIssue(report: MirroringReport, label: string, pageNumber: number): string | null {
  if (!report.flagged) return null;
  const parts: string[] = [];
  if (report.mirroredItems >= 3) {
    const e = report.examples[0];
    parts.push(
      `${report.mirroredItems} of its ${report.comparedItems} sentences repeat the source page's sentence frames in the source's order with only the words swapped${e ? ` (e.g. "${e.generated}" follows "${e.source}")` : ""}`,
    );
  }
  if (report.sharedRubrics.length) parts.push(`it repeats the source's own instructions (${report.sharedRubrics.map((r) => `"${r}"`).join(", ")})`);
  return `${label}, page ${pageNumber}: mirrors its source page too closely - ${parts.join("; ")}. Keep the exercise formats, but rewrite the items in a different order and with different sentence frames (new questions, new situations, new story events), and word every instruction your own way.`;
}
