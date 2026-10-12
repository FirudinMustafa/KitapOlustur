import { describe, expect, it } from "vitest";
import { titleCopiesSource } from "./title-guard";

const cover = "Express Publishing\nThe Incredible 5 Team\nStudent's Book 2\nJenny Dooley";

describe("titleCopiesSource", () => {
  it("catches the source's series title", () => {
    expect(titleCopiesSource("The Incredible 5 Team: Student Book 2", cover)).toBe(true);
    expect(titleCopiesSource("Incredible Team Adventures", cover)).toBe(true);
  });

  it("allows a new title, even one sharing generic coursebook words", () => {
    expect(titleCopiesSource("Bright Paths: Student Book 2", cover)).toBe(false);
    expect(titleCopiesSource("English Level 2", cover)).toBe(false);
    expect(titleCopiesSource("The Five Friends Club", cover)).toBe(false);
  });
});
