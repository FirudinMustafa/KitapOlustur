import { describe, expect, it } from "vitest";
import { buildContentsUnits, validateUnitStructure } from "./book-pipeline";
import type { BookOutline, GeneratedPage, GeneratedUnit } from "@/lib/ai/schemas";

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

function makePage(overrides: Partial<GeneratedPage> = {}): GeneratedPage {
  return {
    sourcePageNumber: 1,
    pageType: "exercise",
    unitNumber: 1,
    blocks: [],
    ...overrides,
  };
}

function makeUnit(overrides: Partial<GeneratedUnit> = {}): GeneratedUnit {
  return {
    unitNumber: 1,
    title: "Test Unit",
    studentBookPages: [],
    workbookPages: [],
    glossary: [],
    ...overrides,
  };
}

describe("validateUnitStructure", () => {
  it("returns no issues for a unit with no pages", () => {
    expect(validateUnitStructure(makeUnit())).toEqual([]);
  });

  it("returns no issues when items and answerKey are the same length", () => {
    const unit = makeUnit({
      workbookPages: [
        makePage({
          blocks: [{ kind: "practice", heading: "Sayıları Yaz", body: "Rakamları yaz.", items: ["1", "2"], answerKey: ["bir", "iki"] }],
        }),
      ],
    });
    expect(validateUnitStructure(unit)).toEqual([]);
  });

  it("flags a block whose answerKey count doesn't match its items count", () => {
    const unit = makeUnit({
      workbookPages: [
        makePage({
          sourcePageNumber: 3,
          blocks: [{ kind: "practice", heading: "Sayıları Yaz", body: "Rakamları yaz.", items: ["1", "2", "3"], answerKey: ["bir"] }],
        }),
      ],
    });
    const issues = validateUnitStructure(unit);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/Workbook, page 3, block "Sayıları Yaz"/);
    expect(issues[0]).toMatch(/3 items but 1 answerKey/);
  });

  it("flags a page whose exercise text references an image but has no imagePrompt", () => {
    const unit = makeUnit({
      studentBookPages: [
        makePage({
          sourcePageNumber: 5,
          blocks: [{ kind: "practice", heading: "Nesneleri Say", body: "Resimdeki elmaları say ve yaz.", items: ["Kaç elma var?"], answerKey: ["3"] }],
        }),
      ],
    });
    const issues = validateUnitStructure(unit);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/Student Book, page 5/);
    expect(issues[0]).toMatch(/imagePrompt is not set/);
  });

  it("does not flag an image-referencing page that already has imagePrompt set", () => {
    const unit = makeUnit({
      studentBookPages: [
        makePage({
          imagePrompt: "Three red apples on a wooden table.",
          blocks: [{ kind: "practice", heading: "Nesneleri Say", body: "Resimdeki elmaları say ve yaz.", items: ["Kaç elma var?"], answerKey: ["3"] }],
        }),
      ],
    });
    expect(validateUnitStructure(unit)).toEqual([]);
  });

  it("checks teacher book and test booklet pages too", () => {
    const unit = makeUnit({
      teacherBookPages: [makePage({ blocks: [{ kind: "assessment", heading: "Quiz", body: "Answer the questions.", items: ["Q1"], answerKey: [] }] })],
      testBookletPages: [makePage({ blocks: [{ kind: "assessment", heading: "Test", body: "Look at the picture and answer." }] })],
    });
    const issues = validateUnitStructure(unit);
    expect(issues.some((i) => i.startsWith("Teacher's Book"))).toBe(true);
    expect(issues.some((i) => i.startsWith("Test Booklet"))).toBe(true);
  });
});
