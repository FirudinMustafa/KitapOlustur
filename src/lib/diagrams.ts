// Diagrams drawn by code instead of an image model: preposition scenes
// (a ball and a box, the classic ELT picture) and a simple town map on a
// street grid. Exact every time - an image model can't be trusted to put
// the ball *behind* the box, and a map has to agree with the questions.
//
// The geometry lives here as plain shapes so the PDF (src/lib/pdf/blocks.tsx)
// and the web reader (src/components/book/PageContent.tsx) draw the same
// picture.

export const PREPOSITIONS = ["in", "on", "under", "next_to", "behind", "in_front_of", "between", "above", "opposite"] as const;
export type Preposition = (typeof PREPOSITIONS)[number];

export type MapPlace = { name: string; emoji?: string; row: number; col: number };

export type Diagram = {
  type: "prepositions" | "map";
  scenes?: Preposition[];
  places?: MapPlace[];
};

type DiagramBlock = { heading: string; items?: string[]; diagram?: Diagram };

export const DIAGRAM_PROMPT = [
  `Diagrams drawn exactly by the book's software - set a block's "diagram" field instead of asking for an image when an exercise needs one of these:`,
  `- prepositions: one small picture per item showing a red ball and a box (a table for "under"). "diagram.scenes" = one of ${PREPOSITIONS.map((p) => `"${p}"`).join(", ")} per item, in item order. Write the items about "the ball" and "the box" (or "the table" for under; "the boxes" for between), e.g. "The ball is ___ the box." with the preposition in answerKey. Every item MUST have the gap "___" where the preposition goes - never write the preposition or a paraphrase of it ("in the middle of", "beside") in the item, or the picture has nothing left to ask.`,
  `- map: a simple town map on a street grid of up to 3 rows x 4 columns. "diagram.places" = 4-12 places, each {name, emoji, row 1-3, col 1-4}, one place per cell. Places in the same row with consecutive columns are "next to" each other; a place with a neighbour on each side in its row is "between" them; the same column in rows 1 and 3 (row 2 empty or the street between) are "opposite". Every question and answer about the map MUST agree with these positions.`,
].join("\n");

export const MAP_MAX_ROWS = 3;
export const MAP_MAX_COLS = 4;

export function diagramIssues(block: DiagramBlock): string[] {
  const d = block.diagram;
  if (!d) return [];
  const where = `block "${block.heading}"`;
  const issues: string[] = [];
  if (d.type === "prepositions" && (d.scenes?.length ?? 0) !== (block.items?.length ?? 0)) {
    issues.push(`${where}: diagram "prepositions" needs exactly one entry in diagram.scenes per item (${block.items?.length ?? 0} items, ${d.scenes?.length ?? 0} scenes).`);
  }
  // Live E2E 2026-10-10: items came back as "The ball is in the middle of
  // two boxes." - the answer already given, nothing left to fill in.
  if (d.type === "prepositions" && block.items?.some((item) => !item.includes("___"))) {
    issues.push(
      `${where}: every preposition item needs the gap "___" where the preposition goes (e.g. "The ball is ___ the box.") - do not write the preposition or a paraphrase of it in the item.`,
    );
  }
  if (d.type === "map") {
    const places = d.places ?? [];
    if (places.length < 3) issues.push(`${where}: diagram "map" needs at least 3 places.`);
    const cells = new Set<string>();
    for (const p of places) {
      if (p.row < 1 || p.row > MAP_MAX_ROWS || p.col < 1 || p.col > MAP_MAX_COLS) {
        issues.push(`${where}: map place "${p.name}" is outside the ${MAP_MAX_ROWS}x${MAP_MAX_COLS} grid.`);
      }
      const key = `${p.row}:${p.col}`;
      if (cells.has(key)) issues.push(`${where}: two map places share row ${p.row}, column ${p.col}.`);
      cells.add(key);
    }
  }
  return issues;
}

export function mapGrid(places: MapPlace[]): { rows: number; cols: number; at: (row: number, col: number) => MapPlace | undefined } {
  const rows = Math.min(MAP_MAX_ROWS, Math.max(1, ...places.map((p) => p.row)));
  const cols = Math.min(MAP_MAX_COLS, Math.max(1, ...places.map((p) => p.col)));
  const byCell = new Map(places.map((p) => [`${p.row}:${p.col}`, p]));
  return { rows, cols, at: (row, col) => byCell.get(`${row}:${col}`) };
}

// ---- Preposition scenes ----

export type Shape =
  | { t: "rect"; x: number; y: number; w: number; h: number; fill: string; stroke?: string; rx?: number }
  | { t: "poly"; points: [number, number][]; fill: string; stroke?: string }
  | { t: "circle"; cx: number; cy: number; r: number; fill: string; stroke?: string }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; width?: number; dash?: string };

export const SCENE_W = 90;
export const SCENE_H = 60;
const FLOOR = 54;
const INK = "#57534e";
const BOX = { front: "#e3b06a", top: "#f2cf95", side: "#c48d45" };

function box(x: number, w: number, h: number, depth = 6): Shape[] {
  const y = FLOOR - h;
  return [
    { t: "poly", points: [[x, y], [x + depth, y - depth + 1], [x + w + depth, y - depth + 1], [x + w, y]], fill: BOX.top, stroke: INK },
    { t: "poly", points: [[x + w, y], [x + w + depth, y - depth + 1], [x + w + depth, FLOOR - depth + 1], [x + w, FLOOR]], fill: BOX.side, stroke: INK },
    { t: "rect", x, y, w, h, fill: BOX.front, stroke: INK },
  ];
}

function ball(cx: number, cy: number, r = 6.5): Shape[] {
  return [
    { t: "circle", cx, cy, r, fill: "#e5484d", stroke: INK },
    { t: "circle", cx: cx - r * 0.35, cy: cy - r * 0.35, r: r * 0.28, fill: "#ffffff" },
  ];
}

const floor: Shape = { t: "line", x1: 4, y1: FLOOR, x2: SCENE_W - 4, y2: FLOOR, stroke: "#d6d3d1", width: 1 };

export function prepositionScene(p: Preposition): Shape[] {
  const [bx, bw, bh] = [32, 28, 24];
  switch (p) {
    case "in": {
      // ball sits in the open box: back of the top, ball, then the front
      const [top, side, front] = box(bx, bw, bh);
      // dark top face = an open box
      return [floor, { ...top, fill: "#8a5a26" } as Shape, side, ...ball(bx + bw / 2 + 3, FLOOR - bh - 1), front];
    }
    case "on":
      return [floor, ...box(bx, bw, bh), ...ball(bx + bw / 2 + 3, FLOOR - bh - 9)];
    case "next_to":
      return [floor, ...box(bx, bw, bh), ...ball(bx - 12, FLOOR - 6.5)];
    case "behind":
      // peeks out from behind the far side, partly hidden by the box
      return [floor, ...ball(bx + bw + 6, FLOOR - bh + 4, 7), ...box(bx, bw, bh)];
    case "in_front_of":
      return [floor, ...box(bx, bw, bh - 4), ...ball(bx + bw / 2, FLOOR - 4, 8)];
    case "between":
      return [floor, ...box(8, 20, 20), ...ball(SCENE_W / 2, FLOOR - 6.5), ...box(SCENE_W - 34, 20, 20)];
    case "above":
      return [
        floor,
        ...box(bx, bw, bh - 6),
        ...ball(bx + bw / 2 + 3, 10),
        { t: "line", x1: bx + 4, y1: 12, x2: bx + 9, y2: 12, stroke: INK, width: 0.8 },
        { t: "line", x1: bx + bw - 2, y1: 12, x2: bx + bw + 3, y2: 12, stroke: INK, width: 0.8 },
      ];
    case "under":
      return [
        floor,
        { t: "rect", x: 20, y: 24, w: 50, h: 5, fill: BOX.top, stroke: INK, rx: 1 },
        { t: "rect", x: 24, y: 29, w: 4, h: FLOOR - 29, fill: BOX.side, stroke: INK },
        { t: "rect", x: 62, y: 29, w: 4, h: FLOOR - 29, fill: BOX.side, stroke: INK },
        ...ball(45, FLOOR - 6.5),
      ];
    case "opposite":
      return [
        { t: "rect", x: 2, y: 22, w: SCENE_W - 4, h: 16, fill: "#d6d3d1" },
        { t: "line", x1: 6, y1: 30, x2: SCENE_W - 6, y2: 30, stroke: "#ffffff", width: 1.2, dash: "4 3" },
        ...box(38, 18, 15).map((s) => shift(s, 0, -36)),
        ...ball(47, 48),
      ];
  }
}

function shift(s: Shape, dx: number, dy: number): Shape {
  switch (s.t) {
    case "rect":
      return { ...s, x: s.x + dx, y: s.y + dy };
    case "circle":
      return { ...s, cx: s.cx + dx, cy: s.cy + dy };
    case "line":
      return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
    case "poly":
      return { ...s, points: s.points.map(([x, y]) => [x + dx, y + dy]) };
  }
}

// ---- Heights (pt), mirroring the PDF drawing ----

export const SCENE_ROW = 60;
export const MAP_CELL_H = 64;

export function diagramHeight(block: DiagramBlock): { extra: number; replacesItems: boolean } {
  const d = block.diagram;
  if (!d) return { extra: 0, replacesItems: false };
  if (d.type === "prepositions") return { extra: (block.items?.length ?? 0) * SCENE_ROW, replacesItems: true };
  const { rows } = mapGrid(d.places ?? []);
  return { extra: rows * (MAP_CELL_H + 10) + 22, replacesItems: false };
}

export function diagramEmojis(d: Diagram | undefined): string[] {
  return (d?.places ?? []).flatMap((p) => (p.emoji ? [p.emoji] : []));
}

// The same scene as an SVG string, for reflowable exports (EPUB 3 allows
// inline SVG). Values are numbers and fixed colours - nothing to escape.
export function sceneSvgMarkup(shapes: Shape[], width: number): string {
  const body = shapes
    .map((sh) => {
      switch (sh.t) {
        case "rect":
          return `<rect x="${sh.x}" y="${sh.y}" width="${sh.w}" height="${sh.h}" rx="${sh.rx ?? 0}" fill="${sh.fill}" stroke="${sh.stroke ?? "none"}" stroke-width="0.8"/>`;
        case "poly":
          return `<polygon points="${sh.points.map((pt) => pt.join(",")).join(" ")}" fill="${sh.fill}" stroke="${sh.stroke ?? "none"}" stroke-width="0.8"/>`;
        case "circle":
          return `<circle cx="${sh.cx}" cy="${sh.cy}" r="${sh.r}" fill="${sh.fill}" stroke="${sh.stroke ?? "none"}" stroke-width="0.8"/>`;
        case "line":
          return `<line x1="${sh.x1}" y1="${sh.y1}" x2="${sh.x2}" y2="${sh.y2}" stroke="${sh.stroke}" stroke-width="${sh.width ?? 1}"${sh.dash ? ` stroke-dasharray="${sh.dash}"` : ""}/>`;
      }
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_W} ${SCENE_H}" width="${width}" height="${Math.round((width * SCENE_H) / SCENE_W)}">${body}</svg>`;
}

const SCENE_OBJECT: Record<Preposition, string> = {
  in: "the box",
  on: "the box",
  under: "the table",
  next_to: "the box",
  behind: "the box",
  in_front_of: "the box",
  between: "the boxes",
  above: "the box",
  opposite: "the box",
};

export function prepositionWords(p: Preposition): string {
  return p.replace(/_/g, " ");
}

// Backstop after the writer's retries: a preposition item without its gap
// is rewritten from the scene it sits next to (the drawing is the truth),
// and its answer is the scene's preposition.
export function fixPrepositionItems<B extends DiagramBlock & { answerKey?: string[] }>(block: B): B {
  const scenes = block.diagram?.type === "prepositions" ? block.diagram.scenes : undefined;
  if (!scenes?.length || !block.items?.length || block.items.every((i) => i.includes("___"))) return block;
  const items = block.items.map((item, i) => (item.includes("___") || !scenes[i] ? item : `The ball is ___ ${SCENE_OBJECT[scenes[i]]}.`));
  const answerKey = block.items.map((item, i) => (item.includes("___") || !scenes[i] ? (block.answerKey?.[i] ?? "") : prepositionWords(scenes[i])));
  return { ...block, items, answerKey };
}
