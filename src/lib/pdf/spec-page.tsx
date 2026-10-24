import { Document, Page, Text, View, Image, renderToBuffer } from "@react-pdf/renderer";
import type { ContentBlock, GeneratedPage } from "@/lib/ai/schemas";
import type { PageLayoutSpec, SpecBox, SpecPicture, SpecRegion } from "@/lib/design/page-layout-spec";
import { touches } from "@/lib/design/page-layout-spec";
import { DENSE_LINE, PANEL_PAD, isExerciseBlock } from "@/lib/design/layouts";
import { legibleGround } from "@/lib/design/page-furniture";
import { pageLayoutType } from "@/lib/design/page-types";
import { applySourceType, type SourceType } from "@/lib/design/source-theme";
import { resolveDesignTheme, type DesignThemeId } from "@/lib/design/themes";
import { isYoungLearnerLevel } from "@/lib/cefr-vocabulary";
import { itemText } from "@/lib/item-text";
import { withSectionHeads, type PageLesson } from "@/lib/lesson-furniture";
import { dropMissingPictureRefs } from "@/lib/picture-refs";
import { pageBubbles, withoutBubbledDialogue } from "@/lib/ai/page-bubbles";
import { compareLooks, measurePageLook, type LookAspect, type PageLook } from "@/lib/page-look";
import type { Box } from "@/lib/source-layout";
import { BlockCard, centredFigure, makeLook, type Look } from "./blocks";
import { derivePaletteFromColors } from "./derive-palette";
import { NOTO_SANS, resetBookFonts } from "./fonts";
import { LabelOverlay } from "./label-overlay";
import { BubbleOverlay } from "./bubble-overlay";
import { LessonTab } from "./lesson-furniture";
import { FramedImage, pictureGround, pictureRect } from "./picture-frame";
import type { PictureInfo } from "./picture-fit";
import { PageMarker, TopEdgeBand, TopicFooter, type PageStartListener } from "./page-chrome";
import { TitleTab } from "./type-templates";
import { TRIM_SIZES, type TrimSizeId } from "./page-geometry";
import { rasterizePdf } from "./rasterize";
import { splitColumns } from "./templates";

// Plan "gör → tasarla → çiz → bak → düzelt" (2026-10-24): a page drawn from
// a design spec (src/lib/design/page-layout-spec.ts) - every picture,
// colour area and text region where the spec puts it, absolutely, with the
// book's own pieces: picture frames placed by picture-fit, exercise cards
// (BlockCard, coursebook density), artefacts, scene labels and speech
// bubbles, the lesson tab, the source's top band and the topic footer.
// The agent designer renders through renderSpecPage; BookDocument prints a
// page with a stored designSpec through SpecPage.

// An exercise done by pointing at the page's picture ("Listen and point",
// "Point and say", "Look and find") - see the young learners' page filter.
export const POINT_AT_PICTURE = /\b(listen and point|point and say|look and find|listen and find)\b/i;

export type SpecPageContext = {
  page: GeneratedPage;
  unit: { unitNumber: number; title: string };
  /** The page's pictures, main picture first (resolvePageImageUrls). */
  pictures: string[];
  look: Look;
  /** Trim size (pt). */
  pageSize: { width: number; height: number };
  bleed?: number;
  /** The page's lesson furniture (planLessons) - the tab prints where the spec's furniture.lessonTab says. */
  lesson?: PageLesson;
  /** The book prints lesson furniture (section heads before exercise groups). */
  lessonsOn?: boolean;
  showAnswerKey?: boolean;
};

// The page's blocks as the book prints them, index for index with
// page.blocks (null = not printed) - the same clean-ups BookDocument
// applies to a page before its template: section heads, picture pointers
// to pictures that are missing, no teacher boxes in a young learners'
// book, no word list under a "Listen and point" picture, dialogue lines
// that went into speech bubbles. A spec's block indices refer to these.
export function printedBlocks(ctx: Pick<SpecPageContext, "page" | "pictures" | "look" | "lessonsOn">, { bubbled = false }: { bubbled?: boolean } = {}): (ContentBlock | null)[] {
  const { page, pictures, look, lessonsOn } = ctx;
  const sectioned = lessonsOn ? { ...page, blocks: withSectionHeads(page.blocks, page.sourceShape?.lesson?.sections, isExerciseBlock) } : page;
  const referenced = dropMissingPictureRefs(sectioned, pictures.length);
  const listed =
    look.wordList && referenced.zonePlan && pictures.length && pageLayoutType(referenced) === "mixed"
      ? { ...referenced, blocks: referenced.blocks.map((b) => (POINT_AT_PICTURE.test(b.heading ?? "") && b.items?.every((i) => itemText(i).split(/\s+/).length <= 3) ? { ...b, items: [] } : b)) }
      : referenced;
  const shown = bubbled ? withoutBubbledDialogue(listed) : listed;
  return shown.blocks.map((b) => (look.wordList && (b.callout === "tip" || (!!page.zonePlan && !!b.callout)) ? null : b));
}

/** True when the spec draws the page's speech bubbles (and the page has a complete set). */
export function drawsBubbles(spec: PageLayoutSpec, page: GeneratedPage): boolean {
  return spec.pictures.some((p) => p.picture === 0 && p.bubbles) && pageBubbles(page).length > 0;
}

// The look a spec page prints in: the book's, with the spec's heading style.
function headingLook(look: Look, style: NonNullable<PageLayoutSpec["headings"]>["style"]): Look {
  if (!style || style === "inline") return look;
  const color = look.furniture?.numberBadge?.color ?? look.palette.primary;
  return { ...look, furniture: { ...look.furniture, numberBadge: { color, filled: style === "disc" } } };
}

const textLookOf = (look: Look, scale = 1): Look =>
  scale === 1 ? look : { ...look, grow: scale, theme: { ...look.theme, bodySize: look.theme.bodySize * scale } };

// Where a box lands on the sheet (pt): an edge touching the trim edge runs
// on into the bleed when asked.
function placeBox(box: SpecBox, pageSize: { width: number; height: number }, bleed: number, runOn: boolean) {
  const t = touches(box);
  const x0 = runOn && t.left ? 0 : bleed + box.x * pageSize.width;
  const y0 = runOn && t.top ? 0 : bleed + box.y * pageSize.height;
  const x1 = runOn && t.right ? pageSize.width + 2 * bleed : bleed + (box.x + box.w) * pageSize.width;
  const y1 = runOn && t.bottom ? pageSize.height + 2 * bleed : bleed + (box.y + box.h) * pageSize.height;
  return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
}

const OVER_PAD = 6;

function regionPad(region: SpecRegion): number {
  return region.panel ? PANEL_PAD + 2 : region.over ? OVER_PAD : 0;
}

// A region's text: its blocks in one column or two, set as the book's
// mirrored pages set them (BlockCard, dense).
function RegionText({ region, blocks, look, width, showAnswerKey }: { region: SpecRegion; blocks: (ContentBlock | null)[]; look: Look; width: number; showAnswerKey: boolean }) {
  const textLook = textLookOf(look, region.textScale);
  const own = region.blocks
    .map((i) => blocks[i])
    .filter((b): b is ContentBlock => !!b)
    .map((b) => (region.artefact && b.body ? { ...b, textStyle: region.artefact } : b))
    // the numbered picture cards show the items (as the cards template prints them)
    .map((b) => (region.rubricOnly && b.items?.length ? { ...b, items: [], activity: undefined } : b));
  const cards = (list: ContentBlock[]) => list.map((b, i) => <BlockCard key={i} block={b} look={textLook} showAnswerKey={showAnswerKey} frameless dense />);
  const size = textLook.theme.bodySize;
  const style = { fontSize: size, lineHeight: `${(size * DENSE_LINE).toFixed(2)}pt` };
  if (region.columns === 2) {
    const [left, right] = splitColumns(own);
    const col = (width - 16) / 2;
    return (
      <View style={[style, { flexDirection: "row", gap: 16 }]}>
        <View style={{ width: col }}>{cards(left)}</View>
        <View style={{ width: col }}>{cards(right)}</View>
      </View>
    );
  }
  return <View style={[style, { width }]}>{cards(own)}</View>;
}

function regionFrame(region: SpecRegion) {
  const pad = regionPad(region);
  if (region.panel) {
    return {
      backgroundColor: region.panel.tint,
      borderRadius: region.panel.radius ?? 8,
      ...(region.panel.border ? { borderWidth: 1.2, borderColor: region.panel.border } : {}),
      padding: pad,
    };
  }
  if (region.over) return { backgroundColor: "#ffffff", borderRadius: 10, padding: pad };
  return {};
}

function SpecRegionView({ region, blocks, look, pageSize, bleed, showAnswerKey }: { region: SpecRegion; blocks: (ContentBlock | null)[]; look: Look; pageSize: { width: number; height: number }; bleed: number; showAnswerKey: boolean }) {
  const at = placeBox(region.box, pageSize, bleed, false);
  const pad = regionPad(region);
  // The frame (panel, white backing) fills the box; the text sits in it at
  // its natural height - a box of fixed height squeezed the lines of text
  // that did not fit onto each other. Text that runs over is reported by
  // measureRegions, and the designer does not finish with it.
  const frame = regionFrame(region);
  return (
    <>
      {Object.keys(frame).length ? <View style={{ position: "absolute", ...at, ...frame }} /> : null}
      <View style={{ position: "absolute", left: at.left + pad, top: at.top + pad, width: at.width - 2 * pad }}>
        <RegionText region={region} blocks={blocks} look={look} width={at.width - 2 * pad} showAnswerKey={showAnswerKey} />
      </View>
    </>
  );
}

function SpecPictureView({ item, src, page, look, pageSize, bleed }: { item: SpecPicture; src: string; page: GeneratedPage; look: Look; pageSize: { width: number; height: number }; bleed: number }) {
  const at = placeBox(item.box, pageSize, bleed, !!item.bleed);
  const t = touches(item.box);
  const square = item.bleed && (t.left || t.right || t.top || t.bottom);
  const radius = square ? 0 : (item.radius ?? look.theme.radius);
  const anchors = { fit: item.fit ?? "cover", anchorX: item.focus?.x ?? 0.5, anchorY: item.focus?.y ?? 0.3 } as const;
  const rect = pictureRect(look, src, at.width, at.height, anchors);
  const ground = item.ground ?? pictureGround(look, src, rect, at.width, at.height);
  const placement = rect ? { crop: rect } : { fit: anchors.fit, positionY: anchors.anchorY };
  const bubbles = item.bubbles && item.picture === 0 ? pageBubbles(page) : [];
  const disc = look.furniture?.numberBadge?.color ?? look.palette.accent;
  return (
    <View style={{ position: "absolute", ...at, borderRadius: radius, overflow: "hidden", ...(ground ? { backgroundColor: ground } : {}) }}>
      <FramedImage src={src} rect={rect} width={at.width} height={at.height} fit={anchors.fit} anchorY={anchors.anchorY} />
      {item.labels && item.picture === 0 && page.labels?.length ? <LabelOverlay labels={page.labels} width={at.width} height={at.height} look={look} {...placement} /> : null}
      {bubbles.length ? <BubbleOverlay bubbles={bubbles} width={at.width} height={at.height} look={look} {...placement} /> : null}
      {item.badge ? (
        <View style={{ position: "absolute", top: 5, left: 5, width: 17, height: 17, borderRadius: 8.5, backgroundColor: disc, alignItems: "center", justifyContent: "center" }}>
          <Text style={[{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 9, color: "#ffffff" }, centredFigure(9)]}>{item.badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export type SpecPageProps = SpecPageContext & {
  spec: PageLayoutSpec;
  /** Footer pill text (footerTopic of the page's section label). */
  topic?: string;
  onPageStart?: PageStartListener;
  pageKey?: string;
};

export function SpecPage({ spec, page, unit, pictures, look: bookLook, pageSize, bleed = 0, lesson, lessonsOn, showAnswerKey = false, topic, onPageStart, pageKey }: SpecPageProps) {
  const look = headingLook(bookLook, spec.headings?.style);
  const blocks = printedBlocks({ page, pictures, look, lessonsOn }, { bubbled: drawsBubbles(spec, page) });
  const sheet = { width: pageSize.width + 2 * bleed, height: pageSize.height + 2 * bleed };
  const furniture = spec.furniture ?? {};
  return (
    <Page size={sheet} style={{ fontFamily: look.bodyFont, fontSize: look.theme.bodySize, color: "#1f2937" }}>
      {pageKey ? <PageMarker id={pageKey} onPageStart={onPageStart} /> : null}
      {(spec.grounds ?? []).map((g, i) => (
        <View key={`g${i}`} style={{ position: "absolute", ...placeBox(g.box, pageSize, bleed, true), backgroundColor: legibleGround(g.color), ...(g.radius ? { borderRadius: g.radius } : {}) }} />
      ))}
      {spec.pictures.map((item, i) =>
        pictures[item.picture] ? <SpecPictureView key={`p${i}`} item={item} src={pictures[item.picture]} page={page} look={look} pageSize={pageSize} bleed={bleed} /> : null,
      )}
      {furniture.topBand && look.furniture?.topBand ? <TopEdgeBand band={look.furniture.topBand} bleed={bleed} pageSize={pageSize} /> : null}
      {furniture.titleTab ? <TitleTab unit={unit} title={topic} look={look} top={bleed + Math.max(14, (look.furniture?.topBand?.heightRatio ?? 0) * pageSize.height + 6)} bleed={bleed} /> : null}
      {furniture.lessonTab && lesson?.tab ? (
        <View style={{ position: "absolute", ...placeBox(furniture.lessonTab, pageSize, bleed, false), paddingTop: 18 }}>
          <LessonTab lesson={lesson} look={look} width={furniture.lessonTab.w * pageSize.width} />
        </View>
      ) : null}
      {spec.regions.map((region, i) => (
        <SpecRegionView key={`r${i}`} region={region} blocks={blocks} look={look} pageSize={pageSize} bleed={bleed} showAnswerKey={showAnswerKey} />
      ))}
      {furniture.footer === false ? null : <TopicFooter topic={topic} look={look} bleed={bleed} pointers={lesson?.pointers} />}
    </Page>
  );
}

// ---- Rendering one page on its own (the agent designer's render tool) ----

/** How a region's text fits its box (pt). */
export type RegionFit = { region: number; needed: number; available: number; overflow: boolean };

export type SpecRender = { pdf: Buffer; png: Uint8Array; fits: RegionFit[] };

// A 1×1 white PNG put after a region's text on its measuring sheet: its
// top is where the region's boxes end, margins included (vector rules and
// panel fills do not show in the text layer; an image does).
const SENTINEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC";
const MEASURE_HEIGHT = 4000;
// The margins under the last card (the card's 8 pt, its list's) are
// measured by the sentinel but print nothing: the region needs its last
// line of text or picture (+ INK_PAD), and never less than the sentinel
// minus these margins - a ruled line or a table rule there is vector ink.
const TRAILING_MARGINS = 14;
const INK_PAD = 2;

// Where each measuring sheet's ink ends (text and pictures, the sentinel
// left out) and where its sentinel sits (pt from the top).
async function measuredEnds(pdf: Uint8Array, pages: number): Promise<{ ink: number; sentinel: number }[]> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  try {
    const out: { ink: number; sentinel: number }[] = [];
    for (let n = 0; n < pages; n++) {
      const page = doc.loadPage(n);
      const stext = page.toStructuredText("preserve-images");
      const { blocks } = JSON.parse(stext.asJSON()) as { blocks: { type: string; bbox: { x: number; y: number; w: number; h: number } }[] };
      let ink = 0;
      let sentinel = 0;
      for (const b of blocks) {
        const tiny = b.type === "image" && b.bbox.w <= 1.5 && b.bbox.h <= 1.5;
        if (tiny) sentinel = Math.max(sentinel, b.bbox.y);
        else ink = Math.max(ink, b.bbox.y + b.bbox.h);
      }
      out.push({ ink, sentinel });
      stext.destroy();
      page.destroy();
    }
    return out;
  } finally {
    doc.destroy();
  }
}

// Each region's text set alone at its box's width on a tall sheet, and
// measured: what it needs against what its box gives.
export async function measureRegions(spec: PageLayoutSpec, ctx: SpecPageContext): Promise<RegionFit[]> {
  if (!spec.regions.length) return [];
  const look = headingLook(ctx.look, spec.headings?.style);
  const blocks = printedBlocks({ ...ctx, look }, { bubbled: drawsBubbles(spec, ctx.page) });
  const showAnswerKey = !!ctx.showAnswerKey;
  resetBookFonts();
  const pdf = await renderToBuffer(
    <Document>
      {spec.regions.map((region, i) => {
        const width = region.box.w * ctx.pageSize.width;
        const pad = regionPad(region);
        return (
          <Page key={i} size={{ width, height: MEASURE_HEIGHT }} style={{ fontFamily: look.bodyFont, fontSize: look.theme.bodySize, color: "#1f2937" }}>
            <View style={{ width, ...regionFrame(region) }}>
              <RegionText region={region} blocks={blocks} look={look} width={width - 2 * pad} showAnswerKey={showAnswerKey} />
            </View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
            <Image src={SENTINEL} style={{ width: 1, height: 1 }} />
          </Page>
        );
      })}
    </Document>,
  );
  const ends = await measuredEnds(new Uint8Array(pdf), spec.regions.length);
  return spec.regions.map((region, i) => {
    const { ink, sentinel } = ends[i];
    const needed = Math.max(0, Math.round(Math.max(ink + INK_PAD + regionPad(region), sentinel - TRAILING_MARGINS)));
    const available = Math.round(region.box.h * ctx.pageSize.height);
    return { region: i, needed, available, overflow: needed > available + 1 };
  });
}

// The spec page as a one-page PDF and a PNG, with how its regions fit.
export async function renderSpecPage(spec: PageLayoutSpec, ctx: SpecPageContext & { topic?: string }, { dpi = 80 }: { dpi?: number } = {}): Promise<SpecRender> {
  resetBookFonts();
  const pdf = await renderToBuffer(
    <Document>
      <SpecPage spec={spec} {...ctx} />
    </Document>,
  );
  const [page] = await rasterizePdf(new Uint8Array(pdf), { dpi, pages: [1] });
  const fits = await measureRegions(spec, ctx);
  return { pdf, png: page.png, fits };
}

// Several spec pages as one PDF (scripts/agent-designer.mts).
export async function renderSpecPages(pages: { spec: PageLayoutSpec; ctx: SpecPageContext & { topic?: string } }[]): Promise<Buffer> {
  resetBookFonts();
  return renderToBuffer(
    <Document>
      {pages.map((p, i) => (
        <SpecPage key={i} spec={p.spec} {...p.ctx} />
      ))}
    </Document>,
  );
}

// The look metrics fidelity scores (page-look.ts), the rendered page against
// the source page - hints for the designer, never a target to game.
export async function specLookHints(png: Uint8Array, source: { look: PageLook; images: Box[] }, spec: PageLayoutSpec): Promise<Record<LookAspect, number | null>> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(Buffer.from(png)).resize({ width: 150 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const look = measurePageLook({ width: info.width, height: info.height, channels: info.channels, data });
  const boxes = spec.pictures.map((p) => ({ x: p.box.x, y: p.box.y, w: p.box.w, h: p.box.h }));
  return compareLooks(source.look, look, [source.images, boxes]);
}

// The look a book prints in, as BookDocument works it out (theme, the
// source's type and colours, young learners' word list) - for rendering a
// page outside a book (the designer, scripts).
export function specLook({
  designTheme,
  sourceType,
  dominantColors,
  trimSize = "a4",
  variant = "student_book",
  level,
  pictures,
  pictureSrc,
}: {
  designTheme?: DesignThemeId | string | null;
  sourceType?: SourceType | null;
  dominantColors?: string[] | null;
  trimSize?: TrimSizeId;
  variant?: "student_book" | "workbook" | "teacher_book" | "test_booklet";
  level: string;
  pictures?: Record<string, PictureInfo>;
  pictureSrc?: Record<string, string>;
}): Look {
  const theme = applySourceType(resolveDesignTheme(designTheme), sourceType, TRIM_SIZES[trimSize].heightPt);
  const palette = derivePaletteFromColors(dominantColors ?? undefined) ?? theme.palettes[variant];
  return {
    ...makeLook(theme, palette),
    pictures,
    pictureSrc,
    wordList: variant !== "teacher_book" && isYoungLearnerLevel(level),
    noGlossary: isYoungLearnerLevel(level) && variant !== "teacher_book" && (variant === "workbook" || !!sourceType),
    furniture: sourceType?.furniture ?? null,
  };
}
