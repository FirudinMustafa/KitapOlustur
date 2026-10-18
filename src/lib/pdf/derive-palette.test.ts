import { describe, expect, it } from "vitest";
import { derivePaletteFromColors } from "./derive-palette";

describe("derivePaletteFromColors", () => {
  it("keeps a measured brand colour as printed and uses the pale one as the panel tint", () => {
    const p = derivePaletteFromColors(["#cc181f", "#c1d72f", "#f7e5ca"])!;
    expect(p.primary).toBe("#cc181f");
    expect(p.accent).toBe("#c1d72f");
    expect(p.primaryLight).toBe("#f7e5ca");
  });

  it("reads colours by what they are, not their position", () => {
    const p = derivePaletteFromColors(["#e6d0bf", "#c2603f"])!;
    expect(p.primaryLight).toBe("#e6d0bf");
    expect(p.primary).not.toBe("#e6d0bf");
  });

  it("darkens a light brand colour until white text reads on it", () => {
    const p = derivePaletteFromColors(["#c1d72f"])!; // lime - white text unreadable
    expect(p.primary).not.toBe("#c1d72f");
    const lum = (hex: string) => {
      const lin = (i: number) => {
        const v = parseInt(hex.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
    };
    expect(1.05 / (lum(p.primary) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it("falls back to a usable hue for neutral or named colours", () => {
    expect(derivePaletteFromColors(["white"])).not.toBeNull();
    expect(derivePaletteFromColors(["blue"])!.primary).toBe("#2563eb");
    expect(derivePaletteFromColors([])).toBeNull();
  });
});
