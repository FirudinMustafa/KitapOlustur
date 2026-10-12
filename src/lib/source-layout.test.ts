import { describe, expect, it } from "vitest";
import { analyzeStextPage, dominantTrim, type StextPage } from "./source-layout";

const W = 600;
const H = 800;
const line = (text: string, size: number, weight = "normal", y = 0) => ({ text, font: { size, weight }, bbox: { x: 0, y, w: 100, h: size } });
const text = (x: number, y: number, w: number, lines: ReturnType<typeof line>[]) => ({
  type: "text" as const,
  bbox: { x, y, w, h: lines.length * 12 },
  lines: lines.map((l, i) => ({ ...l, bbox: { ...l.bbox, x, y: y + i * 12 } })),
});
const image = (x: number, y: number, w: number, h: number) => ({ type: "image" as const, bbox: { x, y, w, h } });
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

describe("analyzeStextPage", () => {
  it("keeps content pictures and drops background, strips, icons and header bands", () => {
    const page: StextPage = {
      width: W,
      height: H,
      blocks: [
        image(0, 0, 600, 800), // background
        image(0, 0, 8, 800), // edge strip
        image(10, 10, 12, 12), // icon
        image(0, 0, 600, 80), // header band
        image(330, 100, 240, 200), // picture
        image(340, 110, 200, 160), // same picture's inner frame
        image(40, 500, 240, 180), // second picture
        text(40, 100, 260, [line(words(40), 10)]),
      ],
    };
    const layout = analyzeStextPage(page);
    expect(layout.images).toHaveLength(2);
    // reading order: top picture first
    expect(layout.images[0].x).toBeCloseTo(330 / W);
    expect(layout.images[1].y).toBeCloseTo(500 / H);
    expect(layout.zone).toBe("image_right_text_left");
  });

  it("counts exercise headings by size, separately from item numbers", () => {
    const page: StextPage = {
      width: W,
      height: H,
      blocks: [
        text(40, 100, 500, [line("1 Listen and repeat.", 13, "bold"), line("1", 10, "bold"), line(words(30), 10), line("2", 10, "bold")]),
        text(40, 300, 500, [line("2", 13, "bold"), line("Circle the correct word.", 10, "bold"), line(words(30), 10)]),
        text(40, 780, 40, [line("11", 13, "bold")]), // folio
      ],
    };
    const layout = analyzeStextPage(page);
    expect(layout.bodyFontPt).toBe(10);
    expect(layout.exerciseCount).toBe(2);
    expect(layout.itemCount).toBe(2);
    expect(layout.exerciseRubrics).toEqual(["Listen and repeat.", "Circle the correct word."]);
  });

  it("detects two text columns", () => {
    const page: StextPage = {
      width: W,
      height: H,
      blocks: [text(40, 100, 250, [line(words(80), 10)]), text(320, 100, 250, [line(words(80), 10)])],
    };
    const layout = analyzeStextPage(page);
    expect(layout.textColumns).toBe(2);
    expect(layout.zone).toBe("two_column");
  });
});

describe("dominantTrim", () => {
  it("ignores an odd-sized cover", () => {
    const base = analyzeStextPage({ width: W, height: H, blocks: [] });
    const cover = analyzeStextPage({ width: 1200, height: H, blocks: [] });
    expect(dominantTrim([cover, base, base])).toEqual({ widthPt: 600, heightPt: 800 });
  });
});
