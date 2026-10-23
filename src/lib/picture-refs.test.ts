import { describe, expect, it } from "vitest";
import { dropMissingPictureRefs, missingPictureRefIssue } from "./picture-refs";

const page = (imagePrompt?: string, extraImagePrompts?: string[]) => ({
  sourcePageNumber: 6,
  imagePrompt,
  extraImagePrompts,
  blocks: [{ heading: "1 Find, color and say", items: ["Picture 1: Misty's T-shirt", "Picture 3: Pip", "Picture 4: the door"] }],
});

describe("picture references", () => {
  it("flags items pointing at pictures the page does not have", () => {
    expect(missingPictureRefIssue(page("friends in a circle"), "Student Book")).toMatch(/refers to picture 4 but the page has 1 picture\./);
  });

  it("accepts a page with all its pictures", () => {
    expect(missingPictureRefIssue(page("a", ["b", "c", "d"]), "Student Book")).toBeNull();
  });

  it("drops only the pointers that go nowhere", () => {
    expect(dropMissingPictureRefs(page("friends in a circle")).blocks[0].items).toEqual(["Picture 1: Misty's T-shirt", "Pip", "the door"]);
  });
});
