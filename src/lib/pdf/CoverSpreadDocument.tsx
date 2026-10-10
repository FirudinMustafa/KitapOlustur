import { Document, Page, Text, View } from "@react-pdf/renderer";
import { BLEED_PT, TRIM_SIZES, spineWidthPt, type TrimSizeId } from "./page-geometry";
import { registerBookFonts, NOTO_SANS } from "./fonts";
import { derivePaletteFromColors } from "./derive-palette";
import { makeLook } from "./blocks";
import { resolveDesignTheme } from "@/lib/design/themes";
import { Barcode, CoverBody, VARIANT_LABELS, upperFor, type BookDocumentSourceStyle, type Variant } from "./BookDocument";

registerBookFonts();

// Faz 4 "Baskıya hazır çıktı": the full cover wrap a printer needs -
// back cover + spine + front cover on one sheet, with bleed all round.
// The spine width comes from the interior's real page count (KDP paper
// factors, see spineWidthPt), so it must be built from the finished print
// PDF. The front reuses the book's own CoverBody, so it matches the PDF
// cover exactly. The back cover is deterministic (no AI call), which keeps
// an AI-free reassembly able to rebuild it.

export type CoverSpreadProps = {
  bookTitle: string;
  variant: Variant;
  level: string;
  unitTitles: string[];
  subject?: string;
  coverImageSrc?: string;
  isbn?: string;
  trimSize?: TrimSizeId;
  pageCount: number;
  paper?: "white" | "cream";
  sourceStyle?: BookDocumentSourceStyle;
  contentLanguage?: string;
  designTheme?: string | null;
  /** Faz 6: picture books get a story back cover instead of a unit list. */
  bookKind?: string | null;
  blurb?: string;
};

// "An A2 student book", "A B1 workbook" - by the sound of the level's first letter.
export function article(word: string): string {
  const w = word.trim();
  // A level code like "A2"/"B1" is read letter by letter ("ay-two").
  if (/^[a-z]\d/i.test(w)) return /^[aefhilmnorsx]/i.test(w) ? "An" : "A";
  return /^[aeiou]/i.test(w) ? "An" : "A";
}

// Spine text needs room - below this the spine stays plain colour, as
// most print services require for thin books.
const MIN_SPINE_FOR_TEXT_PT = 14;

export function coverSpreadSize(trimSize: TrimSizeId, pageCount: number, paper: "white" | "cream" = "white") {
  const trim = TRIM_SIZES[trimSize];
  const spine = spineWidthPt(pageCount, paper);
  return {
    spine,
    width: trim.widthPt * 2 + spine + BLEED_PT * 2,
    height: trim.heightPt + BLEED_PT * 2,
  };
}

export function CoverSpreadDocument(props: CoverSpreadProps) {
  const { bookTitle, variant, level, unitTitles, subject, coverImageSrc, isbn, trimSize = "a4", pageCount, paper = "white", sourceStyle, contentLanguage, designTheme, bookKind, blurb } = props;
  const isPictureBook = bookKind === "picturebook";
  const trim = TRIM_SIZES[trimSize];
  const { spine, width, height } = coverSpreadSize(trimSize, pageCount, paper);
  const theme = resolveDesignTheme(designTheme);
  const palette = derivePaletteFromColors(sourceStyle?.dominantColors) ?? theme.palettes[variant];
  const look = makeLook(theme, palette);
  const variantLabel = isPictureBook ? "" : VARIANT_LABELS[variant];
  const backWidth = BLEED_PT + trim.widthPt;
  const frontLeft = backWidth + spine;

  return (
    <Document title={`${bookTitle} - ${variantLabel} - cover`}>
      <Page size={{ width, height }} style={{ padding: 0 }}>
        {/* Back cover (left), including the left + top + bottom bleed */}
        <View style={{ position: "absolute", left: 0, top: 0, width: backWidth, height, backgroundColor: palette.primaryDark }}>
          <View style={{ position: "absolute", left: BLEED_PT + 44, right: 40, top: BLEED_PT + 56 }}>
            <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: palette.accent, marginBottom: 10 }}>
              {upperFor(variantLabel ? `${level} · ${variantLabel}` : level, contentLanguage)}
            </Text>
            <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: 22, color: "#ffffff", marginBottom: 14, lineHeight: 1.2 }}>
              {bookTitle}
            </Text>
            {isPictureBook ? (
              <Text style={{ fontFamily: look.bodyFont, fontSize: 13, color: "#ffffff", lineHeight: 1.6, marginBottom: 18 }}>
                {blurb ? `“${blurb}”` : ""}
              </Text>
            ) : (
            <Text style={{ fontFamily: look.bodyFont, fontSize: 10.5, color: "#ffffff", opacity: 0.9, lineHeight: 1.5, marginBottom: 18 }}>
              {article(level)} {subject ? `${level} ${subject} ${variantLabel.toLowerCase()}` : `${level} ${variantLabel.toLowerCase()}`} with{" "}
              {unitTitles.length} units of engaging, fully illustrated lessons and practice.
            </Text>
            )}
            {!isPictureBook && unitTitles.length > 0 && (
              <View style={{ borderTopWidth: 0.75, borderTopColor: "#ffffff", paddingTop: 10 }}>
                <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 8, letterSpacing: 1.5, color: "#ffffff", opacity: 0.7, marginBottom: 6 }}>
                  INSIDE THIS BOOK
                </Text>
                {unitTitles.slice(0, 12).map((t, i) => (
                  <Text key={i} style={{ fontFamily: look.bodyFont, fontSize: 9.5, color: "#ffffff", marginBottom: 3 }}>
                    {i + 1}. {t}
                  </Text>
                ))}
              </View>
            )}
          </View>
          {isbn && (
            <View style={{ position: "absolute", right: 36, bottom: BLEED_PT + 40, backgroundColor: "#ffffff", padding: 8, borderRadius: 2 }}>
              <Barcode isbn={isbn} />
            </View>
          )}
        </View>

        {/* Spine */}
        <View style={{ position: "absolute", left: backWidth, top: 0, width: spine, height, backgroundColor: palette.primary }}>
          {spine >= MIN_SPINE_FOR_TEXT_PT && (
            // Rotated so the title reads top-to-bottom, the convention for
            // English-language books.
            <View
              style={{
                position: "absolute",
                width: trim.heightPt,
                height: spine,
                left: (spine - trim.heightPt) / 2,
                top: (height - spine) / 2,
                transform: "rotate(90deg)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 40,
              }}
            >
              <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: Math.min(14, spine * 0.5), color: "#ffffff" }}>{bookTitle}</Text>
              <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: Math.min(9, spine * 0.4), color: "#ffffff", opacity: 0.85 }}>
                {variantLabel ? `${variantLabel} · ${level}` : level}
              </Text>
            </View>
          )}
        </View>

        {/* Front cover (right), including the right + top + bottom bleed */}
        <View style={{ position: "absolute", left: frontLeft, top: 0, width: width - frontLeft, height, overflow: "hidden" }}>
          <CoverBody
            bookTitle={bookTitle}
            level={level}
            variantLabel={variantLabel}
            unitCount={isPictureBook ? 0 : unitTitles.length}
            coverImageSrc={coverImageSrc}
            look={look}
            logoUrl={sourceStyle?.logoUrl}
            logoStyle={sourceStyle?.logoUrl ? { top: 24 + BLEED_PT, right: 24 + BLEED_PT } : null}
            contentLanguage={contentLanguage}
            pageHeight={height}
          />
        </View>
      </Page>
    </Document>
  );
}
