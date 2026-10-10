import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import { BookDocument } from "./BookDocument";
import { rasterizePdf } from "./rasterize";
import { activityIssues } from "@/lib/activities";

// A workbook unit using every activity format (src/lib/activities.ts) -
// the kind of page the British Council "Directions" sample is made of.
// FIXTURE_OUT=<dir> writes the page PNGs for a visual check.
const OUT = process.env.FIXTURE_OUT;

const places = [
  { label: "library", emoji: "📚", item: "a building with books" },
  { label: "park", emoji: "🌳", item: "a place with trees and grass" },
  { label: "museum", emoji: "🏛️", item: "a building with old things" },
  { label: "cinema", emoji: "🎬", item: "a place to watch films" },
  { label: "bank", emoji: "🏦", item: "a place for money" },
  { label: "supermarket", emoji: "🛒", item: "a shop for food" },
  { label: "school", emoji: "🏫", item: "a place to learn" },
  { label: "hospital", emoji: "🏥", item: "a place for sick people" },
];

export const activityUnit = {
  unitNumber: 1,
  title: "My Town",
  studentBookPages: [],
  workbookPages: [
    {
      sourcePageNumber: 1,
      pageType: "practice",
      layoutTemplate: "exercise-grid",
      blocks: [
        {
          kind: "practice",
          heading: "1 Places in town",
          body: "Look at the pictures. Write the words.",
          items: places.map((p) => p.item),
          answerKey: places.map((p) => p.label),
          activity: { type: "picture_label", words: places.map((p) => p.label).reverse(), pictures: places.map(({ label, emoji }) => ({ label, emoji })) },
        },
        {
          kind: "practice",
          heading: "2 Match the words and pictures",
          body: "Draw a line.",
          items: ["swimming pool", "train station", "café", "toy shop"],
          answerKey: ["c", "a", "d", "b"],
          activity: {
            type: "picture_match",
            pictures: [
              { label: "train station", emoji: "🚉" },
              { label: "toy shop", emoji: "🧸" },
              { label: "swimming pool", emoji: "🏊" },
              { label: "café", emoji: "☕" },
            ],
          },
        },
      ],
    },
    {
      sourcePageNumber: 2,
      pageType: "practice",
      blocks: [
        {
          kind: "practice",
          heading: "3 Complete the sentences",
          body: "Use the words in the box.",
          items: ["The park is ___ the school.", "The bank is ___ the café and the shop.", "The cinema is ___ the museum."],
          answerKey: ["next to", "between", "opposite"],
          activity: { type: "word_bank", words: ["opposite", "next to", "between", "behind"] },
        },
        {
          kind: "practice",
          heading: "4 Answer the questions",
          body: "Write full sentences.",
          items: ["Where is your school?", "What is your favourite place in town? Why?"],
          answerKey: ["e.g. My school is next to the park.", "e.g. My favourite place is the library because I like books."],
          activity: { type: "write_lines", lines: 2 },
        },
        {
          kind: "practice",
          heading: "5 Draw your street",
          body: "Draw your street. Then write three sentences about it.",
          items: [],
          activity: { type: "draw_box", lines: 8 },
        },
      ],
    },
  ],
} as unknown as GeneratedUnit;

describe("workbook activities", () => {
  it("are valid by their own structural rules", () => {
    for (const page of activityUnit.workbookPages) for (const block of page.blocks) expect(activityIssues(block)).toEqual([]);
    expect(activityIssues({ heading: "x", items: ["a", "b"], activity: { type: "picture_label", pictures: [{ label: "a" }] } })).toHaveLength(1);
  });

  it("print on their own pages with the answers only at the back", async () => {
    const buffer = await renderToBuffer(
      <BookDocument bookTitle="My Town" variant="workbook" units={[activityUnit]} level="A1" contentsUnits={[]} designTheme="playful-kids" contentLanguage="en" />,
    );
    const pages = await rasterizePdf(new Uint8Array(buffer), { dpi: OUT ? 80 : 20 });
    if (OUT) {
      mkdirSync(OUT, { recursive: true });
      for (const p of pages) writeFileSync(path.join(OUT, `activities-${p.pageNumber}.png`), p.png);
    }
    // cover + imprint + contents + 2 activity pages + answer key
    expect(pages.length).toBe(6);
  }, 60_000);
});
