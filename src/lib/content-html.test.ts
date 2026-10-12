import { describe, expect, it } from "vitest";
import { renderBlockHtml, seededShuffle } from "./content-html";
import type { ContentBlock } from "@/lib/ai/schemas";

function baseBlock(overrides: Partial<ContentBlock> = {}): ContentBlock {
  return {
    kind: "practice",
    heading: "Practice",
    body: "Try this.",
    ...overrides,
  };
}

describe("renderBlockHtml with interactive exercises", () => {
  it("renders a multiple_choice question and options, hiding the correct answer by default", () => {
    const html = renderBlockHtml(
      baseBlock({
        interactive: {
          type: "multiple_choice",
          question: "What color is the sky?",
          options: ["Blue", "Green", "Red"],
          correctIndex: 0,
        },
      }),
      false,
    );
    expect(html).toContain("What color is the sky?");
    expect(html).toContain("Blue");
    expect(html).not.toContain("✓");
  });

  it("reveals the correct multiple_choice answer when showAnswerKey is true", () => {
    const html = renderBlockHtml(
      baseBlock({
        interactive: {
          type: "multiple_choice",
          question: "What color is the sky?",
          options: ["Blue", "Green", "Red"],
          correctIndex: 0,
        },
      }),
      true,
    );
    expect(html).toContain("Blue ✓");
  });

  it("prints fill_blank blanks as underscores and hides answers by default", () => {
    const html = renderBlockHtml(
      baseBlock({
        interactive: { type: "fill_blank", template: "The cat ___ on the mat.", blanks: ["sat"] },
      }),
      false,
    );
    expect(html).toContain("_____");
    expect(html).not.toContain("ANSWER KEY");
  });

  it("shows fill_blank answers when showAnswerKey is true", () => {
    const html = renderBlockHtml(
      baseBlock({
        interactive: { type: "fill_blank", template: "The cat ___ on the mat.", blanks: ["sat"] },
      }),
      true,
    );
    expect(html).toContain("ANSWER KEY");
    expect(html).toContain("sat");
  });

  it("scrambles matching pairs when not showing the answer key", () => {
    const pairs = [
      { left: "Dog", right: "Woof" },
      { left: "Cat", right: "Meow" },
      { left: "Cow", right: "Moo" },
    ];
    const html = renderBlockHtml(baseBlock({ heading: "Animal Sounds", interactive: { type: "matching", pairs } }), false);
    // Both columns' content must still be present, just not necessarily paired correctly.
    for (const p of pairs) {
      expect(html).toContain(p.left);
      expect(html).toContain(p.right);
    }
  });
});

describe("seededShuffle", () => {
  it("is deterministic for the same seed", () => {
    const a = seededShuffle([1, 2, 3, 4, 5], "unit-1");
    const b = seededShuffle([1, 2, 3, 4, 5], "unit-1");
    expect(a).toEqual(b);
  });

  it("preserves all elements", () => {
    const input = ["a", "b", "c", "d"];
    const shuffled = seededShuffle(input, "seed");
    expect(shuffled.sort()).toEqual([...input].sort());
  });
});

describe("renderBlockHtml - formats added after the audit", () => {
  it("keeps dialogues, tables and callouts", () => {
    const html = renderBlockHtml(
      {
        kind: "explanation",
        heading: "At the shop",
        body: "Listen and read.",
        dialogue: [
          { speaker: "Ann", line: "Can I help you?" },
          { speaker: "Tom", line: "Yes, please." },
        ],
        table: { headers: ["I", "you"], rows: [["am", "are"]] },
        callout: "tip",
      },
      false,
    );
    expect(html).toContain("<strong>Ann:</strong> Can I help you?");
    expect(html).toContain("<th>you</th>");
    expect(html).toContain("callout-tip");
  });

  it("draws puzzles from their answers", () => {
    const html = renderBlockHtml(
      { kind: "practice", heading: "Crossword", body: "", items: ["a pet", "it barks"], answerKey: ["cat", "dog"], activity: { type: "crossword" } },
      false,
    );
    expect(html).toContain('class="crossword"');
    expect(html).toContain("<strong>Across</strong>");
    expect(html).not.toContain(">cat<");
  });
});
