import { describe, expect, it } from "vitest";
import type { GeneratedPage } from "@/lib/ai/schemas";
import { mergePageRewrite } from "./merge-rewrite";

const original = {
  sourcePageNumber: 1,
  pageType: "practice",
  layoutTemplate: "exercise-grid",
  blocks: [
    { kind: "explanation", heading: "Intro", body: "A long introduction to the places in our town and why they matter." },
    {
      kind: "practice",
      heading: "Building Names",
      body: "Look at the pictures. Write the words.",
      items: ["A building with books: ___", "A place to keep money: ___"],
      answerKey: ["library", "bank"],
      activity: { type: "picture_label", words: ["library", "bank"], pictures: [{ label: "library", emoji: "📚" }, { label: "bank", emoji: "💰" }] },
    },
    {
      kind: "practice",
      heading: "Where is the ball?",
      body: "",
      items: ["The ball is ___ the box."],
      answerKey: ["in"],
      diagram: { type: "prepositions", scenes: ["in"] },
    },
  ],
} as unknown as GeneratedPage;

// what the live rewrite returned: plain lists, no keys, no template
const rewritten = {
  sourcePageNumber: 1,
  pageType: "practice",
  blocks: [
    { kind: "explanation", heading: "Intro", body: "Places in our town." },
    { kind: "practice", heading: "Building names", body: "Write the words.", items: ["A place with books: ___", "A place for money: ___"] },
    { kind: "practice", heading: "Quick quiz", body: "", items: ["Name a shop."] },
  ],
} as unknown as GeneratedPage;

describe("mergePageRewrite", () => {
  const merged = mergePageRewrite(original, rewritten);

  it("keeps the rewrite's wording but the reviewed exercise", () => {
    expect(merged.blocks[0].body).toBe("Places in our town.");
    const grid = merged.blocks.find((b) => b.heading === "Building Names")!;
    expect(grid.activity?.pictures).toHaveLength(2);
    expect(grid.answerKey).toEqual(["library", "bank"]);
    expect(grid.body).toBe("Write the words.");
  });

  it("puts back exercises the rewrite dropped and drops added ones without answers", () => {
    expect(merged.blocks.map((b) => b.heading)).toEqual(["Intro", "Building Names", "Where is the ball?"]);
    expect(merged.blocks[2].diagram?.type).toBe("prepositions");
  });

  it("keeps the layout template when the rewrite leaves it out", () => {
    expect(merged.layoutTemplate).toBe("exercise-grid");
  });
});
