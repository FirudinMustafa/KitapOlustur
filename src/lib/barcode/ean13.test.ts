import { describe, expect, it } from "vitest";
import { encodeEan13 } from "./ean13";

describe("encodeEan13", () => {
  it("returns null for an invalid ISBN-13 (bad checksum)", () => {
    expect(encodeEan13("9780306406158")).toBeNull();
  });

  it("returns null for a malformed input", () => {
    expect(encodeEan13("not-an-isbn")).toBeNull();
    expect(encodeEan13("123")).toBeNull();
  });

  it("produces the correct 95-module structure for a valid ISBN-13", () => {
    // 9780306406157: a widely-used checksum-example ISBN (978030640615 with
    // check digit 7 - verified by the standard alternating 1/3 weight sum).
    const bits = encodeEan13("978-0-306-40615-7");
    expect(bits).not.toBeNull();
    expect(bits).toHaveLength(95);

    const bars = bits!.map((b) => (b ? "1" : "0")).join("");
    expect(bars.slice(0, 3)).toBe("101"); // start guard
    expect(bars.slice(45, 50)).toBe("01010"); // center guard (after 3 + 42 left modules)
    expect(bars.slice(92, 95)).toBe("101"); // end guard
  });

  it("normalizes hyphens/spaces the same as isValidIsbn13", () => {
    const withHyphens = encodeEan13("978-0-306-40615-7");
    const plain = encodeEan13("9780306406157");
    expect(withHyphens).toEqual(plain);
  });
});
