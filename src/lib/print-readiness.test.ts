import { describe, expect, it } from "vitest";
import { checkPrintReadiness, RECOMMENDED_COVER_WIDTH_PX, RECOMMENDED_COVER_HEIGHT_PX } from "./print-readiness";

describe("checkPrintReadiness", () => {
  it("flags a missing ISBN", () => {
    const report = checkPrintReadiness({});
    expect(report.isbn.provided).toBe(false);
    expect(report.issues.some((i) => i.includes("ISBN girilmemiş"))).toBe(true);
  });

  it("flags an invalid ISBN checksum", () => {
    const report = checkPrintReadiness({ isbn: "9780306406158" });
    expect(report.isbn.provided).toBe(true);
    expect(report.isbn.valid).toBe(false);
    expect(report.issues.some((i) => i.includes("geçerli"))).toBe(true);
  });

  it("accepts a valid ISBN with no complaint", () => {
    const report = checkPrintReadiness({ isbn: "9780306406157" });
    expect(report.isbn.valid).toBe(true);
    expect(report.issues.some((i) => i.includes("ISBN"))).toBe(false);
  });

  it("flags a landscape cover as not print-ready", () => {
    const report = checkPrintReadiness({ isbn: "9780306406157", coverWidthPx: 1344, coverHeightPx: 768 });
    expect(report.cover?.isPortrait).toBe(false);
    expect(report.issues.some((i) => i.includes("yatay"))).toBe(true);
  });

  it("passes a portrait cover meeting the recommended resolution", () => {
    const report = checkPrintReadiness({
      isbn: "9780306406157",
      coverWidthPx: RECOMMENDED_COVER_WIDTH_PX,
      coverHeightPx: RECOMMENDED_COVER_HEIGHT_PX,
    });
    expect(report.cover?.isPortrait).toBe(true);
    expect(report.cover?.meetsRecommendedResolution).toBe(true);
    expect(report.issues.some((i) => i.includes("Kapak"))).toBe(false);
  });

  it("flags a too-low-resolution portrait cover", () => {
    const report = checkPrintReadiness({ isbn: "9780306406157", coverWidthPx: 600, coverHeightPx: 900 });
    expect(report.cover?.isPortrait).toBe(true);
    expect(report.cover?.meetsRecommendedResolution).toBe(false);
    expect(report.issues.some((i) => i.includes("çözünürlüğü"))).toBe(true);
  });
});
