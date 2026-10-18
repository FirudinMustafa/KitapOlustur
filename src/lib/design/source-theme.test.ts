import { describe, expect, it } from "vitest";
import { applySourceType, bodySizeFor, deriveSourceTheme, fontRole } from "./source-theme";
import { DESIGN_THEMES } from "./themes";
import { designColors, type SourcePageLayout } from "@/lib/source-layout";

const layout = (overrides: Partial<SourcePageLayout>): SourcePageLayout => ({
  widthPt: 659,
  heightPt: 795,
  images: [],
  textColumns: 1,
  wordCount: 200,
  exerciseCount: 3,
  itemCount: 8,
  exerciseRubrics: [],
  bodyFontPt: 10,
  headingFontPt: 13,
  zone: "full_width_text",
  ...overrides,
});

describe("fontRole", () => {
  it("reads the role from the face name", () => {
    expect(fontRole("PFCatalog-Regular")).toBe("sans");
    expect(fontRole("HelveticaLTStd-Roman")).toBe("sans");
    expect(fontRole("SassoonPrimaryStd-Regular")).toBe("reading");
    expect(fontRole("TimesNewRomanPSMT")).toBe("serif");
    expect(fontRole("AdobeTextPro-Regular")).toBe("serif");
    expect(fontRole("VAGRoundedStd-Bold")).toBe("rounded");
    expect(fontRole(null)).toBeNull();
  });
});

describe("deriveSourceTheme", () => {
  it("takes the brand colour from the most pages, a unit colour as accent, the common pale tint", () => {
    const red = { hex: "#cd171e", share: 0.01 };
    const peach = { hex: "#fce2da", share: 0.006 };
    const theme = deriveSourceTheme([
      layout({ designColors: [red, peach], bodyFontName: "PFCatalog-Regular", headingFontName: "PFCatalog-Bold" }),
      layout({ designColors: [red, { hex: "#bfd72f", share: 0.135 }, peach], bodyFontName: "PFCatalog-Regular" }),
      layout({ designColors: [red, { hex: "#c1d736", share: 0.008 }], bodyFontName: "PFCatalog-Regular" }),
      layout({ designColors: [{ hex: "#7778b3", share: 0.096 }], bodyFontName: "SassoonPrimaryStd-Regular" }),
    ])!;
    expect(theme.colors[0]).toBe("#cd171e");
    expect(theme.colors[1]).toMatch(/^#(bf|c[01])d7/); // the lime, on two pages (merged)
    expect(theme.colors[2]).toBe("#fce2da");
    expect(theme.bodyFont).toBe("sans");
    expect(theme.headingFont).toBe("sans");
    expect(bodySizeFor(theme, 795)).toBe(10);
  });

  it("needs more than one measured page", () => {
    expect(deriveSourceTheme([layout({})])).toBeNull();
    expect(deriveSourceTheme([])).toBeNull();
  });
});

describe("applySourceType", () => {
  it("keeps the theme's cards and cover, takes the source's type", () => {
    const t = applySourceType(DESIGN_THEMES.classic, { bodyFont: "sans", headingFont: null, bodySizeRatio: 0.0125 }, 794);
    expect(t.bodyFont).toBe("sans");
    expect(t.headingFont).toBe(DESIGN_THEMES.classic.headingFont);
    expect(t.bodySize).toBe(10);
    expect(t.cardStyle).toBe(DESIGN_THEMES.classic.cardStyle);
    expect(applySourceType(DESIGN_THEMES.classic, null, 794)).toBe(DESIGN_THEMES.classic);
  });
});

describe("designColors", () => {
  it("counts chromatic colours outside the pictures only", () => {
    const W = 10;
    const H = 10;
    const data = new Uint8Array(W * H * 3).fill(255);
    // left half red (a band), right half blue (inside a picture), one row black text
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) data.set(y === 9 ? [0, 0, 0] : x < 5 ? [205, 23, 30] : [40, 90, 220], (y * W + x) * 3);
    const colors = designColors({ width: W, height: H, channels: 3, data }, [{ x: 0.5, y: 0, w: 0.5, h: 1 }]);
    expect(colors).toHaveLength(1);
    expect(colors[0].hex).toBe("#cd171e");
    expect(colors[0].share).toBeCloseTo(0.45);
  });
});
