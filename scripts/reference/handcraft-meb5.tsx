// "Paper Kite 5" - Unit 2 "Our Classroom": a print-ready Student's Book
// unit (20 pages) and Workbook (12 pages, homework + teacher appendix) for
// Year 5 in Türkiye, written from the Maarif English curriculum targets of
// Theme 2 "Classroom Life". Every text, item, character, story, picture and
// layout is new. Content and answers: handcraft-meb5-content.ts; free
// artwork: handcraft-meb5-art.ts; paid pictures: handcraft-meb5-images.mts.
//
// Print spec: A4 trim (210 x 297 mm), 3 mm bleed, crop marks, pictures at
// 300 dpi, every box on the 12-column grid of print-kit.ts. Type: Baloo 2
// for headings, Andika for everything a child reads (>= 12 pt; reading
// texts 13 pt; labels in capitals and folios >= 9 pt). Text colours: navy,
// tealDark, lilac (and the dark coral only at >= 14 pt bold).
//
//   npx tsx scripts/reference/handcraft-meb5.tsx print     -> .spike/meb5-out/raw-sb.pdf, raw-wb.pdf, raw-cover.pdf
//   PRINT_DPI=150 npx tsx scripts/reference/handcraft-meb5.tsx preview -> .spike/meb5-out/onizleme.pdf
//   npx tsx scripts/reference/print-finish.mts --dir .spike/meb5-out raw-sb.pdf:student-book-ic.pdf raw-wb.pdf:workbook-ic.pdf raw-cover.pdf:kapak.pdf:cover
import path from "node:path";
import fs from "node:fs";
import React from "react";
import sharp from "sharp";
import { Document, Page, View, Text, Image, Font, Svg, Path, Circle, Line as SvgLine, Polygon, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { twemojiFileName, twemojiUrl } from "../../src/lib/activities";
import { cardSheetGrid } from "../../src/lib/ai/card-sheet";
import * as art from "./handcraft-meb5-art";
import { C } from "./handcraft-meb5-art";
import * as K from "./handcraft-meb5-content";
import { MM, W, H, BLEED, SLUG, LAST_ROW, cx, ce, ry, cells, B as B0, GRID, type Box, DPI, printPicture, dpiTable, sheetFigures } from "./print-kit";
// Every box edge within ~1 mm of a grid line (column edges and their 4 mm insets, the 2.5 mm
// units and their insets, the trim and bleed) is set exactly on it: no near misses at press check.
const GX = [0, W, -BLEED, W + BLEED, ...Array.from({ length: 12 }, (_, i) => cx(i + 1)).flatMap((l) => [l, l + GRID.col, l + 4 * MM, l + GRID.col - 4 * MM, l - 4 * MM, l + GRID.col + 4 * MM])];
const GY = [0, H, -BLEED, H + BLEED, ...Array.from({ length: 123 }, (_, i) => ry(i - 6)).flatMap((y) => [y, y + 4 * MM, y - 4 * MM])];
const snap = (v: number, lines: number[]) => {
  let best = v;
  let d = Infinity;
  for (const l of lines) if (Math.abs(v - l) < d) [d, best] = [Math.abs(v - l), l];
  return d > 0.2 && d <= 3.3 ? best : v;
};
const B = (x0: number, x1: number, y0: number, y1?: number): Box => {
  let [a, b] = [snap(x0, GX), snap(x1, GX)];
  if (b - a < 0.8 * (x1 - x0)) [a, b] = [x0, x1];
  let [c, d] = [snap(y0, GY), y1 === undefined ? undefined : snap(y1, GY)];
  if (y1 !== undefined && d! - c < 0.8 * (y1 - y0)) [c, d] = [y0, y1];
  return B0(a, b, c, d);
};

const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "Baloo", fonts: [{ src: path.join(FONTS, "Baloo2-Medium.ttf"), fontWeight: 500 }, { src: path.join(FONTS, "Baloo2-Bold.ttf"), fontWeight: 700 }] });
Font.register({ family: "Andika", fonts: [{ src: path.join(FONTS, "Andika-Regular.ttf"), fontWeight: 400 }, { src: path.join(FONTS, "Andika-Bold.ttf"), fontWeight: 700 }] });
Font.registerHyphenationCallback((w) => [w]);

const MODE = (process.argv[2] ?? "print") as "print" | "preview";
const OFF = MODE === "print" ? BLEED + SLUG : 0;
const OUT_DIR = path.join(process.cwd(), ".spike", "meb5-out");

// --- type and colour ----------------------------------------------------------------------------
const INK = C.navy;
const DARK = C.tealDark; // numbers, word boxes, labels
const RED = "#B83A20"; // dark coral: >= 14 pt bold only, and as a ground under white
const ANS = "#1F4FA8"; // worked examples (handwriting blue)
const BODY = 12;
const READ = 13; // reading texts
const LINE_H = 9 * MM; // write-on lines
const INSET = 4 * MM;
const FULL: Box = B(0, W, 0, H);
const TITLE = "Paper Kite";
const LEVEL = "5";
type Part = "sb" | "wb";

const a = (size = BODY, color: string = INK, weight: 400 | 700 = 400) => ({ fontFamily: "Andika", fontSize: size, color, fontWeight: weight, lineHeight: 1.28 });
const lab = (size = 9, color: string = DARK) => ({ fontFamily: "Andika", fontSize: size, color, fontWeight: 700 as const, lineHeight: 1.1, letterSpacing: 0.3, marginTop: -0.2 * size });
/**
 * Student's Book exercise numbers by id, in the order the pages render them
 * (the key and the audio-script headings ask by the same id, so adding an
 * exercise renumbers everything after it consistently).
 */
const EXNUM = new Map<string, number>();
const exN = (id: string) => {
  if (!EXNUM.has(id)) EXNUM.set(id, EXNUM.size + 1);
  return EXNUM.get(id)!;
};
/** Shift a one-line label up so its capitals sit centred in a tight box (Andika and Baloo carry tall ascenders). */
const LIFTA = (size: number) => -0.26 * size;
const LIFTB = (size: number) => -0.1 * size;
const Bo = ({ children, c }: { children: React.ReactNode; c?: string }) => <Text style={{ fontWeight: 700, ...(c ? { color: c } : {}) }}>{children}</Text>;

// --- bleed ----------------------------------------------------------------------------------------
type Edges = { l: number; r: number; t: number; b: number };
const ALL_EDGES: Edges = { l: BLEED, r: BLEED, t: BLEED, b: BLEED };
const EdgeCtx = React.createContext<Edges>(ALL_EDGES);
function grow(b: Box, e: Edges) {
  const h = b.h ?? 0;
  const L = b.x <= 0.01;
  const R = b.x + b.w >= W - 0.01;
  const T = b.y <= 0.01;
  const Bt = b.h !== undefined && b.y + h >= H - 0.01;
  return { x: b.x - (L ? e.l : 0), y: b.y - (T ? e.t : 0), w: b.w + (L ? e.l : 0) + (R ? e.r : 0), h: h + (T ? e.t : 0) + (Bt ? e.b : 0) };
}

// --- pictures (passes: collect frames, resample at DPI, embed) ------------------------------------
type Out = { data: Buffer; format: "png" | "jpg" };
type PicReq = { src: Buffer; w: number; h: number; opt: { fit: "cover" | "contain"; anchorX: number; anchorY: number; name?: string } };
const PIC_REQ = new Map<string, PicReq>();
const PIC_OUT = new Map<string, Out>();
const bufId = new WeakMap<Buffer, string>();
let bufN = 0;
const idOf = (b: Buffer) => {
  let id = bufId.get(b);
  if (!id) {
    id = `b${bufN++}`;
    bufId.set(b, id);
  }
  return id;
};
function Pic({ b, src, fit = "cover", ax = 0.5, ay = 0.5, r = 0, border, bw = 1.2, name }: { b: Box; src: Buffer; fit?: "cover" | "contain"; ax?: number; ay?: number; r?: number; border?: string; bw?: number; name?: string }) {
  const e = React.useContext(EdgeCtx);
  const g = grow(b, e);
  const key = `${idOf(src)}|${g.w.toFixed(2)}|${g.h.toFixed(2)}|${fit}|${ax}|${ay}`;
  const out = PIC_OUT.get(key);
  if (!out) PIC_REQ.set(key, { src, w: g.w, h: g.h, opt: { fit, anchorX: ax, anchorY: ay, name } });
  return (
    <View style={{ position: "absolute", left: g.x, top: g.y, width: g.w, height: g.h }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      {out ? <Image src={{ data: out.data, format: out.format }} style={{ width: g.w, height: g.h, borderRadius: r }} /> : null}
      {border ? <View style={{ position: "absolute", left: 0, top: 0, width: g.w, height: g.h, borderWidth: bw, borderColor: border, borderRadius: r }} /> : null}
    </View>
  );
}
/** A picture in the text flow (avatars, icons), resampled at its printed size. */
const FLOW_OUT = new Map<string, Out>();
const FLOW_REQ = new Map<string, { src: Buffer; d: number }>();
function FlowPic({ src, d }: { src: Buffer; d: number }) {
  const key = `${idOf(src)}|${d}`;
  const out = FLOW_OUT.get(key);
  if (!out) FLOW_REQ.set(key, { src, d });
  // eslint-disable-next-line jsx-a11y/alt-text
  return <View style={{ width: d, height: d }}>{out ? <Image src={{ data: out.data, format: out.format }} style={{ width: d, height: d }} /> : null}</View>;
}
const At = ({ b, children, style }: { b: Box; children?: React.ReactNode; style?: object }) => (
  <View style={{ position: "absolute", left: b.x, top: b.y, width: b.w, ...(b.h !== undefined ? { height: b.h } : {}), ...style }}>{children}</View>
);
function Fill({ b, color, r = 0, border, bw = 1.2, opacity, radii }: { b: Box; color: string; r?: number; border?: string; bw?: number; opacity?: number; radii?: object }) {
  const g = grow(b, React.useContext(EdgeCtx));
  return <View style={{ position: "absolute", left: g.x, top: g.y, width: g.w, height: g.h, backgroundColor: color, borderRadius: r, ...radii, ...(border ? { borderWidth: bw, borderColor: border } : {}), ...(opacity !== undefined ? { opacity } : {}) }} />;
}

// --- assets ---------------------------------------------------------------------------------------
const EMOJI_DIR = path.join(process.cwd(), ".handmade-meb5", "emoji");
const EM: Record<string, Buffer> = {};
async function loadEmoji(list: string[]) {
  fs.mkdirSync(EMOJI_DIR, { recursive: true });
  for (const e of list) {
    const file = path.join(EMOJI_DIR, `${twemojiFileName(e)}.png`);
    if (!fs.existsSync(file)) {
      const res = await fetch(twemojiUrl(e));
      if (!res.ok) throw new Error(`emoji ${e}: ${res.status}`);
      fs.writeFileSync(file, await sharp(Buffer.from(await res.arrayBuffer()), { density: 2400 }).resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
    }
    EM[e] = fs.readFileSync(file);
  }
}
const FLAGS: Record<string, string> = { "South Korea": "🇰🇷", Brazil: "🇧🇷", Kazakhstan: "🇰🇿", Australia: "🇦🇺" };
const GAME_EMOJI = { dice: "🎲", coin: "🪙" };
// Stand-in icons for the subject and object cards until the paid card sheets exist.
const SUBJECT_EMOJI: Record<string, string> = { Maths: "📐", Science: "🔬", Turkish: "📖", "Social Studies": "🌍", English: "💬", "P.E.": "⚽", Art: "🎨", Music: "🎵", IT: "💻", "Religion and Morals": "🕌" };
const OBJECT_EMOJI: Record<string, string> = { scissors: "✂️", notebook: "📓", ruler: "📏", crayons: "🖍️", "school bag": "🎒", glue: "🧴", rubber: "🧽", "pencil case": "👝", "board marker": "🖊️", "rubbish bin": "🗑️", "sheet of paper": "📄" };
const CAST_COLOUR: Record<K.CastKey, string> = { defne: "#F2B705", kerem: "#2F80ED", zehra: C.lilac, arda: C.leaf, can: "#F2994A", aksoy: C.teal };
/** Each character's name colour as text (dark enough on white). */
const CAST_TEXT: Record<K.CastKey, string> = { defne: "#8A5A00", kerem: "#1D5BB5", zehra: "#5B3FA0", arda: "#2E7031", can: "#A3500F", aksoy: C.tealDark };
const nameOf = (k: K.CastKey) => K.CAST.find((c) => c.key === k)!.name;
/** Small pictures of the cast for picture-poor pages (one sheet: handcraft-meb5-images.mts "vignettes"). */
const VIGNETTES = K.VIGNETTES.map((v) => v.key);

// The opening scene (fractions of the whole spread picture), measured on the generated picture.
// Nothing within 10 mm of the spine.
const SCENE = {
  // measured on scene.png (3840 x 1584): fractions of the whole picture
  tags: [
    { n: 1, x: 0.548, y: 0.175, label: "smart board" },
    { n: 2, x: 0.703, y: 0.105, label: "clock" },
    { n: 3, x: 0.768, y: 0.215, label: "flag" },
    { n: 4, x: 0.307, y: 0.16, label: "notice board" },
    { n: 5, x: 0.03, y: 0.24, label: "bookshelf" },
    { n: 6, x: 0.205, y: 0.262, label: "coat hooks" },
    { n: 7, x: 0.296, y: 0.555, label: "school bag" },
    { n: 8, x: 0.695, y: 0.53, label: "pencil case" },
  ],
  people: [
    { x: 0.095, y: 0.3, who: "Arda", colour: C.leaf },
    { x: 0.23, y: 0.3, who: "Defne", colour: "#F2B705" },
    { x: 0.34, y: 0.32, who: "Can", colour: "#F2994A" },
    { x: 0.795, y: 0.42, who: "Kerem", colour: "#2F80ED" },
    { x: 0.655, y: 0.24, who: "Ms Aksoy", colour: C.teal },
    { x: 0.93, y: 0.43, who: "Zehra", colour: C.lilac },
  ],
  clock: { x: 0.7275, y: 0.184, r: 0.0205 },
  // the part of the smart board on the right page (the board crosses the spine)
  board: { x0: 0.535, y0: 0.15, x1: 0.645, y1: 0.27 },
  // the inside of the small empty frame next to the flag
  portrait: { x0: 0.8365, y0: 0.146, x1: 0.8585, y1: 0.232 },
};
const SCENE_H = ry(64);
/** The speech bubbles, numbered in reading order: on the empty board and on the empty desks in front (never over a face or the clock). */
const SPREAD_BUBBLES: { i: number; page: "l" | "r"; b: Box; tail: Tail }[] = [
  { i: 0, page: "r", b: B(15 * MM, 54 * MM, 45 * MM), tail: "br" },
  { i: 1, page: "l", b: B(12 * MM, 70 * MM, 127 * MM), tail: "tl" },
  { i: 2, page: "l", b: B(76 * MM, 132 * MM, 127 * MM), tail: "tl" },
  { i: 3, page: "l", b: B(138 * MM, 196 * MM, 127 * MM), tail: "tl" },
  { i: 4, page: "r", b: B(140 * MM, 198 * MM, 128 * MM), tail: "tr" },
  { i: 5, page: "l", b: B(76 * MM, 136 * MM, 151 * MM), tail: "none" },
  { i: 6, page: "r", b: B(14 * MM, 68 * MM, 128 * MM), tail: "tr" },
  { i: 7, page: "r", b: B(76 * MM, 134 * MM, 128 * MM), tail: "tr" },
];
/** Story panel 4: the empty clock face (fractions of the panel, measured on story-4.png). */
const STORY_CLOCK_AT = { x: 0.056, y: 0.439, r: 0.043 };
/**
 * Story bubbles per panel, in speaking order: the box (fractions of the panel) and sx, the x of the
 * speaker's head measured on the picture, where the tail points. Every bubble sits above the heads.
 */
const STORY_BUBBLES: { x: number; y: number; w: number; sx: number }[][] = [
  [{ x: 0.03, y: 0.02, w: 0.45, sx: 0.577 }, { x: 0.5, y: 0.02, w: 0.47, sx: 0.743 }],
  [{ x: 0.03, y: 0.02, w: 0.94, sx: 0.47 }, { x: 0.03, y: 0.275, w: 0.41, sx: 0.31 }],
  [{ x: 0.03, y: 0.02, w: 0.62, sx: 0.53 }, { x: 0.68, y: 0.02, w: 0.29, sx: 0.76 }],
  [{ x: 0.13, y: 0.02, w: 0.5, sx: 0.54 }, { x: 0.65, y: 0.02, w: 0.32, sx: 0.86 }],
  [{ x: 0.03, y: 0.02, w: 0.94, sx: 0.87 }, { x: 0.03, y: 0.2, w: 0.72, sx: 0.27 }],
  [{ x: 0.03, y: 0.02, w: 0.58, sx: 0.47 }, { x: 0.63, y: 0.02, w: 0.34, sx: 0.62 }],
];

async function loadAssets() {
  await loadEmoji([...Object.values(SUBJECT_EMOJI), ...Object.values(OBJECT_EMOJI), ...Object.values(FLAGS), ...Object.values(GAME_EMOJI), ...K.RULE_ICONS, ...K.BOARD.flatMap((s) => (s.icon ? [s.icon] : []))]);
  const ph = art.placeholder;
  const cardSheet = async (name: string, n: number) => {
    if (!art.has(name)) return null;
    const g = cardSheetGrid(n);
    return sheetFigures(art.img(name), g.cols, g.rows, n);
  };
  const OBJECTS = [...K.EX16.cards, ...K.EXTRA_OBJECTS];
  const castFigs = await cardSheet("cast", K.CAST.length);
  const subjectFigs = await cardSheet("subjects", K.SUBJECTS.length);
  const objectFigs = await cardSheet("objects", OBJECTS.length);
  const clilFigs = await cardSheet("clil", K.CLIL_PICS.length);
  const vigs = await cardSheet("vignettes", VIGNETTES.length);
  // read once: the picture cache knows a picture by its buffer
  const storyImgs = K.STORY.map((_, i) => (art.has(`story-${i + 1}`) ? art.img(`story-${i + 1}`) : null));
  const sceneW = 2 * W + 2 * BLEED;
  const sceneH = SCENE_H + BLEED;
  const sceneSrc = art.has("scene") ? art.img("scene") : await art.scenePlaceholder(sceneW, sceneH, SCENE.tags, SCENE.people);
  const scene = await art.splitSpread(art.has("scene") ? "img" : "ph", sceneSrc, W, BLEED, sceneH);
  const avatars = Object.fromEntries(
    await Promise.all(K.CAST.map(async (c, i) => [c.key, castFigs ? await art.circleCrop(`cast4-${c.key}`, castFigs[i], 60 * art.PX, CAST_COLOUR[c.key], { top: 0, zoom: 1.5 }) : await art.avatarPlaceholder(c.key, 60, CAST_COLOUR[c.key])])),
  ) as Record<K.CastKey, Buffer>;
  return {
    castFigs,
    avatars,
    scene,
    portrait: art.has("portrait") ? art.img("portrait") : null,
    opener: art.has("opener") ? art.img("opener") : await ph("opener", W, ry(46), "PICTURE TO COME: Yeşiltepe Lower Secondary School on a sunny morning - the friends arrive at the gate, the Turkish flag on the pole", "#CDEBFA"),
    story: (i: number) => storyImgs[i],
    cover: art.has("cover") ? art.img("cover") : await ph("cover", W, H, "COVER PICTURE TO COME: the friends fly a big paper kite in front of their school", "#BDE3F6"),
    wbCover: art.has("cover") ? art.img("cover") : await ph("wbcover", W, H, "COVER PICTURE TO COME", "#FFD9CF"),
    subject: (s: string) => (subjectFigs ? subjectFigs[K.SUBJECTS.indexOf(s as (typeof K.SUBJECTS)[number])] : EM[SUBJECT_EMOJI[s]]),
    object: (s: string) => (objectFigs ? objectFigs[OBJECTS.indexOf(s as (typeof OBJECTS)[number])] : EM[OBJECT_EMOJI[s]]),
    clil: (i: number, w: number, h: number) => (clilFigs ? Promise.resolve(clilFigs[i]) : ph(`clil-${i}`, w, h, `PICTURE ${i + 1}: ${K.CLIL_PICS[i].desc}`, "#E7F5E5")),
    flag: (c: string) => EM[FLAGS[c]],
    game: (k: keyof typeof GAME_EMOJI) => EM[GAME_EMOJI[k]],
    emoji: (e: string) => EM[e],
    rule: (i: number) => EM[K.RULE_ICONS[i]],
    vignette: (k: string) => (vigs ? vigs[VIGNETTES.indexOf(k)] : null),
  };
}
type Assets = Awaited<ReturnType<typeof loadAssets>>;
let A: Assets;
// Async artwork the pages ask for by key, prepared between render passes.
const ARTS = new Map<string, Buffer>();
const ART_JOBS = new Map<string, () => Promise<Buffer>>();
function ArtPic({ id, b, make, fit = "cover", ax, ay, r, border, name }: { id: string; b: Box; make: () => Promise<Buffer>; fit?: "cover" | "contain"; ax?: number; ay?: number; r?: number; border?: string; name?: string }) {
  const buf = ARTS.get(id);
  if (!buf) ART_JOBS.set(id, make);
  return buf ? <Pic b={b} src={buf} fit={fit} ax={ax} ay={ay} r={r} border={border} name={name ?? id} /> : null;
}

// --- vector clock (numerals as PDF text) -----------------------------------------------------------
function Clock({ b, time, rim = C.teal, numerals = true }: { b: Box; time: string; rim?: string; numerals?: boolean }) {
  const d = Math.min(b.w, b.h!);
  const x0 = b.x + (b.w - d) / 2;
  const y0 = b.y + (b.h! - d) / 2;
  const R = d / 2;
  const r = R * 0.88;
  const c = R;
  const pt = (an: number, rr: number) => [c + Math.sin(an) * rr, c - Math.cos(an) * rr];
  let hands: React.ReactNode = null;
  if (time) {
    const [h, m] = time.split(":").map(Number);
    const ma = (m / 60) * 2 * Math.PI;
    const ha = (((h % 12) + m / 60) / 12) * 2 * Math.PI;
    const [hx, hy] = pt(ha, r * 0.5);
    const [mx, my] = pt(ma, r * 0.78);
    hands = (
      <>
        <SvgLine x1={c} y1={c} x2={hx} y2={hy} stroke={INK} strokeWidth={Math.max(1.6, r * 0.09)} strokeLinecap="round" />
        <SvgLine x1={c} y1={c} x2={mx} y2={my} stroke={INK} strokeWidth={Math.max(1.1, r * 0.055)} strokeLinecap="round" />
      </>
    );
  }
  // small clocks (teacher pages) get smaller numerals so 11 and 12 keep apart; children's clocks stay >= 9 pt
  const fs = r < 34 ? r * 0.22 : Math.max(9, r * 0.2);
  return (
    <>
      <At b={B0(x0, x0 + d, y0, y0 + d)}>
        <Svg width={d} height={d}>
          <Circle cx={c} cy={c} r={R} fill={rim} />
          <Circle cx={c} cy={c} r={r} fill="#ffffff" />
          {Array.from({ length: 60 }, (_, i) => {
            const an = (i / 60) * 2 * Math.PI;
            const long = i % 5 === 0;
            const [ax1, ay1] = pt(an, r * (long ? 0.85 : 0.91));
            const [ax2, ay2] = pt(an, r * 0.97);
            return <SvgLine key={i} x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke={long ? INK : "#7C8698"} strokeWidth={long ? 1 : 0.5} />;
          })}
          {hands}
          <Circle cx={c} cy={c} r={Math.max(1.6, r * 0.07)} fill={INK} />
        </Svg>
      </At>
      {numerals
        ? Array.from({ length: 12 }, (_, i) => {
            const [nx, ny] = pt(((i + 1) / 12) * 2 * Math.PI, r * 0.69);
            return (
              <At key={i} b={B0(x0 + nx - fs, x0 + nx + fs, y0 + ny - fs * 0.86)}>
                <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: fs, color: INK, textAlign: "center", lineHeight: 1 }}>{i + 1}</Text>
              </At>
            );
          })
        : null}
    </>
  );
}

// --- furniture -------------------------------------------------------------------------------------
function Star({ n = 1 }: { n?: 1 | 2 }) {
  const s = 10;
  const pts = (ox: number) =>
    Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 ? s * 0.22 : s * 0.5;
      const an = (i / 10) * 2 * Math.PI - Math.PI / 2;
      return `${ox + s / 2 + Math.cos(an) * r},${s / 2 + Math.sin(an) * r}`;
    }).join(" ");
  return (
    <Svg width={s * n + (n - 1)} height={s}>
      {Array.from({ length: n }, (_, i) => (
        <Polygon key={i} points={pts(i * (s + 1))} fill={C.sun} stroke="#9A6B00" strokeWidth={0.6} />
      ))}
    </Svg>
  );
}
function Headphones({ color = "#fff", s = 9 }: { color?: string; s?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24">
      <Path d="M4 14 V12 A8 8 0 0 1 20 12 V14" stroke={color} strokeWidth={2.6} fill="none" />
      <Path d="M3 14 H7 V21 H3 Z M17 14 H21 V21 H17 Z" fill={color} />
    </Svg>
  );
}
function AudioTag({ track }: { track: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: DARK, borderRadius: 7, paddingHorizontal: 5, height: 16, marginRight: 5, marginTop: 0.5 }}>
      <Headphones />
      <Text style={{ ...lab(9.5, "#fff"), marginLeft: 3 }}>{track}</Text>
    </View>
  );
}
function StarTag({ n }: { n: 1 | 2 }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.sunTint, borderRadius: 7, borderWidth: 0.8, borderColor: "#C98A00", paddingHorizontal: 4, height: 16, marginRight: 5, marginTop: 0.5 }}>
      <Star n={n} />
    </View>
  );
}
/** An exercise heading: number disc, optional audio and star tags, the rubric bold 12 pt with a hanging indent. */
function Ex({ n, children, audio, stars }: { n: number | string; children: React.ReactNode; audio?: string; stars?: 1 | 2 }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 5 }} wrap={false}>
      <View style={{ width: 19, height: 19, borderRadius: 9.5, backgroundColor: RED, alignItems: "center", justifyContent: "center", marginRight: 6 }}>
        <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: String(n).length > 1 ? 10 : 11.5, color: "#fff", lineHeight: 1, marginTop: LIFTA(11) }}>{n}</Text>
      </View>
      {audio ? <AudioTag track={audio} /> : null}
      {stars ? <StarTag n={stars} /> : null}
      <Text style={{ ...a(12, INK, 700), flex: 1, paddingTop: 1, lineHeight: 1.25 }}>{children}</Text>
    </View>
  );
}
const ExampleTag = () => (
  <View style={{ backgroundColor: C.sun, borderRadius: 6, paddingHorizontal: 3.4, height: 15, justifyContent: "center", marginRight: 11.2, marginTop: 1 }}>
    <Text style={lab(9, INK)}>EXAMPLE</Text>
  </View>
);
const Num = ({ n, w = 18 }: { n: React.ReactNode; w?: number }) => <Text style={{ ...a(12, DARK, 700), width: w }}>{n}</Text>;
/** One numbered row whose height leaves room to write (>= 9 mm). */
function Row({ n, children, h = LINE_H, ex }: { n?: React.ReactNode; children: React.ReactNode; h?: number; ex?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", minHeight: h, paddingBottom: 1 }} wrap={false}>
      {ex ? <ExampleTag /> : <Num n={n} />}
      <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap" }}>{children}</View>
    </View>
  );
}
const T = ({ children, size = BODY, color = INK, bold }: { children: React.ReactNode; size?: number; color?: string; bold?: boolean }) => <Text style={a(size, color, bold ? 700 : 400)}>{children}</Text>;
/**
 * A string as one Text per word, for rows that mix words, write-on lines
 * and pills: the row then wraps word by word (a single Text block would jump
 * to the next line whole), and spaces at the edges are kept as gaps.
 */
function Ws({ s, size = BODY, color = INK, bold }: { s: string; size?: number; color?: string; bold?: boolean }) {
  const lead = /^\s/.test(s);
  const trail = /\s$/.test(s);
  const words = s.trim().split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((w, i) => (
        <Text key={i} style={{ ...a(size, color, bold ? 700 : 400), marginLeft: i === 0 && lead ? 3.3 : 0, marginRight: i < words.length - 1 || trail ? 3.3 : 0 }}>
          {w}
        </Text>
      ))}
    </>
  );
}
/** "There (is / isn't) a ..." - the options as pills >= 3 mm apart; the example has its answer circled. */
function Choice({ parts, answer, size = BODY }: { parts: readonly (string | readonly string[])[]; answer?: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          p.trim() ? <Ws key={i} s={p} size={size} /> : null
        ) : (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 3 }}>
            {p.map((o, j) => (
              <React.Fragment key={j}>
                {j ? <Text style={{ ...a(size, DARK), marginHorizontal: 4.5 }}>/</Text> : null}
                <View style={{ borderWidth: 1.4, borderColor: answer === j ? ANS : "#ffffff", borderRadius: 9, paddingHorizontal: 3.5 }}>
                  <Text style={a(size, INK, 700)}>{o}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        ),
      )}
    </View>
  );
}
/** A write-on line: solid 0.5 pt, >= 9 mm tall; the example answer handwritten on it. */
function Line({ w, children, h = LINE_H }: { w?: number | string; children?: React.ReactNode; h?: number }) {
  return (
    <View style={{ width: w ?? "100%", height: h, borderBottomWidth: 0.6, borderBottomColor: "#9AA3B5", justifyContent: "flex-end", paddingLeft: 3, paddingBottom: 1.5 }}>
      {children ? <Text style={{ ...a(12, ANS, 700), lineHeight: 1, marginTop: LIFTA(12) }}>{children}</Text> : null}
    </View>
  );
}
/** A letter/number box: >= 7 x 8 mm. */
function WriteBox({ w = 8 * MM, children }: { w?: number; children?: React.ReactNode }) {
  return (
    <View style={{ width: w, height: 8 * MM, borderWidth: 1, borderColor: DARK, borderRadius: 3, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
      {children ? <Text style={{ ...a(12, ANS, 700), lineHeight: 1, marginTop: LIFTA(12) }}>{children}</Text> : null}
    </View>
  );
}
function Tick({ on, size = 13 }: { on?: boolean; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderWidth: 1.1, borderColor: DARK, borderRadius: 2.5, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
      {on ? (
        <Svg width={size * 0.8} height={size * 0.8} viewBox="0 0 10 10">
          <Path d="M1.5 5.5 L4 8 L8.5 2" stroke={ANS} strokeWidth={1.6} fill="none" />
        </Svg>
      ) : null}
    </View>
  );
}
function Arrow({ up, color = RED, s = 11 }: { up: boolean; color?: string; s?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 10 10">
      {up ? <Path d="M1 9 L8 2 M4 2 H8 V6" stroke={color} strokeWidth={1.4} fill="none" /> : <Path d="M1 1 L8 8 M4 8 H8 V4" stroke={color} strokeWidth={1.4} fill="none" />}
    </Svg>
  );
}
/** The stress mark: a dot over the word you say strongly. */
const StressDot = ({ color = RED }: { color?: string }) => (
  <Svg width={8} height={8}>
    <Circle cx={4} cy={4} r={3.2} fill={color} />
  </Svg>
);
/** A sentence with a stress dot over its negative word and ↘ after its last word (marks = false: empty places to draw them). */
function Intonation({ s, marks = true }: { s: string; marks?: boolean }) {
  const words = s.split(" ");
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }}>
      {words.map((w, i) => {
        const neg = K.NEGATIVES.some((n) => w.toLowerCase().replace(/[.!?,]/g, "") === n);
        const last = i === words.length - 1;
        return (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-end", marginRight: 3.5 }}>
            <View style={{ alignItems: "center" }}>
              <View style={{ height: 10, justifyContent: "center" }}>{marks && neg ? <StressDot /> : null}</View>
              <Text style={a(BODY, INK, neg && marks ? 700 : 400)}>{w}</Text>
            </View>
            {last ? <View style={{ marginLeft: 2, marginBottom: 3, width: 11, height: 11, borderBottomWidth: marks ? 0 : 0.6, borderBottomColor: "#9AA3B5" }}>{marks ? <Arrow up={false} color={DARK} /> : null}</View> : null}
          </View>
        );
      })}
    </View>
  );
}
function Panel({ b, color = C.tealTint, border, title, titleColor = DARK, children, r = 8 }: { b: Box; color?: string; border?: string; title?: string; titleColor?: string; children?: React.ReactNode; r?: number }) {
  return (
    <>
      <Fill b={b} color={color} r={r} border={border} bw={1.2} />
      {title ? (
        <At b={B(b.x + INSET, b.x + b.w, b.y - 8)}>
          <View style={{ alignSelf: "flex-start", backgroundColor: titleColor, borderRadius: 8, paddingHorizontal: 8, height: 17, justifyContent: "center" }}>
            <Text style={lab(11, "#fff")}>{title}</Text>
          </View>
        </At>
      ) : null}
      <At b={B(b.x + INSET, b.x + b.w - INSET, b.y + (title ? 11 : INSET), b.y + (b.h ?? 0) - INSET)}>{children}</At>
    </>
  );
}
type Tail = "bl" | "br" | "tl" | "tr" | "none";
function Bubble({ b, children, border = INK, tail = "bl", num }: { b: Box; children: React.ReactNode; border?: string; tail?: Tail; num?: number }) {
  return (
    <At b={b}>
      <BubbleBody border={border} tail={tail} num={num}>
        {children}
      </BubbleBody>
    </At>
  );
}
/** A speech bubble in the flow (the story lays its bubbles out side by side, so they never overlap). */
function BubbleBody({ children, border = INK, tail = "bl", num, tailX }: { children: React.ReactNode; border?: string; tail?: Tail; num?: number; tailX?: number }) {
  const tailStyle =
    tail === "none" ? null : { position: "absolute" as const, width: 10, height: 10, backgroundColor: "#fff", borderColor: border, transform: "rotate(45deg)", ...(tail[0] === "b" ? { bottom: -5.5, borderBottomWidth: 1.3, borderRightWidth: 1.3 } : { top: -5.5, borderTopWidth: 1.3, borderLeftWidth: 1.3 }), ...(tailX !== undefined ? { left: tailX } : tail[1] === "l" ? { left: 14 } : { right: 14 }) };
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff", borderWidth: 1.3, borderColor: border, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4 }}>
        {tailStyle ? <View style={tailStyle} /> : null}
        {num !== undefined ? (
          <View style={{ width: 15, height: 15, borderRadius: 7.5, backgroundColor: INK, alignItems: "center", justifyContent: "center", marginRight: 4, marginTop: 1 }}>
            <Text style={{ ...a(9.5, "#fff", 700), lineHeight: 1, marginTop: LIFTA(9.5) }}>{num}</Text>
          </View>
        ) : null}
        <Text style={{ ...a(BODY), lineHeight: 1.22, flex: 1 }}>{children}</Text>
      </View>
    </>
  );
}
const Speaker =({ who }: { who: K.CastKey }) => <Text style={{ fontWeight: 700, color: CAST_TEXT[who] }}>{nameOf(who)}: </Text>;
/** A model dialogue line: avatar + bubble (in the flow; the bubble takes the rest of the row and wraps). */
function Say({ who, children, right }: { who: K.CastKey; children: React.ReactNode; right?: boolean }) {
  return (
    <View style={{ flexDirection: right ? "row-reverse" : "row", alignItems: "center", marginBottom: 5 }} wrap={false}>
      <FlowPic src={A.avatars[who]} d={28} />
      <View style={{ marginHorizontal: 6, flex: 1, backgroundColor: right ? C.tealTint : "#fff", borderWidth: 1, borderColor: right ? C.teal : C.coral, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3.5 }}>
        <Text style={{ ...a(BODY), lineHeight: 1.2, textAlign: right ? "right" : "left" }}>{children}</Text>
      </View>
    </View>
  );
}
function WordBox({ words, struck, ml = 25 }: { words: string[]; struck?: string; ml?: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: ml, marginBottom: 4 }}>
      {words.map((w) => (
        <View key={w} style={{ borderWidth: 1, borderColor: C.teal, borderRadius: 8, paddingHorizontal: 7, height: 22, justifyContent: "center", marginRight: 6, marginBottom: 3, backgroundColor: w === struck ? C.tealTint : "#fff" }}>
          <Text style={{ ...a(BODY, DARK, 700), lineHeight: 1, marginTop: LIFTA(BODY), textDecoration: w === struck ? "line-through" : "none" }}>{w}</Text>
        </View>
      ))}
    </View>
  );
}
// --- lesson header and footer -----------------------------------------------------------------
const HEAD_H = 5; // units
function LessonHead({ n, title, skills, y = 0, part = "sb" }: { n: number | string; title: string; skills: string[]; y?: number; part?: Part }) {
  const col = part === "sb" ? C.teal : C.coral;
  return (
    <>
      <At b={B(cx(1), ce(12), ry(y), ry(y + HEAD_H))}>
        <View style={{ flexDirection: "row", alignItems: "center", height: "100%" }}>
          <View style={{ width: 32, height: 32, borderRadius: 7, backgroundColor: DARK, alignItems: "center", justifyContent: "center", marginRight: 9 }}>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: String(n).length > 2 ? 12 : 18, color: "#fff", lineHeight: 1, marginTop: LIFTB(String(n).length > 2 ? 12 : 18) }}>{n}</Text>
          </View>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 24, color: part === "sb" ? DARK : RED, lineHeight: 1, marginTop: LIFTB(24), flex: 1 }}>{title}</Text>
          {skills.map((s) => (
            <View key={s} style={{ borderWidth: 1, borderColor: col, borderRadius: 8, paddingHorizontal: 6, height: 17, justifyContent: "center", marginLeft: 5 }}>
              <Text style={lab(9, part === "sb" ? DARK : RED)}>{s.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </At>
      <Fill b={B(cx(1), ce(12), ry(y + HEAD_H) + 1, ry(y + HEAD_H) + 2.2)} color={col} />
    </>
  );
}
const FOOT_Y = ry(LAST_ROW) + 2 * MM;
const FOOT_H = 6 * MM;
function Footer({ n, part }: { n: number; part: Part }) {
  const right = n % 2 === 1;
  const ground = part === "sb" ? DARK : RED;
  const label = part === "sb" ? "UNIT 2 · OUR CLASSROOM" : "WORKBOOK · UNIT 2 · OUR CLASSROOM";
  const num = right ? B(ce(12) - 6 * MM, W, FOOT_Y, FOOT_Y + FOOT_H) : B(0, cx(1) + 6 * MM, FOOT_Y, FOOT_Y + FOOT_H);
  return (
    <>
      <Fill b={num} color={ground} radii={right ? { borderTopLeftRadius: 9, borderBottomLeftRadius: 9 } : { borderTopRightRadius: 9, borderBottomRightRadius: 9 }} />
      <At b={num}>
        <View style={{ height: "100%", justifyContent: "center", alignItems: right ? "flex-start" : "flex-end", paddingHorizontal: 2.2 * MM }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 12, color: "#fff", lineHeight: 1, marginTop: LIFTB(12) }}>{n}</Text>
        </View>
      </At>
      <At b={right ? B(cx(5), ce(12) - 8 * MM, FOOT_Y, FOOT_Y + FOOT_H) : B(cx(1) + 8 * MM, ce(8), FOOT_Y, FOOT_Y + FOOT_H)}>
        <View style={{ height: "100%", justifyContent: "center", alignItems: right ? "flex-end" : "flex-start" }}>
          <Text style={lab(9, ground)}>{label}</Text>
        </View>
      </At>
    </>
  );
}

// --- the sheet ------------------------------------------------------------------------------------
const SlugCtx = React.createContext<string>("");
function CropMarks({ pw, ph, xs, ys, dashed = [] }: { pw: number; ph: number; xs: number[]; ys: number[]; dashed?: number[] }) {
  const end = OFF - BLEED;
  const S = 0.25;
  const len = end - 1 * MM;
  const k = (s: object, i: string) => <View key={i} style={{ position: "absolute", backgroundColor: "#000000", ...s }} />;
  const vert = (x: number, y0: number, i: string, dash: boolean) =>
    dash ? Array.from({ length: Math.floor(len / (3.5 * MM)) }, (_, j) => k({ left: x - S / 2, top: y0 + j * 3.5 * MM, width: S, height: 2 * MM }, `${i}-${j}`)) : [k({ left: x - S / 2, top: y0, width: S, height: len }, i)];
  return (
    <>
      {xs.flatMap((x) => [...vert(x, 1 * MM, `t${x}`, dashed.includes(x)), ...vert(x, ph - end, `b${x}`, dashed.includes(x))])}
      {ys.flatMap((y) => [k({ left: 1 * MM, top: y - S / 2, width: len, height: S }, `l${y}`), k({ left: pw - end, top: y - S / 2, width: len, height: S }, `r${y}`)])}
    </>
  );
}
function Sheet({ children }: { children: React.ReactNode }) {
  const label = React.useContext(SlugCtx);
  const pw = W + 2 * OFF;
  const ph = H + 2 * OFF;
  return (
    <Page size={[pw, ph]} style={{ backgroundColor: "#ffffff", fontFamily: "Andika" }}>
      <View style={{ position: "absolute", left: OFF, top: OFF, width: W, height: H }}>{children}</View>
      {MODE === "print" ? (
        <>
          <CropMarks pw={pw} ph={ph} xs={[OFF, OFF + W]} ys={[OFF, OFF + H]} />
          <Text style={{ position: "absolute", left: OFF, top: OFF + H + BLEED + 2 * MM, fontFamily: "Andika", fontSize: 6, color: "#000000" }}>{label}</Text>
        </>
      ) : null}
    </Page>
  );
}
function BookPage({ children, n, part = "sb", bg }: { children: React.ReactNode; n?: number; part?: Part; bg?: string }) {
  return (
    <Sheet>
      {bg ? <Fill b={FULL} color={bg} /> : null}
      {children}
      {n ? <Footer n={n} part={part} /> : null}
    </Sheet>
  );
}
const IMPRINT = (part: Part) =>
  `${TITLE} ${LEVEL} · ${part === "sb" ? "Student's Book" : "Workbook"} · Unit 2 "Our Classroom" · First edition, 2026. This unit follows the English curriculum for Year 5 of the Türkiye Yüzyılı Maarif Modeli, Theme 2 "Classroom Life". Text, exercises, characters, illustrations and design: ${TITLE} editorial and design team. Fonts: Baloo 2 and Andika (SIL Open Font License). Flag and game icons: Twemoji (CC-BY 4.0).${part === "sb" ? " Portrait of Atatürk (p. 5): photograph of 1932, unknown author, public domain in Türkiye (PD-TR), via Wikimedia Commons, File:Ataturk1930s.jpg." : ""} All rights reserved.`;

// ================================================================================================
// STUDENT'S BOOK
// ================================================================================================
function SbTitle() {
  const g = cells(cx(1), ce(12), 3, 6 * MM);
  return (
    <BookPage>
      <Fill b={B(0, W, 0, ry(42))} color={C.tealTint} />
      <ArtPic id="kite-title" b={B(cx(1), ce(3), ry(3), ry(36))} make={() => art.kite("title", ce(3) - cx(1), ry(36) - ry(3))} fit="contain" />
      <At b={B(cx(4), ce(12), ry(5))}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 60, color: DARK, lineHeight: 1 }}>
          {TITLE} <Text style={{ color: RED }}>{LEVEL}</Text>
        </Text>
        <Text style={{ fontFamily: "Baloo", fontWeight: 500, fontSize: 19, color: INK, marginTop: 10 }}>English for Year 5</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
          <View style={{ backgroundColor: RED, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 18, color: "#fff", lineHeight: 1.1, marginTop: LIFTB(18) }}>Student&apos;s Book</Text>
          </View>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 20, color: DARK, marginLeft: 12, marginTop: 4 }}>Unit 2 · Our Classroom</Text>
        </View>
      </At>
      <At b={B(cx(1), ce(12), ry(46))}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 26, color: RED, lineHeight: 1 }}>Meet 5/C</Text>
      </At>
      {K.CAST.map((c, i) => {
        const x = g.at(i % 3);
        const y = ry(53 + Math.floor(i / 3) * 16);
        return (
          <React.Fragment key={c.key}>
            <Pic b={B(x, x + 24 * MM, y, y + 24 * MM)} src={A.avatars[c.key]} fit="contain" name={`avatar ${c.name}`} />
            <At b={B(x + 26 * MM, x + g.w, y + 2 * MM)}>
              <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 16, color: CAST_TEXT[c.key], lineHeight: 1.1 }}>{c.name}</Text>
              <Text style={a(BODY)}>
                {c.key === "aksoy" ? "She " : c.key === "can" || c.key === "kerem" || c.key === "arda" ? "He " : "She "}
                {c.line}
              </Text>
            </At>
          </React.Fragment>
        );
      })}
      <At b={B(cx(1), ce(12), ry(89))}>
        <View style={{ borderTopWidth: 0.6, borderTopColor: "#9AA3B5", paddingTop: 6 }}>
          <Text style={{ ...a(11, "#3F4A63"), lineHeight: 1.3 }}>{IMPRINT("sb")}</Text>
        </View>
      </At>
    </BookPage>
  );
}

const CONTENTS: [string, string, string, string][] = [
  ["Unit opener", "3", "What I will learn · a warm-up game", "THEME 2"],
  ["Get Ready!", "4–5", "A new classmate · The Week Chant · class rules", "LISTENING · READING"],
  ["1  Listen and Look", "6–7", "Telling the time · our timetable", "LISTENING · SPEAKING"],
  ["2  Say It Right", "8", "Negative sentences", "PRONUNCIATION"],
  ["3  Word Bank", "8–10", "Subjects · days · numbers 50–100 · objects", "VOCABULARY"],
  ["4  Game Time: Who am I?", "10", "Riddles · a classroom rhyme", "SPEAKING"],
  ["5  Grammar Spot", "11–12", "There is / are · him, her · has, does", "LANGUAGE IN USE"],
  ["6  Game Time: Classroom Race", "13", "A board game", "SPEAKING"],
  ["7  Read", "14", "Can's blog · our class helpers", "READING"],
  ["8  Write", "15", "What time do you get up?", "WRITING · SPEAKING"],
  ["9  Around the World", "16", "School days in four countries", "CLIL & CULTURE"],
  ["10  Story Time", "17–18", "The Tidy Robot · act it out", "READING · LISTENING"],
  ["11  Project", "18", "A class guide for a new student", "PROJECT"],
  ["12  Check Yourself", "19", "Mini test · I can ...", "SELF-ASSESSMENT"],
  ["Word List", "20", "English · Türkçe", ""],
];
function SbContents() {
  const top = 9;
  const rowH = 5.2;
  const cols: [string, number][] = [["LESSON", 57], ["PAGE", 15], ["WHAT I LEARN", 76], ["SKILLS", 36]];
  return (
    <BookPage n={2}>
      <At b={B(cx(1), ce(12), ry(0))}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 30, color: DARK, lineHeight: 1 }}>Contents</Text>
      </At>
      <Fill b={B(cx(1), ce(12), ry(top - 3), ry(top))} color={DARK} r={4} />
      <At b={B(cx(1) + 2 * MM, ce(12), ry(top - 3), ry(top))}>
        <View style={{ flexDirection: "row", height: "100%", alignItems: "center" }}>
          {cols.map(([h, w]) => (
            <Text key={h} style={{ ...lab(9, "#fff"), width: w * MM }}>{h}</Text>
          ))}
        </View>
      </At>
      {CONTENTS.map(([l, p, w, s], i) => (
        <React.Fragment key={l}>
          {i % 2 === 0 ? <Fill b={B(cx(1), ce(12), ry(top + i * rowH), ry(top + (i + 1) * rowH))} color={C.tealTint} /> : null}
          <At b={B(cx(1) + 2 * MM, ce(12), ry(top + i * rowH), ry(top + (i + 1) * rowH))}>
            <View style={{ flexDirection: "row", height: "100%", alignItems: "center" }}>
              <Text style={{ ...a(12, DARK, 700), width: cols[0][1] * MM }}>{l}</Text>
              <Text style={{ ...a(12, INK, 700), width: cols[1][1] * MM }}>{p}</Text>
              <Text style={{ ...a(12), width: cols[2][1] * MM, paddingRight: 8 }}>{w}</Text>
              <Text style={{ ...lab(9, "#3F4A63"), width: cols[3][1] * MM }}>{s}</Text>
            </View>
          </At>
        </React.Fragment>
      ))}
      <Panel b={B(cx(1), ce(12), ry(90), ry(106))} color={C.sunTint} title="SYMBOLS IN THIS BOOK" titleColor="#8A5A00">
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 4 }}>
            <AudioTag track="2.01" />
            <Text style={{ ...a(BODY), flex: 1, lineHeight: 1.15 }}>Listen to track 2.01. No audio? Your teacher reads it.</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", width: "50%", marginBottom: 4 }}>
            <ExampleTag />
            <T>The first answer is done.</T>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", width: "50%" }}>
            <StarTag n={1} />
            <T>For everybody.</T>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", width: "50%" }}>
            <StarTag n={2} />
            <T>A little more challenge.</T>
          </View>
        </View>
      </Panel>
    </BookPage>
  );
}

const GOALS = ["say the names of my school subjects", "tell the time and ask \"What time does ... start?\"", "read a timetable and talk about my week", "say what there is in my classroom", "count from 50 to 100", "follow our class rules and help a friend"];
function SbOpener() {
  return (
    <BookPage n={3}>
      <Pic b={B(0, W, 0, ry(46))} src={A.opener} name="unit opener" ay={0.6} />
      <At b={B(cx(1), ce(6), ry(1))}>
        <View style={{ alignSelf: "flex-start", backgroundColor: RED, borderRadius: 14, paddingHorizontal: 11, height: 30, justifyContent: "center", borderWidth: 2, borderColor: "#fff" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 19, color: "#fff", lineHeight: 1, marginTop: LIFTB(19) }}>UNIT 2</Text>
        </View>
      </At>
      <Fill b={B(0, W, ry(46), ry(58))} color={DARK} />
      <At b={B(cx(1), ce(12), ry(46), ry(58))}>
        <View style={{ height: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 42, color: "#fff", lineHeight: 1, marginTop: LIFTB(42) }}>Our Classroom</Text>
          <Text style={{ fontFamily: "Baloo", fontWeight: 500, fontSize: 15, color: "#fff", lineHeight: 1, marginTop: LIFTB(15) }}>Theme 2 · Classroom Life</Text>
        </View>
      </At>
      <At b={B(cx(1), ce(7), ry(61))}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 19, color: RED, lineHeight: 1.1 }}>In this unit, I will ...</Text>
        {GOALS.map((g, i) => (
          <View key={g} style={{ flexDirection: "row", alignItems: "center", marginTop: 7 }}>
            <View style={{ width: 17, height: 17, borderRadius: 8.5, backgroundColor: [C.teal, C.coral, "#F2B705", C.lilac, C.leaf, "#2F80ED"][i], alignItems: "center", justifyContent: "center", marginRight: 7 }}>
              <Svg width={10} height={10} viewBox="0 0 10 10">
                <Path d="M1.5 5.5 L4 8 L8.5 2" stroke="#fff" strokeWidth={1.8} fill="none" />
              </Svg>
            </View>
            <Text style={a(13)}>{g}</Text>
          </View>
        ))}
      </At>
      <Panel b={B(cx(8), ce(12), ry(62), ry(89))} color={C.sunTint} border="#E2B33A" title="WARM-UP GAME" titleColor="#8A5A00">
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 16, color: INK, lineHeight: 1.1 }}>Simon says ...</Text>
        <Text style={{ ...a(BODY), marginTop: 3 }}>Do it only when you hear &quot;Simon says&quot;!</Text>
        {["Simon says: stand up!", "Simon says: raise your hand!", "Simon says: point to the clock!", "Sit down!  (Don't move!)"].map((s) => (
          <Text key={s} style={{ ...a(BODY, DARK, 700), marginTop: 4 }}>
            • {s}
          </Text>
        ))}
      </Panel>
      <Panel b={B(cx(8), ce(12), ry(92), ry(101))} color={C.coralTint}>
        <Text style={{ ...a(BODY, INK, 700), lineHeight: 1.2 }}>Be a good classmate: give a friend a hand!</Text>
      </Panel>
    </BookPage>
  );
}

// --- pp. 4–5: the opening scene --------------------------------------------------------------------
const SPINE_GAP = 10 * MM;
function scenePt(fx: number, fy: number, page: "l" | "r") {
  const sx = fx * (2 * W + 2 * BLEED) - BLEED;
  const y = fy * (SCENE_H + BLEED) - BLEED;
  return { x: page === "l" ? sx : sx - W, y };
}
const onPage = (x: number, page: "l" | "r") => x > (page === "l" ? 6 * MM : SPINE_GAP) && x < W - (page === "l" ? SPINE_GAP : 6 * MM);
function SceneTags({ page }: { page: "l" | "r" }) {
  return (
    <>
      {SCENE.tags.map((tg) => {
        const p = scenePt(tg.x, tg.y, page);
        if (!onPage(p.x, page)) return null;
        return (
          <At key={tg.n} b={B(p.x - 8, p.x + 8, p.y - 8, p.y + 8)}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.sun, borderWidth: 1.5, borderColor: "#fff", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ ...a(10, INK, 700), lineHeight: 1, marginTop: LIFTA(10) }}>{tg.n}</Text>
            </View>
          </At>
        );
      })}
    </>
  );
}
/** Drawn on the picture where it has empty places: the clock's hands, the board's text, the portrait in the empty frame. */
function SceneOverlays({ page }: { page: "l" | "r" }) {
  const c = scenePt(SCENE.clock.x, SCENE.clock.y, page);
  const r = SCENE.clock.r * (2 * W + 2 * BLEED);
  const b0 = scenePt(SCENE.board.x0, SCENE.board.y0, page);
  const b1 = scenePt(SCENE.board.x1, SCENE.board.y1, page);
  const p0 = scenePt(SCENE.portrait.x0, SCENE.portrait.y0, page);
  const p1 = scenePt(SCENE.portrait.x1, SCENE.portrait.y1, page);
  return (
    <>
      {onPage(c.x, page) ? <Clock b={B(c.x - r, c.x + r, c.y - r, c.y + r)} time={K.SCENE_TIME} rim={C.coral} numerals={false} /> : null}
      {onPage(b0.x, page) && onPage(b1.x, page) ? (
        <At b={B(b0.x + 4, b1.x - 4, b0.y + 6, b1.y - 4)}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: C.sun, textAlign: "center", lineHeight: 1 }}>MONDAY</Text>
          <Text style={{ ...a(13, "#ffffff", 700), textAlign: "center", marginTop: 6 }}>Welcome, Can!</Text>
        </At>
      ) : null}
      {A.portrait && onPage(p0.x, page) && onPage(p1.x, page) ? <Pic b={B(p0.x, p1.x, p0.y, p1.y)} src={A.portrait} name="portrait (Wikimedia Commons, public domain)" /> : null}
    </>
  );
}
function SpreadBubbles({ page }: { page: "l" | "r" }) {
  return (
    <>
      {SPREAD_BUBBLES.filter((s) => s.page === page).map((s) => {
        const bub = K.SCENE_BUBBLES[s.i];
        return (
          <Bubble key={s.i} b={s.b} tail={s.tail} border={CAST_COLOUR[bub.who]} num={s.i + 1}>
            <Speaker who={bub.who} />
            {bub.text}
          </Bubble>
        );
      })}
    </>
  );
}
/** The class-rules poster on the wall (measured on scene.png, left page): the five rule icons of SB p. 5, in rule order. */
const POSTER = { x0: 48 * MM, x1: 116.2 * MM, y0: 15.6 * MM, y1: 33.6 * MM };
function RulesPoster() {
  const p = POSTER;
  const n = K.RULE_ICONS.length;
  const cw = (p.x1 - p.x0) / n;
  const s = Math.min(cw, p.y1 - p.y0) - 2.4 * MM;
  return (
    <>
      <Fill b={B0(p.x0, p.x1, p.y0, p.y1)} color="#F4F1EA" r={2} />
      {K.RULE_ICONS.map((_, i) => {
        const cx0 = p.x0 + i * cw + (cw - s) / 2;
        const cy0 = p.y0 + (p.y1 - p.y0 - s) / 2;
        return (
          <React.Fragment key={i}>
            <Fill b={B0(cx0 - 0.6 * MM, cx0 + s + 0.6 * MM, cy0 - 0.6 * MM, cy0 + s + 0.6 * MM)} color={[C.leafTint, C.tealTint, C.sunTint, C.coralTint, "#EEE8FA"][i]} r={(s + 1.2 * MM) / 2} />
            <Pic b={B0(cx0 + 1.6 * MM, cx0 + s - 1.6 * MM, cy0 + 1.6 * MM, cy0 + s - 1.6 * MM)} src={A.rule(i)} fit="contain" name={`poster rule ${i + 1}`} />
          </React.Fragment>
        );
      })}
    </>
  );
}
function SbScene4() {
  return (
    <BookPage n={4}>
      <Pic b={B(0, W, 0, SCENE_H)} src={A.scene.left} name="opening scene (left)" />
      <SceneOverlays page="l" />
      <RulesPoster />
      <SceneTags page="l" />
      <SpreadBubbles page="l" />
      <At b={B(cx(1), ce(12), ry(67))}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
          <View style={{ backgroundColor: RED, borderRadius: 12, paddingHorizontal: 9, height: 24, justifyContent: "center" }}>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 17, color: "#fff", lineHeight: 1, marginTop: LIFTB(17) }}>Get Ready!</Text>
          </View>
        </View>
        <Ex n={exN("e1")}>Look at the picture. Answer the questions.</Ex>
        <Row ex>
          <T>{K.EX1.example.q} </T>
          <Line w={45 * MM}>{K.EX1.example.a}</Line>
        </Row>
        {K.EX1.items.map((it, i) => (
          <Row key={i} n={i + 1}>
            <Text style={{ ...a(BODY), width: 68 * MM }}>{it.q}</Text>
            <View style={{ flex: 1 }}>
              <Line />
            </View>
          </Row>
        ))}
      </At>
      <Panel b={B(cx(1), ce(12), ry(97), ry(107))} color={C.sunTint} border="#E2B33A" title={`CHANT: ${K.CHANT.title.toUpperCase()}`} titleColor="#8A5A00">
        <View style={{ flexDirection: "row" }}>
          {[K.CHANT.lines.slice(0, 2), K.CHANT.lines.slice(2)].map((col, j) => (
            <View key={j} style={{ width: "50%" }}>
              {col.map((l) => (
                <Text key={l} style={{ ...a(BODY, INK, 700), lineHeight: 1.25 }}>
                  {l}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </Panel>
    </BookPage>
  );
}
function SbScene5() {
  const g = cells(cx(1), ce(12), 5, 4 * MM);
  return (
    <BookPage n={5}>
      <Pic b={B(0, W, 0, SCENE_H)} src={A.scene.right} name="opening scene (right)" />
      <SceneOverlays page="r" />
      <SceneTags page="r" />
      <SpreadBubbles page="r" />
      <At b={B(cx(1), ce(12), ry(67))}>
        <Ex n={exN("e2")} audio="2.01">
          Listen and read the speech bubbles. Then circle the correct words.
        </Ex>
        <Row ex h={8.2 * MM}>
          <Choice parts={K.EX2.example.parts} answer={K.EX2.example.a} />
        </Row>
        {K.EX2.items.map((it, i) => (
          <Row key={i} n={i + 1} h={8.2 * MM}>
            <Choice parts={it.parts} />
          </Row>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(88))}>
        <Ex n={exN("rules")}>Our class rules. Look at the pictures. Write the number of the rule.</Ex>
      </At>
      {K.RULE_PICS.map((ri, i) => {
        const x = g.at(i);
        const y = ry(93);
        return (
          <React.Fragment key={i}>
            <Fill b={B(x, x + g.w, y, y + 13 * MM)} color={i === 0 ? C.sunTint : C.tealTint} r={6} />
            <At b={B(x + 2 * MM, x + 6 * MM, y + 1 * MM)}>
              <Text style={a(BODY, DARK, 700)}>{"abcde"[i]}</Text>
            </At>
            <Pic b={B(x + 7 * MM, x + 17 * MM, y + 1.5 * MM, y + 11.5 * MM)} src={A.rule(ri)} fit="contain" name={`rule picture ${ri + 1}`} />
            <At b={B(x + g.w - 10 * MM, x + g.w - 2 * MM, y + 2.5 * MM)}>
              <WriteBox>{i === 0 ? String(ri + 1) : null}</WriteBox>
            </At>
          </React.Fragment>
        );
      })}
      <At b={B(cx(1), ce(12), ry(99))}>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {K.RULES.map((r, i) => (
            <Text key={r} style={{ ...a(BODY), width: "50%", lineHeight: 1.2, paddingRight: 6 }}>
              <Bo c={DARK}>{i + 1} </Bo>
              {r}
            </Text>
          ))}
        </View>
      </At>
    </BookPage>
  );
}

// --- pp. 6–7: Listen and look -------------------------------------------------------------------------
const PAST_TO: [string, number][] = [
  ["o'clock", 0],
  ["five past", 5],
  ["ten past", 10],
  ["quarter past", 15],
  ["twenty past", 20],
  ["twenty-five past", 25],
  ["half past", 30],
  ["twenty-five to", 35],
  ["twenty to", 40],
  ["quarter to", 45],
  ["ten to", 50],
  ["five to", 55],
];
function SbFocus6() {
  const g3 = cells(cx(1), ce(12), 3, 4 * MM);
  const panel = B(cx(1), ce(12), ry(27), ry(63));
  const d = 50 * MM;
  const ccx = cx(1) + 66 * MM;
  const ccy = ry(45);
  const R = d / 2 + 3 * MM;
  const clocks6 = cells(cx(1), ce(7), 3, 4 * MM);
  return (
    <BookPage n={6}>
      <LessonHead n={1} title="Listen and Look" skills={["Listening", "Speaking"]} />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={exN("e3")}>What is this unit about? Look at pages 4–5. Tick (✓) the topics.</Ex>
      </At>
      {K.EX3_TOPICS.map(([topic], i) => {
        const x = g3.at(i % 3);
        const y = ry(12 + Math.floor(i / 3) * 4.4);
        return (
          <React.Fragment key={topic}>
            <Fill b={B(x, x + g3.w, y, y + 9 * MM)} color={i === 0 ? C.sunTint : C.tealTint} r={5} />
            <At b={B(x + 3 * MM, x + g3.w, y, y + 9 * MM)}>
              <View style={{ flexDirection: "row", alignItems: "center", height: "100%" }}>
                <Tick on={i === 0} />
                <Text style={{ ...a(BODY), marginLeft: 7, flex: 1 }}>{topic}</Text>
                {i === 0 ? <View style={{ marginRight: -9 }}><ExampleTag /></View> : null}
              </View>
            </At>
          </React.Fragment>
        );
      })}
      <Panel b={panel} color="#ffffff" border={C.teal} title="TIME WORDS" titleColor={DARK} />
      <ArtPic id="time-words" b={B(ccx - d / 2, ccx + d / 2, ccy - d / 2, ccy + d / 2)} make={() => art.timeWordsClock(d, d)} />
      {PAST_TO.map(([w, m]) => {
        const an = (m / 60) * 2 * Math.PI;
        const px = ccx + Math.sin(an) * R;
        const py = ccy - Math.cos(an) * R;
        const left = Math.sin(an) < -0.2;
        const right = Math.sin(an) > 0.2;
        const bw = 34 * MM;
        const box = left ? B(px - bw, px, py - 7) : right ? B(px, px + bw, py - 7) : B(px - bw / 2, px + bw / 2, m === 0 ? py - 15 : py);
        return (
          <At key={w} b={box}>
            <Text style={{ ...a(BODY, m === 0 || m === 30 ? INK : m < 30 ? RED : DARK, 700), textAlign: left ? "right" : right ? "left" : "center", lineHeight: 1.1 }}>{w}</Text>
          </At>
        );
      })}
      <At b={B(cx(9), ce(12) - INSET, ry(31))}>
        <View style={{ backgroundColor: C.sunTint, borderRadius: 6, padding: 6 }}>
          <Text style={a(BODY, INK, 700)}>12:00</Text>
          <Text style={a(BODY)}>twelve o&apos;clock = noon</Text>
          <Text style={{ ...a(BODY, INK, 700), marginTop: 5 }}>13:00</Text>
          <Text style={a(BODY)}>one o&apos;clock in the afternoon</Text>
          <Text style={{ ...a(BODY, INK, 700), marginTop: 5 }}>08:40</Text>
          <Text style={a(BODY)}>twenty to nine in the morning</Text>
        </View>
      </At>
      <At b={B(cx(1), ce(12), ry(66))}>
        <Ex n={exN("e4")}>What time is it? Read and match. Write the letter.</Ex>
      </At>
      {K.EX4_CLOCKS.map((tm, i) => {
        const x = clocks6.at(i % 3);
        const y = ry(70 + Math.floor(i / 3) * 14);
        return (
          <React.Fragment key={tm}>
            <Clock b={B(x + 2 * MM, x + clocks6.w, y, y + 31 * MM)} time={tm} rim={[C.teal, C.coral, "#F2B705", C.lilac, C.leaf, "#2F80ED"][i]} />
            <At b={B(x, x + 6 * MM, y - 1 * MM)}>
              <Text style={a(13, DARK, 700)}>{"abcdef"[i]}</Text>
            </At>
          </React.Fragment>
        );
      })}
      <At b={B(cx(8), ce(12), ry(72))}>
        <View>
          {K.EX4_TIMES.map((tm, i) => (
            <View key={tm} style={{ flexDirection: "row", alignItems: "center", height: 9.4 * MM }}>
              <Num n={i + 1} />
              <Text style={{ ...a(BODY), flex: 1 }}>It&apos;s {K.timeWords(tm)}.</Text>
              <WriteBox>{i === 0 ? "abcdef"[K.EX4_CLOCKS.indexOf(tm)] : null}</WriteBox>
            </View>
          ))}
        </View>
      </At>
      <Vig k="sb6" b={B(cx(9), ce(12), ry(95), ry(107))} />
    </BookPage>
  );
}
function DigiTime({ t: tm }: { t: string }) {
  return (
    <View style={{ backgroundColor: INK, borderRadius: 4, paddingHorizontal: 6, height: 19, justifyContent: "center", marginRight: 7, marginBottom: 2 }}>
      <Text style={{ ...a(12, C.sun, 700), lineHeight: 1, letterSpacing: 0.8 }}>{tm}</Text>
    </View>
  );
}
function Timetable({ b, gaps, exampleGap = 0, showAll }: { b: Box; gaps: [string, number][]; exampleGap?: number; showAll?: boolean }) {
  const rows = [...K.PERIODS.slice(0, 4).map((p, i) => ({ p, i })), { p: "lunch", i: -1 }, ...K.PERIODS.slice(4).map((p, i) => ({ p, i: i + 4 }))];
  const tw = 16 * MM;
  const dw = (b.w - tw) / 5;
  const hh = 8 * MM;
  const rh = (b.h! - hh) / rows.length;
  const gapAt = (d: string, i: number) => gaps.findIndex(([gd, gi]) => gd === d && gi === i);
  const dayCol = [RED, "#8A5A00", DARK, "#5B3FA0", "#2E7031"];
  return (
    <>
      <Fill b={b} color="#fff" r={6} border={DARK} bw={1} />
      {K.DAYS5.map((d, j) => (
        <Fill key={d} b={B(b.x + tw + j * dw, b.x + tw + (j + 1) * dw, b.y, b.y + hh)} color={dayCol[j]} radii={j === 4 ? { borderTopRightRadius: 6 } : {}} />
      ))}
      <At b={B(b.x, b.x + b.w, b.y, b.y + hh)}>
        <View style={{ flexDirection: "row", height: "100%", alignItems: "center" }}>
          <Text style={{ ...lab(9, DARK), width: tw, textAlign: "center" }}>TIME</Text>
          {K.DAYS5.map((d) => (
            <Text key={d} style={{ ...a(BODY, "#ffffff", 700), width: dw, textAlign: "center" }}>{d}</Text>
          ))}
        </View>
      </At>
      {rows.map((r, k) => {
        const y = b.y + hh + k * rh;
        return (
          <React.Fragment key={k}>
            {r.i < 0 ? <Fill b={B(b.x + 1, b.x + b.w - 1, y, y + rh)} color={C.sunTint} /> : k % 2 === 0 ? <Fill b={B(b.x + 1, b.x + b.w - 1, y, y + rh)} color="#F1F9F9" /> : null}
            <At b={B(b.x, b.x + b.w, y, y + rh)}>
              {r.i < 0 ? (
                <View style={{ height: "100%", justifyContent: "center" }}>
                  <Text style={{ ...a(BODY, "#7A5200", 700), textAlign: "center" }}>Lunch break  12:10–13:00</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", height: "100%", alignItems: "center" }}>
                  <Text style={{ ...a(BODY, DARK, 700), width: tw, textAlign: "center" }}>{r.p}</Text>
                  {K.DAYS5.map((d) => {
                    const gi = gapAt(d, r.i);
                    const s = K.TIMETABLE[d][r.i];
                    return (
                      <View key={d} style={{ width: dw, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 }}>
                        {gi >= 0 ? (
                          <View style={{ width: dw - 8, height: Math.min(rh - 4, 8.5 * MM), borderWidth: 1, borderColor: RED, borderRadius: 3, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                            {showAll || gi === exampleGap ? <Text style={{ ...a(BODY, ANS, 700), lineHeight: 1, marginTop: LIFTA(BODY) }}>{s}</Text> : null}
                          </View>
                        ) : (
                          <Text style={{ ...a(BODY, s === "Elective" ? "#3F4A63" : INK), textAlign: "center", lineHeight: 1.05 }}>{s === "Elective" ? "Elective lesson" : s}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </At>
          </React.Fragment>
        );
      })}
    </>
  );
}
function SbFocus7() {
  const box = K.TT_GAPS.map(([d, i]) => K.TIMETABLE[d][i]);
  return (
    <BookPage n={7}>
      <At b={B(cx(1), ce(12), ry(0))}>
        <Ex n={exN("e5")} stars={2}>
          Write the times in words. Use &quot;in the morning&quot; or &quot;in the afternoon&quot;.
        </Ex>
        <Row ex>
          <DigiTime t={K.EX5.example} />
          <Line w={110 * MM}>{K.timeWords(K.EX5.example, true)}</Line>
        </Row>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {K.EX5.items.map((tm, i) => (
            <View key={tm} style={{ width: "50%", paddingRight: 10 }}>
              <Row n={i + 1}>
                <DigiTime t={tm} />
                <View style={{ flex: 1 }}>
                  <Line />
                </View>
              </Row>
            </View>
          ))}
        </View>
      </At>
      <At b={B(cx(1), ce(12), ry(21))}>
        <Ex n={exN("e6")} audio="2.02">
          Listen to Ms Aksoy. Complete the timetable of 5/C with the words in the box.
        </Ex>
        <WordBox words={[...box].sort()} struck={box[0]} />
      </At>
      <Timetable b={B(cx(1), ce(12), ry(31), ry(80))} gaps={K.TT_GAPS} />
      <At b={B(cx(1), ce(12), ry(81))}>
        <Text style={a(BODY, "#3F4A63")}>A lesson is {K.LESSON_MIN} minutes. Breaks are 15 minutes (20 minutes after the second lesson).</Text>
      </At>
      <At b={B(cx(1), ce(12), ry(86))}>
        <Ex n={exN("e7")}>Work in pairs. Take turns: one asks, one answers. Use the timetable.</Ex>
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: "50%", paddingRight: 6 }}>
            <Say who={K.EX7_MODEL[0].who}>{K.EX7_MODEL[0].text}</Say>
            <Say who={K.EX7_MODEL[1].who} right>
              {K.EX7_MODEL[1].text}
            </Say>
          </View>
          <View style={{ width: "50%", paddingLeft: 6 }}>
            <Say who={K.EX7_MODEL[2].who}>{K.EX7_MODEL[2].text}</Say>
            <Say who={K.EX7_MODEL[3].who} right>
              {K.EX7_MODEL[3].text}
            </Say>
          </View>
        </View>
      </At>
    </BookPage>
  );
}

// --- p. 8: say it right + subjects ---------------------------------------------------------------------
function SbSay8() {
  const tiles = cells(cx(1), ce(12), 5, 4 * MM);
  const tileH = 20 * MM;
  return (
    <BookPage n={8}>
      <LessonHead n={2} title="Say It Right" skills={["Pronunciation"]} />
      <Panel b={B(cx(1), ce(5), ry(9), ry(25))} color={C.coralTint} title="LISTEN FOR IT" titleColor={RED}>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <View style={{ width: 12, alignItems: "center" }}><StressDot /></View>
          <Text style={{ ...a(BODY), marginLeft: 5, flex: 1 }}>say this word strongly (isn&apos;t, don&apos;t)</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
          <View style={{ width: 12, alignItems: "center" }}><Arrow up={false} color={DARK} /></View>
          <Text style={{ ...a(BODY), marginLeft: 5, flex: 1 }}>the end: your voice goes down</Text>
        </View>
      </Panel>
      <At b={B(cx(6), ce(12), ry(8))}>
        <Ex n={exN("e8")} audio="2.03">
          Listen and repeat.
        </Ex>
        {K.EX9.map((s, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 4 }}>
            <Num n={i + 1} />
            <Intonation s={s} />
          </View>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(29))}>
        <Ex n={exN("e9")} audio="2.04">
          Listen. Draw a big dot (•) over the word you say strongly and ↘ at the end. Then say the sentences.
        </Ex>
        <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 3, marginTop: 3 }}>
          <ExampleTag />
          <Intonation s={K.EX10.example} />
        </View>
        {K.EX10.items.map((s, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 3 }}>
            <Num n={i + 1} />
            <Intonation s={s} marks={false} />
          </View>
        ))}
      </At>
      <LessonHead n={3} title="Word Bank" skills={["Vocabulary", "Listening"]} y={57} />
      <At b={B(cx(1), ce(12), ry(64))}>
        <Ex n={exN("e10")} audio="2.05">
          Listen, point and say. Then write the school subjects. (English is our Foreign Language.)
        </Ex>
        <WordBox words={[...K.SUBJECTS].sort()} struck={K.EX11_TILES[0]} />
      </At>
      {K.EX11_TILES.map((s, i) => {
        const x = tiles.at(i % 5);
        const y = ry(76 + Math.floor(i / 5) * 13);
        const tint = [C.coralTint, C.tealTint, C.sunTint, C.lilacTint, C.leafTint][(i + Math.floor(i / 5)) % 5];
        return (
          <React.Fragment key={s}>
            <Fill b={B(x, x + tiles.w, y, y + tileH)} color={tint} r={6} />
            <Pic b={B(x + 8 * MM, x + tiles.w - 4 * MM, y + 1.5 * MM, y + tileH - 1.5 * MM)} src={A.subject(s)} fit="contain" name={`subject ${s}`} />
            <At b={B(x + 2 * MM, x + 8 * MM, y + 1.5 * MM)}>
              <Text style={a(BODY, DARK, 700)}>{i + 1}</Text>
            </At>
            <At b={B(x, x + tiles.w, y + tileH)}>
              <Line>{i === 0 ? s : null}</Line>
            </At>
          </React.Fragment>
        );
      })}
      <Vig k="sb8" b={B(cx(8), ce(12), ry(39), ry(57))} />
    </BookPage>
  );
}

// --- p. 9: days and numbers ----------------------------------------------------------------------------
function SbWords9() {
  const chips = cells(cx(1), ce(12), 7, 3 * MM);
  const tens = cells(cx(1), ce(12), 6, 3 * MM);
  const g4 = cells(cx(1), ce(12), 4, 4 * MM);
  return (
    <BookPage n={9}>
      <At b={B(cx(1), ce(12), ry(0))}>
        <Ex n={exN("e11")}>Put the days of the week in order. Write 1–7.</Ex>
      </At>
      {K.EX12_CHIPS.map((d, i) => {
        const x = chips.at(i);
        const y = ry(5);
        return (
          <React.Fragment key={d}>
            <Fill b={B(x, x + chips.w, y, y + 17 * MM)} color={d === "Saturday" || d === "Sunday" ? C.sunTint : C.tealTint} r={6} />
            <At b={B(x, x + chips.w, y + 1.5 * MM)}>
              <View style={{ alignItems: "center" }}>
                <WriteBox>{d === "Monday" ? "1" : null}</WriteBox>
                <Text style={{ ...a(BODY, INK, 700), marginTop: 2 }}>{d}</Text>
              </View>
            </At>
          </React.Fragment>
        );
      })}
      <At b={B(cx(1), ce(12), ry(13))}>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <StarTag n={2} />
          <T>There are no lessons at the weekend. The weekend is </T>
          <Line w={32 * MM} />
          <T> and </T>
          <Line w={32 * MM} />
          <T>.</T>
        </View>
      </At>
      <At b={B(cx(1), ce(12), ry(19))}>
        <Ex n={exN("e12")}>Look at the numbers. Then match the numbers with the words.</Ex>
      </At>
      {[50, 60, 70, 80, 90, 100].map((n, i) => {
        const x = tens.at(i);
        const y = ry(24);
        return (
          <React.Fragment key={n}>
            <Fill b={B(x, x + tens.w, y, y + 15 * MM)} color={[C.coralTint, C.sunTint, C.tealTint, C.lilacTint, C.leafTint, "#DDEBFB"][i]} r={6} border={[C.coral, "#E2B33A", C.teal, C.lilac, C.leaf, "#2F80ED"][i]} bw={1} />
            <At b={B(x, x + tens.w, y + 1.5 * MM)}>
              <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 20, color: INK, textAlign: "center", lineHeight: 1 }}>{n}</Text>
              <Text style={{ ...a(BODY, INK, 700), textAlign: "center" }}>{K.numberWords(n)}</Text>
            </At>
          </React.Fragment>
        );
      })}
      <At b={B(cx(1), ce(12), ry(31))}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.sunTint, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 7 }}>
          <Text style={a(BODY, INK, 700)}>55 = fifty + five = fifty-five</Text>
          <Text style={{ ...a(BODY), marginLeft: 14 }}>sixty-two · seventy-seven · ninety-nine</Text>
        </View>
      </At>
      <At b={B(cx(1), ce(6), ry(35))}>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {K.EX13.numbers.map((n, i) => (
          <View key={n} style={{ width: "50%", flexDirection: "row", alignItems: "center", height: 11 * MM }}>
            <Num n={i + 1} />
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 16, color: INK, width: 34, lineHeight: 1, marginTop: 3 }}>{n}</Text>
            <WriteBox>{i === 0 ? "abcdef"[K.EX13.words.indexOf(n)] : null}</WriteBox>
          </View>
        ))}
        </View>
      </At>
      <At b={B(cx(8), ce(12), ry(35))}>
        {K.EX13.words.map((n, i) => (
          <View key={n} style={{ flexDirection: "row", alignItems: "center", height: 8 * MM }}>
            <Text style={{ ...a(BODY, DARK, 700), width: 16 }}>{"abcdef"[i]}</Text>
            <T>{K.numberWords(n)}</T>
          </View>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(56))}>
        <Ex n={exN("e13")} audio="2.06">
          Listen to Ms Aksoy. Circle the number you hear.
        </Ex>
      </At>
      {[K.EX14.example, ...K.EX14.items].map((it, i) => {
        const x = g4.at(i);
        const y = ry(61);
        return (
          <React.Fragment key={it.label}>
            <Fill b={B(x, x + g4.w, y, y + 25 * MM)} color={i === 0 ? C.sunTint : C.tealTint} r={6} />
            <At b={B(x + 2 * MM, x + g4.w - 2 * MM, y + 2 * MM)}>
              <Text style={{ ...a(BODY, INK, 700), textAlign: "center", lineHeight: 1.15 }}>
                {i === 0 ? "" : `${i}  `}
                {it.label}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 5 }}>
                {it.pair.map((n) => (
                  <View key={n} style={{ width: 38, height: 28, borderRadius: 14, borderWidth: 1.6, borderColor: i === 0 && n === it.a ? ANS : "transparent", alignItems: "center", justifyContent: "center", marginHorizontal: 6 }}>
                    <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 18, color: INK, lineHeight: 1, marginTop: LIFTB(18) }}>{n}</Text>
                  </View>
                ))}
              </View>
            </At>
          </React.Fragment>
        );
      })}
      <At b={B(cx(1), ce(12), ry(72))}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 1 }}>
          <StarTag n={2} />
          <T>Write the four numbers in words.</T>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {[K.EX14.example, ...K.EX14.items].map((it, i) => (
            <View key={i} style={{ width: "50%", paddingRight: 10 }}>
              <Row n={i === 0 ? "" : i} ex={i === 0}>
                <View style={{ flex: 1 }}>
                  <Line>{i === 0 ? K.numberWords(it.a) : null}</Line>
                </View>
              </Row>
            </View>
          ))}
        </View>
      </At>
      <At b={B(cx(1), ce(12), ry(86))}>
        <Ex n={exN("e14")} audio="2.07">
          Look at the picture on pages 4–5. Find the numbers 1–8. Write the words.
        </Ex>
        <WordBox words={[...K.SCENE_OBJECTS].sort()} struck={K.SCENE_OBJECTS[0]} />
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {K.SCENE_OBJECTS.map((o, i) => (
            <View key={o} style={{ width: "25%", flexDirection: "row", alignItems: "flex-end", paddingRight: 8, height: LINE_H }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.sun, alignItems: "center", justifyContent: "center", marginRight: 5, marginBottom: 2 }}>
                <Text style={{ ...a(10, INK, 700), lineHeight: 1, marginTop: LIFTA(10) }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Line>{i === 0 ? o : null}</Line>
              </View>
            </View>
          ))}
        </View>
      </At>
    </BookPage>
  );
}

// --- p. 10: riddles ---------------------------------------------------------------------------------
function SbWords10() {
  const g8 = cells(cx(1), ce(12), 4, 4 * MM);
  const cardH = 30 * MM;
  return (
    <BookPage n={10}>
      <LessonHead n={4} title="Game Time: Who am I?" skills={["Speaking"]} />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={exN("e15")}>Read the riddles and match. Then play: your partner reads a riddle, you point to the picture.</Ex>
      </At>
      {K.EX16.cards.map((c, i) => {
        const x = g8.at(i % 4);
        const y = ry(12 + Math.floor(i / 4) * 14);
        return (
          <React.Fragment key={c}>
            <Fill b={B(x, x + g8.w, y, y + cardH)} color="#fff" r={7} border={C.teal} bw={1.2} />
            <Pic b={B(x + 3 * MM, x + g8.w - 3 * MM, y + 2.5 * MM, y + cardH - 11 * MM)} src={A.object(c)} fit="contain" name={`object ${c}`} />
            <At b={B(x + 3 * MM, x + g8.w - 3 * MM, y + cardH - 10 * MM, y + cardH - 1 * MM)}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: "100%" }}>
                <Text style={a(BODY, INK, 700)}>
                  <Text style={{ color: DARK }}>{i + 1} </Text>
                  {c}
                </Text>
                <WriteBox>{i === 0 ? K.EX16.defs.find((d) => d[2] === c)![0] : null}</WriteBox>
              </View>
            </At>
          </React.Fragment>
        );
      })}
      <At b={B(cx(1), ce(8), ry(43))}>
        {K.EX16.defs.map(([l, s]) => (
          <View key={l} style={{ flexDirection: "row", marginBottom: 3 }}>
            <Text style={{ ...a(BODY, DARK, 700), width: 16 }}>{l}</Text>
            <Text style={{ ...a(BODY), flex: 1 }}>{s}</Text>
          </View>
        ))}
      </At>
      <Panel b={B(cx(9), ce(12), ry(45), ry(66))} color={C.sunTint} title="PLAY" titleColor="#8A5A00">
        <Text style={{ ...a(BODY), lineHeight: 1.25 }}>Write your own riddle:</Text>
        <Text style={{ ...a(BODY, INK, 700), lineHeight: 1.25, marginTop: 2 }}>&quot;I&apos;m ... I help you ... Who am I?&quot;</Text>
        <Text style={{ ...a(BODY), lineHeight: 1.25, marginTop: 4 }}>Read it to your partner. Can your partner guess?</Text>
      </Panel>
      <At b={B(cx(1), ce(12), ry(71))}>
        <Ex n={exN("e16")}>What school materials do you use in these lessons? Tell your partner.</Ex>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
          <View style={{ width: "55%" }}>
            <Say who="kerem">In Science, I use a notebook and a ruler.</Say>
          </View>
          <View style={{ flexDirection: "row", marginLeft: 8 }}>
            {K.EX17_LESSONS.map((s) => (
              <View key={s} style={{ backgroundColor: C.tealTint, borderRadius: 8, paddingHorizontal: 7, height: 20, justifyContent: "center", marginRight: 5 }}>
                <Text style={{ ...a(BODY, DARK, 700), lineHeight: 1, marginTop: LIFTA(BODY) }}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <StarTag n={2} />
          <T>Now write: In Art, I use </T>
          <View style={{ flex: 1 }}>
            <Line />
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <View style={{ width: 27 }} />
          <T>In Maths, I use </T>
          <View style={{ flex: 1 }}>
            <Line />
          </View>
        </View>
      </At>
      <Panel b={B(cx(1), ce(7), ry(89), ry(107))} color={C.lilacTint} border={C.lilac} title={`RHYME: ${K.RHYME.title.toUpperCase()}`} titleColor="#5B3FA0">
        {K.RHYME.lines.map((l) => (
          <Text key={l} style={{ ...a(13, INK, 700), lineHeight: 1.4 }}>
            {l}
          </Text>
        ))}
        <Text style={{ ...a(BODY, "#3F4A63"), marginTop: 3 }}>Say it with a friend. Clap on every line!</Text>
      </Panel>
      <Panel b={B(cx(8), ce(12), ry(89), ry(107))} color={C.sunTint} title="MORE CLASSROOM WORDS" titleColor="#8A5A00">
        {K.EXTRA_OBJECTS.map((o) => (
          <View key={o} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
            <FlowPic src={A.object(o)} d={34} />
            <Text style={{ ...a(BODY, INK, 700), marginLeft: 8 }}>{o}</Text>
          </View>
        ))}
      </Panel>
    </BookPage>
  );
}

// --- pp. 11–12: grammar spot -------------------------------------------------------------------------
const G = ({ children }: { children: React.ReactNode }) => <Text style={{ fontWeight: 700, color: "#1D5BB5", backgroundColor: "#E3EEFC" }}>{children}</Text>;
function Pattern({ b, title, color, lines, notice }: { b: Box; title: string; color: string; lines: React.ReactNode[]; notice?: string }) {
  return (
    <Panel b={b} color="#fff" border={color} title={title} titleColor={color === C.teal ? DARK : color === C.coral ? RED : color}>
      {lines.map((l, i) => (
        <Text key={i} style={{ ...a(BODY), marginBottom: 3 }}>
          {l}
        </Text>
      ))}
      {notice ? (
        <View style={{ flexDirection: "row", marginTop: 3, backgroundColor: C.sunTint, borderRadius: 5, padding: 4 }}>
          <Text style={{ ...lab(11, "#7A5200"), marginRight: 5, marginTop: 1 }}>NOTICE</Text>
          <Text style={{ ...a(BODY), flex: 1 }}>{notice}</Text>
        </View>
      ) : null}
    </Panel>
  );
}
function SbGrammar11() {
  const picA = B(cx(1), ce(6), ry(22), ry(38));
  const picB = B(cx(7), ce(12), ry(22), ry(38));
  return (
    <BookPage n={11}>
      <LessonHead n={5} title="Grammar Spot" skills={["Language in use"]} />
      <Pattern
        b={B(cx(1), ce(12), ry(7), ry(21))}
        title="THERE IS / THERE ARE"
        color={C.teal}
        lines={[
          <>
            <G>There is</G> a map on the wall. · <G>There are</G> four desks. · <G>There isn&apos;t</G> a TV.
          </>,
          <>
            <G>Is there</G> a piano? Yes, there is. · How many books <G>are there</G>?
          </>,
        ]}
        notice={K.NOTICE_THERE.q}
      />
      <ArtPic id="class-corner-a" b={picA} make={() => art.classCorner(picA.w, picA.h!, "A")} r={6} />
      <ArtPic id="class-corner-b" b={picB} make={() => art.classCorner(picB.w, picB.h!, "B")} r={6} />
      {(["A", "B"] as const).map((k, i) => (
        <At key={k} b={B(i ? picB.x + 2 * MM : picA.x + 2 * MM, (i ? picB.x : picA.x) + 22 * MM, picA.y + 2 * MM)}>
          <View style={{ backgroundColor: INK, borderRadius: 6, paddingHorizontal: 6, height: 17, justifyContent: "center", alignSelf: "flex-start" }}>
            <Text style={{ ...a(11, "#fff", 700), lineHeight: 1, marginTop: LIFTA(11) }}>{k}</Text>
          </View>
        </At>
      ))}
      <At b={B(cx(1), ce(12), ry(40))}>
        <Ex n={exN("e17")}>Look at picture A. Circle the correct words.</Ex>
        {[K.EX18.example, ...K.EX18.items].map((it, i) => (
            <Row key={i} n={i} ex={i === 0} h={8 * MM}>
              <Choice parts={it.parts} answer={i === 0 ? it.a : undefined} />
            </Row>
          ))}
      </At>
      <At b={B(cx(1), ce(12), ry(65))}>
        <Ex n={exN("spot")}>
          Play in pairs. Student A looks at picture A, Student B at picture B. Ask: &quot;Is there a ...? How many ... are there?&quot; Find four differences.
        </Ex>
      </At>
      <Pattern
        b={B(cx(1), ce(12), ry(71), ry(84))}
        title="ME, YOU, HIM, HER, IT, US, THEM"
        color={C.lilac}
        lines={[
          <>
            Can is new. Kerem helps <G>him</G>. · Ms Aksoy is kind. We like <G>her</G>. · The ball is here. Throw <G>it</G>!
          </>,
          <>
            The books are new. I like <G>them</G>. · Our teacher calls <G>us</G>. · Can you help <G>me</G>? · I can see <G>you</G>!
          </>,
        ]}
        notice={K.NOTICE_PRON.q}
      />
      <At b={B(cx(1), ce(12), ry(86))}>
        <Ex n={exN("e18")}>Circle the correct words.</Ex>
        {[K.EX_PRON.example, ...K.EX_PRON.items].map((it, i) => (
            <Row key={i} n={i} ex={i === 0} h={7.6 * MM}>
              <Choice parts={it.parts} answer={i === 0 ? it.a : undefined} />
            </Row>
          ))}
      </At>
    </BookPage>
  );
}
function SbGrammar12() {
  return (
    <BookPage n={12}>
      <LessonHead n={5} title="Grammar Spot: Routines and Time" skills={["Language in use"]} />
      <Pattern
        b={B(cx(1), ce(7), ry(8), ry(29))}
        title="OUR ROUTINES"
        color={C.coral}
        lines={[
          <>
            We <G>have</G> Maths on Mondays. We <G>don&apos;t have</G> Maths on Wednesdays.
          </>,
          <>
            Kerem <G>has</G> Science on Mondays. He <G>uses</G> a ruler.
          </>,
          <>
            He <G>doesn&apos;t have</G> Art on Mondays.
          </>,
          <>
            <G>Does</G> Kerem have IT on Thursdays? Yes, he <G>does</G>.
          </>,
        ]}
        notice={K.NOTICE_HAVE.q}
      />
      <Pattern
        b={B(cx(8), ce(12), ry(8), ry(29))}
        title="WHAT TIME?"
        color={C.teal}
        lines={[
          <>
            <G>What time is it?</G> It&apos;s twenty to nine.
          </>,
          <>
            <G>What time does</G> the Art lesson <G>start</G>? It <G>starts at</G> five to two.
          </>,
          <>
            <G>What time do</G> you get up? I get up at seven.
          </>,
        ]}
      />
      <At b={B(cx(1), ce(12), ry(32))}>
        <Ex n={exN("e19")}>Look at the timetable on page 7. Write have or don&apos;t have.</Ex>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {[K.EX19.example, ...K.EX19.items].map((it, i) => (
            <View key={i} style={{ width: i === 0 ? "100%" : "50%", paddingRight: 8 }}>
              <Row n={i} ex={i === 0}>
                <T>We </T>
                <Line w={32 * MM}>{i === 0 ? (K.has(it.subject, it.day) ? "have" : "don't have") : null}</Line>
                <Text style={{ ...a(BODY), marginLeft: 4 }}>
                  {it.subject} on {it.day}s.
                </Text>
              </Row>
            </View>
          ))}
        </View>
      </At>
      <At b={B(cx(1), ce(12), ry(50))}>
        <Ex n={exN("e20")}>Write the verb with -s.</Ex>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {[K.EX_3RD.example, ...K.EX_3RD.items].map((it, i) => (
            <View key={i} style={{ width: i === 0 ? "100%" : "50%", paddingRight: 8 }}>
              <Row n={i} ex={i === 0}>
                <T>{it.who} </T>
                <Line w={32 * MM}>{i === 0 ? it.a : null}</Line>
                <Text style={{ ...a(BODY), marginLeft: 4 }}>
                  ({it.verb}) {it.rest}
                </Text>
              </Row>
            </View>
          ))}
        </View>
      </At>
      <At b={B(cx(1), ce(12), ry(68))}>
        <Ex n={exN("e21")}>Look at the timetable on page 7. Answer: Yes, ... does. / No, ... doesn&apos;t. / Yes, we do.</Ex>
        {[K.EX_DOES.example, ...K.EX_DOES.items].map((it, i) => (
          <Row key={i} n={i} ex={i === 0}>
            <Text style={{ ...a(BODY), flex: 1 }}>{it.q}</Text>
            <Line w={46 * MM}>{i === 0 ? it.a : null}</Line>
          </Row>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(93))}>
        <Ex n={exN("e22")} stars={2}>
          Work in pairs. Ask and answer about the timetable on page 7.
        </Ex>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
          <ExampleTag />
          <View style={{ width: 3.5 }} />
          <Ws s={`${K.EX20.example.subject} / ${K.EX20.example.day}s:`} bold />
          <Ws s={` What time does the ${K.EX20.example.subject} lesson start on ${K.EX20.example.day}s? It starts at ${K.timeWords(K.startOf(K.EX20.example.subject, K.EX20.example.day))}.`} color={ANS} />
        </View>
        <View style={{ flexDirection: "row", marginTop: 4 }}>
          {K.EX20.items.map((it, i) => (
            <View key={i} style={{ flexDirection: "row", marginRight: 18 }}>
              <Num n={i + 1} />
              <T>
                {it.subject} / {it.day}s
              </T>
            </View>
          ))}
        </View>
      </At>
    </BookPage>
  );
}

// --- p. 13: the board game ------------------------------------------------------------------------------
function SbGame13() {
  const board = B(cx(1), ce(12), ry(30), ry(106));
  const cols = 4;
  const n = K.BOARD.length;
  const rows = Math.ceil(n / cols);
  const cellsXY = art.boardCells(n, cols);
  const cw = board.w / cols;
  const chh = board.h! / rows;
  return (
    <BookPage n={13}>
      <LessonHead n={6} title="Game Time: Classroom Race" skills={["Speaking"]} />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={exN("e23")}>Play the game. Answer the questions on the squares.</Ex>
      </At>
      <Panel b={B(cx(1), ce(12), ry(13), ry(28))} color={C.sunTint} title="RULES" titleColor="#8A5A00">
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: 32, alignItems: "center", marginRight: 6 }}>
            <FlowPic src={A.game("dice")} d={22} />
            <Text style={lab(9, INK)}>DICE</Text>
            <View style={{ height: 3 }} />
            <FlowPic src={A.game("coin")} d={18} />
            <Text style={lab(9, INK)}>COIN</Text>
          </View>
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}>
            {K.BOARD_RULES.map((r, i) => (
              <View key={i} style={{ width: "50%", flexDirection: "row", paddingRight: 8, marginBottom: 3 }}>
                <Text style={{ ...a(BODY, DARK, 700), width: 14 }}>{i + 1}</Text>
                <Text style={{ ...a(BODY), flex: 1, lineHeight: 1.2 }}>{r}</Text>
              </View>
            ))}
          </View>
        </View>
      </Panel>
      <ArtPic id="board" b={board} make={() => art.boardGround(board.w, board.h!, n, K.BOARD.map((s) => s.kind), cols)} />
      {K.BOARD.map((sq, i) => {
        const c = cellsXY[i];
        const x = board.x + c.c * cw + cw * 0.06;
        const y = board.y + (rows - 1 - c.r) * chh + chh * 0.07;
        const end = sq.kind === "start" || sq.kind === "end";
        return (
          <At key={i} b={B(x + 2 * MM, x + cw * 0.88 - 2 * MM, y + 1.5 * MM, y + chh * 0.86 - 1.5 * MM)}>
            <View style={{ height: "100%", justifyContent: "center" }}>
              {!end ? (
                <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 2 }}>
                  <Text style={{ ...lab(9, DARK), marginRight: 4 }}>{i}</Text>
                  {sq.icon ? <FlowPic src={A.emoji(sq.icon)} d={15} /> : null}
                </View>
              ) : null}
              <Text style={{ ...(end ? { fontFamily: "Baloo", fontWeight: 700 as const, fontSize: 20, color: "#fff", lineHeight: 1, marginTop: LIFTB(20) } : a(BODY, INK, 700)), textAlign: "center", lineHeight: 1.15 }}>{sq.t}</Text>
            </View>
          </At>
        );
      })}
    </BookPage>
  );
}

// --- p. 14: read ---------------------------------------------------------------------------------
function SbRead14() {
  const blog = B(cx(1), ce(12), ry(13), ry(45));
  const chart = B(cx(1), ce(12), ry(48), ry(68));
  const cw = [26 * MM, 40 * MM];
  return (
    <BookPage n={14}>
      <LessonHead n={7} title="Read" skills={["Reading"]} />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={exN("e24")}>{K.EX23.q}</Ex>
      </At>
      <Fill b={blog} color={C.paper} r={6} border="#D9C9A3" bw={1} />
      <Pic b={B(blog.x + INSET, blog.x + INSET + 24 * MM, blog.y + INSET, blog.y + INSET + 24 * MM)} src={A.avatars.can} fit="contain" name="avatar Can" />
      <At b={B(blog.x + INSET + 28 * MM, blog.x + blog.w - INSET, blog.y + 3 * MM)}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 17, color: DARK, lineHeight: 1.1, marginBottom: 2 }}>{K.CAN_BLOG_TITLE}</Text>
        {K.CAN_BLOG.map((p, i) => (
          <Text key={i} style={{ ...a(READ), lineHeight: 1.38, marginBottom: 3 }}>
            {p}
          </Text>
        ))}
      </At>
      <Fill b={chart} color="#fff" r={6} border={C.lilac} bw={1.2} />
      <Fill b={B(chart.x, chart.x + chart.w, chart.y, chart.y + 7 * MM)} color="#5B3FA0" radii={{ borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
      <At b={chart}>
        <View style={{ height: 7 * MM, justifyContent: "center", paddingLeft: INSET }}>
          <Text style={lab(11, "#fff")}>OUR CLASS HELPERS</Text>
        </View>
        {K.HELPERS.map(([who, job, what], i) => (
          <View key={who} style={{ flexDirection: "row", alignItems: "center", height: (chart.h! - 7 * MM) / K.HELPERS.length, paddingLeft: INSET, borderTopWidth: i ? 0.6 : 0, borderTopColor: "#D9CFF0" }}>
            <Text style={{ ...a(BODY, CAST_TEXT[who.toLowerCase() as K.CastKey], 700), width: cw[0] }}>{who}</Text>
            <Text style={{ ...a(BODY, "#5B3FA0", 700), width: cw[1] }}>{job}</Text>
            <Text style={{ ...a(BODY), flex: 1 }}>
              {who} {what}
            </Text>
          </View>
        ))}
      </At>
      <At b={B(cx(1), ce(9), ry(71))}>
        <Ex n={exN("e25")}>Read again. Write T (true) or F (false).</Ex>
        {[K.EX24.example, ...K.EX24.items].map((it, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", height: LINE_H }}>
            {i === 0 ? <ExampleTag /> : <Num n={i} />}
            <Text style={{ ...a(BODY), flex: 1 }}>{it.s}</Text>
            <WriteBox>{i === 0 ? (it.a ? "T" : "F") : null}</WriteBox>
          </View>
        ))}
      </At>
      <Vig k="sb14" b={B(cx(10), ce(12), ry(78), ry(104))} />
    </BookPage>
  );
}

// --- p. 15: write ----------------------------------------------------------------------------------
function SurveyTable({ b, cols, filled }: { b: Box; cols: string[]; filled?: (string | null)[][] }) {
  const aw = 33 * MM;
  const cw = (b.w - aw) / cols.length;
  const hh = 8 * MM;
  const rh = (b.h! - hh) / K.SURVEY_ROWS.length;
  return (
    <>
      <Fill b={b} color="#fff" r={5} border={DARK} bw={1} />
      <Fill b={B(b.x, b.x + b.w, b.y, b.y + hh)} color={C.tealTint} radii={{ borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />
      <At b={b}>
        <View style={{ flexDirection: "row", height: hh, alignItems: "center" }}>
          <Text style={{ ...lab(11, DARK), width: aw, paddingLeft: 5 }}>ACTIVITY</Text>
          {cols.map((c) => (
            <Text key={c} style={{ ...a(BODY, INK, 700), width: cw, textAlign: "center" }}>{c}</Text>
          ))}
        </View>
        {K.SURVEY_ROWS.map((r, i) => (
          <View key={r} style={{ flexDirection: "row", height: rh, borderTopWidth: 0.6, borderTopColor: "#B8C4CC", alignItems: "center" }}>
            <Text style={{ ...a(BODY), width: aw, paddingLeft: 5 }}>{r}</Text>
            {cols.map((c, j) => (
              <View key={c} style={{ width: cw, height: "100%", borderLeftWidth: 0.6, borderLeftColor: "#B8C4CC", justifyContent: "center" }}>
                {filled?.[i]?.[j] ? <Text style={{ ...a(BODY, ANS, 700), textAlign: "center" }}>{filled[i][j]}</Text> : null}
              </View>
            ))}
          </View>
        ))}
      </At>
    </>
  );
}
function SbWrite15() {
  const half = cells(cx(1), ce(12), 2, 6 * MM);
  const vig = A.vignette("sb15");
  return (
    <BookPage n={15}>
      <LessonHead n={8} title="Write" skills={["Writing", "Speaking"]} />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={exN("read15")}>Read Defne&apos;s text about her day and her friend Zehra.</Ex>
      </At>
      <Fill b={B(cx(1), ce(12), ry(12), ry(34))} color={C.paper} r={6} border="#D9C9A3" bw={1} />
      <Pic b={B(cx(1) + INSET, cx(1) + INSET + 24 * MM, ry(13), ry(13) + 24 * MM)} src={vig ?? A.avatars.defne} fit="contain" name="Defne" />
      <At b={B(cx(3) + 8 * MM, ce(12) - INSET, ry(13))}>
        {K.ROUTINE_TEXT.map((p, i) => (
          <Text key={i} style={{ ...a(READ), lineHeight: 1.36, marginBottom: 3 }}>
            {p}
          </Text>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(37))}>
        <Ex n={exN("survey15")}>What time do you ...? Choose one table.</Ex>
      </At>
      <At b={B(half.at(0), half.at(0) + half.w, ry(42))}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <StarTag n={1} />
          <Text style={{ ...a(BODY), flex: 1, lineHeight: 1.2 }}>Find Zehra&apos;s times in the text. Then ask a friend.</Text>
        </View>
      </At>
      <SurveyTable b={B(half.at(0), half.at(0) + half.w, ry(48), ry(70))} cols={["Zehra", "My friend"]} filled={K.SURVEY_ZEHRA.map((tm, i) => [i === 0 ? tm : null, null])} />
      <At b={B(half.at(1), half.at(1) + half.w, ry(42))}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <StarTag n={2} />
          <Text style={{ ...a(BODY), flex: 1, lineHeight: 1.2 }}>Ask two friends. Then tell the class: &quot;Ece gets up at ...&quot;</Text>
        </View>
      </At>
      <SurveyTable b={B(half.at(1), half.at(1) + half.w, ry(48), ry(70))} cols={["Me", "Friend 1", "Friend 2"]} />
      <At b={B(cx(1), ce(8), ry(74))}>
        <Ex n={exN("write15")}>Write about you and a friend.</Ex>
        <Line>I get up at ...</Line>
        {Array.from({ length: 3 }, (_, i) => (
          <Line key={i} />
        ))}
      </At>
      <Panel b={B(cx(9), ce(12), ry(77), ry(105))} color={C.leafTint} border={C.leaf} title="CHECK YOUR TEXT" titleColor="#2E7031">
        {K.WRITE_CHECK.map((c) => (
          <View key={c} style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
            <Tick />
            <Text style={{ ...a(BODY), marginLeft: 5, flex: 1, lineHeight: 1.15 }}>{c}</Text>
          </View>
        ))}
      </Panel>
    </BookPage>
  );
}

// --- p. 16: around the world ------------------------------------------------------------------------
function SbClil16() {
  const pics = cells(cx(1), ce(12), 5, 3 * MM);
  const picH = 24 * MM;
  const two = cells(cx(1), ce(12), 2, 6 * MM);
  return (
    <BookPage n={16}>
      <LessonHead n={9} title="Around the World" skills={["CLIL & Culture"]} />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={exN("e29")}>Look at the pictures. Read the texts and match. There is one extra picture.</Ex>
      </At>
      {K.CLIL_PICS.map((p, i) => {
        const x = pics.at(i);
        const y = ry(12);
        return (
          <React.Fragment key={i}>
            <ArtPic id={`clil-${i}`} b={B(x, x + pics.w, y, y + picH)} make={() => A.clil(i, pics.w, picH)} r={5} />
            <At b={B(x + 1.5 * MM, x + 12 * MM, y + 1.5 * MM)}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.sun, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ ...a(10, INK, 700), lineHeight: 1, marginTop: LIFTA(10) }}>{i + 1}</Text>
              </View>
            </At>
            <At b={B(x, x + pics.w, y + picH + 1.5 * MM)}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ ...a(BODY, INK, 700), marginRight: 4 }}>Text</Text>
                <WriteBox>{i === 0 ? p.k : null}</WriteBox>
              </View>
            </At>
          </React.Fragment>
        );
      })}
      {K.CLIL.map((c, i) => {
        const x = two.at(i % 2);
        const y = ry(29 + Math.floor(i / 2) * 21.5);
        const col = [C.coral, C.teal, C.lilac, "#C98A00"][i];
        const tcol = [RED, DARK, "#5B3FA0", "#7A5200"][i];
        return (
          <React.Fragment key={c.k}>
            <Fill b={B(x, x + two.w, y, y + 20 * 2.5 * MM)} color="#fff" r={7} border={col} bw={1.2} />
            <At b={B(x + INSET, x + two.w - INSET, y + 3 * MM)}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: col === C.teal ? DARK : col === C.coral ? RED : col, alignItems: "center", justifyContent: "center", marginRight: 6 }}>
                  <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 13, color: "#fff", lineHeight: 1, marginTop: LIFTB(13) }}>{c.k}</Text>
                </View>
                <FlowPic src={A.flag(c.country)} d={17} />
                <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: tcol, marginLeft: 6, lineHeight: 1, marginTop: LIFTB(15) }}>{c.country}</Text>
              </View>
              <Text style={{ ...a(BODY), lineHeight: 1.3 }}>{c.text}</Text>
            </At>
          </React.Fragment>
        );
      })}
      <At b={B(cx(1), ce(9), ry(73))}>
        <Ex n={exN("e30")}>Read again. Which text is it? Write A, B, C or D.</Ex>
        {[K.EX31.example, ...K.EX31.items].map((it, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", height: LINE_H - 0.6 * MM }}>
            {i === 0 ? <ExampleTag /> : <Num n={i} />}
            <Text style={{ ...a(BODY), flex: 1 }}>{it.s}</Text>
            <WriteBox>{i === 0 ? it.a : null}</WriteBox>
          </View>
        ))}
      </At>
      <Panel b={B(cx(1), ce(12), ry(100), ry(107))} color={C.coralTint}>
        <Text style={a(BODY, INK, 700)}>Talk: When does the school year start in Türkiye? What do you like about your school?</Text>
      </Panel>
    </BookPage>
  );
}

// --- p. 17: story (full page, six separate panel pictures) --------------------------------------------
const STORY_BOX = B(cx(1), ce(12), ry(12), ry(106));
function storyPanels() {
  const g = cells(STORY_BOX.x, STORY_BOX.x + STORY_BOX.w, 2, 4 * MM);
  const ph = (STORY_BOX.h! - 2 * 4 * MM) / 3;
  return K.STORY.map((_, i) => B(g.at(i % 2), g.at(i % 2) + g.w, STORY_BOX.y + Math.floor(i / 2) * (ph + 4 * MM), STORY_BOX.y + Math.floor(i / 2) * (ph + 4 * MM) + ph));
}
function SbStory17() {
  const panels = storyPanels();
  return (
    <BookPage n={17}>
      <LessonHead n={10} title={`Story Time: ${K.STORY_TITLE}`} skills={["Reading", "Listening"]} />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={exN("e31")} audio="2.08">
          {K.EX33.q} Then listen and read.
        </Ex>
      </At>
      {panels.map((pb, i) => {
        const src = A.story(i);
        const ck = STORY_CLOCK_AT;
        return (
          <React.Fragment key={i}>
            {src ? <Pic b={pb} src={src} r={6} name={`story panel ${i + 1}`} /> : <ArtPic id={`ph-story2-${i}`} b={pb} make={() => art.placeholder(`story2-${i}`, pb.w, pb.h!, `PANEL ${i + 1}: ${K.STORY[i].scene}`, ["#CDEBFA", "#FFE8E1", "#E7F5E5", "#FFF5D6", "#EFE9FB", "#CDEBFA"][i])} r={6} />}
            {i === 3 ? <Clock b={B(pb.x + (ck.x - ck.r) * pb.w, pb.x + (ck.x + ck.r) * pb.w, pb.y + ck.y * pb.h! - ck.r * pb.w, pb.y + ck.y * pb.h! + ck.r * pb.w)} time={K.STORY_CLOCK} rim={C.coral} numerals={false} /> : null}
            <Fill b={pb} color="transparent" r={6} border={INK} bw={1.4} />
            <At b={B(pb.x + pb.w - 9 * MM, pb.x + pb.w - 1 * MM, pb.y + pb.h! - 9 * MM)}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: RED, borderWidth: 1.2, borderColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ ...a(11, "#fff", 700), lineHeight: 1, marginTop: LIFTA(11) }}>{i + 1}</Text>
              </View>
            </At>
            {K.STORY[i].bubbles.map((bb, j) => {
              const f = STORY_BUBBLES[i][j];
              const bw = f.w * pb.w;
              // the tail points down at the speaker's head (measured on the picture)
              const tailX = Math.min(bw - 22, Math.max(10, (f.sx - f.x) * pb.w - 5));
              return (
                <At key={j} b={B0(pb.x + f.x * pb.w, pb.x + (f.x + f.w) * pb.w, pb.y + f.y * pb.h!)}>
                  <BubbleBody tail="bl" border={CAST_COLOUR[bb.who]} tailX={tailX}>
                    <Speaker who={bb.who} />
                    {bb.text}
                  </BubbleBody>
                </At>
              );
            })}
          </React.Fragment>
        );
      })}
    </BookPage>
  );
}

// --- p. 18: story questions + sequencing + project ----------------------------------------------------
function SbProject18() {
  const poster = B(cx(7), ce(12), ry(47), ry(85));
  const scale = B(cx(1), ce(12), ry(88), ry(106));
  return (
    <BookPage n={18}>
      <At b={B(cx(1), ce(12), ry(0))}>
        <Ex n={exN("e32")}>Read the story on page 17 again. Answer the questions. Then act it out in groups.</Ex>
        {[K.EX35.example, ...K.EX35.items].map((it, i) => (
          <Row key={i} n={i} ex={i === 0} h={8.4 * MM}>
            <Text style={{ ...a(BODY), flex: 1 }}>{it.q}</Text>
            <Line w={70 * MM} h={8.4 * MM}>
              {i === 0 ? it.a : null}
            </Line>
          </Row>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(25.5))}>
        <Ex n={exN("seq")}>Put the story in order. Write 1–6.</Ex>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {K.STORY_EVENTS.map(([e, k], i) => (
            <View key={e} style={{ width: "50%", flexDirection: "row", alignItems: "center", height: 8.6 * MM, paddingRight: 8 }}>
              <WriteBox>{i === 0 ? String(k) : null}</WriteBox>
              <Text style={{ ...a(BODY), marginLeft: 6, flex: 1 }}>{e}</Text>
            </View>
          ))}
        </View>
      </At>
      <LessonHead n={11} title="Project: Welcome to 5/C!" skills={["Project"]} y={40} />
      <At b={B(cx(1), ce(6), ry(47))}>
        <Ex n={exN("e34")}>Make a class guide for a new student like Can.</Ex>
        {K.PROJECT_STEPS.map((s, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 3 }}>
            <View style={{ width: 19, height: 19, borderRadius: 9.5, backgroundColor: [DARK, RED, "#7A5200", "#5B3FA0", "#2E7031"][i], alignItems: "center", justifyContent: "center", marginRight: 6 }}>
              <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 12, color: "#fff", lineHeight: 1, marginTop: LIFTB(12) }}>{i + 1}</Text>
            </View>
            <Text style={{ ...a(BODY), flex: 1, lineHeight: 1.22 }}>{s}</Text>
          </View>
        ))}
        <View style={{ marginTop: 3.3, backgroundColor: C.tealTint, borderRadius: 6, padding: 5 }}>
          {K.PROJECT_FRAME.map((s) => (
            <Text key={s} style={{ ...a(BODY, INK, 700), marginBottom: 1 }}>
              {s}
            </Text>
          ))}
        </View>
      </At>
      {/* Zehra's example guide: rules, a map with five words, helpers, a timetable */}
      <Fill b={poster} color="#FFFDF2" r={4} border={C.coral} bw={2} />
      <At b={B(poster.x + INSET, poster.x + poster.w - INSET, poster.y + 2.5 * MM)}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 16, color: RED, lineHeight: 1 }}>Welcome to 5/C, Can!</Text>
        <Text style={{ ...lab(11, "#3F4A63"), marginTop: 3 }}>BY ZEHRA</Text>
      </At>
      <ArtPic id="guide-map2" b={B(poster.x + INSET, poster.x + poster.w - INSET, poster.y + 16 * MM, poster.y + 47 * MM)} make={() => guideMap(poster.w - 2 * INSET, 31 * MM)} r={4} />
      {GUIDE_LABELS.map((l) => {
        const mw = poster.w - 2 * INSET;
        const x = poster.x + INSET + l.x * mw;
        const y = poster.y + 16 * MM + l.y * 31 * MM;
        return (
          <At key={l.t} b={B(x - 13 * MM, x + 13 * MM, y - 2.4 * MM)}>
            <Text style={{ ...a(11, INK, 700), textAlign: "center", lineHeight: 1 }}>{l.t}</Text>
          </At>
        );
      })}
      <At b={B(poster.x + INSET, poster.x + poster.w - INSET, poster.y + 49 * MM)}>
        <Text style={{ ...a(BODY), lineHeight: 1.2 }}>There are twelve desks. The coat hooks are next to the door.</Text>
        <Text style={{ ...a(BODY, DARK, 700), marginTop: 2 }}>Thursday: Turkish, Maths, IT, IT, P.E., P.E., elective</Text>
        <Text style={{ ...a(BODY), marginTop: 2, lineHeight: 1.2 }}>Helpers: Arda – board, Zehra – plants.</Text>
        <Text style={{ ...a(BODY, DARK, 700), marginTop: 2 }}>Please raise your hand!</Text>
      </At>
      {/* rating scale: self and peer */}
      <Fill b={scale} color="#fff" r={6} border={DARK} bw={1} />
      <Fill b={B(scale.x, scale.x + scale.w, scale.y, scale.y + 8 * MM)} color={C.tealTint} radii={{ borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
      <At b={scale}>
        <View style={{ flexDirection: "row", height: 8 * MM, alignItems: "center", paddingLeft: INSET }}>
          <Text style={{ ...lab(11, DARK), flex: 1 }}>HOW GOOD IS OUR GUIDE?</Text>
          <Text style={{ ...lab(11, DARK), width: 38 * MM, textAlign: "center" }}>ME</Text>
          <Text style={{ ...lab(11, DARK), width: 38 * MM, textAlign: "center" }}>MY FRIEND</Text>
        </View>
        {K.PROJECT_SCALE.map((c) => (
          <View key={c} style={{ flexDirection: "row", height: (scale.h! - 8 * MM) / K.PROJECT_SCALE.length, alignItems: "center", paddingLeft: INSET, borderTopWidth: 0.6, borderTopColor: "#D5DBE3" }}>
            <Text style={{ ...a(BODY), flex: 1 }}>{c}</Text>
            {[0, 1].map((k) => (
              <View key={k} style={{ width: 38 * MM, flexDirection: "row", justifyContent: "center" }}>
                {[0, 1, 2].map((s) => (
                  <View key={s} style={{ marginHorizontal: 3 }}>
                    <StarOutline />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      </At>
    </BookPage>
  );
}
function StarOutline() {
  const s = 13;
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? s * 0.22 : s * 0.5;
    const an = (i / 10) * 2 * Math.PI - Math.PI / 2;
    return `${s / 2 + Math.cos(an) * r},${s / 2 + Math.sin(an) * r}`;
  }).join(" ");
  return (
    <Svg width={s} height={s}>
      <Polygon points={pts} fill="#ffffff" stroke="#9A6B00" strokeWidth={0.9} />
    </Svg>
  );
}
/** The five words on Zehra's map (fractions of the map). */
const GUIDE_LABELS = [
  { t: "board", x: 0.5, y: 0.3 },
  { t: "desks", x: 0.5, y: 0.86 },
  { t: "door", x: 0.12, y: 0.86 },
  { t: "coat hooks", x: 0.17, y: 0.2 },
  { t: "bookcase", x: 0.86, y: 0.13 },
];
function guideMap(wPt: number, hPt: number) {
  return art.draw("guide-map-12b", wPt, hPt, (Wd, Hd) => {
    const u = Wd / 100;
    // a child's map of the classroom seen from above: 12 desks
    let s = `<rect width="${Wd}" height="${Hd}" fill="#FFFFFF"/><rect x="${u * 2}" y="${Hd * 0.06}" width="${u * 96}" height="${Hd * 0.88}" fill="#FFF7E3" stroke="#C98A00" stroke-width="${u * 0.8}"/>`;
    s += `<rect x="${u * 34}" y="${Hd * 0.12}" width="${u * 32}" height="${Hd * 0.07}" fill="#1F3B57"/>`;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) s += `<rect x="${u * (22 + c * 15)}" y="${Hd * (0.4 + r * 0.15)}" width="${u * 10}" height="${Hd * 0.09}" rx="${u}" fill="${C.teal}"/>`;
    s += `<rect x="${u * 2}" y="${Hd * 0.62}" width="${u * 3}" height="${Hd * 0.2}" fill="${C.coral}"/>`;
    for (let k = 0; k < 4; k++) s += `<circle cx="${u * 7}" cy="${Hd * (0.32 + k * 0.07)}" r="${u * 1.1}" fill="#607080"/>`;
    s += `<rect x="${u * 90}" y="${Hd * 0.2}" width="${u * 6}" height="${Hd * 0.3}" fill="#B07A52"/>`;
    return s;
  });
}

// --- p. 19: check yourself ------------------------------------------------------------------------
function SectionHead({ l, title, pts }: { l: string; title: string; pts: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
      <View style={{ width: 17, height: 17, borderRadius: 4, backgroundColor: DARK, alignItems: "center", justifyContent: "center", marginRight: 6 }}>
        <Text style={{ ...a(10, "#fff", 700), lineHeight: 1, marginTop: LIFTA(10) }}>{l}</Text>
      </View>
      <Text style={{ ...a(BODY, INK, 700), flex: 1 }}>{title}</Text>
      <Text style={a(BODY, DARK, 700)}>___ / {pts}</Text>
    </View>
  );
}
function SbCheck19() {
  const c3 = cells(cx(1), ce(12), 3, 6 * MM);
  return (
    <BookPage n={19}>
      <LessonHead n={12} title="Check Yourself" skills={["Self-assessment"]} />
      <At b={B(cx(1), ce(12), ry(7))}>
        <SectionHead l="A" title="What time is it? Write." pts={3} />
      </At>
      {K.CHECK.times.map((tm, i) => {
        const x = c3.at(i);
        return (
          <React.Fragment key={tm}>
            <Clock b={B(x, x + 30 * MM, ry(11), ry(11) + 30 * MM)} time={tm} rim={[C.teal, C.coral, C.lilac][i]} />
            <At b={B(x, x + c3.w, ry(11) + 31 * MM)}>
              <Line />
            </At>
          </React.Fragment>
        );
      })}
      <At b={B(cx(1), ce(6), ry(30))}>
        <SectionHead l="B" title="Circle the correct words." pts={4} />
        {K.CHECK.circle.map((it, i) => (
          <Row key={i} n={i + 1} h={8 * MM}>
            <Choice parts={it.parts} />
          </Row>
        ))}
      </At>
      <At b={B(cx(7), ce(12), ry(30))}>
        <SectionHead l="C" title="Write the school subjects." pts={4} />
        <View style={{ flexDirection: "row" }}>
          {K.CHECK.subjects.map((s) => (
            <View key={s} style={{ width: "25%", alignItems: "center", paddingHorizontal: 3 }}>
              <FlowPic src={A.subject(s)} d={34} />
              <Line />
            </View>
          ))}
        </View>
      </At>
      <At b={B(cx(1), ce(6), ry(48))}>
        <SectionHead l="D" title="Look at page 7. Answer." pts={4} />
        {K.CHECK.timetableQs.map((it, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 1 }}>
            <Num n={i + 1} />
            <View style={{ flex: 1 }}>
              <T>{it.q}</T>
              <Line h={7.5 * MM} />
            </View>
          </View>
        ))}
      </At>
      <At b={B(cx(7), ce(12), ry(48))}>
        <SectionHead l="E" title="Write the numbers in words." pts={5} />
        {K.CHECK.numbers.map((n) => (
          <View key={n} style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: INK, width: 32, lineHeight: 1, marginBottom: 3 }}>{n}</Text>
            <View style={{ flex: 1 }}>
              <Line h={7.8 * MM} />
            </View>
          </View>
        ))}
      </At>
      <Fill b={B(cx(7), ce(12), ry(67), ry(72))} color={C.sunTint} r={5} />
      <At b={B(cx(7) + INSET, ce(12) - INSET, ry(67), ry(72))}>
        <View style={{ flexDirection: "row", alignItems: "center", height: "100%" }}>
          <Text style={a(13, INK, 700)}>My score:   ______ / 20</Text>
        </View>
      </At>
      <At b={B(cx(1), ce(12), ry(73))}>
        <View style={{ flexDirection: "row", marginBottom: 2 }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 16, color: RED, lineHeight: 1, flex: 1 }}>I can ...</Text>
          {["WELL", "OK", "I NEED HELP"].map((h) => (
            <Text key={h} style={{ ...lab(11, DARK), width: 28 * MM, textAlign: "center" }}>{h}</Text>
          ))}
        </View>
        {K.CAN_DO.map((c) => (
          <View key={c} style={{ flexDirection: "row", alignItems: "center", height: 6.4 * MM, borderTopWidth: 0.6, borderTopColor: "#C9D2DC" }}>
            <Text style={{ ...a(BODY), flex: 1, lineHeight: 1, marginTop: LIFTA(BODY) }}>{c}</Text>
            {[0, 1, 2].map((k) => (
              <View key={k} style={{ width: 28 * MM, alignItems: "center" }}>
                <Tick size={12} />
              </View>
            ))}
          </View>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(97.5))}>
        <View style={{ flexDirection: "row" }}>
          {K.REFLECT.map((q) => (
            <View key={q} style={{ width: "50%", paddingRight: 10 }}>
              <T bold>{q}</T>
              <Line h={7.5 * MM} />
            </View>
          ))}
        </View>
      </At>
    </BookPage>
  );
}

// --- p. 20: word list (page numbers found in the rendered book) ------------------------------------------
/** wordKey -> first Student's Book page (3–19) it appears on; filled after a first render (main). */
const WORD_PAGES = new Map<string, number>();
function SbWords20() {
  const col = cells(cx(1), ce(12), 2, 6 * MM);
  const split = 5;
  const PAIRED = new Set(["Days of the week", "Numbers 50–100"]);
  const pageOf = (en: string) => WORD_PAGES.get(K.wordKey(en));
  const Entry = ({ en, tr, paired }: { en: string; tr: string; paired: boolean }) => (
    <>
      <Text style={{ ...a(11, INK, 700), width: paired ? "54%" : "47%", paddingLeft: 3, lineHeight: 1.18 }}>{en}</Text>
      <Text style={{ ...a(11, "#3F4A63"), flex: 1, lineHeight: 1.18, paddingRight: 3 }}>{tr}</Text>
      {!paired ? <Text style={{ ...lab(9, "#3F4A63"), width: 16, textAlign: "right", paddingRight: 3, marginTop: 2 }}>{pageOf(en) ?? ""}</Text> : null}
    </>
  );
  const Group = ({ g }: { g: (typeof K.WORDS)[number] }) => {
    const paired = PAIRED.has(g.topic);
    const rows: [string, string][][] = paired ? Array.from({ length: Math.ceil(g.words.length / 2) }, (_, i) => g.words.slice(i * 2, i * 2 + 2)) : g.words.map((w) => [w]);
    const pg = paired ? pageOf(g.words[0][0]) : undefined;
    return (
      <View style={{ marginBottom: 4 }} wrap={false}>
        <View style={{ backgroundColor: DARK, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2.5, marginBottom: 1, flexDirection: "row" }}>
          <Text style={{ ...lab(9.5, "#fff"), flex: 1 }}>{g.topic.toUpperCase()}</Text>
          <Text style={lab(9, "#fff")}>{paired ? (pg ? `PAGE ${pg}` : "") : "PAGE"}</Text>
        </View>
        {rows.map((r, i) => (
          <View key={i} style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#D5DEE6" }}>
            {r.map(([en, tr]) => (
              <View key={en} style={{ flexDirection: "row", width: paired ? "50%" : "100%", paddingRight: paired ? 4 : 0 }}>
                <Entry en={en} tr={tr} paired={paired} />
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };
  return (
    <BookPage n={20}>
      <At b={B(cx(1), ce(12), ry(0))}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 26, color: DARK, lineHeight: 1, paddingLeft: 3 }}>Word List · Unit 2</Text>
      </At>
      <At b={B(col.at(0), col.at(0) + col.w, ry(6))}>
        {K.WORDS.slice(0, split).map((g) => (
          <Group key={g.topic} g={g} />
        ))}
      </At>
      <At b={B(col.at(1), col.at(1) + col.w, ry(6))}>
        {K.WORDS.slice(split).map((g) => (
          <Group key={g.topic} g={g} />
        ))}
      </At>
    </BookPage>
  );
}

// ================================================================================================
// WORKBOOK
// ================================================================================================
function WbTitle() {
  return (
    <BookPage>
      <Fill b={B(0, W, 0, ry(36))} color={C.coralTint} />
      <ArtPic id="kite-wb" b={B(cx(1), ce(2), ry(3), ry(30))} make={() => art.kite("wb", ce(2) - cx(1), ry(30) - ry(3))} fit="contain" />
      <At b={B(cx(3), ce(12), ry(5))}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 40, color: RED, lineHeight: 1 }}>
          {TITLE} <Text style={{ color: DARK }}>{LEVEL}</Text> · Workbook
        </Text>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 19, color: INK, marginTop: 4 }}>Unit 2 · Our Classroom · Homework</Text>
        <Text style={{ ...a(BODY), marginTop: 2 }}>Do one page at home after each lesson in your Student&apos;s Book.</Text>
      </At>
      <At b={B(cx(1), ce(12), ry(39))}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 20, color: RED, lineHeight: 1 }}>My timetable</Text>
        <T>Write your own school timetable. Use it in your lessons!</T>
      </At>
      <MyTimetable b={B(cx(1), ce(12), ry(47), ry(84))} />
      <Panel b={B(cx(1), ce(12), ry(88), ry(97))} color={C.sunTint} title="SYMBOLS" titleColor="#8A5A00">
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
          <StarTag n={1} />
          <Text style={{ ...a(BODY), marginRight: 12 }}>for everybody</Text>
          <StarTag n={2} />
          <Text style={{ ...a(BODY), marginRight: 12 }}>more challenge</Text>
          <ExampleTag />
          <Text style={{ ...a(BODY), marginRight: 12 }}>done for you</Text>
          <Text style={lab(11, DARK)}>SB = STUDENT&apos;S BOOK PAGE</Text>
        </View>
      </Panel>
      <At b={B(cx(1), ce(12), ry(99))}>
        <Text style={{ ...a(11, "#3F4A63"), lineHeight: 1.3 }}>{IMPRINT("wb")}</Text>
      </At>
    </BookPage>
  );
}
function MyTimetable({ b }: { b: Box }) {
  const tw = 16 * MM;
  const dw = (b.w - tw) / 5;
  const hh = 8 * MM;
  const rh = (b.h! - hh) / 7;
  return (
    <>
      <Fill b={b} color="#fff" r={5} border={RED} bw={1} />
      <Fill b={B(b.x, b.x + b.w, b.y, b.y + hh)} color={C.coralTint} radii={{ borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />
      <At b={b}>
        <View style={{ flexDirection: "row", height: hh, alignItems: "center" }}>
          <Text style={{ ...lab(9, RED), width: tw, textAlign: "center" }}>TIME</Text>
          {K.DAYS5.map((d) => (
            <Text key={d} style={{ ...a(BODY, INK, 700), width: dw, textAlign: "center" }}>{d}</Text>
          ))}
        </View>
        {Array.from({ length: 7 }, (_, r) => (
          <View key={r} style={{ flexDirection: "row", height: rh, borderTopWidth: 0.6, borderTopColor: "#E2B8AC" }}>
            {Array.from({ length: 6 }, (_, c) => (
              <View key={c} style={{ width: c ? dw : tw, borderLeftWidth: c ? 0.6 : 0, borderLeftColor: "#E2B8AC" }} />
            ))}
          </View>
        ))}
      </At>
    </>
  );
}
const WbHead = ({ n, title, sb }: { n: string; title: string; sb: string }) => <LessonHead n={n} title={title} skills={[`SB ${sb}`]} part="wb" />;

/** A small cast picture from the vignette sheet (a labelled placeholder until the sheet exists). */
function Vig({ k, b }: { k: string; b: Box }) {
  const src = A.vignette(k);
  if (src) return <Pic b={b} src={src} fit="contain" name={`vignette ${k}`} />;
  const d = K.VIGNETTES.find((v) => v.key === k)!.desc;
  return <ArtPic id={`vig-${k}`} b={b} make={() => art.placeholder(`vig-${k}`, b.w, b.h!, `PICTURE TO COME: ${d}`, "#EEF3F8")} fit="contain" r={6} />;
}

function Wb2() {
  const draw = [K.WB_DRAW.example, ...K.WB_DRAW.items];
  const read = [K.WB_READ_CLOCKS.example, ...K.WB_READ_CLOCKS.items];
  const g = cells(cx(1), ce(12), 4, 4 * MM);
  const rc = 30 * MM;
  return (
    <BookPage n={2} part="wb">
      <WbHead n="1" title="Time" sb="4–7" />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={1} stars={1}>
          Draw the hands on the clocks.
        </Ex>
      </At>
      {draw.map((tm, i) => (
        <React.Fragment key={i}>
          <Clock b={B(g.at(i), g.at(i) + g.w, ry(12), ry(12) + 36 * MM)} time={i === 0 ? tm : ""} rim={[C.coral, C.teal, C.lilac, C.leaf][i]} />
          <At b={B(g.at(i), g.at(i) + g.w, ry(12) + 37 * MM)}>
            <Text style={{ ...a(BODY, i === 0 ? ANS : INK, 700), textAlign: "center" }}>
              {i === 0 ? "" : `${i}  `}
              {K.timeWords(tm)}
            </Text>
          </At>
        </React.Fragment>
      ))}
      <At b={B(cx(1), ce(12), ry(31.5))}>
        <Ex n={2} stars={1}>
          What time is it? Write.
        </Ex>
      </At>
      {read.map((tm, i) => (
        <React.Fragment key={i}>
          <Clock b={B(g.at(i) + (g.w - rc) / 2, g.at(i) + (g.w + rc) / 2, ry(36.5), ry(36.5) + rc)} time={tm} rim={[C.teal, C.coral, C.leaf, C.lilac][i]} />
          <At b={B(g.at(i), g.at(i) + g.w, ry(36.5) + rc)}>
            <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
              <Num n={i === 0 ? "" : i} w={i === 0 ? 0 : 14} />
              <View style={{ flex: 1 }}>
                <Line>{i === 0 ? `It's ${K.timeWords(tm)}.` : null}</Line>
              </View>
            </View>
          </At>
        </React.Fragment>
      ))}
      <At b={B(cx(1), ce(9), ry(54))}>
        <Ex n={3} stars={2}>
          Write the times in words. Use &quot;in the morning&quot; or &quot;in the afternoon&quot;.
        </Ex>
        <Row ex>
          <DigiTime t={K.WB_WORDS.example} />
          <Line w={92 * MM}>{K.timeWords(K.WB_WORDS.example, true)}</Line>
        </Row>
        {K.WB_WORDS.items.map((tm, i) => (
          <Row key={tm} n={i + 1}>
            <DigiTime t={tm} />
            <Line w={92 * MM} />
          </Row>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(82))}>
        <Ex n={4} stars={1}>
          Look at the timetable on SB page 7. Complete the sentences.
        </Ex>
        {K.WB_TT_SENTENCES.map((it, i) => (
          <Row key={i} n={i} ex={i === 0}>
            <Ws s={it.s[0]} />
            <Line w={34 * MM}>{i === 0 ? K.wbTtAnswer(it) : null}</Line>
            <Ws s={it.s[1]} />
          </Row>
        ))}
      </At>
      <Vig k="wb2" b={B(cx(10), ce(12), ry(57), ry(77))} />
    </BookPage>
  );
}

function Wb3() {
  const grid = K.crossGrid();
  const cell = 9 * MM;
  const ox = cx(1);
  const oy = ry(12);
  const starts = new Map<string, number>();
  let num = 0;
  for (const w of [...K.CROSS].sort((p, q) => p.r - q.r || p.c - q.c)) {
    const k = `${w.r},${w.c}`;
    if (!starts.has(k)) starts.set(k, ++num);
  }
  const clue = (w: (typeof K.CROSS)[number]) => starts.get(`${w.r},${w.c}`)!;
  const subjectOf: Record<string, string> = { MATHS: "Maths", MUSIC: "Music", SCIENCE: "Science", ENGLISH: "English", ART: "Art", TURKISH: "Turkish" };
  const clues = [...K.CROSS].sort((p, q) => clue(p) - clue(q) || Number(p.down) - Number(q.down));
  const ex = K.CROSS[0];
  const odd = K.WB_ODD;
  return (
    <BookPage n={3} part="wb">
      <WbHead n="2–3" title="School Subjects and Days" sb="8–9" />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={1} stars={1}>
          Look at the pictures. Complete the crossword.
        </Ex>
      </At>
      {[...grid.cells.entries()].map(([k]) => {
        const [r, c] = k.split(",").map(Number);
        const x = ox + c * cell;
        const y = oy + r * cell;
        const n = starts.get(k);
        const inExample = !ex.down && r === ex.r && c >= ex.c && c < ex.c + ex.word.length;
        return (
          <React.Fragment key={k}>
            <Fill b={B(x, x + cell, y, y + cell)} color="#fff" border={DARK} bw={0.9} />
            <At b={B(x, x + cell, y, y + cell)}>
              {n ? <Text style={{ ...lab(9, RED), position: "absolute", left: 1.5, top: 0.5 }}>{n}</Text> : null}
              {inExample ? (
                <View style={{ height: "100%", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ ...a(14, ANS, 700), lineHeight: 1, marginTop: LIFTA(14) }}>{grid.cells.get(k)}</Text>
                </View>
              ) : null}
            </At>
          </React.Fragment>
        );
      })}
      <At b={B(cx(7) + 6 * MM, ce(12), ry(12))}>
        {clues.map((w) => (
          <View key={w.word} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ ...a(BODY, DARK, 700), width: 62 }}>
              {clue(w)} {w.down ? "down ↓" : "across →"}
            </Text>
            <FlowPic src={A.subject(subjectOf[w.word])} d={26} />
            <Text style={{ ...a(BODY, "#3F4A63"), marginLeft: 6 }}>{w === ex ? "(example)" : `${w.word.length} letters`}</Text>
          </View>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(47))}>
        <Ex n={2} stars={1}>
          Write the missing letters.
        </Ex>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {["M_nday", ...K.WB_DAYS_GAPS].map((d, i) => (
            <View key={d} style={{ width: "50%", flexDirection: "row", alignItems: "center", height: 9.4 * MM }}>
              {i === 0 ? <ExampleTag /> : <Num n={i} />}
              {[...d].map((ch, j) =>
                ch === "_" ? (
                  <View key={j} style={{ marginHorizontal: 1 }}>
                    <WriteBox w={7 * MM}>{i === 0 ? "o" : null}</WriteBox>
                  </View>
                ) : (
                  <Text key={j} style={{ ...a(15, INK, 700), marginHorizontal: 0.6 }}>
                    {ch}
                  </Text>
                ),
              )}
            </View>
          ))}
        </View>
      </At>
      <At b={B(cx(1), ce(12), ry(66.5))}>
        <Ex n={3} stars={2}>
          Read and write the day.
        </Ex>
        {K.WB_DAY_RIDDLES.map((r, i) => (
          <Row key={i} n={i + 1}>
            <Text style={{ ...a(BODY), width: 96 * MM }}>{r.q}</Text>
            <Line w={46 * MM} />
          </Row>
        ))}
      </At>
      <At b={B(cx(1), ce(9), ry(83.5))}>
        <Ex n={4} stars={1}>
          Which word is different? Circle it.
        </Ex>
        {odd.map((it, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", height: 8 * MM }}>
            {i === 0 ? <ExampleTag /> : <Num n={i} />}
            {it.w.map((w) => (
              <View key={w} style={{ borderWidth: i === 0 && w === it.a ? 1.6 : 0, borderColor: ANS, borderRadius: 10, paddingHorizontal: 6, height: 6.4 * MM, justifyContent: "center", marginRight: 4 * MM }}>
                <Text style={{ ...a(BODY), lineHeight: 1, marginTop: LIFTA(BODY) }}>{w}</Text>
              </View>
            ))}
          </View>
        ))}
      </At>
      <Vig k="wb3" b={B(cx(10), ce(12), ry(84), ry(105))} />
    </BookPage>
  );
}

function Wb4() {
  const ws = K.wordSearch();
  const cell = 8.5 * MM;
  const ox = cx(1);
  const oy = ry(46);
  const ex = ws.placed[0];
  return (
    <BookPage n={4} part="wb">
      <WbHead n="3" title="Numbers and Classroom Objects" sb="9–10" />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={1} stars={1}>
          Read and write the numbers.
        </Ex>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {[K.WB_NUMBERS.example, ...K.WB_NUMBERS.items].map((n, i) => (
            <View key={n} style={{ width: "33.3%", flexDirection: "row", alignItems: "center", height: 10 * MM }}>
              {i === 0 ? <ExampleTag /> : <Num n={i} />}
              <Text style={{ ...a(BODY), width: 27 * MM }}>{K.numberWords(n)}</Text>
              <WriteBox w={12 * MM}>{i === 0 ? String(n) : null}</WriteBox>
            </View>
          ))}
        </View>
      </At>
      <At b={B(cx(1), ce(9), ry(22))}>
        <Ex n={2} stars={2}>
          Continue the number patterns. Then say them aloud.
        </Ex>
        {K.WB_PATTERNS.map((p, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", height: 10 * MM }}>
            <Num n={i + 1} />
            {p.seq.map((n, j) => (
              <View key={j} style={{ width: 13 * MM, height: 8 * MM, borderRadius: 4 * MM, backgroundColor: n === null ? "#fff" : C.tealTint, borderWidth: n === null ? 1 : 0, borderColor: DARK, alignItems: "center", justifyContent: "center", marginRight: 9 }}>
                <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: INK, lineHeight: 1, marginTop: LIFTB(15) }}>{n ?? ""}</Text>
              </View>
            ))}
          </View>
        ))}
      </At>
      <Vig k="wb4" b={B(cx(10), ce(12), ry(20), ry(40))} />
      <At b={B(cx(1), ce(12), ry(40))}>
        <Ex n={3} stars={1}>
          Find eight classroom objects (→ and ↓). Then write the words.
        </Ex>
      </At>
      {ws.letters.map((row, r) =>
        row.map((ch, c) => {
          const inEx = ex.down ? c === ex.c && r >= ex.r && r < ex.r + ex.word.length : r === ex.r && c >= ex.c && c < ex.c + ex.word.length;
          return (
            <React.Fragment key={`${r}-${c}`}>
              {inEx ? <Fill b={B(ox + c * cell + 0.6 * MM, ox + (c + 1) * cell - 0.6 * MM, oy + r * cell + 0.6 * MM, oy + (r + 1) * cell - 0.6 * MM)} color="#CFE0FF" r={4} /> : null}
              <At b={B(ox + c * cell, ox + (c + 1) * cell, oy + r * cell, oy + (r + 1) * cell)}>
                <View style={{ height: "100%", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: 15, color: INK, lineHeight: 1, marginTop: LIFTA(15) }}>{ch}</Text>
                </View>
              </At>
            </React.Fragment>
          );
        }),
      )}
      <Fill b={B(ox - 1.5 * MM, ox + 10 * cell + 1.5 * MM, oy - 1.5 * MM, oy + 10 * cell + 1.5 * MM)} color="transparent" r={6} border={DARK} bw={1.2} />
      <At b={B(cx(8), ce(12), ry(46))}>
        {Array.from({ length: 8 }, (_, i) => (
          <Row key={i} n={i + 1} h={10 * MM}>
            <View style={{ flex: 1 }}>
              <Line h={10 * MM}>{i === 0 ? ex.word.toLowerCase() : null}</Line>
            </View>
          </Row>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(84))}>
        <Ex n={4} stars={2}>
          Maths in English! Write the answers in words.
        </Ex>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {K.WB_SUMS.map((q, i) => (
            <View key={i} style={{ width: "50%", paddingRight: 10 }}>
              <Row n={i} ex={i === 0}>
                <Ws s={`${q.s} =`} />
                <View style={{ flex: 1, marginLeft: 4 }}>
                  <Line>{i === 0 ? K.numberWords(q.a) : null}</Line>
                </View>
              </Row>
            </View>
          ))}
        </View>
      </At>
    </BookPage>
  );
}

function Wb5() {
  const dl = K.WB_DIALOGUE;
  const pics = K.WB_RIDDLES.filter((r) => r.pic);
  return (
    <BookPage n={5} part="wb">
      <WbHead n="4" title="Who am I?" sb="5, 10" />
      <At b={B(cx(1), ce(10), ry(7))}>
        <Ex n={1} stars={1}>
          Read and write the classroom object. The pictures can help you.
        </Ex>
        {K.WB_RIDDLES.map((r, i) => (
          // number and EXAMPLE tag on the first line of the riddle; the write-on line under its last line
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", minHeight: LINE_H, paddingTop: 2, marginBottom: 1 }} wrap={false}>
            {i === 0 ? <ExampleTag /> : <Num n={i} />}
            <Text style={{ ...a(BODY), width: 86 * MM - (i === 0 ? 42 : 0), lineHeight: 1.2 }}>{r.q}</Text>
            <View style={{ alignSelf: "flex-end" }}>
              <Line w={44 * MM}>{i === 0 ? r.a : null}</Line>
            </View>
          </View>
        ))}
      </At>
      <Fill b={B(cx(11), ce(12), ry(8), ry(33))} color={C.sunTint} r={6} />
      <At b={B(cx(11), ce(12), ry(9))}>
        {pics.map((r) => (
          <View key={r.pic} style={{ alignItems: "center", marginBottom: 2 }}>
            <FlowPic src={A.object(r.pic!)} d={33} />
          </View>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(36))}>
        <Ex n={2} stars={1}>
          Complete the dialogue with the words in the box.
        </Ex>
        <WordBox words={dl.box} struck={dl.box[0]} />
        {dl.lines.map((l, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-end", minHeight: 11 * MM, flexWrap: "wrap" }}>
            <Text style={{ ...a(BODY, DARK, 700), width: 50 }}>{l.who}:</Text>
            {l.parts.map((p, j) =>
              typeof p === "string" ? (
                <Text key={j} style={{ ...a(BODY), marginBottom: 2 }}>
                  {p}
                </Text>
              ) : (
                <Line key={j} w={p === 1 || p === 2 ? 34 * MM : 30 * MM}>
                  {p === 0 ? dl.box[0] : null}
                </Line>
              ),
            )}
          </View>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(62))}>
        <Ex n={3} stars={2}>
          What is in your pencil case? Write three sentences with There is / There are.
        </Ex>
        <Row ex>
          <Text style={a(BODY, ANS, 700)}>There are two pencils in my pencil case.</Text>
        </Row>
        {[1, 2, 3].map((i) => (
          <Row key={i} n={i}>
            <View style={{ flex: 1 }}>
              <Line />
            </View>
          </Row>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(81))}>
        <Ex n={4} stars={1}>
          Look at our class rules (SB page 5). Which rule is it? Write the number.
        </Ex>
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: cx(8) - cx(1) - 3 * MM }}>
            {[K.WB_RULES_MATCH.example, ...K.WB_RULES_MATCH.items].map((it, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", minHeight: 9 * MM }}>
                {i === 0 ? <ExampleTag /> : <Num n={i} />}
                <Text style={{ ...a(BODY), flex: 1, lineHeight: 1.15 }}>{it.s}</Text>
                <WriteBox>{i === 0 ? String(it.a) : null}</WriteBox>
              </View>
            ))}
          </View>
          <View style={{ marginLeft: 3 * MM, flex: 1 }}>
            <View style={{ backgroundColor: C.coralTint, borderRadius: 6, padding: 6 }}>
              {K.RULES.map((r, i) => (
                <View key={r} style={{ flexDirection: "row", marginBottom: 2 }}>
                  <Text style={{ ...a(BODY, DARK, 700), width: 14 }}>{i + 1}</Text>
                  <Text style={{ ...a(BODY), flex: 1, lineHeight: 1.15 }}>{r}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </At>
    </BookPage>
  );
}

function Wb6() {
  const cup = B(cx(1), ce(6), ry(12), ry(51));
  const right = B(cx(7), ce(12), ry(12));
  return (
    <BookPage n={6} part="wb">
      <WbHead n="5" title="There is / There are · Me, him, her ..." sb="11" />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={1} stars={1}>
          Look at the Art cupboard. Circle the correct words.
        </Ex>
      </At>
      <ArtPic id="cupboard" b={cup} make={() => art.artCupboard(cup.w, cup.h!)} r={6} />
      <At b={right}>
        {K.WB_CUP_CIRCLE.map((it, i) => (
          <Row key={i} n={i} ex={i === 0}>
            <Choice parts={it.parts} answer={i === 0 ? it.a : undefined} />
          </Row>
        ))}
      </At>
      <At b={B(cx(7), ce(12), ry(31.5))}>
        <Ex n={2} stars={1}>
          Count and answer.
        </Ex>
        {K.WB_CUP_COUNT.map((q, i) => (
          <View key={i} style={{ marginBottom: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {i === 0 ? <ExampleTag /> : <Num n={i} />}
              <Text style={{ ...a(BODY), flex: 1 }}>{q.q}</Text>
            </View>
            <Line>{i === 0 ? q.a : null}</Line>
          </View>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(53.5))}>
        <Ex n={3} stars={2}>
          Write him, her, it, us or them for the blue words.
        </Ex>
        {[K.WB_PRON.example, ...K.WB_PRON.items].map((it, i) => (
          <Row key={i} n={i} ex={i === 0}>
            <Ws s={it.s[0]} />
            <Ws s={it.s[1]} color="#1D5BB5" bold />
            <Ws s={`${it.s[2]}  →  `} />
            <Ws s={it.s[0]} />
            <Line w={30 * MM}>{i === 0 ? it.a : null}</Line>
            <Ws s={it.s[2]} />
          </Row>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(76.5))}>
        <Ex n={4} stars={2}>
          Put the words in order. Write the questions.
        </Ex>
        {K.WB_JUMBLED.map((it, i) => (
          <View key={i} style={{ marginBottom: 1 }} wrap={false}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
              {i === 0 ? <ExampleTag /> : <Num n={i} />}
              {it.w.map((w, j) => (
                <View key={j} style={{ borderWidth: 1, borderColor: "#9AA3B5", borderRadius: 4, paddingHorizontal: 5, height: 6.4 * MM, justifyContent: "center", marginRight: 3 * MM, backgroundColor: C.tealTint }}>
                  <Text style={{ ...a(BODY), lineHeight: 1, marginTop: LIFTA(BODY) }}>{w}</Text>
                </View>
              ))}
            </View>
            <View style={{ paddingLeft: 18 }}>
              <Line>{i === 0 ? it.a : null}</Line>
            </View>
          </View>
        ))}
      </At>
    </BookPage>
  );
}

function Wb7() {
  const club = B(cx(1), ce(12), ry(8), ry(27));
  const hh = 7 * MM;
  const rh = (club.h! - hh) / K.CLUBS.length;
  const cw = [0.34, 0.24, 0.16, 0.26];
  const heads = ["CLUB", "DAY", "TIME", "MEMBER"];
  return (
    <BookPage n={7} part="wb">
      <WbHead n="5" title="Routines and Time" sb="12" />
      <Fill b={club} color="#fff" r={6} border={C.lilac} bw={1.2} />
      <Fill b={B(club.x, club.x + club.w, club.y, club.y + hh)} color="#5B3FA0" radii={{ borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
      <At b={club}>
        <View style={{ flexDirection: "row", height: hh, alignItems: "center", paddingHorizontal: 8 }}>
          {heads.map((h, j) => (
            <Text key={h} style={{ ...lab(11, "#fff"), width: `${cw[j] * 100}%` }}>
              {j === 0 ? `AFTER-SCHOOL ${h}S` : h}
            </Text>
          ))}
        </View>
        {K.CLUBS.map(([c, d, tm, who], i) => (
          <View key={c} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, height: rh, borderTopWidth: i ? 0.6 : 0, borderTopColor: "#D9CFF0" }}>
            <Text style={{ ...a(BODY, INK, 700), width: `${cw[0] * 100}%` }}>{c}</Text>
            <Text style={{ ...a(BODY), width: `${cw[1] * 100}%` }}>{d}s</Text>
            <Text style={{ ...a(BODY, "#5B3FA0", 700), width: `${cw[2] * 100}%` }}>{tm}</Text>
            <Text style={{ ...a(BODY), width: `${cw[3] * 100}%` }}>{who}</Text>
          </View>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(30))}>
        <Ex n={1} stars={1}>
          Look at the clubs. Answer: Yes, he does. / No, she doesn&apos;t.
        </Ex>
        {K.WB_CLUB_DOES.map((q, i) => (
          <Row key={i} n={i} ex={i === 0}>
            <Text style={{ ...a(BODY), width: 104 * MM }}>{q.q}</Text>
            <Line w={52 * MM}>{i === 0 ? q.a : null}</Line>
          </Row>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(46))}>
        <Ex n={2} stars={1}>
          Write sentences.
        </Ex>
        {[K.WB_CLUB_3RD.example, ...K.WB_CLUB_3RD.items].map((it, i) => (
          <Row key={i} n={i} ex={i === 0}>
            <Text style={{ ...a(BODY, "#3F4A63"), width: 68 * MM }}>{it.s}</Text>
            <View style={{ flex: 1 }}>
              <Line>{i === 0 ? it.a : null}</Line>
            </View>
          </Row>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(63.5))}>
        <Ex n={3} stars={1}>
          Match the questions with the answers.
        </Ex>
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: "56%" }}>
            {K.WB_CLUB_MATCH.qs.map((q, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", height: LINE_H }}>
                <Num n={i + 1} />
                <Text style={{ ...a(BODY), flex: 1 }}>{q}</Text>
                <WriteBox>{i === 0 ? "abcd"[K.WB_CLUB_MATCH.key[0]] : null}</WriteBox>
              </View>
            ))}
          </View>
          <View style={{ width: "44%", paddingLeft: 16 }}>
            {K.WB_CLUB_MATCH.as.map((s, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", height: LINE_H }}>
                <Text style={{ ...a(BODY, DARK, 700), width: 16 }}>{"abcd"[i]}</Text>
                <T>{s}</T>
              </View>
            ))}
          </View>
        </View>
      </At>
      <At b={B(cx(1), ce(9), ry(83.5))}>
        <Ex n={4} stars={2}>
          Write two sentences about your day. Use get up and have dinner.
        </Ex>
        {[1, 2].map((i) => (
          <Row key={i} n={i}>
            <View style={{ flex: 1 }}>
              <Line />
            </View>
          </Row>
        ))}
      </At>
      <Vig k="wb7" b={B(cx(10), ce(12), ry(86), ry(106))} />
    </BookPage>
  );
}

function Wb8() {
  return (
    <BookPage n={8} part="wb">
      <WbHead n="7–8" title="Read and Write" sb="14–15" />
      <Fill b={B(cx(1), ce(12), ry(8), ry(40))} color={C.paper} r={6} border="#D9C9A3" bw={1} />
      <At b={B(cx(1) + INSET, ce(12) - INSET, ry(9))}>
        <View style={{ borderBottomWidth: 0.8, borderBottomColor: "#D9C9A3", paddingBottom: 3, marginBottom: 4 }}>
          <Text style={lab(11, DARK)}>TO: SELIN · FROM: DEFNE · MY NEW CLASS</Text>
        </View>
        {K.DEFNE_EMAIL.map((p, i) => (
          <Text key={i} style={{ ...a(READ), lineHeight: 1.34, marginBottom: 2 }}>
            {p}
          </Text>
        ))}
      </At>
      <At b={B(cx(1), ce(7), ry(43))}>
        <Ex n={1} stars={1}>
          Read Defne&apos;s e-mail. Write T or F.
        </Ex>
        {K.WB_EMAIL_TF.map((it, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", height: LINE_H }}>
            {i === 0 ? <ExampleTag /> : <Num n={i} />}
            <Text style={{ ...a(BODY), flex: 1 }}>{it.s}</Text>
            <WriteBox>{i === 0 ? (it.a ? "T" : "F") : null}</WriteBox>
          </View>
        ))}
      </At>
      <At b={B(cx(8), ce(12), ry(43))}>
        <Ex n={2} stars={2}>
          Answer the questions.
        </Ex>
        {K.WB_EMAIL_QS.map((q, i) => (
          <View key={i} style={{ marginBottom: 2 }}>
            <Text style={a(BODY)}>
              <Bo c={DARK}>{i + 1} </Bo>
              {q.q}
            </Text>
            <Line />
          </View>
        ))}
      </At>
      <At b={B(cx(1), ce(8), ry(70))}>
        <Ex n={3} stars={1}>
          Write a reply to Defne. Tell her about your class and your favourite day.
        </Ex>
        <Line>Hi Defne,</Line>
        {Array.from({ length: 4 }, (_, i) => (
          <Line key={i} />
        ))}
      </At>
      <Panel b={B(cx(9), ce(12), ry(72), ry(92))} color={C.leafTint} border={C.leaf} title="CHECK" titleColor="#2E7031">
        {["Hi ... / Love, ...", "the number of students", "your favourite day and why"].map((c) => (
          <View key={c} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Tick />
            <Text style={{ ...a(BODY), marginLeft: 5, flex: 1, lineHeight: 1.15 }}>{c}</Text>
          </View>
        ))}
      </Panel>
      <Vig k="wb8" b={B(cx(9), ce(12), ry(93), ry(106))} />
    </BookPage>
  );
}

function Wb9() {
  const ex = K.WB_EXPRESSIONS;
  return (
    <BookPage n={9} part="wb">
      <WbHead n="9–10" title="Around the World · The Story" sb="16–18" />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={1} stars={1}>
          Write the country: South Korea, Kazakhstan or Australia.
        </Ex>
        {K.WB_CLIL.map((it, i) => (
          <Row key={i} n={i} ex={i === 0}>
            <T>In </T>
            <Line w={38 * MM}>{i === 0 ? it.a : null}</Line>
            <Ws s={`, ${it.s}`} />
          </Row>
        ))}
      </At>
      <At b={B(cx(1), ce(6), ry(25))}>
        <Ex n={2} stars={1}>
          Who says it in the story?
        </Ex>
        {K.WB_WHO.map((it, i) => (
          <View key={i} style={{ marginBottom: 1 }}>
            <Text style={a(BODY)}>
              {i === 0 ? null : <Bo c={DARK}>{i} </Bo>}&quot;{it.s}&quot;
            </Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
              {i === 0 ? <ExampleTag /> : null}
              <Line w={36 * MM}>{i === 0 ? it.a : null}</Line>
            </View>
          </View>
        ))}
      </At>
      <At b={B(cx(7), ce(12), ry(25))}>
        <Ex n={3} stars={1}>
          Match. Write the letter.
        </Ex>
        {ex.left.map((s, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", minHeight: LINE_H }}>
            <Num n={i + 1} />
            <Text style={{ ...a(BODY), flex: 1, lineHeight: 1.15 }}>{s}</Text>
            <WriteBox>{i === 0 ? "abcd"[ex.key[0]] : null}</WriteBox>
          </View>
        ))}
        <View style={{ marginTop: 4 }}>
          {ex.right.map((s, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
              <Text style={{ ...a(BODY, DARK, 700), width: 16 }}>{"abcd"[i]}</Text>
              <Text style={{ ...a(BODY), flex: 1 }}>{s}</Text>
            </View>
          ))}
        </View>
      </At>
      <At b={B(cx(1), ce(12), ry(72))}>
        <Ex n={4} stars={2}>
          Your school in Türkiye: write two sentences about your school day.
        </Ex>
        <Row ex>
          <Text style={a(BODY, ANS, 700)}>In Türkiye, the school year starts in September.</Text>
        </Row>
        {[1, 2].map((i) => (
          <Row key={i} n={i}>
            <View style={{ flex: 1 }}>
              <Line />
            </View>
          </Row>
        ))}
      </At>
      <Vig k="wb9" b={B(cx(5), ce(8), ry(57), ry(70))} />
    </BookPage>
  );
}

function Wb10() {
  const R = K.WB_REVIEW;
  const half = cells(cx(1), ce(12), 2, 6 * MM);
  const ck = 30 * MM;
  return (
    <BookPage n={10} part="wb">
      <WbHead n="R" title="Review" sb="4–19" />
      <At b={B(cx(1), ce(12), ry(7))}>
        <SectionHead l="A" title="What time is it? Write." pts={R.times.length} />
      </At>
      {R.times.map((tm, i) => {
        const x = half.at(i % 2);
        const y = ry(11) + Math.floor(i / 2) * (ck + 3 * MM);
        return (
          <React.Fragment key={tm}>
            <Clock b={B(x, x + ck, y, y + ck)} time={tm} rim={[C.coral, C.teal, C.lilac, C.leaf][i]} />
            <At b={B(x + ck + 4 * MM, x + half.w, y + ck / 2 - 2 * MM)}>
              <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                <Num n={i + 1} />
                <View style={{ flex: 1 }}>
                  <Line />
                </View>
              </View>
            </At>
          </React.Fragment>
        );
      })}
      <At b={B(half.at(0), half.at(0) + half.w, ry(40))}>
        <SectionHead l="B" title="Which lesson is it?" pts={R.subjects.length} />
        {R.subjects.map((s, i) => (
          <View key={i} style={{ marginBottom: 1 }}>
            <Text style={a(BODY)}>
              <Bo c={DARK}>{i + 1} </Bo>
              {s.clue}
            </Text>
            <Line w="70%" />
          </View>
        ))}
      </At>
      <At b={B(half.at(1), half.at(1) + half.w, ry(40))}>
        <SectionHead l="C" title="Circle the correct words." pts={R.circle.length} />
        {R.circle.map((it, i) => (
          <Row key={i} n={i + 1}>
            <Choice parts={it.parts} />
          </Row>
        ))}
      </At>
      <At b={B(cx(1), ce(12), ry(64))}>
        <SectionHead l="D" title="Write the numbers." pts={R.numbers.length} />
        <View style={{ flexDirection: "row" }}>
          {R.numbers.map((n, i) => (
            <View key={i} style={{ width: "25%", flexDirection: "row", alignItems: "center", height: 10 * MM }}>
              <Num n={i + 1} w={14} />
              <Text style={{ ...a(BODY), width: 27 * MM }}>{n.w}</Text>
              <WriteBox w={11 * MM} />
            </View>
          ))}
        </View>
      </At>
      <At b={B(cx(1), ce(12), ry(74))}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <StarTag n={2} />
          <View style={{ flex: 1 }}>
            <SectionHead l="E" title={R.write} pts={20 - R.times.length - R.subjects.length - R.circle.length - R.numbers.length} />
          </View>
        </View>
        {[1, 2, 3].map((i) => (
          <Line key={i} />
        ))}
      </At>
      <Fill b={B(cx(1), ce(12), ry(97), ry(105))} color={C.sunTint} r={5} />
      <At b={B(cx(1) + INSET, ce(12) - INSET, ry(97), ry(105))}>
        <View style={{ flexDirection: "row", alignItems: "center", height: "100%", justifyContent: "space-between" }}>
          <Text style={a(13, INK, 700)}>My score:   ______ / 20</Text>
          <T>Need help? Look at SB pages 6–12 again.</T>
        </View>
      </At>
    </BookPage>
  );
}

function Wb11() {
  const keyW = cells(cx(1), ce(12), 10, 2 * MM);
  const code = Object.entries(K.CODE);
  const wordBox = 19 * MM;
  const pc = 26 * MM;
  const pr = 15 * MM;
  const px = cx(1) + 2 * MM;
  const py = ry(57);
  const path = K.PATH_GRID;
  return (
    <BookPage n={11} part="wb">
      <WbHead n="P" title="Puzzle Time" sb="6–12" />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={1} stars={1}>
          Secret words! Read the numbers. Find the letters in the code. Write the words.
        </Ex>
      </At>
      {code.map(([ch, n], i) => (
        <React.Fragment key={ch}>
          <Fill b={B(keyW.at(i), keyW.at(i) + keyW.w, ry(12), ry(12) + 16 * MM)} color={C.tealTint} r={4} border={C.teal} bw={0.8} />
          <At b={B(keyW.at(i), keyW.at(i) + keyW.w, ry(12) + 1.5 * MM)}>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 18, color: INK, textAlign: "center", lineHeight: 1 }}>{ch}</Text>
            <Text style={{ ...a(BODY, DARK, 700), textAlign: "center", marginTop: 2 }}>{n}</Text>
          </At>
        </React.Fragment>
      ))}
      {K.CODE_WORDS.map((w, wi) => {
        const y = ry(22) + wi * 18 * MM;
        return (
          <React.Fragment key={w}>
            <At b={B(cx(1), cx(1) + 10 * MM, y + 2 * MM)}>
              <Text style={a(BODY, DARK, 700)}>{wi + 1}</Text>
            </At>
            {[...w].map((ch, j) => {
              const x = cx(1) + 7 * MM + j * wordBox;
              const words = K.numberWords(K.CODE[ch]).split("-");
              return (
                <React.Fragment key={j}>
                  <At b={B(x, x + wordBox - 2 * MM, y)}>
                    <WriteBox w={wordBox - 2 * MM}>{wi === 0 && j === 0 ? ch : null}</WriteBox>
                    {words.map((p, k) => (
                      <Text key={k} style={{ ...a(11, "#3F4A63"), textAlign: "center", lineHeight: 1.05, marginTop: k ? 0 : 1 }}>
                        {p}
                        {k < words.length - 1 ? "-" : ""}
                      </Text>
                    ))}
                  </At>
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}
      <At b={B(cx(1), ce(12), ry(46))}>
        <Ex n={2} stars={2}>
          The time path. Look at the timetable on SB page 7. Colour the start times of the lessons on Mondays, in order. Go → or ↓.
        </Ex>
      </At>
      {path.map((row, r) =>
        row.map((tm, c) => {
          const x = px + c * (pc + 3 * MM);
          const y = py + r * (pr + 3 * MM);
          const start = r === 0 && c === 0;
          return (
            <React.Fragment key={`${r}-${c}`}>
              <Fill b={B(x, x + pc, y, y + pr)} color={start ? C.sun : "#fff"} r={6} border={DARK} bw={1} />
              <At b={B(x, x + pc, y, y + pr)}>
                <View style={{ height: "100%", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 16, color: INK, lineHeight: 1, marginTop: LIFTB(16) }}>{tm}</Text>
                </View>
              </At>
            </React.Fragment>
          );
        }),
      )}
      <At b={B(px, px + pc, py - 5 * MM)}>
        <Text style={{ ...lab(11, RED), textAlign: "center" }}>START</Text>
      </At>
      <At b={B(cx(9), ce(12), py)}>
        <Text style={{ ...a(BODY), lineHeight: 1.3 }}>Which lesson starts at 10:35 on Mondays?</Text>
        <Line />
        <Text style={{ ...a(BODY), lineHeight: 1.3, marginTop: 6 }}>How many lessons are on your path?</Text>
        <Line />
      </At>
    </BookPage>
  );
}

/** WB p. 12: my picture dictionary (draw, no cutting: the page backs onto the puzzles). */
const WB_CARDS = ["Maths", "Music", "P.E.", "Art", "ruler", "glue", "scissors", "clock", "notebook", "rubbish bin", "board marker", "Monday"];
function Wb12() {
  const g = cells(cx(1), ce(12), 4, 4 * MM);
  const ch = 50 * MM;
  const y0 = ry(16);
  return (
    <BookPage n={12} part="wb">
      <WbHead n="D" title="My Picture Dictionary" sb="8–20" />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Ex n={1} stars={1}>
          Draw a picture for each word. Then cover the words and test a friend: &quot;What&apos;s this?&quot;
        </Ex>
      </At>
      {WB_CARDS.map((w, i) => {
        const x = g.at(i % 4);
        const y = y0 + Math.floor(i / 4) * (ch + 23 * MM);
        const pic = i === 0 ? A.subject("Maths") : null;
        return (
          <React.Fragment key={w}>
            <Fill b={B(x, x + g.w, y, y + ch + 19 * MM)} color="#fff" r={8} border={[C.coral, C.teal, C.lilac, C.leaf][i % 4]} bw={1.4} />
            {pic ? <Pic b={B(x + 6 * MM, x + g.w - 6 * MM, y + 4 * MM, y + ch + 6 * MM)} src={pic} fit="contain" name="Maths card" /> : null}
            <Fill b={B(x, x + g.w, y + ch + 9 * MM, y + ch + 19 * MM)} color={[C.coralTint, C.tealTint, "#EEE8FA", C.leafTint][i % 4]} radii={{ borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }} />
            <At b={B(x, x + g.w, y + ch + 9 * MM, y + ch + 19 * MM)}>
              <View style={{ height: "100%", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ ...a(14, INK, 700), lineHeight: 1, marginTop: LIFTA(14) }}>{w}</Text>
              </View>
            </At>
            {i === 0 ? (
              <At b={B(x + 2 * MM, x + 24 * MM, y + 2 * MM)}>
                <ExampleTag />
              </At>
            ) : null}
          </React.Fragment>
        );
      })}
    </BookPage>
  );
}

// --- teacher's pages (a separate file): answer key and audio scripts ------------------------------------
type KeyGroup = { head: string; lines: string[] };
function pick(it: { parts: readonly (string | readonly string[])[]; a: number }) {
  return (it.parts.find((p) => typeof p !== "string") as readonly string[])[it.a];
}
function pathAnswer() {
  const mon = K.TIMETABLE.Monday;
  const at = K.PERIODS.indexOf("10:35");
  return { times: K.PERIODS.join(" → "), lesson: mon[at], count: K.PERIODS.length };
}
function keyGroups(): KeyGroup[] {
  const L = "abcdef";
  const tt = K.TIMETABLE;
  const ws = K.wordSearch();
  const pa = pathAnswer();
  return [
    { head: "SB 4–5", lines: [`${exN("e1")}  ${K.EX1.items.map((it, i) => `${i + 1} ${it.a}`).join("  ")}`, `${exN("e2")}  ${K.EX2.items.map((it, i) => `${i + 1} ${pick(it)}`).join("  ")}`, `${exN("rules")}  ${K.RULE_PICS.map((r, i) => `${"abcde"[i]} ${r + 1}`).join("  ")}`] },
    {
      head: "SB 6–7",
      lines: [
        `${exN("e3")}  ticked: ${K.EX3_TOPICS.filter((x) => x[1]).map((x) => x[0]).join(", ")}`,
        `${exN("e4")}  ${K.EX4_TIMES.map((tm, i) => `${i + 1} ${L[K.EX4_CLOCKS.indexOf(tm)]}`).join("  ")}`,
        `${exN("e5")}  ${K.EX5.items.map((tm, i) => `${i + 1} ${K.timeWords(tm, true)}`).join("; ")}`,
        `${exN("e6")}  ${K.TT_GAPS.map(([d, i]) => `${d.slice(0, 3)} ${K.PERIODS[i]} ${tt[d][i]}`).join("; ")}`,
      ],
    },
    {
      head: "SB 8–10",
      lines: [
        `${exN("e9")}  a dot (•) over the negative word, ↘ at the end of every sentence`,
        `${exN("e10")}  ${K.EX11_TILES.map((s, i) => `${i + 1} ${s}`).join(", ")}`,
        `${exN("e11")}  ${K.EX12_CHIPS.map((d) => `${d} ${K.DAYS7.indexOf(d as (typeof K.DAYS7)[number]) + 1}`).join(", ")}; weekend: Saturday and Sunday`,
        `${exN("e12")}  ${K.EX13.numbers.map((n, i) => `${i + 1} ${L[K.EX13.words.indexOf(n)]}`).join("  ")}`,
        `${exN("e13")}  ${K.EX14.items.map((it, i) => `${i + 1} ${it.a}`).join("  ")}; in words: ${[K.EX14.example, ...K.EX14.items].map((it) => K.numberWords(it.a)).join(", ")}`,
        `${exN("e14")}  ${K.SCENE_OBJECTS.map((o, i) => `${i + 1} ${o}`).join(", ")}`,
        `${exN("e15")}  ${K.EX16.cards.map((c, i) => `${i + 1} ${K.EX16.defs.find((d) => d[2] === c)![0]}`).join("  ")}`,
      ],
    },
    {
      head: "SB 11–12",
      lines: [
        `Notice: ${K.NOTICE_THERE.a}; ${K.NOTICE_PRON.a}; ${K.NOTICE_HAVE.a}`,
        `${exN("e17")}  ${K.EX18.items.map((it, i) => `${i + 1} ${pick(it)}`).join("  ")}`,
        `${exN("spot")}  ${K.DIFFERENCES.join("; ")}`,
        `${exN("e18")}  ${K.EX_PRON.items.map((it, i) => `${i + 1} ${pick(it)}`).join("  ")}`,
        `${exN("e19")}  ${K.EX19.items.map((it, i) => `${i + 1} ${K.has(it.subject, it.day) ? "have" : "don't have"}`).join("  ")}`,
        `${exN("e20")}  ${K.EX_3RD.items.map((it, i) => `${i + 1} ${it.a}`).join("  ")}`,
        `${exN("e21")}  ${K.EX_DOES.items.map((it, i) => `${i + 1} ${it.a}`).join("  ")}`,
        `${exN("e22")}  ${K.EX20.items.map((it, i) => `${i + 1} It starts at ${K.timeWords(K.startOf(it.subject, it.day))}.`).join(" ")}`,
      ],
    },
    {
      head: "SB 14–16",
      lines: [
        `${exN("e24")}  ${K.EX23.a}`,
        `${exN("e25")}  ${K.EX24.items.map((it, i) => `${i + 1} ${it.a ? "T" : "F"}`).join("  ")}`,
        `${exN("survey15")}  one-star table, Zehra: ${K.SURVEY_ROWS.map((r, i) => `${r} ${K.SURVEY_ZEHRA[i]}`).join(", ")}`,
        `${exN("e29")}  ${K.CLIL_PICS.map((p, i) => `${i + 1} ${p.k === "-" ? "extra" : p.k}`).join("  ")}`,
        `${exN("e30")}  ${K.EX31.items.map((it, i) => `${i + 1} ${it.a}`).join("  ")}`,
      ],
    },
    {
      head: "SB 17–19",
      lines: [
        `${exN("e31")}  ${K.EX33.a}`,
        `${exN("e32")}  ${K.EX35.items.map((it, i) => `${i + 1} ${it.a}`).join(" ")}`,
        `${exN("seq")}  ${K.STORY_EVENTS.map(([e, k]) => `${e.split(" ").slice(0, 2).join(" ")} ... ${k}`).join("; ")}`,
        `A  ${K.CHECK.times.map((tm, i) => `${i + 1} ${K.timeWords(tm)}`).join("; ")}`,
        `B  ${K.CHECK.circle.map((it, i) => `${i + 1} ${pick(it)}`).join("  ")}   C  ${K.CHECK.subjects.join(", ")}`,
        `D  ${K.CHECK.timetableQs.map((it, i) => `${i + 1} ${it.a}`).join(" ")}`,
        `E  ${K.CHECK.numbers.map((n) => K.numberWords(n)).join(", ")}`,
      ],
    },
    { head: "WB 2", lines: [`1  ${K.WB_DRAW.items.map((tm) => `${K.timeWords(tm)} (${tm})`).join(", ")}`, `2  ${K.WB_READ_CLOCKS.items.map((tm, i) => `${i + 1} It's ${K.timeWords(tm)}.`).join(" ")}`, `3  ${K.WB_WORDS.items.map((tm, i) => `${i + 1} ${K.timeWords(tm, true)}`).join("; ")}`, `4  ${K.WB_TT_SENTENCES.slice(1).map((it, i) => `${i + 1} ${K.wbTtAnswer(it)}`).join("  ")}`] },
    { head: "WB 3", lines: [`1  ${K.CROSS.map((w) => w.word).join(", ")}`, `2  Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday`, `3  ${K.WB_DAY_RIDDLES.map((r, i) => `${i + 1} ${r.a}`).join("  ")}`, `4  ${K.WB_ODD.slice(1).map((o, i) => `${i + 1} ${o.a} (the others: ${o.why})`).join("; ")}`] },
    { head: "WB 4", lines: [`1  ${K.WB_NUMBERS.items.map((n, i) => `${i + 1} ${n}`).join("  ")}`, `2  ${K.WB_PATTERNS.map((p, i) => `${i + 1} ${p.a.join(", ")}`).join("; ")}`, `3  ${ws.placed.map((p) => `${p.word.toLowerCase()} ${p.down ? "↓" : "→"} (row ${p.r + 1}, column ${p.c + 1})`).join(", ")}`, `4  ${K.WB_SUMS.slice(1).map((q, i) => `${i + 1} ${K.numberWords(q.a)}`).join("  ")}`] },
    { head: "WB 5", lines: [`1  ${K.WB_RIDDLES.slice(1).map((r, i) => `${i + 1} ${r.a}`).join("  ")}`, `2  borrow, please / Here you are / Thank you, lend`, `3  own answers`, `4  ${K.WB_RULES_MATCH.items.map((it, i) => `${i + 1} rule ${it.a}`).join("  ")}`] },
    { head: "WB 6", lines: [`1  ${K.WB_CUP_CIRCLE.slice(1).map((it, i) => `${i + 1} ${pick(it)}`).join("  ")}`, `2  ${K.WB_CUP_COUNT.slice(1).map((q, i) => `${i + 1} ${q.a}`).join(" ")}`, `3  ${K.WB_PRON.items.map((it, i) => `${i + 1} ${it.a}`).join("  ")}`, `4  ${K.WB_JUMBLED.slice(1).map((q, i) => `${i + 1} ${q.a}`).join(" ")}`] },
    { head: "WB 7", lines: [`1  ${K.WB_CLUB_DOES.slice(1).map((q, i) => `${i + 1} ${q.a}`).join("  ")}`, `2  ${K.WB_CLUB_3RD.items.map((it, i) => `${i + 1} ${it.a}`).join(" ")}`, `3  ${K.WB_CLUB_MATCH.key.map((k, i) => `${i + 1} ${"abcd"[k]}`).join("  ")}`, `4  own answers`] },
    { head: "WB 8", lines: [`1  ${K.WB_EMAIL_TF.slice(1).map((it, i) => `${i + 1} ${it.a ? "T" : "F"}`).join("  ")}`, `2  ${K.WB_EMAIL_QS.map((q, i) => `${i + 1} ${q.a}`).join(" ")}`, `3  own answers`] },
    { head: "WB 9", lines: [`1  ${K.WB_CLIL.slice(1).map((it, i) => `${i + 1} ${it.a}`).join("  ")}`, `2  ${K.WB_WHO.slice(1).map((it, i) => `${i + 1} ${it.a}`).join("  ")}`, `3  ${K.WB_EXPRESSIONS.key.map((k, i) => `${i + 1} ${"abcd"[k]}`).join("  ")}`, `4  own answers`] },
    {
      head: "WB 10",
      lines: [
        `A  ${K.WB_REVIEW.times.map((tm, i) => `${i + 1} ${K.timeWords(tm)}`).join("; ")}   B  ${K.WB_REVIEW.subjects.map((s, i) => `${i + 1} ${s.a}`).join("  ")}`,
        `C  ${K.WB_REVIEW.circle.map((it, i) => `${i + 1} ${pick(it)}`).join("  ")}   D  ${K.WB_REVIEW.numbers.map((n, i) => `${i + 1} ${n.a}`).join("  ")}   E  own answers (5 points: 2 for each correct sentence, 1 for a capital letter and full stop)`,
      ],
    },
    { head: "WB 11–12", lines: [`1  ${K.CODE_WORDS.join(", ")}`, `2  ${pa.times}; ${pa.lesson}; ${pa.count} lessons`, `WB 12  pupils' own drawings`] },
  ];
}
const SCRIPTS = (): [string, string, string][] => [
  ["2.01", `Get Ready! (SB 4–5, Ex ${exN("e2")})`, K.SCENE_BUBBLES.map((b) => `${nameOf(b.who)}: ${b.text}`).join("\n")],
  ["2.02", `Our timetable (SB 7, Ex ${exN("e6")})`, K.EX6_SCRIPT],
  ["2.03", `Say it right (SB 8, Ex ${exN("e8")})`, K.EX9.join("\n")],
  ["2.04", `Say it right (SB 8, Ex ${exN("e9")})`, [K.EX10.example, ...K.EX10.items].join("\n")],
  ["2.05", `School subjects (SB 8, Ex ${exN("e10")})`, K.EX11_SCRIPT],
  ["2.06", `Numbers (SB 9, Ex ${exN("e13")})`, K.EX14.script],
  ["2.07", `Classroom objects (SB 9, Ex ${exN("e14")})`, K.EX15_SCRIPT],
  ["2.08", `Story: ${K.STORY_TITLE} (SB 17, Ex ${exN("e31")})`, K.STORY.map((p, i) => `Picture ${i + 1}. ${p.bubbles.map((b) => `${nameOf(b.who)}: ${b.text}`).join(" ")}`).join("\n")],
];
function KeyCol({ groups }: { groups: KeyGroup[] }) {
  return (
    <>
      {groups.map((g) => (
        <View key={g.head} style={{ marginBottom: 5 }} wrap={false}>
          <View style={{ alignSelf: "flex-start", backgroundColor: RED, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1.5, marginBottom: 2 }}>
            <Text style={lab(9, "#fff")}>{g.head}</Text>
          </View>
          {g.lines.map((l, i) => (
            <Text key={i} style={{ ...a(9.5), lineHeight: 1.28, marginBottom: 1 }}>
              {l}
            </Text>
          ))}
        </View>
      ))}
    </>
  );
}
function ScriptBlock({ s }: { s: [string, string, string] }) {
  return (
    <View style={{ marginBottom: 5 }} wrap={false}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 1 }}>
        <AudioTag track={s[0]} />
        <Text style={a(9.5, DARK, 700)}>{s[1]}</Text>
      </View>
      {s[2].split("\n").map((l, i) => (
        <Text key={i} style={{ ...a(9.5), lineHeight: 1.26 }}>
          {l}
        </Text>
      ))}
    </View>
  );
}
function TeacherFoot({ n }: { n: number }) {
  return (
    <At b={B(cx(1), ce(12), FOOT_Y, FOOT_Y + FOOT_H)}>
      <View style={{ height: "100%", justifyContent: "center", alignItems: n % 2 ? "flex-end" : "flex-start" }}>
        <Text style={lab(9, DARK)}>{`TEACHER'S PAGES · UNIT 2 · ${n}`}</Text>
      </View>
    </At>
  );
}
function Teacher1() {
  const groups = keyGroups();
  const col = cells(cx(1), ce(12), 2, 6 * MM);
  return (
    <BookPage>
      <LessonHead n="T" title="Answer Key · Student's Book" skills={["For teachers"]} part="wb" />
      <At b={B(col.at(0), col.at(0) + col.w, ry(8))}>
        <KeyCol groups={groups.slice(0, 3)} />
      </At>
      <At b={B(col.at(1), col.at(1) + col.w, ry(8))}>
        <KeyCol groups={groups.slice(3, 6)} />
        <Text style={{ ...a(9.5, "#3F4A63"), marginTop: 1 }}>Speaking, writing and project tasks: pupils&apos; own answers.</Text>
      </At>
      <TeacherFoot n={1} />
    </BookPage>
  );
}
function Teacher2() {
  const groups = keyGroups();
  const col = cells(cx(1), ce(12), 2, 6 * MM);
  const g = cells(col.at(1), col.at(1) + col.w, 3, 3 * MM);
  const clockY = ry(84);
  return (
    <BookPage>
      <LessonHead n="T" title="Answer Key · Workbook" skills={["For teachers"]} part="wb" />
      <At b={B(col.at(0), col.at(0) + col.w, ry(8))}>
        <KeyCol groups={groups.slice(6, 12)} />
      </At>
      <At b={B(col.at(1), col.at(1) + col.w, ry(8))}>
        <KeyCol groups={groups.slice(12)} />
      </At>
      <At b={B(col.at(1), col.at(1) + col.w, clockY - 6 * MM)}>
        <Text style={lab(9, RED)}>WB 2, EXERCISE 1: THE CLOCKS</Text>
      </At>
      {K.WB_DRAW.items.map((tm, i) => (
        <Clock key={tm} b={B(g.at(i), g.at(i) + g.w, clockY, clockY + 26 * MM)} time={tm} rim={C.coral} />
      ))}
      <TeacherFoot n={2} />
    </BookPage>
  );
}
function Teacher3() {
  const col = cells(cx(1), ce(12), 2, 6 * MM);
  const s = SCRIPTS();
  return (
    <BookPage>
      <LessonHead n="T" title="Audio Scripts" skills={["For teachers"]} part="wb" />
      <At b={B(cx(1), ce(12), ry(7))}>
        <Text style={{ ...a(10.5, "#3F4A63"), lineHeight: 1.3 }}>No audio? Read the scripts aloud, or ask two pupils to read a dialogue. Play each one twice.</Text>
      </At>
      <At b={B(col.at(0), col.at(0) + col.w, ry(13))}>
        {s.slice(0, 4).map((x) => (
          <ScriptBlock key={x[0]} s={x} />
        ))}
      </At>
      <At b={B(col.at(1), col.at(1) + col.w, ry(13))}>
        {s.slice(4).map((x) => (
          <ScriptBlock key={x[0]} s={x} />
        ))}
      </At>
      <TeacherFoot n={3} />
    </BookPage>
  );
}

// ================================================================================================
// COVERS
// ================================================================================================
function CoverFront({ part }: { part: Part }) {
  const sb = part === "sb";
  return (
    <>
      <Fill b={FULL} color={sb ? "#BDE3F6" : "#FFD9CF"} />
      <Pic b={FULL} src={sb ? A.cover : A.wbCover} name={`${part} front cover`} ay={0.7} />
      <Fill b={B(0, ce(8) + 4 * MM, 0, ry(29))} color="#FFFFFF" opacity={0.9} radii={{ borderBottomRightRadius: 24 }} />
      <At b={B(cx(1), ce(8), ry(3))}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 56, color: sb ? DARK : RED, lineHeight: 1 }}>
          {TITLE} <Text style={{ color: sb ? RED : DARK }}>{LEVEL}</Text>
        </Text>
        <Text style={{ fontFamily: "Baloo", fontWeight: 500, fontSize: 16, color: INK, marginTop: 8, lineHeight: 1.2 }}>English for Year 5 · Unit 2 · Our Classroom</Text>
      </At>
      <At b={B(cx(1), ce(6), ry(21))}>
        <View style={{ backgroundColor: sb ? DARK : RED, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 11, alignSelf: "flex-start" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 18, color: "#fff", lineHeight: 1.1, marginTop: LIFTB(18) }}>{sb ? "Student's Book" : "Workbook"}</Text>
        </View>
      </At>
      <At b={B(cx(11), ce(12), ry(92))}>
        <View style={{ width: 22 * MM, height: 22 * MM, borderRadius: 11 * MM, backgroundColor: C.sun, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", alignSelf: "flex-end" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 11, color: INK, lineHeight: 1, marginTop: LIFTB(11) }}>CEFR</Text>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 23, color: INK, lineHeight: 1 }}>A1</Text>
        </View>
      </At>
    </>
  );
}
function CoverBack({ part }: { part: Part }) {
  const sb = part === "sb";
  const feats = sb
    ? ["Worked examples to show the way", "No video needed – audio scripts for the teacher", "Easy and challenge tasks for every learner", "A real Year 5 timetable, a class story, a chant and a board game", "Can-do checklist, mini test and word list"]
    : ["One page of homework after each lesson", "Easy and challenge tasks and a review page", "Clocks to draw, a crossword, a word search, puzzles and an e-mail", "My picture dictionary page"];
  return (
    <>
      <Fill b={FULL} color={sb ? DARK : RED} />
      <Pic b={B(0, W, ry(66), H)} src={sb ? A.cover : A.wbCover} ay={0.9} name={`${part} back cover`} />
      <At b={B(cx(2), ce(11), ry(6))}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 30, color: "#fff", lineHeight: 1 }}>
          {TITLE} {LEVEL} · {sb ? "Student's Book" : "Workbook"}
        </Text>
        <Text style={{ ...a(13, "#fff"), marginTop: 10, lineHeight: 1.4 }}>
          It&apos;s Monday morning in class 5/C, and there is a new student: Can. Defne, Kerem, Zehra and Arda show him their classroom, their timetable and their rules - and then they build a robot together!
        </Text>
        {feats.map((f) => (
          <View key={f} style={{ flexDirection: "row", marginTop: 7, alignItems: "center" }}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: C.sun, alignItems: "center", justifyContent: "center", marginRight: 7 }}>
              <Svg width={9} height={9} viewBox="0 0 10 10">
                <Path d="M1.5 5.5 L4 8 L8.5 2" stroke={INK} strokeWidth={1.8} fill="none" />
              </Svg>
            </View>
            <Text style={{ ...a(12.5, "#fff", 700), flex: 1 }}>{f}</Text>
          </View>
        ))}
      </At>
    </>
  );
}
const Cover = ({ part }: { part: Part }) => (
  <Sheet>
    <CoverFront part={part} />
  </Sheet>
);
const BackCover = ({ part }: { part: Part }) => (
  <Sheet>
    <CoverBack part={part} />
  </Sheet>
);
const InsideCover = ({ part }: { part: Part }) => (
  <Sheet>
    <Fill b={FULL} color={part === "sb" ? C.tealTint : C.coralTint} />
  </Sheet>
);

// --- assembly --------------------------------------------------------------------------------------
const SB_PAGES: [string, React.FC][] = [
  ["title + meet 5/C", SbTitle],
  ["contents", SbContents],
  ["unit opener", SbOpener],
  ["get ready (left)", SbScene4],
  ["get ready (right)", SbScene5],
  ["1 listen and look", SbFocus6],
  ["1 timetable", SbFocus7],
  ["2–3 say it right, word bank", SbSay8],
  ["3 word bank", SbWords9],
  ["3–4 word bank, game time", SbWords10],
  ["5 grammar spot", SbGrammar11],
  ["5 grammar spot 2", SbGrammar12],
  ["6 board game", SbGame13],
  ["7 read", SbRead14],
  ["8 write", SbWrite15],
  ["9 around the world", SbClil16],
  ["10 story time", SbStory17],
  ["10–11 story questions, project", SbProject18],
  ["12 check yourself", SbCheck19],
  ["word list", SbWords20],
];
const WB_PAGES: [string, React.FC][] = [
  ["title + my timetable", WbTitle],
  ["1 time", Wb2],
  ["2–3 subjects and days", Wb3],
  ["3 numbers and objects", Wb4],
  ["4 who am I", Wb5],
  ["5 there is / are, pronouns", Wb6],
  ["5 routines and time", Wb7],
  ["7–8 read and write", Wb8],
  ["9–10 world and story", Wb9],
  ["review", Wb10],
  ["puzzle time", Wb11],
  ["my picture dictionary", Wb12],
];
/** The teacher's pages: a separate file (ogretmen-sayfalari.pdf), not bound into the Workbook. */
const TEACHER_PAGES: [string, React.FC][] = [
  ["answer key: Student's Book", Teacher1],
  ["answer key: Workbook", Teacher2],
  ["audio scripts", Teacher3],
];
if (SB_PAGES.length % 4 || WB_PAGES.length % 4) throw new Error("page counts must be multiples of 4");
const spineOf = (pages: number) => (pages / 2) * 0.1 * MM;
function CoverSpread({ part }: { part: Part }) {
  const spine = spineOf(part === "sb" ? SB_PAGES.length + 4 : WB_PAGES.length + 4);
  const pw = 2 * W + spine + 2 * OFF;
  const ph = H + 2 * OFF;
  const half = spine / 2;
  return (
    <Page size={[pw, ph]} style={{ backgroundColor: "#ffffff", fontFamily: "Andika" }}>
      <EdgeCtx.Provider value={{ l: BLEED, r: half, t: BLEED, b: BLEED }}>
        <View style={{ position: "absolute", left: OFF, top: OFF, width: W, height: H }}>
          <CoverBack part={part} />
        </View>
      </EdgeCtx.Provider>
      <EdgeCtx.Provider value={{ l: half, r: BLEED, t: BLEED, b: BLEED }}>
        <View style={{ position: "absolute", left: OFF + W + spine, top: OFF, width: W, height: H }}>
          <CoverFront part={part} />
        </View>
      </EdgeCtx.Provider>
      {MODE === "print" ? (
        <>
          <CropMarks pw={pw} ph={ph} xs={[OFF, OFF + W, OFF + W + spine, OFF + 2 * W + spine]} ys={[OFF, OFF + H]} dashed={[OFF + W, OFF + W + spine]} />
          <Text style={{ position: "absolute", left: OFF, top: OFF + H + BLEED + 2 * MM, fontFamily: "Andika", fontSize: 6, color: "#000000" }}>
            {`${TITLE} ${LEVEL} ${part === "sb" ? "Student's Book" : "Workbook"} · cover spread · back | spine ${(spine / MM).toFixed(1)} mm | front · trim 2 x 210 x 297 mm + 3 mm bleed · fold marks dashed`}
          </Text>
        </>
      ) : null}
    </Page>
  );
}
function interiorDoc(part: Part | "tg") {
  const pages = part === "sb" ? SB_PAGES : part === "wb" ? WB_PAGES : TEACHER_PAGES;
  const name = part === "sb" ? "Student's Book" : part === "wb" ? "Workbook" : "Teacher's Pages";
  const Interior = () => (
    <Document title={`${TITLE} ${LEVEL} - ${name} - Unit 2${part === "tg" ? "" : " - interior"}`} author={`${TITLE} editorial and design team`}>
      {pages.map(([label, Pg], i) => (
        <SlugCtx.Provider key={i} value={`${TITLE} ${LEVEL} ${name} · page ${i + 1}/${pages.length} · ${label} · trim 210 x 297 mm, bleed 3 mm`}>
          <Pg />
        </SlugCtx.Provider>
      ))}
    </Document>
  );
  return Interior;
}
function coverDoc() {
  return (
    <Document title={`${TITLE} ${LEVEL} - Unit 2 - covers`} author={`${TITLE} editorial and design team`}>
      <CoverSpread part="sb" />
      <CoverSpread part="wb" />
    </Document>
  );
}
function previewDoc() {
  const sb: React.FC[] = [() => <Cover part="sb" />, () => <InsideCover part="sb" />, ...SB_PAGES.map(([, P]) => P), () => <InsideCover part="sb" />, () => <BackCover part="sb" />];
  const wb: React.FC[] = [() => <Cover part="wb" />, () => <InsideCover part="wb" />, ...WB_PAGES.map(([, P]) => P), () => <InsideCover part="wb" />, () => <BackCover part="wb" />];
  const tg: React.FC[] = TEACHER_PAGES.map(([, P]) => P);
  return (
    <Document title={`${TITLE} ${LEVEL} - Unit 2 (preview)`} author={`${TITLE} editorial and design team`}>
      {[...sb, ...wb, ...tg].map((P, i) => (
        <P key={i} />
      ))}
    </Document>
  );
}
/**
 * A word-list entry as it can appear in a text: plural or third-person -s ("posters", "brings",
 * "dictionaries"), "someone" as any word, "a" or "the", and "not" also as "n't".
 */
function wordRegex(key: string) {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const neg = key.startsWith("not ");
  const words = (neg ? key.slice(4) : key).split(" ").map((w) => (w === "someone" ? "(?:[A-Za-z]+ )?[A-Za-z]+" : w === "a" ? "(?:a|the)" : /[^aeiou]y$/.test(w) ? `${esc(w.slice(0, -1))}(?:y|ies)` : `${esc(w)}(?:s|es)?`));
  return new RegExp(`${neg ? "(?:not |n't )" : "(?:^|[^A-Za-z])"}${words.join(" ")}(?:$|[^A-Za-z])`);
}
/** The word list's page numbers: the first Student's Book page (3–19) where each word is printed. */
async function findWordPages(pdf: Buffer) {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  const raw: string[] = [];
  for (let i = 0; i < doc.countPages(); i++) raw.push(doc.loadPage(i).toStructuredText("preserve-whitespace").asText().replace(/[‘’]/g, "'").replace(/-\s+/g, "-").replace(/\s+/g, " "));
  const lower = raw.map((s) => s.toLowerCase());
  const missing: string[] = [];
  for (const t of K.WORDS)
    for (const [en] of t.words) {
      const key = K.wordKey(en);
      // names with capitals ("IT", "Art", "Monday") are matched as written, so "it" is not "IT"
      const cased = /[A-Z]/.test(en.replace(/^(I'd|Hold)\b/, ""));
      const re = wordRegex(cased ? en.split(" / ")[0].replace(/\([^)]*\)/g, "").replace(/[!?]/g, "").replace(/\s+/g, " ").trim().replace(/\.$/, "") : key);
      const texts = cased ? raw : lower;
      const p = texts.findIndex((s, i) => i >= 2 && i <= 18 && re.test(s));
      if (p < 0) missing.push(en);
      else WORD_PAGES.set(key, p + 1);
    }
  if (missing.length) console.log(`  word list - not printed on pages 3–19: ${missing.join(", ")}`);
}

async function resolvePictures() {
  let n = 0;
  for (const [k, make] of [...ART_JOBS]) {
    ARTS.set(k, await make());
    ART_JOBS.delete(k);
    n++;
  }
  const jobs = [...PIC_REQ.entries()].filter(([k]) => !PIC_OUT.has(k));
  PIC_REQ.clear();
  const worker = async () => {
    for (let j = jobs.shift(); j; j = jobs.shift()) {
      const [k, r] = j;
      PIC_OUT.set(k, await printPicture(r.src, r.w, r.h, r.opt));
      n++;
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  for (const [k, r] of [...FLOW_REQ]) {
    if (!FLOW_OUT.has(k)) FLOW_OUT.set(k, await printPicture(r.src, r.d, r.d, { fit: "contain", name: "small" }));
    FLOW_REQ.delete(k);
    n++;
  }
  return n;
}
async function render(doc: () => React.ReactElement<DocumentProps>) {
  for (let pass = 0; pass < 5; pass++) {
    const buf = await renderToBuffer(doc());
    if (PIC_REQ.size === 0 && ART_JOBS.size === 0 && FLOW_REQ.size === 0) return buf;
    console.log(`  pictures prepared: ${await resolvePictures()}`);
  }
  return renderToBuffer(doc());
}

async function main() {
  K.checkContent();
  A = await loadAssets();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // first pass: find on which page each word of the word list is printed
  await findWordPages(await render(interiorDoc("sb")));
  if (MODE === "print") {
    fs.writeFileSync(path.join(OUT_DIR, "raw-sb.pdf"), await render(interiorDoc("sb")));
    fs.writeFileSync(path.join(OUT_DIR, "raw-wb.pdf"), await render(interiorDoc("wb")));
    fs.writeFileSync(path.join(OUT_DIR, "raw-tg.pdf"), await render(interiorDoc("tg")));
    fs.writeFileSync(path.join(OUT_DIR, "raw-cover.pdf"), await render(coverDoc));
    const seen = new Set<string>();
    const rows = dpiTable.filter((r) => {
      const k = `${r.name}|${r.widthMm}|${r.heightMm}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    fs.writeFileSync(path.join(OUT_DIR, "dpi-table.json"), JSON.stringify(rows, null, 1));
    fs.writeFileSync(path.join(OUT_DIR, "spec.json"), JSON.stringify({ sbPages: SB_PAGES.length, wbPages: WB_PAGES.length, spineSbMm: spineOf(SB_PAGES.length + 4) / MM, spineWbMm: spineOf(WB_PAGES.length + 4) / MM, dpi: DPI }, null, 1));
    console.log("->", OUT_DIR, `(${DPI} dpi)`);
  } else {
    fs.writeFileSync(path.join(OUT_DIR, "onizleme.pdf"), await render(previewDoc));
    console.log("->", path.join(OUT_DIR, "onizleme.pdf"));
  }
}
void main();
