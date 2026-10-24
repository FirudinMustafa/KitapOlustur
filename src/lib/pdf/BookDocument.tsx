import { isYoungLearnerLevel } from "@/lib/cefr-vocabulary";
import { dropMissingPictureRefs } from "@/lib/picture-refs";
import { unitBadgeText, unitKicker, unitName } from "@/lib/unit-label";
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Circle, Image } from "@react-pdf/renderer";
import type { GeneratedUnit, GeneratedPage, ContentBlock } from "@/lib/ai/schemas";
import { ContentsPageContent, type CourseUnitSummary } from "./ContentsDocument";
import { encodeEan13 } from "@/lib/barcode/ean13";
import { formatIsbn13 } from "@/lib/isbn";
import { PAGE_PADDING, TRIM_SIZES, type TrimSizeId } from "./page-geometry";
import { extraImageKey, resolvePageImageUrl, resolvePageImageUrls } from "@/lib/page-image";
import { pageLayoutType } from "@/lib/design/page-types";
import { typedLayout } from "@/lib/design/type-layout";
import { ScenePicture, TypedPageBody, sceneInsets } from "./type-templates";
import { worksheetLayout } from "@/lib/design/worksheet-layout";
import { WorksheetPageBody } from "./worksheet";
import { registerBookFonts, NOTO_SANS, NOTO_SERIF, withSymbols } from "./fonts";
import { derivePaletteFromColors } from "./derive-palette";
import { withUnitGlossary } from "@/lib/unit-glossary";
import { audioTrackMap, audioTracks } from "@/lib/listening";
import { blocksForRender, clampLayoutToPage } from "@/lib/layout-merge";
import { itemText } from "@/lib/item-text";
import { DESIGN_THEMES, resolveDesignTheme, type DesignThemeId } from "@/lib/design/themes";
import { DENSE_LINE, MAX_PICTURE_ASPECT, isExerciseBlock, panelledExercises, resolvePageTemplate } from "@/lib/design/layouts";
import { BlockCard, GlossaryGrid, makeLook, type Look } from "./blocks";
import { TemplatedPageBody, EDGE_TO_EDGE_TEMPLATES } from "./templates";
import { LabelOverlay } from "./label-overlay";
import { BubbleOverlay } from "./bubble-overlay";
import { pageBubbles, withoutBubbledDialogue } from "@/lib/ai/page-bubbles";
import { pictureSlotAspects, shapeAspect } from "@/lib/design/zones";
import { CoursebookCover } from "./CoursebookCover";
import { TWEMOJI_CREDIT } from "@/lib/activities";
import { applySourceType, type SourceType } from "@/lib/design/source-theme";
import { planLessons, withSectionHeads } from "@/lib/lesson-furniture";
import { GroundLayer, PageMarker, TopEdgeBand, TopicFooter, sheetKey, topBandHeight, type PageStartListener } from "./page-chrome";
export { sheetKey, type PageStartListener } from "./page-chrome";
import { FramedImage, pictureGround, pictureRect } from "./picture-frame";
import { POINT_AT_PICTURE, SpecPage, usableSpec } from "./spec-page";
import type { PictureInfo } from "./picture-fit";

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

// A topic short enough for the footer pill: the page's section label (or
// the unit title), cut at a word.
export function footerTopic(label: string | undefined | null): string | undefined {
  // The writer's section labels carry book and unit prefixes ("Workbook:
  // Commands, numbers...", "Unit 0: Hello, Friends!") - the pill is the topic.
  const t = label
    ?.trim()
    .replace(/^(student book|workbook|teacher'?s book|test booklet)\s*[:·-]\s*/i, "")
    .replace(/^unit\s+\d+\s*[:·-]\s*/i, "")
    .replace(/^[^:]*\bunit\b[^:]*:\s*/i, ""); // "Starter Unit: Say Hello!"
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
            {mirrored ? (
              (() => {
                // The same rectangle for the picture and what points at it (picture-fit.ts).
                const width = Math.min(contentWidth, imageHeight * MAX_PICTURE_ASPECT);
                const rect = pictureRect(look, imageSrc, width, imageHeight, { anchorY: 0.3 });
                const placement = rect ? { crop: rect } : { imageAspect: shapeAspect(width / imageHeight), fit: "cover" as const, positionY: 0.3 };
                const ground = pictureGround(look, imageSrc, rect, width, imageHeight);
                return (
                  <View style={[styles.pageIllustrationWrap, { height: imageHeight, width, borderRadius: look.theme.radius }, ground ? { backgroundColor: ground } : {}]}>
                    <FramedImage src={imageSrc} rect={rect} width={width} height={imageHeight} anchorY={0.3} />
                    {page.labels?.length ? <LabelOverlay labels={page.labels} width={width} height={imageHeight} look={look} {...placement} /> : null}
                    {page.bubbles?.length ? <BubbleOverlay bubbles={page.bubbles} width={width} height={imageHeight} look={look} {...placement} /> : null}
                  </View>
                );
              })()
            ) : (
              <View style={[styles.pageIllustrationWrap, { height: imageHeight, borderRadius: look.theme.radius }]}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
                <Image src={imageSrc} style={styles.pageIllustration} />
              </View>
            )}
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
  pictures,
}: {
  /** Page picture src -> its measured shape and object (measurePictures); unset = pictures are drawn by their frames' shapes. */
  pictures?: Record<string, PictureInfo>;
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
    pictures,
    tracks: audioTrackMap(units),
    // Young learners only ("CEFR Pre-A1", "Starters"); adult A1 keeps definitions.
    wordList: variant !== "teacher_book" && isYoungLearnerLevel(level),
    // The word list prints once, in the Student Book; repeated at the end of
    // each workbook unit it ran onto a page of its own. A book mirroring a
    // source prints none at all - the source's pupil pages carry no word
    // list (hand-set reference, 2026-10-23).
    noGlossary: isYoungLearnerLevel(level) && variant !== "teacher_book" && (variant === "workbook" || !!sourceStyle?.type),
    furniture: sourceStyle?.type?.furniture ?? null,
  };
  // A book mirroring a source prints its page furniture: the topic footer
  // always, the top band when the source has one.
  const mirrorsSource = !!sourceStyle?.type && !isPictureBook;
  // Lesson tabs, section heads, word boxes and pointers where the source
  // prints them (lesson-furniture.ts) - a teen coursebook, not a young
  // learners' one.
  const lessonsOn = mirrorsSource && !!look.furniture?.lessons;
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

      {units.flatMap((unit) => {
        const unitPages = withUnitGlossary(unit, pagesForVariant(unit, variant), variant);
        // Lesson furniture through the unit's pages (lesson-furniture.ts).
        const lessons = lessonsOn ? planLessons(unitPages, unit) : [];
        return unitPages.map((sourced, idx) => {
          // Section heads only where the source page prints them.
          const stored = lessonsOn ? { ...sourced, blocks: withSectionHeads(sourced.blocks, sourced.sourceShape?.lesson?.sections, isExerciseBlock) } : sourced;
          const lesson = lessons[idx] ?? {};
          const imageSrc = resolvePageImageUrl(stored, pageImages);
          const imageSrcs = resolvePageImageUrls(stored, pageImages);
          // The agent designer's layout (AGENT_DESIGNER=1), when the page has
          // one that still fits it: the page is drawn from it, furniture and
          // all (spec-page.tsx). Every other page prints as before.
          const designed = isPictureBook ? null : usableSpec({ page: sourced, pictures: imageSrcs, look, lessonsOn });
          if (designed) {
            return (
              <SpecPage
                key={`${unit.unitNumber}-${sourced.sourcePageNumber}-${idx}`}
                spec={designed}
                page={sourced}
                unit={unit}
                pictures={imageSrcs}
                look={look}
                pageSize={pageSize}
                bleed={bleed}
                lesson={lesson}
                lessonsOn={lessonsOn}
                showAnswerKey={inlineAnswers}
                topic={footerTopic(sourced.sectionLabel || unit.title)}
                onPageStart={onPageStart}
                pageKey={`${unit.unitNumber}:${idx}`}
              />
            );
          }
          // "Picture 4: the door" on a page whose picture 4 failed to generate.
          const referenced = dropMissingPictureRefs(stored, imageSrcs.length);
          // A young learners' pupil book prints no teacher notes (KIYAS-14: the
          // writer kept adding "Teacher: sing every day" tip boxes, and the
          // source prints none); the Teacher's Book keeps them.
          // On a page mirroring a source no box prints at all ("Remember",
          // "Grammar"): the source's pupil pages have none, and the hand-set
          // reference left them out.
          const unboxed = look.wordList
            ? { ...referenced, blocks: referenced.blocks.filter((b) => b.callout !== "tip" && !(referenced.zonePlan && b.callout)) }
            : referenced;
          // "Listen and point. Say the names." over a picture prints no list
          // of the names in the source (p.2) or the hand-set reference: the
          // learners point at the picture. Cards and panels pages keep their
          // items - they are the cards' words and the panels' lines.
          const listed =
            look.wordList && unboxed.zonePlan && imageSrcs.length && pageLayoutType(unboxed) === "mixed"
              ? { ...unboxed, blocks: unboxed.blocks.map((b) => (POINT_AT_PICTURE.test(b.heading ?? "") && b.items?.every((i) => itemText(i).split(/\s+/).length <= 3) ? { ...b, items: [] } : b)) }
              : unboxed;
          // A scene's dialogue set as speech bubbles on its main picture
          // (source i5 p.14): where the bubbles are drawn - a scene, or a
          // mirrored page's main picture (drawsBubbles below) - the
          // dialogue block keeps its heading and rubric but not its lines.
          // Elsewhere the page prints as it always did.
          const bubbles = imageSrc && !listed.imageLayout ? pageBubbles(listed) : [];
          const page = listed.bubbles ? { ...listed, bubbles: undefined } : listed;
          const bubbled = bubbles.length ? { ...withoutBubbledDialogue(listed), bubbles } : page;
          const isCompact = !!compact?.has(`${unit.unitNumber}:${idx}`);
          const zoneSlack = slack?.get(`${unit.unitNumber}:${idx}`);
          const pageLook = isCompact || zoneSlack ? { ...look, compact: isCompact, zoneSlack } : look;
          const template = forcePlain?.has(`${unit.unitNumber}:${idx}`)
            ? "standard"
            : resolvePageTemplate(page, !!imageSrc, {
                // a lesson tab takes a unit heading's room
                isUnitFirstPage: idx === 0 || (!!page.zonePlan && !!lesson.tab),
                pictureCount: imageSrcs.length,
                tight: isCompact,
                metrics: { width: pageSize.width, height: pageSize.height, bodySize: theme.bodySize },
              });
          // "Önce sayfa tasarımı": a scene, card or panel page (page-types.ts)
          // in its type's template when its content suits it. Not on a page
          // measured running over (it goes back to the zone layout, set
          // tighter), nor with answers printed inline (Teacher's Book).
          const typed =
            forcePlain?.has(`${unit.unitNumber}:${idx}`) || inlineAnswers || isPictureBook || page.imageLayout || page.blocks.some((b) => b.layout)
              ? null
              : typedLayout(
                  pageLayoutType(page),
                  { blocks: (pageLayoutType(page) === "scene" ? bubbled : page).blocks, glossary: look.noGlossary ? undefined : page.glossary },
                  {
                    main: imageSrc,
                    extras: (page.extraImagePrompts ?? []).map((_, i) => pageImages?.[extraImageKey(page.sourcePageNumber, i + 1)]),
                    prompts: page.extraImagePrompts ?? [],
                  },
                  { width: pageSize.width, height: pageSize.height, bodySize: theme.bodySize },
                  // A page that ran over keeps its type template, set tighter.
                  { isUnitFirstPage: idx === 0, emojiSrc: pictureSrc, slack: zoneSlack, compact: isCompact },
                );
          // A workbook page (no source page to mirror) set like an activity
          // book's - framed exercises, big picture tiles (worksheet-layout.ts).
          // One that ran over even set compact is split between whole
          // exercises over sheets that each fill, instead of plain flow
          // leaving an exercise's last lines alone on a page (KIYAS-14).
          const pageKey = `${unit.unitNumber}:${idx}`;
          const split = !!forcePlain?.has(pageKey);
          const worksheet =
            !typed && variant === "workbook" && !page.zonePlan && !inlineAnswers && !isPictureBook && !page.imageLayout
              ? worksheetLayout(
                  { blocks: page.blocks, glossary: look.noGlossary ? undefined : page.glossary },
                  { width: pageSize.width, height: pageSize.height, bodySize: theme.bodySize },
                  {
                    isUnitFirstPage: idx === 0,
                    hasMain: !!imageSrc,
                    slack: (k) => slack?.get(sheetKey(pageKey, k)),
                    compact: isCompact && !split,
                    split,
                  },
                )
              : null;
          const drawsBubbles =
            bubbles.length > 0 && !worksheet && (typed ? typed.type === "scene" : template === "source-zones" || (template === "standard" && !!page.zonePlan));
          const shown = drawsBubbles ? bubbled : page;
          const scene = typed?.type === "scene";
          const edgeToEdge = scene || (template !== "standard" && EDGE_TO_EDGE_TEMPLATES.includes(template));
          // In a mirrored book the section label moves to the footer pill.
          const sectionKicker = page.sectionLabel && !mirrorsSource ? upperFor(page.sectionLabel, contentLanguage) : undefined;
          const topBand = mirrorsSource && (scene || !edgeToEdge) ? look.furniture?.topBand : undefined;
          // The source page's coloured ground, under a page set in its zones
          // or type template (a scene's picture covers the page anyway).
          const ground = mirrorsSource && !scene && !edgeToEdge && !worksheet ? page.zonePlan?.ground : undefined;
          const runningHeader = (
            <View style={styles.runningHeader}>
              <Text style={[styles.runningHeaderText, { color: palette.primary }]}>
                {isPictureBook ? upperFor(unit.title, contentLanguage) : `${unitKicker(unit.unitNumber)} · ${upperFor(unit.title, contentLanguage)}`}
              </Text>
            </View>
          );
          return (
            <Page
              key={`${unit.unitNumber}-${page.sourcePageNumber}-${idx}`}
              size={sheetSize}
              // a story page on a tinted sheet, as the source sets it (p.5)
              style={typed?.type === "panels" && mirrorsSource ? [...pageStyle, { backgroundColor: palette.primaryLight }] : pageStyle}
              wrap
            >
              <PageMarker id={pageKey} onPageStart={onPageStart} />
              {ground ? <GroundLayer ground={ground} bleed={bleed} pageSize={pageSize} /> : null}
              {scene && imageSrc ? (
                <ScenePicture
                  src={imageSrc}
                  look={look}
                  labels={page.labels}
                  bubbles={drawsBubbles ? bubbles : undefined}
                  insets={
                    drawsBubbles && typed?.type === "scene"
                      ? sceneInsets(typed, pageLook, { isUnitFirstPage: idx === 0, topInset: topBandHeight(topBand, pageSize.height), bleed, contentWidth: pageSize.width - 88, hasLabels: !!page.labels?.length })
                      : undefined
                  }
                  width={sheetSize.width}
                  height={sheetSize.height}
                  // unmeasured, the shape the scene was generated in (its source slot)
                  imageAspect={shapeAspect(page.zonePlan ? pictureSlotAspects(page.zonePlan, 1)[0] : undefined)}
                />
              ) : null}
              {topBand ? <TopEdgeBand band={topBand} bleed={bleed} pageSize={pageSize} /> : null}
              {/* Under the source's top band there is no running header line (Super Minds) - the band and footer pill carry the page. */}
              {!edgeToEdge && !(mirrorsSource && look.furniture?.topBand) && (lessonsOn ? <View style={{ height: 20 }} /> : runningHeader)}

              {worksheet ? (
                <WorksheetPageBody
                  layout={worksheet}
                  unit={unit}
                  isUnitFirstPage={idx === 0}
                  // split over sheets, it has room again
                  look={split ? { ...pageLook, compact: false } : pageLook}
                  showAnswerKey={inlineAnswers}
                  unitKicker={unitKicker(unit.unitNumber)}
                  mainSrc={imageSrc}
                  contentWidth={pageSize.width - 88}
                  sheetStart={(k) => (
                    <>
                      <PageMarker id={sheetKey(pageKey, k)} onPageStart={onPageStart} />
                      {runningHeader}
                    </>
                  )}
                />
              ) : typed ? (
                <TypedPageBody
                  layout={typed}
                  unit={unit}
                  isUnitFirstPage={idx === 0}
                  look={pageLook}
                  showAnswerKey={inlineAnswers}
                  pageSize={pageSize}
                  unitKicker={unitKicker(unit.unitNumber)}
                  bleed={bleed}
                  mainSrc={imageSrc}
                  topInset={topBandHeight(topBand, pageSize.height)}
                  labels={page.labels}
                  title={footerTopic(page.sectionLabel)}
                />
              ) : template === "standard" ? (
                <StandardPageBody
                  page={shown}
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
                  page={shown}
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
                  lesson={template === "source-zones" ? lesson : undefined}
                />
              )}

              {template !== "full-bleed-illustration" &&
                (mirrorsSource ? (
                  <TopicFooter topic={footerTopic(page.sectionLabel || unit.title)} look={look} bleed={bleed} pointers={lesson.pointers} />
                ) : (
                  <Footer bookTitle={bookTitle} variantLabel={variantLabel} bleed={bleed} />
                ))}
            </Page>
          );
        });
      })}

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
