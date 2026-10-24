// Deterministic, LLM-free English vocabulary-difficulty signal (see the
// "gerçek kelime-frekans/CEFR kalibrasyonu" note in ROADMAP.md), fed into
// reviewReadingLevel (workflows/book-pipeline.tsx).
//
// 2026-10-21: words are looked up in the CEFR-J Wordlist (~6,900 single-word
// headwords, A1-B2 - src/lib/cefr-j-wordlist.ts) after a light
// lemmatization ("pencils" -> pencil, "went" -> go), with the original
// hand-compiled list (src/lib/cefr-en-wordlist.ts) as a fallback for words
// CEFR-J leaves out, which is also the only source of C1. A word in neither
// list is still NOT treated as "too advanced" - names, numbers and topic
// terms land there - only words the lists place above the target level are.
import { tokenize } from "./originality";
import { CEFR_EN_WORD_BANDS, type CefrBand } from "./cefr-en-wordlist";
import { CEFRJ_WORDS } from "./cefr-j-wordlist";

const BAND_ORDER: CefrBand[] = ["A1", "A2", "B1", "B2", "C1"];

const WORD_TO_BAND: Map<string, CefrBand> = new Map();
for (const band of Object.keys(CEFRJ_WORDS) as (keyof typeof CEFRJ_WORDS)[]) {
  for (const word of CEFRJ_WORDS[band].split(" ")) WORD_TO_BAND.set(word, band);
}
for (const band of Object.keys(CEFR_EN_WORD_BANDS) as CefrBand[]) {
  for (const word of CEFR_EN_WORD_BANDS[band]) {
    // CEFR-J wins; the hand list only fills its gaps.
    if (!WORD_TO_BAND.has(word)) WORD_TO_BAND.set(word, band);
  }
}

// Irregular forms a young learners' book uses all the time.
const IRREGULAR: Record<string, string> = {
  is: "be", are: "be", am: "be", was: "be", were: "be", been: "be", being: "be",
  has: "have", had: "have", does: "do", did: "do", done: "do",
  went: "go", gone: "go", goes: "go", saw: "see", seen: "see", ate: "eat", eaten: "eat",
  came: "come", got: "get", made: "make", said: "say", took: "take", taken: "take",
  gave: "give", given: "give", ran: "run", swam: "swim", sang: "sing", sung: "sing",
  wrote: "write", written: "write", bought: "buy", brought: "bring", thought: "think",
  taught: "teach", caught: "catch", found: "find", told: "tell", knew: "know", known: "know",
  left: "leave", felt: "feel", kept: "keep", slept: "sleep", met: "meet", sat: "sit",
  stood: "stand", began: "begin", drank: "drink", drove: "drive", flew: "fly", forgot: "forget",
  grew: "grow", heard: "hear", lost: "lose", paid: "pay", rode: "ride", sold: "sell", sent: "send",
  spoke: "speak", spent: "spend", threw: "throw", wore: "wear", won: "win", woke: "wake",
  broke: "break", chose: "choose", fell: "fall", hid: "hide", children: "child", men: "man",
  women: "woman", feet: "foot", teeth: "tooth", mice: "mouse", people: "person", better: "good",
  best: "good", worse: "bad", worst: "bad",
};

// The word itself first, then the stems an inflection could come from.
export function lemmaCandidates(word: string): string[] {
  const w = word.toLowerCase();
  const out = [w];
  if (IRREGULAR[w]) out.push(IRREGULAR[w]);
  const strip = (suffix: string, ...ends: string[]) => {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
      const stem = w.slice(0, -suffix.length);
      out.push(...ends.map((e) => stem + e));
      // swimming -> swim, bigger -> big
      if (stem.length > 2 && stem.at(-1) === stem.at(-2)) out.push(stem.slice(0, -1));
    }
  };
  strip("ies", "y");
  strip("es", "", "e");
  strip("s", "");
  strip("ied", "y");
  strip("ed", "", "e");
  strip("ing", "", "e");
  strip("ier", "y");
  strip("iest", "y");
  strip("er", "", "e");
  strip("est", "", "e");
  strip("ly", "");
  return out;
}

// The word itself is a headword - no lemmatizing, so a name like "Peter"
// does not pass as "pet" + -er (src/lib/source-names.ts).
export function isHeadword(word: string): boolean {
  const w = word.toLowerCase();
  return WORD_TO_BAND.has(w) || w in IRREGULAR;
}

export function bandOf(word: string): CefrBand | undefined {
  for (const candidate of lemmaCandidates(word)) {
    const band = WORD_TO_BAND.get(candidate);
    if (band) return band;
  }
  return undefined;
}

export interface VocabularyCoverage {
  totalTokens: number;
  classifiedTokens: number;
  bandCounts: Record<CefrBand, number>;
  unclassifiedRatio: number;
}

export function estimateVocabularyCoverage(text: string): VocabularyCoverage {
  const tokens = tokenize(text);
  const bandCounts: Record<CefrBand, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
  let classifiedTokens = 0;

  for (const token of tokens) {
    const band = bandOf(token);
    if (band) {
      bandCounts[band]++;
      classifiedTokens++;
    }
  }

  return {
    totalTokens: tokens.length,
    classifiedTokens,
    bandCounts,
    unclassifiedRatio: tokens.length ? (tokens.length - classifiedTokens) / tokens.length : 0,
  };
}

export function describeVocabularyCoverage(coverage: VocabularyCoverage): string {
  if (!coverage.classifiedTokens) {
    return "No words from this unit matched the reference vocabulary list - no supplementary signal available.";
  }

  const pct = (n: number) => Math.round((n / coverage.classifiedTokens) * 100);
  const basic = pct(coverage.bandCounts.A1 + coverage.bandCounts.A2);
  const intermediate = pct(coverage.bandCounts.B1 + coverage.bandCounts.B2);
  const advanced = pct(coverage.bandCounts.C1);
  const unclassifiedPct = Math.round(coverage.unclassifiedRatio * 100);

  return (
    `Of words recognized against the CEFR-J reference list (${coverage.classifiedTokens} of ` +
    `${coverage.totalTokens} total words): ${basic}% are basic (A1-A2), ${intermediate}% are ` +
    `intermediate (B1-B2), ${advanced}% are advanced (C1+). ${unclassifiedPct}% of all words were not ` +
    `in the reference list (likely names, numbers, or topic-specific terminology - not necessarily a ` +
    `level problem).`
  );
}

// The highest CEFR band a level label allows: "A2" -> A2, "A2-B1" -> B1,
// "Pre-A1 Starters" -> A1 (the lists start at A1), "CEFR A1+" -> A1.
// null for labels without a CEFR level ("Grade 7").
export function targetBand(level: string): CefrBand | null {
  const bands = [...level.toUpperCase().matchAll(/\b([ABC][12])\b/g)].map((m) => m[1] as CefrBand);
  const known = bands.filter((b) => BAND_ORDER.includes(b));
  if (known.length) return known.sort((a, b) => BAND_ORDER.indexOf(b) - BAND_ORDER.indexOf(a))[0];
  if (/pre[- ]?a1|starters|movers|beginner/i.test(level)) return "A1";
  return null;
}

// Young learners' levels (Pre-A1, Cambridge Starters/Movers): print choices
// for children - a word list instead of definitions, no workbook answer key,
// a rounded cover title. Plain "A1" also covers adult beginners and keeps
// the standard book.
export function isYoungLearnerLevel(level: string): boolean {
  return /pre[- ]?a1|starters|movers|young learners|kids/i.test(level);
}

export type LevelProfile = {
  classifiedTokens: number;
  aboveTokens: number;
  /** Share of the recognised words that sit above the target band. */
  aboveShare: number;
  /** The above-level words, most frequent first. */
  aboveWords: { word: string; band: CefrBand; count: number }[];
};

// How much of a text's recognised vocabulary sits above the target band,
// leaving out the words the unit sets out to teach (its key terms and
// glossary) - a unit about the weather may use "temperature".
export function levelProfile(text: string, band: CefrBand, taught: Iterable<string> = []): LevelProfile {
  const allowed = new Set<string>();
  for (const term of taught) for (const t of tokenize(term)) for (const c of lemmaCandidates(t)) allowed.add(c);
  const limit = BAND_ORDER.indexOf(band);
  const above = new Map<string, { band: CefrBand; count: number }>();
  let classifiedTokens = 0;
  let aboveTokens = 0;
  for (const token of tokenize(text)) {
    const b = bandOf(token);
    if (!b) continue;
    classifiedTokens++;
    if (BAND_ORDER.indexOf(b) <= limit || lemmaCandidates(token).some((c) => allowed.has(c))) continue;
    aboveTokens++;
    const e = above.get(token) ?? { band: b, count: 0 };
    e.count++;
    above.set(token, e);
  }
  return {
    classifiedTokens,
    aboveTokens,
    aboveShare: classifiedTokens ? aboveTokens / classifiedTokens : 0,
    aboveWords: [...above].map(([word, e]) => ({ word, ...e })).sort((a, b) => b.count - a.count),
  };
}

// The deterministic level gate: the unit fails when clearly more of its
// vocabulary is above the target level than the source book's own pages
// at the same level (a real coursebook is never 100% in-level), and at
// least three different words are involved. Returns the reviewer's issue
// text, or null when the unit is in level.
export const LEVEL_MARGIN = 0.05;
export const LEVEL_FLOOR = 0.06;

export function levelIssue(generated: LevelProfile, source: LevelProfile | null, band: CefrBand): string | null {
  const allowedShare = Math.max(LEVEL_FLOOR, (source?.aboveShare ?? 0) + LEVEL_MARGIN);
  if (generated.aboveShare <= allowedShare || generated.aboveWords.length < 3) return null;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const words = generated.aboveWords
    .slice(0, 15)
    .map((w) => `${w.word} (${w.band})`)
    .join(", ");
  return (
    `Vocabulary above ${band}: ${pct(generated.aboveShare)} of the recognised words (CEFR-J list)` +
    `${source ? `, the source pages have ${pct(source.aboveShare)}` : ""}. ` +
    `Replace these with ${band}-level words, or teach them as key vocabulary: ${words}.`
  );
}
