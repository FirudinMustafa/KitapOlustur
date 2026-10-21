import { describe, expect, it } from "vitest";
import {
  analyzeStextPage,
  dominantTrim,
  furnitureKeys,
  hasBackgroundImage,
  isListeningRubric,
  rasterPictureBoxes,
  stripFurniture,
  type Raster,
  type StextPage,
} from "./source-layout";

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

// A W x H page rendered 1:1 on a flat cream tint, with "artwork" (a
// pseudo-random speckle) painted into the given rectangles.
function render(art: { x: number; y: number; w: number; h: number }[]): Raster {
  const data = new Uint8Array(W * H * 3).fill(235);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 255;
  for (const a of art)
    for (let y = a.y; y < a.y + a.h; y++)
      for (let x = a.x; x < a.x + a.w; x++) for (let k = 0; k < 3; k++) data[(y * W + x) * 3 + k] = rnd();
  return { width: W, height: H, channels: 3, data };
}
const near = (a: number, b: number) => Math.abs(a - b) < 0.03;

describe("rasterPictureBoxes (artwork flattened into the page background)", () => {
  const background = image(0, 0, W, H);

  it("finds the pictures inside a page-sized background image", () => {
    expect(hasBackgroundImage({ width: W, height: H, blocks: [background] })).toBe(true);
    const page = { width: W, height: H, blocks: [background] };
    const boxes = rasterPictureBoxes(render([{ x: 60, y: 60, w: 480, h: 300 }, { x: 60, y: 500, w: 200, h: 200 }]), page);
    expect(boxes).toHaveLength(2);
    expect(near(boxes[0].x, 0.1) && near(boxes[0].y, 0.075) && near(boxes[0].w, 0.8)).toBe(true);
    const layout = analyzeStextPage({ ...page, rasterImages: boxes });
    expect(layout.images).toHaveLength(2);
    expect(layout.zone).toBe("image_top_text_bottom");
  });

  it("sees nothing on a flat tint, and ignores speckle under text", () => {
    const page = { width: W, height: H, blocks: [background, text(60, 400, 480, [line(words(8), 10)])] };
    expect(rasterPictureBoxes(render([]), page)).toEqual([]);
    expect(rasterPictureBoxes(render([{ x: 60, y: 400, w: 480, h: 12 }]), page)).toEqual([]);
  });

  it("keeps an edge-to-edge illustration as one big picture, drops badges", () => {
    const page = { width: W, height: H, blocks: [background] };
    const full = rasterPictureBoxes(render([{ x: 20, y: 20, w: 560, h: 760 }]), page);
    expect(full).toHaveLength(1);
    expect(analyzeStextPage({ ...page, rasterImages: full }).zone).toBe("full_width_image");
    expect(rasterPictureBoxes(render([{ x: 100, y: 100, w: 30, h: 30 }]), page)).toEqual([]);
  });

  it("ignores hollow frames such as answer boxes", () => {
    const page = { width: W, height: H, blocks: [background] };
    const frame = [
      { x: 100, y: 100, w: 400, h: 6 },
      { x: 100, y: 394, w: 400, h: 6 },
      { x: 100, y: 100, w: 6, h: 300 },
      { x: 494, y: 100, w: 6, h: 300 },
    ];
    expect(rasterPictureBoxes(render(frame), page)).toEqual([]);
  });
});

describe("listening exercises and track numbers (2026-10-21)", () => {
  it("takes the track number off the rubric and counts listening exercises", () => {
    const page: StextPage = {
      width: W,
      height: H,
      blocks: [
        // Super Minds: "1" alone, then "03  Listen and point." on the next line
        text(40, 120, 500, [line("1 ", 22), line("03  Listen and point. Say the names.", 12)]),
        // Kid's Box: number, small track number, rubric as three lines
        text(40, 400, 500, [line("2", 22), line("4", 9, "bold"), line("Listen and colour.", 18, "bold")]),
        text(40, 600, 500, [line("3 Ask and answer.", 22)]),
        text(40, 700, 500, [line(words(40), 10)]),
      ],
    };
    const layout = analyzeStextPage(page);
    expect(layout.exerciseRubrics).toEqual(["Listen and point. Say the names.", "Listen and colour.", "Ask and answer."]);
    expect(layout.trackNumbers).toEqual(["03", "4"]);
    expect(layout.listeningCount).toBe(2);
  });

  it("does not take a rubric's own number for a track", () => {
    const page: StextPage = {
      width: W,
      height: H,
      blocks: [text(40, 120, 500, [line("1 10 words to learn.", 14, "bold")]), text(40, 300, 500, [line(words(40), 10)])],
    };
    const layout = analyzeStextPage(page);
    expect(layout.exerciseRubrics).toEqual(["10 words to learn."]);
    expect(layout.trackNumbers).toBeUndefined();
  });

  it("recognises listening rubrics", () => {
    expect(isListeningRubric("Watch and listen to the story.")).toBe(true);
    expect(isListeningRubric("Say the chant.")).toBe(true);
    expect(isListeningRubric("Read and match.")).toBe(false);
  });
});

describe("young learners' pages (2026-10-21)", () => {
  it("does not count the numbers on pictures as exercises", () => {
    const page: StextPage = {
      width: W,
      height: H,
      blocks: [
        text(40, 120, 500, [line("1 Listen and write the number.", 26, "bold")]),
        text(40, 200, 20, [line("1", 14, "bold")]),
        text(200, 200, 20, [line("2", 14, "bold")]),
        text(360, 200, 20, [line("3", 14, "bold")]),
        text(40, 500, 500, [line("2 Draw and write.", 26, "bold")]),
        text(40, 600, 500, [line(words(20), 11)]),
      ],
    };
    const layout = analyzeStextPage(page);
    expect(layout.exerciseCount).toBe(2);
    expect(layout.itemCount).toBe(3);
  });

  it("reads text drawn several times in one place once", () => {
    const shadow = text(60, 150, 300, [line("Starters Listening", 30), line("Starters Listening", 30)]);
    shadow.lines[1].bbox = shadow.lines[0].bbox; // same spot
    const page: StextPage = {
      width: W,
      height: H,
      blocks: [shadow, text(40, 300, 500, [line(words(12), 11)]), text(40, 400, 500, [line("1 Listen and colour.", 26, "bold")])],
    };
    const layout = analyzeStextPage(page);
    expect(layout.wordCount).toBe(2 + 12 + 4);
  });
});

describe("page furniture (2026-10-21)", () => {
  const furniturePage = (folio: string, content: string): StextPage => ({
    width: W,
    height: H,
    blocks: [
      text(20, 30, 400, [line("Cambridge University Press", 9), line("Excerpt", 9)]),
      text(40, 300, 500, [line(content, 12)]),
      text(20, 780, 400, [line("© in this web service Cambridge University Press", 9)]),
      text(560, 760, 20, [line(folio, 10, "bold")]),
    ],
  });
  const pages = [furniturePage("4", "1 Listen and sing."), furniturePage("5", "Hello! What's your name?"), furniturePage("6", "Colors")];

  it("finds lines repeated in the top/bottom band of most pages", () => {
    const keys = furnitureKeys(pages);
    expect([...keys].sort()).toEqual(["cambridge university press", "excerpt", "© in this web service cambridge university press"]);
  });

  it("strips them, and only them, before measuring", () => {
    const keys = furnitureKeys(pages);
    const layout = analyzeStextPage(stripFurniture(pages[1], keys));
    expect(layout.wordCount).toBe(4 + 1); // the content line and the folio
  });

  it("needs at least three pages to call something furniture", () => {
    expect(furnitureKeys(pages.slice(0, 2)).size).toBe(0);
  });
});
