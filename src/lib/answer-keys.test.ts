import { describe, expect, it } from "vitest";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import { applyAnswerKeys, findAnswerKeyGaps } from "./answer-keys";

const unit = {
  unitNumber: 1,
  title: "Town",
  studentBookPages: [],
  workbookPages: [
    {
      sourcePageNumber: 1,
      pageType: "practice",
      blocks: [
        { kind: "practice", heading: "Where is it?", body: "Choose.", items: ["The ball is ___ the box.", "The cat is ___ the bed."] },
        { kind: "practice", heading: "Done", body: "", items: ["a"], answerKey: ["b"] },
        { kind: "practice", heading: "I can...", body: "", items: ["I can name places in my town."] },
      ],
    },
  ],
} as unknown as GeneratedUnit;

describe("answer-key backfill", () => {
  it("finds only exercises that would print without matching answers", () => {
    const gaps = findAnswerKeyGaps(unit);
    expect(gaps.map((g) => g.heading)).toEqual(["Where is it?"]);
  });

  it("applies an answer list only when it has one answer per item", () => {
    const [gap] = findAnswerKeyGaps(unit);
    expect(findAnswerKeyGaps(applyAnswerKeys(unit, [{ id: gap.id, answerKey: ["in"] }]))).toHaveLength(1);
    const filled = applyAnswerKeys(unit, [{ id: gap.id, answerKey: ["in", "on"] }]);
    expect(findAnswerKeyGaps(filled)).toHaveLength(0);
    expect(filled.workbookPages[0].blocks[0].answerKey).toEqual(["in", "on"]);
    expect(filled.workbookPages[0].blocks[1].answerKey).toEqual(["b"]);
  });
});
