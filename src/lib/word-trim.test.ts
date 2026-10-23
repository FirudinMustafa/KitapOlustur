import { describe, expect, it } from "vitest";
import type { GeneratedPage, GeneratedUnit } from "@/lib/ai/schemas";
import { pageWordCount } from "./source-shape";
import { firstSentence, trimPageToBudget, trimUnitToBudget } from "./word-trim";

type Block = GeneratedPage["blocks"][number];
const exercise = (heading: string, body: string, items: string[]): Block => ({ kind: "practice", heading, body, items, answerKey: items });
const box = (callout: Block["callout"], heading: string, body: string): Block => ({ kind: "reference", heading, body, callout });
const page = (blocks: Block[], words?: number): GeneratedPage =>
  ({ sourcePageNumber: 3, pageType: "content", blocks, ...(words !== undefined ? { sourceShape: { exercises: 1, pictures: 1, words } } : {}) }) as GeneratedPage;

describe("firstSentence", () => {
  it("keeps the first sentence", () => {
    expect(firstSentence("Say the colours. Then point.")).toBe("Say the colours.");
    expect(firstSentence("Hello! I'm Misty.")).toBe("Hello!");
    expect(firstSentence("No full stop")).toBe("No full stop");
  });
});

describe("trimPageToBudget", () => {
  it("leaves a page within budget, or without one, alone", () => {
    const p = page([exercise("1 Listen and point", "Say the names. Then wave.", ["Leo", "Amina"])], 11);
    expect(trimPageToBudget(p)).toBe(p); // 11 words, budget 31
    const noBudget = page([exercise("1 Listen and point", "A long rubric. ".repeat(20), ["Leo"])]);
    expect(trimPageToBudget(noBudget)).toBe(noBudget);
  });

  it("drops side boxes after the first, then shortens instructions, never items", () => {
    const items = ["kitten", "boy", "girl", "tree", "sun", "flower"];
    const p = page(
      [
        exercise("1 Listen and sing", "Wave, clap and stomp with the song. Sing it twice.", items),
        box("remember", "Friends", "Friends are kind. They share."),
        box("did_you_know", "Cats", "Cats sleep a lot. They sleep sixteen hours a day."),
        box("remember", "Colours", "Red and yellow make orange."),
      ],
      4, // budget 24
    );
    const out = trimPageToBudget(p);
    expect(out.blocks.map((b) => b.heading)).toEqual(["1 Listen and sing", "Friends"]);
    expect(out.blocks[0].items).toEqual(items);
    expect(out.blocks[0].answerKey).toEqual(items);
    expect(pageWordCount(out)).toBeLessThanOrEqual(24);
    // stopped as soon as it fitted: the remaining box was not cut
    expect(out.blocks[1].body).toBe("Friends are kind. They share.");
  });

  it("drops an instruction that repeats the heading first", () => {
    const p = page([exercise("1 Listen and point", "Listen and point.", ["a", "b"]), box("remember", "Say it", "Hello! I'm Misty. What's your name?")], 1);
    // budget 21: 4 + 3 + 12 + 2 + 7 = 28 words
    const long = { ...p, blocks: [{ ...p.blocks[0], items: Array(12).fill("word"), answerKey: Array(12).fill("word") }, p.blocks[1]] };
    const out = trimPageToBudget(long);
    expect(out.blocks[0].body).toBe("");
    expect(out.blocks[1].body).toBe("Hello! I'm Misty. What's your name?");
  });

  it("keeps reading texts, grammar boxes, examples and dialogue", () => {
    const story = { kind: "narrative", heading: "The story", body: "Leo has a kite. It is red. The wind takes it. Misty runs after it." } as Block;
    const grammar = box("grammar", "Grammar", "I'm = I am. You're = you are. Use them to talk.");
    const example = exercise("2 Read and circle", "Example: a red pencil.", ["a book / two books"]);
    const dialogue = { kind: "narrative", heading: "Talk", body: "", dialogue: [{ speaker: "Leo", line: "Hello! I'm Leo. What's your name?" }] } as Block;
    const p = page([story, grammar, example, dialogue], 1);
    const out = trimPageToBudget(p);
    expect(out.blocks).toHaveLength(4);
    expect(out.blocks[0].body).toBe(story.body);
    expect(out.blocks[1].body).toBe(grammar.body);
    expect(out.blocks[2].body).toBe("Example: a red pencil.");
    expect(out.blocks[3].dialogue).toEqual(dialogue.dialogue);
  });

  it("does not count, or drop, tips the book hides", () => {
    const tip = box("tip", "Teacher", "Sing every day. End with the goodbye song. Home: sing with family.");
    const p = page([exercise("1 Listen and sing", "Wave, clap, stomp!", ["kitten", "boy", "girl", "tree", "sun", "flower"]), tip], 11);
    expect(pageWordCount(p)).toBe(26);
    expect(pageWordCount(p, { hideTips: true })).toBe(13);
    expect(trimPageToBudget({ ...p, sourceShape: { exercises: 1, pictures: 1, words: 1 } }, { hideTips: true }).blocks[1]).toBe(tip);
  });

  it("drops an exercise's extra instruction when its heading is one", () => {
    const p = page([exercise("1 Listen and point", "Say the names of the children.", ["Leo", "Amina", "Mei", "Sam", "Leo", "Amina", "Mei", "Sam"]), exercise("2", "Ask a friend.", ["Hello!"])], 1);
    const out = trimPageToBudget(p);
    expect(out.blocks[0].body).toBe("");
    expect(out.blocks[1].body).toBe("Ask a friend."); // a bare number is no instruction
  });

  it("never drops a box a listening script belongs to", () => {
    const p = page([box("remember", "A", "One two three four five."), box("remember", "Chant", "Red, red, I see red! Show me red!")], 1);
    const out = trimPageToBudget(p, { protectedHeadings: new Set(["chant"]) });
    expect(out.blocks.map((b) => b.heading)).toEqual(["A", "Chant"]);
  });
});

describe("trimUnitToBudget", () => {
  it("trims Student Book and Workbook pages and keeps the unit when nothing changes", () => {
    const over = page([exercise("1 Look", "Look at the picture. Find the cat.", ["cat"]), box("remember", "A", "x"), box("tip", "B", "Tip one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen.")], 1);
    const unit = { unitNumber: 1, title: "U", studentBookPages: [over], workbookPages: [], glossary: [] } as GeneratedUnit;
    const adult = trimUnitToBudget(unit, "A1");
    expect(adult.studentBookPages[0].blocks.map((b) => b.heading)).toEqual(["1 Look", "A"]);
    // young learners: the tip doesn't print, the page already fits after a lighter trim
    const young = trimUnitToBudget(unit, "Pre-A1");
    expect(young.studentBookPages[0].blocks.some((b) => b.callout === "tip")).toBe(true);
    const fits = { ...unit, studentBookPages: [page([exercise("1 Look", "Look.", ["cat"])], 11)] };
    expect(trimUnitToBudget(fits, "A1")).toBe(fits);
  });
});
