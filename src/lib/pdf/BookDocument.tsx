import { isYoungLearnerLevel } from "@/lib/cefr-vocabulary";
import { dropMissingPictureRefs } from "@/lib/picture-refs";
import { unitBadgeText, unitKicker, unitName } from "@/lib/unit-label";
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Circle, Image } from "@react-pdf/renderer";
import type { GeneratedUnit, GeneratedPage, ContentBlock } from "@/lib/ai/schemas";
import { ContentsPageContent, type CourseUnitSummary } from "./ContentsDocument";
import { encodeEan13 } from "@/lib/barcode/ean13";
import { formatIsbn13 } from "@/lib/isbn";
import { PAGE_PADDING, TRIM_SIZES, type TrimSizeId } from "./page-geometry";
import { resolvePageImageUrl, resolvePageImageUrls } from "@/lib/page-image";
import { registerBookFonts, NOTO_SANS, NOTO_SERIF, withSymbols } from "./fonts";
import { derivePaletteFromColors } from "./derive-palette";
import { withUnitGlossary } from "@/lib/unit-glossary";
import { audioTrackMap, audioTracks } from "@/lib/listening";
import { blocksForRender, clampLayoutToPage } from "@/lib/layout-merge";
import { itemText } from "@/lib/item-text";
import { DESIGN_THEMES, resolveDesignTheme, type DesignThemeId } from "@/lib/design/themes";
import { DENSE_LINE, MAX_PICTURE_ASPECT, panelledExercises, resolvePageTemplate } from "@/lib/design/layouts";
import { BlockCard, GlossaryGrid, centredFigure, makeLook, type Look } from "./blocks";
import { TemplatedPageBody, EDGE_TO_EDGE_TEMPLATES } from "./templates";
import { LabelOverlay } from "./label-overlay";
import { shapeAspect } from "@/lib/design/zones";
import { CoursebookCover } from "./CoursebookCover";
import { TWEMOJI_CREDIT } from "@/lib/activities";
import { applySourceType, type SourceType } from "@/lib/design/source-theme";
import type { TopBand } from "@/lib/design/page-furniture";

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
  unitBadgeDecoration: { position: "absolute", top: -10, left: -10 },
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
      {/* A printed book shows the folio alone; "n / total" read as a generated report.
          A book mirroring a source prints TopicFooter instead. */}
      <Text render={({ pageNumber }) => `${pageNumber}`} />
    </View>
  );
}

// Page furniture (KIYAS-13 review): the source's band across the top edge -
// a full-width strip and, when it has one, a taller tab of a second colour
// from the outer edge (the right on a recto, the left on a verso).
function TopEdgeBand({ band, bleed = 0, pageSize }: { band: TopBand; bleed?: number; pageSize: { width: number; height: number } }) {
  const h = Math.max(3, band.heightRatio * pageSize.height);
  const tab = band.tab;
  return (
    <View
      fixed
      style={{ position: "absolute", top: 0, left: 0, right: 0 }}
      render={({ pageNumber }) => {
        const recto = pageNumber % 2 === 1;
        // The tab starts halfway down the strip and ends in a round cap.
        const tabBottom = tab ? Math.max(h + 2, tab.heightRatio * pageSize.height) : 0;
        const tabTop = h / 2;
        const tabW = tab ? tab.widthRatio * pageSize.width : 0;
        const cap = (tabBottom - tabTop) / 2;
        return (
          <View style={{ position: "relative", height: Math.max(h, tabBottom) + bleed }}>
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: h + bleed, backgroundColor: band.color }} />
            {tab ? (
              <View
                style={[
                  { position: "absolute", top: tabTop + bleed, width: tabW + bleed, height: tabBottom - tabTop, backgroundColor: tab.color },
                  recto
                    ? { right: 0, borderTopLeftRadius: cap, borderBottomLeftRadius: cap }
                    : { left: 0, borderTopRightRadius: cap, borderBottomRightRadius: cap },
                ]}
              />
            ) : null}
          </View>
        );
      }}
    />
  );
}

// The footer of a book mirroring a source: the page's topic on a pill and
// the folio in a ring, at the outer bottom corner - where coursebooks put
// them - instead of the "title · book type" running line.
function TopicFooter({ topic, look, bleed = 0 }: { topic?: string; look: Look; bleed?: number }) {
  const ring = look.furniture?.numberBadge?.color ?? look.palette.primary;
  return (
    <View
      fixed
      style={{ position: "absolute", bottom: 22 + bleed, left: 44 + bleed, right: 44 + bleed }}
      render={({ pageNumber }) => {
        const recto = pageNumber % 2 === 1;
        const pill = topic ? (
          <View key="pill" style={{ backgroundColor: look.palette.primaryLight, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 2, marginHorizontal: 5 }}>
            <Text style={{ fontFamily: look.bodyFont, fontSize: 8, color: "#374151" }}>{topic}</Text>
          </View>
        ) : null;
        const folio = (
          <View
            key="folio"
            style={{ width: 17, height: 17, borderRadius: 8.5, borderWidth: 1.2, borderColor: ring, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={[{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 7.5, color: ring }, centredFigure(7.5)]}>{pageNumber}</Text>
          </View>
        );
        return (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: recto ? "flex-end" : "flex-start" }}>
            {recto ? [pill, folio] : [folio, pill]}
          </View>
        );
      }}
    />
  );
}

// A topic short enough for the footer pill: the page's section label (or
// the unit title), cut at a word.
export function footerTopic(label: string | undefined | null): string | undefined {
  // The writer's section labels carry book and unit prefixes ("Workbook:
  // Commands, numbers...", "Unit 0: Hello, Friends!") - the pill is the topic.
  const t = label
    ?.trim()
    .replace(/^(student book|workbook|teacher'?s book|test booklet)\s*[:·-]\s*/i, "")
    .replace(/^unit\s+\d+\s*[:·-]\s*/i, "");
  if (!t) return undefined;
  if (t.length <= 32) return t;
  const cut = t.slice(0, 32);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 20)).replace(/[\s,;:·-]+$/, "")}…`;
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
  /** Unset = a coursebook proportion of pageHeight. */
  pageWidth?: number;
  /** KIYAS-13: the source's measured colours as printed (sourceStyle.dominantColors) - the coursebook cover keeps them bright. */
  brandColors?: string[];
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

  // KIYAS-13: the default cover is set like a published coursebook's (see
  // CoursebookCover) - it was a dark band over a framed picture.
  return (
    <>
      <CoursebookCover
        bookTitle={bookTitle}
        level={level}
        variantLabel={variantLabel}
        coverImageSrc={coverImageSrc}
        look={look}
        brandColors={props.brandColors}
        upper={(text) => upperFor(text, contentLanguage)}
        pageWidth={props.pageWidth ?? props.pageHeight * 0.75}
        pageHeight={props.pageHeight}
      />
      <CoverLogo logoUrl={props.logoUrl} logoStyle={props.logoStyle} />
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
  // KIYAS-11: a mirrored page that had to go to plain flow (it ran over even
  // set tight) printed in the card style, a second design inside the book.
  // It keeps the mirrored pages' coursebook setting instead.
  const mirrored = !!page.zonePlan;
  const panels = mirrored ? panelledExercises(page.blocks) : null;
  const contentWidth = pageSize.width - 88;
  return (
    <>
      {isUnitFirstPage && (
        <View style={styles.unitHeaderRow}>
          <Svg viewBox="0 0 60 60" style={[styles.unitBadgeDecoration, { width: 60, height: 60 }]}>
            <Circle cx="30" cy="30" r="28" fill={palette.primary} opacity={0.12} />
          </Svg>
          <View style={[styles.unitBadge, { backgroundColor: palette.primary }]}>
            <Text style={styles.unitBadgeText}>{unitBadgeText(unit.unitNumber)}</Text>
          </View>
          <View>
            <Text style={[styles.unitKicker, { color: palette.primary }]}>{unitKicker(unit.unitNumber)}</Text>
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
          <View wrap={false} style={mirrored ? { alignItems: "center" } : undefined}>
            <View
              style={[
                styles.pageIllustrationWrap,
                mirrored
                  ? { height: imageHeight, width: Math.min(contentWidth, imageHeight * MAX_PICTURE_ASPECT), borderRadius: look.theme.radius }
                  : { height: imageHeight, borderRadius: look.theme.radius },
              ]}
            >
              {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
              <Image src={imageSrc} style={mirrored ? [styles.pageIllustration, { objectFit: "cover", objectPositionY: "30%" }] : styles.pageIllustration} />
              {mirrored && page.labels?.length ? (
                (() => {
                  const width = Math.min(contentWidth, imageHeight * MAX_PICTURE_ASPECT);
                  return <LabelOverlay labels={page.labels} width={width} height={imageHeight} look={look} imageAspect={shapeAspect(width / imageHeight)} fit="cover" positionY={0.3} />;
                })()
              ) : null}
            </View>
          </View>
        ))}

      {sectionKicker && <Text style={[styles.sectionKicker, { color: palette.primary }]}>{sectionKicker}</Text>}
      {mirrored ? (
        <View style={{ lineHeight: `${(look.theme.bodySize * DENSE_LINE).toFixed(2)}pt` }}>
          {page.blocks.map((block, i) => (
            <BlockCard block={block} showAnswerKey={showAnswerKey} look={look} key={i} frameless dense panel={panels?.has(block)} />
          ))}
        </View>
      ) : (
        clampedBlocks(page, pageSize)
          .map((b) => (b.layout && bleed ? { ...b, layout: { ...b.layout, x: b.layout.x + bleed, y: b.layout.y + bleed } } : b))
          .map((block, i) => <BlockCard block={block} showAnswerKey={showAnswerKey} look={look} key={i} />)
      )}
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
  slack,
  pictureSrc,
}: {
  /** "<unitNumber>:<pageIndex>" keys of pages printed with tighter activity sizes - renderBookFitted's last resort. */
  compact?: ReadonlySet<string>;
  /** Faz G3: "<unitNumber>:<pageIndex>" -> empty height a previous render left at the page's foot. */
  slack?: ReadonlyMap<string, number>;
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
  const look = {
    ...makeLook(theme, palette),
    pictureSrc,
    tracks: audioTrackMap(units),
    // Young learners only ("CEFR Pre-A1", "Starters"); adult A1 keeps definitions.
    wordList: variant !== "teacher_book" && isYoungLearnerLevel(level),
    // The word list prints once, in the Student Book; repeated at the end of
    // each workbook unit it ran onto a page of its own.
    noGlossary: variant === "workbook" && isYoungLearnerLevel(level),
    furniture: sourceStyle?.type?.furniture ?? null,
  };
  // A book mirroring a source prints its page furniture: the topic footer
  // always, the top band when the source has one.
  const mirrorsSource = !!sourceStyle?.type && !isPictureBook;
  // Audio scripts at the back (2026-10-21): every track in the Teacher's
  // Book; in the other books the tracks of their own exercises - a pupil's
  // book prints no scripts, as in published courses.
  const printedHeadings = new Set(units.flatMap((u) => pagesForVariant(u, variant).flatMap((pg) => pg.blocks.map((b) => b.heading))));
  const scriptTracks =
    variant === "student_book" || isPictureBook
      ? []
      : audioTracks(units).filter((t) => variant === "teacher_book" || printedHeadings.has(t.heading));
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
  // A young learners' workbook prints no key (KIYAS-13 review): pupils
  // cannot use one, and published Pre-A1 courses keep it in the Teacher's Book.
  const showAnswerKey = (variant === "workbook" && !look.wordList) || variant === "test_booklet";

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
          pageWidth={sheetSize.width}
          brandColors={sourceStyle?.dominantColors}
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
        withUnitGlossary(unit, pagesForVariant(unit, variant), variant).map((stored, idx) => {
          const imageSrc = resolvePageImageUrl(stored, pageImages);
          const imageSrcs = resolvePageImageUrls(stored, pageImages);
          // "Picture 4: the door" on a page whose picture 4 failed to generate.
          const page = dropMissingPictureRefs(stored, imageSrcs.length);
          const isCompact = !!compact?.has(`${unit.unitNumber}:${idx}`);
          const zoneSlack = slack?.get(`${unit.unitNumber}:${idx}`);
          const pageLook = isCompact || zoneSlack ? { ...look, compact: isCompact, zoneSlack } : look;
          const template = forcePlain?.has(`${unit.unitNumber}:${idx}`)
            ? "standard"
            : resolvePageTemplate(page, !!imageSrc, {
                isUnitFirstPage: idx === 0,
                pictureCount: imageSrcs.length,
                tight: isCompact,
                metrics: { width: pageSize.width, height: pageSize.height, bodySize: theme.bodySize },
              });
          const edgeToEdge = template !== "standard" && EDGE_TO_EDGE_TEMPLATES.includes(template);
          // In a mirrored book the section label moves to the footer pill.
          const sectionKicker = page.sectionLabel && !mirrorsSource ? upperFor(page.sectionLabel, contentLanguage) : undefined;
          const topBand = mirrorsSource && !edgeToEdge ? look.furniture?.topBand : undefined;
          return (
            <Page key={`${unit.unitNumber}-${page.sourcePageNumber}-${idx}`} size={sheetSize} style={pageStyle} wrap>
              <PageMarker id={`${unit.unitNumber}:${idx}`} onPageStart={onPageStart} />
              {topBand ? <TopEdgeBand band={topBand} bleed={bleed} pageSize={pageSize} /> : null}
              {!edgeToEdge && (
                <View style={styles.runningHeader}>
                  <Text style={[styles.runningHeaderText, { color: palette.primary }]}>
                    {isPictureBook ? upperFor(unit.title, contentLanguage) : `${unitKicker(unit.unitNumber)} · ${upperFor(unit.title, contentLanguage)}`}
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
                  unitKicker={unitKicker(unit.unitNumber)}
                  bleed={bleed}
                  sectionKicker={sectionKicker}
                />
              )}

              {template !== "full-bleed-illustration" &&
                (mirrorsSource ? (
                  <TopicFooter topic={footerTopic(page.sectionLabel || unit.title)} look={look} bleed={bleed} />
                ) : (
                  <Footer bookTitle={bookTitle} variantLabel={variantLabel} bleed={bleed} />
                ))}
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
                {unitName(unit.unitNumber)}: {unit.title}
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

      {scriptTracks.length > 0 && (
        <Page size={sheetSize} style={pageStyle} wrap>
          <PageMarker id="audio_scripts" onPageStart={onPageStart} />
          <View style={[styles.answerKeyTitleBand, { backgroundColor: palette.primaryDark, borderRadius: theme.radius }]}>
            <Text style={styles.answerKeyTitle}>Audio Scripts</Text>
          </View>
          {scriptTracks.map((t) => (
            <View key={t.track} style={styles.answerKeyEntry} wrap={false}>
              <Text style={[styles.answerKeyLabel, { color: palette.primaryDark }]}>
                {`TRACK ${t.track} · ${unitKicker(t.unitNumber)} · ${t.heading}`}
              </Text>
              {t.entry.dialogueLines?.length ? (
                t.entry.dialogueLines.map((l, i) => (
                  <Text key={i} style={{ marginBottom: 1.5 }}>
                    <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, color: palette.primary }}>{`${l.speaker}: `}</Text>
                    {l.line}
                  </Text>
                ))
              ) : (
                <Text>{t.entry.script}</Text>
              )}
            </View>
          ))}
          <Footer bookTitle={bookTitle} variantLabel={variantLabel} bleed={bleed} />
        </Page>
      )}
    </Document>
  );
}
