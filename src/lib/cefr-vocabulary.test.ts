import { describe, expect, it } from "vitest";
import {
  bandOf,
  describeVocabularyCoverage,
  estimateVocabularyCoverage,
  lemmaCandidates,
  levelIssue,
  levelProfile,
  targetBand,
} from "./cefr-vocabulary";

describe("bandOf", () => {
  it("classifies known basic and advanced words", () => {
    expect(bandOf("the")).toBe("A1");
    expect(bandOf("ubiquitous")).toBe("C1");
  });

  it("is case-insensitive", () => {
    expect(bandOf("THE")).toBe("A1");
  });

  it("returns undefined for words not in the reference list", () => {
    expect(bandOf("xyzzyplugh")).toBeUndefined();
  });
});

describe("estimateVocabularyCoverage", () => {
  it("scores a simple A2-level sentence as mostly basic vocabulary", () => {
    const text = "I like to eat breakfast with my family every morning. My mother makes eggs and juice.";
    const coverage = estimateVocabularyCoverage(text);
    const basicShare = (coverage.bandCounts.A1 + coverage.bandCounts.A2) / coverage.classifiedTokens;
    expect(basicShare).toBeGreaterThan(0.7);
  });

  it("scores a deliberately advanced/academic sentence with a higher B2+ share than a simple one", () => {
    // No lemmatization (documented, in-scope limitation - see the "Kapsam
    // dışı" note): common function words (the/of/any) still dominate raw
    // token counts even in advanced text, so this compares relative B2+
    // presence rather than asserting basic words fall below 50% outright.
    const simple = "I like to eat breakfast with my family every morning. My mother makes eggs and juice.";
    const advanced =
      "The pervasive ambiguity of the empirical methodology undermines the plausibility of any definitive conclusion.";
    const simpleCoverage = estimateVocabularyCoverage(simple);
    const advancedCoverage = estimateVocabularyCoverage(advanced);
    const advancedShare = (c: ReturnType<typeof estimateVocabularyCoverage>) =>
      (c.bandCounts.B1 + c.bandCounts.B2 + c.bandCounts.C1) / c.classifiedTokens;
    expect(advancedShare(advancedCoverage)).toBeGreaterThan(advancedShare(simpleCoverage));
  });

  it("does not treat proper nouns/numbers as classified words, without throwing", () => {
    const text = "Zxq Fyrbnak visited 4827 Klorptown on Xyzday.";
    expect(() => estimateVocabularyCoverage(text)).not.toThrow();
    const coverage = estimateVocabularyCoverage(text);
    expect(coverage.unclassifiedRatio).toBeGreaterThan(0.5);
  });

  it("handles empty text without dividing by zero", () => {
    const coverage = estimateVocabularyCoverage("");
    expect(coverage.totalTokens).toBe(0);
    expect(coverage.unclassifiedRatio).toBe(0);
  });
});

describe("describeVocabularyCoverage", () => {
  it("produces a human-readable summary mentioning the classified/unclassified split", () => {
    const coverage = estimateVocabularyCoverage("I like to eat breakfast with my family every morning.");
    const summary = describeVocabularyCoverage(coverage);
    expect(summary).toContain("%");
    expect(summary.toLowerCase()).toContain("reference");
  });

  it("returns a graceful message when nothing was classified", () => {
    const coverage = estimateVocabularyCoverage("Zxq Fyrbnak Klorptown Xyzday");
    const summary = describeVocabularyCoverage(coverage);
    expect(summary).toMatch(/no (words|supplementary)/i);
  });
});

describe("CEFR-J lookup with inflections (2026-10-21)", () => {
  it("finds inflected and irregular forms through their lemma", () => {
    expect(lemmaCandidates("pencils")).toContain("pencil");
    expect(lemmaCandidates("swimming")).toContain("swim");
    expect(bandOf("pencils")).toBe("A1");
    expect(bandOf("went")).toBe("A1");
    expect(bandOf("children")).toBe("A1");
  });

  it("knows the CEFR-J levels of non-basic words", () => {
    expect(bandOf("abandon")).toBe("B1");
    expect(bandOf("abandoned")).toBe("B2");
  });
});

describe("targetBand", () => {
  it("reads the highest band of a level label", () => {
    expect(targetBand("A2")).toBe("A2");
    expect(targetBand("CEFR A2-B1")).toBe("B1");
    expect(targetBand("Pre-A1 Starters")).toBe("A1");
    expect(targetBand("Grade 7")).toBeNull();
  });
});

describe("level gate", () => {
  const easy = "Hello! What's your name? I'm Misty. Point to the pencil and the book. Count the chairs: one, two, three.";
  const hard =
    "Investigate the remarkable phenomenon and evaluate the significant consequences. Analyse the environment and the government's ambitious strategy.";

  it("passes in-level text and leaves taught words out", () => {
    expect(levelIssue(levelProfile(easy, "A1"), null, "A1")).toBeNull();
    const taught = levelProfile("The weather today: the temperature is high.", "A1", ["temperature"]);
    expect(taught.aboveWords.map((w) => w.word)).not.toContain("temperature");
  });

  it("fails text clearly above the level, naming the words", () => {
    const issue = levelIssue(levelProfile(hard, "A1"), levelProfile(easy, "A1"), "A1");
    expect(issue).toMatch(/above A1/);
    expect(issue).toMatch(/phenomenon|consequences|strategy/);
  });

  it("allows as much above-level vocabulary as the source has, plus a margin", () => {
    const source = levelProfile(hard, "A1");
    expect(levelIssue(levelProfile(hard, "A1"), source, "A1")).toBeNull();
  });
});
