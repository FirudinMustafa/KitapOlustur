import type { DesignColor, SourcePageLayout } from "@/lib/source-layout";
import type { DesignTheme, FontRole } from "@/lib/design/themes";

// Faz G1 "Kaynağın görünümü": the source book's own colours and type,
// measured (src/lib/source-layout.ts) instead of guessed. The page-map model
// used to report a palette from one page and only its hue survived
// (derive-palette.ts); fonts and type size came from the chosen theme
// whatever the source used.
//
// Pure - shared by the workflow, the reassembly path and scripts.

export type SourceTheme = {
  // [primary, accent, tint] as hex - the shape run.paletteColors stores and
  // derivePaletteFromColors reads. Primary: the brand colour printed on the
  // most pages (headings, number badges); accent: the next distinct hue;
  // tint: the pale panel colour on the most pages.
  colors: string[];
  headingFont: FontRole | null;
  bodyFont: FontRole | null;
  // Body text size as a share of the page height, so it carries over to the
  // trim size the book is printed at (bodySizeFor).
  bodySizeRatio: number | null;
};

// Body size in pt for a page of this height, kept readable.
export function bodySizeFor(theme: Pick<SourceTheme, "bodySizeRatio">, pageHeightPt: number): number | null {
  if (!theme.bodySizeRatio) return null;
  return Math.min(13, Math.max(8.5, Math.round(theme.bodySizeRatio * pageHeightPt * 2) / 2));
}

type Cluster = { r: number; g: number; b: number; share: number; pages: Set<number> };

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function hsl([r, g, b]: [number, number, number]): { h: number; s: number; l: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === rn) h = ((gn - bn) / d + 6) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const toHex = (c: Cluster) =>
  `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

// Near colours across pages are one colour (anti-aliasing and print screens
// spread a single ink over several bins).
const MERGE_DISTANCE = 40;

function clusterBook(pages: { colors: DesignColor[]; page: number }[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const { colors, page } of pages) {
    for (const c of colors) {
      const [r, g, b] = rgb(c.hex);
      const near = clusters.find((k) => Math.hypot(k.r - r, k.g - g, k.b - b) < MERGE_DISTANCE);
      if (near) {
        const w = near.share + c.share;
        near.r = (near.r * near.share + r * c.share) / w;
        near.g = (near.g * near.share + g * c.share) / w;
        near.b = (near.b * near.share + b * c.share) / w;
        near.share = w;
        near.pages.add(page);
      } else {
        clusters.push({ r, g, b, share: c.share, pages: new Set([page]) });
      }
    }
  }
  // A colour on many pages is the book's; a big block on one page is a
  // unit's (or a picture the analyzer did not catch).
  return clusters.sort((a, b) => b.pages.size - a.pages.size || b.share - a.share);
}

// Font role from the face name - mupdf's own "family" is unreliable
// (Helvetica comes back as "serif").
export function fontRole(name: string | null | undefined): FontRole | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (/sassoon|comic|andika|school|primary|infant|schulbuch|century ?gothic/.test(n)) return "reading";
  if (/round|vag|baloo|fredoka|nunito|quicksand|varela/.test(n)) return "rounded";
  if (/sans/.test(n)) return "sans";
  if (/times|garamond|minion|georgia|palatino|baskerville|caslon|bodoni|century|cambria|antiqua|merriweather|serif|text ?pro|utopia|charter|sabon|plantin/.test(n)) return "serif";
  return "sans";
}

function mostCommon<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// Only the pages a book is made of: covers, contents and back matter are
// outliers in colour and type, so a theme needs at least a handful of
// measured pages to say anything.
export function deriveSourceTheme(layouts: (SourcePageLayout | null | undefined)[]): SourceTheme | null {
  const measured = layouts.flatMap((l, i) => (l ? [{ l, page: i + 1 }] : []));
  if (measured.length < 2) return null;

  const clusters = clusterBook(measured.map(({ l, page }) => ({ colors: l.designColors ?? [], page })));
  const named = clusters.map((c) => ({ c, ...hsl([c.r, c.g, c.b]) }));
  const strong = named.filter((k) => k.s >= 0.35 && k.l >= 0.2 && k.l <= 0.7);
  const tints = named.filter((k) => k.l >= 0.82 && k.s >= 0.15);
  const primary = strong[0];
  const accent = primary ? strong.find((k) => hueDistance(k.h, primary.h) >= 40) : strong[0];
  const tint = tints[0];
  const colors = primary ? [toHex(primary.c), ...(accent ? [toHex(accent.c)] : []), ...(tint ? [toHex(tint.c)] : [])] : [];

  const bodyFont = fontRole(mostCommon(measured.map(({ l }) => l.bodyFontName).filter((n): n is string => !!n)));
  const headingFont = fontRole(mostCommon(measured.map(({ l }) => l.headingFontName).filter((n): n is string => !!n)));
  const sizes = measured.flatMap(({ l }) => (l.bodyFontPt ? [l.bodyFontPt / l.heightPt] : []));
  const ratio = mostCommon(sizes.map((s) => Math.round(s * 4000) / 4000));

  return {
    colors,
    bodyFont,
    headingFont,
    bodySizeRatio: ratio,
  };
}

export type SourceType = Pick<SourceTheme, "headingFont" | "bodyFont" | "bodySizeRatio">;

// The chosen theme with the source's typefaces and body size - the
// theme's cards, radius and cover stay; the type is the source's.
export function applySourceType(theme: DesignTheme, type: SourceType | null | undefined, pageHeightPt: number): DesignTheme {
  if (!type) return theme;
  return {
    ...theme,
    headingFont: type.headingFont ?? theme.headingFont,
    bodyFont: type.bodyFont ?? theme.bodyFont,
    bodySize: bodySizeFor(type, pageHeightPt) ?? theme.bodySize,
  };
}
