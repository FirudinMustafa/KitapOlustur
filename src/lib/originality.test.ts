import { describe, expect, it } from "vitest";
import { ngramJaccardSimilarity } from "./originality";

describe("ngramJaccardSimilarity", () => {
  it("returns 1 for identical text", () => {
    const text = "The quick brown fox jumps over the lazy dog every single morning";
    expect(ngramJaccardSimilarity(text, text)).toBe(1);
  });

  it("returns 0 for completely unrelated text", () => {
    const a = "Photosynthesis converts light energy into chemical energy in plants";
    const b = "The stock market closed lower today amid inflation concerns";
    expect(ngramJaccardSimilarity(a, b)).toBe(0);
  });

  it("scores partial word-for-word reuse above the Faz F1 flag threshold", () => {
    const source =
      "Read the dialogue below and answer the questions that follow about the conversation between the two friends";
    // Shares a long verbatim run with `source`, wrapped in different framing -
    // exactly the "reused wording" case this check exists to catch.
    const generated =
      "First, read the dialogue below and answer the questions that follow about the conversation between the two friends, then discuss it.";
    expect(ngramJaccardSimilarity(source, generated)).toBeGreaterThan(0.15);
  });

  it("scores independently-written content on the same topic below the threshold", () => {
    const source = "Look at the picture and describe what the family is doing in the park on a sunny afternoon";
    const generated =
      "Examine this illustration carefully. Write three sentences about the weekend activities you can observe.";
    expect(ngramJaccardSimilarity(source, generated)).toBeLessThan(0.15);
  });

  it("is case- and punctuation-insensitive", () => {
    const a = "Hello, world! This is a TEST.";
    const b = "hello world this is a test";
    expect(ngramJaccardSimilarity(a, b, 3)).toBe(1);
  });

  it("returns 0 when either input is too short to form an n-gram", () => {
    expect(ngramJaccardSimilarity("short", "also short", 5)).toBe(0);
    expect(ngramJaccardSimilarity("", "some real generated content here", 5)).toBe(0);
  });
});
