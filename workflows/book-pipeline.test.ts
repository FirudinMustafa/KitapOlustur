import { describe, expect, it } from "vitest";
import { buildContentsUnits } from "./book-pipeline";
import type { BookOutline } from "@/lib/ai/schemas";

// buildContentsUnits is pure (no DB/AI calls), exported from book-pipeline.tsx
// specifically so it's testable in isolation - see ROADMAP.md Faz G2. The
// rest of the pipeline's steps call generateObject/generateImage/db and
// aren't covered here; mocking those is future Faz G2 work.

function makeOutline(units: BookOutline["units"]): BookOutline {
  return {
    bookTitle: "Test Book",
    subject: "English Language Teaching",
    contentLanguage: "en",
    level: "A2",
    tone: "friendly",
    targetAudience: "teens",
    units,
  };
}

describe("buildContentsUnits", () => {
  it("maps one outline unit per contents entry, in order", () => {
    const outline = makeOutline([
      {
        number: 1,
        title: "Introductions",
        level: "A2",
        sourcePageRange: { start: 1, end: 6 },
        learningObjectives: ["Greet people", "Ask names"],
        keyTerms: ["hello", "name"],
      },
      {
        number: 2,
        title: "Numbers",
        level: "A2",
        sourcePageRange: { start: 7, end: 12 },
        learningObjectives: ["Count to 20"],
        keyTerms: ["one", "two"],
      },
    ]);

    const result = buildContentsUnits(outline);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      number: 1,
      title: "Introductions",
      topic: "Greet people",
      keyTerms: "hello, name",
      objectives: "Greet people; Ask names",
      level: "A2",
    });
  });

  it("uses an empty topic when a unit has no learning objectives", () => {
    const outline = makeOutline([
      {
        number: 1,
        title: "Filler",
        level: "A2",
        sourcePageRange: { start: 1, end: 1 },
        learningObjectives: [],
        keyTerms: [],
      },
    ]);

    const [entry] = buildContentsUnits(outline);
    expect(entry.topic).toBe("");
    expect(entry.keyTerms).toBe("");
  });

  it("returns an empty array for a book with no units", () => {
    expect(buildContentsUnits(makeOutline([]))).toEqual([]);
  });
});
