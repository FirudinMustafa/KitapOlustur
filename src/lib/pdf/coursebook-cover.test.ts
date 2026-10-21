import { describe, expect, it } from "vitest";
import { readableOn, splitTitle } from "./CoursebookCover";

describe("coursebook cover (KIYAS-13)", () => {
  it("splits a series title from its subtitle", () => {
    expect(splitTitle("First Steps Together: English for Little Learners")).toEqual({ main: "First Steps Together", sub: "English for Little Learners" });
    expect(splitTitle("Super Kids - Level One")).toEqual({ main: "Super Kids", sub: "Level One" });
    expect(splitTitle("My Town")).toEqual({ main: "My Town", sub: "" });
  });

  it("sets dark text on a bright brand colour and white on a dark one", () => {
    expect(readableOn("#ffde0c")).toBe("#1f2937");
    expect(readableOn("#1e3a8a")).toBe("#ffffff");
    expect(readableOn("#cc181f")).toBe("#ffffff");
  });
});
