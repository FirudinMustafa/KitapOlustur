import { describe, expect, it } from "vitest";
import { deriveFurniture, legibleGround, measureNumberMarks, measurePageGround, measureTopBand, type PageFurniture } from "./page-furniture";
import type { Raster } from "@/lib/source-layout";

const YELLOW: [number, number, number] = [255, 219, 0];
const RED: [number, number, number] = [239, 74, 70];
const GREEN: [number, number, number] = [197, 217, 44];

function paper(width: number, height: number) {
  const data = new Uint8Array(width * height * 3).fill(255);
  const fill = (x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number]) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.set(rgb, (y * width + x) * 3);
  };
  const raster: Raster = { width, height, channels: 3, data };
  return { raster, fill };
}

describe("measureTopBand", () => {
  it("finds the strip across the top edge and the tab from the outer edge", () => {
    // Super Minds, measured at 300 px: a yellow strip 2% tall, a red tab
    // over the right half reaching 3.7% down.
    const { raster, fill } = paper(300, 380);
    fill(0, 0, 300, 8, YELLOW);
    fill(150, 4, 300, 14, RED);
    const band = measureTopBand(raster)!;
    expect(band.color).toBe("#ffdb00");
    expect(band.heightRatio).toBeCloseTo(8 / 380, 2);
    expect(band.tab?.color).toBe("#ef4a46");
    expect(band.tab?.widthRatio).toBeCloseTo(0.5, 1);
    expect(band.tab?.heightRatio).toBeCloseTo(14 / 380, 2);
  });

  it("is no band when the page is white at the top or a picture bleeds off it", () => {
    expect(measureTopBand(paper(300, 380).raster)).toBeNull();
    const { raster, fill } = paper(300, 380);
    fill(0, 0, 300, 120, [40, 90, 220]);
    expect(measureTopBand(raster)).toBeNull();
  });
});

describe("measureNumberMarks", () => {
  it("tells a number on a disc and reads the track pill beside it", () => {
    const { raster, fill } = paper(300, 300);
    // a 20 px red disc (as a square) with a white figure, the green pill right of it
    fill(30, 50, 50, 70, RED);
    fill(37, 54, 43, 66, [255, 255, 255]);
    fill(56, 53, 90, 67, GREEN);
    const marks = measureNumberMarks(raster, [{ box: { x: 31 / 300, y: 51 / 300, w: 0.3, h: 18 / 300 }, digits: 1, track: true }]);
    expect(marks.numberBadge).toEqual({ color: "#ef4a46", filled: true });
    expect(marks.trackColor).toBe("#c5d92c");
  });

  it("tells a coloured numeral on paper", () => {
    const { raster, fill } = paper(300, 300);
    fill(38, 52, 41, 68, RED); // the stroke of a "1"
    const marks = measureNumberMarks(raster, [{ box: { x: 33 / 300, y: 51 / 300, w: 0.3, h: 18 / 300 }, digits: 1, track: false }]);
    expect(marks.numberBadge?.filled).toBe(false);
    expect(marks.trackColor).toBeUndefined();
  });
});

describe("deriveFurniture", () => {
  const page = (f?: PageFurniture) => ({ furniture: f });
  const band = { color: "#ffdb00", heightRatio: 0.021, tab: { color: "#ef4a46", widthRatio: 0.48, heightRatio: 0.037 } };

  it("keeps what most pages print", () => {
    const f = deriveFurniture([
      page({ topBand: band, numberBadge: { color: "#ef4a46", filled: true }, trackColor: "#c5d92c" }),
      page({ topBand: { ...band, color: "#ffde10" }, numberBadge: { color: "#f04b47", filled: true } }),
      page({ topBand: { color: "#c6242c", heightRatio: 0.021 }, numberBadge: { color: "#ef4a46", filled: true } }),
      page({ numberBadge: { color: "#2563eb", filled: false } }),
    ])!;
    expect(f.topBand?.color).toMatch(/^#ffd/);
    expect(f.topBand?.tab?.color).toBe("#ef4a46");
    expect(f.numberBadge).toEqual({ color: expect.stringMatching(/^#ef4/), filled: true });
    expect(f.trackColor).toBe("#c5d92c");
  });

  it("drops a band only a few pages show", () => {
    const f = deriveFurniture([page({ topBand: band }), page(), page(), page()]);
    expect(f?.topBand).toBeUndefined();
    expect(deriveFurniture([page(), page()])).toBeNull();
  });
});

describe("measurePageGround", () => {
  // i5 Team 2, measured at 120 px: p.6 on a lime band over its top half, p.10
  // with a purple panel down its right half (white boxes on it), a page of
  // text on paper.
  const LIME: [number, number, number] = [191, 215, 47];
  const PURPLE: [number, number, number] = [119, 120, 179];

  it("finds a band across the top, edge to edge", () => {
    const { raster, fill } = paper(120, 156);
    fill(0, 0, 120, 66, LIME);
    fill(20, 20, 70, 30, [30, 30, 30]); // text on it
    const ground = measurePageGround(raster, [])!;
    expect(ground.color).toBe("#bfd72f");
    expect(ground.box).toMatchObject({ x: 0, y: 0, w: 1 });
    expect(ground.box.h).toBeGreaterThan(0.38);
    expect(ground.box.h).toBeLessThan(0.48);
  });

  it("finds a panel down one side, white boxes and all", () => {
    const { raster, fill } = paper(120, 156);
    fill(64, 0, 120, 156, PURPLE);
    fill(74, 40, 110, 70, [255, 255, 255]);
    const ground = measurePageGround(raster, [])!;
    expect(ground.box).toMatchObject({ y: 0, h: 1 });
    expect(ground.box.x).toBeGreaterThan(0.45);
    expect(ground.box.x + ground.box.w).toBe(1);
  });

  it("is no ground on a paper page, nor for a picture's colour", () => {
    expect(measurePageGround(paper(120, 156).raster, [])).toBeNull();
    const { raster, fill } = paper(120, 156);
    fill(0, 0, 120, 100, [40, 90, 220]);
    expect(measurePageGround(raster, [{ x: 0, y: 0, w: 1, h: 0.66 }])).toBeNull();
  });

  it("lifts a dark ground until black text reads on it", () => {
    expect(legibleGround("#bfd72f")).toBe("#bfd72f");
    expect(legibleGround("#282874")).not.toBe("#282874");
  });
});
