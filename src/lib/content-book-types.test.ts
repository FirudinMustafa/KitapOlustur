import { describe, expect, it } from "vitest";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import { bookTypesWithContent } from "./content-book-types";

const page = { sourcePageNumber: 1, pageType: "content" as const, unitNumber: 1, blocks: [] };

describe("bookTypesWithContent", () => {
  it("lists only the book types that have pages", () => {
    const units = [
      { unitNumber: 1, title: "U", studentBookPages: [page], workbookPages: [], glossary: [] },
      { unitNumber: 2, title: "V", studentBookPages: [], workbookPages: [page], testBookletPages: [page], glossary: [] },
    ] as GeneratedUnit[];
    expect(bookTypesWithContent(units)).toEqual(["student_book", "workbook", "test_booklet"]);
  });

  it("handles missing content", () => {
    expect(bookTypesWithContent(null)).toEqual([]);
  });
});
