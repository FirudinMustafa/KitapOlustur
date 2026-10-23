import { Text, View, Svg, Path, Rect, Circle, Line, Image, Polygon } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { MAP_CELL_H, SCENE_H, SCENE_ROW, SCENE_W, mapGrid, prepositionScene, type Shape } from "@/lib/diagrams";
import { COLOR_HEX, DRAW_LINE, MATCH_ROW, PICTURE_CELL, RULE_GAP, isEmoji, letterFor, splitEmoji, tileKind, type ActivityPicture } from "@/lib/activities";
import type { ContentBlock, ContentBlockKind, GeneratedPage } from "@/lib/ai/schemas";
import { BLOCK_COLORS } from "@/lib/block-colors";
import { itemText } from "@/lib/item-text";
import { HEADING_LINE, PANEL_PAD, inlineRubric, isChecklistBlock, itemColumns } from "@/lib/design/layouts";
import { CALLOUT_STYLES, speakerColorMap, type DesignTheme, type ThemePalette } from "@/lib/design/themes";
import { trackOf } from "@/lib/listening";
import type { PageFurniture } from "@/lib/design/page-furniture";
import { NOTO_SANS, NOTO_SERIF, pdfFontFamily, withSymbols } from "./fonts";
import { CrosswordView, MarkingList, MatchLinesView, WordSearchView } from "./puzzle-blocks";
import { resolveTextStyle } from "@/lib/text-style";
import { ArtefactBody } from "./artefacts";

// Faz 1 "Tasarım sistemi": the per-block print pieces, split out of
// BookDocument.tsx so the page templates (./templates.tsx) and the original
// single-column flow share one implementation. Everything visual is read
// from `Look` (theme + resolved palette) instead of fixed constants.

export type Look = {
  theme: DesignTheme;
  palette: ThemePalette;
  /** Theme family + the ✓/✗ symbol fallback (withSymbols). */
  headingFont: string[];
  bodyFont: string[];
  /** emoji -> image src for activity pictures (filled by the book renderer when icons are available). */
  pictureSrc?: Record<string, string>;
  /** Tighter activity/diagram sizes - set by renderBookFitted for a page that still ran over. */
  compact?: boolean;
  /** Faz G3: empty height (pt) a render of this page left at its foot - see planZones. */
  zoneSlack?: number;
  /** KIYAS-13: how far a zoned page's text grew into its leftover room - number cards grow with it. */
  grow?: number;
  /** Size (pt) of the emoji pictures in an item's text - a workbook's counting rows (worksheet-layout.ts); unset = EMOJI_PT. */
  itemEmoji?: number;
  /** Glossary as a compact word list (terms only) - young learners' books, see GlossaryGrid. */
  wordList?: boolean;
  /** No glossary at all - a young learners' workbook (the Student Book prints the word list). */
  noGlossary?: boolean;
  /** Listening exercise -> its audio track number (audioTrackMap). */
  tracks?: ReadonlyMap<string, string>;
  /** The source's page furniture - number badges, track pill, top band, topic footer (page-furniture.ts). */
  furniture?: PageFurniture | null;
};

// Activity and diagram sizes shrink by this on a compact page.
function sized(look: Look, pt: number): number {
  return look.compact ? Math.round(pt * 0.72) : pt;
}

export function makeLook(theme: DesignTheme, palette: ThemePalette): Look {
  return {
    theme,
    palette,
    headingFont: withSymbols(pdfFontFamily(theme.headingFont)),
    bodyFont: withSymbols(pdfFontFamily(theme.bodyFont)),
  };
}

export function BlockIcon({ kind, color, size = 10 }: { kind: ContentBlockKind; color: string; size?: number }) {
  const style = { width: size, height: size };
  switch (kind) {
    case "narrative":
      return (
        <Svg viewBox="0 0 24 24" style={style}>
          <Rect x="3" y="4" width="18" height="12" rx="4" fill={color} />
          <Path d="M8 16 L6.5 21 L12 16 Z" fill={color} />
        </Svg>
      );
    case "explanation":
      return (
        <Svg viewBox="0 0 24 24" style={style}>
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
        <Svg viewBox="0 0 24 24" style={style}>
          <Path d="M3 12 L12 3 L20 3 L20 11 L11 20 Z" fill={color} />
          <Circle cx="16" cy="7" r="1.6" fill="#ffffff" />
        </Svg>
      );
    case "practice":
      return (
        <Svg viewBox="0 0 24 24" style={style}>
          <Rect x="10.5" y="2" width="3" height="15" rx="1.2" fill={color} transform="rotate(45 12 12)" />
          <Path d="M4 20 L4 16.5 L7.5 20 Z" fill={color} />
        </Svg>
      );
    case "assessment":
      return (
        <Svg viewBox="0 0 24 24" style={style}>
          <Path d="M4 12a8 8 0 0 1 13.5-5.8" fill="none" stroke={color} strokeWidth={2.4} />
          <Path d="M20 12a8 8 0 0 1 -13.5 5.8" fill="none" stroke={color} strokeWidth={2.4} />
          <Path d="M17 3 L18 7 L14 6 Z" fill={color} />
          <Path d="M7 21 L6 17 L10 18 Z" fill={color} />
        </Svg>
      );
    case "reference":
      return (
        <Svg viewBox="0 0 24 24" style={style}>
          <Rect x="3" y="3" width="8" height="8" rx="1.5" fill={color} />
          <Rect x="13" y="3" width="8" height="8" rx="1.5" fill={color} opacity={0.55} />
          <Rect x="3" y="13" width="8" height="8" rx="1.5" fill={color} opacity={0.55} />
          <Rect x="13" y="13" width="8" height="8" rx="1.5" fill={color} />
        </Svg>
      );
  }
}

const s = {
  heading: { fontWeight: 700, fontSize: 12.5, marginBottom: 5 },
  item: { marginBottom: 3, marginLeft: 4 },
  exerciseBox: { marginTop: 8, marginBottom: 4, padding: 10, borderWidth: 1 },
  badgeRow: { flexDirection: "row" as const, alignItems: "center" as const, marginBottom: 6 },
  iconChip: { width: 18, height: 18, borderRadius: 9, alignItems: "center" as const, justifyContent: "center" as const, marginRight: 6 },
  answerKeyBox: { marginTop: 6, padding: 8, backgroundColor: "#f9fafb", borderRadius: 4 },
  answerKeyLabel: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 7.5, color: "#6b7280", letterSpacing: 1, marginBottom: 3 },
};

// Faz H2 Faz 3: static print rendering of a structured exercise - the
// clickable version lives in PageContent.tsx. Printed only when the block
// has nothing else to print: the writer usually fills items/activity AND
// interactive with the same task, and KIYAS-13 printed both - every item
// twice, and the matching pairs as "1. I'm Misty — the boy", a scrambled
// list that read as a wrong answer key in the Student Book.
function InteractiveExerciseView({ block, showAnswerKey, look }: { block: ContentBlock; showAnswerKey: boolean; look: Look }) {
  const interactive = block.interactive;
  if (!interactive) return null;
  if (block.items?.length || block.activity) {
    // Multiple-choice options the items do not already print (stems in
    // items, options only here) would be lost - audit 2026-10-22.
    if (interactive.type !== "multiple_choice") return null;
    const printed = (block.items ?? []).join(" ").toLowerCase();
    if (interactive.options.every((o) => printed.includes(o.trim().toLowerCase()))) return null;
  }

  if (interactive.type === "multiple_choice") {
    return (
      <View style={{ marginTop: 6 }}>
        <Text style={s.item}>{interactive.question}</Text>
        {interactive.options.map((option, i) => (
          <Text style={s.item} key={i}>
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
        <Text style={s.item}>{interactive.template.replace(/___/g, "_____")}</Text>
        {showAnswerKey && (
          <View style={s.answerKeyBox}>
            <Text style={s.answerKeyLabel}>ANSWER KEY</Text>
            {interactive.blanks.map((b, i) => (
              <Text style={s.item} key={i}>
                {i + 1}. {b}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  }

  // Two columns to join with lines, like a printed matching exercise.
  return (
    <View style={{ marginTop: 6 }}>
      <MatchLinesView
        block={{ ...block, items: interactive.pairs.map((p) => p.left), answerKey: interactive.pairs.map((p) => p.right) }}
        look={look}
        // The Teacher's Book prints the pairs in order - it is the key.
        ordered={showAnswerKey}
      />
    </View>
  );
}

function ChecklistItems({ items, look }: { items: string[]; look: Look }) {
  return (
    <View style={{ marginTop: 2 }}>
      {items.map((item, k) => (
        <View key={k} style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
          <Svg viewBox="0 0 12 12" style={{ width: 11, height: 11, marginRight: 8 }}>
            <Rect x="0.75" y="0.75" width="10.5" height="10.5" rx="2" fill="#ffffff" stroke={look.palette.primary} strokeWidth={1.2} />
          </Svg>
          <Text style={{ flex: 1 }}>{itemText(item)}</Text>
        </View>
      ))}
    </View>
  );
}

// ---- Workbook activity formats (src/lib/activities.ts) ----

export function WordBank({ words, look }: { words: string[]; look: Look }) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: look.palette.primary,
        borderRadius: Math.max(4, look.theme.radius / 2),
        paddingVertical: 6,
        paddingHorizontal: 8,
        marginBottom: 8,
        backgroundColor: "#ffffff",
      }}
      wrap={false}
    >
      {words.map((w, i) => (
        <Text key={i} style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 9.5, color: look.palette.primaryDark, marginHorizontal: 7, marginVertical: 2 }}>
          {w}
        </Text>
      ))}
    </View>
  );
}

function RuledLines({ count, gap = RULE_GAP }: { count: number; gap?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ height: gap, borderBottomWidth: 0.75, borderBottomColor: "#9ca3af" }} />
      ))}
    </View>
  );
}

// A picture for an activity: the icon when the renderer has one for this
// emoji, otherwise a soft frame with a short description so the exercise
// still reads.
function PictureFrame({ picture, fallback, height, look }: { picture?: ActivityPicture; fallback: string; height: number; look: Look }) {
  const src = picture?.emoji ? look.pictureSrc?.[picture.emoji.trim()] : undefined;
  return (
    <View
      style={{
        height,
        borderRadius: Math.max(6, look.theme.radius),
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: look.palette.primaryLight,
        alignItems: "center",
        justifyContent: "center",
        padding: 4,
      }}
    >
      {src ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop
        <Image src={src} style={{ height: height - Math.min(14, height * 0.15), width: height - Math.min(14, height * 0.15), objectFit: "contain" }} />
      ) : (
        <Text style={{ fontSize: 7.5, color: "#6b7280", textAlign: "center", lineHeight: 1.3 }}>{fallback}</Text>
      )}
    </View>
  );
}

function PictureLabelGrid({ block, look, columns }: { block: ContentBlock; look: Look; columns: number }) {
  const items = block.items ?? [];
  const pictures = block.activity?.pictures ?? [];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {items.map((item, i) => (
        <View key={i} style={{ width: `${100 / columns}%`, paddingHorizontal: 4, marginBottom: 8 }} wrap={false}>
          <PictureFrame picture={pictures[i]} fallback={itemText(item)} height={sized(look, PICTURE_CELL - 30)} look={look} />
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: 22 }}>
            <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 9, color: look.palette.primary, marginRight: 4 }}>{i + 1}</Text>
            <View style={{ flex: 1, borderBottomWidth: 0.75, borderBottomColor: "#9ca3af", marginBottom: 3 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <Svg viewBox="0 0 10 10" style={{ width: 7, height: 7, marginHorizontal: 6 }}>
      <Circle cx="5" cy="5" r="4" fill={color} />
    </Svg>
  );
}

// Words on the left, lettered pictures on the right (already in mixed
// order), a dot on each side to draw the line between.
export function PictureMatch({ block, look, row: rowHeight }: { block: ContentBlock; look: Look; row?: number }) {
  const items = block.items ?? [];
  const pictures = block.activity?.pictures ?? [];
  const row = rowHeight ?? sized(look, MATCH_ROW);
  const frame = row - 8;
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", height: row }} wrap={false}>
          <Text style={{ flex: 1 }}>
            {i + 1}. {itemText(item)}
          </Text>
          <Dot color={look.palette.primary} />
          <View style={{ width: "8%" }} />
          <Dot color={look.palette.primary} />
          <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 9, color: look.palette.primary, marginRight: 4 }}>{letterFor(i)}</Text>
          <View style={{ width: frame * 1.3 }}>
            <PictureFrame picture={pictures[i]} fallback={pictures[i]?.label ?? ""} height={frame} look={look} />
          </View>
        </View>
      ))}
    </View>
  );
}

// One numbered item. Emoji in the text are drawn as their Twemoji picture
// (or dropped when it could not be loaded) - the book fonts have none, and
// KIYAS-13's counting rows printed as broken glyphs.
const EMOJI_PT = 13;

function ItemLine({ n, item, look, style }: { n: number; item: string; look: Look; style: Style[] }) {
  const text = itemText(item);
  if (!isEmoji(text)) {
    return (
      <Text style={style}>
        {n}. {text}
      </Text>
    );
  }
  return (
    <View style={[...style, { flexDirection: "row", flexWrap: "wrap", alignItems: "center" }]}>
      <Text>{n}. </Text>
      {splitEmoji(text).map((part, i) => {
        if (part.text) return <Text key={i}>{part.text}</Text>;
        const src = look.pictureSrc?.[part.emoji!];
        // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop
        return src ? <Image key={i} src={src} style={{ width: look.itemEmoji ?? EMOJI_PT, height: look.itemEmoji ?? EMOJI_PT, marginRight: 1 }} /> : null;
      })}
    </View>
  );
}

export const TILE_COLORS = ["#f39c12", "#29a9e1", "#8cc63f", "#3c8d7a", "#ec6fa8", "#43a047", "#e53935", "#1e5aa8", "#fdd835", "#00a99d"];

// Number cards and coloured pencils for a bare number / colour-word list
// (tileKind), the way the source prints them.
function ItemTiles({ items, kind, look }: { items: string[]; kind: "numbers" | "colors"; look: Look }) {
  const size = look.compact ? 34 : Math.round(44 * (look.grow ?? 1));
  const gap = 8;
  // Rows of even length: ten number cards wrap 5 + 5, not 7 + 3. Capping the
  // row's width at that many cards lets flexWrap do the rest (and still wrap
  // earlier in a narrow column).
  const perRow = kind === "numbers" && items.length > 7 ? Math.ceil(items.length / Math.ceil(items.length / 7)) : 0;
  const maxWidth = perRow ? perRow * size + (perRow - 1) * gap : undefined;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap, marginTop: 4, ...(maxWidth ? { maxWidth } : {}) }} wrap={false}>
      {items.map((raw, k) => {
        const item = raw.trim().replace(/[.!]$/, "");
        if (kind === "numbers") {
          return (
            <View
              key={k}
              style={{ width: size, height: size, borderRadius: 7, backgroundColor: TILE_COLORS[k % TILE_COLORS.length], alignItems: "center", justifyContent: "center" }}
            >
              <Text style={[{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: size * 0.5, color: "#ffffff" }, centredFigure(size * 0.5)]}>{item}</Text>
            </View>
          );
        }
        const color = COLOR_HEX[item.toLowerCase()] ?? "#9e9e9e";
        return (
          <View key={k} style={{ width: size * 1.6, alignItems: "center" }}>
            <Text style={{ ...{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 8, color: look.palette.primary }, marginBottom: 2 }}>{k + 1}</Text>
            <Svg width={size * 1.5} height={size * 0.45} viewBox="0 0 60 18">
              <Rect x={0} y={2} width={46} height={14} rx={2} fill={color} stroke="#333333" strokeWidth={1} />
              <Polygon points="46,2 60,9 46,16" fill="#f1d9b5" stroke="#333333" strokeWidth={1} />
              <Polygon points="55,6.5 60,9 55,11.5" fill={color} />
            </Svg>
            <Text style={{ fontSize: 9, marginTop: 2 }}>{item}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ItemList({ block, look, dense }: { block: ContentBlock; look: Look; dense?: boolean }) {
  const a = block.activity;
  const lines = a?.type === "write_lines" ? (a.lines ?? 1) : 0;
  const tiles = !lines && !a ? tileKind(block.items) : null;
  if (tiles) return <ItemTiles items={block.items ?? []} kind={tiles} look={look} />;
  // Faz G4: on a mirrored page short items sit side by side (itemColumns).
  const columns = dense && !lines ? itemColumns(block.items) : 1;
  if (columns > 1) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {block.items?.map((item, k) => (
          <ItemLine key={k} n={k + 1} item={item} look={look} style={[s.item, { width: `${100 / columns}%`, marginLeft: 0, paddingLeft: 4, paddingRight: 6 }]} />
        ))}
      </View>
    );
  }
  return (
    <>
      {block.items?.map((item, k, all) => (
        // No last item alone on a page: the one before it goes along
        // (minPresenceAhead stops at the last sibling, so this only acts
        // when the last item would not fit).
        <View key={k} wrap={false} minPresenceAhead={all.length >= 3 && k === all.length - 2 ? KEEP_WITH_NEXT : undefined}>
          <ItemLine n={k + 1} item={item} look={look} style={[s.item]} />
          {lines > 0 && <RuledLines count={lines} gap={sized(look, RULE_GAP)} />}
        </View>
      ))}
      {a?.type === "write_lines" && !block.items?.length && <RuledLines count={a.lines ?? 5} gap={sized(look, RULE_GAP)} />}
      {a?.type === "draw_box" && (
        <View
          style={{
            height: (a.lines ?? 8) * sized(look, DRAW_LINE),
            marginTop: 6,
            borderWidth: 1,
            borderColor: look.palette.primary,
            borderRadius: Math.max(6, look.theme.radius),
            backgroundColor: "#ffffff",
          }}
        />
      )}
    </>
  );
}

// ---- Code-drawn diagrams (src/lib/diagrams.ts) ----

function SceneSvg({ shapes, width }: { shapes: Shape[]; width: number }) {
  return (
    <Svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} style={{ width, height: (width * SCENE_H) / SCENE_W }}>
      {shapes.map((sh, i) => {
        switch (sh.t) {
          case "rect":
            return <Rect key={i} x={sh.x} y={sh.y} width={sh.w} height={sh.h} rx={sh.rx} fill={sh.fill} stroke={sh.stroke} strokeWidth={0.8} />;
          case "poly":
            return <Polygon key={i} points={sh.points.map((pt) => pt.join(",")).join(" ")} fill={sh.fill} stroke={sh.stroke} strokeWidth={0.8} />;
          case "circle":
            return <Circle key={i} cx={sh.cx} cy={sh.cy} r={sh.r} fill={sh.fill} stroke={sh.stroke} strokeWidth={sh.stroke ? 0.8 : 0} />;
          case "line":
            return <Line key={i} x1={sh.x1} y1={sh.y1} x2={sh.x2} y2={sh.y2} stroke={sh.stroke} strokeWidth={sh.width ?? 1} strokeDasharray={sh.dash} />;
        }
      })}
    </Svg>
  );
}

function PrepositionList({ block, look }: { block: ContentBlock; look: Look }) {
  const scenes = block.diagram?.scenes ?? [];
  const rowH = sized(look, SCENE_ROW);
  const sceneW = ((rowH - 6) * SCENE_W) / SCENE_H;
  return (
    <View>
      {(block.items ?? []).map((item, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", height: rowH }} wrap={false}>
          <View style={{ width: sceneW + 8, marginRight: 8, borderRadius: Math.max(6, look.theme.radius), backgroundColor: "#ffffff", padding: 2, alignItems: "center" }}>
            {scenes[i] ? <SceneSvg shapes={prepositionScene(scenes[i])} width={sceneW} /> : null}
          </View>
          <Text style={{ flex: 1 }}>
            {i + 1}. {itemText(item)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// A street grid: grey roads between blocks of places, empty plots as grass.
function TownMap({ block, look }: { block: ContentBlock; look: Look }) {
  const places = block.diagram?.places ?? [];
  if (!places.length) return null;
  const { rows, cols, at } = mapGrid(places);
  return (
    <View style={{ backgroundColor: "#d6d3d1", borderRadius: Math.max(6, look.theme.radius), padding: 6, marginTop: 6, marginBottom: 8 }} wrap={false}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={{ flexDirection: "row", marginBottom: r < rows - 1 ? 10 : 0 }}>
          {Array.from({ length: cols }, (_, c) => {
            const place = at(r + 1, c + 1);
            const src = place?.emoji ? look.pictureSrc?.[place.emoji.trim()] : undefined;
            return (
              <View
                key={c}
                style={{
                  flex: 1,
                  height: sized(look, MAP_CELL_H),
                  marginRight: c < cols - 1 ? 10 : 0,
                  borderRadius: 4,
                  backgroundColor: place ? "#ffffff" : "#bbf7d0",
                  borderWidth: place ? 1 : 0,
                  borderColor: look.palette.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 3,
                }}
              >
                {src ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop
                  <Image src={src} style={{ width: 30, height: 30, marginBottom: 3 }} />
                ) : null}
                {place ? (
                  <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 8, color: look.palette.primaryDark, textAlign: "center" }}>{place.name}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function ActivityItems({ block, look, columns, dense }: { block: ContentBlock; look: Look; columns: number; dense?: boolean }) {
  const a = block.activity;
  return (
    <>
      {!!a?.words?.length && <WordBank words={a.words} look={look} />}
      {block.diagram?.type === "prepositions" ? (
        <PrepositionList block={block} look={look} />
      ) : a?.type === "picture_label" ? (
        <PictureLabelGrid block={block} look={look} columns={columns} />
      ) : a?.type === "picture_match" ? (
        <PictureMatch block={block} look={look} />
      ) : a?.type === "crossword" ? (
        <CrosswordView block={block} look={look} />
      ) : a?.type === "wordsearch" ? (
        <WordSearchView block={block} look={look} />
      ) : a?.type === "match_lines" ? (
        <MatchLinesView block={block} look={look} />
      ) : a && ["unscramble", "odd_one_out", "tick_cross", "ordering"].includes(a.type) ? (
        <MarkingList block={block} look={look} />
      ) : (
        <ItemList block={block} look={look} dense={dense} />
      )}
    </>
  );
}

function ExerciseBox({
  block,
  showAnswerKey,
  look,
  plain,
  dense,
}: {
  block: ContentBlock;
  showAnswerKey: boolean;
  look: Look;
  plain?: boolean;
  dense?: boolean;
}) {
  if (!block.items?.length && !block.interactive && !block.activity) return null;
  if (isChecklistBlock(block)) return <ChecklistItems items={block.items ?? []} look={look} />;
  // Inside an exercise-grid card the card itself is the frame - a second
  // tinted box with a kind badge inside it read as clutter.
  if (plain) {
    return (
      <View style={{ marginTop: 2 }}>
        <ActivityItems block={block} look={look} columns={3} dense={dense} />
        <InteractiveExerciseView block={block} showAnswerKey={showAnswerKey} look={look} />
        <AnswerKey block={block} show={showAnswerKey} />
      </View>
    );
  }
  const colors = BLOCK_COLORS[block.kind];
  return (
    <View style={[s.exerciseBox, { backgroundColor: colors.bg, borderColor: colors.border, borderRadius: look.theme.radius }]}>
      {/* Rubric icon only - an uppercase "PRACTICE"/"EXPLANATION" label is
          internal vocabulary that no published coursebook prints. */}
      <View style={s.badgeRow}>
        <View style={[s.iconChip, { backgroundColor: colors.text }]}>
          <BlockIcon kind={block.kind} color="#ffffff" />
        </View>
      </View>
      <ActivityItems block={block} look={look} columns={4} />
      <InteractiveExerciseView block={block} showAnswerKey={showAnswerKey} look={look} />
      <AnswerKey block={block} show={showAnswerKey} />
    </View>
  );
}

function AnswerKey({ block, show }: { block: ContentBlock; show: boolean }) {
  if (!show || !block.answerKey?.length) return null;
  return (
    <View style={s.answerKeyBox}>
      <Text style={s.answerKeyLabel}>ANSWER KEY</Text>
      {block.answerKey.map((answer, k) => (
        <Text style={s.item} key={k}>
          {k + 1}. {itemText(answer)}
        </Text>
      ))}
    </View>
  );
}

// Speech bubbles: each speaker gets a colour and an initial "avatar";
// speakers alternate sides by order of first appearance, like the
// conversation strips in printed ELT books.
export function DialogueView({ lines, look }: { lines: NonNullable<ContentBlock["dialogue"]>; look: Look }) {
  const colors = speakerColorMap(lines);
  const order = [...colors.keys()];
  return (
    <View style={{ marginTop: 4 }}>
      {lines.map((l, i) => {
        const color = colors.get(l.speaker) ?? look.palette.primary;
        const right = order.indexOf(l.speaker) % 2 === 1;
        return (
          <View
            key={i}
            wrap={false}
            style={{ flexDirection: right ? "row-reverse" : "row", alignItems: "flex-start", marginBottom: 7 }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: color,
                alignItems: "center",
                justifyContent: "center",
                marginHorizontal: 6,
              }}
            >
              <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 9, color: "#ffffff" }}>
                {l.speaker.trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View
              style={{
                maxWidth: "78%",
                backgroundColor: "#f9fafb",
                borderWidth: 1,
                borderColor: color,
                borderRadius: Math.max(8, look.theme.radius),
                paddingVertical: 5,
                paddingHorizontal: 9,
              }}
            >
              <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 7.5, color, marginBottom: 1 }}>{l.speaker}</Text>
              <Text>{l.line}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function TableView({ table, look }: { table: NonNullable<ContentBlock["table"]>; look: Look }) {
  const cols = table.headers.length;
  return (
    <View style={{ marginTop: 6, marginBottom: 4, borderWidth: 0.75, borderColor: look.palette.primary, borderRadius: look.theme.radius / 2 }} wrap={false}>
      <View style={{ flexDirection: "row", backgroundColor: look.palette.primary }}>
        {table.headers.map((h, i) => (
          <Text key={i} style={{ flex: 1, padding: 5, fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 8.5, color: "#ffffff" }}>
            {h}
          </Text>
        ))}
      </View>
      {table.rows.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", backgroundColor: r % 2 ? look.palette.primaryLight : "#ffffff" }}>
          {Array.from({ length: cols }, (_, c) => (
            <Text key={c} style={{ flex: 1, padding: 5, fontSize: 9, lineHeight: 1.3 }}>
              {row[c] ?? ""}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// A card's frame in two pieces - the heading's (top) and the exercise's
// (bottom) - inside an unframed wrapper: when the heading has to move to the
// next page with its exercise (KEEP_WITH_NEXT), react-pdf leaves the
// wrapper's empty fragment behind, and an unframed fragment prints nothing
// (one frame left a bare bar or tint at the page foot).
type CardPieces = { outer: Style; top: Style; bottom: Style };
// The bottom piece tucks 1pt under the top one: two abutting fills print a
// hairline seam.
const SEAM = { marginTop: -1, paddingTop: 1 };

function cardFrame(look: Look): CardPieces {
  const { cardStyle, radius } = look.theme;
  if (cardStyle === "tinted") return tintPieces(look.palette.primaryLight, radius, 12, 12);
  if (cardStyle === "outlined") {
    const side = { borderLeftWidth: 0.75, borderRightWidth: 0.75, borderColor: "#d1d5db", paddingHorizontal: 10 };
    return {
      outer: { marginBottom: 12 },
      top: { ...side, borderTopWidth: 0.75, borderTopLeftRadius: radius, borderTopRightRadius: radius, paddingTop: 10 },
      bottom: { ...side, borderBottomWidth: 0.75, borderBottomLeftRadius: radius, borderBottomRightRadius: radius, paddingBottom: 10, ...SEAM },
    };
  }
  // No seam tuck for a bar: two abutting border edges print no hairline,
  // and the tuck's 1pt of padding stayed behind as a red sliver at the page
  // foot when the card moved to the next page (KIYAS-13 Workbook p.13).
  const bar = { paddingLeft: 12, borderLeftWidth: 2.5, borderLeftColor: look.palette.primary };
  return { outer: { marginBottom: 14 }, top: bar, bottom: bar };
}

function tintPieces(color: string, radius: number, pad: number, marginBottom: number): CardPieces {
  return {
    outer: { marginBottom },
    top: { backgroundColor: color, borderTopLeftRadius: radius, borderTopRightRadius: radius, paddingTop: pad, paddingHorizontal: pad },
    bottom: { backgroundColor: color, borderBottomLeftRadius: radius, borderBottomRightRadius: radius, paddingBottom: pad, paddingHorizontal: pad, ...SEAM },
  };
}

function BlockInner({ block, showAnswerKey, look, plain, dense }: { block: ContentBlock; showAnswerKey: boolean; look: Look; plain?: boolean; dense?: boolean }) {
  // A note, email, invitation... prints as that object (artefacts.tsx); a
  // quiz box holds the items too, so only its key is left to print.
  const artefact = resolveTextStyle(block);
  const shown = artefact && (artefact === "quiz" ? !!block.items?.length : !!block.body) ? artefact : null;
  if (shown) {
    return (
      <>
        <ArtefactBody style={shown} block={block} look={look} />
        {shown === "quiz" ? (
          <AnswerKey block={block} show={showAnswerKey} />
        ) : (
          <ExerciseBox block={block} showAnswerKey={showAnswerKey} look={look} plain={plain} dense={dense} />
        )}
      </>
    );
  }
  return (
    <>
      {block.body ? <Text style={{ marginBottom: dense ? 3 : 6 }}>{block.body}</Text> : null}
      {block.dialogue?.length ? <DialogueView lines={block.dialogue} look={look} /> : null}
      {block.table ? <TableView table={block.table} look={look} /> : null}
      {block.diagram?.type === "map" ? <TownMap block={block} look={look} /> : null}
      <ExerciseBox block={block} showAnswerKey={showAnswerKey} look={look} plain={plain} dense={dense} />
    </>
  );
}

// A card short enough to sit on one page is never split: split cards left
// a near-empty page holding only the tail of a box (its bottom padding and
// border). Longer cards still flow across pages.
const UNSPLIT_MAX_LINES = 16;
export function blockLines(block: ContentBlock, showAnswerKey = true): number {
  const text = (v: unknown) => Math.ceil(String(v ?? '').length / 85);
  return (
    1 +
    text(block.body) +
    (block.items?.length ?? 0) +
    // a key printed only at the back of the book (Workbook) takes no lines here
    (showAnswerKey && block.answerKey?.length ? block.answerKey.length + 1 : 0) +
    (block.dialogue?.length ?? 0) * 2 +
    (block.table ? block.table.rows.length + 1 : 0) +
    (block.activity ? 6 : 0) +
    (block.diagram ? 8 : 0)
  );
}

// Absolute positioning (Dizilim's manual `layout`) is applied here so it
// stays page-relative - see BookDocument.tsx's notes on the coordinate
// space and the reflow caveat.
// A listening exercise's audio track, printed between its number and its
// rubric as coursebooks do: a headphones mark and the track number on a
// pill in the book's accent colour. Sized to the heading line, so it adds
// no height (estimateBlockHeight needs no change).
export function TrackBadge({ track, look, size }: { track: string; look: Look; size: number }) {
  const h = Math.round(size * 1.15);
  // The source's own pill colour when it was measured (page furniture) -
  // often a light green, so the figure goes dark on it to stay legible.
  const measured = look.furniture?.trackColor;
  const fill = measured ?? look.palette.accent;
  const ink = measured && luminance(measured) > 0.55 ? shade(measured, 0.45) : "#ffffff";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: h,
        paddingLeft: measured ? 0 : 4,
        paddingRight: 4,
        marginRight: 5,
        borderRadius: h / 2,
        backgroundColor: fill,
      }}
    >
      {/* the headphones on a darker disc at the pill's start, as the source prints it */}
      <View
        style={
          measured
            ? { width: h, height: h, borderRadius: h / 2, backgroundColor: shade(measured, 0.75), alignItems: "center", justifyContent: "center", marginRight: 2 }
            : { marginRight: 2 }
        }
      >
        <Svg viewBox="0 0 24 24" style={{ width: h * 0.7, height: h * 0.7 }}>
          <Path d="M4 14v-2a8 8 0 0 1 16 0v2" stroke="#ffffff" strokeWidth={2.6} fill="none" />
          <Rect x={3} y={13} width={5} height={8} rx={2} fill="#ffffff" />
          <Rect x={16} y={13} width={5} height={8} rx={2} fill="#ffffff" />
        </Svg>
      </View>
      <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: size * 0.72, color: ink }}>{track}</Text>
    </View>
  );
}

// A figure centred on a disc: react-pdf hangs a line from the font's
// ascent, so a one-line box centred in a View prints its figures low; set
// solid and lifted by the gap between ascent and cap height, they sit in
// the middle.
export function centredFigure(fontSize: number): Style {
  return { lineHeight: 1, marginTop: -fontSize * 0.2 };
}

// Relative luminance (0-1) of a #rrggbb colour, and the colour scaled
// towards black by f (1 = unchanged).
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function shade(hex: string, f: number): string {
  return `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, "0")).join("")}`;
}

// The exercise number as the source prints it (page furniture): a white
// figure on a disc of the source's badge colour, as tall as the heading
// line - so it adds no height (estimateBlockHeight needs no change).
export function NumberBadge({ n, look, size }: { n: string; look: Look; size: number }) {
  const d = Math.round(size * HEADING_LINE);
  const fill = look.furniture?.numberBadge?.color ?? look.palette.primary;
  return (
    <View
      style={{
        width: d * (n.length > 1 ? 1.2 : 1),
        height: d,
        borderRadius: d / 2,
        backgroundColor: fill,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 5,
      }}
    >
      {/* a size up from the body, as the source prints it (and as the source analyzer finds exercises) */}
      <Text style={[{ fontFamily: look.headingFont, fontWeight: 700, fontSize: size * 1.2, color: luminance(fill) > 0.6 ? shade(fill, 0.35) : "#ffffff" }, centredFigure(size * 1.2)]}>
        {n}
      </Text>
    </View>
  );
}

// Space kept below an exercise heading for its rubric and the first rows of
// its exercise: a heading alone at the foot of a page, its exercise on the
// next (KIYAS-13 Workbook p.12), moves over with it. react-pdf only breaks
// when the exercise itself runs past the page (minPresenceAhead stops at
// the last sibling), so a short exercise near the foot stays put.
const KEEP_WITH_NEXT = 96;
// react-pdf never breaks before a card's first child (it takes it for the
// top of the page), so minPresenceAhead on the heading needs something
// ahead of it: an empty anchor.
function KeepAnchor() {
  return <View style={{ height: 0 }} />;
}

export function BlockCard({
  block,
  showAnswerKey,
  look,
  frameless,
  dense,
  panel,
}: {
  block: ContentBlock;
  showAnswerKey: boolean;
  look: Look;
  frameless?: boolean;
  /** Faz G4: a mirrored (source-zones) page - coursebook density, see estimateBlockHeight. */
  dense?: boolean;
  /** KIYAS-11: set on the book's tinted panel (panelledExercises). */
  panel?: boolean;
}) {
  const track = trackOf(look.tracks, block);
  const layoutStyle = block.layout
    ? { position: "absolute" as const, left: block.layout.x, top: block.layout.y, width: block.layout.width, height: block.layout.height }
    : {};

  if (block.callout) {
    const c = CALLOUT_STYLES[block.callout];
    return (
      <View
        style={[
          { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: Math.max(6, look.theme.radius), padding: 10, marginBottom: 12 },
          layoutStyle,
        ]}
        wrap={false}
      >
        <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 7.5, letterSpacing: 1, color: c.text, marginBottom: 3 }}>
          {c.label}
        </Text>
        {block.heading ? (
          <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: 10.5, color: c.text, marginBottom: 3 }}>{block.heading}</Text>
        ) : null}
        <BlockInner block={block} showAnswerKey={showAnswerKey} look={look} />
      </View>
    );
  }

  if (dense) {
    // Faz G4: set like a coursebook exercise - the number in the book's
    // colour, heading and a short rubric on one line, no card spacing
    // (estimateBlockHeight's frameless branch measures the same).
    const inline = inlineRubric(block);
    const numbered = /^(\d{1,2})[.)]?\s+(.*)$/.exec(block.heading ?? "");
    // The source's own number style when it was measured: a disc, or a
    // numeral in its colour.
    const measured = look.furniture?.numberBadge;
    const badge = !!numbered && !!measured?.filled;
    const numberColor = measured && !measured.filled ? measured.color : look.palette.primary;
    const pieces = panel ? tintPieces(look.palette.primaryLight, Math.max(4, look.theme.radius), PANEL_PAD, 8) : null;
    const wraps = blockLines(block, showAnswerKey) > UNSPLIT_MAX_LINES;
    return (
      <View style={[pieces?.outer ?? { marginBottom: 8 }, layoutStyle]} wrap={wraps}>
        {wraps ? <KeepAnchor /> : null}
        <View style={pieces?.top} minPresenceAhead={KEEP_WITH_NEXT}>
          {track || badge ? (
            // Number, track badge, then heading and rubric wrapping beside them.
            <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 3 }}>
              {badge && numbered ? (
                <NumberBadge n={numbered[1]} look={look} size={look.theme.bodySize} />
              ) : numbered ? (
                <Text
                  style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: look.theme.bodySize * 1.25, color: numberColor, marginRight: 4 }}
                >
                  {numbered[1]}
                </Text>
              ) : null}
              {track ? <TrackBadge track={track} look={look} size={look.theme.bodySize * 1.1} /> : null}
              <Text style={{ flex: 1, lineHeight: `${(look.theme.bodySize * HEADING_LINE).toFixed(1)}pt` }}>
                <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: look.theme.bodySize * 1.1, color: "#1f2937" }}>
                  {numbered ? numbered[2] : block.heading}
                </Text>
                {inline ? `  ${block.body}` : null}
              </Text>
            </View>
          ) : (
            <Text style={{ marginBottom: 3, lineHeight: `${(look.theme.bodySize * HEADING_LINE).toFixed(1)}pt` }}>
              <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: look.theme.bodySize * 1.1, color: "#1f2937" }}>
                {/* the number a size up, as coursebooks print it (and as the source analyzer finds exercises) */}
                {numbered ? <Text style={{ color: numberColor, fontSize: look.theme.bodySize * 1.25 }}>{numbered[1]} </Text> : null}
                {numbered ? numbered[2] : block.heading}
              </Text>
              {inline ? `  ${block.body}` : null}
            </Text>
          )}
        </View>
        <View style={pieces?.bottom}>
          <BlockInner block={inline ? { ...block, body: "" } : block} showAnswerKey={showAnswerKey} look={look} plain dense />
        </View>
      </View>
    );
  }

  const pieces = frameless ? null : cardFrame(look);
  const wraps = blockLines(block, showAnswerKey) > UNSPLIT_MAX_LINES;
  const headingColor = look.theme.cardStyle === "accent-bar" ? "#1f2937" : look.palette.primaryDark;
  return (
    <View style={[pieces?.outer ?? { marginBottom: 12 }, layoutStyle]} wrap={wraps}>
      {wraps ? <KeepAnchor /> : null}
      <View style={pieces?.top} minPresenceAhead={KEEP_WITH_NEXT}>
        {track ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <TrackBadge track={track} look={look} size={12} />
            <Text style={[s.heading, { flex: 1, fontFamily: look.headingFont, color: headingColor }]}>{block.heading}</Text>
          </View>
        ) : (
          <Text style={[s.heading, { fontFamily: look.headingFont, color: headingColor }]}>{block.heading}</Text>
        )}
      </View>
      <View style={pieces?.bottom}>
        <BlockInner block={block} showAnswerKey={showAnswerKey} look={look} plain={frameless} />
      </View>
    </View>
  );
}

export function GlossaryGrid({
  glossary,
  look,
  columns = 2,
}: {
  glossary: GeneratedPage["glossary"];
  look: Look;
  columns?: 2 | 3;
}) {
  if (!glossary?.length || look.noGlossary) return null;
  // KIYAS-13 (Pre-A1): definition cards ("Move from sitting to standing.")
  // are text a five-year-old cannot read, took half a page per unit and ran
  // 2-4 cards onto a page of their own. Young learners' student books print
  // the unit's words as a short list, as the source does; the definitions
  // stay in the Teacher's Book.
  if (look.wordList) {
    return (
      <View wrap={false} style={{ marginTop: 6 }}>
        <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: 11, marginBottom: 5 }}>My words</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
          {glossary.map((entry, i) => (
            <Text
              key={i}
              style={{
                fontFamily: NOTO_SANS,
                fontWeight: 700,
                fontSize: 9.5,
                color: look.palette.primaryDark,
                backgroundColor: look.palette.primaryLight,
                borderRadius: 8,
                paddingVertical: 3,
                paddingHorizontal: 7,
              }}
            >
              {entry.term}
            </Text>
          ))}
        </View>
      </View>
    );
  }
  const width = columns === 3 ? "31.5%" : "48%";
  return (
    <View>
      <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: 12.5, marginBottom: 8, marginTop: 4 }}>Glossary</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {glossary.map((entry, i) => (
          <View
            key={i}
            style={{
              width,
              padding: 9,
              borderRadius: look.theme.radius,
              borderWidth: 1,
              borderColor: look.palette.primary,
              backgroundColor: look.palette.primaryLight,
            }}
            wrap={false}
          >
            <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 10.5, marginBottom: 2, color: look.palette.primaryDark }}>
              {entry.term}
            </Text>
            <Text style={{ fontSize: 9.5, marginBottom: 3, lineHeight: 1.35 }}>{entry.definition}</Text>
            {entry.example && (
              <Text style={{ fontSize: 9, fontFamily: NOTO_SERIF, fontStyle: "italic", color: "#4b5563" }}>e.g. {entry.example}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
