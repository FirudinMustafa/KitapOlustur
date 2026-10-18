// "Kaynağa görsel sadakat" (2026-09-28, ROADMAP.md): turns the loose color
// data extractPageMap's visualStyle field captures (1-4 strings, which may
// be hex codes or plain-English color names, in no guaranteed order) into
// the same 4-tone shape BookDocument.tsx's fixed PALETTE already uses
// (primary/primaryDark/primaryLight/accent) - kept in its own small module,
// separate from the 589-line render file, so the color math is testable in
// isolation.

export type PaletteColors = { primary: string; primaryDark: string; primaryLight: string; accent: string };

// A small set of plain-English color names the model might report instead
// of a hex code - not exhaustive, just common enough to be worth mapping
// directly rather than falling through to the fallback palette.
const NAMED_COLORS: Record<string, string> = {
  red: "#dc2626",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  green: "#16a34a",
  teal: "#0d9488",
  cyan: "#0891b2",
  blue: "#2563eb",
  navy: "#1e3a8a",
  purple: "#7c3aed",
  violet: "#7c3aed",
  pink: "#db2777",
  magenta: "#db2777",
  brown: "#92400e",
  gray: "#6b7280",
  grey: "#6b7280",
  black: "#111827",
  white: "#f9fafb",
};

function parseColor(input: string): string | null {
  const trimmed = input.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    return trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed;
  }
  const named = NAMED_COLORS[trimmed.toLowerCase()];
  return named ?? null;
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// WCAG contrast ratio of a colour against white.
function contrastWithWhite(hex: string): number {
  const lin = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  return 1.05 / (lum + 0.05);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Builds a primary/primaryDark/primaryLight/accent set from whatever
// parseable colors are present, using HSL lightness shifts for the tones
// the model didn't explicitly report - real text (white headings, dark
// body text) is rendered over `primary`/`primaryDark` elsewhere in
// BookDocument.tsx, so both need to stay dark enough for white text to
// read on them regardless of what hue was detected.
//
// Faz G1: the colours are kept as printed when they are usable - the
// source's measured brand colour (src/lib/design/source-theme.ts) used to be
// reduced to its hue and re-lit into a fixed band. Colours are read by what
// they are, not by position: a pale one is the panel tint (primaryLight), the
// first strong one the primary - darkened only as far as white text on it
// needs - and the next strong one the accent.
export function derivePaletteFromColors(colors: string[] | undefined): PaletteColors | null {
  if (!colors?.length) return null;

  const parsed = colors.map(parseColor).filter((c): c is string => c !== null);
  if (!parsed.length) return null;

  const toned = parsed.map((hex) => ({ hex, hsl: hexToHsl(hex) }));
  const tint = toned.find(({ hsl: [, s, l] }) => l >= 0.82 && s >= 0.1);
  const strong = toned.filter(({ hsl: [, s, l] }) => s >= 0.25 && l > 0.12 && l < 0.82);
  if (strong.length) {
    const [h, s, l] = strong[0].hsl;
    let primaryL = l;
    while (primaryL > 0.15 && contrastWithWhite(hslToHex(h, s, primaryL)) < 4.5) primaryL -= 0.02;
    const primary = hslToHex(h, s, primaryL);
    return {
      primary,
      primaryDark: hslToHex(h, s, Math.min(primaryL - 0.12, 0.28)),
      primaryLight: tint?.hex ?? hslToHex(h, clamp(s * 0.5, 0.08, 0.3), 0.95),
      accent: strong[1]?.hex ?? hslToHex((h + 35) % 360, clamp(s, 0.45, 0.85), 0.55),
    };
  }

  const [h, s] = hexToHsl(parsed[0]);
  // A very light or very desaturated dominant color (e.g. a white/cream
  // worksheet background) makes a poor "primary" for white cover text -
  // pull saturation/lightness into a usable band rather than trusting the
  // raw detected value verbatim.
  const usableS = clamp(s, 0.45, 0.85);
  const primary = hslToHex(h, usableS, clamp(0.45, 0.3, 0.55));
  const primaryDark = hslToHex(h, usableS, 0.25);
  const primaryLight = hslToHex(h, clamp(usableS * 0.5, 0.08, 0.3), 0.95);

  const accentHex = parsed[1] ? parsed[1] : null;
  const accent = accentHex ? accentHex : hslToHex((h + 35) % 360, usableS, 0.55);

  return { primary, primaryDark, primaryLight, accent };
}
