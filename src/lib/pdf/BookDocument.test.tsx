import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { BookDocument } from "./BookDocument";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import type { CourseUnitSummary } from "./ContentsDocument";

// Smoke test for the ISBN/baskıya hazırlık barcode integration (2026-09-20,
// ROADMAP.md) - renders a real PDF via the same renderToBuffer call
// workflows/book-pipeline.tsx uses, with a valid ISBN, and confirms it
// produces a real PDF without throwing. The barcode's own bit-pattern
// correctness is covered by src/lib/barcode/ean13.test.ts; this just proves
// the prop wiring (BookDocument -> ImprintPage -> Barcode) doesn't crash
// react-pdf's renderer.
function makeUnit(): GeneratedUnit {
  return {
    unitNumber: 1,
    title: "Getting Started",
    studentBookPages: [
      {
        sourcePageNumber: 1,
        pageType: "content",
        unitNumber: 1,
        blocks: [{ kind: "explanation", heading: "Greetings", body: "Learn how to say hello." }],
        glossary: [],
      },
    ],
    workbookPages: [],
    glossary: [],
  };
}

const contentsUnits: CourseUnitSummary[] = [
  { number: 1, title: "Getting Started", topic: "Greetings", keyTerms: "Hello", objectives: "Say hello", level: "A1" },
];

describe("BookDocument with ISBN", () => {
  it("renders a valid PDF when a valid ISBN is provided", async () => {
    const buffer = await renderToBuffer(
      <BookDocument
        bookTitle="My Coursebook"
        variant="student_book"
        units={[makeUnit()]}
        level="A1"
        contentsUnits={contentsUnits}
        isbn="9780306406157"
      />,
    );
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("renders a valid PDF when the ISBN is invalid (barcode silently omitted)", async () => {
    const buffer = await renderToBuffer(
      <BookDocument
        bookTitle="My Coursebook"
        variant="student_book"
        units={[makeUnit()]}
        level="A1"
        contentsUnits={contentsUnits}
        isbn="not-a-real-isbn"
      />,
    );
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("renders a valid PDF with no ISBN at all", async () => {
    const buffer = await renderToBuffer(
      <BookDocument
        bookTitle="My Coursebook"
        variant="student_book"
        units={[makeUnit()]}
        level="A1"
        contentsUnits={contentsUnits}
      />,
    );
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
