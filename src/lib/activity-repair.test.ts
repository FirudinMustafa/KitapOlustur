import { describe, expect, it } from "vitest";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import { applyPictures, findPictureGaps, matchOrder } from "./activity-repair";
import { fixPrepositionItems } from "./diagrams";

const unit = {
  unitNumber: 1,
  title: "Town",
  studentBookPages: [],
  workbookPages: [
    {
      sourcePageNumber: 1,
      pageType: "practice",
      blocks: [
        // live E2E 2026-10-10 shape: picture_label without pictures
        {
          kind: "practice",
          heading: "1. Match the Buildings",
          body: "",
          items: ["A place to learn", "A place to borrow books"],
          answerKey: ["school", "library"],
          activity: { type: "picture_label", words: ["school", "library"] },
        },
        { kind: "practice", heading: "2 Match", body: "", items: ["cat", "dog", "bird"], answerKey: ["a", "b", "c"], activity: { type: "picture_match" } },
      ],
    },
  ],
} as unknown as GeneratedUnit;

describe("picture backfill", () => {
  it("asks for pictures of the answers in a labelling grid and of the items in a match", () => {
    const gaps = findPictureGaps(unit);
    expect(gaps.map((g) => g.shows)).toEqual([["school", "library"], ["cat", "dog", "bird"]]);
  });

  it("mixes match pictures and re-letters the answer key to match", () => {
    const [label, match] = findPictureGaps(unit);
    const filled = applyPictures(unit, [
      { id: label.id, pictures: [{ label: "school", emoji: "🏫" }, { label: "books", emoji: "📚" }] },
      { id: match.id, pictures: [{ label: "cat", emoji: "🐱" }, { label: "dog", emoji: "🐶" }, { label: "bird", emoji: "🐦" }] },
    ]);
    expect(findPictureGaps(filled)).toEqual([]);
    const block = filled.workbookPages[0].blocks[1];
    const shown = block.activity!.pictures!.map((p) => p.label);
    // every item's letter points at its own picture, and no picture sits beside its word
    block.items!.forEach((item, i) => expect(shown[block.answerKey![i].charCodeAt(0) - 97]).toBe(item));
    shown.forEach((label, k) => expect(label).not.toBe(block.items![k]));
  });

  it("orders deterministically", () => {
    expect(matchOrder(4, "x")).toEqual(matchOrder(4, "x"));
    expect([...matchOrder(5, "seed")].sort()).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("preposition backstop", () => {
  it("rewrites gapless items from their scenes", () => {
    const fixed = fixPrepositionItems({
      heading: "2. Spatial Prepositions",
      items: ["The ball is in the middle of two boxes.", "The ball is ___ the box."],
      answerKey: ["between", "behind"],
      diagram: { type: "prepositions", scenes: ["between", "behind"] },
    });
    expect(fixed.items).toEqual(["The ball is ___ the boxes.", "The ball is ___ the box."]);
    expect(fixed.answerKey).toEqual(["between", "behind"]);
  });
});

describe("activity checks from the live run", () => {
  it("flag word-bank answers that are not in the box and match keys that are not letters", async () => {
    const { activityIssues } = await import("./activities");
    expect(
      activityIssues({
        heading: "Building Names",
        items: ["A place for football: ___"],
        answerKey: ["stadium"],
        activity: { type: "picture_label", words: ["sports centre"], pictures: [{ label: "stadium", emoji: "⚽" }] },
      }),
    ).toEqual([expect.stringContaining('"stadium"')]);
    expect(
      activityIssues({
        heading: "Where is it?",
        items: ["behind"],
        answerKey: ["at the back of"],
        activity: { type: "picture_match", pictures: [{ label: "ball behind box", emoji: "📦" }] },
      }),
    ).toEqual([expect.stringContaining("letter")]);
  });
});

describe("deterministic backstops from the third live run", () => {
  it("answers each preposition with what its scene draws", () => {
    const fixed = fixPrepositionItems({
      heading: "Where is the ball?",
      items: ["The ball is ___ the boxes.", "The ball is ___ the box.", "The red ball is ___ the blue ball.", "The ball is ___ the box."],
      answerKey: ["between", "in", "next to", "under"],
      diagram: { type: "prepositions", scenes: ["between", "next_to", "opposite", "behind"] },
    });
    expect(fixed.answerKey).toEqual(["between", "next to", "opposite", "behind"]);
    expect(fixed.items![2]).toBe("The ball is ___ the box.");
  });

  it("names the answer the way the word bank does", async () => {
    const { reconcileWordBank } = await import("./activities");
    const block = {
      heading: "Town Places",
      items: ["A place to play football", "A place with many books"],
      answerKey: ["stadium", "library"],
      activity: { type: "picture_label" as const, words: ["library", "sports centre"] },
    };
    expect(reconcileWordBank(block).answerKey).toEqual(["sports centre", "library"]);
    const two = reconcileWordBank({ ...block, answerKey: ["stadium", "museum"] });
    expect(two.activity.words).toEqual(["library", "sports centre", "stadium", "museum"]);
  });
});
