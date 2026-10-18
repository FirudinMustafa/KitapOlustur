import { describe, expect, it } from "vitest";
import { compareLayouts } from "./fidelity";
import { measurePageLook, type PageLook } from "./page-look";
import type { SourcePageLayout } from "./source-layout";

const layout = (
  images: number,
  exerciseCount: number,
  textColumns: 1 | 2,
  zone: SourcePageLayout["zone"],
  extra: Partial<SourcePageLayout> = {},
): SourcePageLayout => ({
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
  ...extra,
});

// A 20×20 page: white, or filled with one colour.
const look = (rgb: [number, number, number] | null): PageLook => {
  const data = new Uint8Array(20 * 20 * 3);
  for (let i = 0; i < 400; i++) data.set(rgb ?? [255, 255, 255], i * 3);
  return measurePageLook({ width: 20, height: 20, channels: 3, data });
};

describe("compareLayouts - structure", () => {
  it("scores identical shapes 100% and penalises each difference", () => {
    const source = [layout(2, 4, 2, "image_left_text_right"), layout(0, 6, 1, "full_width_text")];
    expect(compareLayouts(source, source, [[1, 1], [2, 2]]).structureScore).toBe(1);

    const generated = [layout(1, 4, 2, "image_left_text_right"), layout(0, 3, 2, "two_column")];
    const r = compareLayouts(source, generated, [[1, 1], [2, 2]]);
    // pictures, exercises, words, columns, zone (items: 0 vs 0, not applicable)
    expect(r.pages[0].structureScore).toBeCloseTo((0.5 + 1 + 1 + 1 + 1) / 5);
    // no pictures on either page: pictures is left out too
    expect(r.pages[1].structureScore).toBeCloseTo((0.5 + 1 + 0 + 0) / 4);
    expect(r.byAspect.columns).toBe(0.5);
    expect(r.lookScore).toBeNull();
  });

  it("does not reward two empty pages", () => {
    const empty = layout(0, 0, 1, "full_width_text", { wordCount: 0 });
    const r = compareLayouts([empty], [layout(0, 0, 1, "full_width_text", { wordCount: 300 })], [[1, 1]]);
    expect(r.pages[0].structure.pictures).toBeUndefined();
    expect(r.pages[0].structure.words).toBe(0);
  });

  it("scores a missing generated page 0", () => {
    const r = compareLayouts([layout(1, 1, 1, "full_width_text")], [], [[1, null]]);
    expect(r.structureScore).toBe(0);
  });
});

describe("compareLayouts - look", () => {
  it("scores a page against itself 100%", () => {
    const l = [layout(1, 2, 1, "image_top_text_bottom")];
    const looks = [look([200, 40, 40])];
    const r = compareLayouts(l, l, [[1, 1]], { source: looks, generated: looks });
    expect(r.lookScore).toBeCloseTo(1);
  });

  it("separates a full-colour page from a white one with the same structure", () => {
    const l = [layout(1, 2, 1, "image_top_text_bottom")];
    const r = compareLayouts(l, l, [[1, 1]], { source: [look([200, 40, 40])], generated: [look(null)] });
    expect(r.structureScore).toBe(1);
    expect(r.lookScore!).toBeLessThan(0.5);
    expect(r.byAspect.palette).toBe(0);
    expect(r.byAspect.ink).toBe(0);
  });

  it("compares body type size relative to the page", () => {
    const src = [layout(0, 1, 1, "full_width_text", { bodyFontPt: 10, heightPt: 800 })];
    const gen = [layout(0, 1, 1, "full_width_text", { bodyFontPt: 5, heightPt: 400 })];
    const looks = [look(null)];
    const r = compareLayouts(src, gen, [[1, 1]], { source: looks, generated: looks });
    expect(r.byAspect.typeSize).toBe(1);
  });
});
