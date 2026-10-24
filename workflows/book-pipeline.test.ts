import { describe, expect, it } from "vitest";
import { buildContentsUnits, validateUnitStructure, applyFallbackImagePrompts } from "./book-pipeline";
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

  it("flags a numbered exercise list written as prose in body instead of items", () => {
    const unit = makeUnit({
      workbookPages: [
        makePage({
          blocks: [
            {
              kind: "practice",
              heading: "Boşlukları Doldur",
              body: "1. Kedi ____ der.\n2. Köpek ____ havlar.\n3. İnek ____ der.",
            },
          ],
        }),
      ],
    });
    const issues = validateUnitStructure(unit);
    expect(issues.some((i) => i.includes("Boşlukları Doldur") && i.includes("plain text"))).toBe(true);
  });

  it("does not flag body text with a single numbered mention (not a list)", () => {
    const unit = makeUnit({
      workbookPages: [makePage({ blocks: [{ kind: "explanation", heading: "Not", body: "1. sınıf öğrencileri için hazırlanmıştır." }] })],
    });
    expect(validateUnitStructure(unit)).toEqual([]);
  });

  // KIYAS-14 jury: "Point to Misty. Point to Leo." - the source's own mascot.
  it("sends back a page with the source's character, and a mirrored page that follows its source item by item", () => {
    const names = { characters: ["Misty"], names: ["Misty"], features: [] };
    const story = makePage({ sourcePageNumber: 5, blocks: [{ kind: "narrative", heading: "1 Watch and listen", body: "Point to Misty. Point to Leo." }] });
    expect(validateUnitStructure(makeUnit({ studentBookPages: [story] }), undefined, "", { names }).some((i) => i.includes('"Misty"'))).toBe(true);

    const sourceText = "1 Where’s the Park Hotel?\n2 Where’s the post office?\n3 Is there a bank near here?\n4 How do I get to the museum?\n5 Is the café next to the cinema?";
    const mirrored = makePage({
      sourcePageNumber: 5,
      blocks: [{ kind: "practice", heading: "1 Ask and answer", body: "", items: ["Where's the bus station?", "Where's the library?", "Is there a park near here?", "How do I get to the zoo?", "Is the shop next to the school?"], answerKey: ["a", "b", "c", "d", "e"] }],
    });
    const issues = validateUnitStructure(makeUnit({ studentBookPages: [mirrored] }), undefined, "", { pages: [{ pageNumber: 5, sourceText }] });
    expect(issues.some((i) => i.includes("mirrors its source page too closely"))).toBe(true);
    // A complementary page (renumbered) is not compared with source page 5.
    expect(validateUnitStructure(makeUnit({ workbookPages: [{ ...mirrored, sourcePageNumber: 305 }] }), undefined, "", { pages: [{ pageNumber: 5, sourceText }] })).toEqual([]);
  });
});

describe("applyFallbackImagePrompts", () => {
  it("fills imagePrompt on a page that references an image but has none", () => {
    const unit = makeUnit({
      studentBookPages: [
        makePage({ blocks: [{ kind: "practice", heading: "Hayvanları Say", body: "Resimdeki hayvanları say.", items: ["Kaç tane?"], answerKey: ["4"] }] }),
      ],
    });
    const result = applyFallbackImagePrompts(unit);
    expect(result.studentBookPages[0].imagePrompt).toBeTruthy();
    expect(result.studentBookPages[0].imagePrompt).toContain("Hayvanları Say");
  });

  it("never overwrites an imagePrompt the model already set", () => {
    const unit = makeUnit({
      studentBookPages: [
        makePage({
          imagePrompt: "A friendly farm scene with a cow and a cat.",
          blocks: [{ kind: "practice", heading: "Hayvanları Say", body: "Resimdeki hayvanları say." }],
        }),
      ],
    });
    const result = applyFallbackImagePrompts(unit);
    expect(result.studentBookPages[0].imagePrompt).toBe("A friendly farm scene with a cow and a cat.");
  });

  it("leaves pages that don't reference an image untouched", () => {
    const unit = makeUnit({
      studentBookPages: [makePage({ blocks: [{ kind: "explanation", heading: "Giriş", body: "Bu ünitede sayıları öğreneceğiz." }] })],
    });
    const result = applyFallbackImagePrompts(unit);
    expect(result.studentBookPages[0].imagePrompt).toBeUndefined();
  });

  it("is a no-op for undefined optional page arrays", () => {
    const unit = makeUnit();
    const result = applyFallbackImagePrompts(unit);
    expect(result.teacherBookPages).toBeUndefined();
    expect(result.testBookletPages).toBeUndefined();
  });
});
