import { describe, expect, it } from "vitest";
import { summarizeUnitReviewsForPersona, REVIEW_TYPE_PERSONA, type UnitReviewRow } from "./personas";

describe("summarizeUnitReviewsForPersona", () => {
  it("maps each reviewType to its persona", () => {
    const reviews: UnitReviewRow[] = [
      { unitNumber: 1, reviewType: "structure", passed: true, issues: [], createdAt: new Date("2026-01-01") },
      { unitNumber: 1, reviewType: "language", passed: true, issues: [], createdAt: new Date("2026-01-01") },
      { unitNumber: 1, reviewType: "level", passed: true, issues: [], createdAt: new Date("2026-01-01") },
      { unitNumber: 1, reviewType: "moderation", passed: true, issues: [], createdAt: new Date("2026-01-01") },
    ];
    const summary = summarizeUnitReviewsForPersona(reviews);
    expect(summary).toHaveLength(4);
    for (const s of summary) {
      expect(s.persona).toBe(REVIEW_TYPE_PERSONA[s.reviewType]);
    }
  });

  it("dedupes to the latest row per (unitNumber, reviewType)", () => {
    const reviews: UnitReviewRow[] = [
      {
        unitNumber: 3,
        reviewType: "language",
        passed: false,
        issues: ["ilk deneme sorunu"],
        createdAt: new Date("2026-01-01T10:00:00Z"),
      },
      {
        unitNumber: 3,
        reviewType: "language",
        passed: true,
        issues: [],
        createdAt: new Date("2026-01-01T10:05:00Z"),
      },
    ];
    const summary = summarizeUnitReviewsForPersona(reviews);
    expect(summary).toHaveLength(1);
    expect(summary[0].passed).toBe(true);
    expect(summary[0].issueCount).toBe(0);
  });

  it("keeps separate units and reviewTypes independent", () => {
    const reviews: UnitReviewRow[] = [
      { unitNumber: 1, reviewType: "language", passed: true, issues: [], createdAt: new Date("2026-01-01") },
      { unitNumber: 2, reviewType: "language", passed: false, issues: ["a", "b"], createdAt: new Date("2026-01-01") },
    ];
    const summary = summarizeUnitReviewsForPersona(reviews);
    expect(summary).toHaveLength(2);
    const unit2 = summary.find((s) => s.unitNumber === 2);
    expect(unit2?.passed).toBe(false);
    expect(unit2?.issueCount).toBe(2);
  });

  it("returns an empty array for no reviews", () => {
    expect(summarizeUnitReviewsForPersona([])).toEqual([]);
  });
});
