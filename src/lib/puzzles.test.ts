import { describe, expect, it } from "vitest";
import { buildCrossword, buildWordSearch, crosswordCells, oddOneOutOptions, scrambleWord, tickAnswer } from "./puzzles";

describe("buildCrossword", () => {
  it("interlocks the answers into one consistent grid", () => {
    const answers = ["house", "garden", "door", "roof", "window"];
    const cw = buildCrossword(answers);
    expect(cw.unplaced).toEqual([]);
    expect(cw.words).toHaveLength(5);
    // every letter written into a cell agrees with every word crossing it
    const letters = new Map<string, string>();
    for (const w of cw.words) {
      w.letters.forEach((l, i) => {
        const key = w.dir === "across" ? `${w.row},${w.col + i}` : `${w.row + i},${w.col}`;
        expect(letters.get(key) ?? l).toBe(l);
        letters.set(key, l);
      });
    }
    const cells = crosswordCells(cw);
    expect(cells.flat().filter(Boolean)).toHaveLength(letters.size);
    // each clue number starts exactly once
    expect(cells.flat().flatMap((c) => c?.starts ?? []).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("reports answers that share no letter with the rest", () => {
    const cw = buildCrossword(["cat", "cot", "xyz"]);
    expect(cw.unplaced).toEqual([2]);
  });

  it("is deterministic", () => {
    expect(buildCrossword(["apple", "pear", "plum", "lemon"])).toEqual(buildCrossword(["apple", "pear", "plum", "lemon"]));
  });
});

describe("buildWordSearch", () => {
  it("hides every word in a square grid", () => {
    const words = ["cat", "dog", "bird", "fish", "horse"];
    const ws = buildWordSearch(words, "Animals");
    expect(ws.unplaced).toEqual([]);
    expect(ws.grid).toHaveLength(ws.size);
    const rows = ws.grid.map((r) => r.join(""));
    const cols = ws.grid[0].map((_, c) => ws.grid.map((r) => r[c]).join(""));
    for (const w of words) expect([...rows, ...cols].some((line) => line.includes(w.toUpperCase()))).toBe(true);
    expect(buildWordSearch(words, "Animals")).toEqual(ws);
  });
});

describe("scrambleWord", () => {
  it("never spells the answer and keeps its letters", () => {
    for (const w of ["house", "garden", "at", "school"]) {
      const s = scrambleWord(w, "seed");
      expect(s).not.toBe(w);
      expect([...s].sort().join("")).toBe([...w].sort().join(""));
    }
  });
});

describe("helpers", () => {
  it("reads odd-one-out options and tick answers", () => {
    expect(oddOneOutOptions("cat / dog / apple / bird")).toEqual(["cat", "dog", "apple", "bird"]);
    expect(tickAnswer("✓")).toBe(true);
    expect(tickAnswer("False")).toBe(false);
    expect(tickAnswer("maybe")).toBeNull();
  });
});
