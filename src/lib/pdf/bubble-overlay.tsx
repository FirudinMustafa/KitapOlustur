import { Text, View, Svg, Rect, Polygon } from "@react-pdf/renderer";
import type { PageBubble } from "@/lib/ai/page-bubbles";
import { mapToFrame, type PlaceOptions } from "./label-overlay";
import type { Look } from "./blocks";

// A scene's dialogue as speech bubbles on its picture (source i_5_team_2.pdf
// p.14 "It's party time!"): a white rounded bubble with a dark outline per
// line, the speaker's name small in the book colour over the line, and a
// tail pointing at the speaker's head. Heads come from locateSpeakers
// (fractions of the generated picture); the overlay sits absolutely inside
// the picture's frame and maps them through the frame's crop, as
// LabelOverlay does. Bubbles sit near their speaker - above or beside, not
// over a face - inside the frame and clear of each other.

export const BUBBLE_INK = "#1f2937";

export type PlacedBubble = {
  speaker: string;
  /** The line, wrapped to the bubble's width. */
  lines: string[];
  /** The speaker's head (pt in the frame) and its radius. */
  px: number;
  py: number;
  pr: number;
  /** The bubble's box, in the frame (pt). */
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  nameSize: number;
  pad: number;
  /** The tail: two base points on the bubble's edge and its tip, or null when the head is under the bubble or cropped away. */
  tail: { a: [number, number]; b: [number, number]; tip: [number, number] } | null;
};

type Box = { x: number; y: number; w: number; h: number };

export type BubblePlaceOptions = PlaceOptions & {
  /** Room kept free at the frame's edges (pt) - a rubric pill over the top of a scene, the exercises over its foot. */
  insets?: { top?: number; bottom?: number; left?: number; right?: number };
};

// Average advance of a character, as a share of the font size (Noto Sans
// runs ~0.46). The text gets a little more room than measured (TEXT_SLACK
// of the right padding), so react-pdf never wraps a line we measured as
// fitting.
const CHAR_W = 0.5;
const TEXT_SLACK = 0.8;

// Greedy word wrap to a width (pt).
export function wrapLine(text: string, fontSize: number, maxWidth: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length * fontSize * CHAR_W > maxWidth) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

// Wrapped in as few lines as maxWidth allows, at the narrowest width that
// keeps that many - balanced lines, no lone last word ("this?").
export function balancedWrap(text: string, fontSize: number, maxWidth: number): string[] {
  const n = wrapLine(text, fontSize, maxWidth).length;
  let lo = maxWidth * 0.3;
  let hi = maxWidth;
  for (let k = 0; k < 12; k++) {
    const mid = (lo + hi) / 2;
    if (wrapLine(text, fontSize, mid).length <= n) hi = mid;
    else lo = mid;
  }
  return wrapLine(text, fontSize, hi);
}

const overlapArea = (a: Box, b: Box, pad = 4) =>
  Math.max(0, Math.min(a.x + a.w + pad, b.x + b.w + pad) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h + pad, b.y + b.h + pad) - Math.max(a.y, b.y));

// How much of a circle (a head) a box covers, roughly: 0 (clear) to 1.
function coversCircle(box: Box, cx: number, cy: number, r: number): number {
  const nx = Math.min(Math.max(cx, box.x), box.x + box.w);
  const ny = Math.min(Math.max(cy, box.y), box.y + box.h);
  const d = Math.hypot(cx - nx, cy - ny);
  return d >= r ? 0 : 1 - d / r;
}

// Whether the segment p-q passes through a box.
function segmentHitsBox(p: [number, number], q: [number, number], box: Box): boolean {
  const steps = 12;
  for (let i = 1; i < steps; i++) {
    const x = p[0] + ((q[0] - p[0]) * i) / steps;
    const y = p[1] + ((q[1] - p[1]) * i) / steps;
    if (x > box.x && x < box.x + box.w && y > box.y && y < box.y + box.h) return true;
  }
  return false;
}

// The tail from the bubble's edge facing the head to just short of the
// head (it points at the face without covering it).
export function bubbleTail(box: Box, px: number, py: number, pr: number, radius: number): PlacedBubble["tail"] {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = px - cx;
  const dy = py - cy;
  if (px > box.x && px < box.x + box.w && py > box.y && py < box.y + box.h) return null;
  // Which edge the centre->head line leaves through.
  const tx = dx ? box.w / 2 / Math.abs(dx) : Infinity;
  const ty = dy ? box.h / 2 / Math.abs(dy) : Infinity;
  const half = Math.min(7, (tx < ty ? box.h : box.w) / 4);
  let a: [number, number];
  let b: [number, number];
  let base: [number, number];
  if (ty <= tx) {
    const edgeY = dy > 0 ? box.y + box.h : box.y;
    const bx = Math.min(Math.max(cx + dx * ty, box.x + radius + half), box.x + box.w - radius - half);
    // Leaned toward the head: the base nearest it, so the tail stays short.
    const lean = Math.min(Math.max(px, box.x + radius + half), box.x + box.w - radius - half);
    const x0 = (bx + lean) / 2;
    base = [x0, edgeY];
    a = [x0 - half, edgeY];
    b = [x0 + half, edgeY];
  } else {
    const edgeX = dx > 0 ? box.x + box.w : box.x;
    const by = Math.min(Math.max(py, box.y + radius + half), box.y + box.h - radius - half);
    base = [edgeX, by];
    a = [edgeX, by - half];
    b = [edgeX, by + half];
  }
  const len = Math.hypot(px - base[0], py - base[1]);
  const stop = pr * 1.1;
  if (len - stop < 5) {
    // The bubble is right by the head: a short stub toward it.
    const ux = (px - base[0]) / (len || 1);
    const uy = (py - base[1]) / (len || 1);
    return { a, b, tip: [base[0] + ux * 5, base[1] + uy * 5] };
  }
  const ux = (px - base[0]) / len;
  const uy = (py - base[1]) / len;
  return { a, b, tip: [px - ux * stop, py - uy * stop] };
}

const CORNER = 7;

// Bubbles placed near their speakers. Each bubble's spots - above the
// head, above and to a side, beside it, higher up, below - are scored:
// outside the room, on another bubble, over a face, a tail through another
// bubble or a long tail all cost; the cheapest spot wins. A few passes
// re-place each bubble against all the others, so an early bubble does not
// take the spot a later one needed.
export function placeBubbles(bubbles: PageBubble[], width: number, height: number, options: BubblePlaceOptions = {}): PlacedBubble[] {
  const fontSize = Math.max(7.5, Math.min(10, height * 0.03));
  const nameSize = fontSize * 0.82;
  const pad = fontSize * 0.55;
  const margin = 4;
  const room = {
    left: margin + (options.insets?.left ?? 0),
    top: margin + (options.insets?.top ?? 0),
    right: width - margin - (options.insets?.right ?? 0),
    bottom: height - margin - (options.insets?.bottom ?? 0),
  };
  const maxTextW = Math.max(80, Math.min(140, width * 0.24));

  const items = bubbles.map((bubble) => {
    const { px: rawX, py: rawY, drawnH } = mapToFrame(bubble, width, height, options);
    // A head cropped away gets its bubble by the frame's edge nearest it,
    // without a tail (the speaker's name still says who speaks).
    const px = Math.min(Math.max(rawX, 2), width - 2);
    const py = Math.min(Math.max(rawY, 2), height - 2);
    const visible = px === rawX && py === rawY;
    const pr = Math.max(6, (bubble.r ?? 0.05) * drawnH);
    const lines = balancedWrap(bubble.line, fontSize, maxTextW);
    const textW = Math.max(...lines.map((l) => l.length * fontSize * CHAR_W), bubble.speaker.length * nameSize * CHAR_W * 1.05);
    const w = Math.min(room.right - room.left, textW + pad * 2);
    const h = pad * 2 + nameSize * 1.2 + lines.length * fontSize * 1.2;
    return { bubble, px, py, pr, visible, lines, w, h };
  });

  const clampBox = (box: Box): Box => ({
    ...box,
    x: Math.min(Math.max(box.x, room.left), Math.max(room.left, room.right - box.w)),
    y: Math.min(Math.max(box.y, room.top), Math.max(room.top, room.bottom - box.h)),
  });

  const candidates = (i: number): { box: Box; pref: number }[] => {
    const { px, py, pr, w, h } = items[i];
    const tail = Math.min(16, Math.max(8, pr * 0.5));
    const out: { box: Box; pref: number }[] = [];
    const add = (cx: number, cy: number, pref: number) => out.push({ box: { x: cx - w / 2, y: cy - h / 2, w, h }, pref });
    for (const lift of [1, 2, 3.2]) {
      const cy = py - pr - tail * lift - h / 2;
      for (const shift of [0, 0.3, -0.3, 0.55, -0.55, 0.8, -0.8]) add(px + shift * w, cy, (lift - 1) * 6 + Math.abs(shift) * 4);
    }
    for (const side of [1, -1]) {
      for (const lift of [0.8, 0.2, -0.3]) add(px + side * (w / 2 + pr + tail), py - lift * h, 5 + Math.abs(lift - 0.5) * 4);
      add(px + side * (w / 2 + pr * 0.4 + tail), py - pr - tail - h / 2, 2);
      add(px + side * (w / 2 + pr + tail * 2.5), py - h * 0.5, 9);
    }
    for (const shift of [0, 0.5, -0.5]) add(px + shift * w, py + pr * 1.8 + tail + h / 2, 40 + Math.abs(shift) * 4);
    return out;
  };

  const cost = (i: number, box: Box, pref: number, others: (Box | null)[]): number => {
    const item = items[i];
    let c = pref;
    for (const [k, other] of others.entries()) {
      if (k === i || !other) continue;
      c += 1000 * (overlapArea(box, other) / Math.min(box.w * box.h, other.w * other.h));
      if (overlapArea(box, other) > 0) c += 200;
    }
    for (const [k, it] of items.entries()) {
      if (!it.visible) continue;
      // Its own face weighs most; anyone else's face too.
      const covered = coversCircle(box, it.px, it.py, it.pr * 1.15);
      if (covered) c += (k === i ? 400 : 250) * (0.4 + covered);
      // Under a head is its body: kept clear where possible.
      const body = { x: it.px - it.pr * 1.6, y: it.py + it.pr, w: it.pr * 3.2, h: it.pr * 5 };
      c += (k === i ? 150 : 80) * (overlapArea(box, body, 0) / (body.w * body.h));
    }
    const tail = item.visible ? bubbleTail(box, item.px, item.py, item.pr, CORNER) : null;
    if (tail) {
      const len = Math.hypot(tail.tip[0] - (tail.a[0] + tail.b[0]) / 2, tail.tip[1] - (tail.a[1] + tail.b[1]) / 2);
      c += Math.max(0, len - item.pr) * 0.15;
      const mid: [number, number] = [(tail.a[0] + tail.b[0]) / 2, (tail.a[1] + tail.b[1]) / 2];
      for (const [k, other] of others.entries()) if (k !== i && other && segmentHitsBox(mid, tail.tip, other)) c += 150;
    }
    return c;
  };

  // Each bubble's spots, pushed into the room (the push costs).
  const spots = items.map((_, i) =>
    candidates(i).map((cand) => {
      const box = clampBox(cand.box);
      return { box, pref: cand.pref + Math.hypot(box.x - cand.box.x, box.y - cand.box.y) * 0.5 };
    }),
  );
  const pick: number[] = items.map(() => -1);
  const boxesOf = () => pick.map((s, i) => (s < 0 ? null : spots[i][s].box));
  const costOf = (i: number, s: number, boxes: (Box | null)[]) => cost(i, spots[i][s].box, spots[i][s].pref, boxes);
  const total = () => {
    const boxes = boxesOf();
    return pick.reduce((sum, s, i) => sum + costOf(i, s, boxes), 0);
  };
  const bestSpot = (i: number) => {
    const boxes = boxesOf();
    let best = 0;
    let bestCost = Infinity;
    spots[i].forEach((_, s) => {
      const c = costOf(i, s, boxes);
      if (c < bestCost) [best, bestCost] = [s, c];
    });
    return best;
  };

  // Highest heads first: they have the least room above them.
  const order = items.map((_, i) => i).sort((a, b) => items[a].py - items[b].py || a - b);
  for (const i of order) pick[i] = bestSpot(i);
  // Then each bubble, and each pair together, moves while the whole page
  // gets better (a pair: one steps aside so the other gets its spot).
  let current = total();
  for (let pass = 0; pass < 4; pass++) {
    const before = current;
    for (const i of order) {
      let best = { s: pick[i], c: current };
      for (let s = 0; s < spots[i].length; s++) {
        pick[i] = s;
        const c = total();
        if (c < best.c - 0.5) best = { s, c };
      }
      [pick[i], current] = [best.s, best.c];
    }
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        const [wasA, wasB] = [pick[a], pick[b]];
        let best = { sa: wasA, sb: wasB, c: current };
        for (let sa = 0; sa < spots[a].length; sa++) {
          for (let sb = 0; sb < spots[b].length; sb++) {
            pick[a] = sa;
            pick[b] = sb;
            const c = total();
            if (c < best.c - 0.5) best = { sa, sb, c };
          }
        }
        [pick[a], pick[b], current] = [best.sa, best.sb, best.c];
      }
    }
    if (current >= before - 0.5) break;
  }
  const boxes = boxesOf();

  return items.map((item, i) => {
    const box = boxes[i] as Box;
    return {
      speaker: item.bubble.speaker,
      lines: item.lines,
      px: item.px,
      py: item.py,
      pr: item.pr,
      ...box,
      fontSize,
      nameSize,
      pad,
      tail: item.visible ? bubbleTail(box, item.px, item.py, item.pr, CORNER) : null,
    };
  });
}

export function BubbleOverlay({
  bubbles,
  width,
  height,
  look,
  imageAspect,
  fit,
  positionY,
  insets,
}: {
  bubbles: PageBubble[];
  width: number;
  height: number;
  look: Look;
} & BubblePlaceOptions) {
  const placed = placeBubbles(bubbles, width, height, { imageAspect, fit, positionY, insets });
  if (!placed.length) return null;
  const stroke = 1.1;
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0 }}>
        {placed.map((p, i) => {
          const tail = p.tail;
          // The tail's base reaches a little into the bubble, so its fill
          // covers the bubble's outline where they join.
          const inner = tail
            ? (() => {
                const mx = (tail.a[0] + tail.b[0]) / 2;
                const my = (tail.a[1] + tail.b[1]) / 2;
                const cx = p.x + p.w / 2;
                const cy = p.y + p.h / 2;
                const d = Math.hypot(cx - mx, cy - my) || 1;
                const ix = ((cx - mx) / d) * stroke * 1.5;
                const iy = ((cy - my) / d) * stroke * 1.5;
                return `${tail.a[0] + ix},${tail.a[1] + iy} ${tail.tip[0]},${tail.tip[1]} ${tail.b[0] + ix},${tail.b[1] + iy}`;
              })()
            : null;
          return [
            tail ? <Polygon key={`t${i}`} points={`${tail.a[0]},${tail.a[1]} ${tail.tip[0]},${tail.tip[1]} ${tail.b[0]},${tail.b[1]}`} fill="#ffffff" stroke={BUBBLE_INK} strokeWidth={stroke} strokeLinejoin="round" /> : null,
            <Rect key={`r${i}`} x={p.x} y={p.y} width={p.w} height={p.h} rx={CORNER} ry={CORNER} fill="#ffffff" stroke={BUBBLE_INK} strokeWidth={stroke} />,
            inner ? <Polygon key={`f${i}`} points={inner} fill="#ffffff" /> : null,
          ];
        })}
      </Svg>
      {placed.map((p, i) => (
        <View key={i} style={{ position: "absolute", left: p.x + p.pad, top: p.y + p.pad, width: p.w - p.pad * (2 - TEXT_SLACK) }}>
          <Text style={{ fontFamily: look.headingFont, fontWeight: 700, fontSize: p.nameSize, color: look.palette.primary, lineHeight: 1.2 }}>{p.speaker}</Text>
          {p.lines.map((line, k) => (
            <Text key={k} style={{ fontFamily: look.bodyFont, fontSize: p.fontSize, color: BUBBLE_INK, lineHeight: 1.2 }}>
              {line}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
