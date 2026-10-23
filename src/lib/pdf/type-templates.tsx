import { Text, View, Image, Svg, Rect, Polygon } from "@react-pdf/renderer";
import type { ContentBlock } from "@/lib/ai/schemas";
import { CARD_WORD_H, PANEL_LINE_H, TYPE_GAP, rubricOnly, type Card, type TypedLayout } from "@/lib/design/type-layout";
import { DENSE_LINE } from "@/lib/design/layouts";
import { unitBadgeText } from "@/lib/unit-label";
import { BlockCard, NumberBadge, TILE_COLORS, TrackBadge, centredFigure, type Look } from "./blocks";
import { UnitHeading } from "./templates";
import { trackOf } from "@/lib/listening";
import { NOTO_SANS } from "./fonts";

// "Önce sayfa tasarımı": the PDF templates of the three picture page types
// (src/lib/design/page-types.ts), laid out by typedLayout
// (src/lib/design/type-layout.ts) - a full-page scene under a rubric pill,
// a grid of numbered picture cards, a numbered story-panel grid. A page
// whose content does not suit its type never gets here (typedLayout is
// null) and keeps its zone layout.

export type SceneLabel = { word: string; x: number; y: number };

// A scene's picture over the whole sheet, bleed included - BookDocument
// draws it first, so the top band and the footer print over it.
//
// LabelOverlay hook (plan step 4): `labels` are the scene's words placed on
// the picture (fractions of it). Rendered as nothing for now; the overlay
// goes in here, e.g. `{labels?.length ? <LabelOverlay labels={labels} look={look} /> : null}`
// (src/lib/pdf/label-overlay.tsx). While a page has labels its items are
// not repeated as chips (TypedPageBody `labels`).
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `labels` and `look` are the LabelOverlay hook above
export function ScenePicture({ src, labels, look }: { src: string; labels?: SceneLabel[]; look: Look }) {
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
      <Image src={src} style={{ width: "100%", height: "100%", objectFit: "cover", objectPositionY: "40%" }} />
      {/* LabelOverlay goes here, drawn from `labels` */}
    </View>
  );
}

const NUMBERED = /^(\d{1,2})[.)]?\s+(.*)$/;

// An exercise's rubric on a white pill over a picture (Super Minds p.1,
// p.9): number disc, track badge, heading and a short rubric.
function RubricPill({ block, look, maxWidth }: { block: ContentBlock; look: Look; maxWidth: number }) {
  const size = look.theme.bodySize * 1.2; // the source sets the rubric over a scene larger than its body text
  const numbered = NUMBERED.exec(block.heading ?? "");
  const track = trackOf(look.tracks, block);
  const h = Math.round(size * 2.4);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", maxWidth, minHeight: h, backgroundColor: "#ffffff", borderRadius: h / 2, paddingVertical: 4, paddingLeft: 6, paddingRight: 12 }}>
      {numbered ? <NumberBadge n={numbered[1]} look={look} size={size} /> : null}
      {track ? <TrackBadge track={track} look={look} size={size * 1.1} /> : null}
      <Text style={{ maxWidth: maxWidth - 90, lineHeight: `${(size * 1.35).toFixed(1)}pt` }}>
        <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: size * 1.1, color: "#1f2937" }}>{numbered ? numbered[2] : block.heading}</Text>
        {block.body && block.body.length <= 120 ? `  ${block.body}` : null}
      </Text>
    </View>
  );
}

// The unit's title on a tab from the page's outer edge, as a coursebook's
// unit opener prints it over its scene (Super Minds p.1 "Say Hello!").
function TitleTab({ unit, look, top, bleed }: { unit: { unitNumber: number; title: string }; look: Look; top: number; bleed: number }) {
  return (
    <View
      style={{
        position: "absolute",
        top,
        left: 0,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: look.palette.primary,
        paddingLeft: 18 + bleed,
        paddingRight: 18,
        height: 36,
        borderTopRightRadius: 18,
        borderBottomRightRadius: 18,
      }}
    >
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", marginRight: 8 }}>
        <Text style={[{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 12, color: look.palette.primary }, centredFigure(12)]}>{unitBadgeText(unit.unitNumber)}</Text>
      </View>
      <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: 19, color: "#ffffff" }}>{unit.title}</Text>
    </View>
  );
}

function Blocks({ blocks, look, showAnswerKey }: { blocks: ContentBlock[]; look: Look; showAnswerKey: boolean }) {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockCard key={i} block={b} look={look} showAnswerKey={showAnswerKey} frameless dense />
      ))}
    </>
  );
}

function CardTile({ card, index, width, faceHeight, look }: { card: Card; index: number; width: number; faceHeight: number; look: Look }) {
  const face = card.face;
  const side = Math.min(width, faceHeight);
  const disc = look.furniture?.numberBadge?.color ?? look.palette.accent;
  return (
    <View style={{ width }} wrap={false}>
      <View
        style={{
          height: faceHeight,
          borderRadius: Math.max(8, look.theme.radius),
          backgroundColor: "#ffffff",
          borderWidth: face.kind === "number" ? 0 : 1,
          borderColor: look.palette.primaryLight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {face.kind === "picture" ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop
          <Image src={face.src} style={{ width: width - 12, height: faceHeight - 12, objectFit: "contain" }} />
        ) : face.kind === "number" ? (
          <View style={{ width: side * 0.86, height: side * 0.86, borderRadius: side * 0.14, backgroundColor: TILE_COLORS[index % TILE_COLORS.length], alignItems: "center", justifyContent: "center" }}>
            <Text style={[{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: side * 0.5, color: "#ffffff" }, centredFigure(side * 0.5)]}>{face.n}</Text>
          </View>
        ) : face.kind === "color" ? (
          <View style={{ transform: "rotate(-38deg)" }}>
            <Svg width={side * 1.05} height={side * 0.32} viewBox="0 0 60 18">
              <Rect x={0} y={2} width={46} height={14} rx={2} fill={face.hex} stroke="#333333" strokeWidth={1} />
              <Polygon points="46,2 60,9 46,16" fill="#f1d9b5" stroke="#333333" strokeWidth={1} />
              <Polygon points="55,6.5 60,9 55,11.5" fill={face.hex} />
            </Svg>
          </View>
        ) : face.kind === "emoji" && look.pictureSrc?.[face.emoji] ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop
          <Image src={look.pictureSrc[face.emoji]} style={{ width: side * 0.7, height: side * 0.7 }} />
        ) : (
          <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: Math.min(side * 0.22, 26), color: look.palette.primaryDark, textAlign: "center" }}>{card.word}</Text>
        )}
        {face.kind === "number" ? null : (
          <View style={{ position: "absolute", top: 5, left: 5, width: 16, height: 16, borderRadius: 8, backgroundColor: disc, alignItems: "center", justifyContent: "center" }}>
            <Text style={[{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 9, color: "#ffffff" }, centredFigure(9)]}>{index + 1}</Text>
          </View>
        )}
      </View>
      <View style={{ height: CARD_WORD_H, justifyContent: "center" }}>
        {face.kind === "number" || face.kind === "word" ? null : (
          <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: look.theme.bodySize * 1.1, textAlign: "center", color: "#1f2937" }}>{card.word}</Text>
        )}
      </View>
    </View>
  );
}

export type TypedPageProps = {
  layout: TypedLayout;
  unit: { unitNumber: number; title: string };
  isUnitFirstPage: boolean;
  look: Look;
  showAnswerKey: boolean;
  pageSize: { width: number; height: number };
  unitKicker: string;
  bleed?: number;
  /** The page's main picture - the scene is drawn by ScenePicture, this is the card page's picture under its grid. */
  mainSrc?: string;
  /** Height of the source's top band over the page (page furniture), so a scene's pill clears it. */
  topInset?: number;
  /** A scene's placed labels (plan step 4) - while set, the items are not repeated as chips. */
  labels?: SceneLabel[];
};

export function TypedPageBody({ layout, unit, isUnitFirstPage, look, showAnswerKey, pageSize, unitKicker, bleed = 0, mainSrc, topInset = 0, labels }: TypedPageProps) {
  const contentWidth = pageSize.width - 88;
  const lineHeight = `${(look.theme.bodySize * DENSE_LINE).toFixed(2)}pt`;

  if (layout.type === "scene") {
    const tabTop = topInset + 12 + bleed;
    const pillTop = isUnitFirstPage ? tabTop + 36 + 10 : topInset + 16 + bleed;
    const footerRoom = 46;
    const chips = labels?.length ? [] : layout.chips;
    return (
      <>
        {isUnitFirstPage ? <TitleTab unit={unit} look={look} top={tabTop} bleed={bleed} /> : null}
        <View style={{ position: "absolute", top: pillTop, left: 32 + bleed, right: 32 + bleed }}>
          <RubricPill block={layout.lead} look={look} maxWidth={contentWidth + 24} />
        </View>
        {chips.length ? (
          <View
            style={{
              position: "absolute",
              left: 32 + bleed,
              right: 32 + bleed,
              bottom: footerRoom + (layout.rest.length ? layout.restHeight + TYPE_GAP : 0) + bleed,
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {chips.map((c, i) => (
              <View key={i} style={{ backgroundColor: "#ffffff", borderRadius: 11, borderWidth: 1.2, borderColor: look.palette.primary, paddingVertical: 3, paddingHorizontal: 10 }}>
                <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: look.theme.bodySize * 1.15, color: "#1f2937" }}>{c}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {layout.rest.length ? (
          <View style={{ position: "absolute", left: 32 + bleed, right: 32 + bleed, bottom: footerRoom + bleed }}>
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#ffffff", opacity: 0.92, borderRadius: Math.max(10, look.theme.radius) }} />
            <View style={{ padding: 10, paddingBottom: 4, lineHeight }}>
              <Blocks blocks={layout.rest} look={look} showAnswerKey={showAnswerKey} />
            </View>
          </View>
        ) : null}
      </>
    );
  }

  const heading = isUnitFirstPage ? <UnitHeading unit={unit} look={look} kicker={unitKicker} /> : null;

  if (layout.type === "cards") {
    return (
      <View style={{ lineHeight }}>
        {heading}
        <Blocks blocks={layout.before} look={look} showAnswerKey={showAnswerKey} />
        <BlockCard block={rubricOnly(layout.lead)} look={look} showAnswerKey={false} frameless dense />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: TYPE_GAP, marginBottom: TYPE_GAP }}>
          {layout.cards.map((card, k) => (
            <CardTile key={k} card={card} index={k} width={layout.cardWidth} faceHeight={layout.faceHeight} look={look} />
          ))}
        </View>
        <Blocks blocks={layout.rest} look={look} showAnswerKey={showAnswerKey} />
        {layout.mainHeight && mainSrc ? (
          <View style={{ height: layout.mainHeight, borderRadius: look.theme.radius, overflow: "hidden" }} wrap={false}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
            <Image src={mainSrc} style={{ width: "100%", height: "100%", objectFit: "cover", objectPositionY: "30%" }} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ lineHeight }}>
      {heading}
      <Blocks blocks={layout.before} look={look} showAnswerKey={showAnswerKey} />
      <BlockCard block={rubricOnly(layout.lead)} look={look} showAnswerKey={false} frameless dense />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: TYPE_GAP, marginBottom: TYPE_GAP }}>
        {layout.pictures.map((src, k) => (
          <View key={k} style={{ width: layout.panelWidth }} wrap={false}>
            <View style={{ height: layout.panelHeight, borderRadius: Math.max(6, look.theme.radius), overflow: "hidden" }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
              <Image src={src} style={{ width: "100%", height: "100%", objectFit: "cover", objectPositionY: "30%" }} />
              <View style={{ position: "absolute", top: 6, left: 6, width: 17, height: 17, borderRadius: 3, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}>
                <Text style={[{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 9.5, color: "#1f2937" }, centredFigure(9.5)]}>{k + 1}</Text>
              </View>
            </View>
            {layout.lines.length ? (
              <View style={{ height: PANEL_LINE_H, justifyContent: "center" }}>
                <Text style={{ fontSize: look.theme.bodySize * 1.05, textAlign: "center", lineHeight: 1.15 }}>{layout.lines[k] ?? ""}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <Blocks blocks={layout.rest} look={look} showAnswerKey={showAnswerKey} />
    </View>
  );
}
