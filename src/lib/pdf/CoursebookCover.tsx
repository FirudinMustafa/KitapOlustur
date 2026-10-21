import { Text, View, Svg, Path, Circle, Rect, Image } from "@react-pdf/renderer";
import type { Look } from "./blocks";
import { BALOO, NOTO_SANS, withSymbols } from "./fonts";

// KIYAS-13 "kapak": the default front cover, set like a published
// coursebook's - the cover art to the edges, the title in a coloured
// masthead with a wavy edge, a round level badge, the book type on a tab
// and the series' colour bars at the foot. It used to be a dark band with
// the title over a framed picture and a "2 units" chip, which read as a
// report, not a book. The colours are the source's own as measured
// (`brandColors`, Faz G1) - the book's palette darkens a bright brand
// colour for white text on it (a yellow came out olive), the cover keeps it
// bright and sets dark text on it instead.

export type CoursebookCoverProps = {
  bookTitle: string;
  level: string;
  variantLabel: string;
  coverImageSrc?: string;
  look: Look;
  /** The source's measured colours, as printed (sourceStyle.dominantColors). */
  brandColors?: string[];
  /** Locale-aware uppercasing (upperFor). */
  upper: (text: string) => string;
  pageWidth: number;
  pageHeight: number;
};

export function CoursebookCover({ bookTitle, level, variantLabel, coverImageSrc, look, brandColors, upper, pageWidth: W, pageHeight: H }: CoursebookCoverProps) {
  const { palette } = look;
  const { brand, second } = coverColors(brandColors, palette);
  const onBrand = readableOn(brand);
  const onSecond = readableOn(second);
  const young = /^(pre-?a1|a1)\b/i.test(level.trim());
  const titleFont = young ? withSymbols(BALOO) : look.headingFont;
  const { main, sub } = splitTitle(bookTitle);

  const mast = Math.round(H * 0.3); // masthead depth, wave included
  const wave = 26;
  const footBar = 30;
  const badge = Math.round(Math.min(W, H) * 0.17);
  const titleSize = fitTitle(main, W - 2 * 40 - (badge * 0.6), young ? 1 : 0.92);

  return (
    <>
      {/* Cover art to the edges, under the masthead's wave */}
      <View style={{ position: "absolute", top: mast - wave * 2, left: 0, right: 0, bottom: 0, backgroundColor: palette.primaryLight }}>
        {coverImageSrc ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop
          <Image src={coverImageSrc} style={{ width: "100%", height: "100%", objectFit: "cover", objectPositionX: "50%", objectPositionY: "20%" }} />
        ) : (
          <Svg viewBox="0 0 600 600" style={{ width: "100%", height: "100%" }}>
            <Circle cx="120" cy="420" r="150" fill={brand} opacity={0.35} />
            <Circle cx="470" cy="250" r="120" fill={second} opacity={0.3} />
            <Circle cx="380" cy="520" r="70" fill={palette.primary} opacity={0.2} />
          </Svg>
        )}
      </View>

      {/* Masthead: brand colour with a wavy lower edge */}
      <Svg viewBox={`0 0 ${W} ${mast}`} style={{ position: "absolute", top: 0, left: 0, width: W, height: mast }}>
        <Path d={`M0 0 H${W} V${mast - wave} Q${W * 0.75} ${mast - wave * 2} ${W * 0.5} ${mast - wave} T0 ${mast - wave} Z`} fill={brand} />
        <Path d={`M0 ${mast - wave} Q${W * 0.25} ${mast} ${W * 0.5} ${mast - wave} T${W} ${mast - wave} V${mast - wave + 5} Q${W * 0.75} ${mast - wave * 2 + 5} ${W * 0.5} ${mast - wave + 5} T0 ${mast - wave + 5} Z`} fill={second} />
        {/* a few friendly dots */}
        <Circle cx={W * 0.86} cy={mast * 0.18} r={5} fill={second} />
        <Circle cx={W * 0.91} cy={mast * 0.3} r={3} fill={onBrand} opacity={0.35} />
        <Circle cx={W * 0.06} cy={mast * 0.14} r={3.5} fill={onBrand} opacity={0.35} />
      </Svg>

      <View style={{ position: "absolute", top: 40, left: 40, right: 40 + badge * 0.6 }}>
        <Text style={{ fontFamily: titleFont, fontWeight: 700, fontSize: titleSize, lineHeight: 1.05, color: onBrand }}>{main}</Text>
        {sub ? <Text style={{ fontFamily: titleFont, fontWeight: 700, fontSize: Math.max(14, titleSize * 0.38), color: onBrand, marginTop: 6 }}>{sub}</Text> : null}
      </View>

      {/* Level badge, on the masthead's edge */}
      {level ? (
        <View
          style={{
            position: "absolute",
            top: mast - wave - badge * 0.62,
            right: 30,
            width: badge,
            height: badge,
            borderRadius: badge / 2,
            backgroundColor: second,
            borderWidth: 4,
            borderColor: "#ffffff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 8, letterSpacing: 1.5, color: onSecond }}>{upper("Level")}</Text>
          <Text style={{ fontFamily: titleFont, fontWeight: 700, fontSize: levelSize(level, badge), color: onSecond, lineHeight: 1.1 }}>{level}</Text>
        </View>
      ) : null}

      {/* Book type on a tab above the foot bars */}
      {variantLabel ? (
        <View style={{ position: "absolute", left: 0, bottom: footBar + 22, flexDirection: "row" }}>
          <View style={{ backgroundColor: "#ffffff", paddingVertical: 10, paddingLeft: 40, paddingRight: 26, borderTopRightRadius: 26, borderBottomRightRadius: 26 }}>
            <Text style={{ fontFamily: titleFont, fontWeight: 700, fontSize: 22, color: palette.primaryDark }}>{variantLabel}</Text>
          </View>
        </View>
      ) : null}

      {/* Series colour bars at the foot */}
      <Svg viewBox={`0 0 ${W} ${footBar}`} style={{ position: "absolute", left: 0, bottom: 0, width: W, height: footBar }}>
        <Rect x={0} y={0} width={W} height={6} fill={second} />
        <Rect x={0} y={6} width={W} height={footBar - 6} fill={brand} />
      </Svg>
    </>
  );
}

// The cover's two colours: the source's first strong colour and the next
// distinct one, as measured; otherwise the theme palette's.
function coverColors(measured: string[] | undefined, palette: Look["palette"]): { brand: string; second: string } {
  const strong = (measured ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c) && saturation(c) >= 0.3 && lightness(c) > 0.15 && lightness(c) < 0.85);
  const brand = strong[0] ?? palette.primary;
  const second = strong.find((c) => c !== brand && hueDistance(c, brand) >= 30) ?? (palette.accent !== brand ? palette.accent : palette.primaryDark);
  return { brand, second };
}

// Dark text on a light colour, white on a dark one.
export function readableOn(hex: string): string {
  const lin = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  // contrast with white vs. with near-black (#1f2937, luminance ~0.018)
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.068 ? "#ffffff" : "#1f2937";
}

// "First Steps Together: English for Little Learners" -> a series-like
// main title and a subtitle line.
export function splitTitle(title: string): { main: string; sub: string } {
  const m = /^(.{3,}?)\s*[:–—|]\s+(.+)$/.exec(title.trim()) ?? /^(.{3,}?)\s+-\s+(.+)$/.exec(title.trim());
  return m ? { main: m[1], sub: m[2] } : { main: title.trim(), sub: "" };
}

// The largest title size (pt) that keeps the main title to about two lines.
function fitTitle(main: string, width: number, k: number): number {
  for (const size of [56, 50, 44, 38, 34, 30]) {
    const perLine = width / (size * 0.52 * k);
    if (Math.ceil(main.length / perLine) <= 2) return size;
  }
  return 28;
}

function levelSize(level: string, badge: number): number {
  return Math.min(badge * 0.3, (badge * 1.3) / Math.max(2, level.length));
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function lightness(hex: string): number {
  const c = rgb(hex);
  return (Math.max(...c) + Math.min(...c)) / 2;
}

function saturation(hex: string): number {
  const c = rgb(hex);
  const max = Math.max(...c);
  const min = Math.min(...c);
  const l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
}

function hue(hex: string): number {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function hueDistance(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d);
}
