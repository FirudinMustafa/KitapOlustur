import { describe, expect, it } from "vitest";
import { mergePageMap } from "./page-map-merge";
import type { SourcePageLayout } from "./source-layout";

const layout = (over: Partial<SourcePageLayout> = {}): SourcePageLayout => ({
  widthPt: 600,
  heightPt: 800,
  images: [],
  textColumns: 1,
  wordCount: 100,
  exerciseCount: 0,
  itemCount: 0,
  exerciseRubrics: [],
  bodyFontPt: 10,
  headingFontPt: 13,
  zone: "full_width_text",
  ...over,
});
const page = (pageNumber: number, unitNumber: number | null) => ({
  pageNumber,
  pageType: "content" as const,
  unitNumber,
  summary: "s",
  hasImage: false,
});

describe("mergePageMap", () => {
  it("returns one entry per real page, filling pages the model skipped", () => {
    const layouts = [layout(), layout({ exerciseCount: 3 }), layout(), layout()];
    const merged = mergePageMap(4, [page(1, 1), page(3, 1), page(3, 2), page(9, 5)], layouts);
    expect(merged.map((p) => p.pageNumber)).toEqual([1, 2, 3, 4]);
    // skipped page between two unit-1 pages stays in unit 1
    expect(merged[1]).toMatchObject({ unitNumber: 1, pageType: "exercise" });
    // duplicates: first description wins; out-of-range entries dropped
    expect(merged[2].unitNumber).toBe(1);
    // trailing skipped page has no neighbour after it -> outside any unit
    expect(merged[3].unitNumber).toBeNull();
  });

  it("uses the measured zone and pictures", () => {
    const measured = layout({ zone: "image_left_text_right", images: [{ x: 0, y: 0, w: 0.4, h: 0.3 }] });
    const [p] = mergePageMap(1, [{ ...page(1, 1), visualStyle: { hasBrandMark: true, layoutZone: "two_column" } }], [measured]);
    expect(p.visualStyle).toMatchObject({ hasBrandMark: true, layoutZone: "image_left_text_right" });
    expect(p.hasImage).toBe(true);
    expect(p.layout).toBe(measured);
  });
});
