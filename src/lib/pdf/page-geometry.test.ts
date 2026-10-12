import { describe, expect, it } from "vitest";
import { isTrimSizeChoice, nearestTrimSize, resolveTrimSize } from "./page-geometry";

describe("trim sizes", () => {
  it("picks the supported size closest to a measured source", () => {
    expect(nearestTrimSize(659, 795)).toBe("220x280"); // Express Publishing coursebook
    expect(nearestTrimSize(595, 842)).toBe("a4");
    expect(nearestTrimSize(612, 792)).toBe("220x280"); // US letter
    expect(nearestTrimSize(432, 648)).toBe("6x9");
  });

  it("prints A4 until auto is resolved", () => {
    expect(resolveTrimSize("auto")).toBe("a4");
    expect(resolveTrimSize("7x10")).toBe("7x10");
    expect(isTrimSizeChoice("auto")).toBe(true);
    expect(isTrimSizeChoice("letter")).toBe(false);
  });
});
