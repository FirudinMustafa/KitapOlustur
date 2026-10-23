import { describe, expect, it } from "vitest";
import { labelsFromBoxes, labelWords, withPageLabels } from "./page-labels";
import type { GeneratedPage, GeneratedUnit } from "./schemas";

const block = (items: string[]) => ({ heading: "Look and say", body: "", items }) as GeneratedPage["blocks"][number];

describe("labelWords", () => {
  it("keeps short items once, without numbering or punctuation", () => {
    const page = { blocks: [block(["1 window", "2. door", "a chair.", "Door", "What colour is the big table?", "my school bag"]), block(["teacher"])] };
    expect(labelWords(page)).toEqual(["window", "door", "a chair", "my school bag", "teacher"]);
  });

  it("stops at eight words", () => {
    expect(labelWords({ blocks: [block(Array.from({ length: 12 }, (_, i) => `word${i}`))] })).toHaveLength(8);
  });
});

describe("labelsFromBoxes", () => {
  it("turns found boxes into centre points and drops the rest", () => {
    const labels = labelsFromBoxes(["window", "door", "chair", "table", "book"], {
      labels: [
        { word: "Window", found: true, box: [100, 200, 300, 400] },
        { word: "door", found: false, box: [] },
        { word: "chair", found: true, box: [500, 500, 400, 600] }, // inverted
        { word: "table", found: true, box: [0, 0, 1000, 1000] }, // whole picture
        { word: "book", found: true, box: [900, 950, 1100, 1050] },
      ],
    });
    expect(labels).toEqual([
      { word: "window", x: 0.3, y: 0.2 },
      { word: "book", x: 1, y: 1 },
    ]);
  });
});

describe("withPageLabels", () => {
  const page = (n: number, pageType: string) => ({ sourcePageNumber: n, pageType, unitNumber: 1, blocks: [] }) as unknown as GeneratedPage;
  const unit = { unitNumber: 1, title: "School", studentBookPages: [page(7, "scene"), page(8, "content")], workbookPages: [page(7, "content")], glossary: [] } as GeneratedUnit;

  it("stores labels on the scene page only", () => {
    const next = withPageLabels(unit, { 7: [{ word: "door", x: 0.5, y: 0.5 }], 8: [{ word: "pen", x: 0, y: 0 }] });
    expect(next.studentBookPages[0].labels).toEqual([{ word: "door", x: 0.5, y: 0.5 }]);
    expect(next.studentBookPages[1].labels).toBeUndefined();
    expect(next.workbookPages[0].labels).toBeUndefined();
  });

  it("returns the same unit when nothing applies", () => {
    expect(withPageLabels(unit, {})).toBe(unit);
  });
});
