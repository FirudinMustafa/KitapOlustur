import { describe, expect, it } from "vitest";
import { numberExercises, numberUnitExercises, stripExerciseNumber } from "./exercise-numbers";

describe("numberExercises", () => {
  it("numbers the exercises on a page in order, replacing the writer's numbers", () => {
    const page = {
      blocks: [
        { kind: "narrative", heading: "Reading", body: "..." },
        { kind: "practice", heading: "3. Complete the sentences.", body: "", items: ["a"] },
        { kind: "practice", heading: "Exercise 7 - Match", body: "", items: ["b"] },
        { kind: "practice", heading: "Listen and repeat.", body: "", items: ["c"] },
      ],
    };
    expect(numberExercises(page).blocks.map((b) => b.heading)).toEqual(["Reading", "1 Complete the sentences.", "2 Match", "3 Listen and repeat."]);
  });

  it("starts from a given number", () => {
    const page = { blocks: [{ kind: "practice", heading: "Match", body: "", items: ["a"] }] };
    expect(numberExercises(page, 4).blocks[0].heading).toBe("4 Match");
  });

  it("leaves headings that are only a number alone", () => {
    expect(stripExerciseNumber("2")).toBe("2");
    expect(stripExerciseNumber("b) Write")).toBe("Write");
  });
});

describe("numberUnitExercises", () => {
  const ex = (h: string) => ({ kind: "practice", heading: h, body: "", items: ["a"] });
  const page = (n: number, headings: string[], firstExercise?: number) => ({
    sourcePageNumber: n,
    blocks: headings.map(ex),
    ...(firstExercise ? { sourceShape: { firstExercise } } : {}),
  });
  const numbers = (pages: ReturnType<typeof page>[]) => numberUnitExercises(pages).map((p) => p.blocks.map((b) => b.heading));

  it("goes on with the page before when the source page goes on with its lesson", () => {
    // i5 Team 2 lesson 1b: p.14 exercises 1-3, p.15 opens with 4.
    expect(numbers([page(14, ["Listen", "Read", "Tick"]), page(15, ["Grammar", "Complete"], 4)])).toEqual([
      ["1 Listen", "2 Read", "3 Tick"],
      ["4 Grammar", "5 Complete"],
    ]);
  });

  it("follows the generated page's count, not the source's number", () => {
    expect(numbers([page(6, ["A", "B"]), page(7, ["C"], 5)])[1]).toEqual(["3 C"]);
  });

  it("starts again at 1 on a page that opens a lesson, or whose page before is not its source neighbour", () => {
    expect(numbers([page(10, ["A", "B"]), page(11, ["C"]), page(13, ["D"], 3)])).toEqual([["1 A", "2 B"], ["1 C"], ["1 D"]]);
  });

  it("chains over several continuing pages", () => {
    expect(numbers([page(1, ["A"]), page(2, ["B"], 2), page(3, ["C", "D"], 3)])[2]).toEqual(["3 C", "4 D"]);
  });
});
