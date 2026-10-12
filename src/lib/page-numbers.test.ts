import { describe, expect, it } from "vitest";
import { renumberSidePages } from "./page-numbers";

describe("renumberSidePages", () => {
  it("gives each side its own range so pictures never collide", () => {
    const modelNumbered = [{ sourcePageNumber: 1 }, { sourcePageNumber: 1 }, { sourcePageNumber: 2 }];
    const workbook = renumberSidePages(modelNumbered, 2, "complementary").map((p) => p.sourcePageNumber);
    const teacher = renumberSidePages(modelNumbered, 2, "teacher").map((p) => p.sourcePageNumber);
    const test = renumberSidePages(modelNumbered, 2, "test").map((p) => p.sourcePageNumber);
    const all = [...workbook, ...teacher, ...test];
    expect(new Set(all).size).toBe(all.length);
    expect(workbook).toEqual([2300, 2301, 2302]);
    // never overlaps a mirrored source page (< 1000) or a skeleton page (unit * 1000 + i)
    expect(all.every((n) => n >= 2300)).toBe(true);
  });
});
