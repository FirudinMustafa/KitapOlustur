import { Text, View, Svg, Line, Circle, Polygon } from "@react-pdf/renderer";
import type { PageLabel } from "@/lib/ai/page-labels";
import type { Look } from "./blocks";

// Plan step 4 (2026-10-23): a scene picture's vocabulary words printed on
// the picture - a small white rounded pill per word, joined to its object by
// a short yellow arrow (source Super Minds p.7: "window", "door", "chair").
// Points are fractions of the generated picture (locateLabels); the overlay
// sits absolutely inside the picture's frame and maps them through the
// frame's crop.

export const LABEL_ARROW_COLOR = "#F2B705";

export type PlacedLabel = {
  word: string;
  /** The object's point, in the frame (pt). */
  px: number;
  py: number;
  /** The pill's box, in the frame (pt). */
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
};

type PlaceOptions = {
  /** width / height of the picture itself; unset = it fills the frame exactly. */
  imageAspect?: number;
  fit?: "cover" | "contain";
  /** Vertical anchor of a cropped picture (Illustration crops at 30%). */
  positionY?: number;
};

// Where a point of the picture lands in the frame, or null if it is cropped
// away.
function toFrame(label: PageLabel, width: number, height: number, { imageAspect, fit = "cover", positionY = 0.3 }: PlaceOptions): { px: number; py: number } | null {
  if (!imageAspect) return { px: label.x * width, py: label.y * height };
  const frameAspect = width / height;
  const scale = (fit === "cover") === (imageAspect > frameAspect) ? height : width / imageAspect;
  const drawnW = scale * imageAspect;
  const drawnH = scale;
  const offsetX = (width - drawnW) / 2;
  const offsetY = (height - drawnH) * (fit === "cover" ? positionY : 0.5);
  const px = offsetX + label.x * drawnW;
  const py = offsetY + label.y * drawnH;
  return px < 2 || py < 2 || px > width - 2 || py > height - 2 ? null : { px, py };
}

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, pad = 3) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

// Pills placed near their points: above first, then below, the sides and
// the corners; the first spot inside the frame that hits no placed pill
// and covers no other label's point wins, else the least crowded one.
export function placeLabels(labels: PageLabel[], width: number, height: number, options: PlaceOptions = {}): PlacedLabel[] {
  const fontSize = Math.max(7, Math.min(11, height * 0.04));
  const pillH = fontSize * 1.25 + 6;
  const reach = pillH * 1.3; // arrow length
  const margin = 4;
  const points = labels.map((l) => toFrame(l, width, height, options));
  const placed: PlacedLabel[] = [];
  labels.forEach((label, i) => {
    const point = points[i];
    if (!point) return;
    const { px, py } = point;
    const w = label.word.length * fontSize * 0.6 + 14;
    const candidates = [
      [0, -1],
      [0, 1],
      [1, 0],
      [-1, 0],
      [1, -1],
      [-1, -1],
      [1, 1],
      [-1, 1],
    ].map(([dx, dy]) => {
      const cx = px + dx * (reach + w / 2);
      const cy = py + dy * (reach + pillH / 2);
      const box = { x: cx - w / 2, y: cy - pillH / 2, w, h: pillH };
      const inside = box.x >= margin && box.y >= margin && box.x + w <= width - margin && box.y + pillH <= height - margin;
      const crowd =
        placed.filter((p) => overlaps(p, box)).length * 10 +
        points.filter((p, k) => k !== i && p && p.px > box.x && p.px < box.x + w && p.py > box.y && p.py < box.y + pillH).length;
      return { box, inside, crowd };
    });
    const best = candidates.find((c) => c.inside && c.crowd === 0) ?? [...candidates].sort((a, b) => Number(b.inside) - Number(a.inside) || a.crowd - b.crowd)[0];
    // Kept inside the frame whatever happens.
    const x = Math.min(Math.max(best.box.x, margin), width - margin - w);
    const y = Math.min(Math.max(best.box.y, margin), height - margin - pillH);
    placed.push({ word: label.word, px, py, x, y, w, h: pillH, fontSize });
  });
  return placed;
}

// The arrow runs from the pill's edge to just short of the object.
function arrow(p: PlacedLabel) {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const dx = p.px - cx;
  const dy = p.py - cy;
  // Where the centre->point line leaves the pill.
  const t = Math.min(dx ? p.w / 2 / Math.abs(dx) : Infinity, dy ? p.h / 2 / Math.abs(dy) : Infinity, 1);
  const sx = cx + dx * t;
  const sy = cy + dy * t;
  const len = Math.hypot(p.px - sx, p.py - sy);
  if (len < 4) return null;
  const ux = (p.px - sx) / len;
  const uy = (p.py - sy) / len;
  const head = 4.5;
  const tipX = p.px - ux * 1.5;
  const tipY = p.py - uy * 1.5;
  const baseX = tipX - ux * head;
  const baseY = tipY - uy * head;
  return {
    line: { x1: sx, y1: sy, x2: baseX, y2: baseY },
    head: `${tipX},${tipY} ${baseX - uy * head * 0.6},${baseY + ux * head * 0.6} ${baseX + uy * head * 0.6},${baseY - ux * head * 0.6}`,
  };
}

export function LabelOverlay({
  labels,
  width,
  height,
  look,
  imageAspect,
  fit,
  positionY,
}: {
  labels: PageLabel[];
  width: number;
  height: number;
  look: Look;
} & PlaceOptions) {
  const placed = placeLabels(labels, width, height, { imageAspect, fit, positionY });
  if (!placed.length) return null;
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0 }}>
        {placed.map((p, i) => {
          const a = arrow(p);
          if (!a) return null;
          return [
            <Line key={`l${i}`} {...a.line} stroke="#ffffff" strokeWidth={3.2} strokeLinecap="round" />,
            <Line key={`m${i}`} {...a.line} stroke={LABEL_ARROW_COLOR} strokeWidth={1.8} strokeLinecap="round" />,
            <Polygon key={`h${i}`} points={a.head} fill={LABEL_ARROW_COLOR} stroke="#ffffff" strokeWidth={0.6} />,
            <Circle key={`c${i}`} cx={p.px} cy={p.py} r={1.6} fill={LABEL_ARROW_COLOR} />,
          ];
        })}
      </Svg>
      {placed.map((p, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.w,
            height: p.h,
            borderRadius: p.h / 2,
            backgroundColor: "#ffffff",
            borderWidth: 1,
            borderColor: LABEL_ARROW_COLOR,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: p.fontSize, color: "#1f2937", lineHeight: 1 }}>{p.word}</Text>
        </View>
      ))}
    </View>
  );
}
