import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildDocx } from "./BookDocx";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import type { CourseUnitSummary } from "@/lib/pdf/ContentsDocument";

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
            body: "Learn how to say hello.\nIt's easy.",
            items: ["Hello", "Hi"],
            answerKey: ["Hello - a greeting", "Hi - an informal greeting"],
          },
        ],
        glossary: [{ term: "Hello", definition: "A greeting", example: "Hello, friend!" }],
      },
    ],
    workbookPages: [],
    glossary: [],
    ...overrides,
  };
}

const contentsUnits: CourseUnitSummary[] = [
  { number: 1, title: "Getting Started", topic: "Greetings", keyTerms: "Hello, Hi", objectives: "Say hello", level: "A1" },
];

async function documentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  return zip.file("word/document.xml")!.async("string");
}

describe("buildDocx", () => {
  it("produces a valid docx (zip with the required OOXML parts)", async () => {
    const buffer = await buildDocx({
      bookTitle: "My Coursebook",
      variant: "student_book",
      units: [makeUnit()],
      level: "A1",
      contentsUnits,
    });

    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining(["[Content_Types].xml", "word/document.xml", "_rels/.rels"]),
    );
  });

  it("includes unit and block content, escaped for XML", async () => {
    const buffer = await buildDocx({
      bookTitle: "My <Coursebook> & Co",
      variant: "student_book",
      units: [makeUnit({ title: "A & B <Unit>" })],
      level: "A1",
      contentsUnits,
    });

    const xml = await documentXml(buffer);
    expect(xml).toContain("Getting Started");
    expect(xml).toContain("A &amp; B &lt;Unit&gt;");
    expect(xml).not.toContain("A & B <Unit>");
  });

  it("includes the answer key only for workbook/teacher_book variants", async () => {
    const studentBuffer = await buildDocx({
      bookTitle: "My Coursebook",
      variant: "student_book",
      units: [makeUnit()],
      level: "A1",
      contentsUnits,
    });
    const studentXml = await documentXml(studentBuffer);
    expect(studentXml).not.toContain("ANSWER KEY");

    const workbookBuffer = await buildDocx({
      bookTitle: "My Coursebook",
      variant: "workbook",
      units: [makeUnit({ workbookPages: makeUnit().studentBookPages, studentBookPages: [] })],
      level: "A1",
      contentsUnits,
    });
    const workbookXml = await documentXml(workbookBuffer);
    expect(workbookXml).toContain("ANSWER KEY");
  });

  it("skips units that have no pages for the requested variant", async () => {
    const buffer = await buildDocx({
      bookTitle: "My Coursebook",
      variant: "teacher_book",
      units: [makeUnit()],
      level: "A1",
      contentsUnits: [],
    });
    const xml = await documentXml(buffer);
    expect(xml).not.toContain("Getting Started");
  });

  it("omits the contents table when no contentsUnits are given", async () => {
    const buffer = await buildDocx({
      bookTitle: "My Coursebook",
      variant: "student_book",
      units: [makeUnit()],
      level: "A1",
      contentsUnits: [],
    });
    const xml = await documentXml(buffer);
    expect(xml).not.toContain("Key terms");
  });
});

describe("buildDocx - content added after the audit", () => {
  it("keeps dialogues, tables and puzzle grids", async () => {
    const unit = makeUnit({
      studentBookPages: [
        {
          sourcePageNumber: 1,
          pageType: "content",
          unitNumber: 1,
          blocks: [
            { kind: "explanation", heading: "At the shop", body: "", dialogue: [{ speaker: "Ann", line: "Can I help you?" }], table: { headers: ["I", "you"], rows: [["am", "are"]] } },
            { kind: "practice", heading: "Unscramble", body: "", items: ["a pet"], answerKey: ["kitten"], activity: { type: "unscramble" } },
            { kind: "practice", heading: "Find the words", body: "", items: ["cat", "dog"], answerKey: ["cat", "dog"], activity: { type: "wordsearch" } },
          ],
        },
      ],
    });
    const xml = await documentXml(await buildDocx({ bookTitle: "B", variant: "student_book", units: [unit], level: "A1", contentsUnits }));
    expect(xml).toContain("Ann: ");
    expect(xml).toContain("Can I help you?");
    expect(xml).toContain(">you<");
    expect(xml).not.toContain(">1. a pet<"); // printed as an unscramble line, not a plain item
    expect((xml.match(/<w:tbl>/g) ?? []).length).toBeGreaterThanOrEqual(3); // contents, table, word search grid
  });
});
