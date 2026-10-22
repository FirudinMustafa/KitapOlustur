import { describe, expect, it } from "vitest";
import { dropRepeatedBlocks } from "./dedupe-blocks";

describe("dropRepeatedBlocks", () => {
  it("drops a repeat of an exercise under a shortened heading", () => {
    const page = {
      blocks: [
        { heading: "5 Partner time: say and do", items: ["Stand up, please.", "Thank you."] },
        { heading: "5 Partner time", items: ["Stand up, please.", "Thank you."] },
        { heading: "6 Listen and stick", items: ["a red chair", "a green book"] },
      ],
    };
    expect(dropRepeatedBlocks(page).blocks.map((b) => b.heading)).toEqual(["5 Partner time: say and do", "6 Listen and stick"]);
  });

  it("keeps different exercises that share items", () => {
    const page = {
      blocks: [
        { heading: "1 Listen and point", items: ["chair", "book"] },
        { heading: "2 Say the words", items: ["chair", "book"] },
      ],
    };
    expect(dropRepeatedBlocks(page)).toBe(page);
  });

  it("keeps differently numbered exercises over the same words", () => {
    const page = {
      blocks: [
        { heading: "3 Listen", items: ["chair", "book"] },
        { heading: "4 Listen and repeat", items: ["chair", "book"] },
      ],
    };
    expect(dropRepeatedBlocks(page)).toBe(page);
  });

  it("keeps blocks without items", () => {
    const page = { blocks: [{ heading: "Remember" }, { heading: "Remember" }] };
    expect(dropRepeatedBlocks(page)).toBe(page);
  });
});
