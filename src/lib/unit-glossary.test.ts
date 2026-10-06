import { describe, expect, it } from "vitest";
import type { GeneratedPage, GeneratedUnit } from "@/lib/ai/schemas";
import { withUnitGlossary } from "./unit-glossary";

const page = (n: number, glossary?: GeneratedPage["glossary"]): GeneratedPage => ({
  sourcePageNumber: n,
  pageType: "content",
  unitNumber: 1,
  blocks: [],
  glossary,
});

const unit = (glossary: GeneratedUnit["glossary"], pages: GeneratedPage[]): GeneratedUnit => ({
  unitNumber: 1,
  title: "U",
  studentBookPages: pages,
  workbookPages: [],
  glossary,
});

describe("withUnitGlossary", () => {
  it("appends unit glossary entries missing from every page to the last page", () => {
    const pages = [page(1, [{ term: "Kedi", definition: "a" }]), page(2)];
    const u = unit(
      [
        { term: "kedi", definition: "dup (case-insensitive)" },
        { term: "Köpek", definition: "b" },
      ],
      pages,
    );
    const out = withUnitGlossary(u, pages, "student_book");
    expect(out[0]).toBe(pages[0]);
    expect(out[1].glossary?.map((g) => g.term)).toEqual(["Köpek"]);
  });

  it("does not mutate the input pages", () => {
    const pages = [page(1)];
    withUnitGlossary(unit([{ term: "X", definition: "y" }], pages), pages, "workbook");
    expect(pages[0].glossary).toBeUndefined();
  });

  it("leaves test booklets and empty inputs alone", () => {
    const pages = [page(1)];
    const u = unit([{ term: "X", definition: "y" }], pages);
    expect(withUnitGlossary(u, pages, "test_booklet")).toBe(pages);
    expect(withUnitGlossary(u, [], "student_book")).toEqual([]);
    expect(withUnitGlossary(unit([], pages), pages, "student_book")).toBe(pages);
  });
});
