import { describe, expect, it } from "vitest";
import { unitsToMarkdown } from "./markdown";
import type { GeneratedUnit } from "./ai/schemas";

function makeUnit(overrides: Partial<GeneratedUnit> = {}): GeneratedUnit {
  return {
    unitNumber: 1,
    title: "Getting Started",
    studentBookPages: [
      {
        sourcePageNumber: 1,
        pageType: "content",
        unitNumber: 1,
        blocks: [
          {
            kind: "explanation",
            heading: "Greetings",
            body: "Learn how to say hello.",
            items: ["Hello", "Hi"],
            answerKey: ["Hello - a greeting", "Hi - an informal greeting"],
          },
        ],
      },
    ],
    workbookPages: [],
    glossary: [],
    ...overrides,
  };
}

describe("unitsToMarkdown", () => {
  it("includes the book title and variant label in the header", () => {
    const md = unitsToMarkdown("My Coursebook", [makeUnit()], "student_book");
    expect(md).toContain("# My Coursebook — Student Book");
  });

  it("numbers practice items and renders each unit's heading", () => {
    const md = unitsToMarkdown("My Coursebook", [makeUnit()], "student_book");
    expect(md).toContain("## Unit 1: Getting Started");
    expect(md).toContain("1. Hello");
    expect(md).toContain("2. Hi");
  });

  it("shows the answer key for workbook and teacher_book variants but not student_book", () => {
    const unit = makeUnit({ workbookPages: makeUnit().studentBookPages });

    const studentMd = unitsToMarkdown("Book", [unit], "student_book");
    expect(studentMd).not.toContain("Answer key");

    const workbookMd = unitsToMarkdown("Book", [unit], "workbook");
    expect(workbookMd).toContain("Answer key");
  });

  it("separates multiple units with a horizontal rule", () => {
    const unitTwo = makeUnit({ unitNumber: 2, title: "Numbers" });
    const md = unitsToMarkdown("Book", [makeUnit(), unitTwo], "student_book");
    expect(md).toContain("---");
    expect(md).toContain("## Unit 2: Numbers");
  });

  it("falls back to an empty page list for a variant the unit doesn't have (e.g. no Test Booklet requested)", () => {
    const md = unitsToMarkdown("Book", [makeUnit()], "test_booklet");
    expect(md).toContain("# Book — Test Booklet");
    expect(md).not.toContain("Greetings");
  });
});
