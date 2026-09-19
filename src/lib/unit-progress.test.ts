import { describe, expect, it } from "vitest";
import { computeUnitProgress } from "./unit-progress";

const units = [
  { number: 1, title: "Unit 1" },
  { number: 2, title: "Unit 2" },
  { number: 3, title: "Unit 3" },
];

describe("computeUnitProgress", () => {
  it("marks everything pending before generation starts", () => {
    const result = computeUnitProgress(units, "awaiting_outline_approval", null, [], []);
    expect(result).toEqual([
      { unitNumber: 1, title: "Unit 1", content: "pending", image: "pending", audio: "pending", review: "pending" },
      { unitNumber: 2, title: "Unit 2", content: "pending", image: "pending", audio: "pending", review: "pending" },
      { unitNumber: 3, title: "Unit 3", content: "pending", image: "pending", audio: "pending", review: "pending" },
    ]);
  });

  it("marks the active unit's content/audio as active from currentStage text", () => {
    const result = computeUnitProgress(units, "generating", "Ünite 2/3: içerik üretiliyor", [], []);
    expect(result[0].content).toBe("pending");
    expect(result[1].content).toBe("active");
    expect(result[1].audio).toBe("active");
    expect(result[2].content).toBe("pending");
  });

  it("marks content/audio done once review rows exist, and starts images as active", () => {
    const result = computeUnitProgress(
      units,
      "generating_images",
      "Ünite 1/3: görseller üretiliyor",
      [
        { unitNumber: 1, passed: true },
        { unitNumber: 1, passed: true },
      ],
      [],
    );
    expect(result[0].content).toBe("done");
    expect(result[0].audio).toBe("done");
    expect(result[0].image).toBe("active");
    expect(result[0].review).toBe("done");
  });

  it("flags a unit needing attention when a review or image failed", () => {
    const result = computeUnitProgress(
      units,
      "generating",
      null,
      [{ unitNumber: 1, passed: false }],
      [{ unitNumber: 1, pageNumber: 1, attempt: 1, passed: false }],
    );
    expect(result[0].review).toBe("attention");
    expect(result[0].image).toBe("attention");
  });

  it("only counts an image review's latest attempt, not earlier failed retries", () => {
    const result = computeUnitProgress(
      units,
      "generating",
      null,
      [{ unitNumber: 1, passed: true }],
      [
        { unitNumber: 1, pageNumber: 1, attempt: 1, passed: false },
        { unitNumber: 1, pageNumber: 1, attempt: 2, passed: true },
      ],
    );
    expect(result[0].image).toBe("done");
  });

  it("marks everything done once the run is assembling or done", () => {
    const done = computeUnitProgress(units, "done", null, [], []);
    expect(done.every((u) => u.content === "done" && u.image === "done" && u.audio === "done" && u.review === "done")).toBe(
      true,
    );
    const assembling = computeUnitProgress(units, "assembling", null, [], []);
    expect(assembling.every((u) => u.content === "done")).toBe(true);
  });
});
