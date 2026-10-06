import { describe, expect, it } from "vitest";
import { itemText } from "./item-text";

describe("itemText", () => {
  it("strips a model-written leading number", () => {
    expect(itemText("1. The big, green monster.")).toBe("The big, green monster.");
    expect(itemText("12) Sayıları yaz")).toBe("Sayıları yaz");
    expect(itemText("(3) answer")).toBe("answer");
  });

  it("keeps content that merely starts with a number", () => {
    expect(itemText("10 elma var.")).toBe("10 elma var.");
    expect(itemText("1.5 kg un")).toBe("1.5 kg un");
    expect(itemText("2024 yılında")).toBe("2024 yılında");
  });
});
