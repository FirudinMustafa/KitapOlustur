import { Document, Page, Text, View, StyleSheet, Svg, Path, Rect, Circle, Line, Image } from "@react-pdf/renderer";
import type { GeneratedUnit, GeneratedPage, ContentBlock, ContentBlockKind } from "@/lib/ai/schemas";
import { ContentsPageContent, type CourseUnitSummary } from "./ContentsDocument";
import { seededShuffle } from "@/lib/content-html";
import { encodeEan13 } from "@/lib/barcode/ean13";
import { formatIsbn13 } from "@/lib/isbn";
import { PAGE_PADDING, TRIM_SIZES, type TrimSizeId } from "./page-geometry";
import { resolvePageImageUrl } from "@/lib/page-image";
import { registerBookFonts, NOTO_SANS, NOTO_SERIF } from "./fonts";
import { BLOCK_COLORS } from "@/lib/block-colors";
import { derivePaletteFromColors } from "./derive-palette";
import { withUnitGlossary } from "@/lib/unit-glossary";
import { blocksForRender, clampLayoutToPage } from "@/lib/layout-merge";

registerBookFonts();

// ISBN/baskıya hazırlık (2026-09-20, ROADMAP.md): renders a real, scannable
// EAN-13 barcode on the imprint page when the project has a validated ISBN
// - an ISBN-13 IS an EAN-13 barcode, so encodeEan13 doubles as the ISBN
// barcode encoder. Returns null (renders nothing) for a missing/invalid
// ISBN rather than a placeholder - never fabricates a fake barcode.
function Barcode({ isbn }: { isbn: string }) {
  const bits = encodeEan13(isbn);
  if (!bits) return null;

  const moduleWidth = 1.1;
  const barHeight = 40;

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

export const PALETTE: Record<Variant, { primary: string; primaryDark: string; primaryLight: string; accent: string }> = {
  student_book: { primary: "#2563eb", primaryDark: "#1e3a8a", primaryLight: "#eff6ff", accent: "#f59e0b" },
  workbook: { primary: "#0d9488", primaryDark: "#115e59", primaryLight: "#f0fdfa", accent: "#f97316" },
  teacher_book: { primary: "#7c3aed", primaryDark: "#4c1d95", primaryLight: "#f5f3ff", accent: "#f59e0b" },
  test_booklet: { primary: "#dc2626", primaryDark: "#7f1d1d", primaryLight: "#fef2f2", accent: "#f59e0b" },
};

// "Kaynağa görsel sadakat" (2026-09-28, ROADMAP.md): the pipeline's
// captured read on the uploaded source PDF's visual style - undefined (or
// each field individually undefined/empty) means "no source to mirror" or
// "nothing detected", and every consumer below falls back to the existing
// fixed PALETTE/no-logo/default-density behavior, so a "sıfırdan" (no
// source PDF) project's output is byte-for-byte unchanged from before this
// existed.
export type BrandMarkPosition = "top_left" | "top_right" | "bottom_left" | "bottom_right" | "top_center" | "bottom_center" | "other";
export type BookDocumentSourceStyle = {
  dominantColors?: string[];
  logoUrl?: string | null;
  logoPosition?: BrandMarkPosition | null;
  density?: "compact" | "moderate" | "spacious";
};

// Fixed pixel offsets for the small cover-page logo, keyed by the detected
// position - "other"/unset falls back to top_right, since that's the most
// common real-world placement (matches the British Council source this
// feature was built against) and a wrong guess here is harmless (a logo in
// a slightly-off corner beats no logo at all).
const LOGO_POSITION_STYLE: Record<BrandMarkPosition, { top?: number; bottom?: number; left?: number; right?: number }> = {
  top_left: { top: 24, left: 24 },
  top_right: { top: 24, right: 24 },
  top_center: { top: 24, left: 0, right: 0 },
  bottom_left: { bottom: 24, left: 24 },
  bottom_right: { bottom: 24, right: 24 },
  bottom_center: { bottom: 24, left: 0, right: 0 },
  other: { top: 24, right: 24 },
};

const VARIANT_LABELS: Record<Variant, string> = {
  student_book: "Student Book",
  workbook: "Workbook",
  teacher_book: "Teacher's Book",
  test_booklet: "Test Booklet",
};

function BlockIcon({ kind, color }: { kind: ContentBlockKind; color: string }) {
  switch (kind) {
    case "narrative":
      return (
        <Svg viewBox="0 0 24 24" style={{ width: 10, height: 10 }}>
          <Rect x="3" y="4" width="18" height="12" rx="4" fill={color} />
          <Path d="M8 16 L6.5 21 L12 16 Z" fill={color} />
        </Svg>
      );
    case "explanation":
      return (
        <Svg viewBox="0 0 24 24" style={{ width: 10, height: 10 }}>
          <Path
            d="M12 6 C10 4.5 6.5 4 3 4.8 V18.5 C6.5 17.7 10 18.2 12 19.7 C14 18.2 17.5 17.7 21 18.5 V4.8 C17.5 4 14 4.5 12 6 Z"
            fill="none"
            stroke={color}
            strokeWidth={1.8}
          />
          <Line x1="12" y1="6" x2="12" y2="19.7" stroke={color} strokeWidth={1.8} />
        </Svg>
      );
    case "example":
      return (
        <Svg viewBox="0 0 24 24" style={{ width: 10, height: 10 }}>
          <Path d="M3 12 L12 3 L20 3 L20 11 L11 20 Z" fill={color} />
          <Circle cx="16" cy="7" r="1.6" fill="#ffffff" />
        </Svg>
      );
    case "practice":
      return (
        <Svg viewBox="0 0 24 24" style={{ width: 10, height: 10 }}>
          <Rect x="10.5" y="2" width="3" height="15" rx="1.2" fill={color} transform="rotate(45 12 12)" />
          <Path d="M4 20 L4 16.5 L7.5 20 Z" fill={color} />
        </Svg>
      );
    case "assessment":
      return (
        <Svg viewBox="0 0 24 24" style={{ width: 10, height: 10 }}>
          <Path d="M4 12a8 8 0 0 1 13.5-5.8" fill="none" stroke={color} strokeWidth={2.4} />
          <Path d="M20 12a8 8 0 0 1 -13.5 5.8" fill="none" stroke={color} strokeWidth={2.4} />
          <Path d="M17 3 L18 7 L14 6 Z" fill={color} />
          <Path d="M7 21 L6 17 L10 18 Z" fill={color} />
        </Svg>
      );
    case "reference":
      return (
        <Svg viewBox="0 0 24 24" style={{ width: 10, height: 10 }}>
          <Rect x="3" y="3" width="8" height="8" rx="1.5" fill={color} />
          <Rect x="13" y="3" width="8" height="8" rx="1.5" fill={color} opacity={0.55} />
          <Rect x="3" y="13" width="8" height="8" rx="1.5" fill={color} opacity={0.55} />
          <Rect x="13" y="13" width="8" height="8" rx="1.5" fill={color} />
        </Svg>
      );
  }
}

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
  // Faz "Kapak/Görsel Oranı Düzeltmesi" (2026-09-21, ROADMAP.md): shrunk from
  // 62% now that the cover image is generated portrait (1024x1536, see
  // BOOK_PIPELINE_COVER_IMAGE_SIZE) instead of landscape - the illustration
  // needs real vertical room in coverFooter below, not a thin strip.
  coverBand: { height: "38%", justifyContent: "center", paddingHorizontal: 48, position: "relative", overflow: "hidden" },
  coverDecoration: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  unitBadgeDecoration: { position: "absolute", top: -10, left: -10 },
  coverKicker: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 11, color: "#ffffff", opacity: 0.85, letterSpacing: 2, marginBottom: 14 },
  coverTitle: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 32, color: "#ffffff", lineHeight: 1.25, marginBottom: 14 },
  coverSubtitle: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 16, color: "#ffffff", opacity: 0.92 },
  coverFooter: { flex: 1, paddingHorizontal: 48, paddingTop: 28, flexDirection: "column", gap: 14 },
  // flex:1 (was a fixed maxHeight:220 strip, sized for the old 16:9 landscape
  // cover) - fills whatever vertical space coverFooter has left above
  // coverPillRow, matching the now-portrait (1024x1536) cover image.
  coverIllustrationWrap: { borderRadius: 10, overflow: "hidden", flex: 1 },
  // height:"100%" needed alongside flex:1 on the wrap above - without an
  // explicit height, react-pdf sizes the Image to its own aspect ratio at
  // the given width rather than stretching to fill the flex box.
  coverIllustration: { width: "100%", height: "100%", objectFit: "cover" },
  coverPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  // maxHeight deliberately omitted here - set inline per-render from
  // sourceStyle.density (BookDocument's pageImageMaxHeight), defaulting to
  // the original 170 when there's no density signal.
  pageIllustrationWrap: { borderRadius: 8, overflow: "hidden", marginBottom: 4 },
  pageIllustration: { width: "100%", objectFit: "cover" },
  // @react-pdf/renderer's Image component has no `alt` prop - PDF/UA tagged
  // accessibility text isn't something this library supports (confirmed in
  // its type definitions). This caption is the closest practical
  // equivalent: real, readable text describing the image, derived from the
  // same prompt used to generate it. See ROADMAP.md's project-wide
  // assessment (2026-09-20).
  pageIllustrationCaption: { fontSize: 8, color: "#6b7280", fontStyle: "italic", marginBottom: 14 },
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
    fontFamily: NOTO_SANS, fontWeight: 700,
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
  unitTitle: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 18 },
  unitKicker: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 8.5, letterSpacing: 1.5, marginBottom: 2 },
  // Faz "Sabit Ünite İskeleti": only rendered for pages generated by
  // generateSkeletonSide (page.sectionLabel set) - makes the user-defined
  // section name (e.g. "Dinleme") visible in the output, since otherwise a
  // skeleton-mode book would look identical to a mirror-mode one in print.
  sectionKicker: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 8.5, letterSpacing: 1.5, marginBottom: 6 },

  // Content block
  sectionCard: { marginBottom: 14, paddingLeft: 12, borderLeftWidth: 2.5 },
  sectionHeading: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 12.5, marginBottom: 5 },
  body: { marginBottom: 6, lineHeight: 1.5 },

  // Items box
  exerciseBox: { marginTop: 8, marginBottom: 4, padding: 10, borderRadius: 6, borderWidth: 1 },
  exerciseBadgeRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  exerciseIconChip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  exerciseBadgeLabel: {
    fontFamily: NOTO_SANS, fontWeight: 700,
    fontSize: 7,
    letterSpacing: 0.5,
    color: "#ffffff",
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginRight: 7,
  },
  item: { marginBottom: 3, marginLeft: 4, lineHeight: 1.4 },
  answerKeyBox: { marginTop: 6, padding: 8, backgroundColor: "#f9fafb", borderRadius: 4 },
  answerKeyLabel: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 7.5, color: "#6b7280", letterSpacing: 1, marginBottom: 3 },

  // Glossary
  vocabHeading: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 12.5, marginBottom: 8, marginTop: 4 },
  vocabGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vocabCard: { width: "48%", padding: 9, borderRadius: 6, borderWidth: 1 },
  vocabTerm: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 10.5, marginBottom: 2 },
  vocabDefinition: { fontSize: 9.5, marginBottom: 3, lineHeight: 1.35 },
  vocabExample: { fontSize: 9, fontFamily: NOTO_SERIF, fontStyle: "italic", color: "#4b5563" },

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
  answerKeyEntry: { marginBottom: 8, padding: 8, backgroundColor: "#f9fafb", borderRadius: 4 },
});

type Palette = (typeof PALETTE)[Variant];

// Faz H2 Faz 3: static print rendering of a structured exercise
// (src/lib/ai/schemas.ts's interactiveExerciseSchema) - the real,
// clickable version is BookReader.tsx's web-only components; this is what
// prints in the PDF. Same visibility rule as the plain answerKey: matching
// pairs/MC correct answers only reveal when showAnswerKey is true
// (workbook/teacher_book), otherwise a matching exercise's right column is
// deterministically scrambled so it stays a real exercise on paper too.
function InteractiveExerciseView({ block, showAnswerKey }: { block: ContentBlock; showAnswerKey: boolean }) {
  const interactive = block.interactive;
  if (!interactive) return null;

  if (interactive.type === "multiple_choice") {
    return (
      <View style={{ marginTop: 6 }}>
        <Text style={styles.item}>{interactive.question}</Text>
        {interactive.options.map((option, i) => (
          <Text style={styles.item} key={i}>
            {String.fromCharCode(97 + i)}) {option}
            {showAnswerKey && i === interactive.correctIndex ? "  ✓" : ""}
          </Text>
        ))}
      </View>
    );
  }

  if (interactive.type === "fill_blank") {
    return (
      <View style={{ marginTop: 6 }}>
        <Text style={styles.item}>{interactive.template.replace(/___/g, "_____")}</Text>
        {showAnswerKey && (
          <View style={styles.answerKeyBox}>
            <Text style={styles.answerKeyLabel}>ANSWER KEY</Text>
            {interactive.blanks.map((b, i) => (
              <Text style={styles.item} key={i}>
                {i + 1}. {b}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  }

  // matching
  const rightColumn = showAnswerKey
    ? interactive.pairs.map((p) => p.right)
    : seededShuffle(
        interactive.pairs.map((p) => p.right),
        block.heading,
      );
  return (
    <View style={{ marginTop: 6 }}>
      {interactive.pairs.map((pair, i) => (
        <Text style={styles.item} key={i}>
          {i + 1}. {pair.left} — {rightColumn[i]}
        </Text>
      ))}
    </View>
  );
}

function BlockCard({ block, showAnswerKey, palette }: { block: ContentBlock; showAnswerKey: boolean; palette: Palette }) {
  const colors = BLOCK_COLORS[block.kind];
  // Faz "Sayfa Dizilimi Editörü": absent for every block generated before
  // this existed and every block never manually repositioned - renders in
  // normal document flow exactly as before. Present only when the user
  // dragged this block in LayoutEditor.tsx; coordinates are PDF points
  // (src/lib/pdf/page-geometry.ts) relative to the FULL page (0,0 = the A4
  // sheet's own top-left corner), not the padding-inset content box -
  // confirmed by styles.footer below, an existing absolute-positioned
  // element that manually re-adds `left: 44`/`right: 44` to land on the
  // page's own margin, which would double-offset if react-pdf resolved
  // absolute children against the padding box instead of the page's outer
  // edge. LayoutEditor.tsx's canvas and BookReader.tsx's preview both use
  // this same full-page coordinate space. Absolute positioning here opts
  // this block OUT of react-pdf's automatic page-break reflow (`wrap`) -
  // overflowing content clips/overlaps rather than flowing to a new page, a
  // known, accepted v1 limitation.
  const layoutStyle = block.layout
    ? {
        position: "absolute" as const,
        left: block.layout.x,
        top: block.layout.y,
        width: block.layout.width,
        height: block.layout.height,
      }
    : {};
  return (
    <View style={[styles.sectionCard, { borderLeftColor: palette.primary }, layoutStyle]}>
      <Text style={styles.sectionHeading}>{block.heading}</Text>
      <Text style={styles.body}>{block.body}</Text>
      {block.items?.length || block.interactive ? (
        <View style={[styles.exerciseBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <View style={styles.exerciseBadgeRow}>
            <View style={[styles.exerciseIconChip, { backgroundColor: colors.text }]}>
              <BlockIcon kind={block.kind} color="#ffffff" />
            </View>
            <Text style={[styles.exerciseBadgeLabel, { backgroundColor: colors.text }]}>{block.kind.toUpperCase()}</Text>
          </View>
          {block.items?.map((item, k) => (
            <Text style={styles.item} key={k}>
              {k + 1}. {item}
            </Text>
          ))}
          <InteractiveExerciseView block={block} showAnswerKey={showAnswerKey} />
          {showAnswerKey && block.answerKey?.length ? (
            <View style={styles.answerKeyBox}>
              <Text style={styles.answerKeyLabel}>ANSWER KEY</Text>
              {block.answerKey.map((answer, k) => (
                <Text style={styles.item} key={k}>
                  {k + 1}. {answer}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// Render-time block list: legacy partially-positioned pages get the same
// default slots the editor shows (blocksForRender), and every positioned box
// is kept inside the page (clampLayoutToPage) so react-pdf can't loop.
function clampedBlocks(page: GeneratedPage, pageSize: { width: number; height: number }): ContentBlock[] {
  return blocksForRender(page).map((b) =>
    b.layout ? { ...b, layout: clampLayoutToPage(b.layout, pageSize.width, pageSize.height) } : b,
  );
}

function Blocks({ blocks, showAnswerKey, palette }: { blocks: ContentBlock[]; showAnswerKey: boolean; palette: Palette }) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockCard block={block} showAnswerKey={showAnswerKey} palette={palette} key={i} />
      ))}
    </>
  );
}

function GlossaryGrid({ glossary, palette }: { glossary: GeneratedPage["glossary"]; palette: Palette }) {
  if (!glossary?.length) return null;
  return (
    <View>
      <Text style={styles.vocabHeading}>Glossary</Text>
      <View style={styles.vocabGrid}>
        {glossary.map((entry, i) => (
          <View
            key={i}
            style={[styles.vocabCard, { borderColor: palette.primary, backgroundColor: palette.primaryLight }]}
            wrap={false}
          >
            <Text style={[styles.vocabTerm, { color: palette.primaryDark }]}>{entry.term}</Text>
            <Text style={styles.vocabDefinition}>{entry.definition}</Text>
            {entry.example && <Text style={styles.vocabExample}>e.g. {entry.example}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

function Footer({ bookTitle, variantLabel }: { bookTitle: string; variantLabel: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        {bookTitle} · {variantLabel}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function ImprintPage({
  bookTitle,
  variantLabel,
  level,
  generatedAt,
  palette,
  isbn,
  trimSize = "a4",
}: {
  bookTitle: string;
  variantLabel: string;
  level: string;
  generatedAt: string;
  palette: Palette;
  isbn?: string;
  trimSize?: TrimSizeId;
}) {
  return (
    <Page size={{ width: TRIM_SIZES[trimSize].widthPt, height: TRIM_SIZES[trimSize].heightPt }} style={styles.page}>
      <View style={styles.imprintBlock}>
        <Text style={[styles.imprintTitle, { color: palette.primaryDark }]}>{bookTitle}</Text>
        <Text style={styles.imprintLine}>{variantLabel} · {level}</Text>
        <Text style={styles.imprintLine}>Oluşturulma tarihi: {generatedAt}</Text>
        <Text style={styles.imprintDisclosure}>
          Bu içerik, kullanıcı tarafından yüklenen bir kaynak ders kitabının sayfa yapısından esinlenerek
          yapay zeka (Kitap Orkestrası) ile üretilmiştir. Metin ve görseller orijinaldir; kaynak eserin
          birebir kopyası değildir.
        </Text>
        {isbn && (
          <View style={styles.barcodeBlock}>
            <Barcode isbn={isbn} />
          </View>
        )}
      </View>
      <Footer bookTitle={bookTitle} variantLabel={variantLabel} />
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
}: {
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
}) {
  const variantLabel = VARIANT_LABELS[variant];
  // Falls back to the original fixed PALETTE[variant] whenever there's no
  // source to mirror (sıfırdan mode) or the source's colors didn't parse -
  // see derivePaletteFromColors's own doc comment for the parsing rules.
  const palette = derivePaletteFromColors(sourceStyle?.dominantColors) ?? PALETTE[variant];
  const logoStyle = sourceStyle?.logoUrl ? LOGO_POSITION_STYLE[sourceStyle.logoPosition ?? "top_right"] : null;
  const pageImageMaxHeight = sourceStyle?.density === "compact" ? 120 : sourceStyle?.density === "spacious" ? 210 : 170;
  const pageSize = { width: TRIM_SIZES[trimSize].widthPt, height: TRIM_SIZES[trimSize].heightPt };
  // Faz "Teacher's Book/Test Booklet Genişletme": test_booklet was missing
  // here despite generateTestBookletSide/generateCumulativeAssessment always
  // producing an answer key - it was silently never rendered in any export.
  const showAnswerKey = variant === "workbook" || variant === "teacher_book" || variant === "test_booklet";

  return (
    <Document title={`${bookTitle} - ${variantLabel}`}>
      <Page size={pageSize} style={styles.coverPage}>
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
          {logoStyle && sourceStyle?.logoUrl && (
            <View style={[styles.coverLogoBadge, logoStyle]}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop, see pageIllustrationCaption's comment above */}
              <Image src={sourceStyle.logoUrl} style={styles.coverLogo} />
            </View>
          )}
          <Text style={styles.coverKicker}>{upperFor(level, contentLanguage)}</Text>
          <Text style={styles.coverTitle}>{bookTitle}</Text>
          <Text style={styles.coverSubtitle}>{variantLabel}</Text>
        </View>
        <View style={styles.coverFooter}>
          {coverImageSrc && (
            <View style={styles.coverIllustrationWrap}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- see pageIllustrationCaption's
                  comment above: @react-pdf/renderer's Image has no `alt` prop. No caption text
                  is available here (unlike per-page images, the cover has no stored prompt). */}
              <Image src={coverImageSrc} style={styles.coverIllustration} />
            </View>
          )}
          <View style={styles.coverPillRow}>
            <Text style={styles.coverPill}>{units.length} units</Text>
            <Text style={[styles.coverPill, { color: palette.primaryDark }]}>Generated with Kitap Orkestrası</Text>
          </View>
        </View>
      </Page>

      <ImprintPage
        bookTitle={bookTitle}
        variantLabel={variantLabel}
        level={level}
        generatedAt={generatedAt ?? ""}
        palette={palette}
        isbn={isbn}
        trimSize={trimSize}
      />

      <ContentsPageContent
        bookTitle={bookTitle}
        level={level}
        variant={variant}
        units={contentsUnits}
        trimSize={trimSize}
      />

      {units.flatMap((unit) =>
        withUnitGlossary(unit, pagesForVariant(unit, variant), variant).map((page, idx) => (
          <Page key={`${unit.unitNumber}-${page.sourcePageNumber}-${idx}`} size={pageSize} style={styles.page} wrap>
            <View style={styles.runningHeader}>
              <Text style={[styles.runningHeaderText, { color: palette.primary }]}>
                UNIT {unit.unitNumber} · {upperFor(unit.title, contentLanguage)}
              </Text>
            </View>

            {idx === 0 && (
              <View style={styles.unitHeaderRow}>
                <Svg viewBox="0 0 60 60" style={[styles.unitBadgeDecoration, { width: 60, height: 60 }]}>
                  <Circle cx="30" cy="30" r="28" fill={palette.primary} opacity={0.12} />
                </Svg>
                <View style={[styles.unitBadge, { backgroundColor: palette.primary }]}>
                  <Text style={styles.unitBadgeText}>{unit.unitNumber}</Text>
                </View>
                <View>
                  <Text style={[styles.unitKicker, { color: palette.primary }]}>UNIT {unit.unitNumber}</Text>
                  <Text style={styles.unitTitle}>{unit.title}</Text>
                </View>
              </View>
            )}

            {resolvePageImageUrl(page, pageImages) && (
              <>
                <View
                  style={[
                    styles.pageIllustrationWrap,
                    { maxHeight: pageImageMaxHeight },
                    // Faz "Sayfa Dizilimi Editörü": same opt-in absolute
                    // positioning as BlockCard's `layout` field, see there
                    // for the pagination-reflow caveat.
                    page.imageLayout
                      ? (() => {
                          const box = clampLayoutToPage(page.imageLayout, pageSize.width, pageSize.height);
                          return { position: "absolute" as const, left: box.x, top: box.y, width: box.width, height: box.height };
                        })()
                      : {},
                  ]}
                >
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- this is @react-pdf/renderer's
                      Image (print-layout component), not an HTML <img> - it has no `alt` prop
                      to give (see the pageIllustrationCaption style comment above for the
                      caption text that stands in for it). */}
                  <Image src={resolvePageImageUrl(page, pageImages)} style={styles.pageIllustration} />
                </View>
                {page.imagePrompt && !page.imageLayout && (
                  <Text style={styles.pageIllustrationCaption}>{page.imagePrompt}</Text>
                )}
              </>
            )}

            {page.sectionLabel && (
              <Text style={[styles.sectionKicker, { color: palette.primary }]}>
                {upperFor(page.sectionLabel, contentLanguage)}
              </Text>
            )}
            <Blocks blocks={clampedBlocks(page, pageSize)} showAnswerKey={showAnswerKey} palette={palette} />
            <GlossaryGrid glossary={page.glossary} palette={palette} />

            <Footer bookTitle={bookTitle} variantLabel={variantLabel} />
          </Page>
        )),
      )}

      {showAnswerKey && (
        <Page size={pageSize} style={styles.page} wrap>
          <View style={[styles.answerKeyTitleBand, { backgroundColor: palette.primaryDark }]}>
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
                  <View key={i} style={styles.answerKeyEntry} wrap={false}>
                    <Text style={styles.answerKeyLabel}>{block.heading}</Text>
                    {(block.answerKey ?? []).map((answer, j) => (
                      <Text style={styles.item} key={j}>
                        {j + 1}. {answer}
                      </Text>
                    ))}
                  </View>
                ))}
            </View>
          ))}
          <Footer bookTitle={bookTitle} variantLabel={variantLabel} />
        </Page>
      )}
    </Document>
  );
}
