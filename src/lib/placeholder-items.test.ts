import { describe, expect, it } from "vitest";
import { isPlaceholderItem, placeholderItemIssue } from "./placeholder-items";

describe("placeholder items", () => {
  it("catches stand-ins the writer left in", () => {
    for (const s of ["Picture of a ball", "a picture of a sandwich", "Image of a cat", "Item 1", "item 12", "Question 3"]) {
      expect(isPlaceholderItem(s)).toBe(true);
    }
  });

  it("leaves real items alone", () => {
    for (const s of ["Look at the picture of the room. How many beds are there?", "The bag of Maya", "ball", "Itemise your list", "12"]) {
      expect(isPlaceholderItem(s)).toBe(false);
    }
  });

  it("names the block and the items", () => {
    expect(placeholderItemIssue({ heading: "Topic Match", items: ["Picture of a ball", "sandwich"] }, "Student Book, page 11")).toContain('"Picture of a ball"');
    expect(placeholderItemIssue({ heading: "Fine", items: ["ball"] }, "x")).toBeNull();
  });
});
