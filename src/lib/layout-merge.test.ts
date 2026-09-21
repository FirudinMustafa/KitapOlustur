import { describe, expect, it } from "vitest";
import { mergePageLayout } from "./layout-merge";
import type { GeneratedUnit } from "./ai/schemas";

function makeUnit(unitNumber: number): GeneratedUnit {
  return {
    unitNumber,
    title: `Unit ${unitNumber}`,
    studentBookPages: [
      {
        sourcePageNumber: 1,
        pageType: "content",
        unitNumber,
        blocks: [{ kind: "explanation", heading: "A", body: "Body A" }],
      },
      {
        sourcePageNumber: 2,
        pageType: "content",
        unitNumber,
        blocks: [{ kind: "practice", heading: "B", body: "Body B" }],
      },
    ],
    workbookPages: [
      { sourcePageNumber: 1, pageType: "exercise", unitNumber, blocks: [{ kind: "practice", heading: "C", body: "Body C" }] },
    ],
    glossary: [],
  };
}

describe("mergePageLayout", () => {
  it("updates only the targeted page's blocks", () => {
    const units = [makeUnit(1), makeUnit(2)];
    const newBlocks = [
      { kind: "explanation" as const, heading: "A", body: "Body A", layout: { x: 10, y: 20, width: 200, height: 80 } },
    ];
    const result = mergePageLayout(units, 1, "studentBookPages", 0, newBlocks);

    expect(result[0].studentBookPages[0].blocks).toEqual(newBlocks);
    // untouched sibling page in the same unit
    expect(result[0].studentBookPages[1].blocks[0].heading).toBe("B");
    // untouched other book type in the same unit
    expect(result[0].workbookPages[0].blocks[0].heading).toBe("C");
    // untouched other unit entirely
    expect(result[1]).toEqual(units[1]);
  });

  it("sets imageLayout on the page when provided", () => {
    const units = [makeUnit(1)];
    const layout = { x: 0, y: 0, width: 300, height: 150 };
    const result = mergePageLayout(units, 1, "studentBookPages", 0, units[0].studentBookPages[0].blocks, layout);
    expect(result[0].studentBookPages[0].imageLayout).toEqual(layout);
  });

  it("throws for a unit number that doesn't exist", () => {
    const units = [makeUnit(1)];
    expect(() => mergePageLayout(units, 99, "studentBookPages", 0, [])).toThrow(/Ünite 99/);
  });

  it("throws for a page index out of range", () => {
    const units = [makeUnit(1)];
    expect(() => mergePageLayout(units, 1, "studentBookPages", 5, [])).toThrow(/sayfası bulunamadı/);
  });

  it("throws for a page array field the unit doesn't have", () => {
    const units = [makeUnit(1)];
    expect(() => mergePageLayout(units, 1, "teacherBookPages", 0, [])).toThrow(/sayfası bulunamadı/);
  });

  it("does not mutate the input array (returns a new array/objects)", () => {
    const units = [makeUnit(1)];
    const original = JSON.parse(JSON.stringify(units));
    mergePageLayout(units, 1, "studentBookPages", 0, [{ kind: "explanation", heading: "Changed", body: "x" }]);
    expect(units).toEqual(original);
  });
});
