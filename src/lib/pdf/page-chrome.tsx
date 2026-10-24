import { Text, View } from "@react-pdf/renderer";
import type { ZonePlan } from "@/lib/design/zones";
import { legibleGround, type TopBand } from "@/lib/design/page-furniture";
import { centredFigure, type Look } from "./blocks";
import { NOTO_SANS } from "./fonts";
import { LessonPointers } from "./lesson-furniture";

// The page furniture BookDocument.tsx prints around a content page - the
// page marker, the source's top band and ground, the topic footer - in a
// file of its own so a page drawn from a design spec (spec-page.tsx) prints
// the same pieces.

// Faz 3 "Görsel sayfa denetimi": an invisible marker that reports which
// PDF page a logical page starts on, so a proof render can be mapped back
// to (unit, page) - and a page that spilled onto extra PDF pages is
// detected exactly. react-pdf evaluates render props during layout.
export type PageStartListener = (key: string, pageNumber: number) => void;

// Sheet k > 0 of a page that prints on several (a workbook page split
// between whole exercises, worksheet-layout.ts): "<unit>:<page>/<k>".
export function sheetKey(pageKey: string, k: number): string {
  return k ? `${pageKey}/${k}` : pageKey;
}

export function PageMarker({ id, onPageStart }: { id: string; onPageStart?: PageStartListener }) {
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

// Page furniture (KIYAS-13 review): the source's band across the top edge -
// a full-width strip and, when it has one, a taller tab of a second colour
// from the outer edge (the right on a recto, the left on a verso).
export function TopEdgeBand({ band, bleed = 0, pageSize }: { band: TopBand; bleed?: number; pageSize: { width: number; height: number } }) {
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

// How far the top band (and its tab) reaches down the page, as TopEdgeBand draws it.
export function topBandHeight(band: TopBand | undefined, pageHeight: number): number {
  if (!band) return 0;
  const h = Math.max(3, band.heightRatio * pageHeight);
  return band.tab ? Math.max(h + 2, band.tab.heightRatio * pageHeight) : h;
}

// The colour the source page is printed on (zonePlan.ground): all over, a
// band across the top or foot, or a panel down one side - drawn first, under
// everything else, and into the bleed where it reaches the page edge.
export function GroundLayer({ ground, bleed = 0, pageSize }: { ground: NonNullable<ZonePlan["ground"]>; bleed?: number; pageSize: { width: number; height: number } }) {
  const { box } = ground;
  const x0 = box.x <= 0 ? 0 : bleed + box.x * pageSize.width;
  const y0 = box.y <= 0 ? 0 : bleed + box.y * pageSize.height;
  const x1 = box.x + box.w >= 1 ? pageSize.width + 2 * bleed : bleed + (box.x + box.w) * pageSize.width;
  const y1 = box.y + box.h >= 1 ? pageSize.height + 2 * bleed : bleed + (box.y + box.h) * pageSize.height;
  // fixed: an absolute box reaching the page foot is otherwise laid out as
  // flow that runs over, and the page breaks onto a second sheet.
  return <View fixed style={{ position: "absolute", left: x0, top: y0, width: x1 - x0, height: y1 - y0, backgroundColor: legibleGround(ground.color) }} />;
}

// The footer of a book mirroring a source: the page's topic on a pill and
// the folio in a ring, at the outer bottom corner - where coursebooks put
// them - instead of the "title · book type" running line.
export function TopicFooter({ topic, look, bleed = 0, pointers }: { topic?: string; look: Look; bleed?: number; pointers?: string[] }) {
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
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: pointers?.length ? "space-between" : recto ? "flex-end" : "flex-start" }}>
            {/* a lesson's pointers to its review and workbook pages, toward the spine */}
            {pointers?.length && recto ? <LessonPointers key="pointers" pointers={pointers} look={look} /> : null}
            <View style={{ flexDirection: "row", alignItems: "center" }}>{recto ? [pill, folio] : [folio, pill]}</View>
            {pointers?.length && !recto ? <LessonPointers key="pointers" pointers={pointers} look={look} /> : null}
          </View>
        );
      }}
    />
  );
}
