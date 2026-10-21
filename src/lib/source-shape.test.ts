import { describe, expect, it } from "vitest";
import { fillZonePictures, shapeIssues } from "./source-shape";
import type { ZonePlan } from "@/lib/design/zones";

const twoPictures: ZonePlan = {
  bands: [
    { kind: "text", columns: 1, weight: 0.4 },
    { kind: "pictures", height: 0.3, widths: [0.5, 0.5] },
  ],
};
const exercise = (heading: string) => ({ kind: "practice", heading, body: "", items: ["a"], answerKey: ["a"] });

describe("shapeIssues", () => {
  it("asks for the source's exercises and pictures", () => {
    const page = { sourcePageNumber: 9, blocks: [exercise("1 Plurals")], zonePlan: twoPictures, sourceShape: { exercises: 5, pictures: 2 } };
    const issues = shapeIssues(page, "Student Book");
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatch(/5 numbered exercises but this page has 1/);
    expect(issues[1]).toMatch(/2 pictures/);
  });

  it("accepts a page close enough to its source", () => {
    const page = {
      sourcePageNumber: 9,
      blocks: [exercise("1 A"), exercise("2 B"), exercise("3 C"), exercise("4 D")],
      imagePrompt: "a room",
      extraImagePrompts: ["a lamp"],
      zonePlan: twoPictures,
      sourceShape: { exercises: 5, pictures: 2 },
    };
    expect(shapeIssues(page, "Student Book")).toEqual([]);
    // 3 of 5 was enough before Faz G4; 80% is asked now
    expect(shapeIssues({ ...page, blocks: page.blocks.slice(0, 3) }, "Student Book")).toHaveLength(1);
  });
});

describe("word budget", () => {
  const page = (items: string[], words: number) => ({
    sourcePageNumber: 4,
    blocks: [{ kind: "practice", heading: "1 Listen and point", body: "Say the words.", items, answerKey: items }],
    sourceShape: { exercises: 0, pictures: 0, words },
  });

  it("sends back a page far over its source's word count", () => {
    const long = Array.from({ length: 10 }, (_, i) => `Picture ${i}: the boy with the red sweatshirt`);
    const issues = shapeIssues(page(long, 11), "Student Book");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/only 11 - at most 31 words/);
  });

  it("accepts a page within its budget", () => {
    expect(shapeIssues(page(["chair", "book", "pencil"], 11), "Student Book")).toEqual([]);
  });

  it("does not check pages without a measured word count", () => {
    const long = Array.from({ length: 30 }, () => "a long item with many words");
    expect(shapeIssues({ ...page(long, 0), sourceShape: { exercises: 0, pictures: 0 } }, "Student Book")).toEqual([]);
  });
});

describe("fillZonePictures", () => {
  it("fills every frame from the page's own content", () => {
    const page: Parameters<typeof fillZonePictures>[0] = {
      sourcePageNumber: 9,
      blocks: [exercise("1 Plurals")],
      glossary: [{ term: "bunk bed" }],
      zonePlan: twoPictures,
    };
    const filled = fillZonePictures(page, () => "a bedroom scene");
    expect(filled.imagePrompt).toBe("a bedroom scene");
    expect(filled.extraImagePrompts).toEqual(["A simple, clear picture of bunk bed, on a plain background, for a coursebook page."]);
  });

  it("leaves a page without a layout plan alone", () => {
    const page = { sourcePageNumber: 1, blocks: [] };
    expect(fillZonePictures(page, () => "x")).toBe(page);
  });
});
