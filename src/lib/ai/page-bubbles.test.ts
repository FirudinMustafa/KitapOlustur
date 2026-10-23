import { describe, expect, it } from "vitest";
import { bubbleDialogue, bubblesFromBoxes, hasBigMainPicture, pageBubbles, speakersOf, withoutBubbledDialogue, withPageBubbles } from "./page-bubbles";
import type { GeneratedPage, GeneratedUnit } from "./schemas";

const lines = [
  { speaker: "Mum", line: "I'm going to the shops." },
  { speaker: "Leo", line: "Can I come too?" },
  { speaker: "Mum", line: "Yes, of course!" },
];
const block = (dialogue?: { speaker: string; line: string }[], heading = "2 Listen and read") => ({ kind: "practice", heading, body: "Who is speaking?", dialogue }) as GeneratedPage["blocks"][number];
const scenePage = (n: number, blocks: GeneratedPage["blocks"], extra: Partial<GeneratedPage> = {}) =>
  ({ sourcePageNumber: n, pageType: "content", unitNumber: 1, blocks, sourceShape: { exercises: 1, pictures: 1, pageType: "scene" }, ...extra }) as GeneratedPage;

describe("bubbleDialogue", () => {
  it("takes the first dialogue of 2-8 short lines", () => {
    expect(bubbleDialogue({ blocks: [block(), block([lines[0]]), block(lines)] })).toEqual(lines);
  });

  it("skips dialogues with a long line, a missing speaker or too many turns", () => {
    const long = [lines[0], { speaker: "Leo", line: "This is a much longer line than any speech bubble on a picture should ever have to hold." }];
    const noSpeaker = [lines[0], { speaker: " ", line: "Hi!" }];
    const many = Array.from({ length: 9 }, (_, i) => ({ speaker: `S${i}`, line: "Hi!" }));
    expect(bubbleDialogue({ blocks: [block(long), block(noSpeaker), block(many)] })).toBeNull();
  });
});

describe("hasBigMainPicture", () => {
  it("is true for a scene and for a mirrored page whose main picture is large", () => {
    expect(hasBigMainPicture(scenePage(1, []))).toBe(true);
    const big = { bands: [{ kind: "pictures", height: 0.5, widths: [1] }, { kind: "text", columns: 1, weight: 1 }] };
    const small = { bands: [{ kind: "pictures", height: 0.12, widths: [0.25, 0.25, 0.25, 0.25] }, { kind: "text", columns: 1, weight: 1 }] };
    expect(hasBigMainPicture({ zonePlan: big } as unknown as GeneratedPage)).toBe(true);
    expect(hasBigMainPicture({ zonePlan: small, extraImagePrompts: ["a", "b", "c"] } as unknown as GeneratedPage)).toBe(false);
    expect(hasBigMainPicture({ blocks: [] } as unknown as GeneratedPage)).toBe(false);
  });
});

describe("speakersOf", () => {
  it("lists each speaker once, a recurring character with their looks", () => {
    const sheets = [{ name: "Leo Brown", visualDescription: "a boy with red hair", outfit: "a green T-shirt" }];
    expect(speakersOf(lines, sheets)).toEqual([{ name: "Mum" }, { name: "Leo", description: "a boy with red hair; wearing a green T-shirt" }]);
  });
});

describe("bubblesFromBoxes", () => {
  it("puts a bubble on every line whose speaker was found, at the head", () => {
    const bubbles = bubblesFromBoxes(lines, {
      speakers: [
        { name: "mum", found: true, head: [100, 200, 200, 300] },
        { name: "Leo", found: false, head: [] },
      ],
    });
    expect(bubbles).toEqual([
      { speaker: "Mum", line: "I'm going to the shops.", x: 0.25, y: 0.15, r: 0.05 },
      { speaker: "Mum", line: "Yes, of course!", x: 0.25, y: 0.15, r: 0.05 },
    ]);
  });

  it("drops malformed boxes and two speakers given one head", () => {
    const bubbles = bubblesFromBoxes(
      [...lines, { speaker: "Dad", line: "Bye!" }, { speaker: "Gran", line: "Hello!" }],
      {
        speakers: [
          { name: "Mum", found: true, head: [100, 200, 200, 300] },
          { name: "Leo", found: true, head: [101, 201, 199, 299] },
          { name: "Dad", found: true, head: [500, 500, 400, 600] },
          { name: "Gran", found: true, head: [0, 0, 900, 900] },
        ],
      },
    );
    expect(bubbles).toEqual([]);
  });
});

describe("withPageBubbles", () => {
  const found = lines.map((l) => ({ ...l, x: 0.5, y: 0.3 }));
  const unit = {
    unitNumber: 1,
    title: "Home",
    studentBookPages: [scenePage(4, [block(lines)]), scenePage(5, [block(lines)], { sourceShape: { exercises: 1, pictures: 1, pageType: "cards" } })],
    workbookPages: [scenePage(4, [block([lines[0], { speaker: "Leo", line: "Something else." }])])],
    glossary: [],
  } as GeneratedUnit;

  it("stores bubbles on pages carrying that dialogue on a big picture", () => {
    const next = withPageBubbles(unit, { 4: found, 5: found });
    expect(next.studentBookPages[0].bubbles).toEqual(found);
    expect(next.studentBookPages[1].bubbles).toBeUndefined();
    expect(next.workbookPages[0].bubbles).toBeUndefined();
  });

  it("returns the same unit when nothing applies or a line got no bubble", () => {
    expect(withPageBubbles(unit, {})).toBe(unit);
    expect(withPageBubbles(unit, { 4: found.slice(1) })).toBe(unit);
  });
});

describe("withoutBubbledDialogue", () => {
  const all = lines.map((l) => ({ ...l, x: 0.5, y: 0.5 }));

  it("drops the lines of a dialogue fully in bubbles, keeping its heading", () => {
    const page = scenePage(1, [block(lines), block(undefined, "3 Ask and answer")], { bubbles: all });
    const shown = withoutBubbledDialogue(page);
    expect(shown.blocks[0].dialogue).toBeUndefined();
    expect(shown.blocks[0].heading).toBe("2 Listen and read");
    expect(shown.blocks[1]).toBe(page.blocks[1]);
  });

  it("keeps a dialogue with a line left out, and a page without bubbles as it is", () => {
    const page = scenePage(1, [block(lines)], { bubbles: all.slice(0, 2) });
    expect(withoutBubbledDialogue(page)).toBe(page);
    const plain = scenePage(1, [block(lines)]);
    expect(withoutBubbledDialogue(plain)).toBe(plain);
  });

  it("ignores bubbles whose line was reworded after the picture", () => {
    const page = scenePage(1, [block([lines[0], { speaker: "Leo", line: "May I come?" }, lines[2]])], { bubbles: all });
    expect(pageBubbles(page)).toEqual([]);
    expect(withoutBubbledDialogue(page)).toBe(page);
    expect(pageBubbles({ ...page, blocks: [block(lines)] })).toEqual(all);
  });
});
