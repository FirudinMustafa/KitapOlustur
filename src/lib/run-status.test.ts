import { describe, expect, it } from "vitest";
import { formatElapsedTurkish, getPipelineStageIndex, getPipelineNodeStates, PIPELINE_STAGES } from "./run-status";

describe("formatElapsedTurkish", () => {
  const now = new Date("2026-09-19T12:00:00Z");

  it("returns 'az önce' for under a minute", () => {
    expect(formatElapsedTurkish(new Date("2026-09-19T11:59:30Z"), now)).toBe("az önce");
  });

  it("formats minutes under an hour", () => {
    expect(formatElapsedTurkish(new Date("2026-09-19T11:45:00Z"), now)).toBe("15 dakikadır");
  });

  it("formats hours under a day", () => {
    expect(formatElapsedTurkish(new Date("2026-09-19T09:00:00Z"), now)).toBe("3 saattir");
  });

  it("formats days", () => {
    expect(formatElapsedTurkish(new Date("2026-09-16T12:00:00Z"), now)).toBe("3 gündür");
  });

  it("clamps a future timestamp to 'az önce' instead of a negative duration", () => {
    expect(formatElapsedTurkish(new Date("2026-09-19T13:00:00Z"), now)).toBe("az önce");
  });
});

describe("getPipelineStageIndex", () => {
  it("buckets all per-unit-loop statuses into the same 'generate' stage", () => {
    expect(getPipelineStageIndex("generating")).toBe(2);
    expect(getPipelineStageIndex("reviewing")).toBe(2);
    expect(getPipelineStageIndex("generating_images")).toBe(2);
    expect(getPipelineStageIndex("awaiting_variant_selection")).toBe(2);
  });

  it("maps extraction-phase statuses to stage 0", () => {
    expect(getPipelineStageIndex("pending")).toBe(0);
    expect(getPipelineStageIndex("mapping_pages")).toBe(0);
    expect(getPipelineStageIndex("extracting")).toBe(0);
    expect(getPipelineStageIndex("analyzing")).toBe(0);
  });

  it("falls back to stage 0 for an unrecognized status", () => {
    expect(getPipelineStageIndex("some_future_status")).toBe(0);
  });
});

describe("getPipelineNodeStates", () => {
  it("marks earlier stages done, the current stage active, and later stages pending", () => {
    const states = getPipelineNodeStates("reviewing_coherence");
    expect(states).toEqual(["done", "done", "done", "active", "pending", "pending"]);
  });

  it("marks every stage done when the run is done", () => {
    const states = getPipelineNodeStates("done");
    expect(states[states.length - 1]).toBe("done");
    expect(states.every((s) => s === "done")).toBe(true);
  });

  it("does not fabricate a failed-stage position - falls back to all pending", () => {
    const states = getPipelineNodeStates("failed");
    expect(states.every((s) => s === "pending")).toBe(true);
  });

  it("returns one state per declared stage", () => {
    expect(getPipelineNodeStates("generating")).toHaveLength(PIPELINE_STAGES.length);
  });
});
