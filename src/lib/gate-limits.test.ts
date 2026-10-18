import { describe, expect, it } from "vitest";

import { isValidUnitLimit, normalizeContentChanges, normalizeImageDecisions } from "./gate-limits";

describe("isValidUnitLimit", () => {
  it("accepts 1..30 integers only", () => {
    expect(isValidUnitLimit(1)).toBe(true);
    expect(isValidUnitLimit(30)).toBe(true);
    expect(isValidUnitLimit(0)).toBe(false);
    expect(isValidUnitLimit(31)).toBe(false);
    expect(isValidUnitLimit(500)).toBe(false);
    expect(isValidUnitLimit(2.5)).toBe(false);
    expect(isValidUnitLimit("4")).toBe(false);
  });
});

describe("normalizeContentChanges", () => {
  it("collapses repeats of one unit into a single change", () => {
    const raw = Array.from({ length: 1000 }, () => ({ unitNumber: 1, comment: "shorter" }));
    const out = normalizeContentChanges(raw, new Set([1, 2]));
    expect(out).toHaveLength(1);
    expect(out[0].comment.length).toBeLessThanOrEqual(2000);
  });

  it("drops unknown units and empty comments", () => {
    const out = normalizeContentChanges(
      [
        { unitNumber: 9, comment: "x" },
        { unitNumber: 2, comment: "  " },
        { unitNumber: 2, comment: "more pictures" },
        "junk",
      ],
      new Set([1, 2]),
    );
    expect(out).toEqual([{ unitNumber: 2, comment: "more pictures" }]);
  });
});

describe("normalizeImageDecisions", () => {
  const flagged = [{ unitNumber: 1, pageNumber: 3 }];

  it("keeps only flagged images, once each", () => {
    const out = normalizeImageDecisions(
      [
        { unitNumber: 1, pageNumber: 3, action: "regenerate" },
        { unitNumber: 1, pageNumber: 3, action: "regenerate" },
        { unitNumber: 1, pageNumber: 4, action: "regenerate" },
        { unitNumber: 1, pageNumber: 3, action: "delete" },
      ],
      flagged,
    );
    expect(out).toEqual([{ unitNumber: 1, pageNumber: 3, action: "regenerate" }]);
  });
});
