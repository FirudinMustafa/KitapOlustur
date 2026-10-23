import { describe, expect, it } from "vitest";
import { placeLabels } from "./label-overlay";

const inside = (p: { x: number; y: number; w: number; h: number }, width: number, height: number) => p.x >= 0 && p.y >= 0 && p.x + p.w <= width && p.y + p.h <= height;
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("placeLabels", () => {
  it("puts a pill above its point when there is room", () => {
    const [p] = placeLabels([{ word: "door", x: 0.5, y: 0.5 }], 300, 200);
    expect(p.px).toBe(150);
    expect(p.py).toBe(100);
    expect(p.y + p.h).toBeLessThan(100);
    expect(Math.abs(p.x + p.w / 2 - 150)).toBeLessThan(1);
  });

  it("keeps pills inside the frame near the edges", () => {
    const placed = placeLabels(
      [
        { word: "window", x: 0.02, y: 0.02 },
        { word: "blackboard", x: 0.98, y: 0.98 },
      ],
      300,
      200,
    );
    for (const p of placed) expect(inside(p, 300, 200)).toBe(true);
  });

  it("moves pills of close points apart", () => {
    const placed = placeLabels(
      [
        { word: "book", x: 0.5, y: 0.5 },
        { word: "pencil", x: 0.52, y: 0.5 },
        { word: "table", x: 0.5, y: 0.53 },
      ],
      300,
      200,
    );
    expect(placed).toHaveLength(3);
    expect(overlap(placed[0], placed[1])).toBe(false);
    expect(overlap(placed[0], placed[2])).toBe(false);
    expect(overlap(placed[1], placed[2])).toBe(false);
  });

  it("maps points through a cropped picture and drops cropped-away ones", () => {
    // A 3:2 picture in a 3:1 frame, cropped at 30% from the top: 100pt of
    // its 200pt height is cut, 30pt above and 70pt below.
    const placed = placeLabels(
      [
        { word: "sky", x: 0.5, y: 0.05 },
        { word: "cat", x: 0.5, y: 0.5 },
      ],
      300,
      100,
      { imageAspect: 1.5, fit: "cover", positionY: 0.3 },
    );
    expect(placed.map((p) => p.word)).toEqual(["cat"]);
    expect(placed[0].py).toBeCloseTo(70);
  });
});
