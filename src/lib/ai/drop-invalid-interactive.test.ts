import { describe, expect, it } from "vitest";
import { dropInvalidInteractive } from "./drop-invalid-interactive";

describe("dropInvalidInteractive", () => {
  it("drops an interactive object missing its required fields", () => {
    const input = {
      pages: [{ blocks: [{ heading: "h", body: "b", interactive: { type: "multiple_choice" } }] }],
    };
    expect(dropInvalidInteractive(input)).toEqual({ pages: [{ blocks: [{ heading: "h", body: "b" }] }] });
  });

  it("keeps valid interactive objects untouched", () => {
    const interactive = { type: "fill_blank", template: "The ___ cat.", blanks: ["big"] };
    const input = { blocks: [{ heading: "h", body: "b", interactive }] };
    expect(dropInvalidInteractive(input)).toEqual(input);
  });
});
