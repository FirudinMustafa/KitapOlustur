// Hand-made reference 4: a coursebook re-made from a PHONE SCAN
// (.spike/scan/scan.pdf - 32 CamScanner sheets, no text layer, some areas
// faded or cut off). Scope: cover, imprint, contents spread, the Starter
// unit (scan sheets 3-10 = book pp.7-14) and Theme 1 up to the end of
// module B (sheets 11-18 = book pp.15-22), back cover. Original
// characters, story, texts, exercises and pictures; the scan's level (A1),
// unit / module structure, page types, layout, page furniture and density.
//
// PRINT EDITION: A4 trim (210 x 297 mm), 3 mm bleed, crop marks, pictures
// at 300 dpi, every box on the grid of print-kit.ts.
//
//   npx tsx scripts/reference/handcraft-scan.tsx print     -> print/raw-interior.pdf, print/raw-cover.pdf (300 dpi)
//   PRINT_DPI=150 npx tsx scripts/reference/handcraft-scan.tsx preview -> print/onizleme.pdf (trimmed, for the screen)
//   npx tsx scripts/reference/print-finish.mts             -> print/kitap-ic-sayfalar.pdf, kitap-kapak.pdf (TrimBox/BleedBox)
//   npx tsx scripts/reference/print-qa.mts print/kitap-ic-sayfalar.pdf
//
// Pictures: 11 paid (.handmade-scan/img), free pictures reused from the
// hand-made i5 book (.handmade-scan/free), composites in
// handcraft-scan-art.ts, small pictures are Twemoji (CC-BY 4.0).
import path from "node:path";
import fs from "node:fs";
import React from "react";
import sharp from "sharp";
import { Document, Page, View, Text, Image, Font, Svg, Path, Rect, Polygon, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { twemojiFileName, twemojiUrl } from "../../src/lib/activities";
import { fitPicture, pointInFrame, type FitOptions } from "../../src/lib/pdf/picture-fit";
import * as art from "./handcraft-scan-art";
import { MM, W, H, BLEED, SLUG, LAST_ROW, cx, ce, ry, cells, B, type Box, DPI, printPicture, dpiTable, sheetFigures, cutOut } from "./print-kit";

const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "Noto", fonts: [{ src: path.join(FONTS, "NotoSans-Regular.ttf"), fontWeight: 400 }, { src: path.join(FONTS, "NotoSans-Bold.ttf"), fontWeight: 700 }, { src: path.join(FONTS, "NotoSans-Italic.ttf"), fontStyle: "italic" }] });
Font.register({ family: "Baloo", fonts: [{ src: path.join(FONTS, "Baloo2-Medium.ttf"), fontWeight: 500 }, { src: path.join(FONTS, "Baloo2-Bold.ttf"), fontWeight: 700 }] });
Font.register({ family: "Andika", fonts: [{ src: path.join(FONTS, "Andika-Regular.ttf"), fontWeight: 400 }, { src: path.join(FONTS, "Andika-Bold.ttf"), fontWeight: 700 }] });
Font.register({ family: "Sym", src: path.join(FONTS, "NotoSansSymbols2-Regular.ttf") });
Font.registerHyphenationCallback((w) => [w]);

// --- output mode -------------------------------------------------------------------------------
// "print": the press sheet - trim + bleed + a slug with crop marks (300 dpi).
// "preview": the trimmed page, whole book in reading order (covers, inside covers).
const MODE = (process.argv[2] ?? "print") as "print" | "preview";
const OFF = MODE === "print" ? BLEED + SLUG : 0; // where the trim's top-left sits on the sheet
const OUT_DIR = path.join(process.cwd(), "print");

// --- palette and type --------------------------------------------------------------------------
const NUM = "#E64A19"; // exercise numbers
const INK = "#1E2235";
const RUBRIC = "#1B1F3B";
const BLUE = "#1565C0";
const MAGENTA = "#EC2F8B";
const CRIMSON = "#A3123F";
const GREEN = "#43A047";
const AUDIO = "#7CB342";
const STARTER_BLUE = "#4A55C9";
const GOLD = "#F4C20D";
const SLATE = "#2C2F3B";
const BODY = 10;
/** Padding of text inside a panel: one value for every panel. */
const INSET = 4 * MM;
const FULL: Box = B(0, W, 0, H);

const t = (size = BODY, weight: 400 | 700 = 400, color = INK) => ({ fontFamily: "Noto", fontSize: size, fontWeight: weight, color, lineHeight: 1.3 });
const hand = (size = 11, color = INK, weight: 400 | 700 = 400) => ({ fontFamily: "Andika", fontSize: size, color, fontWeight: weight, lineHeight: 1.3 });
const Bo = ({ children, c }: { children: React.ReactNode; c?: string }) => <Text style={{ fontWeight: 700, ...(c ? { color: c } : {}) }}>{children}</Text>;
const blank = (n = 10) => "_".repeat(n);
const ans = (s: string) => <Text style={{ fontFamily: "Andika", color: BLUE, textDecoration: "underline" }}>{`  ${s}  `}</Text>;

// --- bleed -------------------------------------------------------------------------------------
// How far a painted box that touches a trim edge runs on past it. The
// interior runs 3 mm into the bleed on every side; on the cover spread the
// edges at the spine run only to the spine's middle.
type Edges = { l: number; r: number; t: number; b: number };
const ALL_EDGES: Edges = { l: BLEED, r: BLEED, t: BLEED, b: BLEED };
const EdgeCtx = React.createContext<Edges>(ALL_EDGES);
type Grown = { x: number; y: number; w: number; h: number };
function grow(b: Box, e: Edges): Grown {
  const h = b.h ?? 0;
  const L = b.x <= 0.01;
  const R = b.x + b.w >= W - 0.01;
  const T = b.y <= 0.01;
  const Bt = b.h !== undefined && b.y + h >= H - 0.01;
  return { x: b.x - (L ? e.l : 0), y: b.y - (T ? e.t : 0), w: b.w + (L ? e.l : 0) + (R ? e.r : 0), h: h + (T ? e.t : 0) + (Bt ? e.b : 0) };
}

// --- assets ------------------------------------------------------------------------------------
const EMOJI_DIR = path.join(process.cwd(), ".handmade-scan", "emoji");
const EM: Record<string, Buffer> = {};
// Twemoji drawn from its SVG at 1024 px (the 160 px PNGs printed at 25 mm were 160 dpi).
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
const E = (e: string) => EM[e];
const ringPx = (n: number) => (n * art.PX) / 3; // ring widths were designed at 3 px per pt

const CROSS_PICS: [string, number][] = [["🏀", 1], ["🌸", 2], ["🍌", 3], ["🐳", 5]];
const CROSS_PICS_ACROSS: [string, number][] = [["🍇", 2], ["🐸", 4], ["☁️", 6]];
const OBJECTS: [string, string][] = [["✂️", "scissors"], ["📓", "notebook"], ["🖌️", "paintbrush"], ["📎", "paper clip"], ["🖍️", "crayon"], ["🖥️", "computer"], ["📌", "drawing pin"], ["📏", "ruler"]];
const TILE_EMOJI: [string, string][] = [["🍳", "#FFE0B2"], ["👔", "#C5CAE9"], ["🧰", "#CFD8DC"], ["👫", "#F8BBD0"], ["🏀", "#C8E6C9"], ["🩺", "#B3E5FC"], ["📚", "#FFF9C4"], ["🎸", "#E1BEE7"]];

// --- the boxes the artwork is drawn for (grid) --------------------------------------------------
const BOX = {
  keyboard: B(0, W, ry(10), ry(70)),
  paints: B(cx(1), ce(6), ry(0), ry(50)),
  classroom: B(cx(1), ce(12), ry(65), ry(107)),
  numbers: B(cx(1), ce(6), ry(10), ry(79)),
  daysPanel: B(cx(7), W, ry(6), ry(59)),
  pegs: B(cx(7) + INSET, ce(12), ry(14), ry(57)),
  ordinal: B(cx(7), W, ry(64), ry(84)),
  bus: B(0, W, ry(86), ry(LAST_ROW)),
  clockRow: (row: number) => B(cx(1), ce(6), ry(15 + row * 16), ry(25 + row * 16)),
  actClocks: B(cx(1) + INSET, ce(6) - INSET, ry(86), ry(105)),
  greetings: B(cx(7) - INSET, ce(12) + INSET, ry(3), ry(62)),
  town: B(cx(1), W, ry(8), ry(38)),
  jobs: B(cx(1), ce(12), ry(9), ry(40)),
  people: B(cx(1), ce(12), ry(9), ry(40)),
  email: B(cx(7), ce(12), ry(84), ry(LAST_ROW)),
  postcard: B(cx(7), ce(12), ry(87), ry(LAST_ROW)),
};
const g0 = (b: Box) => grow(b, ALL_EDGES);
const gw = (b: Box) => g0(b).w;
const gh = (b: Box) => g0(b).h;

// Greetings tiles: two across the panel (columns 7-9 and 10-12), three down.
const GREET_CELLS = { w: ce(9) - cx(7), at: (i: number) => (i ? cx(10) : cx(7)) };
const GREET_TILE_H = 11 * 2.5 * MM;
const greetRow = (r: number) => ry(14 + r * 15);

const imgAspect: Record<string, number> = {};
async function aspectOf(name: string, buf: Buffer) {
  const m = await sharp(buf).metadata();
  imgAspect[name] = (m.width ?? 1) / (m.height ?? 1);
}

async function loadAssets() {
  await loadEmoji([...new Set([...CROSS_PICS, ...CROSS_PICS_ACROSS].map(([e]) => e).concat(OBJECTS.map(([e]) => e), TILE_EMOJI.map(([e]) => e)))]);
  const I = art.img;
  const F = art.free;
  const cast = await sheetFigures(I("cast"), 4, 2, 7);
  const people = await sheetFigures(I("people"), 5, 2, 9);
  const jobs = await sheetFigures(I("jobs"), 5, 2, 10);
  const classlang = await sheetFigures(I("classlang"), 4, 2, 8);
  const routines = await sheetFigures(I("routines"), 4, 2, 8);
  for (const [n, b] of [["town", I("town")], ["classroom", I("classroom")]] as const) await aspectOf(n, b);
  const tile = (name: string, e: string, bg: string) =>
    art.compose(name, 140 * art.PX, 100 * art.PX, `<rect width="${140 * art.PX}" height="${100 * art.PX}" rx="${6 * art.PX}" fill="${bg}"/><circle cx="${110 * art.PX}" cy="${23 * art.PX}" r="${30 * art.PX}" fill="#ffffff55"/>`, [{ buf: E(e), x: 43 * art.PX, y: 20 * art.PX, w: 60 * art.PX, h: 60 * art.PX }]);
  const frameFaces = (name: string, faces: Buffer[], bg: string) => {
    const fw = 140 * art.PX;
    const fh = 100 * art.PX;
    const n = faces.length;
    const d = (n === 3 ? 40 : 53) * art.PX;
    const step = n === 3 ? 42 * art.PX : n === 1 ? 0 : 63 * art.PX;
    const x0 = n === 1 ? 47 * art.PX : 10 * art.PX;
    return art.compose(
      name,
      fw,
      fh,
      `<rect width="${fw}" height="${fh}" fill="${bg}"/><rect y="${fh * 0.62}" width="${fw}" height="${fh * 0.38}" fill="#C5A880"/>${Array.from({ length: 6 }, (_, i) => `<rect x="${i * 24 * art.PX}" y="${fh * 0.3 - (i % 3) * 7 * art.PX}" width="${19 * art.PX}" height="${fh * 0.34 + (i % 3) * 7 * art.PX}" fill="#B0BEC5"/>`).join("")}`,
      faces.map((f, i) => ({ buf: f, x: x0 + i * step, y: 40 * art.PX - (i % 2) * 5 * art.PX, w: d, h: d, circle: true, ring: "#fff", ringW: ringPx(6) })),
    );
  };
  // jobs as faces in tinted circles, five across, two down
  const JOB_ORDER = [4, 8, 1, 10, 6, 5, 7, 3, 9, 2]; // baker, pilot, vet, police officer, farmer, photographer, nurse, mechanic, waiter, firefighter
  const jg = jobsGeom();
  const jobsArt = await art.compose(
    "jobs-circles",
    jg.w * art.PX,
    jg.h * art.PX,
    "",
    JOB_ORDER.map((k, i) => ({ buf: jobs[k - 1], x: (jg.left(i) - jg.x) * art.PX, y: (jg.top(i) - jg.y) * art.PX, w: jg.d * art.PX, h: jg.d * art.PX, circle: true, ring: ["#FFF59D", "#BBDEFB", "#E1BEE7", "#B2DFDB", "#FFCCBC"][i % 5], ringW: ringPx(10), bg: ["#FFF8C4", "#D6ECFF", "#EEDDF5", "#D5F0EA", "#FFE1D6"][i % 5] })),
  );
  const pg = peopleGeom();
  const peopleArt = await art.compose(
    "people-row",
    pg.w * art.PX,
    pg.h * art.PX,
    "",
    people.map((p, i) => ({ buf: p, x: (pg.left(i) - pg.x) * art.PX, y: (pg.top(i) - pg.y) * art.PX, w: pg.cw * art.PX, h: pg.fh * art.PX })),
  );
  const gk = gw(BOX.keyboard);
  return {
    cover: I("cover"),
    starter: I("starter"),
    theme1: I("theme1"),
    story: I("story"),
    town: await art.vivid(I("town"), 1.15),
    classroom: I("classroom"),
    cast,
    classlang,
    people,
    routines,
    keyboard: await art.keyboard(gk, gh(BOX.keyboard)),
    paints: await art.paintPots(BOX.paints.w, BOX.paints.h!),
    numbers: await art.numberTiles(BOX.numbers.w, BOX.numbers.h!),
    pegs: await art.pegs(BOX.pegs.w, BOX.pegs.h!),
    starGroundL: await art.starGround(W + 2 * BLEED, H + 2 * BLEED, { top: ry(4) + BLEED, left: 6 * MM + BLEED, right: 0 }),
    starGroundR: await art.starGround(W + 2 * BLEED, H + 2 * BLEED, { top: ry(4) + BLEED, left: 0, right: 6 * MM + BLEED }),
    ordinal: await (async () => {
      const ow = gw(BOX.ordinal) * art.PX;
      const oh = BOX.ordinal.h! * art.PX;
      const r = 13 * art.PX;
      return art.compose("ordinal-panel", ow, oh, `<rect x="0" y="0" width="${ow + r}" height="${oh}" rx="${r}" fill="#4C5B7C"/><rect x="${3.3 * art.PX}" y="${3.3 * art.PX}" width="${ow}" height="${oh - 6.6 * art.PX}" rx="${11 * art.PX}" fill="none" stroke="#8FA3C9" stroke-width="${1.3 * art.PX}"/>`);
    })(),
    bus: await art.busQueue("bus-queue", gw(BOX.bus), BOX.bus.h!, ["w-family-7", "w-family-8", "w-family-10", "w-family-6", "w-family-9", "w-family-4", "w-family-3"].map(F)),
    skylineBus: await art.skyline("skyline-bus", gw(BOX.bus), BOX.bus.h!, "#CFD8DC"),
    clocks: [
      await art.clockRow("clocks-11a", BOX.clockRow(0).w, BOX.clockRow(0).h!, [[7, 30], [8, 0], [8, 45]], ["#7CB342", "#FBC02D", "#90A4AE"], 3),
      await art.clockRow("clocks-11b", BOX.clockRow(1).w, BOX.clockRow(1).h!, [[10, 10], [11, 15], [12, 40]], ["#E53935", "#3949AB", "#8E24AA"], 3),
    ],
    actClocks: await art.clockRow("clocks-13", BOX.actClocks.w, BOX.actClocks.h!, [[7, 0], [8, 30], [10, 15], [11, 45], [1, 10], [2, 50], [6, 25], [9, 35]], ["#E3F2FD", "#AED581", "#CE93D8", "#455A64"], 4, true),
    schools: await Promise.all((["morning", "afternoon", "evening", "night", "day", "day"] as const).map((k, i) => art.schoolAt(`school-${i}`, GREET_CELLS.w, GREET_TILE_H, k))),
    greetKids: [await art.knockout(F("w-friends")), cast[1], cast[2]],
    facesK: Object.fromEntries(await Promise.all(Array.from({ length: 10 }, async (_, i) => [`f${i + 1}`, await cutOut(F(`w-family-${i + 1}`))]))) as Record<string, Buffer>,
    faces: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`f${i + 1}`, F(`w-family-${i + 1}`)])) as Record<string, Buffer>,
    friends: F("w-friends"),
    park: F("1c-park"),
    boys: F("d-games-4"),
    familyHome: F("1b-scene"),
    email: await art.emailWindow("email-19", BOX.email.w, BOX.email.h!, F("w-family-10")),
    postcard: await art.postcard("postcard-22", BOX.postcard.w, BOX.postcard.h!, F("w-landmarks-2")),
    tiles3: await Promise.all(TILE_EMOJI.map(([e, c], i) => tile(`tile3-${i}`, e, c))),
    frames5: await Promise.all(
      [
        [["f10"], "#B3E5FC"],
        [["f7", "f8"], "#C8E6C9"],
        [["f8", "f9"], "#FFE0B2"],
        [["f6", "f10"], "#F8BBD0"],
        [["f8"], "#D1C4E9"],
        [["f7", "f10", "f9"], "#FFF59D"],
        [["f3", "f4"], "#B2EBF2"],
        [["f8", "f8"], "#FFCCBC"],
      ].map(([fs2, c], i) => frameFaces(`frame5-${i}`, (fs2 as string[]).map((f) => F(`w-family-${f.slice(1)}`)), c as string)),
    ),
    jobsArt,
    peopleArt,
  };
}
type Assets = Awaited<ReturnType<typeof loadAssets>>;
let A: Assets;

// geometry shared by the jobs artwork and its answer boxes
function jobsGeom() {
  const b = BOX.jobs;
  const c = cells(b.x, b.x + b.w, 5, 2 * MM);
  const ch = b.h! / 2;
  const d = Math.min(c.w * 0.9, ch - 9 * MM);
  return { x: b.x, y: b.y, w: b.w, h: b.h!, d, cell: c, left: (i: number) => c.at(i % 5) + (c.w - d) / 2, top: (i: number) => b.y + Math.floor(i / 5) * ch, boxY: (i: number) => b.y + Math.floor(i / 5) * ch + d + 1.5 * MM };
}
// geometry shared by the people artwork and its captions: five on top, four below
function peopleGeom() {
  const b = BOX.people;
  const top = cells(b.x, b.x + b.w, 5, 2 * MM);
  const ch = b.h! / 2;
  const fh = ch - 7 * MM;
  const bottomLeft = (i: number) => top.at(i) + top.w / 2;
  return { x: b.x, y: b.y, w: b.w, h: b.h!, cw: top.w, fh, left: (i: number) => (i < 5 ? top.at(i) : bottomLeft(i - 5)), top: (i: number) => b.y + (i < 5 ? 0 : ch), labelY: (i: number) => b.y + (i < 5 ? 0 : ch) + fh + 0.5 * MM };
}

// --- pictures: print-resolution, fitted with picture-fit.ts --------------------------------------
type PicReq = { src: Buffer; w: number; h: number; opt: FitOptions & { subject?: boolean; ground?: string; name?: string } };
const PIC_REQ = new Map<string, PicReq>();
const PIC_OUT = new Map<string, { data: Buffer; format: "png" | "jpg" }>();
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
function Pic({ b, src, fit = "cover", ax = 0.5, ay = 0.5, subject, r = 0, border, bw = 2, name, ground }: { b: Box; src: Buffer; fit?: "cover" | "contain"; ax?: number; ay?: number; subject?: boolean; r?: number; border?: string; bw?: number; name?: string; ground?: string }) {
  const e = React.useContext(EdgeCtx);
  const g = grow(b, e);
  const opt = { fit, anchorX: ax, anchorY: ay, subject, ground, name };
  const key = `${idOf(src)}|${g.w.toFixed(2)}|${g.h.toFixed(2)}|${fit}|${ax}|${ay}|${subject ? 1 : 0}|${ground ?? ""}`;
  const out = PIC_OUT.get(key);
  if (!out) PIC_REQ.set(key, { src, w: g.w, h: g.h, opt });
  return (
    <View style={{ position: "absolute", left: g.x, top: g.y, width: g.w, height: g.h }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      {out ? <Image src={{ data: out.data, format: out.format }} style={{ width: g.w, height: g.h, borderRadius: r }} /> : null}
      {border ? <View style={{ position: "absolute", left: 0, top: 0, width: g.w, height: g.h, borderWidth: bw, borderColor: border, borderRadius: r }} /> : null}
    </View>
  );
}
/** Where a point of a picture (fractions of the stored picture) lands on the page, by the same fit as Pic. */
function picPoint(b: Box, aspect: number, opt: FitOptions, fx: number, fy: number) {
  const g = grow(b, ALL_EDGES);
  const rect = fitPicture(g.w, g.h, { aspect }, opt);
  const p = pointInFrame(rect, { x: fx, y: fy });
  return { x: g.x + p.px, y: g.y + p.py };
}

// --- layout primitives -------------------------------------------------------------------------
/** A positioned block of content (text, rows); never grows into the bleed. */
const At = ({ b, children, style }: { b: Box; children?: React.ReactNode; style?: object }) => (
  <View style={{ position: "absolute", left: b.x, top: b.y, width: b.w, ...(b.h !== undefined ? { height: b.h } : {}), ...style }}>{children}</View>
);
/** A painted box; at a trim edge it runs on into the bleed. */
function Fill({ b, color, r = 0, border, bw = 2, opacity, radii }: { b: Box; color: string; r?: number; border?: string; bw?: number; opacity?: number; radii?: object }) {
  const g = grow(b, React.useContext(EdgeCtx));
  return <View style={{ position: "absolute", left: g.x, top: g.y, width: g.w, height: g.h, backgroundColor: color, borderRadius: r, ...radii, ...(border ? { borderWidth: bw, borderColor: border } : {}), ...(opacity !== undefined ? { opacity } : {}) }} />;
}
/**
 * A drawn shape in its box; d() gets x/y mappers from box-local units in
 * which 0 and the box size at a trim edge land on the bleed edge.
 */
function Decor({ b, d, fill, opacity }: { b: Box; d: (X: (v: number) => number, Y: (v: number) => number, w: number, h: number) => string; fill: string; opacity?: number }) {
  const g = grow(b, React.useContext(EdgeCtx));
  const dx = b.x - g.x;
  const dy = b.y - g.y;
  const bh = b.h ?? 0;
  const X = (v: number) => (v <= 0 ? 0 : v >= b.w ? g.w : v + dx);
  const Y = (v: number) => (v <= 0 ? 0 : v >= bh ? g.h : v + dy);
  return (
    <View style={{ position: "absolute", left: g.x, top: g.y, width: g.w, height: g.h }}>
      <Svg width={g.w} height={g.h}>
        <Path d={d(X, Y, b.w, bh)} fill={fill} {...(opacity !== undefined ? { opacity } : {})} />
      </Svg>
    </View>
  );
}

function AudioTag({ code }: { code: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: AUDIO, borderRadius: 3, paddingHorizontal: 3, paddingVertical: 0.5, marginRight: 4, marginTop: 2.5, height: 11 }}>
      <Svg width={7} height={7} viewBox="0 0 24 24">
        <Path d="M3 9 H8 L14 4 V20 L8 15 H3 Z" fill="#fff" />
        <Path d="M17 8 Q21 12 17 16" stroke="#fff" strokeWidth={2.5} fill="none" />
      </Svg>
      <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 6.8, color: "#fff", marginLeft: 1.5 }}>{code}</Text>
    </View>
  );
}
// An exercise heading: a big orange-red number, an optional green audio
// tag, the rubric in bold beside it (hanging indent).
function Ex({ n, children, audio, size = 10.4, numSize = 14, color = RUBRIC }: { n: string; children: React.ReactNode; audio?: string; size?: number; numSize?: number; color?: string }) {
  return (
    <View style={{ flexDirection: "row" }} wrap={false}>
      <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: numSize, color: NUM, width: n.length > 2 ? numSize * 1.9 : n.length > 1 ? numSize * 1.45 : numSize * 0.95, lineHeight: 1 }}>{n}</Text>
      {audio ? <AudioTag code={audio} /> : null}
      <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: size, color, flex: 1, letterSpacing: -0.25, lineHeight: 1.25, paddingTop: 1.5 }}>{children}</Text>
    </View>
  );
}
const ExAt = (p: { b: Box; n: string; children: React.ReactNode; audio?: string; size?: number; color?: string }) => (
  <At b={p.b}>
    <Ex n={p.n} audio={p.audio} size={p.size} color={p.color}>
      {p.children}
    </Ex>
  </At>
);

function Items({ items, cols = 1, size = BODY, start = 1, gap = 3, numColor = INK, font = "Noto", letters, down }: { items: React.ReactNode[]; cols?: number; size?: number; start?: number; gap?: number; numColor?: string; font?: "Noto" | "Andika"; letters?: boolean; down?: boolean }) {
  if (down && cols > 1) {
    const per = Math.ceil(items.length / cols);
    return (
      <View style={{ flexDirection: "row" }}>
        {Array.from({ length: cols }, (_, c) => (
          <View key={c} style={{ flex: 1 }}>
            <Items items={items.slice(c * per, (c + 1) * per)} start={start + c * per} size={size} gap={gap} numColor={numColor} font={font} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {items.map((x, i) => (
        <View key={i} style={{ width: `${100 / cols}%`, flexDirection: "row", marginBottom: gap, paddingRight: 6 }}>
          <Text style={{ fontFamily: font, fontSize: size, fontWeight: 700, color: numColor, width: letters ? 12 : start + i >= 10 ? size * 1.5 : size * 1.05, lineHeight: 1.3 }}>{letters ? `${"abcdefghij"[i]}.` : start + i}</Text>
          <View style={{ flex: 1 }}>{typeof x === "string" || (React.isValidElement(x) && x.type === React.Fragment) ? <Text style={font === "Andika" ? hand(size) : t(size)}>{x}</Text> : x}</View>
        </View>
      ))}
    </View>
  );
}

// Outlined cartoon title: copies of the text offset round the main one make the outline.
function Title({ text, size = 24, fill = GOLD, stroke = "#5A3E00", font = "Baloo" }: { text: string; size?: number; fill?: string | string[]; stroke?: string; font?: string }) {
  const off = size * 0.055;
  const dirs = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [1.6, 1.8]];
  const letters = (c: string | string[]) => (Array.isArray(c) ? text.split("").map((ch, i) => <Text key={i} style={{ color: c[i % c.length] }}>{ch}</Text>) : text);
  const st = { fontFamily: font, fontWeight: 700 as const, fontSize: size, lineHeight: 1.05 };
  return (
    <View>
      {dirs.map(([dx, dy], i) => (
        <Text key={i} style={{ ...st, color: i === 8 ? "#00000044" : stroke, position: "absolute", left: dx * off, top: dy * off }}>
          {text}
        </Text>
      ))}
      <Text style={{ ...st, color: Array.isArray(fill) ? fill[0] : fill }}>{letters(fill)}</Text>
    </View>
  );
}

// The crimson ribbon tab of the Theme pages ("Vocabulary", "Grammar"...):
// 4 units high (two-line: 6), its fold one unit below.
const TAB_H = { one: 4 * 2.5 * MM, two: 6 * 2.5 * MM };
const FOLD = 2.5 * MM;
function Tab({ x, y, label }: { x: number; y: number; label: string }) {
  const two = label.includes("\n");
  const w = two ? 38 * MM : label.length * 2.77 * MM + 12.6 * MM;
  const h = two ? TAB_H.two : TAB_H.one;
  return (
    <At b={B(x, x + w, y, y + h + FOLD)}>
      <Svg width={w} height={h + FOLD} style={{ position: "absolute", left: 0, top: 0 }}>
        <Polygon points={`0,${h} 10,${h} 10,${h + FOLD}`} fill="#5C0A24" />
        <Rect x={0} y={0} width={w} height={h} fill={CRIMSON} />
        <Rect x={0} y={0} width={w} height={h / 2} fill="#C0245A" opacity={0.55} />
        <Rect x={w - 5} y={0} width={5} height={h} fill="#00000033" />
      </Svg>
      <View style={{ position: "absolute", left: 0, top: 0, width: w, height: h, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: two ? 11.5 : 16, color: "#fff", textAlign: "center", lineHeight: two ? 1.0 : 1.1, letterSpacing: -0.4 }}>{label}</Text>
      </View>
    </At>
  );
}
/** The first row under a tab at the top margin. */
const UNDER_TAB = { one: 6, two: 8 };

function ModuleBadge({ code }: { code: string }) {
  const b = B(cx(11), ce(12), 0, ry(2));
  return (
    <>
      <Decor b={b} fill="#A5D6A7" d={(X, Y, w, h) => `M${X(0)} ${Y(0)} H${X(w)} V${Y(0) + 6 * MM} Q${X(w * 0.85)} ${Y(h)} ${X(w / 2)} ${Y(h)} Q${X(w * 0.15)} ${Y(h)} ${X(0)} ${Y(0) + 6 * MM} Z`} />
      <At b={B(cx(11), ce(12), 5.5 * MM)}>
        <View style={{ alignSelf: "center", width: 30, height: 30, borderRadius: 15, backgroundColor: "#1E88E5", borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 14, color: "#fff", marginTop: 2 }}>{code}</Text>
        </View>
      </At>
    </>
  );
}

function WordBanner({ b, lines, color = GREEN, size = 10.5, textColor = "#fff" }: { b: Box; lines: string[]; color?: string; size?: number; textColor?: string }) {
  return (
    <>
      <Fill b={b} color={color} border="#fff" bw={2} />
      <At b={b}>
        <View style={{ height: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}>
          {lines.map((l) => (
            <Text key={l} style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: size, color: textColor, lineHeight: 1.15, textAlign: "center" }}>
              {l}
            </Text>
          ))}
        </View>
      </At>
    </>
  );
}

function Bubble({ b, children, color = "#fff", border = "#37474F", tail = "bl", r = 10, size = 10, font = "Andika", textColor = INK, center = true }: { b: Box; children: React.ReactNode; color?: string; border?: string; tail?: "bl" | "br" | "tl" | "tr" | "none"; r?: number; size?: number; font?: string; textColor?: string; center?: boolean }) {
  const tailStyle =
    tail === "none" ? null : { position: "absolute" as const, width: 10, height: 10, backgroundColor: color, borderColor: border, transform: "rotate(45deg)", ...(tail[0] === "b" ? { bottom: -5.5, borderBottomWidth: 1.5, borderRightWidth: 1.5 } : { top: -5.5, borderTopWidth: 1.5, borderLeftWidth: 1.5 }), ...(tail[1] === "l" ? { left: 14 } : { right: 14 }) };
  return (
    <At b={b}>
      <View style={{ backgroundColor: color, borderWidth: 1.5, borderColor: border, borderRadius: r, paddingHorizontal: 7, paddingVertical: 4 }}>
        {tailStyle ? <View style={tailStyle} /> : null}
        <Text style={{ fontFamily: font, fontSize: size, color: textColor, textAlign: center ? "center" : "left", lineHeight: 1.2, fontWeight: font === "Noto" ? 700 : 400 }}>{children}</Text>
      </View>
    </At>
  );
}

const NumTag = ({ n, size = 12, color = "#E53935" }: { n: string | number; size?: number; color?: string }) => (
  <View style={{ width: size, height: size, backgroundColor: color, alignItems: "center", justifyContent: "center", borderRadius: 2 }}>
    <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: size * 0.68, color: "#fff", lineHeight: 1 }}>{n}</Text>
  </View>
);
// Red number + white answer box (the write-in boxes under pictures).
const AnswerBox = ({ n, w, label }: { n: string | number; w: number; label?: React.ReactNode }) => (
  <View style={{ flexDirection: "row", alignItems: "center", width: w }}>
    <NumTag n={n} size={13} />
    <View style={{ flex: 1, height: 13, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E57373", justifyContent: "center", paddingLeft: 3 }}>{label}</View>
  </View>
);
const Check = () => <View style={{ width: 11, height: 11, borderWidth: 1.2, borderColor: "#455A64", borderRadius: 3, marginRight: 5, marginTop: 1 }} />;

// --- footers: in the bottom margin, the number block running off the outside edge -----------------
const FOOT_Y = ry(LAST_ROW) + 1 * MM;
const FOOT_H = 6 * MM;
const FOOT_NUM_W = cx(1) + INSET;
function FooterBar({ n, label, numBg, labelStyle, labelBox }: { n: number; label: string; numBg: string; labelStyle: object; labelBox: object }) {
  const right = n % 2 === 1;
  const num = right ? B(W - FOOT_NUM_W, W, FOOT_Y, FOOT_Y + FOOT_H) : B(0, FOOT_NUM_W, FOOT_Y, FOOT_Y + FOOT_H);
  const lab = right ? B(cx(7), W - FOOT_NUM_W, FOOT_Y, FOOT_Y + FOOT_H) : B(FOOT_NUM_W, ce(6), FOOT_Y, FOOT_Y + FOOT_H);
  return (
    <>
      <Fill b={num} color={numBg} />
      <At b={num}>
        <View style={{ height: "100%", justifyContent: "center", alignItems: right ? "flex-start" : "flex-end", paddingHorizontal: INSET }}>
          <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 10.5, color: "#fff", lineHeight: 1 }}>{n}</Text>
        </View>
      </At>
      <At b={lab}>
        <View style={{ height: "100%", flexDirection: right ? "row-reverse" : "row" }}>
          <View style={{ height: "100%", justifyContent: "center", paddingHorizontal: 6, ...labelBox }}>
            <Text style={{ lineHeight: 1, ...labelStyle }}>{label}</Text>
          </View>
        </View>
      </At>
    </>
  );
}
const StarterFooter = ({ n }: { n: number }) => (
  <FooterBar n={n} label="STARTER" numBg={MAGENTA} labelStyle={{ fontFamily: "Noto", fontWeight: 700, fontSize: 10, color: "#E53935", letterSpacing: -0.3 }} labelBox={{ backgroundColor: "#fff", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#F8BBD0" }} />
);
const ThemeFooter = ({ n, module }: { n: number; module?: string }) => (
  <FooterBar n={n} label={module ? `theme 1   module ${module}` : "Theme 1"} numBg={SLATE} labelStyle={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 9.5, color: SLATE }} labelBox={{ backgroundColor: GOLD, borderWidth: 1.5, borderColor: SLATE, width: module ? 42 * MM : 27 * MM }} />
);

// --- the sheet: trim + bleed (+ slug with crop marks for the press) ------------------------------
const SlugCtx = React.createContext<string>("");
function CropMarks({ pw, ph, xs, ys, dashed = [] }: { pw: number; ph: number; xs: number[]; ys: number[]; dashed?: number[] }) {
  // hairlines (0.25 pt) from 1 mm off the sheet edge to the bleed edge,
  // never into the bleed; fold marks drawn as dashes
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
    <Page size={[pw, ph]} style={{ backgroundColor: "#ffffff", fontFamily: "Noto" }}>
      <View style={{ position: "absolute", left: OFF, top: OFF, width: W, height: H }}>{children}</View>
      {MODE === "print" ? (
        <>
          <CropMarks pw={pw} ph={ph} xs={[OFF, OFF + W]} ys={[OFF, OFF + H]} />
          <Text style={{ position: "absolute", left: OFF, top: OFF + H + BLEED + 2 * MM, fontFamily: "Noto", fontSize: 6, color: "#000000" }}>{label}</Text>
        </>
      ) : null}
    </Page>
  );
}
function BookPage({ children, bg, ground, footer }: { children: React.ReactNode; bg?: string; ground?: Buffer; footer?: React.ReactNode }) {
  return (
    <Sheet>
      {bg ? <Fill b={FULL} color={bg} /> : null}
      {ground ? <Pic b={FULL} src={ground} name="star ground" /> : null}
      {children}
      {footer}
    </Sheet>
  );
}

// --- pages: Starter ------------------------------------------------------------------------------
function P7StarterOpener() {
  return (
    <BookPage bg="#BFE3F8" footer={<StarterFooter n={7} />}>
      <Pic b={FULL} src={A.starter} name="starter opener" />
      <Fill b={B(0, W, ry(6), ry(7))} color={MAGENTA} />
      <Fill b={B(0, W, ry(7), ry(22))} color="#ffffff" opacity={0.93} />
      <At b={B(cx(1), ce(8), ry(8))}>
        <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 64, color: STARTER_BLUE, letterSpacing: -3, lineHeight: 1.1 }}>STARTER</Text>
      </At>
      <Fill b={B(cx(7), cx(9), ry(17), ry(18))} color={STARTER_BLUE} />
      <Fill b={B(cx(9), ce(12), ry(2), ry(34))} color={MAGENTA} border="#fff" />
      <At b={B(cx(9), ce(12), ry(2), ry(34))}>
        <View style={{ padding: INSET }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#FFEB3B", lineHeight: 1.05 }}>Vocabulary</Text>
          {["Letters and spelling", "Colours and school things", "Numbers 1-100, 1st-30th", "Days of the week", "Hello and goodbye", "In the classroom", "Jobs and places in town"].map((x) => (
            <Text key={x} style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 9.2, color: "#fff", marginLeft: 6, lineHeight: 1.3 }}>
              {x}
            </Text>
          ))}
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#FFEB3B", marginTop: 3, lineHeight: 1.05 }}>Grammar</Text>
          {["a / an", "What time is it?"].map((x) => (
            <Text key={x} style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 9.2, color: "#fff", marginLeft: 6, lineHeight: 1.3 }}>
              {x}
            </Text>
          ))}
        </View>
      </At>
      <Bubble b={B(cx(1), ce(3), ry(35))} color="#F06292" border="#fff" textColor="#fff" size={12} tail="br" r={16}>
        {"Good morning!\nI'm Omar."}
      </Bubble>
      <Bubble b={B(cx(4), ce(6), ry(38))} color="#FFD54F" border="#fff" size={12} tail="br" r={16}>
        {"Welcome back, Ana!"}
      </Bubble>
      <Bubble b={B(cx(7), ce(8), ry(51))} color="#FFD54F" border="#fff" size={12} tail="tl" r={16}>
        Thanks, Bea!
      </Bubble>
      <Bubble b={B(cx(9), ce(11), ry(35))} color="#AED581" border="#fff" textColor="#4A148C" size={12} tail="bl" r={16}>
        {"Seven, eight,\nnine ... TEN!"}
      </Bubble>
      <Bubble b={B(cx(10), ce(12), ry(61))} color="#B3E5FC" border="#fff" size={12} tail="tl" r={16}>
        {"It's twenty past\neight. We're late!"}
      </Bubble>
    </BookPage>
  );
}

const KEY_SECRET = [[1, 2], [3, 4, 5], [6, 7], [8, 9]];
function P8Alphabet() {
  const card = B(cx(2), ce(6), ry(77), ry(107));
  return (
    <BookPage footer={<StarterFooter n={8} />}>
      <Pic b={BOX.keyboard} src={A.keyboard} name="keyboard (drawn)" />
      <Decor b={B(0, ce(7), ry(75), H)} fill="#DCEFFB" d={(X, Y, w, h) => `M${X(0)} ${Y(0)} Q${X(w * 0.55)} ${Y(h * 0.07)} ${X(w)} ${Y(h)} H${X(0)} Z`} />
      <At b={B(cx(1), ce(8), ry(0))}>
        <Title text="The Alphabet" size={25} fill="#FFD23F" stroke="#7A4B00" />
      </At>
      <ExAt b={B(cx(1), ce(8), ry(5))} n="1">
        Write the small letters on the keys. Then find the numbered letters and read the secret message.
      </ExAt>
      <Fill b={B(cx(2), ce(11), ry(59), ry(65))} color="#FFFDE7" border="#F2D46B" bw={1.5} r={8} />
      <At b={B(cx(2), ce(11), ry(59), ry(65))}>
        <View style={{ height: "100%", flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
          {KEY_SECRET.map((g, gi) => (
            <View key={gi} style={{ flexDirection: "row", marginHorizontal: 9 }}>
              {g.map((n) => (
                <View key={n} style={{ width: 24, height: 24, marginHorizontal: 2.5, borderWidth: 1.5, borderColor: "#455A64", borderRadius: 4, backgroundColor: "#fff" }}>
                  <View style={{ position: "absolute", right: -5, bottom: -5 }}>
                    <NumTag n={n} size={10} color="#E5195A" />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </At>
      <ExAt b={B(cx(1), ce(6), ry(73))} n="2" audio="S.01">
        Listen. Which word do you hear? Circle it.
      </ExAt>
      <Fill b={card} color="#ffffff" border="#E0E0E0" bw={1} />
      <At b={card}>
        <View style={{ padding: INSET, paddingTop: 3 * INSET }}>
          <Items cols={2} down size={12.5} gap={12} font="Andika" items={["bag / back", "pen / ten", "hat / cat", "bus / box", "red / bed", "sit / six", "car / star", "boat / coat", "map / mop", "tree / three"]} />
        </View>
      </At>
      <Pic b={B(0, cx(2), ry(79), ry(97))} src={A.facesK.f10} fit="contain" name="girl (w-family-10)" />
      <ExAt b={B(cx(7), ce(12), ry(73))} n="3">
        Read the dialogue. Then act it out with a friend. Use your names.
      </ExAt>
      <Pic b={B(cx(9), ce(12), ry(85), ry(LAST_ROW))} src={A.people[4]} fit="contain" name="classmates (people-5)" />
      <Bubble b={B(cx(7), ce(9), ry(79))} tail="br" size={10.5}>
        {"Hi! I'm Tom.\nYou're new, right?"}
      </Bubble>
      <Bubble b={B(cx(7), ce(8), ry(90))} tail="br" size={10.5}>
        {"Is it Nadia\nor Nadja?"}
      </Bubble>
      <Bubble b={B(cx(10), ce(12), ry(80))} tail="br" size={11} border="#AB47BC" r={2}>
        {"Nadia!\nN-A-D-I-A."}
      </Bubble>
    </BookPage>
  );
}

// Crossword (exercise 6).
const CROSS: { word: string; r: number; c: number; down: boolean; n: number }[] = [
  { word: "ORANGE", r: 0, c: 2, down: true, n: 1 },
  { word: "PURPLE", r: 1, c: 0, down: false, n: 2 },
  { word: "PINK", r: 1, c: 0, down: true, n: 2 },
  { word: "YELLOW", r: 3, c: 4, down: true, n: 3 },
  { word: "GREEN", r: 4, c: 2, down: false, n: 4 },
  { word: "BLUE", r: 5, c: 8, down: true, n: 5 },
  { word: "WHITE", r: 8, c: 4, down: false, n: 6 },
];
function Crossword({ cell }: { cell: number }) {
  const cellsMap = new Map<string, number | undefined>();
  for (const w of CROSS)
    w.word.split("").forEach((_, i) => {
      const k = `${w.r + (w.down ? i : 0)},${w.c + (w.down ? 0 : i)}`;
      if (!cellsMap.has(k) || i === 0) cellsMap.set(k, i === 0 ? w.n : cellsMap.get(k));
    });
  return (
    <View style={{ width: cell * 9, height: cell * 9 }}>
      {[...cellsMap.entries()].map(([k, n]) => {
        const [r, c] = k.split(",").map(Number);
        return (
          <View key={k} style={{ position: "absolute", left: c * cell, top: r * cell, width: cell - 2, height: cell - 2, backgroundColor: "#fff", borderRadius: 3, borderWidth: 1, borderColor: "#B0BEC5" }}>
            {n ? <Text style={{ fontFamily: "Andika", fontSize: 6.5, color: "#455A64", marginLeft: 2 }}>{n}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}
// a/an labels on the classroom picture: where (fractions of the picture) each tag starts
const CLASS_LABELS: [string, string, number, number][] = [
  ["an", "umbrella", 0.2, 0.33],
  ["", "eraser", 0.04, 0.42],
  ["", "door", 0.36, 0.44],
  ["", "window", 0.36, 0.1],
  ["", "plant", 0.6, 0.12],
  ["", "bookcase", 0.5, 0.5],
  ["", "orange wall", 0.78, 0.1],
  ["", "girl", 0.87, 0.4],
  ["", "drawing", 0.84, 0.74],
  ["", "atlas", 0.06, 0.84],
  ["", "pencil case", 0.36, 0.63],
  ["", "pen", 0.56, 0.84],
];
const PAINT_GEOM = (b: Box) => ({ cw: (b.w - 20) / 3, ch: (b.h! - 170 / 3) / 3 });
function P9Colours() {
  const pb = BOX.paints;
  const { cw, ch } = PAINT_GEOM(pb);
  const cell = (ce(12) - cx(8)) / 9;
  return (
    <BookPage footer={<StarterFooter n={9} />}>
      <Decor b={B(ce(6), W, 0, ry(60))} fill="#E3F1FB" d={(X, Y, w, h) => `M${X(w * 0.27)} ${Y(0)} H${X(w)} V${Y(h)} H${X(w * 0.55)} Q${X(w * 0.09)} ${Y(h * 0.45)} ${X(w * 0.27)} ${Y(0)} Z`} />
      <Pic b={pb} src={A.paints} name="paint pots (drawn)" />
      <At b={B(pb.x + INSET, pb.x + pb.w, pb.y + INSET)}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <Title text="Colours" size={22} fill={["#E91E63", "#FB8C00", "#FDD835", "#43A047", "#1E88E5", "#8E24AA", "#E53935"]} stroke="#ffffff" />
          <View style={{ marginLeft: 16, marginTop: 4, flex: 1 }}>
            <Ex n="4" audio="S.02">
              Listen and repeat.
            </Ex>
          </View>
        </View>
      </At>
      {art.PAINTS.map(([name, col], i) => (
        <At key={name} b={B(pb.x + 10 + (i % 3) * cw, pb.x + 10 + ((i % 3) + 1) * cw, pb.y + 50 + Math.floor(i / 3) * ch + ch * 0.7)}>
          <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: 13, color: col === "#F5F5F5" ? "#9E9E9E" : col, textAlign: "center" }}>{name}</Text>
        </At>
      ))}
      <ExAt b={B(cx(7), ce(12), ry(0))} n="6">
        What colour is it? Write the colours in the crossword.
      </ExAt>
      {/* one column per picture: the down clues over columns 9-12, the across clues in column 7 */}
      {CROSS_PICS.map(([e, n], i) => (
        <React.Fragment key={e}>
          <Pic b={B(cx(9 + i), ce(9 + i), ry(6), ry(10))} src={E(e)} fit="contain" name={`emoji ${e}`} />
          <At b={B(cx(9 + i), ce(9 + i), ry(10))}>
            <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: 11, color: "#C2185B", textAlign: "center" }}>{n}↓</Text>
          </At>
        </React.Fragment>
      ))}
      <Fill b={B(cx(8), ce(12), ry(13), ry(13) + 1.5)} color="#B0BEC5" />
      {CROSS_PICS_ACROSS.map(([e, n], i) => (
        <React.Fragment key={e}>
          <Pic b={B(cx(7), ce(7), ry(16 + i * 12), ry(20 + i * 12))} src={E(e)} fit="contain" name={`emoji ${e}`} />
          <At b={B(cx(7), ce(7), ry(20 + i * 12))}>
            <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: 11, color: "#C2185B", textAlign: "center" }}>{n}→</Text>
          </At>
        </React.Fragment>
      ))}
      <At b={B(cx(8), ce(12), ry(15))}>
        <Crossword cell={cell} />
      </At>
      <ExAt b={B(cx(1), ce(6), ry(54))} n="5" audio="S.03">
        Write <Text style={{ color: BLUE }}>a</Text> or <Text style={{ color: BLUE }}>an</Text>. Then listen and check.
      </ExAt>
      <Fill b={B(cx(7), ce(12), ry(52), ry(63))} color="#ffffff" border="#7CB342" bw={3} r={12} />
      <Fill b={B(cx(7), ce(9), ry(52), ry(55))} color="#7CB342" radii={{ borderTopLeftRadius: 12, borderBottomRightRadius: 10 }} />
      <At b={B(cx(7) + INSET, ce(9), ry(52), ry(55))}>
        <View style={{ height: "100%", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 12, color: "#fff", lineHeight: 1 }}>a or an?</Text>
        </View>
      </At>
      <At b={B(cx(7) + INSET, ce(12) - INSET, ry(56))}>
        <Text style={t(9.6)}>
          <Bo>a</Bo> + consonant sound: <Bo>a</Bo> lamp, <Bo>a</Bo> bag
        </Text>
        <Text style={{ ...t(9.6), marginTop: 2 }}>
          <Bo>an</Bo> + vowel sound: <Bo>an</Bo> apple, <Bo>an</Bo> ice cream
        </Text>
      </At>
      <Pic b={BOX.classroom} src={A.classroom} r={6} name="classroom" />
      {CLASS_LABELS.map(([art0, l, fx, fy], i) => {
        const p = picPoint(BOX.classroom, imgAspect.classroom, {}, fx, fy);
        return (
          <At key={l} b={B(p.x, p.x + 40 * MM, p.y)}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <NumTag n={i + 1} size={13} />
              <View style={{ backgroundColor: "#ffffffDD", paddingHorizontal: 3, height: 13, justifyContent: "center" }}>
                <Text style={t(9.5)}>
                  {art0 ? <Text style={{ fontFamily: "Andika", color: BLUE }}>{art0} </Text> : "__ "}
                  {l}
                </Text>
              </View>
            </View>
          </At>
        );
      })}
    </BookPage>
  );
}

const NUM_WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "a hundred"];
const ORDINALS: [string, string, string][] = [
  ["1", "st", "first"], ["2", "nd", "second"], ["3", "rd", "third"], ["4", "th", "fourth"], ["5", "th", "fifth"],
  ["6", "th", "sixth"], ["8", "th", "eighth"], ["9", "th", "ninth"], ["10", "th", "tenth"], ["12", "th", "twelfth"],
  ["13", "th", "thirteenth"], ["20", "th", "twentieth"], ["21", "st", "twenty-first"], ["22", "nd", "twenty-second"], ["30", "th", "thirtieth"],
];
function P10Numbers() {
  const nb = BOX.numbers;
  const bus = g0(BOX.bus);
  const step = (bus.w - bus.w * 0.36 - 20 / 3) / 7;
  return (
    <BookPage ground={A.starGroundL} footer={<StarterFooter n={10} />}>
      <At b={B(cx(1), ce(4), ry(6))}>
        <Title text="Numbers" size={23} fill="#F06292" stroke="#7B1240" />
      </At>
      <ExAt b={B(cx(4), ce(6), ry(7))} n="7" audio="S.04">
        Listen and repeat.
      </ExAt>
      <Pic b={nb} src={A.numbers} name="number tiles (drawn)" />
      {NUM_WORDS.map((w, i) => (
        <At key={w} b={B(nb.x + ((i % 4) * nb.w) / 4, nb.x + (((i % 4) + 1) * nb.w) / 4, nb.y + (Math.floor(i / 4) * nb.h!) / 7 + (nb.h! * 0.73) / 7)}>
          <Text style={{ fontFamily: "Andika", fontSize: 10.5, color: INK, textAlign: "center" }}>{w}</Text>
        </At>
      ))}
      <Fill b={BOX.daysPanel} color="#FFFDF4" border="#F2C230" bw={2.5} radii={{ borderTopLeftRadius: 20, borderBottomLeftRadius: 20 }} />
      <At b={B(cx(7) + INSET, ce(8), ry(7))}>
        <Title text="Days" size={21} fill="#FFD23F" stroke="#7A4B00" />
      </At>
      <ExAt b={B(cx(9), ce(12), ry(7))} n="8" audio="S.05" size={9.8}>
        Write the missing letters. Then listen and check the days.
      </ExAt>
      <Pic b={BOX.pegs} src={A.pegs} name="pegs (drawn)" />
      <Pic b={BOX.ordinal} src={A.ordinal} name="ordinal panel (drawn)" />
      <At b={B(cx(7) + INSET, ce(12), ry(65))}>
        <Title text="Ordinal Numbers" size={17} fill="#E3F2FD" stroke="#1565C0" />
      </At>
      <At b={B(cx(7) + INSET, ce(12), ry(68))}>
        <Ex n="9" audio="S.06" color="#fff" size={10}>
          Listen and repeat.
        </Ex>
      </At>
      <At b={B(cx(7) + INSET, ce(12), ry(71))}>
        <View style={{ flexDirection: "row" }}>
          {[ORDINALS.slice(0, 5), ORDINALS.slice(5, 10), ORDINALS.slice(10)].map((col, ci) => (
            <View key={ci} style={{ width: ["29%", "31%", "40%"][ci] }}>
              {col.map(([d, s, w]) => (
                <Text key={w} style={{ fontFamily: "Noto", fontSize: 8.4, color: "#fff", lineHeight: 1.32 }}>
                  <Bo>
                    {d}
                    {s}
                  </Bo>{" "}
                  {w}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </At>
      <ExAt b={B(cx(1), ce(6), ry(83))} n="10">
        Who is in the queue? Write the ordinal numbers.
      </ExAt>
      <Pic b={BOX.bus} src={A.skylineBus} name="skyline (drawn)" />
      <Pic b={BOX.bus} src={A.bus} name="bus queue (drawn)" />
      {Array.from({ length: 7 }, (_, i) => {
        const x = bus.x + bus.w * 0.36 + i * step + step * 0.08;
        return (
          <At key={i} b={B(x, x + step * 0.9, ry(88))}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <NumTag n={i + 1} size={11} />
              <Text style={{ fontFamily: "Andika", fontSize: 9.5, color: BLUE, marginLeft: 2, borderBottomWidth: 0.8, borderColor: INK, flex: 1 }}>{i === 0 ? "first" : " "}</Text>
            </View>
          </At>
        );
      })}
    </BookPage>
  );
}

const TIME_CAPTIONS = ["It's half\npast seven.", "It's eight\no'clock.", "It's quarter\nto nine.", "It's ten\npast ten.", "It's quarter\npast eleven.", "It's twenty\nto one."];
const GREETINGS = ["Good morning!", "Good afternoon!", "Good evening!", "Good night!", "Hi! / Hello!", "Goodbye! / Bye!"];
function P11Time() {
  const gb = BOX.greetings;
  return (
    <BookPage ground={A.starGroundR} footer={<StarterFooter n={11} />}>
      <At b={B(cx(1), ce(6), ry(6))}>
        <Title text="Telling the Time" size={21} fill="#EC407A" stroke="#6A1B4D" />
      </At>
      <ExAt b={B(cx(1), ce(6), ry(11))} n="11" audio="S.07">
        Listen and repeat.
      </ExAt>
      {[0, 1].map((row) => (
        <Pic key={row} b={BOX.clockRow(row)} src={A.clocks[row]} name="clocks (drawn)" />
      ))}
      {TIME_CAPTIONS.map((c, i) => {
        const rb = BOX.clockRow(Math.floor(i / 3));
        return (
          <At key={c} b={B(rb.x + ((i % 3) * rb.w) / 3, rb.x + (((i % 3) + 1) * rb.w) / 3, rb.y + rb.h! + 0.5 * MM)}>
            <Text style={{ ...hand(10.5), textAlign: "center", lineHeight: 1.1 }}>{c}</Text>
          </At>
        );
      })}
      <ExAt b={B(cx(1), ce(6), ry(46))} n="12" audio="S.08">
        Listen and repeat.
      </ExAt>
      {/* the girl above, the boy below; their lines in one column beside them, in reading order */}
      <Pic b={B(cx(1), ce(2), ry(50), ry(64))} src={A.facesK.f8} fit="contain" name="girl (w-family-8)" />
      <Pic b={B(cx(1), ce(2), ry(64), ry(78))} src={A.facesK.f7} fit="contain" name="boy (w-family-7)" />
      <Bubble b={B(cx(3), ce(6), ry(50))} color="#FFD54F" border="#F9A825" tail="bl" size={10.5} r={14}>
        {"Is it three o'clock, Sam?"}
      </Bubble>
      <Bubble b={B(cx(3), ce(6), ry(57))} color="#81D4FA" border="#29B6F6" tail="bl" size={10.5} r={14}>
        {"No, it isn't. It's half past two."}
      </Bubble>
      <Bubble b={B(cx(3), ce(6), ry(64))} color="#FFD54F" border="#F9A825" tail="bl" size={10.5} r={14}>
        {"Oh good! I'm not late."}
      </Bubble>
      <Bubble b={B(cx(3), ce(6), ry(71))} color="#81D4FA" border="#29B6F6" tail="bl" size={10.5} r={14}>
        See you later!
      </Bubble>
      <Fill b={B(cx(1), ce(6), ry(80), ry(106))} color="#BBDEFB" r={18} border="#fff" bw={3} />
      <ExAt b={B(cx(1) + INSET, ce(6) - INSET, ry(81))} n="13">
        Point to a clock. Ask your partner: What time is it?
      </ExAt>
      <Pic b={BOX.actClocks} src={A.actClocks} name="clocks (drawn)" />
      <Fill b={gb} color="#B7DDE0" border="#F2C230" bw={2.5} />
      <At b={B(gb.x + INSET, gb.x + gb.w, gb.y + 1 * MM)}>
        <Title text="Greetings" size={19} fill="#546E7A" stroke="#ffffff" />
      </At>
      <ExAt b={B(gb.x + INSET, gb.x + gb.w - INSET, ry(8))} n="14" audio="S.09" size={9.8}>
        Listen and repeat. Which greeting do you use at 8 a.m.? And at 9 p.m.?
      </ExAt>
      {GREETINGS.map((g, i) => {
        const fx = GREET_CELLS.at(i % 2);
        const fy = greetRow(Math.floor(i / 2));
        return (
          <React.Fragment key={g}>
            <Pic b={B(fx, fx + GREET_CELLS.w, fy, fy + GREET_TILE_H)} src={A.schools[i]} r={6} border="#ffffff" name="school (drawn)" />
            {i === 4 ? <Pic b={B(fx, fx + GREET_CELLS.w, fy + 4 * 2.5 * MM, fy + GREET_TILE_H)} src={A.greetKids[0]} fit="contain" name="friends (w-friends)" /> : null}
            {i === 5 ? <Pic b={B(fx, cx(11) + INSET, fy + 3 * 2.5 * MM, fy + GREET_TILE_H)} src={A.greetKids[1]} fit="contain" name="Zara (cast)" /> : null}
            {i === 5 ? <Pic b={B(cx(11) + INSET, fx + GREET_CELLS.w, fy + 3 * 2.5 * MM, fy + GREET_TILE_H)} src={A.greetKids[2]} fit="contain" name="Theo (cast)" /> : null}
            <At b={B(fx, fx + GREET_CELLS.w, fy + GREET_TILE_H + 1 * MM)}>
              <Text style={{ ...hand(10.5, INK, 700), textAlign: "center" }}>{g}</Text>
            </At>
          </React.Fragment>
        );
      })}
      <ExAt b={B(cx(7), ce(12), ry(65))} n="15" audio="S.10">
        Listen and read. Where is Leo going?
      </ExAt>
      <Pic b={B(cx(7), ce(12), ry(69), ry(88))} src={A.friends} r={8} ay={0.3} name="friends (w-friends)" />
      <Fill b={B(cx(7), ce(12), ry(89), ry(105))} color="#ffffff" border="#90A4AE" bw={1} />
      <At b={B(cx(7), ce(12), ry(89))}>
        <View style={{ padding: INSET }}>
          {(
            [
              ["Maya", "Good afternoon, Leo! Is this your phone?"],
              ["Leo", "Yes, it is! Thanks, Maya."],
              ["Maya", "Where are you going?"],
              ["Leo", "To my piano lesson. It starts at four. What time is it now?"],
              ["Maya", "It's ten to four. Hurry up! Bye!"],
            ] as const
          ).map(([w, s], i) => (
            <View key={i} style={{ flexDirection: "row" }}>
              <Text style={{ ...t(9.6, 400, "#5C6BC0"), width: 34 }}>{w}:</Text>
              <Text style={{ ...t(9.6), flex: 1 }}>{s}</Text>
            </View>
          ))}
        </View>
      </At>
    </BookPage>
  );
}

const CLASS_SENTENCES = ["Put your book away.", "Read with a partner.", "Can you say that again, please?", "Put your hand up, please.", "It's hot. Open the window, please.", "Write your name here.", "Put your rubbish in the bin.", "Listen, everyone!"];
function P12Classroom() {
  // four across = columns 1-3, 4-6, 7-9, 10-12
  const pc = cells(cx(1), ce(12), 4, 6 * MM);
  const oc = pc;
  const panelX = cx(1) - INSET;
  return (
    <BookPage bg="#F3F8F8" footer={<StarterFooter n={12} />}>
      <Fill b={B(0, W, 0, ry(4))} color="#ffffff" />
      <Fill b={B(panelX, W, ry(4), ry(56))} color="#ffffff" />
      <Fill b={B(panelX, panelX + 3, ry(4), ry(56))} color="#F2C230" />
      <Fill b={B(panelX, W, ry(4), ry(4) + 3)} color="#F2C230" />
      <At b={B(cx(1), ce(6), ry(6))}>
        <Title text="Classroom Language" size={20} fill="#C0392B" stroke="#ffffff" />
      </At>
      <ExAt b={B(cx(7), ce(12), ry(6))} n="16" audio="S.11" size={10}>
        Listen and repeat. Then write the sentence numbers in the boxes.
      </ExAt>
      {A.classlang.map((c, i) => {
        const x = pc.at(i % 4);
        const y = ry(12 + Math.floor(i / 4) * 18);
        return (
          <React.Fragment key={i}>
            <Pic b={B(x, x + pc.w, y, y + 42.5 * MM)} src={c} fit="contain" name={`classroom language ${i + 1}`} />
            <At b={B(x, x + 13, y)}>
              <View style={{ alignItems: "center" }}>
                <NumTag n={"ABCDEFGH"[i]} size={13} />
                <View style={{ width: 13, height: 15, borderWidth: 1, borderColor: "#E57373", backgroundColor: "#fff" }} />
              </View>
            </At>
          </React.Fragment>
        );
      })}
      <Fill b={B(panelX, W, ry(48), ry(56))} color="#CDEBE9" />
      <At b={B(cx(1), ce(12), ry(49))}>
        <Items cols={4} down size={9.6} gap={3} items={CLASS_SENTENCES} />
      </At>
      <ExAt b={B(cx(1), ce(5), ry(60))} n="17">
        Write the words under the pictures.
      </ExAt>
      <WordBanner b={B(cx(6), ce(11), ry(59), ry(65))} lines={["computer - crayon - drawing pin - notebook", "paintbrush - paper clip - ruler - scissors"]} />
      {OBJECTS.map(([e], i) => {
        const x = oc.at(i % 4);
        const y = ry(68 + Math.floor(i / 4) * 18);
        return (
          <React.Fragment key={e}>
            <Pic b={B(x, x + oc.w, y, y + 10 * 2.5 * MM)} src={E(e)} fit="contain" name={`emoji ${e}`} />
            <At b={B(x, x + oc.w, y + 12 * 2.5 * MM)}>
              <AnswerBox n={i + 1} w={oc.w} />
            </At>
          </React.Fragment>
        );
      })}
    </BookPage>
  );
}

// ex19: the questions, lettered; ex20: what each one says, lettered
const JOBS_ABC = ["baker", "farmer", "firefighter", "mechanic", "nurse", "photographer", "pilot", "police officer", "vet", "waiter"];
const JOB_QUESTIONS = [
  "Your car doesn't start. Who can fix it?",
  "Who sits at the front of a plane?",
  "There's a fire in the kitchen! Who do you call?",
  "You want a birthday cake. Who makes it?",
  "Your bike isn't in the street! Who do you tell?",
  "You need a photo for your school card. Who takes it?",
  "Your rabbit is ill. Who can help it?",
  "You're in a café and you're hungry. Who takes your order?",
  "Who works on a farm and drives a tractor?",
  "Who gives you your medicine in hospital?",
];
const JOB_QUOTES = [
  '"Your car needs new tyres. Come back on Friday."',
  '"Here\'s your pizza. Enjoy your meal!"',
  '"Look! The tomatoes are red. Let\'s pick them."',
  '"Don\'t worry - the fire is out now."',
  '"This is your captain speaking. It\'s sunny in Madrid."',
  '"Hold out your arm, please. This doesn\'t hurt."',
  '"Smile, please! Say cheese!"',
  '"Hold your hamster gently. Its leg is OK now."',
  '"Is this your bike? We found it in the park."',
  '"These buns are hot - they\'re from the oven!"',
];
function JobList() {
  return (
    <>
      {JOBS_ABC.map((j, i) => (
        <View key={j} style={{ flexDirection: "row", marginBottom: 2.6 }}>
          <Check />
          <Text style={{ ...t(10), width: 16, fontWeight: 700 }}>{i + 1}</Text>
          <Text style={t(10)}>{j}</Text>
        </View>
      ))}
    </>
  );
}
function P13Jobs() {
  const jg = jobsGeom();
  const frame = B(cx(1), ce(12), ry(75), ry(100));
  return (
    <BookPage footer={<StarterFooter n={13} />}>
      <Decor b={B(0, ce(6), ry(-2), ry(38))} fill="#9CCC65" d={(X, Y, w, h) => `M${X(0)} ${Y(h * 0.08)} L${X(w * 0.84)} ${Y(0)} L${X(w * 0.72)} ${Y(h * 0.18)} L${X(cx(1) - 0.01)} ${Y(h * 0.18)} L${X(cx(1) - 0.01)} ${Y(h)} L${X(0)} ${Y(h)} Z`} />
      <ExAt b={B(cx(1), ce(5), ry(2))} n="18">
        Look and write the jobs.
      </ExAt>
      <WordBanner b={B(cx(6), ce(12), ry(0), ry(7))} lines={["baker • farmer • firefighter • mechanic • nurse", "photographer • pilot • police officer • vet • waiter"]} size={10} />
      <Pic b={BOX.jobs} src={A.jobsArt} name="jobs in circles (cut-outs)" />
      {Array.from({ length: 10 }, (_, i) => (
        <At key={i} b={B(jg.cell.at(i % 5), jg.cell.at(i % 5) + jg.cell.w, jg.boxY(i))}>
          <AnswerBox n={i + 1} w={jg.cell.w} />
        </At>
      ))}
      <Decor b={B(cx(1), ce(6), ry(42), ry(47))} fill="#AED581" d={(X, Y, w, h) => `M${X(0)} ${Y(0)} H${X(w)} L${X(w * 0.93)} ${Y(h)} H${X(0)} Z`} />
      <ExAt b={B(cx(1) + INSET, ce(6), ry(43))} n="19">
        Who is it? Match the jobs with the questions.
      </ExAt>
      <At b={B(cx(1) + INSET, ce(4), ry(49))}>
        <JobList />
      </At>
      <At b={B(cx(5), ce(12), ry(49))}>
        <Items letters size={9.6} gap={2.6} items={JOB_QUESTIONS} />
      </At>
      <ExAt b={B(cx(1), ce(12), ry(71))} n="20">
        Who says it? Write the letters in the boxes.
      </ExAt>
      <Fill b={B(frame.x, frame.x + frame.w, frame.y, frame.y + 1.2 * MM)} color="#64B5F6" />
      <Fill b={B(frame.x, frame.x + frame.w, frame.y + frame.h! - 1.2 * MM, frame.y + frame.h!)} color="#64B5F6" />
      <Fill b={B(frame.x, frame.x + 1.7 * MM, frame.y, frame.y + frame.h!)} color="#9CCC65" r={3} />
      <Fill b={B(frame.x + frame.w - 1.7 * MM, frame.x + frame.w, frame.y, frame.y + frame.h!)} color="#9CCC65" r={3} />
      <At b={B(cx(1) + INSET, ce(4), ry(78))}>
        <JobList />
      </At>
      <At b={B(cx(5), ce(12) - INSET, ry(78))}>
        <Items letters size={9.6} gap={2.6} items={JOB_QUOTES} />
      </At>
    </BookPage>
  );
}

// numbered tags on the town picture: where (fractions of the picture) each starts
const TOWN_TAGS: [string, number, number][] = [
  ["cinema", 0.7, 0.3],
  ["market", 0.08, 0.52],
  ["museum", 0.88, 0.3],
  ["park", 0.22, 0.24],
  ["baker's", 0.55, 0.36],
  ["chemist's", 0.36, 0.25],
];
const TOWN_FIT = { anchorY: 0.45 };
const CLUES = [
  '"Two tickets for the seven o\'clock film, please."',
  '"A kilo of tomatoes and four lemons, please."',
  '"Look at this old Roman coin!"',
  '"Can I have a chocolate cake for my mum\'s birthday?"',
  '"Let\'s sit by the fountain and feed the ducks."',
  '"This medicine is for your cough. Take it after dinner."',
];
function P14Places() {
  const c = A.cast;
  const name = (s: string) => <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#283593" }}>{s}</Text>;
  return (
    <BookPage footer={<StarterFooter n={14} />}>
      <ExAt b={B(cx(1), ce(6), ry(4))} n="21">
        Write the places from the box next to the numbers.
      </ExAt>
      <WordBanner b={B(cx(8), ce(12), ry(3), ry(8))} lines={["park • cinema • museum", "baker's • chemist's • market"]} size={10} />
      <Pic b={BOX.town} src={A.town} ay={TOWN_FIT.anchorY} name="town" />
      {TOWN_TAGS.map(([place, fx, fy], i) => {
        const p = picPoint(BOX.town, imgAspect.town, TOWN_FIT, fx, fy);
        return (
          <At key={place} b={B(p.x, p.x + 30, p.y, p.y + 14)}>
            <View style={{ flexDirection: "row" }}>
              <NumTag n={i + 1} size={14} />
              <View style={{ width: 16, height: 14, backgroundColor: "#fff" }} />
            </View>
          </At>
        );
      })}
      <ExAt b={B(cx(1), ce(12), ry(40))} n="22">
        Where are these people? Read and write the places from <Text style={{ color: "#C62828" }}>Exercise 21</Text>.
      </ExAt>
      <Fill b={B(cx(1), W, ry(43), ry(62))} color="#E1F0F7" />
      <At b={B(cx(1) + INSET, ce(12), ry(43) + INSET)}>
        <Items size={10.5} gap={4.6} items={CLUES.map((c2) => `${c2}  ${blank(18)}`)} />
      </At>
      <ExAt b={B(cx(1), ce(6), ry(64))} n="23" audio="S.12">
        Meet the Hill Park friends.
      </ExAt>
      <Pic b={B(cx(1), ce(3), ry(67), ry(82))} src={c[0]} fit="contain" name="Star-Bus (cast)" />
      <At b={B(cx(1), ce(3), ry(83))}>{name("Star-Bus")}</At>
      <Bubble b={B(cx(4), ce(9), ry(68))} tail="bl" font="Noto" size={10} center={false} r={12}>
        {"Beep-beep! I'm Star-Bus, the flying school bus of Hill Park School. Every morning I take Zara, Theo and their friends to school."}
      </Bubble>
      <Pic b={B(cx(11), ce(12), ry(65), ry(90))} src={c[1]} fit="contain" name="Zara (cast)" />
      <At b={B(cx(10), ce(10), ry(66))}>
        <View style={{ alignItems: "flex-end" }}>{name("Zara")}</View>
      </At>
      <Bubble b={B(cx(6), ce(10), ry(76))} tail="br" font="Noto" size={10} center={false} r={12}>
        {"Hi! I'm Zara and I'm eleven. I love robots - I made Pip! My favourite subject is Science."}
      </Bubble>
      <Pic b={B(0, ce(2), ry(87), ry(LAST_ROW))} src={c[3]} fit="contain" name="K-77 (cast)" />
      <At b={B(cx(3), ce(4), ry(88))}>{name("K-77")}</At>
      <Bubble b={B(cx(3), ce(5), ry(93))} tail="bl" font="Noto" size={10} center={false} r={12}>
        {"I'm K-77, the crossing robot at the school gate. I help children cross the road. Slow down, Star-Bus!"}
      </Bubble>
      <Pic b={B(cx(6), ce(7), ry(85), ry(LAST_ROW))} src={c[2]} fit="contain" name="Theo (cast)" />
      <At b={B(cx(6), ce(7), ry(83))}>
        <View style={{ alignItems: "center" }}>{name("Theo")}</View>
      </At>
      <Bubble b={B(cx(8), ce(12), ry(91))} tail="bl" font="Noto" size={10} center={false} r={12}>
        {"Hello! I'm Theo, Zara's cousin. I'm twelve and I'm new at Hill Park School. I like music and making things."}
      </Bubble>
      <Pic b={B(cx(11), ce(12), ry(97), ry(LAST_ROW))} src={c[4]} fit="contain" name="Pip (cast)" />
      <Bubble b={B(cx(8), ce(10), ry(99))} tail="br" font="Noto" size={10} center={false} r={12}>
        {"Tweet-tweet! I'm Pip, Zara's robot owl. Smile for my camera!"}
      </Bubble>
    </BookPage>
  );
}

// --- pages: Theme 1 ------------------------------------------------------------------------------
function P15ThemeOpener() {
  return (
    <BookPage bg="#CDE9F8" footer={<ThemeFooter n={15} />}>
      <Pic b={FULL} src={A.theme1} name="theme 1 opener" />
      <Decor b={B(0, W, 0, ry(24))} fill="#ffffff" opacity={0.92} d={(X, Y, w, h) => `M${X(0)} ${Y(0)} H${X(w)} V${Y(h * 0.6)} Q${X(w * 0.7)} ${Y(h * 0.4)} ${X(w * 0.45)} ${Y(h * 0.78)} Q${X(w * 0.2)} ${Y(h * 1.08)} ${X(0)} ${Y(h * 0.82)} Z`} />
      <Fill b={B(cx(5), W, ry(9), ry(10))} color="#37404F" />
      <Fill b={B(cx(1) + 2 * MM, ce(4) + 2 * MM, ry(6), ry(15))} color="#37404F" />
      <Fill b={B(cx(1), ce(4), ry(5), ry(14))} color="#C9A227" />
      <At b={B(cx(1), ce(4), ry(5), ry(14))}>
        <View style={{ height: "100%", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 34, color: "#fff", marginTop: 6 }}>Theme 1</Text>
        </View>
      </At>
      <Fill b={B(cx(8), ce(12), ry(2), ry(34))} color={GOLD} />
      <At b={B(cx(8), ce(12), ry(2), ry(34))}>
        <View style={{ padding: INSET }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#fff", lineHeight: 1.05 }}>Vocabulary</Text>
          {["Jobs at school", "A day at school", "School clubs"].map((x) => (
            <Text key={x} style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 9.4, color: SLATE, marginLeft: 6, lineHeight: 1.3 }}>
              • {x}
            </Text>
          ))}
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#fff", marginTop: 3, lineHeight: 1.05 }}>Grammar</Text>
          {["am / is / are", "I, you, he ... / my, your, his ...", "Commands: Sit down! Don't run!", "Who? What? Where? When?", "can / must (permission)", "love / like / hate + -ing"].map((x) => (
            <Text key={x} style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 9.4, color: SLATE, marginLeft: 6, lineHeight: 1.3 }}>
              • {x}
            </Text>
          ))}
        </View>
      </At>
      <Bubble b={B(cx(3), ce(4), ry(32))} color="#EC407A" border="#fff" textColor="#fff" size={12} tail="bl" r={18}>
        {"Don't run!\nSquawk!"}
      </Bubble>
      <Bubble b={B(cx(1), ce(3), ry(43))} color="#FFCA28" border="#fff" size={12} tail="bl" r={18}>
        {"I love playing\nfootball!"}
      </Bubble>
      <Bubble b={B(cx(5), ce(7), ry(38))} color="#4DD0E1" border="#fff" size={12} tail="br" r={18}>
        {"Where's the\nmusic room?"}
      </Bubble>
      <Bubble b={B(cx(9), ce(11), ry(49))} color="#BA68C8" border="#fff" textColor="#fff" size={12} tail="br" r={18}>
        {"Can I park my\nscooter here?"}
      </Bubble>
    </BookPage>
  );
}

function StoryBox({ b, lines, nameW = 42 }: { b: Box; lines: [string, string][]; nameW?: number }) {
  const col: Record<string, string> = { Maya: "#AD1457", Theo: "#1565C0", Zara: "#E65100", "Mr Okafor": "#2E7D32" };
  return (
    <At b={b}>
      <View style={{ backgroundColor: "#ffffffE6", padding: 6, borderRadius: 4 }}>
        {lines.map(([w, s], i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 1 }}>
            <Text style={{ ...t(10, 700, col[w] ?? INK), width: nameW }}>{w}</Text>
            <Text style={{ ...t(10), width: 6 }}>:</Text>
            <Text style={{ ...t(10), flex: 1 }}>{s}</Text>
          </View>
        ))}
      </View>
    </At>
  );
}
function P16Story() {
  return (
    <BookPage footer={<ThemeFooter n={16} module="A" />}>
      <Pic b={FULL} src={A.story} name="story comic" />
      <At b={B(cx(1), ce(4), ry(1))}>
        <View style={{ borderWidth: 1.5, borderColor: "#E53935", borderStyle: "dashed", borderRadius: 10, backgroundColor: "#fff", paddingVertical: 5, paddingTop: 11, paddingLeft: INSET + 6 - 1.5, paddingRight: 5 }}>
          <Text style={hand(10.5)}>floor - mine - glow - model - project - Earth - round</Text>
        </View>
      </At>
      <Fill b={B(cx(1) + INSET, ce(3), ry(0), ry(2))} color="#E53935" r={7} />
      <At b={B(cx(1) + INSET, ce(3), ry(0), ry(2))}>
        <View style={{ height: "100%", flexDirection: "row", alignItems: "center", paddingLeft: 6 }}>
          <Text style={{ fontFamily: "Sym", fontSize: 9, color: "#FFEB3B", lineHeight: 1 }}>✓ </Text>
          <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: 9.5, color: "#fff", lineHeight: 1 }}>Check these words</Text>
        </View>
      </At>
      <StoryBox
        b={B(cx(1), ce(4), ry(8))}
        nameW={30}
        lines={[
          ["Maya", "Theo, is this your jumper? It's on the floor."],
          ["Theo", "No, it isn't. Mine is in my bag."],
          ["Zara", "Ha-ha! That's Ben's jumper - look, his name is on it!"],
          ["Maya", "Oh, sorry, Theo."],
          ["Theo", "That's OK. But where is my bag?"],
          ["Zara", "It's on your back, Theo!"],
        ]}
      />
      <StoryBox
        b={B(ce(9), ce(12), ry(33))}
        nameW={54}
        lines={[
          ["Maya", "Theo! What's that under your desk?"],
          ["Theo", "My glow ball! A model of the Moon!"],
          ["Mr Okafor", "Theo, are you playing in my lesson?"],
          ["Theo", "No, sir. It's for my science project."],
          ["Mr Okafor", "A science project? Interesting ..."],
        ]}
      />
      <StoryBox
        b={B(cx(1), ce(5), ry(74))}
        nameW={60}
        lines={[
          ["Mr Okafor", "Theo, please come to the board and tell us about your project."],
          ["Theo", "This is the Earth, and this is the Moon. The Moon goes round the Earth."],
          ["Mr Okafor", "Very good! And where is the Sun?"],
          ["Theo", "Er ... the Sun is in my bag!"],
          ["Zara", "Ha-ha! You're a great teacher, Theo!"],
        ]}
      />
      <Fill b={B(cx(2), ce(9), ry(96), ry(106))} color="#ffffff" border="#E53935" bw={2.5} r={14} />
      <At b={B(cx(2), ce(9), ry(96))}>
        <View style={{ padding: 6, paddingTop: 4 }}>
          <Ex n="1" audio="1.01" size={10.2}>
            Read and listen to the story. Then answer the questions.
          </Ex>
          <Items cols={2} size={9.8} gap={1.5} items={["Whose jumper is it?", "Where is Theo's bag?", "What is Theo's glow ball?", "Is Mr Okafor angry at the end?"]} />
        </View>
      </At>
    </BookPage>
  );
}

const PEOPLE = ["librarian", "cook", "coach", "music teacher", "classmates", "caretaker", "headteacher", "bus driver", "school nurse"];
const PEOPLE_TEXT = [
  "Mrs Lane helps you find a good book. She's the",
  "Mr Diaz makes soup and pasta for lunch. He's the",
  "Mr Shaw fixes doors, windows and lights. He's the",
  "Ms Kim puts a plaster on your knee. She's the",
  "Ella and Ben sit with me in every lesson. They're my",
  "Mr Reed blows his whistle on the football field. He's the",
  "Mrs Hart visits every class on Mondays. She's the",
  "Miss Rossi plays the piano and we sing. She's the",
];
function P17Vocabulary() {
  const pg = peopleGeom();
  const panel = B(cx(7), ce(12), ry(43), ry(105));
  return (
    <BookPage footer={<ThemeFooter n={17} module="A" />}>
      <Fill b={B(0, W, 0, ry(1))} color="#EAF4FB" />
      <ModuleBadge code="1A" />
      <Tab x={cx(1)} y={ry(0)} label="Vocabulary" />
      <ExAt b={B(cx(1), ce(6), ry(UNDER_TAB.one))} n="2" audio="1.02">
        Listen and repeat.
      </ExAt>
      <Pic b={BOX.people} src={A.peopleArt} name="school staff (cut-outs)" />
      {PEOPLE.map((p, i) => (
        <At key={p} b={B(pg.left(i), pg.left(i) + pg.cw, pg.labelY(i))}>
          <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: 11.5, color: SLATE, textAlign: "center" }}>{p}</Text>
        </At>
      ))}
      <ExAt b={B(cx(1), ce(6), ry(42))} n="3">
        Which person uses it? Write the letters.
      </ExAt>
      {A.tiles3.map((tl, i) => {
        const x = i % 2 ? cx(4) : cx(1);
        const y = ry(46 + Math.floor(i / 2) * 10);
        return (
          <React.Fragment key={i}>
            <Pic b={B(x, ce(i % 2 ? 5 : 2), y, y + 20 * MM)} src={tl} r={3} border="#455A64" name="tile (Twemoji)" />
            <At b={B(ce(i % 2 ? 5 : 2) + 1.5 * MM, ce(i % 2 ? 5 : 2) + 1.5 * MM + 13, y)}>
              <NumTag n={i + 1} size={13} />
              <View style={{ width: 13, height: 15, borderWidth: 1, borderColor: "#E57373", backgroundColor: "#fff" }} />
            </At>
          </React.Fragment>
        );
      })}
      <WordBanner b={B(cx(1), ce(6), ry(89), ry(95))} lines={["A. coach • B. music teacher • C. cook • D. nurse", "E. classmates • F. librarian • G. headteacher • H. caretaker"]} color="#F9C80E" size={9.4} />
      <Fill b={panel} color="#D9EEF9" r={16} border="#5DA9DD" bw={2} />
      <ExAt b={B(cx(7) + INSET, ce(12) - INSET, ry(45))} n="4">
        Read about the people at Hill Park School. Complete with the words in the box.
      </ExAt>
      <WordBanner b={B(cx(7) + INSET, ce(12) - INSET, ry(51), ry(57))} lines={["caretaker • classmates • coach • cook", "headteacher • librarian • music teacher • nurse"]} size={9.6} />
      <At b={B(cx(7) + INSET, ce(12) - INSET, ry(59))}>
        <Items
          size={9.8}
          gap={5}
          items={PEOPLE_TEXT.map((r, i) => (
            <Text key={i} style={t(9.8)}>
              {r} {blank(14)}.
            </Text>
          ))}
        />
      </At>
    </BookPage>
  );
}

function GrammarTable({ head, rows, w, widths }: { head: string; rows: string[][]; w: number; widths: number[] }) {
  return (
    <View style={{ width: w, borderWidth: 1, borderColor: "#37474F", marginRight: 4 }}>
      <View style={{ backgroundColor: "#4A5470", paddingVertical: 2 }}>
        <Text style={{ ...t(8.8, 700, "#fff"), textAlign: "center" }}>{head}</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", backgroundColor: "#fff" }}>
          {r.map((c, j) => (
            <Text key={j} style={{ ...t(8.2), lineHeight: 1.2, flex: widths[j], textAlign: "center", paddingVertical: 0.6, borderLeftWidth: j ? 0.6 : 0, borderColor: "#CFD8DC" }}>
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
const PRON = ["I", "You", "He", "She", "It", "We", "You", "They"];
const BE = ["am", "are", "is", "is", "is", "are", "are", "are"];
function P18Grammar() {
  const tw = 35 * MM;
  const pc = cells(cx(1), ce(6), 2, 6 * MM);
  return (
    <BookPage bg="#E6F2FB" footer={<ThemeFooter n={18} module="A" />}>
      <Fill b={B(cx(1) - INSET, W, ry(-1), ry(LAST_ROW))} color="#ffffff" radii={{ borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }} />
      <Tab x={cx(1)} y={ry(0)} label="Grammar" />
      <Fill b={B(cx(5), ce(10), ry(3), ry(7))} color="#F57C00" radii={{ borderTopLeftRadius: 12 }} />
      <At b={B(cx(5) + INSET, ce(10), ry(3), ry(7))}>
        <View style={{ height: "100%", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 14, color: "#fff", lineHeight: 1 }}>The verb &quot;to be&quot;</Text>
        </View>
      </At>
      <Pic b={B(cx(11), ce(12), ry(-1), ry(8))} src={A.facesK.f10} fit="contain" name="girl (w-family-10)" />
      <Fill b={B(cx(1), ce(10), ry(9), ry(27))} color="#FFFDF2" border="#F2C230" bw={3} r={14} />
      <At b={B(cx(1) + INSET, ce(10), ry(9) + INSET)}>
        <View style={{ flexDirection: "row" }}>
          <GrammarTable head="Positive" w={tw} widths={[1, 1, 1.4]} rows={PRON.map((p, i) => [p, BE[i], "ready."])} />
          <GrammarTable head="Negative" w={tw} widths={[1, 1.3, 1.1]} rows={PRON.map((p, i) => [p, `${BE[i]} not`, "late."])} />
          <GrammarTable head="Questions" w={tw} widths={[1, 1, 1]} rows={PRON.map((p, i) => [BE[i][0].toUpperCase() + BE[i].slice(1), p === "I" ? "I" : p.toLowerCase(), "OK?"])} />
          <View style={{ width: 24 * MM, borderWidth: 1, borderColor: "#37474F", backgroundColor: "#fff" }}>
            <View style={{ backgroundColor: "#4A5470", paddingVertical: 2 }}>
              <Text style={{ ...t(8.8, 700, "#fff"), paddingLeft: 4 }}>Short answers</Text>
            </View>
            {["Yes, I am.", "No, I'm not.", "Yes, she is.", "No, they aren't."].map((s) => (
              <Text key={s} style={{ ...t(8.6), paddingLeft: 4, paddingVertical: 4.2 }}>
                {s}
              </Text>
            ))}
          </View>
        </View>
      </At>
      <Fill b={B(cx(11), W, ry(12), ry(25))} color={GOLD} radii={{ borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }} />
      <At b={B(cx(11), ce(12), ry(12))}>
        <View style={{ padding: 4 }}>
          <Text style={{ ...t(9, 700, "#fff"), backgroundColor: "#F9A825", borderRadius: 4, marginBottom: 2, paddingLeft: 2 }}>Short forms</Text>
          {["I'm = I am", "you're = you are", "he's = he is", "isn't = is not"].map((s) => (
            <Text key={s} style={{ ...t(8, 700, SLATE), paddingLeft: 2 }}>
              {s}
            </Text>
          ))}
        </View>
      </At>
      <ExAt b={B(cx(1), ce(6), ry(31))} n="5">
        What are they like? Look and write the correct form of <Text style={{ color: BLUE }}>&quot;to be&quot;</Text>.
      </ExAt>
      {(
        [
          [A.faces.f1, <>Grandpa Joe {ans("is")} happy today.</>, false],
          [A.boys, <>Ben and Kofi {blank(6)} good at video games.</>, false],
          [A.faces.f8, <>Ella {blank(6)} nine years old.</>, false],
          [A.people[2], <>Mr Reed {blank(6)} our PE teacher.</>, true],
          [A.cast[0], <>Star-Bus {blank(6)} purple.</>, true],
          [A.park, <>We {blank(6)} in the park with our friends.</>, false],
        ] as [Buffer, React.ReactNode, boolean][]
      ).map(([src, cap, cut], i) => {
        const x = pc.at(i % 2);
        const y = ry(37 + Math.floor(i / 2) * 14);
        return (
          <React.Fragment key={i}>
            <Pic b={B(x, x + pc.w, y, y + 9 * 2.5 * MM)} src={src} r={3} fit={cut ? "contain" : "cover"} subject={!cut} border="#B0BEC5" ground={cut ? "#ffffff" : undefined} name={`ex5 picture ${i + 1}`} />
            <At b={B(x + 1 * MM, x + 1 * MM + 16, y + 1 * MM)}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: ["#E53935", "#43A047", "#5E35B1", "#1E88E5", "#FB8C00", "#00897B"][i], alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" }}>
                <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 10, color: "#fff" }}>{i + 1}</Text>
              </View>
            </At>
            <At b={B(x, x + pc.w, y + 9 * 2.5 * MM + 1 * MM)}>
              <Text style={{ ...t(9.6), textAlign: "center" }}>{cap}</Text>
            </At>
          </React.Fragment>
        );
      })}
      <Fill b={B(cx(1), ce(6), ry(80), ry(LAST_ROW))} color="#FCE4EC" r={30} />
      <Fill b={B(cx(1) + INSET, ce(6) - INSET, ry(82), ry(106))} color="#ffffff" border="#E0E0E0" bw={1} />
      <At b={B(cx(1) + INSET, ce(6) - INSET, ry(82))}>
        <View style={{ padding: INSET }}>
          <Ex n="6">Fill in the gaps with am, is or are.</Ex>
          <View style={{ height: 5 }} />
          <Items size={10.2} gap={3.2} items={[<>My dog {ans("is")} black and white.</>, `Kofi and I ${blank(6)} in the school band.`, `${blank(6)} your sister at home?`, `Today ${blank(6)} Monday.`, `You ${blank(6)} late again, Theo!`, `The shoes ${blank(6)} under the bed.`, `I ${blank(6)} not hungry, thank you.`]} />
        </View>
      </At>
      <ExAt b={B(cx(7), ce(12), ry(31))} n="7">
        Read Kofi&apos;s text and write <Text style={{ color: BLUE }}>am, is</Text> or <Text style={{ color: BLUE }}>are</Text>.
      </ExAt>
      <Fill b={B(cx(7), ce(12), ry(36), ry(63))} color="#F1F8E9" r={120} border="#C5E1A5" bw={2} />
      <At b={B(cx(7), ce(12), ry(36), ry(63))}>
        <View style={{ height: "100%", paddingHorizontal: 22, justifyContent: "center" }}>
          <Text style={{ ...t(10), textAlign: "center", lineHeight: 1.42 }}>
            Hi! I&apos;m Kofi. This ¹{ans("is")} my school, Hill Park School. It ² {blank(5)} in the centre of Brightwater. The building ³ {blank(5)} yellow and red, and the clock ⁴ {blank(5)} very big. The classrooms ⁵ {blank(5)} bright and the garden ⁶ {blank(5)} beautiful. I ⁷ {blank(5)} in Class 6C with Ella and Ben. They ⁸ {blank(5)} really funny. Our teacher, Mr Okafor, ⁹ {blank(5)} very kind. We ¹⁰ {blank(5)} a great team!
          </Text>
        </View>
      </At>
      <Pic b={B(cx(7), ce(12), ry(65), ry(84))} src={A.theme1} r={4} ay={0.45} name="theme 1 school" />
      <ExAt b={B(cx(7), ce(12), ry(86))} n="8">
        Ask and answer about Kofi&apos;s school.
      </ExAt>
      <At b={B(cx(7), ce(12), ry(89))}>
        <Items
          size={10}
          gap={2.6}
          items={[
            <Text key="a" style={t(10)}>
              the school / in Brightwater? <Text style={hand(10, BLUE)}>Is the school in Brightwater? - Yes, it is.</Text>
            </Text>,
            "the building / blue and white?",
            "the classrooms / dark?",
            "Kofi / in Class 6B?",
            "Mr Okafor / kind?",
          ]}
        />
      </At>
      <ExAt b={B(cx(7), ce(12), ry(102))} n="9">
        Now describe your school in five sentences. Look at Kofi&apos;s text for ideas.
      </ExAt>
    </BookPage>
  );
}

function P19Speaking() {
  const form = B(0, ce(4), ry(68), ry(103));
  return (
    <BookPage footer={<ThemeFooter n={19} module="A" />}>
      <Fill b={B(0, 3 * MM, 0, H)} color="#7E57C2" />
      <Fill b={B(0, ce(5), ry(105), ry(LAST_ROW))} color="#C77DD9" />
      <Tab x={cx(1)} y={ry(0)} label="Speaking" />
      <ExAt b={B(cx(1), ce(6), ry(UNDER_TAB.one))} n="10">
        Ask your partner about clubs. Look at the example.
      </ExAt>
      <Pic b={B(cx(1), ce(6), ry(12), ry(54))} src={A.park} r={14} ax={0.35} name="park (1c-park)" />
      <Bubble b={B(cx(2), ce(5), ry(17))} color="#F06292" border="#fff" textColor="#fff" size={11} tail="bl" r={3}>
        {"Are you in the school choir, Sam?"}
      </Bubble>
      <Bubble b={B(cx(4), ce(6), ry(24))} color="#64B5F6" border="#fff" textColor="#fff" size={11} tail="br" r={3}>
        {"Yes, I am! And you?"}
      </Bubble>
      <Bubble b={B(cx(2), ce(4), ry(31))} color="#F06292" border="#fff" textColor="#fff" size={11} tail="bl" r={3}>
        {"No, I'm in the chess club."}
      </Bubble>
      <Tab x={cx(1)} y={ry(57)} label="Listening" />
      <ExAt b={B(cx(1), ce(6), ry(63))} n="11" audio="1.03">
        Listen and complete Mia&apos;s club card.
      </ExAt>
      <Fill b={form} color="#ffffff" border="#CFD8DC" bw={1} />
      <At b={B(cx(1), ce(4), ry(68) + INSET)}>
        {["Name", "Class", "Age", "Club", "Day", "Time", "Room", "Teacher"].map((f) => (
          <View key={f} style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 7.5 }}>
            <Text style={hand(10.5, "#37474F")}>{f}:</Text>
            <View style={{ flex: 1, borderBottomWidth: 0.8, borderColor: "#455A64", marginLeft: 4, height: 10 }} />
          </View>
        ))}
      </At>
      <Fill b={B(cx(5), ce(5), ry(66), ry(105))} color="#90CAF9" />
      <Tab x={cx(7)} y={ry(0)} label={"Everyday\nDialogues"} />
      <At b={B(cx(8), ce(12), ry(UNDER_TAB.two))}>
        <Title text="Meeting people" size={18} fill="#EC407A" stroke="#ffffff" />
      </At>
      <ExAt b={B(cx(7), ce(12), ry(12))} n="12" audio="1.04">
        Listen. Then introduce a friend to your partner.
      </ExAt>
      <Fill b={B(cx(7), ce(11), ry(18), ry(29))} color="#ffffff" border="#F06292" bw={4} />
      <At b={B(cx(7), ce(11), ry(18), ry(29))}>
        <View style={{ height: "100%", justifyContent: "center", paddingHorizontal: INSET }}>
          {["Ana, this is my cousin Leo.", "Hi, Leo! Nice to meet you.", "Nice to meet you too, Ana.", "Leo is in our class now!"].map((s) => (
            <Text key={s} style={{ ...t(10, 700), lineHeight: 1.45 }}>
              - {s}
            </Text>
          ))}
        </View>
      </At>
      <Decor b={B(ce(8), W, ry(32), ry(72))} fill="#F3DDB8" d={(X, Y, w, h) => `M${X(w * 0.13)} ${Y(0)} L${X(w)} ${Y(h * 0.18)} L${X(w)} ${Y(h * 0.91)} L${X(w * 0.53)} ${Y(h)} L${X(w * 0.26)} ${Y(h * 0.42)} Z`} />
      <Tab x={cx(7)} y={ry(31)} label="Listening" />
      <ExAt b={B(cx(7), ce(12), ry(37))} n="13" audio="1.05">
        Listen to Ella. Are the sentences true (T) or false (F)?
      </ExAt>
      <At b={B(cx(7), ce(10), ry(43))}>
        {["Ella's class is at the zoo.", "The bus is late.", "Ella's teacher is Mr Diaz.", "Ella loves the giraffes.", "Ben is hungry.", "It's cold and windy."].map((s, i) => (
          <View key={s} style={{ flexDirection: "row", marginBottom: 8, alignItems: "flex-start" }}>
            <Text style={{ ...t(10.2, 700), width: 12 }}>{i + 1}</Text>
            <Text style={{ ...t(10.2), flex: 1 }}>{s}</Text>
            <View style={{ width: 13, height: 13, borderWidth: 1.4, borderColor: "#F9A825", borderRadius: 3, backgroundColor: "#fff" }} />
          </View>
        ))}
      </At>
      <Pic b={B(cx(11), ce(12), ry(39), ry(68))} src={A.people[4]} fit="contain" name="classmates (people-5)" />
      <Tab x={cx(7)} y={ry(72)} label="Writing" />
      <ExAt b={B(cx(7), ce(12), ry(78))} n="14">
        Read Sophie&apos;s email. Then write back to her about your class.
      </ExAt>
      <Pic b={BOX.email} src={A.email} name="e-mail window (drawn)" />
      <At b={B(cx(9), ce(12) - INSET, ry(84) + 9 * MM)}>
        <Text style={{ fontFamily: "Andika", fontSize: 10, color: "#4A148C", lineHeight: 1.36 }}>
          Hi Leo! I&apos;m in a new class this year - 6B! My classroom is on the second floor and it&apos;s very sunny. My new teacher is Mrs Lee. She&apos;s really nice. Ella and Rosa are in my class too! Are you happy at your new school? Love, Sophie
        </Text>
      </At>
    </BookPage>
  );
}

const ROUTINES = ["hand in your homework", "line up", "pack your bag", "have lunch", "tidy your desk", "read the notice board", "wash your hands", "hang up your coat"];
function P20ModuleB() {
  const rc = cells(cx(1), ce(12), 4, 6 * MM);
  return (
    <BookPage bg="#EFE6F7" footer={<ThemeFooter n={20} module="B" />}>
      <Fill b={B(cx(1) - INSET, ce(12) + INSET, 0, ry(LAST_ROW))} color="#ffffff" />
      <Decor b={B(ce(8), W, ry(-1), ry(31))} fill="#DCEBF7" d={(X, Y, w, h) => `M${X(w * 0.26)} ${Y(0)} H${X(w)} V${Y(h)} Q${X(w * 0.4)} ${Y(h * 0.83)} ${X(w * 0.26)} ${Y(0)} Z`} />
      <Pic b={B(cx(10), ce(12), ry(3), ry(23))} src={A.cast[3]} fit="contain" name="K-77 (cast)" />
      <ModuleBadge code="1B" />
      <Tab x={cx(1)} y={ry(0)} label="Vocabulary" />
      <ExAt b={B(cx(1), ce(9), ry(UNDER_TAB.one))} n="1">
        What happens in a school day? Look at the pictures and write the phrases from the box.
      </ExAt>
      <WordBanner b={B(cx(1), ce(9), ry(13), ry(19))} lines={["hand in your homework • line up • pack your bag • have lunch", "tidy your desk • read the notice board • wash your hands • hang up your coat"]} color="#D6E9F8" size={9.4} textColor={SLATE} />
      {A.routines.map((r, i) => {
        const x = rc.at(i % 4);
        const y = ry(21 + Math.floor(i / 4) * 19);
        return (
          <React.Fragment key={i}>
            <Fill b={B(x, x + rc.w, y, y + 18 * 2.5 * MM)} color="#ffffff" border="#DCE775" bw={2.5} r={10} />
            <Pic b={B(x + INSET, x + rc.w - INSET, y + INSET, y + INSET + 11 * 2.5 * MM)} src={r} fit="cover" subject r={4} ground="#ffffff" name={`routine ${i + 1}`} />
            <At b={B(x + INSET + 1 * MM, x + INSET + 1 * MM + 14, y + INSET + 1 * MM)}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#E53935", alignItems: "center", justifyContent: "center", borderWidth: 1.2, borderColor: "#fff" }}>
                <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 8.5, color: "#fff" }}>{i + 1}</Text>
              </View>
            </At>
            <Fill b={B(x + INSET, x + rc.w - INSET, y + 16 * 2.5 * MM, y + 16 * 2.5 * MM + 0.5 * MM)} color="#455A64" />
          </React.Fragment>
        );
      })}
      <ExAt b={B(cx(1), ce(6), ry(62))} n="2">
        Complete the sentences with the phrases in the box.
      </ExAt>
      <Fill b={B(cx(1), ce(6), ry(66), ry(74))} color="#CFE5F5" border="#90A4AE" bw={1} />
      <At b={B(cx(1), ce(6), ry(66), ry(74))}>
        <View style={{ height: "100%", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 9.6, color: SLATE, textAlign: "center", lineHeight: 1.18 }}>{"hand in your homework • line up\npack your bag • have lunch • tidy your desk\nread the notice board • wash your hands\nhang up your coat"}</Text>
        </View>
      </At>
      <At b={B(cx(1), ce(6), ry(76))}>
        <Items
          size={9.6}
          gap={3}
          items={[
            `Your coat is on the floor, Ben! Please ${blank(12)}.`,
            `We ${blank(12)} in the canteen at one o'clock.`,
            `Mr Okafor wants our homework. Let's ${blank(12)} now.`,
            `What's on today? Let's ${blank(12)}.`,
            `The bell! Please ${blank(12)} by the door, everyone.`,
            `There are crayons everywhere! ${blank(12)}, please.`,
            `You've got paint on your fingers. ${blank(12)} before lunch.`,
            `It's half past three. ${blank(12)} - it's time to go home!`,
          ]}
        />
      </At>
      <ExAt b={B(cx(7), ce(12), ry(62))} n="3">
        What do they do? Write the letters.
      </ExAt>
      <Fill b={B(cx(7), ce(12), ry(66), ry(74))} color="#CFE5F5" border="#90A4AE" bw={1} />
      <At b={B(cx(7) + INSET, ce(12), ry(66) + 1.5 * MM)}>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {ROUTINES.map((r, i) => (
            <Text key={r} style={{ width: "50%", fontFamily: "Baloo", fontWeight: 700, fontSize: 8.4, color: SLATE, lineHeight: 1.2 }}>
              <Text style={{ color: "#E53935" }}>{"abcdefgh"[i]}.</Text> {r}
            </Text>
          ))}
        </View>
      </At>
      <At b={B(cx(7), ce(12), ry(76))}>
        {[
          "Maya's fingers are blue from the paint.",
          "Theo's homework is finished.",
          "Zara is in the cloakroom with her jacket in her hands.",
          "It's one o'clock and Ben is very hungry.",
          "There's a new poster about the school concert.",
          "Ella's books and crayons are all over her desk.",
          "The teacher says: \"Time for PE! Stand at the door.\"",
          "School is over. Theo's books are on his desk.",
        ].map((s, i) => (
          <View key={s} style={{ flexDirection: "row", marginBottom: 5 }}>
            <Text style={{ ...t(9.6, 700), width: 11 }}>{i + 1}</Text>
            <Text style={{ ...t(9.6), flex: 1, paddingRight: 4 }}>{s}</Text>
            <View style={{ width: 11, height: 12, borderWidth: 1, borderColor: "#455A64", borderRadius: 2 }} />
          </View>
        ))}
      </At>
    </BookPage>
  );
}

const BUBBLES5 = ["am Nina.", "are my friend.", "is my brother.", "is my sister.", "is my cat.", "are in Year 6.", "are from Spain.", "are twins!"];
function P21Pronouns() {
  const fc = cells(cx(1), ce(6), 2, 6 * MM);
  const pc = cells(cx(7), ce(12), 2, 6 * MM);
  const PIC6: { src: Buffer; fit: "cover" | "contain"; row: number; col: number; name: string }[] = [
    { src: A.faces.f4, fit: "cover", row: 0, col: 0, name: "girl (w-family-4)" },
    { src: A.people[6], fit: "contain", row: 0, col: 1, name: "headteacher (people-7)" },
    { src: A.familyHome, fit: "cover", row: 1, col: 0, name: "family at home (1b-scene)" },
    { src: A.cast[0], fit: "contain", row: 1, col: 1, name: "Star-Bus (cast)" },
  ];
  return (
    <BookPage bg="#F1EAF8" footer={<ThemeFooter n={21} module="B" />}>
      <Fill b={B(cx(1) - INSET, ce(12) + INSET, 0, ry(LAST_ROW))} color="#ffffff" />
      <Tab x={cx(1)} y={ry(0)} label="Grammar" />
      <Pic b={B(cx(5), ce(6), ry(-1), ry(7))} src={A.facesK.f9} fit="contain" name="boy (w-family-9)" />
      <Fill b={B(cx(1), ce(6), ry(7), ry(34))} color="#FFFDF0" border="#F2C230" bw={3} r={18} />
      <Fill b={B(cx(1), ce(5), ry(7), ry(13))} color="#F6B913" radii={{ borderTopLeftRadius: 18 }} />
      <At b={B(cx(1) + INSET, ce(5), ry(7), ry(13))}>
        <View style={{ height: "100%", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 13.5, color: "#fff", lineHeight: 1.1 }}>{"Subject pronouns\nPossessive adjectives"}</Text>
        </View>
      </At>
      {[
            ["Subject pronouns", ["I", "You", "He", "She", "It", "We", "You", "They"]],
            ["Possessive adjectives", ["my", "your", "his", "her", "its", "our", "your", "their"]],
      ].map(([h, xs], k) => (
        <At key={h as string} b={B((k ? cx(4) : cx(1)) + INSET, (k ? cx(4) : cx(1)) + INSET + 31 * MM, ry(14))}>
          <Text style={{ ...t(8.2, 700, "#fff"), backgroundColor: "#4A5470", textAlign: "center", paddingVertical: 2 }}>{h as string}</Text>
          <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: "#37474F", backgroundColor: "#fff" }}>
            {(xs as string[]).map((x, i) => (
              <Text key={i} style={{ ...t(9.6), textAlign: "center", lineHeight: 1.32 }}>
                {x}
              </Text>
            ))}
          </View>
        </At>
      ))}
      <ExAt b={B(cx(1), ce(6), ry(42))} n="4">
        Which pronoun? Write <Text style={{ color: BLUE }}>he, she, it, we, you</Text> or <Text style={{ color: BLUE }}>they</Text>.
      </ExAt>
      <At b={B(cx(1), ce(6), ry(48))}>
        <Items cols={2} size={10} gap={9} items={[<>my grandma {ans("she")}</>, `Theo and I ${blank(5)}`, `the ruler ${blank(5)}`, `my parents ${blank(5)}`, `Zara ${blank(5)}`, `the windows ${blank(5)}`, `you and Maya ${blank(5)}`, `Mr Okafor ${blank(5)}`]} />
      </At>
      <ExAt b={B(cx(1), ce(6), ry(67))} n="5">
        Complete the speech bubbles with the correct <Text style={{ color: BLUE }}>subject pronouns</Text>.
      </ExAt>
      {A.frames5.map((f, i) => {
        const x = fc.at(i % 2);
        const y = ry(72 + Math.floor(i / 2) * 9);
        return (
          <React.Fragment key={i}>
            <Pic b={B(x, x + fc.w, y, y + 20 * MM)} src={f} name="speech-bubble frame (drawn)" />
            <At b={B(x + 0.6 * MM, x + 6 * MM, y + 13 * MM)}>
              <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 14, color: "#fff", backgroundColor: "#E53935", paddingHorizontal: 3 }}>{i + 1}</Text>
            </At>
            <At b={B(x + 8 * MM, x + fc.w - 1 * MM, y + 1 * MM)}>
              <View style={{ backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#5C6BC0", paddingHorizontal: 3, paddingVertical: 1 }}>
                <Text style={{ ...hand(8.6), textAlign: "center", lineHeight: 1.35 }}>
                  {i === 0 ? <Text style={{ color: BLUE }}>I </Text> : "___ "}
                  {BUBBLES5[i]}
                </Text>
              </View>
            </At>
          </React.Fragment>
        );
      })}
      <ExAt b={B(cx(7), ce(12), ry(0))} n="6">
        Write <Text style={{ color: BLUE }}>my, your, his, her, its, our</Text> or <Text style={{ color: BLUE }}>their</Text>.
      </ExAt>
      {PIC6.map((p, i) => {
        const x = pc.at(p.col);
        const y = ry(p.row ? 25 : 9);
        return (
          <React.Fragment key={i}>
            <Pic b={B(x, x + pc.w, y, y + 35 * MM)} src={p.src} fit={p.fit} subject={p.fit === "cover"} name={p.name} />
            <At b={B(x + INSET, x + INSET + 12 * MM, y + 10 * 2.5 * MM)}>
              <View style={{ alignItems: "flex-start" }}>
                <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 22, color: "#fff", backgroundColor: "#263238", paddingHorizontal: 6, borderRadius: 12, lineHeight: 1.1 }}>{i + 1}</Text>
              </View>
            </At>
          </React.Fragment>
        );
      })}
      <Fill b={B(cx(7), ce(12), ry(42), ry(66))} color="#ffffff" border="#C62828" bw={1.2} />
      <At b={B(cx(7) + INSET, ce(12) - INSET, ry(42) + INSET)}>
        <Items
          size={10}
          gap={3}
          items={[
            <>This is Lily. {ans("Her")} hair is long and black.</>,
            `This is Mr Brown. ${blank(8)} tie is blue.`,
            `The Lees are at home. ${blank(8)} sofa is blue.`,
            `Star-Bus is purple. ${blank(8)} eyes are big and blue.`,
            <Text key="5" style={t(10)}>
              <Bo>a:</Bo> Is this your pencil?{"\n"}
              <Bo>b:</Bo> No, it isn&apos;t. {blank(6)} pencil is red.
            </Text>,
            <Text key="6" style={t(10)}>
              <Bo>a:</Bo> Where are Tom and Rita&apos;s coats?{"\n"}
              <Bo>b:</Bo> {blank(6)} coats are in the cloakroom.
            </Text>,
          ]}
        />
      </At>
      <ExAt b={B(cx(7), ce(12), ry(68))} n="7">
        Look at the photo. Complete Sam&apos;s text with <Text style={{ color: BLUE }}>possessive adjectives</Text>.
      </ExAt>
      <At b={B(cx(7), ce(9), ry(75))}>
        <Text style={{ fontFamily: "Andika", fontSize: 10.8, lineHeight: 1.85 }}>
          Hi! This is ¹{ans("my")} family on Saturday. My sister Amy is busy - ² {blank(6)} job is the carpet. Mum and Dad are in the kitchen with ³ {blank(6)} friends. Our cat is on ⁴ {blank(6)} cushion. And me? I&apos;m in ⁵ {blank(6)} room. What&apos;s ⁶ {blank(6)} Saturday like?
        </Text>
      </At>
      <Pic b={B(cx(10), ce(12), ry(75), ry(93))} src={A.familyHome} r={2} border="#ffffff" name="family at home (1b-scene)" />
      <Pic b={B(cx(10), ce(12), ry(95), ry(107))} src={A.facesK.f6} fit="contain" name="boy (w-family-6)" />
    </BookPage>
  );
}

function P22Speaking() {
  return (
    <BookPage bg="#E9F3FB" footer={<ThemeFooter n={22} module="B" />}>
      <Fill b={B(cx(1) - INSET, ce(12) + INSET, 0, ry(LAST_ROW))} color="#ffffff" />
      <Fill b={B(cx(1) - INSET, ce(5), 0, ry(24))} color="#D6EAF8" radii={{ borderBottomRightRadius: 160 }} />
      <Tab x={cx(1)} y={ry(0)} label="Speaking" />
      <At b={B(cx(1), ce(6), ry(UNDER_TAB.one))}>
        <Ex n="8.a">Work with a partner. Sort the twenty words into five groups of four.</Ex>
        <View style={{ height: 3 }} />
        <Ex n="8.b">Give each group a name.</Ex>
      </At>
      <Fill b={B(cx(1), ce(6), ry(20), ry(31))} color="#ffffff" border="#F2C230" bw={1.5} />
      <At b={B(cx(1), ce(6), ry(20), ry(31))}>
        <View style={{ height: "100%", justifyContent: "center", padding: 4 }}>
          <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: 9.3, color: "#283593", textAlign: "center", lineHeight: 1.3 }}>
            {"vet - park - coach - ruler - happy\nmuseum - nurse - notebook - librarian - sad\nscissors - hungry - cinema - pilot - caretaker\ntired - cook - crayon - chemist's - baker"}
          </Text>
        </View>
      </At>
      <Pic b={B(cx(1), ce(6), ry(39), ry(56))} src={A.boys} r={4} ay={0.4} name="boys (d-games-4)" />
      <Bubble b={B(cx(3), ce(6), ry(33))} tail="bl" font="Noto" size={10} center={false} border="#64B5F6" r={2}>
        {"Group 1\nPlaces: park, museum ..."}
      </Bubble>
      <Tab x={cx(1)} y={ry(58)} label="Listening" />
      <ExAt b={B(cx(1), ce(6), ry(64))} n="9" audio="1.06">
        Listen and write the missing words.
      </ExAt>
      <At b={B(cx(1), ce(6), ry(69))}>
        <Items
          size={9.8}
          gap={5}
          items={[
            `A: Is your sister at home today?\nB: No, ${blank(4)} isn't. ${blank(4)} is at her piano lesson.`,
            `A: Where are my keys, Mum?\nB: ${blank(5)} are on the kitchen table.`,
            `A: Kofi, is that ${blank(5)} dog?\nB: Yes! ${blank(5)} name is Biscuit.`,
            `A: Are you and Ella in the chess club?\nB: Yes, ${blank(4)} are. ${blank(4)} club is on Fridays.`,
            `A: ${blank(4)} the museum open on Mondays?\nB: No, ${blank(4)} isn't.`,
            `A: Hi, I'm Ben. ${blank(4)} you the new coach?\nB: Yes, I ${blank(4)}. ${blank(4)} name's Mr Reed.`,
          ]}
        />
      </At>
      <Tab x={cx(7)} y={ry(0)} label={"Everyday\nDialogues"} />
      <At b={B(cx(9), ce(12), ry(UNDER_TAB.two))}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#5D4037", textAlign: "right", lineHeight: 1 }}>Talking about friends</Text>
      </At>
      <ExAt b={B(cx(7), ce(12), ry(13))} n="10" audio="1.07">
        Listen and act out the dialogue. Then talk about a friend.
      </ExAt>
      <Fill b={B(cx(7), ce(12), ry(19), ry(30))} color="#ffffff" border="#9575CD" bw={5} />
      <At b={B(cx(7), ce(12), ry(19), ry(30))}>
        <View style={{ height: "100%", justifyContent: "center", paddingHorizontal: INSET }}>
          {["Who's that girl, Ben?", "That's my cousin Ana. She's twelve.", "She looks friendly!", "Yes, she's really kind and funny."].map((s) => (
            <Text key={s} style={{ ...t(10, 700), lineHeight: 1.4 }}>
              - {s}
            </Text>
          ))}
        </View>
      </At>
      <Tab x={cx(7)} y={ry(34)} label="Listening" />
      <ExAt b={B(cx(7), ce(12), ry(40))} n="11" audio="1.08">
        Listen. Which phrase is it? Complete the sentences.
      </ExAt>
      <WordBanner b={B(cx(7), ce(12), ry(46), ry(53))} lines={["hand in your homework • line up", "pack your bag • have lunch • tidy your desk", "read the notice board • wash your hands"]} color="#8E44AD" size={9.4} />
      <At b={B(cx(7), ce(12), ry(55))}>
        <Items
          size={9.8}
          gap={2.6}
          items={[
            `It's 8:55. The bell is ringing - quick, let's ${blank(10)}!`,
            `Our class ${blank(12)} at quarter past twelve.`,
            `Theo, ${blank(14)} before you eat that apple!`,
            `On Fridays we ${blank(12)} before the weekend.`,
            `The team list is on the wall. Let's ${blank(12)}.`,
            `Please ${blank(14)} on my table, Ella.`,
            `It's home time! ${blank(12)} and get your coat.`,
          ]}
        />
      </At>
      <Tab x={cx(7)} y={ry(74)} label="Writing" />
      <ExAt b={B(cx(7), ce(12), ry(80))} n="12" size={10}>
        You are on a school trip to Sydney. Write a postcard to your grandma. Use the phrases and your own ideas.
      </ExAt>
      <Pic b={BOX.postcard} src={A.postcard} name="postcard (drawn)" />
      <At b={B(cx(9), ce(11), ry(91))}>
        <Text style={{ fontFamily: "Andika", fontSize: 10.6, color: "#1A237E", lineHeight: 1.32 }}>{"Hi Grandma!\nSydney is great!\nThe weather is ...\nMy room is ...\nMy friends here are ...\nLots of love, ..."}</Text>
      </At>
    </BookPage>
  );
}

// --- real-book parts ---------------------------------------------------------------------------
const TITLE = "Bright Days";
function CoverFront() {
  return (
    <>
      <Fill b={FULL} color="#7EC8F2" />
      <Pic b={FULL} src={A.cover} name="front cover" />
      <At b={B(cx(1), ce(12), ry(2))}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 72, color: "#fff", textAlign: "center", lineHeight: 1 }}>{TITLE}</Text>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 18, color: "#1A237E", textAlign: "center", marginTop: 14 }}>English for young learners</Text>
      </At>
      <At b={B(cx(1), ce(2), ry(18))}>
        <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: MAGENTA, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 38, color: "#fff", lineHeight: 1, marginTop: 8 }}>1</Text>
        </View>
      </At>
      <At b={B(cx(5), ce(8), ry(20))}>
        <View style={{ backgroundColor: "#E53935", borderRadius: 16, paddingVertical: 4, borderWidth: 2, borderColor: "#fff" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 17, color: "#fff", textAlign: "center", marginTop: 2 }}>Student&apos;s Book</Text>
        </View>
      </At>
      <At b={B(cx(11), ce(12), ry(18))}>
        <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: GOLD, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 24, color: SLATE, marginTop: 3 }}>A1</Text>
        </View>
      </At>
    </>
  );
}
function CoverBack() {
  return (
    <>
      <Fill b={FULL} color={STARTER_BLUE} />
      <Pic b={B(0, W, ry(60), H)} src={A.cover} ay={0.85} name="back cover" />
      <At b={B(cx(2), ce(11), ry(5))}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 36, color: "#fff" }}>{TITLE} 1</Text>
        <Text style={{ ...t(12, 400, "#fff"), marginTop: 8, lineHeight: 1.45 }}>
          In Brightwater, the school bus can fly! Meet Zara, her cousin Theo and their friends at Hill Park School - with Star-Bus, K-77 the crossing robot and Pip, Zara&apos;s robot owl. Learn English with them, one bright day at a time.
        </Text>
        {["A Starter unit that revises the basics: letters, colours, numbers, time and greetings", "Eight themes with modules A, B and C", "A comic story at the start of every theme", "Everyday Dialogues for real-life English", "Class audio for every listening task"].map((f) => (
          <View key={f} style={{ flexDirection: "row", marginTop: 7 }}>
            <Text style={{ fontFamily: "Sym", fontSize: 12, color: GOLD, width: 18 }}>✓</Text>
            <Text style={{ ...t(11, 700, "#fff"), flex: 1 }}>{f}</Text>
          </View>
        ))}
      </At>
      <At b={B(cx(10), ce(11), ry(47))}>
        <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: GOLD, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 13, color: SLATE, marginTop: 2 }}>CEFR</Text>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 24, color: SLATE, lineHeight: 0.9 }}>A1</Text>
        </View>
      </At>
    </>
  );
}
const Cover = () => (
  <Sheet>
    <CoverFront />
  </Sheet>
);
const BackCover = () => (
  <Sheet>
    <CoverBack />
  </Sheet>
);
const Blank = () => <Sheet>{null}</Sheet>;

const CAST_NAMES = ["Star-Bus", "Zara", "Theo", "K-77", "Pip", "Maya", "Mr Okafor"] as const;
function Imprint() {
  const cc = cells(cx(2), ce(11), 4, 6 * MM);
  return (
    <Sheet>
      <At b={B(cx(2), ce(11), ry(4))}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 30, color: STARTER_BLUE }}>{TITLE} 1</Text>
        <Text style={{ ...t(11, 700, MAGENTA), marginBottom: 14 }}>Student&apos;s Book · English for young learners · CEFR A1</Text>
        <Text style={{ ...t(10), marginBottom: 8 }}>
          This sample contains the Starter unit and Theme 1 &quot;My School&quot; (modules A and B). It was made by hand as a reference for an automatic coursebook maker: the page plan, page types, furniture and density follow a printed A1 coursebook (photographed with a phone), while every character, text, exercise and picture is new.
        </Text>
        <Text style={{ ...t(11, 700), marginTop: 10 }}>Meet the characters</Text>
      </At>
      {CAST_NAMES.map((n, i) => {
        const x = cc.at(i % 4);
        const y = ry(30 + Math.floor(i / 4) * 20);
        return (
          <React.Fragment key={n}>
            <Pic b={B(x, x + cc.w, y, y + 13 * 2.5 * MM)} src={A.cast[i]} fit="contain" name={`${n} (cast)`} />
            <At b={B(x, x + cc.w, y + 13 * 2.5 * MM + 1 * MM)}>
              <Text style={{ ...t(9.5, 700), textAlign: "center" }}>{n}</Text>
            </At>
          </React.Fragment>
        );
      })}
      <At b={B(cx(2), ce(11), ry(97))}>
        <Text style={{ ...t(8.5), color: "#555" }}>
          Pictures: generated illustrations (GPT Image) and drawings made for this book. Small pictures: Twemoji, © Twitter, Inc. and other contributors, CC-BY 4.0. Fonts: Noto Sans, Baloo 2, Andika (SIL Open Font License).
        </Text>
        <Text style={{ ...t(8.5), color: "#555", marginTop: 6 }}>Audio track codes (S.01, 1.01 ...) refer to the class audio. Not for sale - reference sample.</Text>
      </At>
    </Sheet>
  );
}

const UNITS: { name: string; pp: string; col: string; v: string[]; g: string[]; r: string[]; w: string[]; s: string[]; d: string[] }[] = [
  { name: "My School", pp: "15 - 35", col: "#5DADE2", v: ["Jobs at school", "A day at school", "School clubs"], g: ['The verb "to be"', "Subject pronouns & possessive adjectives", "Question words", "Imperatives", "like / love / hate + -ing", "must / can (permission)"], r: ["The Glow Ball", "Clubs Are Cool!", "Dos and Don'ts"], w: ["Write a reply to an email.", "Write a postcard to your grandma.", "Write your class rules."], s: ["Ask and answer about clubs.", "Guess the job.", "Talk about the things you like and hate."], d: ["Meeting people", "Talking about friends", "Giving directions at school"] },
  { name: "School Days", pp: "36 - 50", col: "#EC407A", v: ["Daily routines", "School subjects", "Feelings"], g: ["Present simple", "Adverbs of frequency", "Object pronouns", "have to"], r: ["A Day on a Boat School"], w: ["Write an email about your day.", "Answer questions about a diary."], s: ["Ask and answer about routines.", "Talk about the rules at home."], d: ["Asking about frequency", "Asking for the time", "Making plans"] },
  { name: "All About Me", pp: "51 - 71", col: "#F5A25D", v: ["Appearance", "Clothes", "Personality"], g: ["have got", "can", "Present continuous", "Possessive 's", "Comparatives"], r: ["Super Talents", "Hot Day, Cold Day", "The Kite Festival"], w: ["Describe your best friend.", "Write about your talents.", "Write a party invitation."], s: ["Guess who it is.", "Mime a talent.", "Compare two pets."], d: ["What do you look like?", "Inviting - accepting - refusing", "Saying what you prefer"] },
  { name: "Home and Family", pp: "72 - 84", col: "#8BC34A", v: ["Family members", "Jobs", "Rooms and furniture"], g: ["Present continuous for the future", "will", "be going to"], r: ["Teens at Work", "My Life in 2040"], w: ["Write about a family trip.", "Write an email to a cousin."], s: ["Talk about weekend plans.", "Predict your future."], d: ["Making a request", "Talking about the future"] },
  { name: "Around Town", pp: "85 - 97", col: "#9575CD", v: ["Places in town", "Transport"], g: ["Past simple"], r: ["City Break!", "Lost at the Station"], w: ["Write about last weekend.", "Write a short story."], s: ["Say where you were yesterday.", "Ask about a holiday."], d: ["Asking for information", "Sequencing words"] },
  { name: "Food and Fun", pp: "98 - 114", col: "#C850C0", v: ["Food and cooking"], g: ["Countable / uncountable", "some / any", "How much? / How many?", "Superlatives"], r: ["Healthy Lunchboxes", "A Party Menu"], w: ["Write a recipe.", "Write an email about a restaurant."], s: ["Plan a class party.", "Order a meal."], d: ["Shopping", "Booking a table"] },
  { name: "Wild World", pp: "115 - 127", col: "#F4D03F", v: ["Countries", "Landscapes", "Animals"], g: ["Past continuous", "should"], r: ["The Long Way Home", "Lucky Escapes"], w: ["Describe an event.", "Write about a problem and a solution."], s: ["Tell a true or false story.", "Talk about saving animals."], d: ["when / while", "Asking for advice"] },
  { name: "Space and Beyond", pp: "128 - 134", col: "#48C9B0", v: ["Space"], g: ["Zero conditional", "First conditional"], r: ["A Day on the Moon"], w: ["—"], s: ["Make if-sentences with a partner."], d: ["Firstly, secondly, finally"] },
];
const CONT = { head: ry(9), headEnd: ry(13), row: (r: number) => ry(14 + r * 11), rowEnd: (r: number) => ry(14 + r * 11 + 11) - 1 * MM };
function ContentsLeft() {
  const cols: [string, string][] = [["VOCABULARY", "#4DB6AC"], ["GRAMMAR", "#5C6BC0"], ["READING", "#E91E63"], ["LISTENING", "#FF7043"]];
  return (
    <Sheet>
      <Fill b={B(0, ce(6), 0, ry(7))} color="#D1D9FF" radii={{ borderBottomRightRadius: 80 }} />
      <At b={B(cx(1), ce(6), ry(-2))}>
        <Title text="CONTENTS" size={30} fill="#FFC107" stroke="#6D4C00" />
      </At>
      <Fill b={B(cx(4), W, ry(4), ry(8))} color="#5C6BC0" radii={{ borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }} />
      <At b={B(cx(4) + INSET, W, ry(4), ry(8))}>
        <View style={{ height: "100%", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 9, color: "#fff", marginTop: 2 }}>STARTER pp. 7 - 14 · alphabet, colours, numbers, days, time, greetings, classroom, jobs, places</Text>
        </View>
      </At>
      <ContentsGrid cols={cols} first fields={(u) => [u.v, u.g, u.r, ["Short dialogues"]]} />
    </Sheet>
  );
}
function ContentsRight() {
  const cols: [string, string][] = [["WRITING", "#AB47BC"], ["SPEAKING", "#EC407A"], ["EVERYDAY DIALOGUES", "#42A5F5"]];
  return (
    <Sheet>
      <ContentsGrid cols={cols} fields={(u) => [u.w, u.s, u.d]} />
    </Sheet>
  );
}
function ContentsGrid({ cols, first, fields }: { cols: [string, string][]; first?: boolean; fields: (u: (typeof UNITS)[number]) => string[][] }) {
  // whole columns: left page 3-4 | 5-7 | 8-10 | 11-12, right page 1-4 | 5-8 | 9-12
  const spans = first ? [[3, 4], [5, 7], [8, 10], [11, 12]] : [[1, 4], [5, 8], [9, 12]];
  const cc = { at: (i: number) => cx(spans[i][0]), wOf: (i: number) => ce(spans[i][1]) - cx(spans[i][0]) };
  return (
    <>
      {cols.map(([c, col], i) => (
        <React.Fragment key={c}>
          <Fill b={B(cc.at(i), cc.at(i) + cc.wOf(i), CONT.head, CONT.headEnd)} color={col} radii={{ borderTopLeftRadius: 10, borderTopRightRadius: 10 }} />
          <At b={B(cc.at(i), cc.at(i) + cc.wOf(i), CONT.head, CONT.headEnd)}>
            <View style={{ height: "100%", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: cols.length === 3 ? 12 : 11, color: "#fff", marginTop: 2 }}>{c}</Text>
            </View>
          </At>
        </React.Fragment>
      ))}
      {UNITS.map((u, r) => {
        const y0 = CONT.row(r);
        const y1 = CONT.rowEnd(r);
        return (
          <React.Fragment key={u.name}>
            <Fill b={first ? B(cx(1), W, y0, y1) : B(0, ce(12), y0, y1)} color={u.col} opacity={0.35} />
            {first ? (
              <>
                <Fill b={B(cx(1), ce(2), y0, y1)} color={u.col} radii={{ borderTopLeftRadius: 14, borderBottomLeftRadius: 14 }} />
                <At b={B(cx(1), ce(2), y0, y1)}>
                  <View style={{ height: "100%", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 11, color: "#fff", textAlign: "center", lineHeight: 1 }}>{u.name}</Text>
                    <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 28, color: "#fff", lineHeight: 1.1 }}>{r + 1}</Text>
                    <Text style={{ fontFamily: "Baloo", fontWeight: 500, fontSize: 9, color: "#fff", marginTop: 3 }}>pp. {u.pp}</Text>
                  </View>
                </At>
              </>
            ) : null}
            {fields(u).map((cell, i) => (
              <At key={i} b={B(cc.at(i) + 1.5 * MM, cc.at(i) + cc.wOf(i), y0 + 1.5 * MM)}>
                {cell.map((x) => (
                  <Text key={x} style={{ ...t(7.6), lineHeight: 1.22 }}>
                    {cell.length > 1 || i < 3 ? "• " : ""}
                    {x}
                  </Text>
                ))}
              </At>
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
}

// --- the cover spread: back | spine | front ------------------------------------------------------
// Spine width: 20 interior pages = 10 leaves; 90 g/m2 uncoated offset is
// about 0.1 mm a leaf -> 1.0 mm. (Saddle stitched there is no printed spine;
// the width only places the fold.)
export const INTERIOR_PAGES = 20;
export const SPINE = (INTERIOR_PAGES / 2) * 0.1 * MM;
function CoverSpread() {
  const pw = 2 * W + SPINE + 2 * OFF;
  const ph = H + 2 * OFF;
  const half = SPINE / 2;
  return (
    <Page size={[pw, ph]} style={{ backgroundColor: "#ffffff", fontFamily: "Noto" }}>
      <EdgeCtx.Provider value={{ l: BLEED, r: half, t: BLEED, b: BLEED }}>
        <View style={{ position: "absolute", left: OFF, top: OFF, width: W, height: H }}>
          <CoverBack />
        </View>
      </EdgeCtx.Provider>
      <EdgeCtx.Provider value={{ l: half, r: BLEED, t: BLEED, b: BLEED }}>
        <View style={{ position: "absolute", left: OFF + W + SPINE, top: OFF, width: W, height: H }}>
          <CoverFront />
        </View>
      </EdgeCtx.Provider>
      <CropMarks pw={pw} ph={ph} xs={[OFF, OFF + W, OFF + W + SPINE, OFF + 2 * W + SPINE]} ys={[OFF, OFF + H]} dashed={[OFF + W, OFF + W + SPINE]} />
      <Text style={{ position: "absolute", left: OFF, top: OFF + H + BLEED + 2 * MM, fontFamily: "Noto", fontSize: 6, color: "#000000" }}>
        {`${TITLE} 1 · cover spread · back | spine ${(SPINE / MM).toFixed(1)} mm | front · trim 2 x 210 x 297 mm + 3 mm bleed · fold marks dashed`}
      </Text>
    </Page>
  );
}

// --- assembly -----------------------------------------------------------------------------------
const BOOK: [string, React.FC][] = [
  ["7", P7StarterOpener],
  ["8", P8Alphabet],
  ["9", P9Colours],
  ["10", P10Numbers],
  ["11", P11Time],
  ["12", P12Classroom],
  ["13", P13Jobs],
  ["14", P14Places],
  ["15", P15ThemeOpener],
  ["16", P16Story],
  ["17", P17Vocabulary],
  ["18", P18Grammar],
  ["19", P19Speaking],
  ["20", P20ModuleB],
  ["21", P21Pronouns],
  ["22", P22Speaking],
];
// The interior as printed: page 1 is a right-hand page, so the contents
// spread lands on 2-3 and the Starter opener (book p.7, odd) on a right page.
const INTERIOR: [string, React.FC][] = [["imprint", Imprint], ["contents", ContentsLeft], ["contents", ContentsRight], ["blank (to keep p.7 on a right-hand page)", Blank], ...BOOK.map(([n, C]) => [`book p.${n}`, C] as [string, React.FC])];

function interiorDoc() {
  return (
    <Document title={`${TITLE} 1 - Student's Book - interior`} author="hand-made reference">
      {INTERIOR.map(([label, C], i) => (
        <SlugCtx.Provider key={i} value={`${TITLE} 1 · interior page ${i + 1}/${INTERIOR.length} · ${label} · trim 210 x 297 mm, bleed 3 mm`}>
          <C />
        </SlugCtx.Provider>
      ))}
    </Document>
  );
}
function coverDoc() {
  return (
    <Document title={`${TITLE} 1 - Student's Book - cover`} author="hand-made reference">
      <CoverSpread />
    </Document>
  );
}
function previewDoc() {
  const pages: React.FC[] = [Cover, Blank, ...INTERIOR.map(([, C]) => C), Blank, BackCover];
  return (
    <Document title={`${TITLE} 1 - Student's Book (preview)`} author="hand-made reference">
      {pages.map((C, i) => (
        <C key={i} />
      ))}
    </Document>
  );
}

async function resolvePictures() {
  const jobs = [...PIC_REQ.entries()].filter(([k]) => !PIC_OUT.has(k));
  PIC_REQ.clear();
  let i = 0;
  const worker = async () => {
    for (let j = jobs.shift(); j; j = jobs.shift()) {
      const [k, r] = j;
      PIC_OUT.set(k, await printPicture(r.src, r.w, r.h, r.opt));
      i++;
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return i;
}
async function render(doc: () => React.ReactElement<DocumentProps>) {
  // pass 1 collects every picture at its frame size; pass 2 embeds them
  for (let pass = 0; pass < 3; pass++) {
    const buf = await renderToBuffer(doc());
    if (PIC_REQ.size === 0) return buf;
    console.log(`  pictures prepared: ${await resolvePictures()}`);
  }
  return renderToBuffer(doc());
}

async function main() {
  A = await loadAssets();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (MODE === "print") {
    fs.writeFileSync(path.join(OUT_DIR, "raw-interior.pdf"), await render(interiorDoc));
    fs.writeFileSync(path.join(OUT_DIR, "raw-cover.pdf"), await render(coverDoc));
    // one row per distinct picture frame
    const seen = new Set<string>();
    const rows = dpiTable.filter((r) => {
      const k = `${r.name}|${r.widthMm}|${r.heightMm}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    fs.writeFileSync(path.join(OUT_DIR, "dpi-table.json"), JSON.stringify(rows, null, 1));
    fs.writeFileSync(path.join(OUT_DIR, "spec.json"), JSON.stringify({ interiorPages: INTERIOR.length, spineMm: SPINE / MM, paper: "90 g/m2 uncoated offset, ~0.1 mm per leaf", dpi: DPI }, null, 1));
    console.log("->", OUT_DIR, `(${DPI} dpi, spine ${(SPINE / MM).toFixed(2)} mm)`);
  } else {
    fs.writeFileSync(path.join(OUT_DIR, "onizleme.pdf"), await render(previewDoc));
    console.log("->", path.join(OUT_DIR, "onizleme.pdf"));
  }
}
void main();
