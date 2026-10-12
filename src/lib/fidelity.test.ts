import { describe, expect, it } from "vitest";
import { compareLayouts } from "./fidelity";
import type { SourcePageLayout } from "./source-layout";

const layout = (images: number, exerciseCount: number, textColumns: 1 | 2, zone: SourcePageLayout["zone"]): SourcePageLayout => ({
  widthPt: 600,
  heightPt: 800,
  images: Array.from({ length: images }, () => ({ x: 0, y: 0, w: 0.3, h: 0.2 })),
  textColumns,
  wordCount: 200,
  exerciseCount,
  itemCount: 0,
  exerciseRubrics: [],
  bodyFontPt: 10,
  headingFontPt: 13,
  zone,
});

describe("compareLayouts", () => {
  it("scores identical shapes 100% and penalises each difference", () => {
    const source = [layout(2, 4, 2, "image_left_text_right"), layout(0, 6, 1, "full_width_text")];
    expect(compareLayouts(source, source, [[1, 1], [2, 2]]).score).toBe(1);

    const generated = [layout(1, 4, 2, "image_left_text_right"), layout(0, 3, 2, "two_column")];
    const r = compareLayouts(source, generated, [[1, 1], [2, 2]]);
    expect(r.pages[0].score).toBeCloseTo((0.5 + 1 + 1 + 1) / 4);
    expect(r.pages[1].score).toBeCloseTo((1 + 0.5 + 0 + 0) / 4);
    expect(r.byAspect.columns).toBe(0.5);
  });

  it("scores a missing generated page 0", () => {
    const r = compareLayouts([layout(1, 1, 1, "full_width_text")], [], [[1, null]]);
    expect(r.score).toBe(0);
  });
});
