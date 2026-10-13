import { describe, expect, it } from "vitest";
import { appendExercises, exercisesToAdd, topUpPrompt } from "./exercise-topup";

type Ex = { kind: string; heading: string; body: string; items: string[]; answerKey?: string[] };
const ex = (h: string, n = 3): Ex => ({ kind: "practice", heading: h, body: "", items: Array.from({ length: n }, (_, i) => `i${i}`), answerKey: Array.from({ length: n }, (_, i) => `a${i}`) });

describe("exercise top-up", () => {
  it("adds up to the source page's count, at most 4 at a time", () => {
    expect(exercisesToAdd({ sourcePageNumber: 7, blocks: [ex("1 A")], sourceShape: { exercises: 5, pictures: 0 } })).toBe(4);
    expect(exercisesToAdd({ sourcePageNumber: 7, blocks: [ex("1 A"), ex("2 B")], sourceShape: { exercises: 3, pictures: 0 } })).toBe(1);
    expect(exercisesToAdd({ sourcePageNumber: 7, blocks: [], sourceShape: { exercises: 1, pictures: 0 } })).toBe(0);
    expect(exercisesToAdd({ sourcePageNumber: 7, blocks: [] })).toBe(0);
  });

  it("asks for exactly that many, keeping answers out of the page", () => {
    const p = topUpPrompt({ sourcePageNumber: 7, blocks: [ex("Family words")] }, 2, ["Circle the correct word."], "en");
    expect(p).toMatch(/exactly 2 new exercise blocks/);
    expect(p).toMatch(/never in a table/);
    expect(p).toMatch(/Circle the correct word\./);
  });

  it("appends exercises with items, leaving a bad answer key to the backfill", () => {
    const page = { sourcePageNumber: 7, blocks: [ex("A")] };
    const mismatched = { ...ex("B"), answerKey: ["only one"] };
    const keyless = { ...ex("C"), answerKey: undefined };
    const empty = { ...ex("D"), items: [] };
    const out = appendExercises(page, [ex("E"), mismatched, keyless, empty]).blocks;
    expect(out.map((b) => b.heading)).toEqual(["A", "E", "B", "C"]);
    expect(out.map((b) => b.answerKey?.length)).toEqual([3, 3, undefined, undefined]);
  });
});
