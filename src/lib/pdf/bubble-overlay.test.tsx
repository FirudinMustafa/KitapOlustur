import { describe, expect, it } from "vitest";
import { balancedWrap, bubbleTail, placeBubbles, wrapLine } from "./bubble-overlay";

type Box = { x: number; y: number; w: number; h: number };
const inside = (p: Box, width: number, height: number) => p.x >= 0 && p.y >= 0 && p.x + p.w <= width && p.y + p.h <= height;
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const coversPoint = (p: Box, x: number, y: number) => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h;

// The live check's picture (.spike/handcraft2/img/1b-scene.png): heads the
// vision model found for a family doing chores, five of them in a row at a
// quarter of the picture's height.
const family = [
  { speaker: "Mum", line: "I'm going to the supermarket now. Back at eleven!", x: 0.109, y: 0.2535, r: 0.0435 },
  { speaker: "Dad", line: "The dishwasher is full again! Who's eating all these snacks?", x: 0.9295, y: 0.289, r: 0.041 },
  { speaker: "Emily", line: "I'm vacuuming the living room. Then I'm meeting Zoe.", x: 0.646, y: 0.411, r: 0.088 },
  { speaker: "Tom", line: "I'm taking out the rubbish. Can I play football after this?", x: 0.3515, y: 0.283, r: 0.035 },
  { speaker: "Grandma", line: "I'm watering the plants. They're thirsty too!", x: 0.492, y: 0.2995, r: 0.0305 },
  { speaker: "Biscuit the cat", line: "Me? I'm resting. It's Saturday!", x: 0.2815, y: 0.696, r: 0.041 },
];

describe("wrapping", () => {
  it("wraps to the width and balances the lines", () => {
    const text = "I'm taking out the rubbish. Can I play football after this?";
    expect(wrapLine(text, 10, 140).length).toBe(3);
    const balanced = balancedWrap(text, 10, 140);
    expect(balanced.length).toBe(3);
    expect(Math.min(...balanced.map((l) => l.length))).toBeGreaterThan(10); // no lone "this?"
    expect(balanced.join(" ")).toBe(text);
  });
});

describe("bubbleTail", () => {
  it("runs from the edge facing the head to just short of it", () => {
    const tail = bubbleTail({ x: 0, y: 0, w: 100, h: 40 }, 60, 100, 10, 7);
    expect(tail?.a[1]).toBe(40);
    expect(tail?.b[1]).toBe(40);
    const [tx, ty] = tail!.tip;
    expect(Math.hypot(tx - 60, ty - 100)).toBeCloseTo(11, 0);
    expect(bubbleTail({ x: 0, y: 0, w: 100, h: 40 }, 50, 20, 10, 7)).toBeNull();
  });
});

describe("placeBubbles", () => {
  it("puts a lone bubble above its speaker's head", () => {
    const [b] = placeBubbles([{ speaker: "Mum", line: "Hello!", x: 0.5, y: 0.6, r: 0.05 }], 400, 300);
    expect(b.y + b.h).toBeLessThan(b.py - b.pr);
    expect(Math.abs(b.x + b.w / 2 - 200)).toBeLessThan(b.w / 2);
    expect(b.tail).not.toBeNull();
  });

  it("sets a family's six lines by their speakers, inside the frame, clear of each other and of every face", () => {
    for (const [width, height] of [
      [599, 330],
      [599, 399],
    ]) {
      const placed = placeBubbles(family, width, height, { imageAspect: 1.5, fit: "cover", positionY: 0.3 });
      expect(placed).toHaveLength(6);
      for (const [i, p] of placed.entries()) {
        expect(inside(p, width, height)).toBe(true);
        expect(p.tail).not.toBeNull();
        for (const q of placed.slice(i + 1)) expect(overlap(p, q)).toBe(false);
        for (const q of placed) expect(coversPoint(p, q.px, q.py)).toBe(false);
        // near its speaker: the tail is short next to the frame
        const [tx, ty] = p.tail!.tip;
        expect(Math.hypot(tx - (p.tail!.a[0] + p.tail!.b[0]) / 2, ty - (p.tail!.a[1] + p.tail!.b[1]) / 2)).toBeLessThan(height * 0.25);
      }
    }
  });

  it("keeps out of the insets and gives a cropped-away head no tail", () => {
    const placed = placeBubbles(
      [
        { speaker: "Mum", line: "Hello!", x: 0.02, y: 0.5, r: 0.05 },
        { speaker: "Leo", line: "Hi, Mum!", x: 0.5, y: 0.5, r: 0.05 },
      ],
      300,
      400,
      { imageAspect: 1.5, fit: "cover", positionY: 0.4, insets: { top: 120, bottom: 80 } },
    );
    expect(placed[0].tail).toBeNull();
    expect(placed[1].tail).not.toBeNull();
    for (const p of placed) {
      expect(p.y).toBeGreaterThanOrEqual(120);
      expect(p.y + p.h).toBeLessThanOrEqual(400 - 80);
    }
  });
});
