import { Text, View, Svg, Path, Rect, Circle, Line, Image } from "@react-pdf/renderer";
import { DRAW_LINE, MATCH_ROW, PICTURE_CELL, RULE_GAP, letterFor, type ActivityPicture } from "@/lib/activities";
import type { ContentBlock, ContentBlockKind, GeneratedPage } from "@/lib/ai/schemas";
import { seededShuffle } from "@/lib/content-html";
import { BLOCK_COLORS } from "@/lib/block-colors";
import { itemText } from "@/lib/item-text";
import { isChecklistBlock } from "@/lib/design/layouts";
import { CALLOUT_STYLES, speakerColorMap, type DesignTheme, type ThemePalette } from "@/lib/design/themes";
import { NOTO_SANS, NOTO_SERIF } from "./fonts";

// Faz 1 "Tasarım sistemi": the per-block print pieces, split out of
// BookDocument.tsx so the page templates (./templates.tsx) and the original
// single-column flow share one implementation. Everything visual is read
// from `Look` (theme + resolved palette) instead of fixed constants.

export type Look = {
  theme: DesignTheme;
  palette: ThemePalette;
  headingFont: string;
  bodyFont: string;
  /** emoji -> image src for activity pictures (filled by the book renderer when icons are available). */
  pictureSrc?: Record<string, string>;
};

export function makeLook(theme: DesignTheme, palette: ThemePalette): Look {
  return {
    theme,
    palette,
    headingFont: theme.headingFont === "serif" ? NOTO_SERIF : NOTO_SANS,
    bodyFont: theme.bodyFont === "serif" ? NOTO_SERIF : NOTO_SANS,
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
  item: { marginBottom: 3, marginLeft: 4, lineHeight: 1.4 },
  exerciseBox: { marginTop: 8, marginBottom: 4, padding: 10, borderWidth: 1 },
  badgeRow: { flexDirection: "row" as const, alignItems: "center" as const, marginBottom: 6 },
  iconChip: { width: 18, height: 18, borderRadius: 9, alignItems: "center" as const, justifyContent: "center" as const, marginRight: 6 },
  badgeLabel: {
    fontFamily: NOTO_SANS,
    fontWeight: 700,
    fontSize: 7,
    letterSpacing: 0.5,
    color: "#ffffff",
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginRight: 7,
  },
  answerKeyBox: { marginTop: 6, padding: 8, backgroundColor: "#f9fafb", borderRadius: 4 },
  answerKeyLabel: { fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 7.5, color: "#6b7280", letterSpacing: 1, marginBottom: 3 },
};

// Faz H2 Faz 3: static print rendering of a structured exercise - the
// clickable version lives in PageContent.tsx. Matching right columns are
// deterministically scrambled unless the answer key is shown.
function InteractiveExerciseView({ block, showAnswerKey }: { block: ContentBlock; showAnswerKey: boolean }) {
  const interactive = block.interactive;
  if (!interactive) return null;

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

  const rightColumn = showAnswerKey
    ? interactive.pairs.map((p) => p.right)
    : seededShuffle(
        interactive.pairs.map((p) => p.right),
        block.heading,
      );
  return (
    <View style={{ marginTop: 6 }}>
      {interactive.pairs.map((pair, i) => (
        <Text style={s.item} key={i}>
          {i + 1}. {pair.left} — {rightColumn[i]}
        </Text>
      ))}
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
          <Text style={{ flex: 1, lineHeight: 1.35 }}>{itemText(item)}</Text>
        </View>
      ))}
    </View>
  );
}

// ---- Workbook activity formats (src/lib/activities.ts) ----

function WordBank({ words, look }: { words: string[]; look: Look }) {
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

function RuledLines({ count }: { count: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ height: RULE_GAP, borderBottomWidth: 0.75, borderBottomColor: "#9ca3af" }} />
      ))}
    </View>
  );
}

// A picture for an activity: the icon when the renderer has one for this
// emoji, otherwise a soft frame with a short description so the exercise
// still reads.
function PictureFrame({ picture, fallback, height, look }: { picture?: ActivityPicture; fallback: string; height: number; look: Look }) {
  const src = picture?.emoji ? look.pictureSrc?.[picture.emoji] : undefined;
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
        <Image src={src} style={{ height: height - 14, width: height - 14, objectFit: "contain" }} />
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
          <PictureFrame picture={pictures[i]} fallback={itemText(item)} height={PICTURE_CELL - 30} look={look} />
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
function PictureMatch({ block, look }: { block: ContentBlock; look: Look }) {
  const items = block.items ?? [];
  const pictures = block.activity?.pictures ?? [];
  const frame = MATCH_ROW - 8;
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", height: MATCH_ROW }} wrap={false}>
          <Text style={{ flex: 1, lineHeight: 1.3 }}>
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

function ItemList({ block, look }: { block: ContentBlock; look: Look }) {
  const a = block.activity;
  const lines = a?.type === "write_lines" ? (a.lines ?? 1) : 0;
  return (
    <>
      {block.items?.map((item, k) => (
        <View key={k} wrap={false}>
          <Text style={s.item}>
            {k + 1}. {itemText(item)}
          </Text>
          {lines > 0 && <RuledLines count={lines} />}
        </View>
      ))}
      {a?.type === "write_lines" && !block.items?.length && <RuledLines count={a.lines ?? 5} />}
      {a?.type === "draw_box" && (
        <View
          style={{
            height: (a.lines ?? 8) * DRAW_LINE,
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

function ActivityItems({ block, look, columns }: { block: ContentBlock; look: Look; columns: number }) {
  const a = block.activity;
  return (
    <>
      {!!a?.words?.length && <WordBank words={a.words} look={look} />}
      {a?.type === "picture_label" ? (
        <PictureLabelGrid block={block} look={look} columns={columns} />
      ) : a?.type === "picture_match" ? (
        <PictureMatch block={block} look={look} />
      ) : (
        <ItemList block={block} look={look} />
      )}
    </>
  );
}

function ExerciseBox({
  block,
  showAnswerKey,
  look,
  plain,
}: {
  block: ContentBlock;
  showAnswerKey: boolean;
  look: Look;
  plain?: boolean;
}) {
  if (!block.items?.length && !block.interactive && !block.activity) return null;
  if (isChecklistBlock(block)) return <ChecklistItems items={block.items ?? []} look={look} />;
  // Inside an exercise-grid card the card itself is the frame - a second
  // tinted box with a kind badge inside it read as clutter.
  if (plain) {
    return (
      <View style={{ marginTop: 2 }}>
        <ActivityItems block={block} look={look} columns={3} />
        <InteractiveExerciseView block={block} showAnswerKey={showAnswerKey} />
        <AnswerKey block={block} show={showAnswerKey} />
      </View>
    );
  }
  const colors = BLOCK_COLORS[block.kind];
  return (
    <View style={[s.exerciseBox, { backgroundColor: colors.bg, borderColor: colors.border, borderRadius: look.theme.radius }]}>
      <View style={s.badgeRow}>
        <View style={[s.iconChip, { backgroundColor: colors.text }]}>
          <BlockIcon kind={block.kind} color="#ffffff" />
        </View>
        <Text style={[s.badgeLabel, { backgroundColor: colors.text }]}>{block.kind.toUpperCase()}</Text>
      </View>
      <ActivityItems block={block} look={look} columns={4} />
      <InteractiveExerciseView block={block} showAnswerKey={showAnswerKey} />
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
              <Text style={{ lineHeight: 1.4 }}>{l.line}</Text>
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

function cardFrame(look: Look) {
  const { cardStyle, radius } = look.theme;
  if (cardStyle === "tinted") return { backgroundColor: look.palette.primaryLight, borderRadius: radius, padding: 12, marginBottom: 12 };
  if (cardStyle === "outlined") return { borderWidth: 0.75, borderColor: "#d1d5db", borderRadius: radius, padding: 10, marginBottom: 12 };
  return { paddingLeft: 12, borderLeftWidth: 2.5, borderLeftColor: look.palette.primary, marginBottom: 14 };
}

function BlockInner({ block, showAnswerKey, look, plain }: { block: ContentBlock; showAnswerKey: boolean; look: Look; plain?: boolean }) {
  return (
    <>
      {block.body ? <Text style={{ marginBottom: 6, lineHeight: 1.4 }}>{block.body}</Text> : null}
      {block.dialogue?.length ? <DialogueView lines={block.dialogue} look={look} /> : null}
      {block.table ? <TableView table={block.table} look={look} /> : null}
      <ExerciseBox block={block} showAnswerKey={showAnswerKey} look={look} plain={plain} />
    </>
  );
}

// A card short enough to sit on one page is never split: split cards left
// a near-empty page holding only the tail of a box (its bottom padding and
// border). Longer cards still flow across pages.
const UNSPLIT_MAX_LINES = 16;
export function blockLines(block: ContentBlock): number {
  const text = (v: unknown) => Math.ceil(String(v ?? '').length / 85);
  return (
    1 +
    text(block.body) +
    (block.items?.length ?? 0) +
    (block.answerKey?.length ? block.answerKey.length + 1 : 0) +
    (block.dialogue?.length ?? 0) * 2 +
    (block.table ? block.table.rows.length + 1 : 0) +
    (block.activity ? 6 : 0)
  );
}

// Absolute positioning (Dizilim's manual `layout`) is applied here so it
// stays page-relative - see BookDocument.tsx's notes on the coordinate
// space and the reflow caveat.
export function BlockCard({
  block,
  showAnswerKey,
  look,
  frameless,
}: {
  block: ContentBlock;
  showAnswerKey: boolean;
  look: Look;
  frameless?: boolean;
}) {
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

  return (
    <View style={[frameless ? { marginBottom: 12 } : cardFrame(look), layoutStyle]} wrap={blockLines(block) > UNSPLIT_MAX_LINES}>
      <Text style={[s.heading, { fontFamily: look.headingFont, color: look.theme.cardStyle === "accent-bar" ? "#1f2937" : look.palette.primaryDark }]}>
        {block.heading}
      </Text>
      <BlockInner block={block} showAnswerKey={showAnswerKey} look={look} plain={frameless} />
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
  if (!glossary?.length) return null;
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
