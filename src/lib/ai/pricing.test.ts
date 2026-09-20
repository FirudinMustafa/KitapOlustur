import { describe, expect, it } from "vitest";
import { estimateImageCostUsd, estimateSpeechCostUsd } from "./pricing";

describe("estimateImageCostUsd", () => {
  it("returns a known price for a priced model", () => {
    expect(estimateImageCostUsd("openai/gpt-image-2")).toBeCloseTo(0.053);
    expect(estimateImageCostUsd("openai/gpt-image-1-mini")).toBeCloseTo(0.011);
  });

  it("returns null for an unpriced model (e.g. video)", () => {
    expect(estimateImageCostUsd("google/veo-3.1-generate-001")).toBeNull();
  });
});

describe("estimateSpeechCostUsd", () => {
  it("computes cost proportional to character count", () => {
    expect(estimateSpeechCostUsd("openai/tts-1-hd", 1_000_000)).toBeCloseTo(30);
    expect(estimateSpeechCostUsd("openai/tts-1-hd", 100)).toBeCloseTo(0.003);
  });

  it("returns null for an unpriced model", () => {
    expect(estimateSpeechCostUsd("unknown/model", 1000)).toBeNull();
  });

  it("returns null for zero/empty character count", () => {
    expect(estimateSpeechCostUsd("openai/tts-1-hd", 0)).toBeNull();
  });
});
