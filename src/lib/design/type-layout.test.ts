import { describe, expect, it } from "vitest";
import { cardColumns, cardFace, typedLayout, type TypedPictures } from "./type-layout";
import type { ContentBlock } from "@/lib/ai/schemas";

const A4 = { width: 595.28, height: 841.89, bodySize: 10.5 };
const block = (heading: string, items?: string[], body = "Point and say."): ContentBlock => ({ kind: "practice", heading, body, items }) as ContentBlock;
const pics = (main: string | undefined, extras: (string | undefined)[] = [], prompts: string[] = []): TypedPictures => ({ main, extras, prompts });

describe("typedLayout: scene", () => {
  it("puts the first exercise on the pill and its single-word items on chips", () => {
    const t = typedLayout("scene", { blocks: [block("1 Listen, point and say", ["window", "door", "chair"]), block("2 Listen and chant", ["Chair, chair, sit!"])] }, pics("scene.png"), A4);
    expect(t).toMatchObject({ type: "scene", chips: ["window", "door", "chair"] });
    expect(t?.type === "scene" && t.rest.map((b) => b.heading)).toEqual(["2 Listen and chant"]);
  });

  it("puts sentence items on the panel, not on chips", () => {
    const t = typedLayout("scene", { blocks: [block("1 Listen and say", ["I'm Misty and this is my classroom.", "Hello!"])] }, pics("scene.png"), A4);
    expect(t).toMatchObject({ type: "scene", chips: [] });
    expect(t?.type === "scene" && t.rest[0].items).toHaveLength(2);
  });

  it("needs the scene picture, and gives up a page with too much text for its panel", () => {
    expect(typedLayout("scene", { blocks: [block("1 Look", ["a"])] }, pics(undefined), A4)).toBeNull();
    const long = Array.from({ length: 8 }, (_, i) => block(`${i + 2} Read`, ["one long sentence about the picture", "another long sentence about it"], "A long rubric that runs on."));
    expect(typedLayout("scene", { blocks: [block("1 Look", ["cat"]), ...long] }, pics("scene.png"), A4)).toBeNull();
  });
});

describe("typedLayout: cards", () => {
  it("draws number tiles for a list of numbers, the rest of the page below", () => {
    const t = typedLayout("cards", { blocks: [block("1 Listen and say the numbers", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]), block("2 Count", ["3", "5"])] }, pics(undefined), A4);
    expect(t?.type).toBe("cards");
    if (t?.type !== "cards") return;
    expect(t.cards.every((c) => c.face.kind === "number")).toBe(true);
    expect(t.columns).toBe(5);
    expect(t.rest).toHaveLength(1);
    expect(t.faceHeight).toBeGreaterThan(48);
  });

  it("puts each card's own picture on it and the main picture under the grid", () => {
    const words = ["pencil", "book", "chair", "door"];
    const t = typedLayout("cards", { blocks: [block("1 Look and say", words)] }, pics("main.png", words.map((w) => `${w}.png`), words.map((w) => `A single ${w} on white`)), A4);
    if (t?.type !== "cards") throw new Error("not cards");
    expect(t.cards.map((c) => c.face)).toEqual(words.map((w) => ({ kind: "picture", src: `${w}.png` })));
    expect(t.mainHeight).toBeGreaterThan(0);
  });

  it("gives up a card page whose pictures are not one per card (older runs)", () => {
    const t = typedLayout(
      "cards",
      { blocks: [block("1 Touch and say", ["chair", "book", "pencil"])] },
      pics("main.png", ["x1.png", "x2.png", "x3.png"], ["Three flashcards: a chair, a book and a pencil", "A table, a window and a door", "A closed book"]),
      A4,
    );
    expect(t).toBeNull();
  });

  it("is null without a short-item exercise", () => {
    expect(typedLayout("cards", { blocks: [block("1 Find and colour", ["Picture 1: Misty's T-shirt", "Picture 2: Pip", "Picture 3: the door"])] }, pics("m.png"), A4)).toBeNull();
  });
});

describe("typedLayout: panels", () => {
  const story = block("1 Watch and listen to the story", ["Hello, Misty!", "I'm Leo.", "I'm Misty.", "Hello!", "I'm Aisha.", "Hello, friends!"], "Who says it?");

  it("lays the story pictures in two columns with a speech line each", () => {
    const t = typedLayout("panels", { blocks: [story] }, pics("p1.png", ["p2.png", "p3.png", "p4.png", "p5.png", "p6.png"]), A4);
    expect(t).toMatchObject({ type: "panels", columns: 2, lines: story.items });
    expect(t?.type === "panels" && t.pictures).toHaveLength(6);
  });

  it("needs four panel pictures in a row", () => {
    expect(typedLayout("panels", { blocks: [story] }, pics("p1.png", ["p2.png", undefined, "p4.png"]), A4)).toBeNull();
  });
});

describe("typedLayout: shared", () => {
  it("leaves mixed pages and pages with a word list to the zone layout", () => {
    expect(typedLayout("mixed", { blocks: [block("1 Look", ["a"])] }, pics("m.png"), A4)).toBeNull();
    expect(typedLayout("scene", { blocks: [block("1 Look", ["cat"])], glossary: [{ term: "cat" }] }, pics("m.png"), A4)).toBeNull();
  });
});

describe("cardFace / cardColumns", () => {
  it("falls back to number tiles, colour pencils and words", () => {
    expect(cardFace("3", "x.png", "three kites")).toEqual({ kind: "number", n: "3" });
    expect(cardFace("red", undefined, undefined)).toMatchObject({ kind: "color" });
    expect(cardFace("kites", "k.png", "A kite on white")).toEqual({ kind: "picture", src: "k.png" });
    expect(cardFace("ruler", "x.png", "A pencil")).toEqual({ kind: "word" });
  });

  it("sets card grids as the source does", () => {
    expect([3, 4, 6, 8, 10].map(cardColumns)).toEqual([3, 4, 3, 4, 5]);
  });
});
