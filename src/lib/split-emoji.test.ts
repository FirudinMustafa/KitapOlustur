import { describe, expect, it } from "vitest";
import { splitEmoji, tileKind } from "./activities";

describe("tileKind", () => {
  it("finds number and colour lists", () => {
    expect(tileKind(["1", "2", "3", "4"])).toBe("numbers");
    expect(tileKind(["Red", "blue", "green."])).toBe("colors");
  });

  it("leaves ordinary items alone", () => {
    expect(tileKind(["1", "2"])).toBeNull();
    expect(tileKind(["Pencil 2", "Pencil 4", "Pencil 6"])).toBeNull();
    expect(tileKind(["red", "a red chair", "blue"])).toBeNull();
  });
});

describe("splitEmoji", () => {
  it("splits counting items into single emoji and text", () => {
    expect(splitEmoji("🍎🍎 = ___")).toEqual([{ emoji: "🍎" }, { emoji: "🍎" }, { text: " = ___" }]);
  });

  it("keeps variation selectors with their emoji", () => {
    expect(splitEmoji("a ✏️ b")).toEqual([{ text: "a " }, { emoji: "✏️" }, { text: " b" }]);
  });

  it("returns plain text untouched", () => {
    expect(splitEmoji("I'm Leo.")).toEqual([{ text: "I'm Leo." }]);
  });
});
