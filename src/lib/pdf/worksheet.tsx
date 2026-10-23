import type { ReactNode } from "react";
import { Text, View, Image } from "@react-pdf/renderer";
import type { ContentBlock } from "@/lib/ai/schemas";
import { DENSE_LINE } from "@/lib/design/layouts";
import { rubricOnly } from "@/lib/design/type-layout";
import { DENSE_TAIL, FRAME_PAD, SIDE_GAP, TILE_GAP, TILE_LINE_H, type WorksheetItem, type WorksheetLayout } from "@/lib/design/worksheet-layout";
import { itemText } from "@/lib/item-text";
import { BlockCard, PictureMatch, WordBank, centredFigure, type Look } from "./blocks";
import { UnitHeading } from "./templates";
import { NOTO_SANS } from "./fonts";
import { CrosswordView } from "./puzzle-blocks";

// A workbook page as an activity book sets it (worksheetLayout,
// src/lib/design/worksheet-layout.ts): every exercise in a frame, picture
// tiles big, the page filled; a page that needs two sheets starts the
// second one on a new PDF page with its own marker.

function Tile({ block, index, width, faceHeight, look }: { block: ContentBlock; index: number; width: number; faceHeight: number; look: Look }) {
  const picture = block.activity?.pictures?.[index];
  const src = picture?.emoji ? look.pictureSrc?.[picture.emoji.trim()] : undefined;
  const side = Math.min(width, faceHeight) * 0.74;
  const disc = look.furniture?.numberBadge?.color ?? look.palette.accent;
  return (
    <View style={{ width }} wrap={false}>
      <View
        style={{
          height: faceHeight,
          borderRadius: Math.max(8, look.theme.radius),
          backgroundColor: "#ffffff",
          borderWidth: 1,
          borderColor: look.palette.primaryLight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {src ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop
          <Image src={src} style={{ width: side, height: side, objectFit: "contain" }} />
        ) : (
          // the item's description - the picture's label is the answer
          <Text style={{ fontSize: look.theme.bodySize * 0.9, color: "#6b7280", textAlign: "center", paddingHorizontal: 8 }}>{itemText(block.items?.[index] ?? "")}</Text>
        )}
        <View style={{ position: "absolute", top: 5, left: 5, width: 17, height: 17, borderRadius: 8.5, backgroundColor: disc, alignItems: "center", justifyContent: "center" }}>
          <Text style={[{ fontFamily: NOTO_SANS, fontWeight: 700, fontSize: 9, color: "#ffffff" }, centredFigure(9)]}>{index + 1}</Text>
        </View>
      </View>
      <View style={{ height: TILE_LINE_H, justifyContent: "flex-end", paddingHorizontal: 6 }}>
        <View style={{ borderBottomWidth: 0.9, borderBottomColor: "#9ca3af", marginBottom: 4 }} />
      </View>
    </View>
  );
}

function Exercise({ item, look: sheetLook, showAnswerKey, marginBottom, mainSrc }: { item: WorksheetItem; look: Look; showAnswerKey: boolean; marginBottom: number; mainSrc?: string }) {
  const { block, grid, matchRow, side, crossCell } = item;
  const special = !!grid || !!matchRow || !!crossCell;
  const look = item.emoji ? { ...sheetLook, itemEmoji: item.emoji } : sheetLook;
  if (side && mainSrc) {
    // The page's picture beside the exercise, as tall as the exercise.
    return (
      <View
        wrap={false}
        style={{
          flexDirection: "row",
          borderWidth: 1.5,
          borderColor: look.palette.primaryLight,
          borderRadius: Math.max(10, look.theme.radius),
          backgroundColor: "#ffffff",
          padding: FRAME_PAD,
          marginBottom,
        }}
      >
        <View style={{ flex: 1, marginBottom: -DENSE_TAIL }}>
          <BlockCard block={block} look={look} showAnswerKey={showAnswerKey} frameless dense />
        </View>
        <View style={{ width: side, height: item.sideHeight, marginLeft: SIDE_GAP, borderRadius: Math.max(8, look.theme.radius), overflow: "hidden" }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
          <Image src={mainSrc} style={{ width: side, height: item.sideHeight, objectFit: "cover", objectPositionY: "35%" }} />
        </View>
      </View>
    );
  }
  return (
    <View
      wrap={false}
      style={{
        borderWidth: 1.5,
        borderColor: look.palette.primaryLight,
        borderRadius: Math.max(10, look.theme.radius),
        backgroundColor: "#ffffff",
        padding: FRAME_PAD,
        paddingBottom: special ? FRAME_PAD : FRAME_PAD - DENSE_TAIL,
        marginBottom,
      }}
    >
      <BlockCard block={special ? rubricOnly(block) : block} look={look} showAnswerKey={showAnswerKey} frameless dense />
      {special && block.activity?.words?.length ? <WordBank words={block.activity.words} look={look} /> : null}
      {grid ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: TILE_GAP }}>
          {(block.items ?? []).map((_, k) => (
            <Tile key={k} block={block} index={k} width={grid.tileWidth} faceHeight={grid.faceHeight} look={look} />
          ))}
        </View>
      ) : matchRow ? (
        <PictureMatch block={block} look={look} row={matchRow} />
      ) : crossCell ? (
        <CrosswordView block={block} look={look} cell={crossCell} />
      ) : null}
    </View>
  );
}

export function WorksheetPageBody({
  layout,
  unit,
  isUnitFirstPage,
  look,
  showAnswerKey,
  unitKicker,
  mainSrc,
  sheetStart,
}: {
  layout: WorksheetLayout;
  unit: { unitNumber: number; title: string };
  isUnitFirstPage: boolean;
  look: Look;
  showAnswerKey: boolean;
  unitKicker: string;
  mainSrc?: string;
  /** What starts sheet k > 0 on its new PDF page: its page marker and running header. */
  sheetStart: (k: number) => ReactNode;
}) {
  return (
    <>
      {layout.sheets.map((sheet, k) => {
        const sheetLook = sheet.bodySize === look.theme.bodySize ? look : { ...look, theme: { ...look.theme, bodySize: sheet.bodySize } };
        return (
          <View key={k} break={k > 0 || undefined} style={{ fontSize: sheet.bodySize, lineHeight: `${(sheet.bodySize * DENSE_LINE).toFixed(2)}pt` }}>
            {k > 0 ? sheetStart(k) : null}
            {k === 0 && isUnitFirstPage ? <UnitHeading unit={unit} look={look} kicker={unitKicker} /> : null}
            {sheet.mainHeight && mainSrc ? (
              <View style={{ height: sheet.mainHeight, borderRadius: Math.max(10, look.theme.radius), overflow: "hidden", marginBottom: sheet.gap }} wrap={false}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no `alt` prop */}
                <Image src={mainSrc} style={{ width: "100%", height: "100%", objectFit: "cover", objectPositionY: "35%" }} />
              </View>
            ) : null}
            {sheet.items.map((item, i) => (
              <Exercise key={i} item={item} look={sheetLook} showAnswerKey={showAnswerKey} marginBottom={i < sheet.items.length - 1 ? sheet.gap : 0} mainSrc={mainSrc} />
            ))}
          </View>
        );
      })}
    </>
  );
}
