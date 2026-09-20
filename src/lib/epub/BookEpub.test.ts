import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildEpub } from "./BookEpub";
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

describe("buildEpub", () => {
  it("produces a valid zip with the required EPUB structure", async () => {
    const buffer = await buildEpub({
      bookTitle: "My Coursebook",
      variant: "student_book",
      units: [makeUnit()],
      level: "A1",
      contentsUnits,
    });

    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining([
        "mimetype",
        "META-INF/container.xml",
        "OEBPS/content.opf",
        "OEBPS/nav.xhtml",
        "OEBPS/contents.xhtml",
        "OEBPS/unit-1.xhtml",
      ]),
    );

    const mimetype = await zip.file("mimetype")!.async("string");
    expect(mimetype).toBe("application/epub+zip");
  });

  it("escapes special characters in generated text", async () => {
    const buffer = await buildEpub({
      bookTitle: "My <Coursebook> & Co",
      variant: "student_book",
      units: [makeUnit({ title: "A & B <Unit>" })],
      level: "A1",
      contentsUnits,
    });

    const zip = await JSZip.loadAsync(buffer);
    const unitXhtml = await zip.file("OEBPS/unit-1.xhtml")!.async("string");
    expect(unitXhtml).toContain("A &amp; B &lt;Unit&gt;");
    expect(unitXhtml).not.toContain("A & B <Unit>");
  });

  it("includes the answer key section only for workbook/teacher_book variants", async () => {
    const studentBuffer = await buildEpub({
      bookTitle: "My Coursebook",
      variant: "student_book",
      units: [makeUnit()],
      level: "A1",
      contentsUnits,
    });
    const studentZip = await JSZip.loadAsync(studentBuffer);
    expect(studentZip.file("OEBPS/answer-key.xhtml")).toBeNull();

    const workbookBuffer = await buildEpub({
      bookTitle: "My Coursebook",
      variant: "workbook",
      units: [makeUnit({ workbookPages: makeUnit().studentBookPages, studentBookPages: [] })],
      level: "A1",
      contentsUnits,
    });
    const workbookZip = await JSZip.loadAsync(workbookBuffer);
    expect(workbookZip.file("OEBPS/answer-key.xhtml")).not.toBeNull();
  });

  it("skips units that have no pages for the requested variant", async () => {
    const buffer = await buildEpub({
      bookTitle: "My Coursebook",
      variant: "teacher_book",
      units: [makeUnit()],
      level: "A1",
      contentsUnits,
    });
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file("OEBPS/unit-1.xhtml")).toBeNull();
  });
});
