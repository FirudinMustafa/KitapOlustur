import { describe, expect, it } from "vitest";
import { findMatches } from "./search";
import type { GeneratedUnit } from "@/lib/ai/schemas";

function makeUnit(overrides: Partial<GeneratedUnit> = {}): GeneratedUnit {
  return {
    unitNumber: 1,
    title: "Past Perfect Tense",
    studentBookPages: [
      {
        sourcePageNumber: 1,
        pageType: "content",
        unitNumber: 1,
        blocks: [
          {
            kind: "explanation",
            heading: "Using the Past Perfect",
            body: "We use the past perfect to describe an action completed before another past action.",
          },
        ],
        glossary: [{ term: "had gone", definition: "past perfect form of 'go'" }],
      },
    ],
    workbookPages: [],
    glossary: [],
    ...overrides,
  };
}

describe("findMatches", () => {
  it("matches unit titles case-insensitively", () => {
    const results = findMatches("p1", "My Book", "student_book", [makeUnit()], "past perfect");
    expect(results.some((r) => r.field === "unitTitle")).toBe(true);
  });

  it("matches block headings and bodies", () => {
    const results = findMatches("p1", "My Book", "student_book", [makeUnit()], "completed before");
    expect(results.some((r) => r.field === "blockBody")).toBe(true);
  });

  it("matches glossary terms and definitions", () => {
    const results = findMatches("p1", "My Book", "student_book", [makeUnit()], "had gone");
    expect(results.some((r) => r.field === "glossary")).toBe(true);
  });

  it("returns no matches for an unrelated query", () => {
    const results = findMatches("p1", "My Book", "student_book", [makeUnit()], "xylophone");
    expect(results).toHaveLength(0);
  });

  it("does not throw on legacy content missing newer fields (pre-schema-change rows)", () => {
    const legacyUnit = { unitNumber: 1 } as unknown as GeneratedUnit;
    expect(() => findMatches("p1", "My Book", "student_book", [legacyUnit], "anything")).not.toThrow();
  });

  it("includes projectId/projectName/bookType on every result", () => {
    const results = findMatches("p1", "My Book", "workbook", [makeUnit()], "past perfect");
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.projectId).toBe("p1");
      expect(r.projectName).toBe("My Book");
      expect(r.bookType).toBe("workbook");
    }
  });
});
