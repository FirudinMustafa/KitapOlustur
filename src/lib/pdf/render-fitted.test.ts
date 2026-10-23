import { describe, expect, it } from "vitest";
import { pageOf, withUnitPages } from "./render-fitted";
import { pageRangeLabel } from "./ContentsDocument";

const unit = (number: number) => ({ number, title: `U${number}`, topic: "", keyTerms: "", objectives: "", level: "A1" });

describe("withUnitPages", () => {
  it("gives each unit the pages up to the next unit or the answer key", () => {
    const starts = { cover: 1, "1:0": 4, "1:1": 5, "1:2": 7, "2:0": 8, "2:1": 9, answer_key: 11 };
    const units = withUnitPages([unit(1), unit(2)], starts)!;
    expect(units.map((u) => u.pages)).toEqual([
      { from: 4, to: 7 },
      { from: 8, to: 10 },
    ]);
    expect(units.map((u) => pageRangeLabel(u.pages))).toEqual(["pp. 4-7", "pp. 8-10"]);
  });

  it("is null when no unit page was laid out", () => {
    expect(withUnitPages([unit(1)], { cover: 1 })).toBeNull();
  });
});

describe("sheet keys", () => {
  it("map a workbook page's later sheets back to the page and leave the unit ranges alone", () => {
    expect(pageOf("1:2/1")).toBe("1:2");
    expect(pageOf("1:2")).toBe("1:2");
    const units = withUnitPages([unit(1), unit(2)], { "1:0": 4, "1:0/1": 5, "2:0": 6, "2:0/1": 7 })!;
    expect(units.map((u) => u.pages)).toEqual([
      { from: 4, to: 5 },
      { from: 6, to: 7 },
    ]);
  });
});
