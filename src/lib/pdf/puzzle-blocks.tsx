import { Text, View, Svg, Circle } from "@react-pdf/renderer";
import { MARK_BOX, PUZZLE_WIDTH, gridCell, letterFor } from "@/lib/activities";
import type { ContentBlock } from "@/lib/ai/schemas";
import { seededShuffle } from "@/lib/content-html";
import { itemText } from "@/lib/item-text";
import { buildCrossword, buildWordSearch, crosswordCells, oddOneOutOptions, scrambleWord } from "@/lib/puzzles";
import { NOTO_SANS } from "./fonts";
import type { Look } from "./blocks";

// Faz B4: print drawing for the puzzle and marking formats in
// src/lib/activities.ts. Grids come from src/lib/puzzles.ts; widths assume
// a column (PUZZLE_WIDTH), the same width the fit estimate uses.

const number = (look: Look) => ({ fontFamily: NOTO_SANS, fontWeight: 700 as const, fontSize: 9, color: look.palette.primary });

function Box({ look }: { look: Look }) {
  return <View style={{ width: MARK_BOX, height: MARK_BOX, borderWidth: 1, borderColor: look.palette.primary, borderRadius: 2, backgroundColor: "#ffffff" }} />;
}

function Dot({ color }: { color: string }) {
  return (
    <Svg viewBox="0 0 8 8" style={{ width: 6, height: 6, marginHorizontal: 4 }}>
      <Circle cx="4" cy="4" r="3.5" fill={color} />
    </Svg>
  );
}

export function CrosswordView({ block, look }: { block: ContentBlock; look: Look }) {
  const cw = buildCrossword(block.answerKey ?? []);
  const cells = crosswordCells(cw);
  const cell = gridCell(cw.cols, PUZZLE_WIDTH);
  const clues = (dir: "across" | "down") => cw.words.filter((w) => w.dir === dir);
  return (
    <View>
      <View style={{ alignSelf: "center", marginBottom: 8 }} wrap={false}>
        {cells.map((row, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {row.map((c, k) =>
              c ? (
                <View key={k} style={{ width: cell, height: cell, borderWidth: 0.6, borderColor: "#374151", backgroundColor: "#ffffff" }}>
                  {c.starts.length ? (
                    <Text style={{ position: "absolute", top: 0.5, left: 1, fontFamily: NOTO_SANS, fontSize: 5, color: "#374151" }}>{c.starts.join("/")}</Text>
                  ) : null}
                </View>
              ) : (
                <View key={k} style={{ width: cell, height: cell }} />
              ),
            )}
          </View>
        ))}
      </View>
      {(["across", "down"] as const).map((dir) =>
        clues(dir).length ? (
          <View key={dir} style={{ marginBottom: 4 }}>
            <Text style={{ ...number(look), marginBottom: 2 }}>{dir === "across" ? "Across" : "Down"}</Text>
            {clues(dir).map((w) => (
              <Text key={w.item} style={{ marginBottom: 2, lineHeight: 1.35 }}>
                <Text style={number(look)}>{`${w.item + 1}  `}</Text>
                {itemText(block.items?.[w.item] ?? "")}
              </Text>
            ))}
          </View>
        ) : null,
      )}
    </View>
  );
}

export function WordSearchView({ block, look }: { block: ContentBlock; look: Look }) {
  const words = block.answerKey ?? block.items ?? [];
  const ws = buildWordSearch(words, block.heading);
  const cell = gridCell(ws.size, PUZZLE_WIDTH * 0.62);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start" }} wrap={false}>
      <View style={{ borderWidth: 1, borderColor: look.palette.primary, borderRadius: Math.max(4, look.theme.radius / 2), padding: 4, backgroundColor: "#ffffff" }}>
        {ws.grid.map((row, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {row.map((letter, k) => (
              <Text key={k} style={{ width: cell, height: cell, textAlign: "center", fontFamily: NOTO_SANS, fontWeight: 700, fontSize: cell * 0.62, lineHeight: 1.45 }}>
                {letter}
              </Text>
            ))}
          </View>
        ))}
      </View>
      <View style={{ marginLeft: 10, flex: 1 }}>
        {words.map((w, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
            <Box look={look} />
            <Text style={{ marginLeft: 5 }}>{w}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function MarkingList({ block, look }: { block: ContentBlock; look: Look }) {
  const type = block.activity?.type;
  return (
    <View>
      {(block.items ?? []).map((item, i) => {
        const answer = block.answerKey?.[i] ?? "";
        return (
          <View key={i} style={{ flexDirection: "row", alignItems: type === "unscramble" ? "flex-start" : "center", marginBottom: 7 }} wrap={false}>
            {type === "ordering" ? (
              <View style={{ marginRight: 6 }}>
                <Box look={look} />
              </View>
            ) : (
              <Text style={{ ...number(look), marginRight: 5 }}>{i + 1}</Text>
            )}
            {type === "unscramble" ? (
              // the letters and the writing line first, the hint under them
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                  <Text style={{ fontFamily: NOTO_SANS, fontWeight: 700, letterSpacing: 2, color: look.palette.primaryDark, marginRight: 8 }}>
                    {scrambleWord(answer, block.heading)}
                  </Text>
                  <View style={{ flex: 1, maxWidth: 110, borderBottomWidth: 0.75, borderBottomColor: "#9ca3af", marginBottom: 3 }} />
                </View>
                {itemText(item) ? <Text style={{ fontSize: 8.5, color: "#6b7280", marginTop: 1 }}>{itemText(item)}</Text> : null}
              </View>
            ) : type === "odd_one_out" ? (
              <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}>
                {oddOneOutOptions(item).map((o, k) => (
                  <Text key={k} style={{ marginRight: 16 }}>
                    {o}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={{ flex: 1, lineHeight: 1.35 }}>{itemText(item)}</Text>
            )}
            {type === "tick_cross" && (
              <View style={{ marginLeft: 8 }}>
                <Box look={look} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function MatchLinesView({ block, look }: { block: ContentBlock; look: Look }) {
  const left = block.items ?? [];
  const right = seededShuffle(block.answerKey ?? [], block.heading);
  return (
    <View>
      {left.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }} wrap={false}>
          <Text style={{ ...number(look), marginRight: 5 }}>{i + 1}</Text>
          <Text style={{ flex: 1, lineHeight: 1.35 }}>{itemText(item)}</Text>
          <Dot color={look.palette.primary} />
          <View style={{ width: 28 }} />
          <Dot color={look.palette.primary} />
          <Text style={{ ...number(look), marginRight: 4 }}>{letterFor(i)}</Text>
          <Text style={{ flex: 1, lineHeight: 1.35 }}>{right[i] ? itemText(right[i]) : ""}</Text>
        </View>
      ))}
    </View>
  );
}
