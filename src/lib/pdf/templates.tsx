import { Text, View, Image } from "@react-pdf/renderer";
import type { ContentBlock, GeneratedPage } from "@/lib/ai/schemas";
import {
  DENSE_LINE,
  ZONE_GAP,
  isExerciseBlock,
  panelledExercises,
  planZones,
  zoneColumnFrame,
  zoneRowFrames,
  zoneSplitFrame,
  type DesignedTemplate,
} from "@/lib/design/layouts";
import { BlockCard, GlossaryGrid, type Look } from "./blocks";
import { stripExerciseNumber } from "@/lib/exercise-numbers";
import { NOTO_SANS } from "./fonts";

// Faz 1 "Tasarım sistemi": PDF renderers for each layout template in
// src/lib/design/layouts.ts. BookDocument.tsx decides WHICH template a page
// uses (resolvePageTemplate) and supplies the running header/footer; these
// only lay out the page body. Absolute-positioned elements are relative to
// the page's outer edge (react-pdf), which the full-bleed templates rely on.

export type TemplateProps = {
  template: DesignedTemplate;
  page: GeneratedPage;
  unit: { unitNumber: number; title: string };
  isUnitFirstPage: boolean;
  imageSrc?: string;
  /** Faz B3: every picture of the page, main picture first (source-zones). */
  imageSrcs?: string[];
  look: Look;
  showAnswerKey: boolean;
  pageSize: { width: number; height: number };
  unitKicker: string;
  sectionKicker?: string;
  /** Faz 4: print bleed - edge-to-edge art extends into it. */
  bleed?: number;
};

// Templates that paint to the page edge and draw their own header area.
export const EDGE_TO_EDGE_TEMPLATES: DesignedTemplate[] = ["unit-opener-hero", "full-bleed-illustration"];

function Illustration({
  src,
  height,
  look,
  fit = "cover",
  gap = 12,
}: {
  src: string;
  height: number | string;
  look: Look;
  fit?: "cover" | "contain";
  gap?: number;
}) {
  return (
    <View style={{ height, borderRadius: look.theme.radius, overflow: "hidden", backgroundColor: look.palette.primaryLight, marginBottom: gap }} wrap={false}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
      <Image src={src} style={{ width: "100%", height: "100%", objectFit: fit }} />
    </View>
  );
}

function Blocks({
  blocks,
  look,
  showAnswerKey,
  frameless,
  dense,
  panels,
  gap = 0,
}: {
  blocks: ContentBlock[];
  look: Look;
  showAnswerKey: boolean;
  frameless?: boolean;
  dense?: boolean;
  panels?: ReadonlySet<ContentBlock>;
  /** Extra space between consecutive blocks (pt) - a zoned page's spread leftover. */
  gap?: number;
}) {
  return (
    <>
      {blocks.map((b, i) => {
        const card = <BlockCard key={i} block={b} look={look} showAnswerKey={showAnswerKey} frameless={frameless} dense={dense} panel={panels?.has(b)} />;
        return gap > 0 && i < blocks.length - 1 ? (
          <View key={i} style={{ marginBottom: gap }}>
            {card}
          </View>
        ) : (
          card
        );
      })}
    </>
  );
}

function textWeight(b: ContentBlock): number {
  return (
    b.body.length +
    (b.items ?? []).join(" ").length +
    (b.dialogue ?? []).reduce((n, d) => n + d.line.length + 20, 0) +
    (b.table ? 60 * (b.table.rows.length + 1) : 0) +
    120 // heading + padding
  );
}

// Greedy balance: each block goes to the currently shorter column, keeping
// reading order within each column.
export function splitColumns(blocks: ContentBlock[]): [ContentBlock[], ContentBlock[]] {
  const left: ContentBlock[] = [];
  const right: ContentBlock[] = [];
  const total = blocks.reduce((n, b) => n + textWeight(b), 0);
  let acc = 0;
  for (const b of blocks) {
    if (acc < total / 2) {
      left.push(b);
      acc += textWeight(b);
    } else right.push(b);
  }
  return [left, right];
}

function UnitHeading({ unit, look, kicker }: { unit: TemplateProps["unit"]; look: Look; kicker: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: look.palette.primary, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 14, color: "#ffffff" }}>{unit.unitNumber}</Text>
      </View>
      <View>
        <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 8.5, letterSpacing: 1.5, marginBottom: 2, color: look.palette.primary }}>{kicker}</Text>
        <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: 18 }}>{unit.title}</Text>
      </View>
    </View>
  );
}

function SectionKicker({ text, look }: { text?: string; look: Look }) {
  if (!text) return null;
  return (
    <View style={{ flexDirection: "row", marginBottom: 8 }}>
      <Text
        style={{
          fontFamily: NOTO_SANS,
          fontWeight: 700,
          fontSize: 8,
          letterSpacing: 1.5,
          color: "#ffffff",
          backgroundColor: look.palette.primary,
          paddingVertical: 3,
          paddingHorizontal: 8,
          borderRadius: look.theme.radius,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

export function TemplatedPageBody(props: TemplateProps) {
  const { template, page, unit, isUnitFirstPage, imageSrc, imageSrcs, look, showAnswerKey, pageSize, unitKicker, sectionKicker, bleed = 0 } = props;
  const heading = isUnitFirstPage && !EDGE_TO_EDGE_TEMPLATES.includes(template) ? <UnitHeading unit={unit} look={look} kicker={unitKicker} /> : null;
  const contentWidth = pageSize.width - 88;

  switch (template) {
    case "source-zones": {
      // Faz B2: the source page's arrangement (see src/lib/design/zones.ts).
      // Heights are shares of the content area; text flows naturally inside
      // each band, and a page whose content outgrows the plan was already
      // sent to another template by resolvePageTemplate - or, measured
      // running over, is set tighter (look.compact, Faz G2).
      const pictures = imageSrcs ?? (imageSrc ? [imageSrc] : []);
      const { bands, pictureScale, textScale, spread } = planZones(
        page,
        pictures.length,
        !!heading,
        { width: pageSize.width, height: pageSize.height, bodySize: look.theme.bodySize },
        !!look.compact,
        look.zoneSlack,
      );
      // KIYAS-13: text grown into a page's leftover room grows with its
      // headings (BlockCard sizes them from the theme's body size).
      const textLook = textScale > 1 ? { ...look, grow: textScale, theme: { ...look.theme, bodySize: look.theme.bodySize * textScale } } : look;
      // Leftover room spread between bands and blocks (planZones `spread`).
      const bandGap = ZONE_GAP + spread;
      const panels = panelledExercises(page.blocks);
      return (
        <>
          {heading}
          <SectionKicker text={sectionKicker} look={look} />
          <View style={{ fontSize: look.theme.bodySize * textScale, lineHeight: `${(look.theme.bodySize * textScale * DENSE_LINE).toFixed(2)}pt` }}>
          {bands.map((band, i) => {
            const marginBottom = i < bands.length - 1 ? bandGap : ZONE_GAP;
            if (band.kind === "pictures") {
              // Faz G3: the row where the source's sits across the page;
              // scaled as a whole, never wider than MAX_PICTURE_ASPECT
              // (zoneRowFrames).
              const row = zoneRowFrames(band, contentWidth, pageSize.height, pictureScale);
              const slotWidth = (k: number) => (row.width - ZONE_GAP * (band.pictures.length - 1)) * band.widths[k];
              return (
                <View key={i} style={{ flexDirection: "row", gap: ZONE_GAP, marginBottom, marginLeft: row.left, width: row.width }} wrap={false}>
                  {band.pictures.map((p, k) => (
                    <View key={k} style={{ width: slotWidth(k), alignItems: "center" }}>
                      <View style={{ width: row.frames[k] }}>
                        <Illustration src={pictures[p]} height={row.height} look={look} gap={0} />
                      </View>
                    </View>
                  ))}
                </View>
              );
            }
            if (band.kind === "split") {
              const frame = zoneSplitFrame(band, band.pictures.length, contentWidth, pageSize.height, pictureScale);
              const imageColumn = (
                <View style={{ width: frame.width }}>
                  {band.pictures.map((p, k) => (
                    <Illustration key={k} src={pictures[p]} height={Math.round((frame.height - ZONE_GAP * (band.pictures.length - 1)) / band.pictures.length)} look={look} gap={k < band.pictures.length - 1 ? ZONE_GAP : 0} />
                  ))}
                </View>
              );
              return (
                <View key={i} style={{ flexDirection: "row", gap: ZONE_GAP, marginBottom }}>
                  {band.side === "left" && imageColumn}
                  <View style={{ width: contentWidth - frame.width - ZONE_GAP }}>
                    <Blocks frameless dense panels={panels} blocks={band.blocks} look={textLook} showAnswerKey={showAnswerKey} gap={spread} />
                  </View>
                  {band.side === "right" && imageColumn}
                </View>
              );
            }
            if (band.kind === "columns") {
              const columnWidth = (contentWidth - 16) / 2;
              return (
                <View key={i} style={{ flexDirection: "row", gap: 16, marginBottom }}>
                  {band.columns.map((items, c) => (
                    <View key={c} style={{ width: columnWidth }}>
                      {items.map((item, k) => {
                        if (item.kind === "picture") {
                          const frame = zoneColumnFrame(item.height, columnWidth, pageSize.height, pictureScale);
                          return (
                            <View key={k} style={{ width: frame.width, alignSelf: "center" }}>
                              <Illustration src={pictures[item.picture]} height={frame.height} look={look} gap={ZONE_GAP} />
                            </View>
                          );
                        }
                        return (
                          <View key={k} style={{ marginBottom: ZONE_GAP }}>
                            <Blocks frameless dense panels={panels} blocks={item.blocks} look={textLook} showAnswerKey={showAnswerKey} />
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              );
            }
            if (band.columns === 2) {
              const [left, right] = splitColumns(band.blocks);
              return (
                <View key={i} style={{ flexDirection: "row", gap: 16, marginBottom }}>
                  <View style={{ width: (contentWidth - 16) / 2 }}>
                    <Blocks frameless dense panels={panels} blocks={left} look={textLook} showAnswerKey={showAnswerKey} />
                  </View>
                  <View style={{ width: (contentWidth - 16) / 2 }}>
                    <Blocks frameless dense panels={panels} blocks={right} look={textLook} showAnswerKey={showAnswerKey} />
                  </View>
                </View>
              );
            }
            return (
              <View key={i} style={{ marginBottom }}>
                <Blocks frameless dense panels={panels} blocks={band.blocks} look={textLook} showAnswerKey={showAnswerKey} gap={spread} />
              </View>
            );
          })}
          </View>
          <GlossaryGrid glossary={page.glossary} look={look} columns={3} />
        </>
      );
    }

    case "unit-opener-hero": {
      const heroHeight = Math.round(pageSize.height * 0.42);
      return (
        <>
          {imageSrc && (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: heroHeight + bleed }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
              <Image src={imageSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </View>
          )}
          {/* Title plate overlapping the hero's lower edge */}
          <View style={{ marginTop: heroHeight - 44 - 30, marginBottom: 18 }}>
            <View style={{ alignSelf: "flex-start", backgroundColor: look.palette.primary, borderRadius: look.theme.radius, paddingVertical: 10, paddingHorizontal: 16 }}>
              <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 9, letterSpacing: 2, color: "#ffffff", opacity: 0.85 }}>{unitKicker}</Text>
              <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: 24, color: "#ffffff" }}>{unit.title}</Text>
            </View>
          </View>
          <SectionKicker text={sectionKicker} look={look} />
          <Blocks blocks={page.blocks} look={look} showAnswerKey={showAnswerKey} />
          <GlossaryGrid glossary={page.glossary} look={look} columns={3} />
        </>
      );
    }

    case "full-bleed-illustration": {
      return (
        <>
          {imageSrc && (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
              <Image src={imageSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </View>
          )}
          <View style={{ position: "absolute", left: 32 + bleed, right: 32 + bleed, bottom: 40 + bleed }}>
            <View style={{ backgroundColor: "#ffffff", opacity: 0.9, borderRadius: Math.max(10, look.theme.radius), position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ padding: 16 }}>
              {page.blocks.map((b, i) => (
                <View key={i}>
                  {b.heading ? <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: 14, marginBottom: 4, color: look.palette.primaryDark }}>{b.heading}</Text> : null}
                  <Text style={{ fontSize: look.theme.bodySize + 1, lineHeight: 1.5 }}>{b.body}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      );
    }

    case "two-column": {
      const [left, right] = splitColumns(page.blocks);
      return (
        <>
          {heading}
          <SectionKicker text={sectionKicker} look={look} />
          {imageSrc && <Illustration src={imageSrc} height={Math.round(pageSize.height * 0.26)} look={look} />}
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Blocks blocks={left} look={look} showAnswerKey={showAnswerKey} />
            </View>
            <View style={{ flex: 1 }}>
              <Blocks blocks={right} look={look} showAnswerKey={showAnswerKey} />
            </View>
          </View>
          <GlossaryGrid glossary={page.glossary} look={look} />
        </>
      );
    }

    case "image-left-text-right": {
      const sideBlocks = page.blocks.filter((b) => b.callout);
      const mainBlocks = page.blocks.filter((b) => !b.callout);
      return (
        <>
          {heading}
          <SectionKicker text={sectionKicker} look={look} />
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ width: contentWidth * 0.44 }}>
              {imageSrc && <Illustration src={imageSrc} height={Math.round(contentWidth * 0.44 * 1.15)} look={look} />}
              <Blocks blocks={sideBlocks} look={look} showAnswerKey={showAnswerKey} />
            </View>
            <View style={{ flex: 1 }}>
              <Blocks blocks={mainBlocks} look={look} showAnswerKey={showAnswerKey} />
            </View>
          </View>
          <GlossaryGrid glossary={page.glossary} look={look} />
        </>
      );
    }

    case "dialogue-strip": {
      return (
        <>
          {heading}
          <SectionKicker text={sectionKicker} look={look} />
          {imageSrc && <Illustration src={imageSrc} height={Math.round(pageSize.height * 0.24)} look={look} />}
          {page.blocks.map((b, i) => (
            <BlockCard key={i} block={b} look={look} showAnswerKey={showAnswerKey} frameless={!!b.dialogue?.length} />
          ))}
          <GlossaryGrid glossary={page.glossary} look={look} />
        </>
      );
    }

    case "exercise-grid": {
      const intro = page.blocks.filter((b) => !isExerciseBlock(b));
      const exercises = page.blocks.filter(isExerciseBlock);
      return (
        <>
          {heading}
          <SectionKicker text={sectionKicker} look={look} />
          {imageSrc && <Illustration src={imageSrc} height={Math.round(pageSize.height * 0.2)} look={look} />}
          <Blocks blocks={intro} look={look} showAnswerKey={showAnswerKey} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {exercises.map((b, i) => (
              <View
                key={i}
                wrap={false}
                style={{
                  width: exercises.length === 1 ? "100%" : "48.5%",
                  borderWidth: 1,
                  borderColor: look.palette.primary,
                  borderRadius: look.theme.radius,
                  padding: 10,
                  paddingTop: 14,
                  marginBottom: 12,
                  marginTop: 6,
                }}
              >
                <View style={{ position: "absolute", top: -8, left: 10, width: 20, height: 20, borderRadius: 10, backgroundColor: look.palette.accent, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 10, color: "#ffffff" }}>{i + 1}</Text>
                </View>
                {/* the badge carries the number */}
                <BlockCard block={{ ...b, heading: stripExerciseNumber(b.heading) }} look={look} showAnswerKey={showAnswerKey} frameless />
              </View>
            ))}
          </View>
          <GlossaryGrid glossary={page.glossary} look={look} />
        </>
      );
    }

    case "vocab-cards": {
      return (
        <>
          {heading}
          <SectionKicker text={sectionKicker} look={look} />
          {imageSrc && <Illustration src={imageSrc} height={Math.round(pageSize.height * 0.2)} look={look} />}
          <GlossaryGrid glossary={page.glossary} look={look} columns={3} />
          <View style={{ height: 10 }} />
          <Blocks blocks={page.blocks} look={look} showAnswerKey={showAnswerKey} />
        </>
      );
    }

    case "reading-with-sidebar": {
      const isSide = (b: ContentBlock) => !!b.callout || isExerciseBlock(b);
      const side = page.blocks.filter(isSide);
      const main = page.blocks.filter((b) => !isSide(b));
      return (
        <>
          {heading}
          <SectionKicker text={sectionKicker} look={look} />
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ flex: 1.8 }}>
              {imageSrc && <Illustration src={imageSrc} height={Math.round(pageSize.height * 0.22)} look={look} />}
              <Blocks blocks={main} look={look} showAnswerKey={showAnswerKey} frameless />
            </View>
            <View style={{ flex: 1, backgroundColor: look.palette.primaryLight, borderRadius: look.theme.radius, padding: 10 }}>
              <Blocks blocks={side} look={look} showAnswerKey={showAnswerKey} frameless />
              {page.glossary?.map((g, i) => (
                <Text key={i} style={{ fontSize: 8.5, marginBottom: 3 }}>
                  <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, color: look.palette.primaryDark }}>{g.term}</Text> – {g.definition}
                </Text>
              ))}
            </View>
          </View>
        </>
      );
    }

    case "review-checklist": {
      return (
        <>
          {heading}
          <SectionKicker text={sectionKicker} look={look} />
          <Blocks blocks={page.blocks} look={look} showAnswerKey={showAnswerKey} />
          <GlossaryGrid glossary={page.glossary} look={look} />
        </>
      );
    }
  }
}
