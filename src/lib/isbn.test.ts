import { describe, expect, it } from "vitest";
import { isValidIsbn13, normalizeIsbn, formatIsbn13 } from "./isbn";

describe("isValidIsbn13", () => {
  it("accepts a known-valid ISBN-13", () => {
    expect(isValidIsbn13("9780306406157")).toBe(true);
  });

  it("accepts the same ISBN with hyphens/spaces", () => {
    expect(isValidIsbn13("978-0-306-40615-7")).toBe(true);
    expect(isValidIsbn13("978 0 306 40615 7")).toBe(true);
  });

  it("rejects a wrong checksum", () => {
    expect(isValidIsbn13("9780306406158")).toBe(false);
  });

  it("rejects the wrong length", () => {
    expect(isValidIsbn13("978030640615")).toBe(false);
    expect(isValidIsbn13("97803064061577")).toBe(false);
  });

  it("rejects a 10-digit ISBN-10 with an X check character", () => {
    expect(isValidIsbn13("080442957X")).toBe(false);
  });
});

describe("normalizeIsbn", () => {
  it("strips non-digit/X characters", () => {
    expect(normalizeIsbn("978-0-306-40615-7")).toBe("9780306406157");
  });
});

describe("formatIsbn13", () => {
  it("hyphenates a 13-digit ISBN", () => {
    expect(formatIsbn13("9780306406157")).toBe("978-0-3064-0615-7");
  });

  it("returns the input unchanged if not 13 digits", () => {
    expect(formatIsbn13("123")).toBe("123");
  });
});
