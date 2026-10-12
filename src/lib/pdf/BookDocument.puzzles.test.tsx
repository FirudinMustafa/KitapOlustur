import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ContentBlock, GeneratedUnit } from "@/lib/ai/schemas";
import { BookDocument } from "./BookDocument";
import { rasterizePdf } from "./rasterize";
import { activityIssues, repairPuzzle } from "@/lib/activities";
import { estimateTemplateFit } from "@/lib/design/layouts";

// Faz B4: every puzzle and marking format on two workbook pages.
// FIXTURE_OUT=<dir> writes the page PNGs for a visual check.
const OUT = process.env.FIXTURE_OUT;

const blocks: ContentBlock[] = [
  {
    kind: "practice",
    heading: "1 Do the crossword.",
    body: "",
    items: ["You sleep in it.", "You cook in this room.", "You open it to go in.", "It is on top of the house.", "You look out of it.", "Flowers grow here."],
    answerKey: ["bed", "kitchen", "door", "roof", "window", "garden"],
    activity: { type: "crossword" },
  },
  {
    kind: "practice",
    heading: "2 Find the words.",
    body: "",
    items: ["sofa", "lamp", "table", "chair", "shelf", "rug"],
    answerKey: ["sofa", "lamp", "table", "chair", "shelf", "rug"],
    activity: { type: "wordsearch" },
  },
  {
    kind: "practice",
    heading: "3 Put the letters in order.",
    body: "",
    items: ["You wash here.", "You sit on it.", "You keep clothes in it."],
    answerKey: ["bathroom", "chair", "wardrobe"],
    activity: { type: "unscramble" },
  },
  {
    kind: "practice",
    heading: "4 Circle the odd one out.",
    body: "",
    items: ["bed / sofa / banana / chair", "kitchen / bedroom / bathroom / bus"],
    answerKey: ["banana", "bus"],
    activity: { type: "odd_one_out" },
  },
  {
    kind: "practice",
    heading: "5 Read and tick (✓) or cross (✗).",
    body: "",
    items: ["Sam's room is big.", "There is a lamp on the desk.", "The bed is under the window."],
    answerKey: ["false", "✓", "✗"],
    activity: { type: "tick_cross" },
  },
  {
    kind: "practice",
    heading: "6 Number the sentences in order.",
    body: "",
    items: ["Then I have breakfast.", "I wake up at seven.", "Finally, I go to school."],
    answerKey: ["2", "1", "3"],
    activity: { type: "ordering" },
  },
  {
    kind: "practice",
    heading: "7 Match.",
    body: "",
    items: ["Where is", "I've got", "Can you"],
    answerKey: ["the cat?", "a new bike.", "swim?"],
    activity: { type: "match_lines" },
  },
];

const unit = {
  unitNumber: 1,
  title: "My Home",
  studentBookPages: [],
  glossary: [],
  workbookPages: [
    { sourcePageNumber: 1, pageType: "exercise", unitNumber: 1, layoutTemplate: "two-column", blocks: blocks.slice(0, 2) },
    { sourcePageNumber: 2, pageType: "exercise", unitNumber: 1, layoutTemplate: "two-column", blocks: blocks.slice(2) },
  ],
} as GeneratedUnit;

describe("puzzle and marking activities", () => {
  it("passes the structural checks", () => {
    for (const b of blocks) expect(activityIssues(repairPuzzle(b))).toEqual([]);
  });

  it("flags bad puzzle content and repairs what can be repaired", () => {
    const bad = { ...blocks[0], items: [...blocks[0].items!, "xyz"], answerKey: [...blocks[0].answerKey!, "qqq"] };
    expect(activityIssues(bad).join(" ")).toMatch(/share no letters/);
    expect(repairPuzzle(bad).answerKey).toEqual(blocks[0].answerKey);
    expect(activityIssues({ ...blocks[3], answerKey: ["apple", "bus"] }).join(" ")).toMatch(/must be one of the item's words/);
    expect(activityIssues({ ...blocks[5], answerKey: ["1", "1", "3"] }).join(" ")).toMatch(/using each number/);
    expect(repairPuzzle(blocks[4]).answerKey).toEqual(["✗", "✓", "✗"]);
  });

  it("renders every format, each page on one sheet", async () => {
    for (const page of unit.workbookPages) {
      const fit = estimateTemplateFit(page, "two-column", false, false);
      expect(fit.needed).toBeLessThanOrEqual(fit.available);
    }
    const buffer = await renderToBuffer(
      <BookDocument
        bookTitle="Open Streets"
        variant="workbook"
        units={[{ ...unit, workbookPages: unit.workbookPages.map((p) => ({ ...p, blocks: p.blocks.map(repairPuzzle) })) }]}
        level="A1"
        contentsUnits={[]}
        designTheme="classic"
        contentLanguage="en"
        includeCover={false}
      />,
    );
    const pages = await rasterizePdf(new Uint8Array(buffer), { dpi: OUT ? 80 : 20 });
    if (OUT) {
      mkdirSync(OUT, { recursive: true });
      for (const p of pages) writeFileSync(path.join(OUT, `puzzles-${p.pageNumber}.png`), p.png);
    }
    // imprint + contents + 2 pages + answer key
    expect(pages.length).toBe(5);
  }, 60_000);
});
