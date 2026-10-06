import { describe, expect, it } from "vitest";
import { blocksForRender, clampLayoutToPage, mergePageLayout, withDefaultLayouts } from "./layout-merge";
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

describe("blocksForRender", () => {
  const block = (heading: string, layout?: { x: number; y: number; width: number; height: number }) => ({
    kind: "explanation" as const,
    heading,
    body: "b",
    ...(layout ? { layout } : {}),
  });
  const page = (blocks: ReturnType<typeof block>[]) => ({
    sourcePageNumber: 1,
    pageType: "content" as const,
    unitNumber: 1,
    blocks,
  });

  it("leaves fully unpositioned pages in normal flow", () => {
    const p = page([block("a"), block("b")]);
    expect(blocksForRender(p)).toBe(p.blocks);
  });

  it("renders partially positioned (legacy) pages fully in flow", () => {
    const out = blocksForRender(page([block("a"), block("b", { x: 1, y: 300, width: 100, height: 50 }), block("c")]));
    expect(out.map((x) => x.heading)).toEqual(["a", "b", "c"]);
    expect(out.some((x) => x.layout)).toBe(false);
  });

  it("keeps fully positioned pages as arranged", () => {
    const p = page([block("a", { x: 1, y: 1, width: 10, height: 10 }), block("b", { x: 1, y: 20, width: 10, height: 10 })]);
    expect(blocksForRender(p)).toBe(p.blocks);
  });
});

describe("clampLayoutToPage", () => {
  it("keeps boxes that already fit unchanged", () => {
    expect(clampLayoutToPage({ x: 44, y: 100, width: 200, height: 100 }, 595, 842)).toEqual({
      x: 44,
      y: 100,
      width: 200,
      height: 100,
    });
  });

  it("pulls boxes that overflow the page back inside it", () => {
    expect(clampLayoutToPage({ x: 500, y: 800, width: 507, height: 130 }, 595, 842)).toEqual({
      x: 88,
      y: 712,
      width: 507,
      height: 130,
    });
    expect(clampLayoutToPage({ x: -10, y: -5, width: 900, height: 2000 }, 595, 842)).toEqual({
      x: 0,
      y: 0,
      width: 595,
      height: 842,
    });
  });
});

describe("withDefaultLayouts", () => {
  it("keeps every default slot inside the page even for block-heavy pages", () => {
    const blocks = Array.from({ length: 8 }, (_, i) => ({ kind: "explanation" as const, heading: `b${i}`, body: "x" }));
    const out = withDefaultLayouts({ sourcePageNumber: 1, pageType: "content", unitNumber: 1, blocks });
    const last = out[out.length - 1].layout;
    expect(last.y + last.height).toBeLessThanOrEqual(841.89 - 56 + 1);
    expect(out.every((b) => b.layout.height >= 40)).toBe(true);
  });

  it("keeps the roomy 130pt slot for short pages", () => {
    const out = withDefaultLayouts({
      sourcePageNumber: 1,
      pageType: "content",
      unitNumber: 1,
      blocks: [{ kind: "explanation", heading: "a", body: "x" }],
    });
    expect(out[0].layout.height).toBe(130);
  });
});
