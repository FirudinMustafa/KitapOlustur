// Deterministic, LLM-free English vocabulary-difficulty signal (see the
// "gerçek kelime-frekans/CEFR kalibrasyonu" note in ROADMAP.md) - fed into
// reviewReadingLevel (workflows/book-pipeline.tsx) as SUPPLEMENTARY evidence
// alongside its existing LLM judgment, not as a standalone pass/fail gate.
//
// A word absent from CEFR_EN_WORD_BANDS is deliberately NOT treated as "too
// advanced" - any hand-compiled list is necessarily incomplete (proper
// nouns, numbers, topic-specific terminology), and flagging every unlisted
// word would produce far too many false positives. Instead, only the BAND
// DISTRIBUTION of words the list actually recognizes is reported, with the
// unrecognized share called out separately as informational, not negative.
import { tokenize } from "./originality";
import { CEFR_EN_WORD_BANDS, type CefrBand } from "./cefr-en-wordlist";

const WORD_TO_BAND: Map<string, CefrBand> = new Map();
for (const band of Object.keys(CEFR_EN_WORD_BANDS) as CefrBand[]) {
  for (const word of CEFR_EN_WORD_BANDS[band]) {
    // Earlier (easier) bands win on the rare word appearing in two lists -
    // safer to under-flag than over-flag given this list's limited size.
    if (!WORD_TO_BAND.has(word)) WORD_TO_BAND.set(word, band);
  }
}

export function bandOf(word: string): CefrBand | undefined {
  return WORD_TO_BAND.get(word.toLowerCase());
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
    `Of words recognized against a reference English frequency list (${coverage.classifiedTokens} of ` +
    `${coverage.totalTokens} total words): ${basic}% are basic (A1-A2), ${intermediate}% are ` +
    `intermediate (B1-B2), ${advanced}% are advanced (C1+). ${unclassifiedPct}% of all words were not ` +
    `in the reference list (likely names, numbers, or topic-specific terminology - not necessarily a ` +
    `level problem).`
  );
}
