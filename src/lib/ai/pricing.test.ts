import { describe, expect, it } from "vitest";
import {
  estimateImageCostUsd,
  estimateSpeechCostUsd,
  estimateStudioImageCostUsd,
  imageCostFromUsage,
  isOverCostCap,
  textCostUsd,
} from "./pricing";

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

describe("estimateStudioImageCostUsd", () => {
  it("scales linearly with count", () => {
    expect(estimateStudioImageCostUsd("1024x1024", 1)).toBeCloseTo(0.053);
    expect(estimateStudioImageCostUsd("1024x1024", 4)).toBeCloseTo(0.212);
  });

  it("prices non-square sizes higher than square", () => {
    const square = estimateStudioImageCostUsd("1024x1024", 1)!;
    const portrait = estimateStudioImageCostUsd("1024x1536", 1)!;
    expect(portrait).toBeGreaterThan(square);
  });

  it("returns null for an unknown size or zero count", () => {
    expect(estimateStudioImageCostUsd("2048x2048", 1)).toBeNull();
    expect(estimateStudioImageCostUsd("1024x1024", 0)).toBeNull();
  });
});

describe("imageCostFromUsage", () => {
  it("prices the reported tokens", () => {
    expect(imageCostFromUsage("openai/gpt-image-2.5-flare", { inputTokens: 1000, outputTokens: 2000 })).toBeCloseTo(0.065);
  });

  it("falls back to the flat estimate without usage", () => {
    expect(imageCostFromUsage("openai/gpt-image-2.5-flare", undefined)).toBeCloseTo(0.08);
    expect(imageCostFromUsage("cloudflare/flux-1-schnell", undefined)).toBeNull();
  });
});

describe("textCostUsd", () => {
  it("prices input and output separately", () => {
    expect(textCostUsd("anthropic/claude-sonnet-5.5", { inputTokens: 1_000_000, outputTokens: 100_000 })).toBeCloseTo(3);
  });

  it("is null for free-mode model ids", () => {
    expect(textCostUsd("gemini-3.1-flash-lite", { inputTokens: 5000, outputTokens: 500 })).toBeNull();
  });
});

describe("isOverCostCap", () => {
  it("stops only past a positive cap", () => {
    expect(isOverCostCap(6.01, 6)).toBe(true);
    expect(isOverCostCap(5.99, 6)).toBe(false);
    expect(isOverCostCap(100, 0)).toBe(false);
  });
});
