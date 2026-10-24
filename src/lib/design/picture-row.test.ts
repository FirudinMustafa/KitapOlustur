import { describe, expect, it } from "vitest";
import { MIN_PICTURE_ASPECT, ZONE_GAP, frameHeights, rowSlotWidth } from "./layouts";

describe("rowSlotWidth", () => {
  it("splits a row between its pictures, gaps taken out", () => {
    const widths = [0.25, 0.75];
    expect(rowSlotWidth(500 + ZONE_GAP, widths, 0)).toBe(125);
    expect(rowSlotWidth(500 + ZONE_GAP, widths, 1)).toBe(375);
  });

  it("runs an edge-to-edge row into the bleed on both sides, not twice on one", () => {
    // 3 pt bleed: a print PDF's row of three must cover the sheet from edge
    // to edge - the first slot gains the left bleed, the last the right one.
    const widths = [0.3, 0.4, 0.3];
    const slots = widths.map((_, k) => rowSlotWidth(620, widths, k, 3));
    expect(slots[0] + slots[1] + slots[2] + 2 * ZONE_GAP).toBeCloseTo(626);
    expect(slots[0] - slots[2]).toBeCloseTo(0);
    expect(rowSlotWidth(620, [1], 0, 3)).toBe(626);
  });
});

describe("frameHeights", () => {
  it("draws a frame thinner than MIN_PICTURE_ASPECT shorter, the others at the row's height", () => {
    // KIYAS-13 p.10: a 0.24 strip printed a sliver of a portrait picture.
    expect(frameHeights([300, 48], 200)).toEqual([200, Math.round(48 / MIN_PICTURE_ASPECT)]);
  });
});
