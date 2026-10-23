import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cardSheetGrid, cardSheetPrompt, cardSheetSize, cardSheetSlots, sliceCardSheet } from "./card-sheet";

describe("cardSheetGrid", () => {
  it("lays cards out in one row, then two, then three", () => {
    expect(cardSheetGrid(3)).toEqual({ cols: 3, rows: 1 });
    expect(cardSheetGrid(4)).toEqual({ cols: 2, rows: 2 });
    expect(cardSheetGrid(5)).toEqual({ cols: 3, rows: 2 });
    expect(cardSheetGrid(6)).toEqual({ cols: 3, rows: 2 });
    expect(cardSheetGrid(8)).toEqual({ cols: 4, rows: 2 });
    expect(cardSheetGrid(10)).toEqual({ cols: 5, rows: 2 });
    expect(cardSheetGrid(12)).toEqual({ cols: 4, rows: 3 });
    expect(cardSheetGrid(20)).toEqual({ cols: 4, rows: 3 });
  });

  it("picks the image size closest to the grid's shape", () => {
    expect(cardSheetSize({ cols: 3, rows: 2 })).toBe("1536x1024");
    expect(cardSheetSize({ cols: 2, rows: 2 })).toBe("1024x1024");
    expect(cardSheetSize({ cols: 5, rows: 2 })).toBe("1536x1024");
    expect(cardSheetSize({ cols: 1, rows: 2 })).toBe("1024x1536");
  });
});

describe("cardSheetPrompt", () => {
  it("names every card in grid order and forbids text", () => {
    const prompt = cardSheetPrompt(["a red pencil.", "a blue pencil", "a green pencil", "a yellow pencil", "an orange pencil"], "Style: flat.");
    expect(prompt).toContain("exactly 5 separate objects");
    expect(prompt).toContain("3 columns and 2 rows");
    expect(prompt).toContain("Row 1, left to right: (1) a red pencil; (2) a blue pencil; (3) a green pencil.");
    expect(prompt).toContain("Row 2, left to right: (4) a yellow pencil; (5) an orange pencil; then one empty cell.");
    expect(prompt).toMatch(/No text, no letters, no numbers/);
    expect(prompt).toMatch(/white background/i);
    expect(prompt).toContain("Style: flat.");
  });
});

describe("cardSheetSlots", () => {
  const extras = ["a red pencil", "a blue pencil", "a green pencil"];
  it("draws a card page's extra pictures on one sheet", () => {
    expect(cardSheetSlots({ pageType: "cards", imagePrompt: "a desk", extraImagePrompts: extras } as never)?.map((s) => s.slot)).toEqual([1, 2, 3]);
  });
  it("adds the main picture when there are fewer than three extras", () => {
    expect(cardSheetSlots({ pageType: "cards", imagePrompt: "a desk", extraImagePrompts: extras.slice(0, 2) } as never)?.map((s) => s.slot)).toEqual([0, 1, 2]);
  });
  it("reads the type from sourceShape too", () => {
    expect(cardSheetSlots({ sourceShape: { pageType: "cards" }, extraImagePrompts: extras } as never)).toHaveLength(3);
  });
  it("leaves other pages and short card pages alone", () => {
    expect(cardSheetSlots({ pageType: "content", extraImagePrompts: extras } as never)).toBeNull();
    expect(cardSheetSlots({ pageType: "cards", extraImagePrompts: extras.slice(0, 2) } as never)).toBeNull();
    expect(cardSheetSlots({ pageType: "cards", extraImagePrompts: [...extras, " "] } as never)).toBeNull();
  });
});

// A white sheet with one coloured block per cell, each off-centre in its cell.
async function fakeSheet(cols: number, rows: number, skip: number[] = []): Promise<Buffer> {
  const cell = 200;
  const blocks = [];
  for (let i = 0; i < cols * rows; i++) {
    if (skip.includes(i)) continue;
    blocks.push({
      input: { create: { width: 60, height: 90, channels: 3 as const, background: { r: 200, g: 30 * i, b: 40 } } },
      left: (i % cols) * cell + 20 + (i % 2) * 70,
      top: Math.floor(i / cols) * cell + 30,
    });
  }
  return sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: "#ffffff" } })
    .composite(blocks)
    .png()
    .toBuffer();
}

describe("sliceCardSheet", () => {
  it("cuts one centred square card per cell", async () => {
    const cards = await sliceCardSheet(await fakeSheet(3, 2), 3, 2, 6);
    expect(cards).toHaveLength(6);
    for (const [i, card] of cards.entries()) {
      const meta = await sharp(card).metadata();
      expect(meta.width).toBe(meta.height);
      expect(meta.width).toBeLessThan(120); // trimmed to the 60x90 block plus margin
      // The block sits in the middle of the card.
      const { data, info } = await sharp(card).raw().toBuffer({ resolveWithObject: true });
      const centre = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
      expect(data[centre + 1]).toBe(30 * i);
      expect(data[0]).toBe(255); // corner stays white
    }
  });

  it("returns only the first cards of a partly filled grid", async () => {
    const cards = await sliceCardSheet(await fakeSheet(3, 2, [5]), 3, 2, 5);
    expect(cards).toHaveLength(5);
  });

  it("refuses a sheet with an empty card cell", async () => {
    await expect(sliceCardSheet(await fakeSheet(3, 2, [2]), 3, 2, 6)).rejects.toThrow(/Card 3/);
  });
});
