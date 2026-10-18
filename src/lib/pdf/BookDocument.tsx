import { Document, Page, Text, View, StyleSheet, Svg, Path, Rect, Circle, Image } from "@react-pdf/renderer";
import type { GeneratedUnit, GeneratedPage, ContentBlock } from "@/lib/ai/schemas";
import { ContentsPageContent, type CourseUnitSummary } from "./ContentsDocument";
import { encodeEan13 } from "@/lib/barcode/ean13";
import { formatIsbn13 } from "@/lib/isbn";
import { PAGE_PADDING, TRIM_SIZES, type TrimSizeId } from "./page-geometry";
import { resolvePageImageUrl, resolvePageImageUrls } from "@/lib/page-image";
import { registerBookFonts, NOTO_SANS, NOTO_SERIF, withSymbols } from "./fonts";
import { derivePaletteFromColors } from "./derive-palette";
import { withUnitGlossary } from "@/lib/unit-glossary";
import { blocksForRender, clampLayoutToPage } from "@/lib/layout-merge";
import { itemText } from "@/lib/item-text";
import { DESIGN_THEMES, resolveDesignTheme, type DesignThemeId } from "@/lib/design/themes";
import { resolvePageTemplate } from "@/lib/design/layouts";
import { BlockCard, GlossaryGrid, makeLook, type Look } from "./blocks";
import { TemplatedPageBody, EDGE_TO_EDGE_TEMPLATES } from "./templates";
import { TWEMOJI_CREDIT } from "@/lib/activities";
import { applySourceType, type SourceType } from "@/lib/design/source-theme";

registerBookFonts();

// ISBN/baskıya hazırlık (2026-09-20, ROADMAP.md): renders a real, scannable
// EAN-13 barcode on the imprint page when the project has a validated ISBN
// - an ISBN-13 IS an EAN-13 barcode, so encodeEan13 doubles as the ISBN
// barcode encoder. Returns null (renders nothing) for a missing/invalid
// ISBN rather than a placeholder - never fabricates a fake barcode.
export function Barcode({ isbn, scale = 1 }: { isbn: string; scale?: number }) {
  const bits = encodeEan13(isbn);
  if (!bits) return null;

  const moduleWidth = 1.1 * scale;
  const barHeight = 40 * scale;

  return (
    <View style={{ alignItems: "flex-start" }}>
      <Svg width={bits.length * moduleWidth} height={barHeight}>
        {bits.map(
          (isBar, i) =>
            isBar && (
              <Rect key={i} x={i * moduleWidth} y={0} width={moduleWidth} height={barHeight} fill="#000000" />
            ),
        )}
      </Svg>
      <Text style={styles.barcodeText}>ISBN {formatIsbn13(isbn)}</Text>
    </View>
  );
}

export type Variant = "student_book" | "workbook" | "teacher_book" | "test_booklet";

// The classic theme's palettes - kept as an export because
// ContentsDocument.tsx falls back to it when no palette is passed.
export const PALETTE = DESIGN_THEMES.classic.palettes;

// "Kaynağa görsel sadakat" (2026-09-28, ROADMAP.md): the pipeline's
// captured read on the uploaded source PDF's visual style - undefined (or
// each field individually undefined/empty) means "no source to mirror" or
// "nothing detected", and every consumer below falls back to the theme's
// palette/no-logo/default-density behavior.
export type BrandMarkPosition = "top_left" | "top_right" | "bottom_left" | "bottom_right" | "top_center" | "bottom_center" | "other";
export type BookDocumentSourceStyle = {
  dominantColors?: string[];
  logoUrl?: string | null;
  logoPosition?: BrandMarkPosition | null;
  density?: "compact" | "moderate" | "spacious";
  /** Faz G1: the source's typefaces and body size (src/lib/design/source-theme.ts). */
  type?: SourceType | null;
};

// Fixed offsets for the small cover-page logo, keyed by the detected
// position - "other"/unset falls back to top_right, the most common
// real-world placement (a logo in a slightly-off corner beats no logo).
const LOGO_POSITION_STYLE: Record<BrandMarkPosition, { top?: number; bottom?: number; left?: number; right?: number }> = {
  top_left: { top: 24, left: 24 },
  top_right: { top: 24, right: 24 },
  top_center: { top: 24, left: 0, right: 0 },
  bottom_left: { bottom: 24, left: 24 },
  bottom_right: { bottom: 24, right: 24 },
  bottom_center: { bottom: 24, left: 0, right: 0 },
  other: { top: 24, right: 24 },
};

export const VARIANT_LABELS: Record<Variant, string> = {
  student_book: "Student Book",
  workbook: "Workbook",
  teacher_book: "Teacher's Book",
  test_booklet: "Test Booklet",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_PADDING.top,
    paddingRight: PAGE_PADDING.right,
    paddingBottom: PAGE_PADDING.bottom,
    paddingLeft: PAGE_PADDING.left,
    fontSize: 10.5,
    fontFamily: NOTO_SERIF,
    color: "#1f2937",
  },

  // Cover
  coverPage: { padding: 0 },
  // Portrait cover image (1024x1536, see BOOK_PIPELINE_COVER_IMAGE_SIZE):
  // the band takes 38% so the illustration gets real vertical room below.
  coverBand: { height: "38%", justifyContent: "center", paddingHorizontal: 48, position: "relative", overflow: "hidden" },
  coverDecoration: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  unitBadgeDecoration: { position: "absolute", top: -10, left: -10 },
  coverKicker: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 11, color: "#ffffff", opacity: 0.85, letterSpacing: 2, marginBottom: 14 },
  coverTitle: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 32, color: "#ffffff", lineHeight: 1.25, marginBottom: 14 },
  coverSubtitle: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 16, color: "#ffffff", opacity: 0.92 },
  coverFooter: { flex: 1, paddingHorizontal: 48, paddingTop: 28, flexDirection: "column", gap: 14 },
  coverIllustrationWrap: { borderRadius: 10, overflow: "hidden", flex: 1 },
  // height:"100%" with flex:1 on the wrap - without an explicit height,
  // react-pdf sizes the Image to its own aspect ratio instead of filling.
  coverIllustration: { width: "100%", height: "100%", objectFit: "cover" },
  coverPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  // QA fix (2026-10-06): the image box has a fixed height and the image is
  // contained in it whole (letterboxed, never cropped).
  pageIllustrationWrap: {
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pageIllustration: { width: "100%", height: "100%", objectFit: "contain" },
  coverLogoBadge: {
    position: "absolute",
    width: 52,
    height: 52,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  coverLogo: { width: "100%", height: "100%", objectFit: "contain" },
  coverPill: {
    fontFamily: NOTO_SANS,
    fontWeight: 700,
    fontSize: 9,
    color: "#374151",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },

  // Running header + unit opener
  runningHeader: { marginBottom: 10 },
  runningHeaderText: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 7.5, letterSpacing: 1.2 },
  unitHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 18, position: "relative" },
  unitBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  unitBadgeText: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 14, color: "#ffffff" },
  unitTitle: { fontWeight: 700, fontSize: 18 },
  unitKicker: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 8.5, letterSpacing: 1.5, marginBottom: 2 },
  // Faz "Sabit Ünite İskeleti": the user-defined section name (e.g.
  // "Dinleme") for skeleton-mode pages.
  sectionKicker: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 8.5, letterSpacing: 1.5, marginBottom: 6 },

  item: { marginBottom: 3, marginLeft: 4 },
  answerKeyLabel: { fontFamily: withSymbols(NOTO_SANS), fontWeight: 700, fontSize: 7.5, color: "#6b7280", letterSpacing: 1, marginBottom: 3 },

  // Footer / answer key page
  footer: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
    fontSize: 8,
    color: "#9ca3af",
    fontFamily: NOTO_SANS,
  },
  imprintBlock: { marginTop: 220 },
  imprintTitle: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 16, marginBottom: 6 },
  imprintLine: { fontSize: 9.5, color: "#4b5563", marginBottom: 4 },
  imprintDisclosure: { fontSize: 9, color: "#6b7280", lineHeight: 1.5, marginTop: 16, maxWidth: 340 },
  barcodeBlock: { marginTop: 24 },
  barcodeText: { fontSize: 9, fontFamily: NOTO_SANS, letterSpacing: 1, marginTop: 4 },
  answerKeyTitleBand: { paddingVertical: 20, marginBottom: 18, borderRadius: 8, alignItems: "center" },
  answerKeyTitle: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 18, color: "#ffffff" },
  answerKeyUnitHeading: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 11.5, marginTop: 14, marginBottom: 6 },
  answerKeyEntry: { marginBottom: 6, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: "#f9fafb", borderRadius: 4 },
});

// Render-time block list: legacy partially-positioned pages get the same
// default slots the editor shows (blocksForRender), and every positioned box
// is kept inside the page (clampLayoutToPage) so react-pdf can't loop.
function clampedBlocks(page: GeneratedPage, pageSize: { width: number; height: number }): ContentBlock[] {
  return blocksForRender(page).map((b) =>
    b.layout ? { ...b, layout: clampLayoutToPage(b.layout, pageSize.width, pageSize.height) } : b,
  );
}

// Faz 4: on a print PDF every page is trim + bleed on each side, so the
// type area moves in by the bleed and stays where it is on the trimmed page.
export function bleedPadding(bleed: number) {
  return bleed
    ? {
        paddingTop: PAGE_PADDING.top + bleed,
        paddingRight: PAGE_PADDING.right + bleed,
        paddingBottom: PAGE_PADDING.bottom + bleed,
        paddingLeft: PAGE_PADDING.left + bleed,
      }
    : {};
}

// Faz 3 "Görsel sayfa denetimi": an invisible marker that reports which
// PDF page a logical page starts on, so a proof render can be mapped back
// to (unit, page) - and a page that spilled onto extra PDF pages is
// detected exactly. react-pdf evaluates render props during layout.
export type PageStartListener = (key: string, pageNumber: number) => void;

function PageMarker({ id, onPageStart }: { id: string; onPageStart?: PageStartListener }) {
  if (!onPageStart) return null;
  return (
    <Text
      render={({ pageNumber }) => {
        onPageStart(id, pageNumber);
        return "";
      }}
    />
  );
}

function Footer({ bookTitle, variantLabel, bleed = 0 }: { bookTitle: string; variantLabel: string; bleed?: number }) {
  return (
    <View style={[styles.footer, bleed ? { left: 44 + bleed, right: 44 + bleed, bottom: 22 + bleed } : {}]} fixed>
      <Text>{variantLabel ? `${bookTitle} · ${variantLabel}` : bookTitle}</Text>
      {/* A printed book shows the folio alone; "n / total" read as a generated report. */}
      <Text render={({ pageNumber }) => `${pageNumber}`} />
    </View>
  );
}

function ImprintPage({
  bookTitle,
  variantLabel,
  level,
  generatedAt,
  look,
  isbn,
  trimSize = "a4",
  bleed = 0,
  credits = [],
}: {
  bookTitle: string;
  variantLabel: string;
  level: string;
  generatedAt: string;
  look: Look;
  isbn?: string;
  trimSize?: TrimSizeId;
  bleed?: number;
  credits?: string[];
}) {
  return (
    <Page
      size={{ width: TRIM_SIZES[trimSize].widthPt + 2 * bleed, height: TRIM_SIZES[trimSize].heightPt + 2 * bleed }}
      style={[styles.page, { fontFamily: look.bodyFont }, bleedPadding(bleed)]}
    >
      <View style={styles.imprintBlock}>
        <Text style={[styles.imprintTitle, { color: look.palette.primaryDark, fontFamily: look.headingFont }]}>{bookTitle}</Text>
        <Text style={styles.imprintLine}>{variantLabel ? `${variantLabel} · ${level}` : level}</Text>
        <Text style={styles.imprintLine}>Oluşturulma tarihi: {generatedAt}</Text>
        <Text style={styles.imprintDisclosure}>
          Bu içerik, kullanıcı tarafından yüklenen bir kaynak ders kitabının sayfa yapısından esinlenerek
          yapay zeka (Kitap Orkestrası) ile üretilmiştir. Metin ve görseller orijinaldir; kaynak eserin
          birebir kopyası değildir.
        </Text>
        {credits.map((c) => (
          <Text key={c} style={styles.imprintDisclosure}>
            {c}
          </Text>
        ))}
        {isbn && (
          <View style={styles.barcodeBlock}>
            <Barcode isbn={isbn} />
          </View>
        )}
      </View>
      <Footer bookTitle={bookTitle} variantLabel={variantLabel} bleed={bleed} />
    </Page>
  );
}

// QA fix (2026-10-06): plain toUpperCase() is locale-blind, so Turkish
// titles printed "NESNELERI" instead of "NESNELERİ" in running headers and
// section kickers. Uppercase with the book's own language; when that isn't
// known (older runs), fall back to Turkish rules only if the text itself has
// Turkish-specific letters.
const TURKISH_LETTERS = /[ıİşŞğĞ]/;

export function upperFor(text: string, contentLanguage?: string): string {
  const lang = contentLanguage?.trim() || (TURKISH_LETTERS.test(text) ? "tr" : undefined);
  try {
    return text.toLocaleUpperCase(lang);
  } catch {
    return text.toUpperCase();
  }
}

function pagesForVariant(unit: GeneratedUnit, variant: Variant): GeneratedPage[] {
  switch (variant) {
    case "student_book":
      return unit.studentBookPages ?? [];
    case "workbook":
      return unit.workbookPages ?? [];
    case "teacher_book":
      return unit.teacherBookPages ?? [];
    case "test_booklet":
      return unit.testBookletPages ?? [];
  }
}

export type CoverProps = {
  bookTitle: string;
  level: string;
  variantLabel: string;
  unitCount: number;
  coverImageSrc?: string;
  look: Look;
  logoUrl?: string | null;
  logoStyle: { top?: number; bottom?: number; left?: number; right?: number } | null;
  contentLanguage?: string;
  pageHeight: number;
};

function CoverLogo({ logoUrl, logoStyle }: Pick<CoverProps, "logoUrl" | "logoStyle">) {
  if (!logoUrl || !logoStyle) return null;
  return (
    <View style={[styles.coverLogoBadge, logoStyle]}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
      <Image src={logoUrl} style={styles.coverLogo} />
    </View>
  );
}

// Faz 1 "Tasarım sistemi": the front cover follows the theme's coverStyle.
// "band" is the original layout; "full-bleed" is the publisher look (art to
// the edges, title plate over it); "framed" is the academic look.
export function CoverBody(props: CoverProps) {
  const { bookTitle, level, variantLabel, unitCount, coverImageSrc, look, contentLanguage } = props;
  const { palette, theme } = look;

  if (theme.coverStyle === "full-bleed") {
    return (
      <>
        {coverImageSrc ? (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
            <Image src={coverImageSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </View>
        ) : (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.primaryDark }} />
        )}
        <View style={{ position: "absolute", top: 48, left: 40 }}>
          <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 11, letterSpacing: 2, color: "#ffffff", backgroundColor: palette.accent, paddingVertical: 5, paddingHorizontal: 10, borderRadius: theme.radius }}>
            {upperFor(level, contentLanguage)}
          </Text>
        </View>
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 40, paddingTop: 26, paddingBottom: 40 }}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.primaryDark, opacity: 0.88 }} />
          <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: 34, color: "#ffffff", lineHeight: 1.2, marginBottom: 8 }}>{bookTitle}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 15, color: "#ffffff" }}>{variantLabel}</Text>
            {unitCount > 0 && <Text style={{ fontFamily: NOTO_SANS, fontSize: 10, color: "#ffffff", opacity: 0.75 }}>· {unitCount} units</Text>}
          </View>
        </View>
        <CoverLogo logoUrl={props.logoUrl} logoStyle={props.logoStyle} />
      </>
    );
  }

  if (theme.coverStyle === "framed") {
    return (
      <View style={{ position: "absolute", top: 22, left: 22, right: 22, bottom: 22, borderWidth: 1.5, borderColor: palette.primary, padding: 26 }}>
        <View style={{ borderBottomWidth: 0.75, borderBottomColor: palette.primary, paddingBottom: 14, marginBottom: 18 }}>
          <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 10, letterSpacing: 2.5, color: palette.accent, marginBottom: 8 }}>
            {upperFor(level, contentLanguage)}
          </Text>
          <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: 30, color: palette.primaryDark, lineHeight: 1.2 }}>{bookTitle}</Text>
        </View>
        {coverImageSrc && (
          <View style={{ flex: 1, borderRadius: theme.radius, overflow: "hidden", marginBottom: 18 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
            <Image src={coverImageSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </View>
        )}
        <Text style={{ fontFamily: look.headingFont, fontSize: 16, color: palette.primary }}>{variantLabel}</Text>
        <CoverLogo logoUrl={props.logoUrl} logoStyle={props.logoStyle} />
      </View>
    );
  }

  return (
    <>
      <View style={[styles.coverBand, { backgroundColor: palette.primaryDark }]}>
        <Svg viewBox="0 0 600 480" style={styles.coverDecoration}>
          <Circle cx="540" cy="60" r="150" fill="#ffffff" opacity={0.06} />
          <Circle cx="60" cy="440" r="120" fill="#ffffff" opacity={0.06} />
          <Circle cx="500" cy="420" r="60" fill={palette.accent} opacity={0.18} />
          <Path d="M0 340 L600 260 L600 480 L0 480 Z" fill="#ffffff" opacity={0.05} />
          <Circle cx="80" cy="70" r="5" fill={palette.accent} opacity={0.8} />
          <Circle cx="110" cy="95" r="3" fill="#ffffff" opacity={0.5} />
          <Circle cx="60" cy="110" r="3" fill="#ffffff" opacity={0.5} />
        </Svg>
        <CoverLogo logoUrl={props.logoUrl} logoStyle={props.logoStyle} />
        <Text style={styles.coverKicker}>{upperFor(level, contentLanguage)}</Text>
        <Text style={styles.coverTitle}>{bookTitle}</Text>
        <Text style={styles.coverSubtitle}>{variantLabel}</Text>
      </View>
      <View style={styles.coverFooter}>
        {coverImageSrc && (
          // Explicit height: with only flex:1 react-pdf sized the portrait
          // image to its own aspect ratio and pushed the pill row onto a
          // second, otherwise blank cover page.
          <View style={{ borderRadius: 10, overflow: "hidden", height: props.pageHeight * 0.62 - 28 - 14 - 24 - 40 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
            <Image src={coverImageSrc} style={styles.coverIllustration} />
          </View>
        )}
        <View style={styles.coverPillRow}>
          {unitCount > 0 && <Text style={styles.coverPill}>{unitCount === 1 ? "1 unit" : `${unitCount} units`}</Text>}
        </View>
      </View>
    </>
  );
}

// The original single-column flow - used for legacy pages (no template),
// pages hand-positioned in Dizilim, and template fallbacks (see
// resolvePageTemplate).
function StandardPageBody({
  page,
  unit,
  isUnitFirstPage,
  imageSrc,
  look,
  showAnswerKey,
  pageSize,
  imageHeight,
  sectionKicker,
  bleed = 0,
}: {
  bleed?: number;
  page: GeneratedPage;
  unit: GeneratedUnit;
  isUnitFirstPage: boolean;
  imageSrc?: string;
  look: Look;
  showAnswerKey: boolean;
  pageSize: { width: number; height: number };
  imageHeight: number;
  sectionKicker?: string;
}) {
  const { palette } = look;
  return (
    <>
      {isUnitFirstPage && (
        <View style={styles.unitHeaderRow}>
          <Svg viewBox="0 0 60 60" style={[styles.unitBadgeDecoration, { width: 60, height: 60 }]}>
            <Circle cx="30" cy="30" r="28" fill={palette.primary} opacity={0.12} />
          </Svg>
          <View style={[styles.unitBadge, { backgroundColor: palette.primary }]}>
            <Text style={styles.unitBadgeText}>{unit.unitNumber}</Text>
          </View>
          <View>
            <Text style={[styles.unitKicker, { color: palette.primary }]}>UNIT {unit.unitNumber}</Text>
            <Text style={[styles.unitTitle, { fontFamily: look.headingFont }]}>{unit.title}</Text>
          </View>
        </View>
      )}

      {imageSrc &&
        (page.imageLayout ? (
          // Faz "Sayfa Dizilimi Editörü": opt-in absolute positioning,
          // page-relative coordinates (see BlockCard in ./blocks.tsx).
          (() => {
            const clamped = clampLayoutToPage(page.imageLayout, pageSize.width, pageSize.height);
            const box = { ...clamped, x: clamped.x + bleed, y: clamped.y + bleed };
            return (
              <View
                style={[
                  styles.pageIllustrationWrap,
                  { position: "absolute", left: box.x, top: box.y, width: box.width, height: box.height },
                ]}
              >
                {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
                <Image src={imageSrc} style={styles.pageIllustration} />
              </View>
            );
          })()
        ) : (
          // The image prompt used to print here as a caption - that is an
          // instruction to the image model, not reader-facing text, and was
          // the most obvious "machine-made" tell on the page. Removed.
          <View wrap={false}>
            <View
              style={[
                styles.pageIllustrationWrap,
                { height: imageHeight, backgroundColor: palette.primaryLight, borderRadius: look.theme.radius },
              ]}
            >
              {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
              <Image src={imageSrc} style={styles.pageIllustration} />
            </View>
          </View>
        ))}

      {sectionKicker && <Text style={[styles.sectionKicker, { color: palette.primary }]}>{sectionKicker}</Text>}
      {clampedBlocks(page, pageSize).map((b) => (b.layout && bleed ? { ...b, layout: { ...b.layout, x: b.layout.x + bleed, y: b.layout.y + bleed } } : b)).map((block, i) => (
        <BlockCard block={block} showAnswerKey={showAnswerKey} look={look} key={i} />
      ))}
      <GlossaryGrid glossary={page.glossary} look={look} />
    </>
  );
}

export function BookDocument({
  bookTitle,
  variant,
  units,
  level,
  contentsUnits,
  coverImageSrc,
  pageImages,
  generatedAt,
  isbn,
  trimSize = "a4",
  sourceStyle,
  contentLanguage,
  designTheme,
  onPageStart,
  bleed = 0,
  includeCover = true,
  bookKind,
  forcePlain,
  compact,
  pictureSrc,
}: {
  /** "<unitNumber>:<pageIndex>" keys of pages printed with tighter activity sizes - renderBookFitted's last resort. */
  compact?: ReadonlySet<string>;
  /** emoji -> image src for activity pictures (loadEmojiIcons); unset = pictures print as short descriptions. */
  pictureSrc?: Record<string, string>;
  /** "<unitNumber>:<pageIndex>" keys of pages to print in plain flow - set by renderBookFitted after a measured spill. */
  forcePlain?: ReadonlySet<string>;
  /** Faz 6: "picturebook" drops the coursebook furniture (units, contents, book-type labels). */
  bookKind?: string | null;
  /** Faz 4: the print interior goes to the printer without its cover (the cover is a separate wrap). */
  includeCover?: boolean;
  /** Faz 4: print PDF - every page gets this much bleed (BLEED_PT) on each edge. */
  bleed?: number;
  /** Faz 3: proof renders pass this to map PDF pages to logical pages. */
  onPageStart?: PageStartListener;
  bookTitle: string;
  variant: Variant;
  units: GeneratedUnit[];
  level: string;
  contentsUnits: CourseUnitSummary[];
  coverImageSrc?: string;
  pageImages?: Record<number, string>;
  generatedAt?: string;
  isbn?: string;
  trimSize?: TrimSizeId;
  sourceStyle?: BookDocumentSourceStyle;
  /** BCP-47 code of the book content (outline.contentLanguage) - drives locale-correct uppercasing. */
  contentLanguage?: string;
  /** Faz 1: visual theme id (generation_runs.design_theme); unset = classic. */
  designTheme?: DesignThemeId | string | null;
}) {
  const isPictureBook = bookKind === "picturebook";
  const variantLabel = isPictureBook ? "" : VARIANT_LABELS[variant];
  const theme = applySourceType(resolveDesignTheme(designTheme), sourceStyle?.type, TRIM_SIZES[trimSize].heightPt);
  // A source PDF's own colours win over the theme palette (the user chose
  // to mirror that book); otherwise the theme's palette for this book type.
  const palette = derivePaletteFromColors(sourceStyle?.dominantColors) ?? theme.palettes[variant];
  const look = { ...makeLook(theme, palette), pictureSrc };
  const usesIcons = !!pictureSrc && Object.keys(pictureSrc).length > 0;
  const logoStyle = sourceStyle?.logoUrl ? LOGO_POSITION_STYLE[sourceStyle.logoPosition ?? "top_right"] : null;
  const pageImageHeight = sourceStyle?.density === "compact" ? 180 : sourceStyle?.density === "spacious" ? 280 : 230;
  // pageSize is the TRIM size (what layouts are designed against);
  // sheetSize adds the bleed for a print PDF.
  const pageSize = { width: TRIM_SIZES[trimSize].widthPt, height: TRIM_SIZES[trimSize].heightPt };
  const sheetSize = { width: pageSize.width + 2 * bleed, height: pageSize.height + 2 * bleed };
  const pageStyle = [styles.page, { fontFamily: look.bodyFont, fontSize: theme.bodySize }, bleedPadding(bleed)];
  // Faz "Teacher's Book/Test Booklet Genişletme": every book type except the
  // student book prints its answer key.
  // A Teacher's Book prints each answer under its exercise; a Workbook or
  // Test prints them only on the answer-key pages at the back - answers
  // right under the questions would give them away to the learner.
  const inlineAnswers = variant === "teacher_book";
  const showAnswerKey = variant === "workbook" || variant === "test_booklet";

  return (
    <Document title={`${bookTitle} - ${variantLabel}`}>
      {includeCover && (
      <Page size={sheetSize} style={styles.coverPage}>
        <PageMarker id="cover" onPageStart={onPageStart} />
        <CoverBody
          bookTitle={bookTitle}
          level={level}
          variantLabel={variantLabel}
          unitCount={isPictureBook ? 0 : units.length}
          coverImageSrc={coverImageSrc}
          look={look}
          logoUrl={sourceStyle?.logoUrl}
          logoStyle={logoStyle}
          contentLanguage={contentLanguage}
          pageHeight={sheetSize.height}
        />
      </Page>
      )}

      <ImprintPage
        bookTitle={bookTitle}
        variantLabel={variantLabel}
        level={level}
        generatedAt={generatedAt ?? ""}
        look={look}
        isbn={isbn}
        trimSize={trimSize}
        bleed={bleed}
        credits={usesIcons ? [TWEMOJI_CREDIT] : []}
      />

      {!isPictureBook && (
        <ContentsPageContent
          bookTitle={bookTitle}
          level={level}
          variant={variant}
          units={contentsUnits}
          trimSize={trimSize}
          palette={palette}
          bleed={bleed}
        />
      )}

      {units.flatMap((unit) =>
        withUnitGlossary(unit, pagesForVariant(unit, variant), variant).map((page, idx) => {
          const imageSrc = resolvePageImageUrl(page, pageImages);
          const imageSrcs = resolvePageImageUrls(page, pageImages);
          const isCompact = !!compact?.has(`${unit.unitNumber}:${idx}`);
          const pageLook = isCompact ? { ...look, compact: true } : look;
          const template = forcePlain?.has(`${unit.unitNumber}:${idx}`)
            ? "standard"
            : resolvePageTemplate(page, !!imageSrc, {
                isUnitFirstPage: idx === 0,
                pictureCount: imageSrcs.length,
                tight: isCompact,
                metrics: { width: pageSize.width, height: pageSize.height, bodySize: theme.bodySize },
              });
          const edgeToEdge = template !== "standard" && EDGE_TO_EDGE_TEMPLATES.includes(template);
          const sectionKicker = page.sectionLabel ? upperFor(page.sectionLabel, contentLanguage) : undefined;
          return (
            <Page key={`${unit.unitNumber}-${page.sourcePageNumber}-${idx}`} size={sheetSize} style={pageStyle} wrap>
              <PageMarker id={`${unit.unitNumber}:${idx}`} onPageStart={onPageStart} />
              {!edgeToEdge && (
                <View style={styles.runningHeader}>
                  <Text style={[styles.runningHeaderText, { color: palette.primary }]}>
                    {isPictureBook ? upperFor(unit.title, contentLanguage) : `UNIT ${unit.unitNumber} · ${upperFor(unit.title, contentLanguage)}`}
                  </Text>
                </View>
              )}

              {template === "standard" ? (
                <StandardPageBody
                  page={page}
                  unit={unit}
                  isUnitFirstPage={idx === 0 && !isPictureBook}
                  imageSrc={imageSrc}
                  look={pageLook}
                  showAnswerKey={inlineAnswers}
                  pageSize={pageSize}
                  imageHeight={pageImageHeight}
                  sectionKicker={sectionKicker}
                  bleed={bleed}
                />
              ) : (
                <TemplatedPageBody
                  template={template}
                  page={page}
                  unit={unit}
                  isUnitFirstPage={idx === 0 && !isPictureBook}
                  imageSrc={imageSrc}
                  imageSrcs={imageSrcs}
                  look={pageLook}
                  showAnswerKey={inlineAnswers}
                  pageSize={pageSize}
                  unitKicker={`UNIT ${unit.unitNumber}`}
                  bleed={bleed}
                  sectionKicker={sectionKicker}
                />
              )}

              {template !== "full-bleed-illustration" && <Footer bookTitle={bookTitle} variantLabel={variantLabel} bleed={bleed} />}
            </Page>
          );
        }),
      )}

      {showAnswerKey && units.some((u) => pagesForVariant(u, variant).some((pg) => pg.blocks.some((b) => b.answerKey?.length))) && (
        <Page size={sheetSize} style={pageStyle} wrap>
          <PageMarker id="answer_key" onPageStart={onPageStart} />
          <View style={[styles.answerKeyTitleBand, { backgroundColor: palette.primaryDark, borderRadius: theme.radius }]}>
            <Text style={styles.answerKeyTitle}>Answer Key</Text>
          </View>
          {units.map((unit) => (
            <View key={unit.unitNumber}>
              <Text style={[styles.answerKeyUnitHeading, { color: palette.primaryDark }]}>
                Unit {unit.unitNumber}: {unit.title}
              </Text>
              {pagesForVariant(unit, variant)
                .flatMap((page) => page.blocks)
                .filter((block) => block.answerKey?.length)
                .map((block, i) => (
                  // Set inline, the way printed answer keys are
                  // ("1 library  2 park ..."): one answer per line ran a
                  // short unit's key over several pages.
                  <View key={i} style={styles.answerKeyEntry} wrap={false}>
                    <Text style={[styles.answerKeyLabel, { color: palette.primaryDark }]}>{block.heading}</Text>
                    {/* One box per answer in a wrapping row: inline text broke lines
                        between answers with a hyphen ("supermarket-"). */}
                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                      {(block.answerKey ?? []).map((answer, j) => (
                        <Text key={j} style={{ marginRight: 14 }}>
                          <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, color: palette.primary }}>{`${j + 1} `}</Text>
                          {itemText(answer)}
                        </Text>
                      ))}
                    </View>
                  </View>
                ))}
            </View>
          ))}
          <Footer bookTitle={bookTitle} variantLabel={variantLabel} bleed={bleed} />
        </Page>
      )}
    </Document>
  );
}
