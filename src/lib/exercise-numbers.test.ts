import { describe, expect, it } from "vitest";
import { numberExercises, stripExerciseNumber } from "./exercise-numbers";

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

  it("leaves headings that are only a number alone", () => {
    expect(stripExerciseNumber("2")).toBe("2");
    expect(stripExerciseNumber("b) Write")).toBe("Write");
  });
});
