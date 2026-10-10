import { describe, expect, it } from "vitest";
import type { GeneratedPage } from "@/lib/ai/schemas";
import { fixMapAnswers, trueRelations } from "./map-answers";

// The live E2E 2026-10-10 page: map and questions in separate blocks.
const page = {
  sourcePageNumber: 3,
  pageType: "practice",
  blocks: [
    {
      kind: "practice",
      heading: "Listen and Draw",
      body: "",
      diagram: {
        type: "map",
        places: [
          { name: "School", emoji: "🏫", row: 1, col: 2 },
          { name: "Library", emoji: "📚", row: 1, col: 1 },
          { name: "Cinema", emoji: "🎬", row: 3, col: 2 },
          { name: "Bank", emoji: "🏦", row: 3, col: 1 },
        ],
      },
    },
    {
      kind: "practice",
      heading: "Write the Sentences",
      body: "",
      items: ["The library is ___ the school.", "The cinema is ___ the bank.", "The school is ___ the cinema."],
      answerKey: ["next to", "opposite", "behind"],
    },
  ],
} as unknown as GeneratedPage;

describe("map answers", () => {
  it("knows what is true on the grid", () => {
    const places = page.blocks[0].diagram!.places!;
    expect(trueRelations(places, "library", "school")).toEqual(["next to", "to the left of"]);
    expect(trueRelations(places, "school", "cinema")).toEqual(["opposite"]);
    expect(trueRelations(places, "school", "library", "cinema")).toEqual([]);
  });

  it("corrects answers that contradict the drawn map and keeps the right ones", () => {
    const { page: fixed, fixes } = fixMapAnswers(page);
    expect(fixed.blocks[1].answerKey).toEqual(["next to", "next to", "opposite"]);
    expect(fixes.map((f) => [f.was, f.now])).toEqual([
      ["opposite", "next to"],
      ["behind", "opposite"],
    ]);
  });

  it("checks between against both neighbours", () => {
    const places = [
      { name: "bank", row: 1, col: 1 },
      { name: "café", row: 1, col: 2 },
      { name: "shop", row: 1, col: 3 },
    ];
    expect(trueRelations(places, "café", "shop", "bank")).toEqual(["between"]);
  });
});
