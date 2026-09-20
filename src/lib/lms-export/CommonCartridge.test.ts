import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildCommonCartridge } from "./CommonCartridge";
import type { GeneratedUnit } from "@/lib/ai/schemas";

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
        glossary: [{ term: "Hello", definition: "A greeting" }],
      },
    ],
    workbookPages: [],
    glossary: [],
    ...overrides,
  };
}

describe("buildCommonCartridge", () => {
  it("produces a valid zip with a manifest and per-unit HTML", async () => {
    const buffer = await buildCommonCartridge({
      bookTitle: "My Coursebook",
      variant: "student_book",
      units: [makeUnit()],
      level: "A1",
    });

    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(["imsmanifest.xml", "unit-1.html"]));

    const manifest = await zip.file("imsmanifest.xml")!.async("string");
    expect(manifest).toContain("IMS Common Cartridge");
    expect(manifest).toContain('identifierref="RES-1"');
    expect(manifest).toContain('<resource identifier="RES-1"');
  });

  it("escapes special characters in unit titles", async () => {
    const buffer = await buildCommonCartridge({
      bookTitle: "My Coursebook",
      variant: "student_book",
      units: [makeUnit({ title: "A & B <Unit>" })],
      level: "A1",
    });
    const zip = await JSZip.loadAsync(buffer);
    const html = await zip.file("unit-1.html")!.async("string");
    expect(html).toContain("A &amp; B &lt;Unit&gt;");
  });

  it("omits the answer key for student_book but includes it for workbook", async () => {
    const unit = makeUnit();
    const studentBuffer = await buildCommonCartridge({
      bookTitle: "My Coursebook",
      variant: "student_book",
      units: [unit],
      level: "A1",
    });
    const studentZip = await JSZip.loadAsync(studentBuffer);
    const studentHtml = await studentZip.file("unit-1.html")!.async("string");
    expect(studentHtml).not.toContain("answer-key");

    const workbookUnit = makeUnit({ workbookPages: unit.studentBookPages, studentBookPages: [] });
    const workbookBuffer = await buildCommonCartridge({
      bookTitle: "My Coursebook",
      variant: "workbook",
      units: [workbookUnit],
      level: "A1",
    });
    const workbookZip = await JSZip.loadAsync(workbookBuffer);
    const workbookHtml = await workbookZip.file("unit-1.html")!.async("string");
    expect(workbookHtml).toContain("answer-key");
  });

  it("skips units with no pages for the requested variant", async () => {
    const buffer = await buildCommonCartridge({
      bookTitle: "My Coursebook",
      variant: "teacher_book",
      units: [makeUnit()],
      level: "A1",
    });
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file("unit-1.html")).toBeNull();
  });
});
