import { describe, expect, it } from "vitest";
import { classifyPageType, pageLayoutType, sceneArea, similarGroup } from "./page-types";
import type { SourcePageLayout } from "@/lib/source-layout";

const layout = (images: SourcePageLayout["images"], over: Partial<SourcePageLayout> = {}): SourcePageLayout => ({
  widthPt: 620,
  heightPt: 782,
  images,
  textColumns: 1,
  wordCount: 20,
  exerciseCount: 1,
  itemCount: 0,
  exerciseRubrics: [],
  bodyFontPt: 10,
  headingFontPt: 13,
  zone: "image_top_text_bottom",
  ...over,
});

const grid = (cols: number, rows: number, w: number, h: number, top = 0.1) =>
  Array.from({ length: cols * rows }, (_, i) => ({ x: 0.05 + (i % cols) * (w + 0.03), y: top + Math.floor(i / cols) * (h + 0.03), w, h }));

// Boxes as the analyzer measures Super Minds Starter (2026-10-23).
describe("classifyPageType", () => {
  it("takes a page-wide picture with a line of text for a scene (p.9 song page)", () => {
    expect(classifyPageType(layout([{ x: 0.06, y: 0.11, w: 0.86, h: 0.77 }], { wordCount: 17, exerciseCount: 0, itemCount: 3 }))).toBe("scene");
  });

  it("joins a scene the analyzer cut around its characters (p.1: two pictures side by side across the page)", () => {
    const images = [
      { x: 0, y: 0, w: 0.37, h: 0.08 },
      { x: 0, y: 0.22, w: 0.37, h: 0.42 },
      { x: 0.41, y: 0.25, w: 0.59, h: 0.45 },
    ];
    expect(sceneArea(images)).toBeGreaterThan(0.45);
    expect(classifyPageType(layout(images, { wordCount: 11 }))).toBe("scene");
  });

  it("keeps two stacked pictures with text between them mixed (p.2)", () => {
    const images = [
      { x: 0.09, y: 0.11, w: 0.86, h: 0.43 },
      { x: 0.09, y: 0.61, w: 0.86, h: 0.33 },
    ];
    expect(classifyPageType(layout(images, { wordCount: 20, exerciseCount: 2 }))).toBe("mixed");
  });

  it("takes six pencils in a grid for cards (p.3)", () => {
    const images = [...grid(3, 2, 0.25, 0.2), { x: 0.06, y: 0.65, w: 0.86, h: 0.29 }];
    expect(similarGroup(images)).toHaveLength(6);
    expect(classifyPageType(layout(images, { wordCount: 24, exerciseCount: 2, itemCount: 6 }))).toBe("cards");
  });

  it("takes a vector card strip measured as one band for cards (p.4: 19 single-number items)", () => {
    expect(classifyPageType(layout([{ x: 0.09, y: 0.11, w: 0.85, h: 0.53 }], { wordCount: 38, exerciseCount: 2, itemCount: 19 }))).toBe("cards");
  });

  it("takes a picture grid with a story rubric for panels (p.5)", () => {
    const images = grid(2, 3, 0.47, 0.26, 0.13);
    expect(classifyPageType(layout(images, { wordCount: 19, itemCount: 6, exerciseRubrics: ["Watch and listen to the story."] }))).toBe("panels");
    // The same grid without a story is a card page.
    expect(classifyPageType(layout(images, { wordCount: 19, itemCount: 6, exerciseRubrics: ["Find and color."] }))).toBe("cards");
  });

  it("keeps small pictures with a 'watch' rubric cards, not panels (p.10)", () => {
    const images = [...grid(4, 2, 0.19, 0.19, 0.11), { x: 0.09, y: 0.64, w: 0.86, h: 0.3 }];
    expect(classifyPageType(layout(images, { wordCount: 26, exerciseCount: 3, itemCount: 5, exerciseRubrics: ["Listen and circle.", "Watch and listen.", "Play the game."] }))).toBe("cards");
  });

  it("keeps a reading page with a big picture mixed (i5 Team 2: 244 words)", () => {
    expect(classifyPageType(layout([{ x: 0.03, y: 0.02, w: 0.95, h: 0.61 }], { wordCount: 244, exerciseCount: 3, itemCount: 8 }))).toBe("mixed");
  });

  it("keeps a picture grid on a wordy page mixed", () => {
    expect(classifyPageType(layout(grid(2, 2, 0.3, 0.15), { wordCount: 300, exerciseCount: 4, itemCount: 16 }))).toBe("mixed");
  });

  it("keeps a page without pictures mixed", () => {
    expect(classifyPageType(layout([], { wordCount: 5 }))).toBe("mixed");
  });
});

describe("pageLayoutType", () => {
  it("reads the stored type, mixed for pages stored before types existed", () => {
    expect(pageLayoutType({ sourceShape: { pageType: "cards" } })).toBe("cards");
    expect(pageLayoutType({})).toBe("mixed");
  });
});
