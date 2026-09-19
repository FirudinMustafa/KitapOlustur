import { describe, expect, it } from "vitest";
import { formatElapsedTurkish } from "./run-status";

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
