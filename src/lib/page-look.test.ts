import { describe, expect, it } from "vitest";
import { compareLooks, measurePageLook, pictureAreaOverlap } from "./page-look";

// 24×32 page, white, with the top `rows` rows painted `rgb`.
function page(rgb: [number, number, number], rows: number) {
  const W = 24;
  const H = 32;
  const data = new Uint8Array(W * H * 3).fill(255);
  for (let y = 0; y < rows; y++) for (let x = 0; x < W; x++) data.set(rgb, (y * W + x) * 3);
  return measurePageLook({ width: W, height: H, channels: 3, data });
}

describe("measurePageLook", () => {
  it("measures ink, colourfulness and where the ink is", () => {
    const l = page([30, 90, 220], 8); // a blue band over the top quarter
    expect(l.ink).toBeCloseTo(0.25);
    expect(l.colourfulness).toBeGreaterThan(0.8);
    expect(l.palette[0]).toBeCloseTo(0.75); // paper
    expect(l.inkGrid.slice(0, 12).every((v) => v === 1)).toBe(true);
    expect(l.inkGrid.slice(-12).every((v) => v === 0)).toBe(true);
  });

  it("counts black text as ink without colour", () => {
    const l = page([0, 0, 0], 4);
    expect(l.ink).toBeCloseTo(0.125);
    expect(l.colourfulness).toBe(0);
  });
});

describe("compareLooks", () => {
  it("is 1 for the same page and lower for another colour at the same place", () => {
    const blue = page([30, 90, 220], 8);
    const same = compareLooks(blue, blue, [[], []]);
    expect(same.palette).toBeCloseTo(1);
    expect(same.inkMap).toBe(1);
    expect(same.pictureArea).toBeNull();

    const red = compareLooks(blue, page([220, 40, 30], 8), [[], []]);
    expect(red.inkMap).toBe(1);
    expect(red.palette).toBe(0); // printed colours only - the shared paper does not count
  });

  it("does not reward a nearly blank page for sharing paper", () => {
    const c = compareLooks(page([30, 90, 220], 8), page([255, 255, 255], 0), [[], []]);
    expect(c.palette).toBe(0);
    expect(c.ink).toBe(0);
    expect(c.colourfulness).toBe(0);
  });
});

describe("pictureAreaOverlap", () => {
  it("is intersection over union of the picture areas", () => {
    const top = { x: 0, y: 0, w: 1, h: 0.5 };
    expect(pictureAreaOverlap([top], [top])).toBe(1);
    expect(pictureAreaOverlap([top], [{ x: 0, y: 0.5, w: 1, h: 0.5 }])).toBe(0);
    expect(pictureAreaOverlap([top], [{ x: 0, y: 0, w: 1, h: 0.25 }])).toBeCloseTo(0.5);
    expect(pictureAreaOverlap([], [])).toBeNull();
  });
});
