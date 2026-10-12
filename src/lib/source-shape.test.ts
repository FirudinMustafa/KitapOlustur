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
      blocks: [exercise("1 A"), exercise("2 B"), exercise("3 C")],
      imagePrompt: "a room",
      extraImagePrompts: ["a lamp"],
      zonePlan: twoPictures,
      sourceShape: { exercises: 5, pictures: 2 },
    };
    expect(shapeIssues(page, "Student Book")).toEqual([]);
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
