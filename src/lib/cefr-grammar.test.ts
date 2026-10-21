import { describe, expect, it } from "vitest";
import { grammarInventory } from "./cefr-grammar";

describe("grammarInventory", () => {
  it("lists the level's grammar cumulatively and names the next level's to avoid", () => {
    const a2 = grammarInventory("CEFR A2")!;
    expect(a2).toContain("have got"); // A1, carried up
    expect(a2).toContain("past simple, regular and irregular");
    expect(a2).toMatch(/avoid\): past continuous/);
  });

  it("is empty for non-CEFR levels", () => {
    expect(grammarInventory("Grade 7")).toBeNull();
  });
});
