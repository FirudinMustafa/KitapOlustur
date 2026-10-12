import { describe, expect, it } from "vitest";
import { applyZonePlans, complementaryPlan, writerBlueprint } from "./source-blueprint";
import type { SourcePage } from "@/lib/ai/schemas";
import type { SourcePageLayout } from "@/lib/source-layout";

const layout = (over: Partial<SourcePageLayout>): SourcePageLayout => ({
  widthPt: 600,
  heightPt: 800,
  images: [],
  textColumns: 2,
  wordCount: 300,
  exerciseCount: 4,
  itemCount: 20,
  exerciseRubrics: ["Listen and repeat.", "Circle the correct word."],
  bodyFontPt: 10,
  headingFontPt: 13,
  zone: "two_column",
  ...over,
});
const page = (pageNumber: number, l: SourcePageLayout): SourcePage => ({ pageNumber, pageType: "content", unitNumber: 1, summary: "s", hasImage: false, sourceText: "verbatim text", layout: l });

describe("writerBlueprint", () => {
  it("passes the measured shape and leaves the source's verbatim text out", () => {
    const [bp] = writerBlueprint([page(5, layout({ images: [{ x: 0.5, y: 0.1, w: 0.4, h: 0.3 }] }))]);
    expect(bp).toMatchObject({ sourcePageNumber: 5, measured: { pictures: 1, numberedExercises: 4, itemsPerExercise: 5, textColumns: 2 } });
    expect(JSON.stringify(bp)).not.toContain("verbatim text");
  });
});

describe("applyZonePlans", () => {
  it("copies the source page's plan and trims picture prompts to its slots", () => {
    const sources = [page(5, layout({ images: [{ x: 0.5, y: 0.1, w: 0.4, h: 0.3 }, { x: 0.05, y: 0.6, w: 0.4, h: 0.3 }] }))];
    const [out] = applyZonePlans(
      [{ sourcePageNumber: 5, pageType: "content", unitNumber: 1, blocks: [], imagePrompt: "a", extraImagePrompts: ["b", "c", "d"] }],
      sources,
    );
    expect(out.zonePlan?.bands.length).toBeGreaterThan(0);
    expect(out.extraImagePrompts).toEqual(["b"]);
  });
});

describe("complementaryPlan", () => {
  it("sizes a workbook from the measured student-book unit", () => {
    const plan = complementaryPlan([page(1, layout({})), page(2, layout({})), page(3, layout({})), page(4, layout({ exerciseCount: 0 }))], "workbook")!;
    expect(plan).toContain("Write 2 workbook pages");
    expect(plan).toContain("5 numbered exercises with about 5 items");
    expect(plan).toContain("Circle the correct word.");
  });

  it("is null without measurements (older runs, scans)", () => {
    expect(complementaryPlan([{ pageNumber: 1, pageType: "content", unitNumber: 1, summary: "s", hasImage: false }], "workbook")).toBeNull();
  });
});
