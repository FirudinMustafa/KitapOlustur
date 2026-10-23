import { describe, expect, it } from "vitest";
import { isTileGrid, worksheetLayout } from "./worksheet-layout";
import type { ContentBlock } from "@/lib/ai/schemas";

const A4 = { width: 595.28, height: 841.89, bodySize: 10.5 };
const block = (heading: string, items: string[], extra: Partial<ContentBlock> = {}): ContentBlock =>
  ({ kind: "practice", heading, body: "Write the word.", items, answerKey: items, ...extra }) as ContentBlock;
const labels = (n: number) =>
  block(
    "2 Look and write",
    Array.from({ length: n }, (_, i) => `thing ${i + 1}`),
    { activity: { type: "picture_label", pictures: Array.from({ length: n }, (_, i) => ({ label: `thing ${i + 1}`, emoji: "🍎" })) } } as Partial<ContentBlock>,
  );
const ticks = (heading = "3 Tick or cross") => block(heading, ["The sun is yellow.", "A frog is pink.", "The sky is blue.", "An orange is blue."], { activity: { type: "tick_cross" } } as Partial<ContentBlock>);

describe("worksheetLayout", () => {
  it("sets a picture-labelling exercise of 4+ pictures as big tiles that grow into the page", () => {
    expect(isTileGrid(labels(6))).toBe(true);
    expect(isTileGrid(labels(3))).toBe(false);
    const l = worksheetLayout({ blocks: [labels(6), ticks()] }, A4);
    expect(l?.sheets).toHaveLength(1);
    const grid = l!.sheets[0].items[0].grid!;
    // far past PictureLabelGrid's 54pt pictures
    expect(grid.faceHeight).toBeGreaterThan(100);
    expect(grid.columns * Math.ceil(6 / grid.columns)).toBeGreaterThanOrEqual(6);
  });

  it("keeps a page on one sheet until it is told to split, then splits between whole exercises", () => {
    const blocks = [ticks("1 A"), labels(8), ticks("3 B"), ticks("4 C"), ticks("5 D")];
    expect(worksheetLayout({ blocks }, A4)?.sheets).toHaveLength(1);
    const split = worksheetLayout({ blocks }, A4, { split: true })!;
    expect(split.sheets.length).toBeGreaterThanOrEqual(2);
    expect(split.sheets.flatMap((s) => s.items.map((it) => it.block.heading))).toEqual(blocks.map((b) => b.heading));
    // a one-exercise page has nothing to split
    expect(worksheetLayout({ blocks: [ticks()] }, A4, { split: true })).toBeNull();
  });

  it("gives a sheet's measured slack only to that sheet", () => {
    const blocks = [ticks("1 A"), labels(8), ticks("3 B"), ticks("4 C")];
    const plain = worksheetLayout({ blocks }, A4, { split: true })!;
    const grown = worksheetLayout({ blocks }, A4, { split: true, slack: (k) => (k === 1 ? 120 : undefined) })!;
    expect(grown.sheets.map((s) => s.items.length)).toEqual(plain.sheets.map((s) => s.items.length));
    expect(grown.sheets[0]).toEqual(plain.sheets[0]);
  });

  it("puts the page's picture on top when there is room, else beside an exercise of short lines", () => {
    const roomy = worksheetLayout({ blocks: [ticks()] }, A4, { hasMain: true })!;
    expect(roomy.sheets[0].mainHeight).toBeGreaterThanOrEqual(110);
    const full = worksheetLayout({ blocks: [labels(8), ticks("3 B"), ticks("4 C"), ticks("5 D")] }, A4, { hasMain: true })!;
    const sheet = full.sheets[0];
    expect(sheet.mainHeight).toBe(0);
    const beside = sheet.items.find((it) => it.side);
    expect(beside?.block.activity?.type).toBe("tick_cross");
    expect(beside?.sideHeight).toBeGreaterThan(50);
  });

  it("grows counting-row pictures to fit their column", () => {
    const counting = block("3 How many?", ["⭐⭐⭐ = ___", "🐟🐟🐟🐟🐟🐟🐟🐟 = ___"], { activity: { type: "word_bank", words: ["three", "eight"] } } as Partial<ContentBlock>);
    const item = worksheetLayout({ blocks: [counting] }, A4)!.sheets[0].items[0];
    expect(item.emoji).toBeGreaterThan(13);
    expect(item.emoji).toBeLessThanOrEqual(21);
  });

  it("leaves pages it cannot set to the other layouts", () => {
    expect(worksheetLayout({ blocks: [] }, A4)).toBeNull();
    expect(worksheetLayout({ blocks: [ticks()], glossary: [{ term: "a" }] }, A4)).toBeNull();
  });
});
