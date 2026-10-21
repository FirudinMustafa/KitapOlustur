import { describe, expect, it } from "vitest";
import { splitEmoji } from "./activities";

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
