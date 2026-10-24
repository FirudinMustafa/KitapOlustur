// Hand-made reference 3: the welcome module and Module 1 of i5 Team 2
// (source pp.6-25 = book pp.4-23) re-made by hand as a designer/author
// would - original characters, texts and exercises; the source's lesson
// structure, two-column density, page furniture and exercise types - plus a
// four-page workbook for Module 1. 220 x 280 mm.
//
//   npx tsx --env-file=.env.local scripts/reference/handcraft-i5-full-images.mts   (paid pictures, once)
//   npx tsx scripts/reference/handcraft-i5-full.tsx
//     -> .handmade/student-book.pdf, .handmade/workbook.pdf
//
// Pictures: .handmade/img (8 from handcraft-i5-module1-images.mts, 8 from
// handcraft-i5-full-images.mts); free composites in handcraft-i5-full-art.ts;
// small icons are Twemoji (CC-BY 4.0) via src/lib/pdf/emoji-icons.ts.
import path from "node:path";
import fs from "node:fs";
import React from "react";
import { Document, Page, View, Text, Image, Font, Svg, Path, Rect, renderToBuffer } from "@react-pdf/renderer";
import { loadEmojiIcons } from "../../src/lib/pdf/emoji-icons";
import * as art from "./handcraft-i5-full-art";

const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "Noto", fonts: [{ src: path.join(FONTS, "NotoSans-Regular.ttf"), fontWeight: 400 }, { src: path.join(FONTS, "NotoSans-Bold.ttf"), fontWeight: 700 }, { src: path.join(FONTS, "NotoSans-Italic.ttf"), fontStyle: "italic" }] });
Font.register({ family: "Baloo", fonts: [{ src: path.join(FONTS, "Baloo2-Medium.ttf"), fontWeight: 500 }, { src: path.join(FONTS, "Baloo2-Bold.ttf"), fontWeight: 700 }] });
Font.register({ family: "Andika", fonts: [{ src: path.join(FONTS, "Andika-Regular.ttf"), fontWeight: 400 }, { src: path.join(FONTS, "Andika-Bold.ttf"), fontWeight: 700 }] });
Font.register({ family: "Sym", src: path.join(FONTS, "NotoSansSymbols2-Regular.ttf") });
Font.registerHyphenationCallback((w) => [w]);

// --- page geometry and palette ------------------------------------------------
const MM = 72 / 25.4;
const W = 220 * MM; // 623.6
const H = 280 * MM; // 793.7
const ML = 44; // left margin (the module strip runs down the left edge)
const MR = 36;
const TOP = 30;
const BOTTOM = 50;
const CW = W - ML - MR;
const GAP = 18;
const COL = (CW - GAP) / 2;

const RED = "#E2001A";
const INK = "#1d1d1f";
const BLUE = "#1E88E5";
const PURPLE = "#5E3A8C";
const PINK = "#EC407A";
const GREEN = "#7CB342";
const ORANGE = "#F57C00";
const YELLOW = "#FFF6B3";
const PEACH = "#FFF1EA";
const PEACH_LINE = "#F4A582";
const SKY = "#DCEFFB";
const BODY = 10;

type Src = Buffer | string;
const png = (b: Buffer) => ({ data: b, format: "png" as const });
const srcOf = (s: Src) => (typeof s === "string" ? s : png(s));

const t = (size = BODY, weight: 400 | 700 = 400, color = INK) => ({ fontFamily: "Noto", fontSize: size, fontWeight: weight, color, lineHeight: 1.28 });
const it = (size = BODY, color = INK) => ({ fontFamily: "Noto", fontSize: size, fontStyle: "italic" as const, color, lineHeight: 1.28 });
const B = ({ children, c }: { children: React.ReactNode; c?: string }) => <Text style={{ fontWeight: 700, ...(c ? { color: c } : {}) }}>{children}</Text>;
const GAPLINE = "__________";

// --- assets -------------------------------------------------------------------
type Assets = Awaited<ReturnType<typeof loadAssets>>;
const EMOJI = ["🎧", "📖", "🔤", "💬", "✏️", "📝", "🗣️", "🎵", "🎮", "📦", "⚽", "🛋️", "🐕", "🚲", "🥁", "🍳", "🌱", "🎹", "😍", "🙂", "😐", "🙁", "😖", "🏠", "🍕", "🏟️", "🏀", "🎂", "📸", "🎸", "🚿", "✅", "❌", "🔍", "⭐", "💡", "🧹", "🧺", "🍽️", "📚", "🎒", "💻", "🐰", "🛹", "🏊", "🤖", "🐉", "😂", "🎨"];
async function loadAssets() {
  const emoji = await loadEmojiIcons(EMOJI);
  const card = (n: string) => art.img(n);
  return {
    emoji,
    friends: card("w-friends"),
    cover: card("cover"),
    familyTree: await art.familyTree(),
    chalkboard: await art.chalkboard(),
    landmarks: await art.landmarkCollage(),
    clocks: await art.clocks(),
    moves: await art.cardGrid("moves", Array.from({ length: 9 }, (_, i) => card(`w-moves-${i + 1}`)), 3, { caption: 64, tiles: ["#E8F5E9", "#E3F2FD", "#FFF8E1"] }),
    modules: await art.cardGrid("modules", ["1a-cards-4", "1c-cards-7", "w-landmarks-2", "d-games-3", "w-family-2", "1b-cards-6", "f-fun-4"].map(card), 4, { caption: 70, tiles: ["#B3E5FC", "#F8BBD0", "#C8E6C9", "#FFE0B2", "#D1C4E9", "#FFF59D", "#B2DFDB"] }),
    scene1a: card("1a-scene"),
    didYouKnow: await art.didYouKnow(),
    girl: card("w-family-10"),
    scene1b: card("1b-scene"),
    party: card("1b-party"),
    quiz: card("1c-quiz"),
    park: card("1c-park"),
    listenFaces: await art.stackedFaces("listen-faces", ["w-family-7", "w-family-8", "w-family-10"], ["#4FC3F7", "#F06292", "#AED581"]),
    games: [1, 2, 3, 4].map((i) => card(`d-games-${i}`)),
    likeScale: await art.likeScale(["😍", "🙂", "😐", "🙁", "😖"].map((e) => Buffer.from((emoji[e] ?? "").split(",")[1] ?? "", "base64"))),
    talkFaces: await art.stackedFaces("talk-faces", ["w-family-9", "w-family-7", "w-family-8"], ["#FFB74D", "#4DB6AC", "#BA68C8"]),
    comic: await art.stippleGutters("comic-bolt-2", card("c-comic")),
    fun: [1, 2, 3, 4].map((i) => card(`f-fun-${i}`)),
    nowICan: await art.nowICan(),
    ...(await roundTwoArt(card, emoji)),
    hobbyCards: Array.from({ length: 8 }, (_, i) => card(`1c-cards-${i + 1}`)),
    roomCards: Array.from({ length: 6 }, (_, i) => card(`1a-cards-${i + 1}`)),
    choreCards: Array.from({ length: 6 }, (_, i) => card(`1b-cards-${i + 1}`)),
  };
}
// Picture areas built to the source pages' measured boxes (3 px per pt).
async function roundTwoArt(card: (n: string) => Buffer, emoji: Record<string, string>) {
  const px = (f: number, side: number) => Math.round(f * side * 3);
  const size = (box: FBox) => [px(box[2], W), px(box[3], H)] as const;
  const emo = (e: string) => Buffer.from((emoji[e] ?? "").split(",")[1] ?? "", "base64");
  const emailWindow = (name: string, box: FBox) => {
    const [w, h] = size(box);
    return art.compose(
      name,
      w,
      h,
      `<rect x="3" y="3" width="${w - 6}" height="${h - 6}" rx="16" fill="#fff" stroke="#4FC3F7" stroke-width="6"/><rect x="3" y="3" width="${w - 6}" height="48" rx="16" fill="#81D4FA"/><rect x="3" y="30" width="${w - 6}" height="21" fill="#81D4FA"/>
       <circle cx="34" cy="27" r="9" fill="#EF5350"/><circle cx="62" cy="27" r="9" fill="#FFCA28"/><circle cx="90" cy="27" r="9" fill="#66BB6A"/>`,
    );
  };
  const examTip = (name: string, box: FBox) => {
    const [w, h] = size(box);
    return art.compose(name, w, h, `<rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="24" fill="#F3E5F5" stroke="#7E57C2" stroke-width="6"/>`);
  };
  const [lw, lh] = [Math.round(W * 2), Math.round(H * 2)];
  const [cw, ch] = size([0.03, 0.08, 0.95, 0.63]);
  // Three strips across the area (3.5:1). Each is cut from the 3:2 scene
  // at exactly the strip's shape, around a character's head: cut at other
  // shapes the composer cropped them again from the centre, and the panels
  // showed the girl on the stepladder from the knees down and Zoe without
  // her head (round 2).
  const panelH = Math.round(ch / 3) + 2;
  const strip = (x: number, y: number, w: number) => art.crop(card("1a-scene"), x, y, w, (w * 1.5 * panelH) / cw);
  const comicPanels = [
    await strip(0.3, 0.06, 0.7), // Sam (under the dialogue box) and the girl on the stepladder
    await strip(0.42, 0.37, 0.58), // Kenji at his laptop
    await strip(0, 0.12, 0.62), // Zoe painting the wardrobe, Sam with the box
  ];
  const [hw, hh] = size([0.05, 0.04, 0.87, 0.49]);
  const hk = hw / 1500;
  const [lbw, lbh] = size([0.05, 0.58, 0.44, 0.41]);
  const [tbw, tbh] = size([0.06, 0.12, 0.4, 0.5]);
  const [iw, ih] = size([0.05, 0.14, 0.43, 0.48]);
  return {
    scene1bVivid: await art.vivid("scene-1b-vivid", card("1b-scene")),
    boysVivid: await art.vivid("boys-vivid", card("d-games-4")),
    limeGround: await art.compose(
      "lime-ground-5",
      lw,
      lh,
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#B8D42A"/><stop offset="0.45" stop-color="#D6E96E"/><stop offset="0.8" stop-color="#FFFFFF"/></linearGradient></defs><rect width="${lw}" height="${lh}" fill="url(#g)"/>`,
    ),
    badges: await Promise.all(
      [
        ["37", "#43A047"],
        ["14", "#1E88E5"],
        ["58", "#E53935"],
        ["90", "#8E24AA"],
        ["26", "#FB8C00"],
        ["71", "#00ACC1"],
      ].map(([n, c], i) => art.numberBadge(n, c, i % 2 ? 4 : -5)),
    ),
    ageBadges: await Promise.all(
      [
        ["10", "#43A047"],
        ["11", "#1E88E5"],
        ["12", "#E53935"],
      ].map(([n, c], i) => art.numberBadge(n, c, i % 2 ? 3 : -3)),
    ),
    idCard: await art.compose(
      "id-card",
      ...size([0.45, 0.04, 0.53, 0.45]),
      `<rect x="6" y="6" width="${size([0, 0, 0.53, 0])[0] - 12}" height="${size([0, 0, 0, 0.45])[1] - 12}" rx="40" fill="#EDE7F6" stroke="${PURPLE}" stroke-width="12"/>
       <text x="${size([0, 0, 0.53, 0])[0] - 40}" y="230" font-family="Arial Black, Arial" font-weight="bold" font-size="220" fill="#D1C4E9" text-anchor="end">ID</text>
       <rect x="40" y="${size([0, 0, 0, 0.45])[1] - 70}" width="${size([0, 0, 0.53, 0])[0] - 80}" height="26" rx="13" fill="#B39DDB"/>`,
    ),
    comic1a: await art.compose(
      "comic-1a-3",
      cw,
      ch,
      `<rect width="${cw}" height="${ch}" fill="#263238"/>`,
      comicPanels.map((b, i) => ({ buf: b, x: 0, y: i * Math.round(ch / 3), w: cw, h: panelH, fit: "cover" as const })),
    ),
    vocab1a: await art.cardGrid("vocab-1a-2", Array.from({ length: 6 }, (_, i) => card(`1a-cards-${i + 1}`)), 3, { caption: 56, gap: 60 }),
    chores: await art.cardGrid("chores-1b-2", Array.from({ length: 6 }, (_, i) => card(`1b-cards-${i + 1}`)), 3, { caption: 56, gap: 60, tiles: ["#FFF3E0", "#E1F5FE", "#F3E5F5"] }),
    emailWin: await emailWindow("email-11b", [0.48, 0.4, 0.46, 0.23]),
    overToYou: await art.compose(
      "over-to-you",
      ...size([0.48, 0.68, 0.5, 0.21]),
      `<rect x="0" y="0" width="${size([0, 0, 0.5, 0])[0] - 250}" height="${size([0, 0, 0, 0.21])[1]}" rx="30" fill="${SKY}"/>${Array.from({ length: 7 }, (_, i) => `<line x1="30" x2="${size([0, 0, 0.5, 0])[0] - 280}" y1="${150 + i * 50}" y2="${150 + i * 50}" stroke="#90CAF9" stroke-width="3"/>`).join("")}`,
      [{ buf: card("w-family-10"), x: size([0, 0, 0.5, 0])[0] - 300, y: 20, w: 300, h: size([0, 0, 0, 0.21])[1] - 20 }],
    ),
    pronTable: await art.compose(
      "pron-table",
      ...size([0.55, 0.795, 0.32, 0.16]),
      (() => {
        const [w, h] = size([0, 0, 0.32, 0.16]);
        const rh = h / 7;
        return `<rect x="3" y="3" width="${w - 6}" height="${h - 6}" rx="16" fill="#fff" stroke="${PEACH_LINE}" stroke-width="5"/><rect x="3" y="3" width="${w - 6}" height="${rh}" rx="16" fill="#FCE1D3"/>${Array.from({ length: 6 }, (_, i) => `<line x1="3" x2="${w - 3}" y1="${rh * (i + 1)}" y2="${rh * (i + 1)}" stroke="#F8CDB8" stroke-width="3"/>`).join("")}<line x1="${w * 0.44}" x2="${w * 0.44}" y1="3" y2="${h - 3}" stroke="#F8CDB8" stroke-width="3"/><line x1="${w * 0.72}" x2="${w * 0.72}" y1="3" y2="${h - 3}" stroke="#F8CDB8" stroke-width="3"/>`;
      })(),
    ),
    poster: await art.compose(
      "poster-2",
      ...size([0, 0.58, 0.5, 0.42]),
      `<rect width="${size([0, 0, 0.5, 0])[0]}" height="${size([0, 0, 0, 0.42])[1]}" fill="#FFF3C4"/>`,
      [{ buf: card("1b-party"), x: 0, y: 0, w: size([0, 0, 0.5, 0])[0], h: Math.round(size([0, 0, 0, 0.42])[1] * 0.5), fit: "cover" }],
    ),
    hobbies: await art.compose(
      "hobbies-3",
      hw,
      hh,
      `<rect width="${hw}" height="${hh}" rx="24" fill="#FFD9B3"/>`,
      Array.from({ length: 8 }, (_, i) => ({ buf: card(`1c-cards-${i + 1}`), x: (60 + (i % 4) * 350) * hk, y: (380 + Math.floor(i / 4) * 350) * hk, w: 300 * hk, h: 300 * hk })),
    ).then(async (base) =>
      art.compose(
        "hobbies-3b",
        hw,
        hh,
        `<rect width="${hw}" height="${hh}" rx="24" fill="#FFD9B3"/>${Array.from({ length: 8 }, (_, i) => `<rect x="${(50 + (i % 4) * 350) * hk}" y="${(370 + Math.floor(i / 4) * 350) * hk}" width="${320 * hk}" height="${320 * hk}" rx="${20 * hk}" fill="${["#FFCDD2", "#C5CAE9", "#FFF9C4", "#C8E6C9", "#B3E5FC", "#F8BBD0", "#FFE0B2", "#DCEDC8"][i]}"/>`).join("")}`,
        [{ buf: base, x: 0, y: 0, w: hw, h: hh, knock: true }],
      ),
    ),
    listenBlock: await art.compose(
      "listen-block",
      lbw,
      lbh,
      Array.from({ length: 3 }, (_, i) => `<rect x="${lbw * 0.3}" y="${(i * lbh) / 3 + 10}" width="${lbw * 0.68}" height="${lbh / 3 - 20}" rx="24" fill="#FAFAFA" stroke="#B0BEC5" stroke-width="4"/><rect x="10" y="${(i * lbh) / 3 + 14}" width="${lbw * 0.27}" height="${lbh / 3 - 28}" rx="30" fill="${["#4FC3F7", "#F06292", "#AED581"][i]}" transform="rotate(${i % 2 ? 4 : -4} ${lbw * 0.15} ${(i * lbh) / 3 + lbh / 6})"/>`).join(""),
      ["w-family-7", "w-family-8", "w-family-10"].map((c, i) => ({ buf: card(c), x: 18, y: (i * lbh) / 3 + 22, w: lbw * 0.25, h: lbh / 3 - 44, circle: true })),
    ),
    noughts: await art.compose(
      "noughts",
      ...size([0.5, 0.71, 0.45, 0.27]),
      (() => {
        const [w, h] = size([0, 0, 0.45, 0.27]);
        return `<rect width="${w}" height="${h}" rx="30" fill="#FFF0F5"/><line x1="${w / 3}" x2="${w / 3}" y1="20" y2="${h - 20}" stroke="#F48FB1" stroke-width="16" stroke-linecap="round"/><line x1="${(2 * w) / 3}" x2="${(2 * w) / 3}" y1="20" y2="${h - 20}" stroke="#F48FB1" stroke-width="16" stroke-linecap="round"/><line y1="${h / 3}" y2="${h / 3}" x1="20" x2="${w - 20}" stroke="#F48FB1" stroke-width="16" stroke-linecap="round"/><line y1="${(2 * h) / 3}" y2="${(2 * h) / 3}" x1="20" x2="${w - 20}" stroke="#F48FB1" stroke-width="16" stroke-linecap="round"/>`;
      })(),
    ),
    gameLeft: await art.compose(
      "game-left",
      ...size([0.07, 0.225, 0.4, 0.13]),
      `<rect width="${size([0, 0, 0.4, 0])[0]}" height="${size([0, 0, 0, 0.13])[1]}" rx="24" fill="#311B92"/>${Array.from({ length: 14 }, (_, i) => `<circle cx="${40 + i * 52}" cy="${30 + ((i * 37) % 250)}" r="${4 + (i % 3) * 2}" fill="#FFF59D"/>`).join("")}`,
      [{ buf: card("d-games-2"), x: size([0, 0, 0.4, 0])[0] - 300, y: 10, w: 280, h: size([0, 0, 0, 0.13])[1] - 20 }],
    ),
    gameRight: await art.compose(
      "game-right",
      ...size([0.53, 0.12, 0.44, 0.23]),
      "",
      [
        { buf: card("d-games-1"), x: 0, y: 0, w: size([0, 0, 0.26, 0])[0], h: size([0, 0, 0, 0.23])[1] },
        { buf: card("d-games-3"), x: size([0, 0, 0.25, 0])[0], y: size([0, 0, 0, 0.08])[1], w: size([0, 0, 0.19, 0])[0], h: size([0, 0, 0, 0.14])[1], knock: true },
      ],
    ),
    tipPanel: await art.compose(
      "tip-panel",
      ...size([0.03, 0.61, 0.46, 0.27]),
      `<rect x="6" y="6" width="${size([0, 0, 0.46, 0])[0] - 12}" height="${size([0, 0, 0, 0.27])[1] - 12}" rx="30" fill="#F1F8E9" stroke="${GREEN}" stroke-width="10"/>`,
    ),
    emailWin17: await emailWindow("email-17b", [0.49, 0.7, 0.45, 0.25]),
    emailWin19: await emailWindow("email-19b", [0.48, 0.25, 0.43, 0.37]),
    examTip18: await examTip("exam-18", [0.42, 0.22, 0.51, 0.12]),
    examTip19: await examTip("exam-19", [0.49, 0.105, 0.42, 0.12]),
    talkBlock: await art.compose(
      "talk-block",
      tbw,
      tbh,
      `<rect width="${tbw}" height="${tbh}" rx="30" fill="#FFF8E1"/>`,
      [
        ["w-family-9", "w-family-8"],
        ["w-family-7", "w-family-10"],
        ["w-family-6", "w-family-4"],
      ].flatMap(([a, b], i) => [
        { buf: card(a), x: 10, y: (i * tbh) / 3 + 20, w: tbw * 0.26, h: tbw * 0.26, circle: true, ring: "#FFB74D" },
        { buf: card(b), x: 30, y: (i * tbh) / 3 + 20 + tbw * 0.24, w: tbw * 0.2, h: tbw * 0.2, circle: true, ring: "#4DB6AC" },
      ]),
    ),
    inventions: await art.compose(
      "inventions",
      iw,
      ih,
      Array.from({ length: 3 }, (_, i) => `<ellipse cx="${i % 2 ? iw * 0.78 : iw * 0.2}" cy="${(i * ih) / 3 + ih / 6}" rx="${iw * 0.19}" ry="${ih / 6 - 12}" fill="#fff" stroke="${["#FFB74D", "#4FC3F7", "#AED581"][i]}" stroke-width="10"/>`).join(""),
      [0, 1, 2].map((i) => ({ buf: card(`f-fun-${i + 1}`), x: (i % 2 ? iw * 0.78 : iw * 0.2) - iw * 0.14, y: (i * ih) / 3 + 30, w: iw * 0.28, h: ih / 3 - 60 })),
    ),
    joke: await art.compose(
      "joke",
      ...size([0.11, 0.63, 0.39, 0.25]),
      `<rect width="${size([0, 0, 0.39, 0])[0]}" height="${size([0, 0, 0, 0.25])[1]}" rx="30" fill="#fff"/>`,
      [{ buf: emo("🎹"), x: 20, y: 40, w: size([0, 0, 0.13, 0])[0], h: size([0, 0, 0.13, 0])[0] }],
    ),
    funBadge: await art.compose(
      "fun-badge",
      ...size([0.73, 0.12, 0.25, 0.11]),
      `<g transform="rotate(4 230 130)"><rect x="20" y="40" width="${size([0, 0, 0.25, 0])[0] - 40}" height="${size([0, 0, 0, 0.11])[1] - 80}" rx="40" fill="#7CB342"/><text x="${size([0, 0, 0.25, 0])[0] / 2}" y="${size([0, 0, 0, 0.11])[1] / 2 + 30}" font-family="Arial Black, Arial" font-weight="bold" font-size="90" fill="#fff" text-anchor="middle">Fun Time</text></g>`,
    ),
    nowICanBox: await art.compose(
      "now-i-can-box",
      ...size([0.07, 0.8, 0.4, 0.12]),
      `<rect x="6" y="40" width="${size([0, 0, 0.4, 0])[0] - 12}" height="${size([0, 0, 0, 0.12])[1] - 46}" rx="20" fill="#fff" stroke="#E2001A" stroke-width="6"/><path d="M10 10 L360 0 L370 90 L20 100 Z" fill="#E2001A"/><text x="190" y="70" font-family="Arial Black, Arial" font-weight="bold" font-size="56" fill="#fff" text-anchor="middle">NOW I CAN</text>`,
    ),
  };
}
let A: Assets;
const E = (e: string) => A.emoji[e];

// --- furniture ----------------------------------------------------------------
function LeftStrip({ colours }: { colours?: string[] }) {
  const cs = colours ?? ["#3F51B5", "#8E24AA", "#EC407A", "#FB8C00", "#FDD835", "#7CB342", "#26A69A"];
  return (
    <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 11 }} fixed>
      {cs.map((c, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: c }} />
      ))}
    </View>
  );
}

function Footer({ n, label, refs }: { n: number; label: string; refs?: string }) {
  const right = n % 2 === 1;
  return (
    <View fixed style={{ position: "absolute", bottom: 14, left: ML, right: MR, flexDirection: right ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: right ? "row-reverse" : "row", alignItems: "center" }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: RED, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFCDD2" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 12, color: "#fff" }}>{n}</Text>
        </View>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 10, color: RED, marginHorizontal: 6 }}>{label}</Text>
      </View>
      {refs ? (
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[`Student's Book: Language Review ${refs}`, `Workbook: ${refs}`].map((r) => (
            <View key={r} style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: RED, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 7.5, color: RED }}>» </Text>
              <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 7.5, color: INK }}>{r}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function BookPage({ n, label = "Module 1", refs, children, bg, strip = true }: { n: number; label?: string; refs?: string; children: React.ReactNode; bg?: string; strip?: boolean }) {
  return (
    <Page size={[W, H]} style={{ paddingTop: TOP, paddingBottom: BOTTOM, paddingLeft: ML, paddingRight: MR, backgroundColor: bg ?? "#fff" }}>
      {strip ? <LeftStrip /> : null}
      <Footer n={n} label={label} refs={refs} />
      <View style={{ height: H - TOP - BOTTOM - 2 }} wrap={false}>{children}</View>
    </Page>
  );
}

const Abs = ({ l, tp, w, h, children, z }: { l: number; tp: number; w?: number; h?: number; children: React.ReactNode; z?: number }) => (
  <View style={{ position: "absolute", left: l, top: tp, ...(w !== undefined ? { width: w } : {}), ...(h !== undefined ? { height: h } : {}), ...(z ? { zIndex: z } : {}) }}>{children}</View>
);

// A picture area where the source page has one: [x, y, w, h] as fractions
// of the page (measured from the source, see docs/handmade-design-decisions.md),
// turned into content-box coordinates.
type FBox = [number, number, number, number];
const SB = ([x, y, w, h]: FBox) => ({ l: x * W - ML, tp: y * H - TOP, w: w * W, h: h * H });
// Artwork filling a source picture area, with text printed over it.
function Area({ box, src, children, pad = 8, fit = "cover", r = 0, pos }: { box: FBox; src: Src; children?: React.ReactNode; pad?: number | [number, number, number, number]; fit?: "cover" | "contain"; r?: number; pos?: string }) {
  const b = SB(box);
  const [pt, pr, pb, pl] = typeof pad === "number" ? [pad, pad, pad, pad] : pad;
  return (
    <Abs l={b.l} tp={b.tp} w={b.w} h={b.h}>
      <Pic src={src} w={b.w} h={b.h} r={r} fit={fit} pos={pos} />
      {children ? <View style={{ position: "absolute", top: pt, right: pr, bottom: pb, left: pl }}>{children}</View> : null}
    </Abs>
  );
}
// Overlay text box at a page fraction (no picture).
function At({ box, children }: { box: FBox; children: React.ReactNode }) {
  const b = SB(box);
  return (
    <Abs l={b.l} tp={b.tp} w={b.w}>
      {children}
    </Abs>
  );
}

function Splash({ code, size = 58 }: { code: string; size?: number }) {
  const pts = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    const r = i % 2 ? size / 2 - 3 : size / 2;
    return `${size / 2 + Math.cos(a) * r},${size / 2 + Math.sin(a) * r}`;
  }).join(" ");
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Path d={`M${pts}Z`} fill={RED} />
      </Svg>
      <Text style={{ position: "absolute", top: size * 0.1, left: 0, width: size, textAlign: "center", fontFamily: "Baloo", fontWeight: 700, fontSize: size * 0.5, color: "#fff" }}>{code}</Text>
    </View>
  );
}

function LessonHeader({ code, title }: { code: string; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginLeft: -26, marginTop: -14 }}>
      <Splash code={code} />
      <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 30, color: INK, marginLeft: 10, marginTop: 6 }}>{title}</Text>
    </View>
  );
}

function UnitTitle({ title, color = RED }: { title: string; color?: string }) {
  return <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 32, color, marginTop: -10, marginBottom: 2 }}>{title}</Text>;
}

function Section({ name, sub, icon, color = RED, mt = 6 }: { name: string; sub?: string; icon: string; color?: string; mt?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: mt, marginBottom: 3 }}>
      <View style={{ width: 19, height: 19, borderRadius: 10, backgroundColor: color, alignItems: "center", justifyContent: "center", marginRight: 5 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        {E(icon) ? <Image src={E(icon)} style={{ width: 12, height: 12 }} /> : null}
      </View>
      <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 13.5, color }}>{name}</Text>
      {sub ? <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 10, color, marginLeft: 5, marginTop: 2 }}>({sub})</Text> : null}
    </View>
  );
}

function Headphones({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 14 V12 A8 8 0 0 1 20 12 V14" stroke={RED} strokeWidth={2.6} fill="none" />
      <Rect x={2.5} y={13} width={5} height={8} rx={2} fill={RED} />
      <Rect x={16.5} y={13} width={5} height={8} rx={2} fill={RED} />
    </Svg>
  );
}

// An exercise heading: the number at 14 pt (as the source prints it - the
// layout analyzer reads a line opening with a number at >= 1.15x body as an
// exercise), the rubric bold beside it with a hanging indent.
function Ex({ n, children, listen, mt = 3, color = INK, tag, small }: { n: string; children: React.ReactNode; listen?: boolean; mt?: number; color?: string; tag?: React.ReactNode; small?: boolean }) {
  return (
    <View style={{ flexDirection: "row", marginTop: mt, marginBottom: 2.5 }} wrap={false}>
      <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: small ? 9 : 14, color: RED, width: n.length > 1 ? 22 : 15, lineHeight: 1, marginTop: small ? 1.5 : 0 }}>{n}</Text>
      {listen ? (
        <View style={{ marginTop: 1.5, marginRight: 3 }}>
          <Headphones />
        </View>
      ) : null}
      {tag}
      <Text style={{ ...t(10.5, 700, color), flex: 1, paddingTop: 1.2, lineHeight: 1.25 }}>{children}</Text>
    </View>
  );
}
const Sub = ({ children, mt = 2, ml = 15 }: { children: React.ReactNode; mt?: number; ml?: number }) => <Text style={{ ...t(10.5, 700), marginLeft: ml, marginTop: mt, marginBottom: 2 }}>{children}</Text>;

function Items({ items, cols = 1, ml = 15, size = BODY, start = 1, gapAfter = 3, numColor = RED, rowGap = 1.5 }: { items: React.ReactNode[]; cols?: number; ml?: number; size?: number; start?: number; gapAfter?: number; numColor?: string; rowGap?: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: ml, marginBottom: gapAfter }}>
      {items.map((x, i) => (
        <View key={i} style={{ width: `${100 / cols}%`, flexDirection: "row", marginBottom: rowGap, paddingRight: 6 }}>
          <Text style={{ ...t(size, 700, numColor), width: start + i >= 10 ? 16 : 11 }}>{start + i}</Text>
          <View style={{ flex: 1 }}>{typeof x === "string" ? <Text style={t(size)}>{x}</Text> : x}</View>
        </View>
      ))}
    </View>
  );
}

const Opts = ({ opts, letters = "abc", w = 100 }: { opts: string[]; letters?: string; w?: number }) => (
  <View style={{ flexDirection: "row" }}>
    {opts.map((o, i) => (
      <Text key={i} style={{ ...t(BODY), width: w }}>
        <B>{letters[i]}</B>  {o}
      </Text>
    ))}
  </View>
);

function WordBox({ words, color = BLUE, ml = 15, mb = 4 }: { words: string[]; color?: string; ml?: number; mb?: number }) {
  return (
    <View style={{ marginLeft: ml, marginBottom: mb, borderWidth: 1.2, borderColor: color, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, flexDirection: "row", flexWrap: "wrap" }}>
      {words.map((w) => (
        <Text key={w} style={{ ...t(BODY), marginRight: 10 }}>
          <Text style={{ color }}>•</Text> {w}
        </Text>
      ))}
    </View>
  );
}

function Dialogue({ lines, nameW = 38, size = BODY, color = RED }: { lines: [string, React.ReactNode][]; nameW?: number; size?: number; color?: string }) {
  return (
    <View>
      {lines.map(([who, said], i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 1 }}>
          <Text style={{ ...t(size, 700, color), width: nameW }}>{who}:</Text>
          <Text style={{ ...t(size), flex: 1 }}>{said}</Text>
        </View>
      ))}
    </View>
  );
}

function GrammarBox({ examples, notes, extras, w }: { examples: React.ReactNode[]; notes?: React.ReactNode[]; extras?: { title: string; body: React.ReactNode }[]; w?: number }) {
  return (
    <View style={{ borderWidth: 1.4, borderColor: PEACH_LINE, borderRadius: 12, backgroundColor: PEACH, padding: 7, marginLeft: 15, marginBottom: 5, ...(w ? { width: w } : {}) }}>
      {examples.map((e, i) => (
        <Text key={i} style={it(9.6)}>
          {e}
        </Text>
      ))}
      {notes?.map((n, i) => (
        <Text key={i} style={{ ...t(9.4), marginTop: 3 }}>
          • {n}
        </Text>
      ))}
      {extras?.map((x) => (
        <View key={x.title} style={{ backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: PEACH_LINE, padding: 5, marginTop: 5 }}>
          <Text style={t(9.2, 700)}>{x.title}</Text>
          <Text style={t(9.2)}>{x.body}</Text>
        </View>
      ))}
    </View>
  );
}
const g = (s: string) => <Text style={{ color: BLUE, fontWeight: 700, fontStyle: "normal" }}>{s}</Text>;

function CheckWords({ words, extraTitle, extra, w = 200 }: { words: string[]; extraTitle?: string; extra?: string[]; w?: number }) {
  return (
    <View style={{ width: w, backgroundColor: YELLOW, borderRadius: 8, padding: 7, paddingTop: 12, borderWidth: 1, borderColor: "#E9C93D" }}>
      <View style={{ position: "absolute", top: -9, left: 10, flexDirection: "row", alignItems: "center", backgroundColor: RED, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 1.5 }}>
        <Text style={{ fontFamily: "Sym", fontSize: 9, color: "#fff" }}>✓ </Text>
        <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 9, color: "#fff" }}>Check these words</Text>
      </View>
      <Text style={t(8.8)}>{words.map((x) => `• ${x}`).join("   ")}</Text>
      {extra ? (
        <>
          <Text style={{ ...t(8.6, 700, "#fff"), backgroundColor: PURPLE, alignSelf: "flex-start", paddingHorizontal: 4, marginTop: 3 }}>{extraTitle}</Text>
          {extra.map((e) => (
            <Text key={e} style={t(8.8)}>
              • {e}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

const Pic = ({ src, w, h, fit = "cover", r = 6, border, pos }: { src: Src; w: number | string; h: number; fit?: "cover" | "contain"; r?: number; border?: string; pos?: string }) => (
  <View style={{ width: w, height: h, borderRadius: r, overflow: "hidden", ...(border ? { borderWidth: 2, borderColor: border } : {}) }}>
    {/* eslint-disable-next-line jsx-a11y/alt-text */}
    <Image src={srcOf(src)} style={{ width: "100%", height: "100%", objectFit: fit, ...(pos ? { objectPosition: pos } : {}) }} />
  </View>
);
// eslint-disable-next-line jsx-a11y/alt-text
const Ico = ({ e, s = 14 }: { e: string; s?: number }) => (E(e) ? <Image src={E(e)} style={{ width: s, height: s }} /> : null);

function Lines({ n, w = "100%", ml = 15, gap = 15 }: { n: number; w?: number | string; ml?: number; gap?: number }) {
  return (
    <View style={{ marginLeft: ml, width: w }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ height: gap, borderBottomWidth: 0.8, borderColor: "#9E9E9E" }} />
      ))}
    </View>
  );
}


function Bubble({ l, tp, w = 120, children, who, tail = "bl" }: { l: number; tp: number; w?: number; children: React.ReactNode; who?: string; tail?: "bl" | "br" | "tl" | "tr" }) {
  const tailStyle = {
    bl: { bottom: -7, left: 14 },
    br: { bottom: -7, right: 14 },
    tl: { top: -7, left: 14 },
    tr: { top: -7, right: 14 },
  }[tail];
  return (
    <View style={{ position: "absolute", left: l, top: tp, width: w }}>
      <View style={{ backgroundColor: "#fff", borderRadius: 10, borderWidth: 1.2, borderColor: INK, paddingHorizontal: 6, paddingVertical: 4 }}>
        {who ? <Text style={t(8.6, 700, RED)}>{who}</Text> : null}
        <Text style={{ ...t(8.6), fontFamily: "Andika" }}>{children}</Text>
      </View>
      <View style={{ position: "absolute", ...tailStyle, width: 12, height: 12, backgroundColor: "#fff", borderRightWidth: 1.2, borderBottomWidth: 1.2, borderColor: INK, transform: tail.startsWith("b") ? "rotate(45deg)" : "rotate(-135deg)" }} />
    </View>
  );
}

const Box = ({ ch = "☐", s = 11 }: { ch?: string; s?: number }) => <Text style={{ fontFamily: "Sym", fontSize: s }}>{ch}</Text>;

// =============================================================================
// Student's Book pages. Every picture area sits where the source page has
// one (FBox = fractions of the page, measured from i_5_team_2.pdf with
// src/lib/source-layout.ts); the content in it is new.
// =============================================================================
function Puzzle({ l, tp, c, s = 40, rot = 0 }: { l: number; tp: number; c: string; s?: number; rot?: number }) {
  return (
    <View style={{ position: "absolute", left: l, top: tp, transform: `rotate(${rot}deg)` }}>
      <Svg width={s} height={s} viewBox="0 0 40 40">
        <Path d="M4 10 H15 A5 5 0 1 1 25 10 H36 V21 A5 5 0 1 0 36 31 V36 H4 Z" fill={c} />
      </Svg>
    </View>
  );
}
const g2 = (s: string) => <Text style={{ color: BLUE, fontWeight: 700 }}>{s}</Text>;

// --- Welcome Module (source pp.6-11) -------------------------------------------
function P4() {
  return (
    <BookPage n={4} label="Welcome Module" bg="#fff">
      <Abs l={-ML} tp={-TOP} w={W} h={H}>
        <Pic src={A.limeGround} w={W} h={H} r={0} />
      </Abs>
      <Puzzle l={W - 100} tp={-14} c="#F06292" s={44} rot={12} />
      <Puzzle l={W - 60} tp={14} c="#FFD54F" s={34} rot={-20} />
      <View style={{ width: 300 }}>
        <UnitTitle title="Let's Begin!" />
        <Ex n="1" listen mt={6}>
          a) Read and complete the dialogue with the phrases below. Listen and check.
        </Ex>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: 15, marginVertical: 3, gap: 4 }}>
          {["How's it going", "This is my cousin", "Where do you live", "Nice to meet you", "How old are you", "Not bad, thanks"].map((p) => (
            <Text key={p} style={{ ...t(9.4), backgroundColor: "#fff", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1.5, borderWidth: 0.8, borderColor: "#AED581" }}>
              • {p}
            </Text>
          ))}
        </View>
        <View style={{ marginLeft: 15, backgroundColor: "#ffffffd9", borderRadius: 8, padding: 7 }}>
          <Dialogue
            lines={[
              ["Max", <Text key="1">Hi, Nina! <B>1)</B> {GAPLINE}?</Text>],
              ["Nina", <Text key="2"><B>2)</B> {GAPLINE}. And you?</Text>],
              ["Max", <Text key="3">Great! Nina, <B>3)</B> {GAPLINE}, Leo. He&apos;s staying with us this summer.</Text>],
              ["Nina", <Text key="4">Hi, Leo! <B>4)</B> {GAPLINE}!</Text>],
              ["Leo", "Nice to meet you, too."],
              ["Nina", <Text key="5"><B>5)</B> {GAPLINE}, Leo?</Text>],
              ["Leo", "In Dublin, near the sea."],
              ["Nina", <Text key="6">Cool! <B>6)</B> {GAPLINE}?</Text>],
              ["Leo", "I'm thirteen. And I'm hungry! Is there any pizza?"],
            ]}
          />
        </View>
      </View>
      <View style={{ backgroundColor: PURPLE, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6, marginLeft: 15 }}>
        <Text style={t(10.5, 700, "#fff")}>
          b) <Text style={{ color: "#FFEB3B" }}>Over to you:</Text> In groups of three, act out a dialogue like the one in Ex. 1a.
        </Text>
      </View>
      <Ex n="2" mt={8}>
        a) Look at Leo&apos;s family tree. Complete the sentences with words from the box.
      </Ex>
      <WordBox words={["aunt", "uncle", "cousin", "daughter", "wife", "granddad", "nephew", "niece", "son"]} color={GREEN} />
      <Items
        cols={2}
        rowGap={1}
        items={[
          <Text key="1" style={t()}>Leo is Ruth&apos;s {g2("grandson")}.</Text>,
          `Paul is Leo's ${GAPLINE}.`,
          `Anna is Leo's ${GAPLINE}.`,
          `Jack is Leo's ${GAPLINE}.`,
          `Ella is Anna's ${GAPLINE}.`,
          `Rosa is David's ${GAPLINE}.`,
          `Frank is Mia's ${GAPLINE}.`,
          `Leo is Anna's ${GAPLINE}.`,
          `Mia is Paul's ${GAPLINE}.`,
          `David is Frank's ${GAPLINE}.`,
        ]}
      />
      <At box={[0.07, 0.66, 0.17, 0.25]}>
        <Text style={t(10, 700)}>b) Who is Jack&apos;s mum? Who is Ella&apos;s uncle? Who is Mia&apos;s aunt? Ask and answer in class.</Text>
        <Text style={{ ...it(9.4), marginTop: 4 }}>A: Who is Jack&apos;s mum?{"\n"}B: Anna. Who is ...?</Text>
      </At>
      <Area box={[0.24, 0.62, 0.61, 0.32]} src={A.familyTree} fit="contain" />
    </BookPage>
  );
}

function P5() {
  const nums: [string, string, string?][] = [
    ["37", "#43A047", "thirty-seven"],
    ["14", "#1E88E5"],
    ["58", "#E53935"],
    ["90", "#8E24AA"],
    ["26", "#FB8C00"],
    ["71", "#00ACC1"],
  ];
  return (
    <BookPage n={5} label="Welcome Module">
      <At box={[0.07, 0.066, 0.9, 0.03]}>
        <Ex n="3" mt={0}>What&apos;s the subject? Look, choose and write.</Ex>
      </At>
      <Area box={[0.07, 0.09, 0.92, 0.32]} src={A.chalkboard} fit="contain" />
      <View style={{ flexDirection: "row", gap: GAP, marginTop: SB([0, 0.42, 0, 0]).tp }}>
        <View style={{ width: COL }}>
          <WordBox words={["Art", "Maths", "Music", "Science", "History", "PE", "IT"]} color={RED} />
          <Ex n="4">Write the numbers.</Ex>
          {nums.map(([n, , w], i) => (
            <View key={n} style={{ flexDirection: "row", alignItems: "flex-end", marginLeft: 15, marginBottom: 3 }}>
              <Pic src={A.badges[i]} w={44} h={30} fit="contain" r={0} />
              <View style={{ flex: 1, marginLeft: 8, borderBottomWidth: 0.8, borderColor: "#9E9E9E", height: 18 }}>{w ? <Text style={t(10, 700, BLUE)}>{w}</Text> : null}</View>
            </View>
          ))}
          <Ex n="5" mt={6}>Read and match.</Ex>
          <View style={{ flexDirection: "row", marginLeft: 15 }}>
            <View style={{ width: 92 }}>
              <Items ml={0} items={["2,000", "2,000,000", "504", "1,300", "100,000", "6,000,000,000"]} />
            </View>
            <View style={{ flex: 1 }}>
              {["a  six billion", "b  two thousand", "c  a hundred thousand", "d  five hundred and four", "e  two million", "f  one thousand three hundred"].map((x) => (
                <Text key={x} style={{ ...t(), marginBottom: 1.5 }}>
                  <B>{x.slice(0, 1)}</B>
                  {x.slice(1)}
                </Text>
              ))}
            </View>
          </View>
        </View>
        <View style={{ width: COL }}>
          <Ex n="6">Write the numbers.</Ex>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: 15, marginBottom: 4 }}>
            {[
              ["first", "1st", "#E53935"],
              ["twenty-second", "", "#43A047"],
              ["ninth", "", "#1E88E5"],
              ["fortieth", "", "#8E24AA"],
              ["third", "", "#FB8C00"],
              ["sixty-fifth", "", "#00897B"],
              ["twelfth", "", "#D81B60"],
              ["hundredth", "", "#5E35B1"],
            ].map(([w, a, c]) => (
              <View key={w} style={{ width: "50%", marginBottom: 5, paddingRight: 8 }}>
                <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 13, color: c }}>{w}:</Text>
                <View style={{ borderBottomWidth: 0.8, borderColor: "#9E9E9E", height: 13 }}>{a ? <Text style={t(10, 700, BLUE)}>{a}</Text> : null}</View>
              </View>
            ))}
          </View>
          <Ex n="7">Complete the short dialogues. Then take roles and act out.</Ex>
          <Items
            rowGap={3}
            items={[
              <Text key="1" style={t()}>A: Is your mum&apos;s birthday on the {g2("twentieth")} (20) of May?{"\n"}B: No, it&apos;s on the {GAPLINE} (21).</Text>,
              <Text key="2" style={t()}>A: Which floor is the dentist on?{"\n"}B: The {GAPLINE} (4) floor. Take the lift.</Text>,
              <Text key="3" style={t()}>A: Who came {GAPLINE} (1) in the race?{"\n"}B: Kenji! And Sam was {GAPLINE} (2).</Text>,
              <Text key="4" style={t()}>A: Is Halloween on the {GAPLINE} (31) of October?{"\n"}B: Yes, it is. Let&apos;s have a party!</Text>,
            ]}
          />
        </View>
      </View>
    </BookPage>
  );
}

function P6() {
  const countries: [string, string][] = [
    ["India", "#E53935"],
    ["Australia", "#1E88E5"],
    ["China", "#43A047"],
    ["Brazil", "#FB8C00"],
    ["Japan", "#8E24AA"],
    ["Spain", "#00897B"],
  ];
  const box: FBox = [0.03, 0.02, 0.95, 0.61];
  const b = SB(box);
  const tags = ["The Taj Mahal", "The Sydney Opera House", "The Great Wall", "Christ the Redeemer", "Mount Fuji", "The Sagrada Família"];
  return (
    <BookPage n={6} label="Welcome Module" strip={false}>
      <Area box={box} src={A.landmarks} />
      {art.LANDMARK_TILES2.map((tile, i) => (
        <Text
          key={i}
          style={{ position: "absolute", left: b.l + ((tile.x + 16) / 1480) * b.w, top: b.tp + ((tile.y + tile.h - 30) / 1210) * b.h, ...t(8.6, 700, "#fff"), backgroundColor: countries[i][1], paddingHorizontal: 5, borderRadius: 4 }}
        >
          {tags[i]}
        </Text>
      ))}
      <At box={[0.07, 0.035, 0.42, 0.2]}>
        <UnitTitle title="Let's Begin!" />
        <Ex n="1" mt={2}>Are you good at Geography? Look and say the country.</Ex>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: 15, columnGap: 10 }}>
          {countries.map(([c, col]) => (
            <Text key={c} style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 14, color: col }}>
              {c}
            </Text>
          ))}
        </View>
        <Text style={{ ...it(), marginLeft: 15 }}>The Taj Mahal is in India.</Text>
      </At>
      <View style={{ flexDirection: "row", gap: GAP, marginTop: SB([0, 0.64, 0, 0]).tp }}>
        <View style={{ width: COL }}>
          <Ex n="2">Complete the table.</Ex>
          <View style={{ marginLeft: 15, borderWidth: 1.2, borderColor: PEACH_LINE, borderRadius: 8, overflow: "hidden", backgroundColor: PEACH }}>
            {[
              ["Subject pronouns", "Object pronouns", "Possessive adjectives", "Possessive pronouns"],
              ["I", "me", "my", "mine"],
              ["you", "", "your", ""],
              ["he", "him", "", "his"],
              ["she", "", "her", ""],
              ["it", "it", "", "–"],
              ["we", "", "our", ""],
              ["they", "", "their", ""],
            ].map((row, r) => (
              <View key={r} style={{ flexDirection: "row", backgroundColor: r === 0 ? "#FCE1D3" : "#fff", borderTopWidth: r ? 0.6 : 0, borderColor: "#F8CDB8" }}>
                {row.map((c, k) => (
                  <Text key={k} style={{ ...t(r === 0 ? 8.2 : 9.2, r === 0 ? 700 : 400, r === 1 && k > 0 ? BLUE : INK), width: "25%", textAlign: "center", paddingVertical: 1.5, borderLeftWidth: k ? 0.6 : 0, borderColor: "#F8CDB8" }}>
                    {c || "______"}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>
        <View style={{ width: COL }}>
          <Ex n="3">Complete the short dialogues. Then take roles and act out.</Ex>
          <Items
            size={9.2}
            rowGap={1}
            items={[
              <Text key="1" style={t(9.2)}>A: Are these {g2("your")} (you) headphones? B: Yes, they&apos;re {g2("mine")} (I). Thanks!</Text>,
              `A: Is this Maria's scarf? B: No, it isn't ______ (she). ______ (she) scarf is red.`,
              `A: Whose keys are these? B: They're ______ (we). Thank you!`,
              `A: Is that Sam's bike? B: Yes, it's ______ (he). He loves ______ (it) colour.`,
              `A: Can you help ______ (I) with my homework? B: Sure.`,
              `A: Are the twins coming? B: Yes. I'm meeting ______ (they) at six.`,
              `A: Is this umbrella ______ (you)? B: Yes! I need it today.`,
              `A: My cousins are here. Do you want to meet ______ (they)?`,
            ]}
          />
        </View>
      </View>
    </BookPage>
  );
}

function P7() {
  return (
    <BookPage n={7} label="Welcome Module">
      <At box={[0.07, 0.066, 0.9, 0.03]}>
        <Ex n="4" mt={0}>What is there in Lily&apos;s new room? Talk with your friend.</Ex>
      </At>
      {/* from the top: at 60% Zoe's head on the stepladder was cut off */}
      <Area box={[0.06, 0.09, 0.85, 0.33]} src={A.scene1a} r={10} pos="50% 15%" />
      <View style={{ marginTop: SB([0, 0.43, 0, 0]).tp }}>
        <Items cols={4} items={["boxes", "a rug", "a wardrobe", "curtains", "a beanbag", "a laptop", "a bookcase", "a paint pot"]} />
        <Text style={{ ...it(), marginLeft: 15, marginBottom: 6 }}>A: There&apos;s a beanbag in Lily&apos;s room.   B: Where is it?   A: It&apos;s next to the desk.</Text>
      </View>
      <At box={[0.07, 0.5, 0.45, 0.04]}>
        <Ex n="5" listen mt={0}>
          Listen and choose.
        </Ex>
      </At>
      <Area box={[0.1, 0.55, 0.41, 0.39]} src={A.clocks} fit="contain" />
      <At box={[0.55, 0.5, 0.4, 0.44]}>
        <Ex n="6" mt={0}>Make the words plural.</Ex>
        <Items
          rowGap={4.5}
          items={[
            <Text key="1" style={t()}>a door  –  {g2("doors")}</Text>,
            `a box  –  ${GAPLINE}`,
            `a leaf  –  ${GAPLINE}`,
            `a child  –  ${GAPLINE}`,
            `a city  –  ${GAPLINE}`,
            `a knife  –  ${GAPLINE}`,
            `a foot  –  ${GAPLINE}`,
            `a toy  –  ${GAPLINE}`,
            `a sandwich  –  ${GAPLINE}`,
            `a man  –  ${GAPLINE}`,
            `a potato  –  ${GAPLINE}`,
            `a fish  –  ${GAPLINE}`,
          ]}
        />
      </At>
    </BookPage>
  );
}

function P8() {
  const caps = ["into the box", "out of the box", "through the tunnel", "under the bridge", "across the road", "along the wall", "up the stairs", "down the stairs", "over the fence"];
  const gw = COL;
  const gh = gw * (1128 / 948);
  const cats: [string, string, string][] = [
    ["Sports", "#E53935", "⚽"],
    ["Food", "#FB8C00", "🍕"],
    ["House", "#43A047", "🏠"],
    ["Places", "#1E88E5", "🏟️"],
  ];
  return (
    <BookPage n={8} label="Welcome Module">
      <Abs l={COL + 14} tp={-TOP} w={W - ML - COL - 14} h={H}>
        <View style={{ flex: 1, backgroundColor: PURPLE }} />
      </Abs>
      <View style={{ flexDirection: "row", gap: GAP + 14 }}>
        <View style={{ width: COL }}>
          <UnitTitle title="Let's Begin!" />
          <Ex n="1" mt={6}>What is Tiger the cat doing? Look and say.</Ex>
          <View style={{ width: gw, height: gh, marginTop: 3 }}>
            <Pic src={A.moves} w={gw} h={gh} fit="contain" r={0} />
            {caps.map((c, i) => {
              const cell = gw / (948 / 300);
              const gx = gw / (948 / 24);
              const x = (i % 3) * (cell + gx);
              const y = Math.floor(i / 3) * (cell + (64 / 300) * cell + gx) + cell + 1;
              return (
                <View key={c} style={{ position: "absolute", left: x, top: y, width: cell, flexDirection: "row", justifyContent: "center" }}>
                  <Text style={t(8.6, 700, RED)}>{i + 1} </Text>
                  <Text style={t(8.6)}>{c}</Text>
                </View>
              );
            })}
          </View>
          <Text style={{ ...it(), marginTop: 3 }}>Tiger is walking into the box.</Text>
          <Ex n="2" mt={6}>Choose the right prepositions of movement.</Ex>
          <Items
            rowGap={4}
            items={[
              ["🚲", "The girl is carrying her bike up/over the stairs."],
              ["⚽", "The ball is rolling along/down the hill."],
              ["🛋️", "The sofa can't go through/across the door."],
              ["🐕", "The dog is jumping out of/over the fence and the cat is running into/up the tree."],
            ].map(([e, s]) => (
              <View key={s} style={{ flexDirection: "row", alignItems: "center" }}>
                <Ico e={e} s={22} />
                <Text style={{ ...t(), flex: 1, marginLeft: 6 }}>{s}</Text>
              </View>
            ))}
          />
        </View>
        <View style={{ width: COL - 14 }}>
          <View style={{ flexDirection: "row", marginTop: 18, marginBottom: 2.5 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginRight: 4 }}>
              <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 14, color: RED, lineHeight: 1 }}>3</Text>
            </View>
            <Text style={{ ...t(10.5, 700, "#fff"), flex: 1, paddingTop: 2 }}>Put the words in the right category.</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: 15, marginTop: 3, marginBottom: 8, backgroundColor: "#fff", borderRadius: 8, padding: 6 }}>
            {["tennis", "museum", "sofa", "cheese", "judo", "library", "cooker", "pasta", "swimming", "stadium", "bath", "bananas", "chess", "café", "wardrobe", "soup", "golf", "bakery", "fridge", "rice"].map((w) => (
              <Text key={w} style={{ ...t(9.4), width: "33%" }}>
                • {w}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginLeft: 6 }}>
            {cats.map(([c, col, e]) => (
              <View key={c} style={{ width: (COL - 14 - 16) / 2, backgroundColor: "#fff", borderWidth: 4, borderColor: col, padding: 8, paddingTop: 16, marginTop: 8 }}>
                <View style={{ position: "absolute", top: -11, left: 10, flexDirection: "row", alignItems: "center", backgroundColor: col, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Ico e={e} s={12} />
                  <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 12, color: "#fff", marginLeft: 3 }}>{c}</Text>
                </View>
                {Array.from({ length: 5 }, (_, k) => (
                  <View key={k} style={{ height: 17, borderBottomWidth: 0.8, borderColor: "#9E9E9E" }} />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    </BookPage>
  );
}

function P9() {
  const box: FBox = [0.02, 0.53, 0.93, 0.43];
  const b = SB(box);
  return (
    <BookPage n={9} label="Welcome Module">
      <At box={[0.07, 0.066, 0.37, 0.43]}>
        <Ex n="4" listen mt={0}>
          Read and choose. Then listen and check your answers.
        </Ex>
        <Items
          rowGap={2.5}
          items={[
            ["Hi, I'm Max Green.", "Hello, Max.", "Hi, Green."],
            ["How's it going?", "Not bad, thanks.", "I'm twelve."],
            ["Nice to meet you.", "Nice to meet you, too.", "By bus."],
            ["See you on Monday!", "It's Monday.", "Bye! See you!"],
            ["Sorry I'm late!", "That's OK.", "Hello!"],
            ["Have a nice weekend!", "It's Sunday.", "Thanks, you too!"],
            ["Thank you for your help.", "You're welcome.", "I'm Sam."],
            ["Where's the bus station?", "It's a big bus.", "It's on Hill Road."],
          ].map(([a, x, y]) => (
            <View key={a}>
              <Text style={t()}>
                <B>A:</B> {a}
              </Text>
              <Text style={t()}>
                <B>B:</B> <B c={RED}>a)</B> {x}   <B c={RED}>b)</B> {y}
              </Text>
            </View>
          ))}
        />
      </At>
      <Area box={[0.45, 0.04, 0.53, 0.45]} src={A.idCard} pad={[16, 18, 10, 22]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 14, color: RED, width: 15 }}>5</Text>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#fff", backgroundColor: PURPLE, borderRadius: 5, paddingHorizontal: 6 }}>My ID File</Text>
        </View>
        <Text style={{ ...t(10.5, 700), marginBottom: 3, marginLeft: 15 }}>Answer the questions about you.</Text>
        <Items
          rowGap={0}
          items={[
            "What's your full name?",
            "When's your birthday?",
            "Who do you live with?",
            "What's your lucky number?",
            "When do your holidays start?",
            "What do you do after school?",
            "What's your favourite band?",
            "What's your favourite subject?",
            "Which sport do you like?",
            "What's your favourite meal?",
          ].map((q) => (
            <View key={q}>
              <Text style={t()}>{q}</Text>
              <View style={{ height: 5, borderBottomWidth: 0.8, borderColor: "#9575CD", marginBottom: 2 }} />
            </View>
          ))}
        />
      </Area>
      <At box={[0.07, 0.49, 0.88, 0.04]}>
        <Ex n="6" mt={0}>
          Look at the pictures from the modules in this book. What do you think each module is about? Then go through the contents and find the modules.
        </Ex>
      </At>
      <Area box={box} src={A.modules} fit="contain" />
      {Array.from({ length: 7 }, (_, i) => {
        const imgW = Math.min(b.w, b.h * (1272 / 764));
        const k = imgW / 1272;
        const x0 = b.l + (b.w - imgW) / 2;
        const c = 300 * k;
        const x = x0 + (i % 4) * (300 + 24) * k;
        const y = b.tp + Math.floor(i / 4) * (300 + 70 + 24) * k + c + 2;
        return (
          <Text key={i} style={{ position: "absolute", left: x, top: y, width: c, textAlign: "center", ...t(9.6, 700) }}>
            {i === 0 ? "Module 1" : "Module ___"}
          </Text>
        );
      })}
    </BookPage>
  );
}

// --- 1a Moving day (source pp.12-13) --------------------------------------------
function NumCaption({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 2 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: RED, alignItems: "center", justifyContent: "center", marginRight: 5 }}>
        <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 14, color: "#fff", lineHeight: 1 }}>{n}</Text>
      </View>
      <Text style={{ ...t(10, 700), flex: 1, paddingTop: 2 }}>{children}</Text>
    </View>
  );
}
const DlgBox = ({ children, w }: { children: React.ReactNode; w: number }) => (
  <View style={{ width: w, backgroundColor: "#ffffffc8", borderRadius: 10, borderWidth: 1.5, borderColor: RED, padding: 7 }}>{children}</View>
);

function P10() {
  return (
    <BookPage n={10} strip={false} bg="#DDEFF9">
      <Area box={[0.03, 0.08, 0.95, 0.63]} src={A.comic1a} />
      <LessonHeader code="1a" title="Moving day" />
      <Abs l={CW - 205} tp={-6} w={205}>
        <CheckWords
          w={205}
          words={["decorate", "wardrobe", "bookcase", "curtains", "beanbag", "carry", "unpack", "take a break", "Wi-Fi", "go with"]}
          extraTitle="SMALL TALK"
          extra={["It looks amazing!", "Who's hungry?"]}
        />
      </Abs>
      <At box={[0.06, 0.13, 0.43, 0.28]}>
        <DlgBox w={0.43 * W}>
          <NumCaption n="1">Zoe, Sam and Kenji are helping Lily with her new room.</NumCaption>
          <Dialogue
            size={9.6}
            lines={[
              ["Zoe", "Your room looks amazing, Lily!"],
              ["Lily", "Thanks! Dad's building a new bookcase for me. The old one is too small."],
              ["Sam", "Where do you want this box?"],
              ["Lily", "Next to the desk, please. It's full of comics!"],
              ["Zoe", "I love the colour of your wardrobe."],
              ["Lily", "I'm painting it light blue. It goes with the curtains."],
            ]}
          />
        </DlgBox>
      </At>
      <At box={[0.06, 0.73, 0.42, 0.2]}>
        <DlgBox w={0.4 * W}>
          <NumCaption n="2">Kenji is sitting at the desk.</NumCaption>
          <Dialogue
            size={9.6}
            nameW={40}
            lines={[
              ["Sam", "Kenji! What are you doing?"],
              ["Kenji", "I'm checking the Wi-Fi. It's working!"],
              ["Lily", "You're playing a game, aren't you?"],
              ["Kenji", "Just a quick one ... I'm taking a break!"],
            ]}
          />
        </DlgBox>
      </At>
      <At box={[0.53, 0.73, 0.42, 0.2]}>
        <DlgBox w={0.42 * W}>
          <NumCaption n="3">Lily&apos;s mum comes in.</NumCaption>
          <Dialogue
            size={9.6}
            nameW={40}
            lines={[
              ["Mum", "Who's hungry? I'm making pizza."],
              ["Zoe", "Me! Can we take a break too?"],
              ["Lily", "OK, but after lunch we're putting up the posters."],
              ["Kenji", "Great. I'm staying here then - next to the Wi-Fi!"],
            ]}
          />
        </DlgBox>
      </At>
    </BookPage>
  );
}

function P11() {
  const vb = SB([0.02, 0.43, 0.47, 0.25]);
  return (
    <BookPage n={11} refs="1a">
      {/* left column */}
      <At box={[0.07, 0.06, 0.4, 0.37]}>
        <Section name="Reading" icon="📖" mt={0} />
        <Ex n="1" listen>
          Look at the picture and the title. In pairs, decide what the dialogue is about. Listen, read and check your answers.
        </Ex>
        <Ex n="2">a) Read again and circle a or b.</Ex>
        <Items
          rowGap={1.5}
          items={[
            ["Lily's dad is ________ a new bookcase.", "painting", "building"],
            ["Lily's box is full of ________.", "comics", "clothes"],
            ["Lily is painting her wardrobe ________.", "light blue", "yellow"],
            ["Kenji says he is ________.", "unpacking", "taking a break"],
          ].map(([s, a, b]) => (
            <View key={s}>
              <Text style={t()}>{s}</Text>
              <Opts opts={[a, b]} letters="ab" w={100} />
            </View>
          ))}
        />
        <Sub>b) Give the dialogue a new title.</Sub>
        <Section name="Vocabulary" icon="🔤" />
        <Ex n="3" listen>
          Listen and repeat. Use the words to complete the sentences.
        </Ex>
      </At>
      <Area box={[0.02, 0.43, 0.47, 0.25]} src={A.vocab1a} fit="contain" />
      {["wardrobe", "desk lamp", "rug", "beanbag", "bookcase", "curtains"].map((c, i) => {
        const imgW = Math.min(vb.w, vb.h * (1020 / 772));
        const k = imgW / 1020;
        const x0 = vb.l + (vb.w - imgW) / 2;
        return (
          <Text key={c} style={{ position: "absolute", left: x0 + (i % 3) * 360 * k, top: vb.tp + Math.floor(i / 3) * 416 * k + 302 * k, width: 300 * k, textAlign: "center", ...t(9.2) }}>
            {c}
          </Text>
        );
      })}
      <At box={[0.07, 0.69, 0.4, 0.14]}>
        <Items
          rowGap={0.5}
          size={9.6}
          items={[
            <Text key="1" style={t(9.6)}>It&apos;s dark. Turn on the {g2("desk lamp")}.</Text>,
            `Hang your jacket in the ________.`,
            `Close the ________. It's sunny!`,
            `My cat sleeps on the ________.`,
            `I keep my comics on the ________.`,
            `Sit on the ________. It's comfy!`,
          ]}
        />
      </At>
      <Area box={[0.11, 0.83, 0.33, 0.11]} src={A.didYouKnow} fit="contain">
        <Text style={{ position: "absolute", left: 58, top: 16, width: 120, ...t(8.4), fontFamily: "Andika", transform: "rotate(-8deg)" }}>In Japan, lots of people sleep on a futon on the floor!</Text>
      </Area>
      {/* right column */}
      <At box={[0.5, 0.06, 0.45, 0.32]}>
        <Section name="Grammar" sub="Present Continuous" icon="✏️" mt={0} />
        <Ex n="4">
          Go through the Grammar box. Read the dialogue again and underline the <Text style={{ fontStyle: "italic" }}>Present Continuous</Text>. How is it formed/used?
        </Ex>
        <GrammarBox
          examples={[
            <Text key="1">I {g("am (I'm) unpacking")} my boxes.</Text>,
            <Text key="2">He {g("is (He's) painting")}.</Text>,
            <Text key="3">She {g("is not (isn't) sleeping")}.</Text>,
            <Text key="4">{g("Are")} they {g("playing")} a game? {g("Yes")}, they {g("are")}./{g("No")}, they {g("aren't")}.</Text>,
          ]}
          notes={[<Text key="n">We use the <B>present continuous</B> for <B>actions happening now</B>.</Text>]}
          extras={[
            { title: "Spelling rules", body: "make – making    sit – sitting    carry – carrying" },
            { title: "Time expressions:", body: "now, right now, at the moment, today, these days" },
          ]}
        />
      </At>
      <At box={[0.5, 0.36, 0.45, 0.04]}>
        <Ex n="5" mt={0}>a) Complete the email.  <Text style={{ fontWeight: 400 }}>• hang • build • carry • put • take</Text></Ex>
      </At>
      <Area box={[0.48, 0.4, 0.46, 0.23]} src={A.emailWin} pad={[22, 10, 6, 12]}>
        <Text style={t(9.4)}>
          Hi Mia,{"\n"}It&apos;s moving day at our new flat and everybody is busy! Right now my mum <B>1)</B> ________ pictures in the hall and my dad <B>2)</B> ________ a bookcase in my room. My brothers <B>3)</B> ________ boxes up the stairs and my grandma <B>4)</B> ________ the plates into the cupboards. And me? I <B>5)</B> ________ a short break!{"\n"}Write soon, Lily
        </Text>
      </Area>
      <At box={[0.5, 0.635, 0.45, 0.05]}>
        <Text style={t(10, 700)}>b) Read the email again. In pairs, ask and answer.  <Text style={{ fontWeight: 400, fontStyle: "italic" }}>A: What is Lily&apos;s mum doing? B: She&apos;s ...</Text></Text>
      </At>
      <Area box={[0.48, 0.68, 0.5, 0.21]} src={A.overToYou} pad={[4, 96, 6, 12]}>
        <Section name="Speaking and Writing" icon="💬" mt={0} />
        <Ex n="6" mt={0}>
          <Text style={{ color: RED }}>Over to you:</Text> Answer the questions.
        </Ex>
        <Items
          rowGap={0}
          size={9.4}
          items={["What colour is your bedroom?", "Have you got pictures on the walls?", "What can you see from your window?", "Where do you keep your books?", "What do you want to change? Why?"].map((q) => (
            <Text key={q} style={it(9.4)}>
              {q}
            </Text>
          ))}
        />
      </Area>
      <At box={[0.5, 0.895, 0.46, 0.045]}>
        <Ex n="7" mt={0} tag={<Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 10, color: "#fff", backgroundColor: RED, paddingHorizontal: 4, marginRight: 4, borderRadius: 2 }}>PORTFOLIO</Text>}>
          Write about your room. <Text style={{ fontStyle: "italic" }}>My room is small but cosy. I&apos;ve got ...</Text>
        </Ex>
      </At>
    </BookPage>
  );
}

// --- 1b Party night! (source pp.14-15) ----------------------------------------
function P12() {
  const cb = SB([0.03, 0.73, 0.48, 0.24]);
  const imgW = Math.min(cb.w, cb.h * (1020 / 772));
  const k = imgW / 1020;
  const x0 = cb.l + (cb.w - imgW) / 2;
  const sb = SB([0.19, 0.17, 0.79, 0.51]);
  return (
    <BookPage n={12}>
      <LessonHeader code="1b" title="Party night!" />
      <Abs l={CW - 215} tp={-6} w={215}>
        <CheckWords w={215} words={["chores", "dishwasher", "rubbish", "laundry", "be exhausted", "No way!", "count me in", "costume", "theme party", "arrangement"]} />
      </Abs>
      <Section name="Reading" icon="📖" mt={10} />
      <Area box={[0.19, 0.17, 0.79, 0.51]} src={A.scene1bVivid} r={12} pos="40% 50%">
        <Bubble l={sb.w * 0.02} tp={4} w={118} who="Mum" tail="bl">I&apos;m going to the market. Grandpa&apos;s party is at seven!</Bubble>
        <Bubble l={sb.w - 150} tp={8} w={128} who="Dad" tail="br">The dishwasher is full again! Who&apos;s eating the snacks?</Bubble>
        <Bubble l={sb.w * 0.45} tp={60} w={126} who="Emily" tail="bl">I&apos;m vacuuming the living room. Then I&apos;m going to a sleepover.</Bubble>
        <Bubble l={sb.w * 0.2} tp={86} w={118} who="Tom" tail="bl">I&apos;m taking out the rubbish. Can I play football after this?</Bubble>
        <Bubble l={sb.w * 0.12} tp={sb.h - 84} w={126} who="Biscuit the cat" tail="tr">Me? I&apos;m resting. It&apos;s Saturday!</Bubble>
        <Bubble l={sb.w - 170} tp={sb.h - 84} w={150} who="Grandma" tail="tl">I&apos;m watering the plants. They&apos;re thirsty too, you know!</Bubble>
      </Area>
      <At box={[0.02, 0.22, 0.2, 0.4]}>
        <View style={{ backgroundColor: "#E1F5FE", padding: 8, transform: "rotate(-4deg)", borderWidth: 1, borderColor: "#81D4FA" }}>
          <Text style={{ fontFamily: "Andika", fontSize: 9.4, lineHeight: 1.3 }}>
            Family,{"\n"}It&apos;s Grandpa&apos;s 70th birthday dinner tonight! Eight people are coming. Things to do:{"\n"}– shopping{"\n"}– rubbish{"\n"}– plants{"\n"}– dishwasher{"\n"}– vacuuming{"\n"}– set the table{"\n"}Thanks!{"\n"}Mum x
          </Text>
        </View>
      </At>
      <At box={[0.07, 0.685, 0.45, 0.05]}>
        <Ex n="1" listen mt={0} small>
          Listen and repeat. Do you help your parents at home? Which of these do you like doing?
        </Ex>
      </At>
      <Area box={[0.03, 0.73, 0.48, 0.24]} src={A.chores} fit="contain" />
      {["do the laundry", "load the dishwasher", "take out the rubbish", "water the plants", "set the table", "vacuum the floor"].map((c, i) => (
        <Text key={c} style={{ position: "absolute", left: x0 + (i % 3) * 360 * k, top: cb.tp + Math.floor(i / 3) * 416 * k + 302 * k, width: 300 * k, textAlign: "center", ...t(8.4, 700) }}>
          • {c}
        </Text>
      ))}
      <At box={[0.55, 0.69, 0.4, 0.1]}>
        <Ex n="2" listen mt={0} small>
          Which of the chores in Ex. 1 are in the text? Listen, read and find out.
        </Ex>
        <Section name="Pronunciation" icon="🗣️" mt={2} />
      </At>
      <At box={[0.55, 0.765, 0.4, 0.03]}>
        <Ex n="3" listen mt={0} small>
          Listen and tick (<Text style={{ fontFamily: "Sym" }}>✓</Text>).
        </Ex>
      </At>
      <Area box={[0.55, 0.795, 0.32, 0.16]} src={A.pronTable} pad={0}>
        {["", "sit", "seat", "fill", "feel", "ship", "sheep"].map((w, r) => (
          <Text key={r} style={{ position: "absolute", left: 8, top: (r * (0.16 * H)) / 7 + 2, ...t(9.4, 700) }}>
            {r === 0 ? "" : w}
          </Text>
        ))}
        <Text style={{ position: "absolute", left: 0.32 * W * 0.5, top: 2, ...t(9.4, 700) }}>/ɪ/</Text>
        <Text style={{ position: "absolute", left: 0.32 * W * 0.78, top: 2, ...t(9.4, 700) }}>/iː/</Text>
      </Area>
    </BookPage>
  );
}

function P13() {
  return (
    <BookPage n={13} refs="1b">
      <View style={{ flexDirection: "row", gap: GAP, marginTop: 18 }}>
        <View style={{ width: COL }}>
          <Section name="Grammar" sub="future meaning" icon="✏️" mt={0} />
          <Ex n="4">
            Go through the Grammar box. Then read Ex. 2 again and underline the <Text style={{ fontStyle: "italic" }}>Present Continuous</Text>. How is it used?
          </Ex>
          <GrammarBox
            examples={[<Text key="1">What {g("are")} you {g("doing tonight")}?</Text>, <Text key="2">We{g("'re having")} a birthday dinner {g("at seven")}.</Text>]}
            notes={[<Text key="n">We use the <B>present continuous</B> to talk about our <B>fixed arrangements in the near future</B>.</Text>]}
          />
          <Ex n="5">Complete the sentences.</Ex>
          <Items
            rowGap={2.5}
            items={[
              <Text key="1" style={t()}>{g2("Are you doing")} (you/do) anything this weekend?</Text>,
              `We ${GAPLINE} (have) a picnic on Sunday.`,
              `My brother ${GAPLINE} (fly) to Rome next week.`,
              `${GAPLINE} (Zoe/come) to the party tonight?`,
              `They ${GAPLINE} (not/play) tennis tomorrow.`,
              `I ${GAPLINE} (meet) Sam at the cinema at six.`,
              `Grandma ${GAPLINE} (visit) us next month.`,
            ]}
          />
          <Section name="Listening" icon="🎧" />
          <Ex n="6" listen>
            Sam is having a party. Listen, read and circle the right words.
          </Ex>
        </View>
        <View style={{ width: COL }}>
          <Section name="Speaking and Writing" icon="💬" mt={0} />
          <Ex n="7">
            a) <Text style={{ color: RED }}>Over to you:</Text> Work in groups. You are having a party at the weekend. Decide and tell the class about:
          </Ex>
          <View style={{ marginLeft: 22, marginBottom: 2 }}>
            {["the theme of the party", "the day, time and place", "the food and drinks", "the music and the costumes"].map((x) => (
              <Text key={x} style={t()}>
                • {x}
              </Text>
            ))}
          </View>
          <Text style={{ ...it(), marginLeft: 15 }}>We&apos;re having a superhero party on Saturday at ...</Text>
          <Sub>b) Write the invitation for your party.</Sub>
          <Section name="Everyday English" sub="Inviting/Accepting" icon="💬" />
          <Ex n="8" listen>
            a) Listen. In pairs, read out the dialogue.
          </Ex>
          <View style={{ marginLeft: 15 }}>
            <Dialogue
              nameW={40}
              lines={[
                ["Zoe", <Text key="1">Hi, Kenji! <B>Are you free on Saturday afternoon?</B></Text>],
                ["Kenji", "I think so. Why?"],
                ["Zoe", <Text key="2">We&apos;re going ice skating. <B>Do you want to come?</B></Text>],
                ["Kenji", <Text key="3"><B>Sure, why not!</B> What time are you meeting?</Text>],
                ["Zoe", "At three, outside the sports centre. And then we're having pizza at Lily's."],
                ["Kenji", <Text key="4">Pizza too? <B>Count me in!</B></Text>],
              ]}
            />
          </View>
          <Sub>b) Replace the phrases in bold with phrases from the box. Then take roles and act out the dialogue.</Sub>
          <View style={{ marginLeft: 15, borderRadius: 8, overflow: "hidden", borderWidth: 1.2, borderColor: RED, flexDirection: "row" }}>
            {[
              ["INVITING", ["What are your plans for ...?", "Are you doing anything on ...?", "Why don't you come ...?"]],
              ["ACCEPTING", ["I'd love to.", "Great idea!", "That sounds fun!"]],
            ].map(([h, xs]) => (
              <View key={h as string} style={{ flex: 1 }}>
                <Text style={{ ...t(9, 700, "#fff"), backgroundColor: RED, textAlign: "center", paddingVertical: 1.5 }}>{h as string}</Text>
                <View style={{ padding: 4, backgroundColor: "#FFEBEE" }}>
                  {(xs as string[]).map((x) => (
                    <Text key={x} style={t(9.2)}>
                      • {x}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
          <Ex n="9" mt={6}>
            Work in pairs and make your own dialogues. Use ideas from the box.
          </Ex>
          <View style={{ marginLeft: 22 }}>
            {[
              ["⭐", "go ice skating"],
              ["🎵", "go to a concert"],
              ["🍕", "have a pizza"],
            ].map(([e, x]) => (
              <View key={x} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                <Ico e={e} s={16} />
                <Text style={{ ...t(), marginLeft: 6 }}>{x}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <Area box={[0.0, 0.58, 0.5, 0.42]} src={A.poster} pad={[0.42 * H * 0.52, 18, 22, 52]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 19, color: RED, transform: "rotate(-2deg)" }}>We&apos;re having a party!</Text>
        <Text style={{ fontFamily: "Andika", fontSize: 10.4, color: INK, lineHeight: 1.35 }}>
          Come to my <B>1)</B> Space/Jungle party on <B>2)</B> 14th/24th May at <B>3)</B> 6:00/7:00 pm! Food, music and games for everyone. My flat: <B>4)</B> 18/80 Park Road.
        </Text>
        <Text style={{ fontFamily: "Andika", fontSize: 10, color: PURPLE, marginTop: 3 }}>PS Wear something out of this world!   Sam</Text>
      </Area>
    </BookPage>
  );
}

// --- 1c Free-time fun (source pp.16-17) ---------------------------------------
function P14() {
  const hb = SB([0.05, 0.04, 0.87, 0.49]);
  const caps = ["go skateboarding", "play video games", "bake cakes", "draw comics", "take photos", "go swimming", "play the guitar", "play football"];
  const quiz: [string, string, string][] = [
    ["On a free afternoon, you'd rather ...", "draw or bake something.", "meet friends at the park."],
    ["Your favourite present is ...", "a sketchbook.", "a new football."],
    ["At a party, you ...", "take photos of everyone.", "dance all night."],
    ["On a rainy day, you ...", "play the guitar.", "play video games with friends."],
    ["You prefer doing things ...", "on your own.", "in a team."],
  ];
  return (
    <BookPage n={14}>
      <Area box={[0.05, 0.04, 0.87, 0.49]} src={A.hobbies} />
      {caps.map((c, i) => {
        const k = hb.w / 1500;
        const x = hb.l + (60 + (i % 4) * 350) * k;
        const y = hb.tp + (380 + Math.floor(i / 4) * 350) * k + 300 * k - 22;
        return (
          <Text key={c} style={{ position: "absolute", left: x + 6, top: y, ...t(9, 700), backgroundColor: "#fff", borderRadius: 4, paddingHorizontal: 4 }}>
            {c}
          </Text>
        );
      })}
      <LessonHeader code="1c" title="Free-time fun" />
      <Abs l={CW - 200} tp={-6} w={200}>
        <CheckWords w={200} words={["free time", "would rather", "prefer", "creative", "sporty", "sociable", "patient", "on your own", "as long as", "dream job"]} />
      </Abs>
      <At box={[0.07, 0.11, 0.5, 0.08]}>
        <Section name="Vocabulary" icon="🔤" mt={0} />
        <Ex n="1" listen mt={0}>
          Listen and repeat. Which of these do you do in your free time? Tell the class.
        </Ex>
      </At>
      <At box={[0.07, 0.535, 0.85, 0.06]}>
        <Text style={it()}>I take photos at the weekend.</Text>
        <Section name="Reading" icon="📖" mt={1} />
        <Ex n="2" mt={0}>What&apos;s your free-time style? Do the quiz and find out! Then tell the class.</Ex>
      </At>
      <At box={[0.03, 0.62, 0.48, 0.33]}>
        <View style={{ backgroundColor: "#FCE4EC", borderRadius: 12, padding: 8, height: 0.31 * H }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 18, color: PINK, textAlign: "center", lineHeight: 1 }}>WHAT&apos;S YOUR STYLE?</Text>
          <Text style={{ ...t(9, 700, PURPLE), marginBottom: 3 }}>The things you do in your free time say a lot about you. Try our quiz!</Text>
          <Items
            ml={0}
            rowGap={2}
            size={9.4}
            items={quiz.map(([q, a, b]) => (
              <View key={q}>
                <Text style={t(9.4)}>{q}</Text>
                <Text style={t(9.4)}>
                  <B c={PINK}>A</B> {a}   <B c={PINK}>B</B> {b}
                </Text>
              </View>
            ))}
          />
        </View>
      </At>
      {/* a portrait picture in a wide box: from near the top, or the two boys lose their heads */}
      <Area box={[0.53, 0.62, 0.44, 0.21]} src={A.quiz} r={10} pos="50% 10%" />
      <At box={[0.53, 0.835, 0.44, 0.1]}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {[
            ["MOSTLY A", "You're creative and patient. You love making things on your own."],
            ["MOSTLY B", "You're sporty and sociable. You're happy as long as you're with friends!"],
          ].map(([h, s]) => (
            <View key={h} style={{ flex: 1, backgroundColor: PURPLE, borderRadius: 6, padding: 4 }}>
              <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 10.5, color: "#FFEB3B" }}>{h}</Text>
              <Text style={t(8.4, 400, "#fff")}>{s}</Text>
            </View>
          ))}
        </View>
      </At>
    </BookPage>
  );
}

function P15() {
  const lb = SB([0.05, 0.58, 0.44, 0.41]);
  const gb = SB([0.5, 0.71, 0.45, 0.27]);
  return (
    <BookPage n={15} refs="1c">
      <At box={[0.07, 0.06, 0.41, 0.5]}>
        <Section name="Grammar" sub="Present Simple" icon="✏️" mt={0} />
        <GrammarBox
          examples={[
            <Text key="1">I {g("go")} skateboarding on Sundays.</Text>,
            <Text key="2">Kenji {g("doesn't like")} football.</Text>,
            <Text key="3">{g("Do")} you {g("play")} the guitar? {g("Yes")}, I {g("do")}./{g("No")}, I {g("don't")}.</Text>,
          ]}
          notes={[<Text key="n">We use the <B>present simple</B> for <B>habits</B> and <B>daily routines</B>.</Text>]}
          extras={[
            { title: "Adverbs of frequency: always, usually, often, sometimes, hardly ever, never", body: "I always meet my friends on Saturday. Sam is never late." },
          ]}
        />
        <Ex n="3">Make sentences.</Ex>
        <Items
          rowGap={0.5}
          items={["Zoe/skateboarding/never/goes", "swimming/you/do/often/go/?", "always/I/breakfast/have/at 7:30", "late/is/hardly ever/Sam", "Kenji/usually/get up/doesn't/early"].map((s) => (
            <View key={s}>
              <Text style={t()}>{s}</Text>
              <View style={{ height: 10, borderBottomWidth: 0.8, borderColor: "#9E9E9E", marginBottom: 2 }} />
            </View>
          ))}
        />
      </At>
      <At box={[0.07, 0.528, 0.41, 0.05]}>
        <Section name="Listening and Speaking" icon="🎧" mt={0} />
        <Ex n="4" listen mt={0}>
          Listen and choose A, B or C.
        </Ex>
      </At>
      <Area box={[0.05, 0.58, 0.44, 0.41]} src={A.listenBlock} pad={0}>
        {[
          ["How often does Leo go swimming?", ["every day", "twice a week", "hardly ever"]],
          ["How often does Mia tidy her room?", ["once a week", "every day", "never"]],
          ["What does Ella always do before bed?", ["read a book", "watch TV", "play games"]],
        ].map(([q, os], i) => (
          <View key={i} style={{ position: "absolute", left: lb.w * 0.34, top: (i * lb.h) / 3 + 14, width: lb.w * 0.6 }}>
            <Text style={t(9.4, 700)}>
              <Text style={{ color: RED }}>{i + 1}</Text> {q as string}
            </Text>
            {(os as string[]).map((o, k) => (
              <Text key={o} style={t(9.2)}>
                <B c={RED}>{"ABC"[k]}</B> {o}
              </Text>
            ))}
          </View>
        ))}
      </Area>
      <At box={[0.52, 0.062, 0.45, 0.03]}>
        <Ex n="5" mt={0}>Talk with your friend. Use ideas from Ex. 1.</Ex>
      </At>
      <Area box={[0.52, 0.085, 0.41, 0.22]} src={A.park} r={10}>
        <Bubble l={0} tp={0} w={96} tail="bl">How often do you take photos?</Bubble>
        <Bubble l={0.41 * W - 116} tp={0} w={100} tail="br">Almost every day! What about you?</Bubble>
        <Bubble l={60} tp={0.22 * H - 50} w={120} tail="tl">I hardly ever take photos.</Bubble>
      </Area>
      <At box={[0.52, 0.31, 0.45, 0.4]}>
        <Section name="Grammar" sub="Present Simple – Present Continuous" icon="✏️" mt={0} />
        <GrammarBox
          examples={[
            <Text key="1">I {g("usually walk")} to school. <B>(habit)</B></Text>,
            <Text key="2">Today I{g("'m taking")} the bus. <B>(action now)</B></Text>,
            <Text key="3">We{g("'re having")} a party on Friday. <B>(arrangement)</B></Text>,
          ]}
        />
        <Ex n="6">
          Complete the sentences. Use the <Text style={{ fontStyle: "italic" }}>present simple</Text> or the <Text style={{ fontStyle: "italic" }}>present continuous</Text>.
        </Ex>
        <Items
          rowGap={2}
          items={[
            <Text key="1" style={t()}>We usually {g2("go")} (go) to the park, but today we{g2("'re staying")} (stay) at home.</Text>,
            `Why ${GAPLINE} (you/laugh)?`,
            `Zoe ${GAPLINE} (play) the guitar every day.`,
            `Look! Kenji ${GAPLINE} (skate) on the ramp.`,
            `I ${GAPLINE} (not/watch) TV in the mornings.`,
          ]}
        />
      </At>
      <At box={[0.52, 0.675, 0.45, 0.03]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 14, color: "#fff", backgroundColor: RED, borderRadius: 6, paddingHorizontal: 7, transform: "rotate(-4deg)" }}>Let&apos;s Play!</Text>
          <Text style={{ ...t(10, 700, RED), marginLeft: 6 }}>(Noughts and Crosses)</Text>
        </View>
      </At>
      <Area box={[0.5, 0.71, 0.45, 0.27]} src={A.noughts} fit="contain" pad={0}>
        {["always", "does", "when", "how often", "never", "free time", "where", "usually", "doing"].map((w, i) => (
          <Text key={w} style={{ position: "absolute", left: (i % 3) * (gb.w / 3), top: Math.floor(i / 3) * (gb.h / 3) + gb.h / 6 - 7, width: gb.w / 3, textAlign: "center", ...t(10.5, 700, ["#1E88E5", "#8E24AA", "#43A047"][i % 3]) }}>
            {w}
          </Text>
        ))}
      </Area>
    </BookPage>
  );
}

// --- 1d Skills work (source pp.18-19) -------------------------------------------
function P16() {
  return (
    <BookPage n={16}>
      <View style={{ flexDirection: "row", alignItems: "center", marginLeft: -26, marginTop: -14 }}>
        <Splash code="1d" />
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 22, color: "#fff", backgroundColor: RED, borderRadius: 8, paddingHorizontal: 10, marginLeft: 8, marginTop: 4 }}>Skills work</Text>
      </View>
      <Abs l={CW - 215} tp={-6} w={215}>
        <CheckWords w={215} words={["mission", "explore", "crystal", "pirates", "trap", "spell", "potion", "broomstick", "tunnel", "thief", "solve", "a must"]} />
      </Abs>
      <At box={[0.07, 0.1, 0.45, 0.11]}>
        <Section name="Reading" icon="📖" mt={0} />
        <Ex n="1" mt={0}>
          <Text style={{ color: RED }}>Over to you:</Text> Do you like video games? Which ones do you play? Tell the class.
        </Ex>
        <Ex n="2" listen mt={1}>
          Look at the pictures and the title. What are the texts about? Listen, read and check.
        </Ex>
      </At>
      <At box={[0.04, 0.215, 0.92, 0.39]}>
        <View style={{ backgroundColor: "#E1BEE7", borderRadius: 16, borderWidth: 4, borderColor: "#BA68C8", height: 0.39 * H }} />
      </At>
      <Area box={[0.07, 0.225, 0.4, 0.13]} src={A.gameLeft} r={8} />
      <Area box={[0.53, 0.12, 0.44, 0.23]} src={A.gameRight} fit="contain" />
      <At box={[0.07, 0.36, 0.42, 0.24]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 22, color: "#4527A0", transform: "rotate(-3deg)" }}>GAME ON!</Text>
        <Text style={t(10, 700, "#4527A0")}>Do you love adventure? Are you good at puzzles? Then these two games are for you!</Text>
      </At>
      <At box={[0.53, 0.36, 0.41, 0.07]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 14, color: "#4527A0" }}>Star Rider</Text>
      </At>
      <At box={[0.07, 0.44, 0.88, 0.17]}>
        <Text style={t(10)}>
          <B c="#4527A0">Star Rider: </B>Your <B>mission</B>: find the lost crystals and save the planet Zorna! Captain Nova flies her spaceship through dangerous asteroid fields and fights space <B>pirates</B>. You can <B>explore</B> twelve planets, collect power stars and build your own space station. Watch out for the pirates&apos; traps! It&apos;s fast, funny and full of surprises.
        </Text>
        <Text style={{ ...t(10), marginTop: 4 }}>
          <B c="#4527A0">Spellbound Academy: </B>You are a new student at a school for young wizards. Learn spells, make a magic <B>potion</B> and fly on a broomstick over the castle. But someone is stealing the school&apos;s magic books! <B>Solve</B> puzzles, explore secret <B>tunnels</B> and catch the thief before the end of term. A must for fans of fantasy stories!
        </Text>
      </At>
      <At box={[0.07, 0.62, 0.42, 0.3]}>
        <Ex n="3" mt={0}>Match the words in bold in the texts with their definitions.</Ex>
        <Items
          rowGap={2}
          items={[
            <Text key="1" style={t()}>people who rob ships   {g2("pirates")}</Text>,
            `look around a new place  ________`,
            `ways under the ground  ________`,
            `a magic drink  ________`,
            `a job that a hero has to do  ________`,
            `find the answer to  ________`,
          ]}
        />
      </At>
      <At box={[0.52, 0.62, 0.44, 0.3]}>
        <Ex n="4" mt={0}>a) Read the texts again and complete.</Ex>
        <View style={{ marginLeft: 15, borderWidth: 1, borderColor: "#B39DDB", borderRadius: 6, overflow: "hidden" }}>
          {[
            ["Name", "Star Rider", "Spellbound ..."],
            ["Hero", "Captain Nova", ""],
            ["Story", "find the lost crystals", ""],
            ["You can", "", "learn spells"],
          ].map((row, r) => (
            <View key={r} style={{ flexDirection: "row", backgroundColor: r === 0 ? "#EDE7F6" : "#fff", borderTopWidth: r ? 0.6 : 0, borderColor: "#D1C4E9" }}>
              {row.map((c, k) => (
                <Text key={k} style={{ ...t(9.2, r === 0 || k === 0 ? 700 : 400, r === 0 && k ? "#4527A0" : INK), width: k ? "38%" : "24%", padding: 2.5, borderLeftWidth: k ? 0.6 : 0, borderColor: "#D1C4E9" }}>
                  {c || "..."}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <Sub>b) Now, choose a video game and tell the class.</Sub>
        <Text style={{ ...it(), marginLeft: 15 }}>&apos;Star Rider&apos; is a space game. The hero is ...</Text>
      </At>
    </BookPage>
  );
}

function P17() {
  const sb = SB([0.07, 0.3, 0.39, 0.3]);
  return (
    <BookPage n={17} refs="1d">
      <At box={[0.07, 0.055, 0.41, 0.25]}>
        <Section name="Grammar" sub="-ing form" icon="✏️" mt={0} />
        <GrammarBox
          examples={[<Text key="1">I {g("love playing")} video games.</Text>, <Text key="2">Zoe {g("enjoys drawing")} comics.</Text>, <Text key="3">Kenji {g("doesn't mind setting")} the table.</Text>]}
          notes={[<Text key="n">We use the <B>-ing form</B> after: <B>like, love, enjoy, hate, can&apos;t stand, don&apos;t mind, be crazy about</B>.</Text>]}
        />
        <Ex n="5">
          What do you like doing in your free time? Talk with your friend. Use: <Text style={{ color: BLUE }}>play video games, take photos, read comics, bake cakes</Text>.
        </Ex>
      </At>
      <Area box={[0.07, 0.3, 0.39, 0.3]} src={A.likeScale} fit="contain" pad={0}>
        {["I'm crazy about ...", "I (really) like ...", "I don't mind ...", "I don't (really) like ...", "I can't stand ..."].map((x, i) => {
          const imgH = Math.min(sb.h, sb.w * (590 / 760));
          const k = imgH / 590;
          const y0 = (sb.h - imgH) / 2;
          const len = 640 - i * 90;
          return (
            <Text key={x} style={{ position: "absolute", left: (110 + len - 250) * k, top: y0 + (i * 118 + 46) * k, width: 230 * k, ...t(8.2, 700), textAlign: "center" }}>
              {x}
            </Text>
          );
        })}
      </Area>
      <At box={[0.07, 0.565, 0.41, 0.045]}>
        <Ex n="6" mt={0}>Join the sentences.</Ex>
      </At>
      <Area box={[0.03, 0.61, 0.46, 0.27]} src={A.tipPanel} pad={[10, 10, 6, 26]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 12, color: "#fff", backgroundColor: GREEN, alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 5, marginBottom: 2 }}>Writing Tip</Text>
        <Text style={t(9.2)}>I like Star Rider. I like Robo Racers, too. → I like Star Rider <B c={BLUE}>and</B> Robo Racers.</Text>
        <Text style={{ ...t(9.2), marginBottom: 3 }}>• <B>and</B> joins similar ideas, <B>but</B> joins different ideas.</Text>
        <Items
          ml={0}
          rowGap={0.5}
          size={9.4}
          items={["I've got a skateboard. I've got a helmet, too.", "Zoe likes jazz. She doesn't like rap.", "I can play chess. I can't play cards.", "Sam loves swimming. He hates running.", "In Star Rider you can fly. You can build a station, too."]}
        />
      </Area>
      <At box={[0.52, 0.055, 0.45, 0.035]}>
        <Section name="Listening and Speaking" icon="🎧" mt={0} />
      </At>
      <Area box={[0.5, 0.09, 0.48, 0.45]} src={A.boysVivid} r={10} pos="50% 40%" pad={[0.45 * H * 0.42, 8, 8, 8]}>
        <View style={{ backgroundColor: "#E3F2FDee", borderRadius: 8, padding: 5 }}>
          <View style={{ flexDirection: "row" }}>
            <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 14, color: RED, width: 15, lineHeight: 1 }}>7</Text>
            <Text style={{ ...t(10, 700), flex: 1, paddingTop: 1 }}>Listen to Ben and Max talking about a computer game and write <Text style={{ fontFamily: "Sym" }}>✗</Text> in the right box.</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Text style={{ ...t(8.8, 700), width: 30, textAlign: "center" }}>YES</Text>
            <Text style={{ ...t(8.8, 700), width: 30, textAlign: "center" }}>NO</Text>
          </View>
          <Items
            ml={0}
            rowGap={1}
            items={["The game is called Robo Racers.", "You build your own robots.", "Players race on the Moon.", "The game costs £50."].map((s) => (
              <View key={s} style={{ flexDirection: "row" }}>
                <Text style={{ ...t(), flex: 1 }}>{s}</Text>
                <View style={{ width: 30, alignItems: "center" }}>
                  <Box />
                </View>
                <View style={{ width: 30, alignItems: "center" }}>
                  <Box />
                </View>
              </View>
            ))}
          />
        </View>
      </Area>
      <At box={[0.52, 0.55, 0.45, 0.15]}>
        <Ex n="8" mt={0} tag={<Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 10, color: "#fff", backgroundColor: ORANGE, paddingHorizontal: 4, marginRight: 4, borderRadius: 2 }}>THINK</Text>}>
          Think of a video game you want to buy and talk with your friend about:
        </Ex>
        <View style={{ marginLeft: 22, flexDirection: "row", flexWrap: "wrap" }}>
          {["the name", "the story", "the characters", "what players can do"].map((x) => (
            <Text key={x} style={{ ...t(), width: "50%" }}>
              • {x}
            </Text>
          ))}
        </View>
        <Section name="Writing" icon="📝" mt={3} />
        <Ex n="9" mt={0}>Write an email to your friend about your favourite video game.</Ex>
      </At>
      <Area box={[0.49, 0.7, 0.45, 0.25]} src={A.emailWin17} pad={[22, 12, 6, 12]}>
        <Text style={{ ...t(9.6), fontFamily: "Andika" }}>
          Dear ...,{"\n"}My favourite video game is ... The characters in the game are ... They ... This video game is really exciting! Players can ...{"\n"}What&apos;s your favourite video game? Write and tell me.{"\n"}Talk to you soon,{"\n"}...
        </Text>
      </Area>
    </BookPage>
  );
}

// --- Skills Practice (source pp.20-21) -----------------------------------------
function VocabBank({ title, color, words, cols = 2 }: { title: string; color: string; words: string[]; cols?: number }) {
  return (
    <View style={{ marginBottom: 5 }}>
      <Text style={{ ...t(9.6, 700, "#fff"), backgroundColor: color, alignSelf: "flex-start", borderTopLeftRadius: 6, borderTopRightRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>{title}</Text>
      <View style={{ backgroundColor: color + "22", borderTopRightRadius: 6, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, padding: 4, flexDirection: "row", flexWrap: "wrap" }}>
        {words.map((w) => (
          <Text key={w} style={{ ...t(9.2, 700), width: `${100 / cols}%` }}>
            {w}
          </Text>
        ))}
      </View>
    </View>
  );
}
function ExamTipArea({ box, src, title, sub, body }: { box: FBox; src: Src; title: string; sub: string; body: string }) {
  return (
    <Area box={box} src={src} pad={[8, 10, 6, 12]}>
      <Text style={{ position: "absolute", right: 0, top: -6, fontFamily: "Baloo", fontWeight: 700, fontSize: 13, color: "#fff", backgroundColor: "#7E57C2", borderRadius: 5, paddingHorizontal: 6 }}>Exam TIP</Text>
      <Text style={t(9, 700)}>
        {title} ({sub})
      </Text>
      <Text style={t(9)}>{body}</Text>
    </Area>
  );
}

function P18() {
  const items: [Src, string, FBox][] = [
    [art.img("1c-cards-5"), "1", [0.46, 0.475, 0.1, 0.07]],
    [art.img("1c-cards-7"), "2", [0.59, 0.53, 0.1, 0.07]],
    [art.img("d-games-3"), "3", [0.7, 0.47, 0.1, 0.07]],
    [art.img("1c-cards-1"), "4", [0.8, 0.54, 0.1, 0.07]],
  ];
  return (
    <BookPage n={18}>
      <View style={{ width: 0.4 * W - ML }}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 20, color: "#fff", backgroundColor: RED, alignSelf: "flex-start", paddingHorizontal: 12, borderBottomRightRadius: 12, marginLeft: -ML, paddingLeft: ML, marginTop: -8, marginBottom: 6 }}>SKILLS PRACTICE</Text>
        <Text style={{ ...t(10.5, 700, "#fff"), backgroundColor: RED, alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 8, marginBottom: 5 }}>Vocabulary Bank</Text>
        <VocabBank title="Things in a room" color="#E53935" words={["wardrobe", "desk lamp", "rug", "beanbag", "bookcase", "curtains"]} />
        <VocabBank title="Household chores" color="#00897B" words={["do the laundry", "load the dishwasher", "take out the rubbish", "water the plants", "set the table", "vacuum the floor"]} cols={1} />
        <VocabBank title="Free-time activities" color="#8E24AA" words={["go skateboarding", "play video games", "bake cakes", "draw comics", "take photos", "go swimming", "play the guitar", "play football"]} cols={1} />
        <VocabBank title="Personality adjectives" color="#1E88E5" words={["creative", "sporty", "sociable", "patient", "shy", "friendly"]} />
        <VocabBank title="Other" color="#FB8C00" words={["decorate", "carry", "unpack", "costume", "mission", "explore", "potion", "tunnel"]} />
        <VocabBank title="Useful phrases" color="#E91E63" cols={1} words={["It looks amazing!", "Who's hungry?", "Are you free on ...?", "Count me in!", "Sure, why not! / I'd love to.", "How often do you ...?", "I'm crazy about ...", "I can't stand ..."]} />
      </View>
      <At box={[0.44, 0.04, 0.53, 0.18]}>
        <Section name="Listening Comprehension" icon="🎧" mt={0} />
        <Text style={{ ...t(10.5, 700), marginBottom: 2 }}>Before listening</Text>
        <Items ml={4} items={["What furniture is there in your bedroom?", "What do you usually do after school?", "Which chores do you do at home? Which do you hate?"]} />
      </At>
      <ExamTipArea box={[0.42, 0.22, 0.51, 0.12]} src={A.examTip18} title="Identifying location" sub="Multiple matching" body="Look at the items and the places in the picture. Say their names in English. Be careful! One place in the picture is extra." />
      <At box={[0.44, 0.35, 0.52, 0.11]}>
        <Ex n="1" listen mt={0}>
          You will hear a dialogue twice. Match each item (1-4) with its place (A-E) in the picture. Write the letter in the box. One place is extra.
        </Ex>
      </At>
      {items.map(([s, n, box]) => (
        <React.Fragment key={n}>
          <Area box={box} src={s} fit="contain" />
          <At box={[box[0] + 0.02, box[1] + box[3], 0.08, 0.03]}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={t(10, 700)}>{n}. </Text>
              <Box s={15} />
            </View>
          </At>
        </React.Fragment>
      ))}
      <Area box={[0.45, 0.66, 0.45, 0.29]} src={A.scene1a} r={10}>
        {[
          ["A", 0.1, 0.75],
          ["B", 0.35, 0.15],
          ["C", 0.5, 0.6],
          ["D", 0.62, 0.1],
          ["E", 0.82, 0.62],
        ].map(([L, x, y]) => (
          <Text key={L as string} style={{ position: "absolute", left: (x as number) * 0.45 * W, top: (y as number) * 0.29 * H, ...t(11, 700, "#fff"), backgroundColor: RED, borderRadius: 3, paddingHorizontal: 4 }}>
            {L as string}
          </Text>
        ))}
      </Area>
    </BookPage>
  );
}

function P19() {
  const cb = SB([0.06, 0.12, 0.4, 0.5]);
  return (
    <BookPage n={19}>
      <At box={[0.07, 0.055, 0.38, 0.065]}>
        <Section name="Knowledge of Language Functions" icon="💬" mt={0} />
        <Ex n="2" mt={0}>Fill in each conversation with the missing line. Write A, B or C.</Ex>
      </At>
      <Area box={[0.06, 0.12, 0.4, 0.5]} src={A.talkBlock} pad={0}>
        {[
          ["When is the party?", ["On Friday evening.", "It's a space party.", "Count me in!"]],
          ["Do you want to come skating?", ["Of course you can.", "Sure, why not?", "I'm skating now."]],
          ["How often do you play chess?", ["It's great!", "Yes, I do.", "Hardly ever."]],
        ].map(([q, os], i) => (
          <View key={i} style={{ position: "absolute", left: cb.w * 0.3, top: (i * cb.h) / 3 + 10, width: cb.w * 0.66 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
              <Text style={{ ...t(9.6), fontFamily: "Andika", backgroundColor: "#fff", borderWidth: 1, borderColor: INK, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, flex: 1 }}>{q as string}</Text>
              <Text style={{ ...t(10, 700), marginLeft: 4 }}>{i + 1}. </Text>
              <Box s={15} />
            </View>
            {(os as string[]).map((o, k) => (
              <Text key={o} style={t(9.4)}>
                <B>{"ABC"[k]}.</B> {o}
              </Text>
            ))}
          </View>
        ))}
      </Area>
      <At box={[0.07, 0.63, 0.38, 0.3]}>
        <Section name="Knowledge of Language Means" icon="🔤" mt={0} />
        <Ex n="3" mt={0}>
          Read the text. Out of the words in the box, choose the ones which fill gaps 1-3. Write the letter (A-F) next to each gap number. Three words are extra.
        </Ex>
        <View style={{ marginLeft: 15, flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: "#B0BEC5", borderRadius: 4, padding: 3, marginVertical: 3 }}>
          {["A. at", "B. enjoy", "C. on", "D. mind", "E. in", "F. hate"].map((x) => (
            <Text key={x} style={{ ...t(9.6), width: "33%" }}>
              {x}
            </Text>
          ))}
        </View>
        <Text style={{ ...t(9.6), marginLeft: 15 }}>
          My name is Daniel and I&apos;m thirteen. I live <B>1.</B> ____ a small flat in Leeds with my mum and my sister. I really <B>2.</B> ____ playing basketball, and I don&apos;t <B>3.</B> ____ helping at home.
        </Text>
      </At>
      <At box={[0.5, 0.055, 0.45, 0.04]}>
        <Section name="Reading Comprehension" icon="📖" mt={0} />
      </At>
      <ExamTipArea box={[0.49, 0.105, 0.42, 0.12]} src={A.examTip19} title="Identifying specific information" sub="Multiple choice" body="Read the questions first. Then read the text and find the answers. All the options are in the text." />
      <At box={[0.5, 0.2, 0.45, 0.045]}>
        <Ex n="4" mt={0}>
          Read the text. Choose the correct answer. Write <Text style={{ fontFamily: "Sym" }}>✗</Text> in the box next to A, B or C.
        </Ex>
      </At>
      <Area box={[0.48, 0.25, 0.43, 0.37]} src={A.emailWin19} pad={[20, 10, 6, 12]}>
        {["To: maya.reads@mailbox.com", "From: kai.jones@mailbox.com", "Subject: Hi from Kai!"].map((h) => (
          <Text key={h} style={{ ...t(9), borderBottomWidth: 0.5, borderColor: "#CFD8DC", marginBottom: 1 }}>
            {h}
          </Text>
        ))}
        <Text style={t(9.4)}>
          Hi Maya,{"\n"}Thanks for your email. I&apos;m eleven, not twelve like you! I love music and I play the drums in a band with my friends. I&apos;m also crazy about cooking - I make pancakes every Sunday. My parents are having a barbecue on Saturday and they want us to help in the garden. My sister is watering the plants right now and I&apos;m cutting the grass. Do you help at home?{"\n"}Write back, Kai
        </Text>
      </Area>
      <At box={[0.5, 0.63, 0.46, 0.3]}>
        <Items
          rowGap={4}
          items={[
            ["How old is Kai?", ["10", "11", "12"], null],
            ["What does Kai play?", ["🥁", "⚽", "🎮"], 1],
            ["What is Kai doing now?", ["🌱", "🍳", "🧹"], 1],
          ].map(([q, os, isEmoji]) => (
            <View key={q as string}>
              <Text style={t()}>{q as string}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 2 }}>
                {(os as string[]).map((o, k) => (
                  <View key={o} style={{ alignItems: "center", flexDirection: "row" }}>
                    {isEmoji ? <Ico e={o} s={40} /> : <Pic src={A.ageBadges[k]} w={44} h={30} fit="contain" r={0} />}
                    <Text style={{ ...t(9.6, 700), marginLeft: 3 }}>{"ABC"[k]}. </Text>
                    <Box s={14} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        />
      </At>
    </BookPage>
  );
}

// --- Bolt the Robot (comic, source p.22) and Fun Time (p.23) --------------------
function P20() {
  const box: FBox = [0.175, 0.02, 0.65, 0.92];
  const b = SB(box);
  const pw = b.w / 2;
  const ph = b.h / 3;
  const panels: { n: number; bubbles: { dx: number; dy: number; w: number; text: string; tail?: "bl" | "br" | "tl" | "tr" }[] }[] = [
    { n: 1, bubbles: [{ dx: 0.3, dy: 0.16, w: 0.6, text: "Bolt, you're always on that sofa! Why don't you find a hobby?", tail: "br" }, { dx: 0.04, dy: 0.66, w: 0.42, text: "But I'm bored ... and tired.", tail: "tr" }] },
    { n: 2, bubbles: [{ dx: 0.04, dy: 0.04, w: 0.5, text: "Basketball? That's easy!", tail: "bl" }, { dx: 0.5, dy: 0.72, w: 0.46, text: "Oops! I missed again.", tail: "tl" }] },
    { n: 3, bubbles: [{ dx: 0.3, dy: 0.04, w: 0.66, text: "Bolt! What are you doing? That's my best paint!", tail: "bl" }, { dx: 0.6, dy: 0.74, w: 0.36, text: "It's modern art!", tail: "tl" }] },
    { n: 4, bubbles: [{ dx: 0.04, dy: 0.04, w: 0.56, text: "Cooking is fun ... Hey, what's that smell?", tail: "bl" }] },
    { n: 5, bubbles: [{ dx: 0.24, dy: 0.04, w: 0.72, text: "Look! They're dancing. They look so happy.", tail: "bl" }] },
    { n: 6, bubbles: [{ dx: 0.04, dy: 0.06, w: 0.5, text: "Come in, Bolt! You're a great dancer!", tail: "br" }, { dx: 0.56, dy: 0.66, w: 0.4, text: "At last - a hobby I love!", tail: "tl" }] },
  ];
  return (
    <BookPage n={20} strip={false}>
      <Area box={box} src={A.comic} r={4} pos="50% 50%" />
      {panels.map((p) => {
        const px = b.l + ((p.n - 1) % 2) * pw;
        const py = b.tp + Math.floor((p.n - 1) / 2) * ph;
        return (
          <React.Fragment key={p.n}>
            <View style={{ position: "absolute", left: px + 6, top: py + ph - 30, width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", borderWidth: 1.5, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
              <Text style={t(BODY, 700)}>{p.n}</Text>
            </View>
            {p.bubbles.map((bb, i) => (
              <Bubble key={i} l={px + bb.dx * pw} tp={py + bb.dy * ph + (p.n <= 2 ? 34 : 0)} w={bb.w * pw} tail={bb.tail}>
                {bb.text}
              </Bubble>
            ))}
          </React.Fragment>
        );
      })}
      <At box={[0.19, 0.03, 0.6, 0.05]}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#ffffffdd", borderRadius: 10, paddingHorizontal: 8, width: 250 }}>
          <Ico e="🤖" s={30} />
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 28, color: "#1565C0", marginLeft: 6 }}>Bolt the Robot</Text>
        </View>
      </At>
      <At box={[0.19, 0.085, 0.3, 0.03]}>
        <View style={{ backgroundColor: "#fff", borderRadius: 6, paddingHorizontal: 4, width: 150 }}>
          <Ex n="1" listen mt={0}>
            a) Listen and read.
          </Ex>
        </View>
      </At>
      <At box={[0.55, 0.935, 0.4, 0.03]}>
        <Text style={{ ...t(10.5, 700, RED), textAlign: "right" }}>b) Now, take roles and read again.</Text>
      </At>
    </BookPage>
  );
}

function P21() {
  const inventions: [number, string, string][] = [
    [0, "Mop ppsrleis", "Clean the floor while you walk around the house!"],
    [1, "An mbrlelua hat", "Keep your head dry and your hands free on rainy days."],
    [2, "A singing hottbhsuro", "It plays your favourite song for two minutes - the perfect time to brush!"],
  ];
  const ib = SB([0.05, 0.14, 0.43, 0.48]);
  return (
    <BookPage n={21} bg="#FCF389">
      <Abs l={0.55 * W - ML} tp={-TOP} w={W - 0.55 * W} h={H}>
        <View style={{ flex: 1, backgroundColor: "#3B2C85" }} />
      </Abs>
      <At box={[0.06, 0.035, 0.44, 0.1]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 17, color: "#E53935" }}>CRAZY BUT TRUE? HOME INVENTIONS!</Text>
        <Text style={t(11, 700, PURPLE)}>What are they? Unscramble the words and find out!</Text>
      </At>
      <Area box={[0.05, 0.14, 0.43, 0.48]} src={A.inventions} pad={0}>
        {inventions.map(([i, w, s]) => (
          <View key={i} style={{ position: "absolute", left: i % 2 ? 6 : ib.w * 0.4, top: (i * ib.h) / 3 + 18, width: ib.w * 0.56, backgroundColor: "#ffffffee", borderRadius: 10, padding: 5 }}>
            <Text style={t(9.6)}>
              <B c={RED}>{i + 1} </B>
              <B>{w}</B>: {s}
            </Text>
          </View>
        ))}
      </Area>
      <Area box={[0.11, 0.63, 0.39, 0.25]} src={A.joke} pad={[10, 10, 10, 0.39 * W * 0.36]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 22, color: GREEN }}>Ha ha ha!</Text>
        <Text style={{ ...t(10.4), fontFamily: "Andika" }}>
          <B>Q:</B> What has lots of keys but can&apos;t open a single door?{"\n"}
          <B>A:</B> A piano!
        </Text>
      </Area>
      <Area box={[0.73, 0.12, 0.25, 0.11]} src={A.funBadge} fit="contain" />
      <At box={[0.58, 0.23, 0.4, 0.42]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 24, color: "#fff", lineHeight: 1 }}>I Want a</Text>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 40, color: "#FFEB3B", lineHeight: 1, marginBottom: 6 }}>HERO</Text>
        {[
          "I want a hero,\nSomeone brave and true,\nSomeone who can help me\nWhen I'm feeling blue.",
          "She's quick and she's clever,\nShe never runs away,\nShe flies above the city\nTo save another day!",
          "She's kind and she's funny,\nShe's always there for me,\nMy hero is my best friend,\nAs cool as cool can be!",
        ].map((v, i) => (
          <Text key={i} style={{ ...t(10.4, 700, "#FFF59D"), marginBottom: 5, marginLeft: i === 1 ? 24 : 0 }}>
            {v}
          </Text>
        ))}
      </At>
      <At box={[0.58, 0.66, 0.24, 0.27]}>
        <Items
          ml={0}
          numColor="#FFEB3B"
          rowGap={4}
          items={[
            <Text key="1" style={t(10.4, 700, "#fff")}>Listen to the song. What&apos;s the singer&apos;s hero like?</Text>,
            <Text key="2" style={t(10.4, 700, "#fff")}>
              <Text style={{ color: ORANGE }}>THINK </Text>What&apos;s your hero like? Write your own version. Read it to the class.
            </Text>,
          ]}
        />
      </At>
      <Area box={[0.8, 0.62, 0.18, 0.33]} src={A.fun[3]} fit="contain" />
    </BookPage>
  );
}

// --- Modular Revision 1 (source pp.24-25) ---------------------------------------
const Marks = ({ n, total }: { n?: number; total: number }) => (
  <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 1, marginBottom: 3 }}>
    <View style={{ width: 22, height: 15, borderWidth: 1, borderColor: "#90A4AE" }} />
    <Text style={{ ...t(9.6, 700), width: 22, textAlign: "center", borderWidth: 1, borderLeftWidth: 0, borderColor: "#90A4AE" }}>{n ?? total}</Text>
  </View>
);

function P22() {
  return (
    <BookPage n={22}>
      <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 24, color: "#fff", backgroundColor: RED, marginLeft: -ML, marginRight: -MR, marginTop: -TOP, paddingLeft: ML, paddingTop: 10, paddingBottom: 4, marginBottom: 8 }}>Modular Revision 1</Text>
      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: COL }}>
          <Section name="Vocabulary" icon="🔤" mt={0} />
          <Ex n="1">Read and complete the sentences. (10 marks)</Ex>
          <WordBox words={["baking", "sleepover", "takes", "comics", "rubbish", "curtains"]} color={RED} />
          <Items
            start={0}
            rowGap={1.5}
            items={[
              <Text key="0" style={t()}>I love {g2("baking")} cakes with my grandma.</Text>,
              `Can you take out the ${GAPLINE}, please?`,
              `Zoe ${GAPLINE} photos of her cat every day.`,
              `I'm going to a ${GAPLINE} at Lily's on Friday.`,
              `Kenji reads ${GAPLINE} in bed.`,
              `Please close the ${GAPLINE}. It's dark outside.`,
            ]}
          />
          <Marks total={10} />
          <Section name="Grammar" icon="✏️" mt={0} />
          <Ex n="2">Write sentences. (10 marks)</Ex>
          <Items
            start={0}
            rowGap={0.5}
            items={[
              <View key="0">
                <Text style={t()}>never/Zoe/late/is</Text>
                <Text style={t(10, 700, BLUE)}>Zoe is never late.</Text>
              </View>,
              ...["usually/Sam/at 7/gets up", "often/we/to the park/go", "always/Lily/her room/tidies", "hardly ever/Kenji/TV/watches", "sometimes/they/pizza/have"].map((s) => (
                <View key={s}>
                  <Text style={t()}>{s}</Text>
                  <View style={{ height: 9, borderBottomWidth: 0.8, borderColor: "#9E9E9E", marginBottom: 2 }} />
                </View>
              )),
            ]}
          />
          <Marks total={10} />
          <Ex n="3" mt={0}>Read and underline. (10 marks)</Ex>
          <Items
            start={0}
            rowGap={0}
            size={9.6}
            items={[
              <Text key="0" style={t(9.6)}>Kenji <Text style={{ textDecoration: "underline" }}>usually plays</Text>/is playing football on Saturdays.</Text>,
              "Listen! The baby cries/is crying.",
              "We visit/are visiting Grandma tomorrow.",
              "Do you go/Are you going to bed at ten every night?",
              "Lily doesn't like/isn't liking cold weather.",
              "Look! Sam takes/is taking a photo of us.",
              "What do you do/are you doing tonight?",
              "My dad works/is working in a bank.",
              "Shh! I talk/am talking on the phone.",
              "How often does she go/is she going swimming?",
              "They have/are having a picnic next Sunday.",
            ]}
          />
          <Marks total={10} />
        </View>
        <View style={{ width: COL }}>
          <Section name="Knowledge of Language Means" icon="🔤" mt={0} />
          <Ex n="4">
            In sentences 1-3, choose the answer which matches the picture. Write <Text style={{ fontFamily: "Sym" }}>✗</Text> in the box next to A, B or C. (15 marks)
          </Ex>
        </View>
      </View>
      <Area box={[0.57, 0.22, 0.36, 0.36]} src={A.scene1b} r={10} pos="62% 50%" />
      <At box={[0.53, 0.6, 0.42, 0.33]}>
        <Items
          rowGap={5}
          items={[
            ["The girl is", ["vacuuming the rug.", "setting the table.", "watering the plants."]],
            ["The grandma is", ["cooking dinner.", "watering the plants.", "reading a book."]],
            ["The cat is", ["sleeping on the sofa.", "playing with a ball.", "eating its food."]],
          ].map(([q, os]) => (
            <View key={q as string}>
              <Text style={t()}>{q as string}</Text>
              {(os as string[]).map((o, k) => (
                <View key={o} style={{ flexDirection: "row", justifyContent: "space-between", width: 200 }}>
                  <Text style={t()}>
                    <B>{"ABC"[k]}.</B> {o}
                  </Text>
                  <Box />
                </View>
              ))}
            </View>
          ))}
        />
        <Marks total={15} />
      </At>
    </BookPage>
  );
}

function P23() {
  return (
    <BookPage n={23}>
      <View style={{ flexDirection: "row", gap: GAP, marginTop: 18 }}>
        <View style={{ width: COL }}>
          <Section name="Knowledge of Language Functions" icon="💬" mt={0} />
          <Ex n="5">Read and choose. (15 marks)</Ex>
          <Items
            start={0}
            rowGap={1.5}
            items={[
              ["Can I borrow your pencil?", "Sure, here you are.", "No, I'm fine."],
              ["Hi, I'm Lucas.", "That's right.", "Nice to meet you."],
              ["Are you free on Friday?", "I'd love to.", "Yes, why?"],
              ["How often do you go swimming?", "Twice a week.", "Next Monday."],
              ["Do you want to come to my party?", "Count me in!", "I'm at a party."],
              ["Thanks for your help!", "You're welcome.", "Same to you."],
            ].map(([a, x, y], i) => (
              <View key={a}>
                <Text style={t()}>
                  <B>A:</B> {a}
                </Text>
                <Text style={t()}>
                  <B>B:</B> <B c={RED}>a)</B> {i === 0 ? <Text style={{ textDecoration: "underline" }}>{x}</Text> : x}   <B c={RED}>b)</B> {y}
                </Text>
              </View>
            ))}
          />
          <Marks total={15} />
          <Section name="Listening Comprehension" icon="🎧" mt={0} />
          <Ex n="6" listen>
            On the basis of the dialogue, decide if the sentences are true or false. Circle <Text style={{ color: BLUE }}>True</Text> or <Text style={{ color: RED }}>False</Text>. (10 marks)
          </Ex>
          <Items
            start={0}
            rowGap={1}
            items={["The party is for Zoe's birthday.", "The party is on Saturday.", "It starts at 7 o'clock.", "It's at 12 Park Road.", "It's a pirate party.", "Kenji can't go to the party."].map((s) => (
              <View key={s} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={t()}>{s}</Text>
                <Text style={t(9.6, 700)}>True / False</Text>
              </View>
            ))}
          />
          <Marks total={10} />
        </View>
        <View style={{ width: COL }}>
          <Section name="Reading Comprehension" icon="📖" mt={0} />
          <Ex n="7">
            Read the email. Mark the sentences 1-5 <Text style={{ color: BLUE }}>T</Text> (True) or <Text style={{ color: RED }}>F</Text> (False). (10 marks)
          </Ex>
          <View style={{ marginLeft: 15, backgroundColor: "#E6E6E6", borderWidth: 1, borderColor: "#BDBDBD", borderRadius: 6, padding: 6, marginBottom: 4 }}>
            <Text style={t(9.4)}>
              Dear Tom,{"\n"}Hi! How are you? My name&apos;s Ana and I&apos;m twelve. I live in Recife, a big city by the sea in Brazil. I&apos;d like a penfriend because I want to practise my English.{"\n"}I&apos;m quite sporty. I go surfing every weekend and I play volleyball on the beach with my cousins. I&apos;m also crazy about video games - my favourite is Spellbound Academy. I&apos;m in the castle tunnels now, looking for the thief!{"\n"}What do you like doing in your free time? Write soon!{"\n"}Ana
            </Text>
          </View>
          <Items
            start={0}
            rowGap={0.5}
            items={["Ana lives in Brazil.", "Ana wants to practise her Spanish.", "Ana never goes surfing.", "Ana plays volleyball with her cousins.", "Ana doesn't like video games.", "Ana is playing Spellbound Academy now."].map((s, i) => (
              <View key={s} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={t()}>{s}</Text>
                <Text style={t(10, 700, BLUE)}>{i === 0 ? "T" : "____"}</Text>
              </View>
            ))}
          />
          <Marks total={10} />
        </View>
      </View>
      <View style={{ marginTop: 4 }}>
        <Section name="Writing" icon="📝" mt={0} />
        <Ex n="8">Read Kai&apos;s notes below. Then, use his notes to write an email to a new penfriend. (20 marks)</Ex>
        <View style={{ marginLeft: 15, backgroundColor: "#FFFBEA", borderWidth: 1, borderColor: "#E9C93D", borderRadius: 4, padding: 6, flexDirection: "row", flexWrap: "wrap" }}>
          {[
            ["Name & age:", "Kai, eleven years old"],
            ["Where you live:", "Cardiff, Wales"],
            ["Reasons for writing:", "find a penfriend, practise Spanish"],
            ["Free-time activities:", "play the drums, make pancakes, play basketball"],
            ["Favourite video game:", "Star Rider - an exciting space adventure where you find the lost crystals and save the planet"],
          ].map(([k, v], i) => (
            <Text key={k} style={{ ...t(9.4), fontFamily: "Andika", width: i === 4 ? "100%" : "50%" }}>
              <B>{k}</B> {v}
            </Text>
          ))}
        </View>
      </View>
      <At box={[0.55, 0.86, 0.4, 0.06]}>
        <Marks total={20} />
        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <Text style={{ ...t(10, 700), marginRight: 6 }}>Total</Text>
          <Text style={{ ...t(10, 700), width: 34, textAlign: "center", borderWidth: 1, borderColor: "#90A4AE" }}>100</Text>
        </View>
      </At>
      <Area box={[0.07, 0.8, 0.4, 0.12]} src={A.nowICanBox} pad={[0.12 * H * 0.36, 8, 4, 10]}>
        {["talk about things in my room", "describe actions happening now", "make arrangements and invite friends", "talk about free time and video games"].map((x) => (
          <Text key={x} style={t(9)}>
            <Text style={{ fontFamily: "Sym", color: RED }}>✓</Text> {x}
          </Text>
        ))}
      </Area>
    </BookPage>
  );
}

// =============================================================================
// WORKBOOK - Module 1 (four pages, an activity book's look)
// =============================================================================
const WB_BLUE = "#0277BD";
function WbPage({ n, code, title, children }: { n: number; code: string; title: string; children: React.ReactNode }) {
  return (
    <Page size={[W, H]} style={{ paddingTop: 66, paddingBottom: BOTTOM, paddingLeft: ML, paddingRight: MR, backgroundColor: "#fff" }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 48, backgroundColor: "#E1F5FE" }} />
      <View style={{ position: "absolute", top: 12, left: ML - 10, flexDirection: "row", alignItems: "center" }}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 22, color: "#fff", backgroundColor: WB_BLUE, borderRadius: 8, paddingHorizontal: 9 }}>{code}</Text>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 22, color: WB_BLUE, marginLeft: 8 }}>{title}</Text>
      </View>
      <Footer n={n} label="Module 1 · Workbook" />
      <View style={{ height: H - 66 - BOTTOM - 2 }} wrap={false}>{children}</View>
    </Page>
  );
}
function WbEx({ n, children, tag }: { n: string; children: React.ReactNode; tag?: string }) {
  return (
    <View style={{ flexDirection: "row", marginTop: 6, marginBottom: 3 }} wrap={false}>
      <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 14, color: WB_BLUE, width: 15, lineHeight: 1 }}>{n}</Text>
      {tag ? <Text style={{ ...t(8.6, 700, "#fff"), backgroundColor: ORANGE, borderRadius: 3, paddingHorizontal: 4, marginRight: 4, marginTop: 1.5, alignSelf: "flex-start" }}>{tag}</Text> : null}
      <Text style={{ ...t(10.5, 700), flex: 1, paddingTop: 1.2 }}>{children}</Text>
    </View>
  );
}
const Frame = ({ children, w }: { children: React.ReactNode; w?: number | string }) => (
  <View style={{ borderWidth: 1.2, borderColor: "#81D4FA", borderRadius: 10, padding: 10, marginBottom: 12, ...(w ? { width: w } : {}) }}>{children}</View>
);

const WS_GRID = [
  "WARDROBEKS",
  "QRUGLAMPHE",
  "CURTAINSBL",
  "ZBEANBAGOF",
  "DESKXTMNXP",
  "BOOKCASEMI",
  "PILLOWYQZC",
  "MIRRORJTVS",
];
function WordSearch() {
  return (
    <View style={{ borderWidth: 1.5, borderColor: WB_BLUE, borderRadius: 6, alignSelf: "flex-start", padding: 4 }}>
      {WS_GRID.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.split("").map((ch, c) => (
            <Text key={c} style={{ width: 17, height: 17, textAlign: "center", ...t(11, 700, "#37474F") }}>
              {ch}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function W1() {
  const cards = A.roomCards;
  const blanks = ["w _ _ d _ o _ e", "d _ s k   l _ _ p", "r _ g", "b _ _ n b _ g", "b _ o k c _ s e", "c _ r t _ _ n s"];
  return (
    <WbPage n={2} code="1a" title="Moving day">
      <WbEx n="1">Look and complete the words.</WbEx>
      <Frame>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {cards.map((c, i) => (
            <View key={i} style={{ alignItems: "center", width: 82 }}>
              <Pic src={c} w={72} h={64} fit="contain" r={0} />
              <Text style={t(10, 700, "#37474F")}>
                <Text style={{ color: WB_BLUE }}>{i + 1} </Text>
                {blanks[i]}
              </Text>
            </View>
          ))}
        </View>
      </Frame>
      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: COL }}>
          <WbEx n="2">Find six more things in a room.</WbEx>
          <Frame>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <WordSearch />
              <View style={{ flex: 1 }}>
                <Text style={t(9.6, 700, BLUE)}>wardrobe</Text>
                {Array.from({ length: 6 }, (_, i) => (
                  <View key={i} style={{ height: 17, borderBottomWidth: 0.8, borderColor: "#9E9E9E" }} />
                ))}
              </View>
            </View>
          </Frame>
          <WbEx n="3">Complete with the present continuous.</WbEx>
          <Frame>
            <Items
              ml={0}
              numColor={WB_BLUE}
              rowGap={4}
              items={[
                <Text key="1" style={t()}>Lily <Text style={{ color: BLUE, fontWeight: 700 }}>is painting</Text> (paint) the wardrobe.</Text>,
                `Sam ${GAPLINE} (carry) a big box.`,
                `Zoe and Kenji ${GAPLINE} (not/unpack).`,
                `${GAPLINE} (Mum/make) pizza?`,
                `I ${GAPLINE} (sit) on my new beanbag.`,
                `We ${GAPLINE} (put) up posters now.`,
              ]}
            />
          </Frame>
        </View>
        <View style={{ width: COL }}>
          <WbEx n="4">Look at the picture. What are they doing? Write.</WbEx>
          <Frame>
            <Pic src={A.scene1a} w="100%" h={150} r={6} />
            <Items
              ml={0}
              numColor={WB_BLUE}
              rowGap={4}
              items={["Lily", "Sam", "Zoe", "Kenji"].map((nm) => (
                <View key={nm} style={{ flexDirection: "row" }}>
                  <Text style={t()}>{nm} </Text>
                  <View style={{ flex: 1, borderBottomWidth: 0.8, borderColor: "#9E9E9E" }} />
                </View>
              ))}
            />
          </Frame>
          <WbEx n="5" tag="PORTFOLIO">
            Write about your room (40-50 words).
          </WbEx>
          <Frame>
            <Text style={it(9.6)}>My room is ... I&apos;ve got ... There is/are ... My favourite thing is ...</Text>
            <Lines n={7} ml={0} gap={19} />
          </Frame>
        </View>
      </View>
    </WbPage>
  );
}

function W2() {
  const chores = ["do the laundry", "load the dishwasher", "take out the rubbish", "water the plants", "set the table", "vacuum the floor"];
  const order = [3, 5, 0, 4, 1, 2];
  return (
    <WbPage n={3} code="1b" title="Party night!">
      <WbEx n="1">Match the pictures (1-6) to the chores (a-f).</WbEx>
      <Frame>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          {order.map((k, i) => (
            <View key={i} style={{ alignItems: "center", width: 82 }}>
              <Pic src={A.choreCards[k]} w={70} h={62} fit="contain" r={0} />
              <Text style={t(10, 700, WB_BLUE)}>{i + 1} ____</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {chores.map((c, i) => (
            <Text key={c} style={{ ...t(), width: "33%" }}>
              <B c={WB_BLUE}>{"abcdef"[i]}</B> {c}
            </Text>
          ))}
        </View>
      </Frame>
      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: COL }}>
          <WbEx n="2">Look at Zoe&apos;s diary. Write sentences about her arrangements.</WbEx>
          <Frame>
            {[
              ["Monday", "piano lesson at 5"],
              ["Wednesday", "visit Grandma"],
              ["Friday", "sleepover at Lily's"],
              ["Saturday", "ice skating with Kenji"],
              ["Sunday", "family picnic"],
            ].map(([d, a]) => (
              <View key={d} style={{ flexDirection: "row", borderBottomWidth: 0.6, borderColor: "#B3E5FC", paddingVertical: 1.5 }}>
                <Text style={{ ...t(9.6, 700, WB_BLUE), width: 70 }}>{d}</Text>
                <Text style={{ ...t(9.6), fontFamily: "Andika" }}>{a}</Text>
              </View>
            ))}
            <Items
              ml={0}
              numColor={WB_BLUE}
              rowGap={4}
              items={[
                <Text key="1" style={t()}>On Monday <Text style={{ color: BLUE, fontWeight: 700 }}>she&apos;s having a piano lesson at 5</Text>.</Text>,
                ...["On Wednesday", "On Friday", "On Saturday", "On Sunday"].map((d) => (
                  <View key={d} style={{ flexDirection: "row" }}>
                    <Text style={t()}>{d} </Text>
                    <View style={{ flex: 1, borderBottomWidth: 0.8, borderColor: "#9E9E9E" }} />
                  </View>
                )),
              ]}
            />
          </Frame>
          <WbEx n="3">Circle the correct word.</WbEx>
          <Frame>
            <Items
              ml={0}
              numColor={WB_BLUE}
              rowGap={3}
              items={["We're having / We have a party tomorrow.", "Dad is loading / loads the dishwasher now.", "Are you doing / Do you do anything tonight?", "The cat is sleeping / sleeps on the sofa right now."]}
            />
          </Frame>
        </View>
        <View style={{ width: COL }}>
          <WbEx n="4">Complete the dialogue with the phrases.</WbEx>
          <Frame>
            <WordBox ml={0} color={WB_BLUE} words={["Count me in", "Are you free", "Sorry, I can't", "Why don't you come"]} />
            <Dialogue
              nameW={40}
              lines={[
                ["Lily", <Text key="1">Hi, Sam! <B>1)</B> {GAPLINE} on Friday?</Text>],
                ["Sam", "I think so. Why?"],
                ["Lily", <Text key="2">I&apos;m having a sleepover. <B>2)</B> {GAPLINE} too?</Text>],
                ["Sam", <Text key="3"><B>3)</B> {GAPLINE}. I&apos;m visiting my aunt.</Text>],
                ["Lily", "Oh! What about a film on Saturday?"],
                ["Sam", <Text key="4">Great! <B>4)</B> {GAPLINE}!</Text>],
              ]}
            />
          </Frame>
          <WbEx n="5">Write an invitation to a theme party. Include:</WbEx>
          <Frame>
            <Text style={t(9.6)}>• the theme   • the day and time   • the place   • what to wear</Text>
            <View style={{ borderWidth: 1.5, borderColor: PINK, borderStyle: "dashed", borderRadius: 8, padding: 6, marginTop: 4 }}>
              <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 16, color: PINK, textAlign: "center" }}>You&apos;re invited!</Text>
              <Lines n={7} ml={0} gap={19} />
            </View>
          </Frame>
        </View>
      </View>
    </WbPage>
  );
}

// Crossword words cross on shared letters (checked by crosswordGrid).
const CROSSWORD: { w: string; r: number; c: number; down: boolean; n: number; card: number }[] = [
  { w: "PHOTOS", r: 0, c: 3, down: true, n: 1, card: 4 }, // camera
  { w: "GAMES", r: 2, c: 7, down: true, n: 2, card: 1 }, // controller
  { w: "GUITAR", r: 3, c: 0, down: false, n: 3, card: 6 }, // guitar
  { w: "SKATE", r: 5, c: 3, down: false, n: 4, card: 0 }, // skateboard
];
function crosswordGrid() {
  const grid = new Map<string, string>();
  for (const x of CROSSWORD) {
    x.w.split("").forEach((ch, i) => {
      const key = `${x.down ? x.r + i : x.r},${x.down ? x.c : x.c + i}`;
      if (grid.has(key) && grid.get(key) !== ch) throw new Error(`crossword clash at ${key}`);
      grid.set(key, ch);
    });
  }
  return grid;
}
function W3() {
  const grid = crosswordGrid();
  const set = CROSSWORD;
  const rows = 7;
  const cols = 8;
  const S = 30;
  return (
    <WbPage n={4} code="1c" title="Free-time fun">
      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: COL }}>
          <WbEx n="1">Look at the pictures and complete the crossword.</WbEx>
          <Frame>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <View>
                {Array.from({ length: rows }, (_, r) => (
                  <View key={r} style={{ flexDirection: "row" }}>
                    {Array.from({ length: cols }, (_, c) => {
                      const ch = grid.get(`${r},${c}`);
                      const start = set.find((x) => x.r === r && x.c === c);
                      return (
                        <View key={c} style={{ width: S, height: S, borderWidth: ch ? 0.8 : 0, borderColor: "#37474F", backgroundColor: ch ? "#fff" : "transparent", margin: -0.4 }}>
                          {start ? <Text style={{ fontFamily: "Noto", fontSize: 6, color: WB_BLUE, marginLeft: 1 }}>{start.n}</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
              {set.map((x) => (
                <View key={x.n} style={{ width: "33%", alignItems: "center", marginBottom: 3 }}>
                  <Pic src={A.hobbyCards[x.card]} w={46} h={42} fit="contain" r={0} />
                  <Text style={t(8.6, 700, WB_BLUE)}>
                    {x.n} {x.down ? "down" : "across"}
                  </Text>
                </View>
              ))}
            </View>
          </Frame>
          <WbEx n="2">Put the words in the correct order.</WbEx>
          <Frame>
            <Items
              ml={0}
              numColor={WB_BLUE}
              rowGap={2}
              items={["always / Zoe / comics / draws / after school", "is / Kenji / late / never", "often / you / do / swimming / go / ?", "hardly ever / we / pizza / eat"].map((s) => (
                <View key={s}>
                  <Text style={t()}>{s}</Text>
                  <View style={{ height: 11, borderBottomWidth: 0.8, borderColor: "#9E9E9E", marginBottom: 1 }} />
                </View>
              ))}
            />
          </Frame>
        </View>
        <View style={{ width: COL }}>
          <WbEx n="3">Complete with the present simple or the present continuous.</WbEx>
          <Frame>
            <Items
              ml={0}
              numColor={WB_BLUE}
              rowGap={4}
              items={[
                <Text key="1" style={t()}>Sam usually <Text style={{ color: BLUE, fontWeight: 700 }}>takes</Text> (take) the bus, but today he<Text style={{ color: BLUE, fontWeight: 700 }}>&apos;s walking</Text> (walk).</Text>,
                `Shh! The baby ${GAPLINE} (sleep).`,
                `Lily ${GAPLINE} (practise) the guitar every day.`,
                `What ${GAPLINE} (you/do) now?`,
                `My parents ${GAPLINE} (not/like) video games.`,
                `Look! Zoe ${GAPLINE} (dance) on the table!`,
              ]}
            />
          </Frame>
          <WbEx n="4">Read and answer about you.</WbEx>
          <Frame>
            <Items
              ml={0}
              numColor={WB_BLUE}
              rowGap={2}
              items={["How often do you go swimming?", "What do you usually do at the weekend?", "Are you creative or sporty? Why?", "What is your dream job?"].map((s) => (
                <View key={s}>
                  <Text style={t()}>{s}</Text>
                  <View style={{ height: 12, borderBottomWidth: 0.8, borderColor: "#9E9E9E", marginBottom: 1 }} />
                </View>
              ))}
            />
          </Frame>
          <WbEx n="5" tag="FUN">
            Find the odd one out.
          </WbEx>
          <Frame>
            <Items ml={0} numColor={WB_BLUE} items={["guitar  –  football  –  piano  –  drums", "always  –  often  –  usually  –  today", "sporty  –  sociable  –  bookcase  –  patient"]} />
          </Frame>
        </View>
      </View>
    </WbPage>
  );
}


function W4() {
  return (
    <WbPage n={5} code="1d" title="Skills work">
      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: COL }}>
          <WbEx n="1">Read the review and answer the questions.</WbEx>
          <Frame>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pic src={A.games[0]} w={70} h={84} fit="contain" r={0} />
              <Text style={{ ...t(9.6), flex: 1 }}>
                <B c={WB_BLUE}>Robo Racers</B> is a racing game for two players. You build a robot car and race it on the Moon! You can choose wheels, colours and engines, and you can win gold bolts to make your car faster. Watch out for the craters! It&apos;s great fun with a friend.
              </Text>
            </View>
          </Frame>
          <Frame>
            <Items
              ml={0}
              numColor={WB_BLUE}
              rowGap={2}
              items={["How many players can play?", "What do you build?", "Where do you race?", "What can you win?"].map((s) => (
                <View key={s}>
                  <Text style={t()}>{s}</Text>
                  <View style={{ height: 12, borderBottomWidth: 0.8, borderColor: "#9E9E9E", marginBottom: 1 }} />
                </View>
              ))}
            />
          </Frame>
          <WbEx n="2">Complete with the -ing form of the verbs.</WbEx>
          <Frame>
            <WordBox ml={0} color={WB_BLUE} words={["play", "read", "tidy", "swim", "bake"]} />
            <Items
              ml={0}
              numColor={WB_BLUE}
              rowGap={3}
              items={[
                <Text key="1" style={t()}>Kenji is crazy about <Text style={{ color: BLUE, fontWeight: 700 }}>playing</Text> video games.</Text>,
                `I can't stand ${GAPLINE} my room.`,
                `Zoe enjoys ${GAPLINE} in the sea.`,
                `Do you like ${GAPLINE} comics?`,
                `My dad doesn't mind ${GAPLINE} cakes.`,
              ]}
            />
          </Frame>
        </View>
        <View style={{ width: COL }}>
          <WbEx n="3">Join the sentences with and or but.</WbEx>
          <Frame>
            <Items
              ml={0}
              numColor={WB_BLUE}
              rowGap={2}
              items={["I like Star Rider. I like Robo Racers, too.", "Lily can skate. She can't swim.", "The game is fun. It's very expensive.", "Sam plays the drums. He sings, too."].map((s) => (
                <View key={s}>
                  <Text style={t()}>{s}</Text>
                  <View style={{ height: 12, borderBottomWidth: 0.8, borderColor: "#9E9E9E", marginBottom: 1 }} />
                </View>
              ))}
            />
          </Frame>
          <WbEx n="4" tag="PORTFOLIO">
            Write an email to a friend about a video game you like (50-60 words).
          </WbEx>
          <Frame>
            <Text style={it(9.6)}>Dear ..., My favourite video game is ... The hero is ... In the game you can ... I love it because ...</Text>
            <Lines n={16} ml={0} gap={20} />
          </Frame>
        </View>
      </View>
    </WbPage>
  );
}

// =============================================================================
// Covers, title page, contents (an original series: "Spark Up!", no logo)
// =============================================================================
const SERIES = "Spark Up!";
function CoverArt({ kind, band }: { kind: string; band: string }) {
  return (
    <Page size={[W, H]} style={{ backgroundColor: "#4FC3F7" }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={png(A.cover)} style={{ position: "absolute", top: 0, left: 0, width: W, height: H - 2, objectFit: "cover" }} />
      <View style={{ position: "absolute", top: 34, left: 36, right: 36 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 78, color: "#fff", lineHeight: 1 }}>{SERIES}</Text>
          <View style={{ width: 86, height: 86, borderRadius: 43, backgroundColor: RED, alignItems: "center", justifyContent: "center", marginLeft: 12, borderWidth: 5, borderColor: "#fff" }}>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 60, color: "#fff", lineHeight: 1, marginTop: 8 }}>2</Text>
          </View>
        </View>
        <Text style={{ fontFamily: "Baloo", fontWeight: 500, fontSize: 18, color: "#0D47A1", marginTop: 14 }}>English for teenagers · CEFR A2</Text>
        <View style={{ flexDirection: "row", marginTop: 12 }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 26, color: "#fff", backgroundColor: band, borderRadius: 12, paddingHorizontal: 16, paddingTop: 2 }}>{kind}</Text>
        </View>
      </View>
      <View style={{ position: "absolute", right: 30, top: 220, width: 74, height: 74, borderRadius: 37, backgroundColor: "#FFEB3B", alignItems: "center", justifyContent: "center", transform: "rotate(10deg)" }}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 30, color: RED, lineHeight: 1, marginTop: 6 }}>A2</Text>
      </View>
    </Page>
  );
}
const Cover = () => <CoverArt kind="Student's Book" band={RED} />;

// The group picture's size (pt) behind the character circles: a face about 70 pt across.
const FACE_SHEET = 300;
function Imprint() {
  return (
    <Page size={[W, H]} style={{ padding: 56, backgroundColor: "#fff" }}>
      <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 40, color: RED }}>{SERIES} 2</Text>
      <Text style={{ fontFamily: "Baloo", fontWeight: 500, fontSize: 20, color: INK, marginBottom: 30 }}>Student&apos;s Book · A2</Text>
      <Text style={t(10, 700)}>Hand-made reference edition</Text>
      <Text style={{ ...t(9.6), marginBottom: 14 }}>
        A welcome module and Module 1 written and designed by hand to show what a published coursebook page looks like when it follows the structure of an existing A2 series with new content: new characters (Lily, Sam, Zoe and Kenji), new texts, new exercises.
      </Text>
      <Text style={t(10, 700)}>Credits</Text>
      <Text style={t(9.6)}>Illustrations: generated with GPT Image 2.5 and composed by hand.</Text>
      <Text style={t(9.6)}>Icons: Twemoji by Twitter, Inc. and other contributors, licensed under CC-BY 4.0.</Text>
      <Text style={{ ...t(9.6), marginBottom: 14 }}>Typefaces: Noto Sans, Baloo 2 and Andika (SIL Open Font License).</Text>
      <Text style={t(10, 700)}>Characters</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 20 }}>
        {/* Each face cut from w-friends.png (1024 px) around its centre: an
            even step per child had put chins, shirts and Kenji's shoulder in
            the circles instead of the faces. */}
        {(
          [
            ["Lily", 165, 330],
            ["Sam", 425, 370],
            ["Zoe", 625, 430],
            ["Kenji", 880, 345],
          ] as const
        ).map(([n, fx, fy], i) => (
          <View key={n} style={{ alignItems: "center" }}>
            <View style={{ width: 90, height: 90, borderRadius: 45, overflow: "hidden", borderWidth: 3, borderColor: [GREEN, ORANGE, PURPLE, BLUE][i] }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={png(A.friends)} style={{ position: "absolute", width: FACE_SHEET, height: FACE_SHEET, left: 42 - (fx / 1024) * FACE_SHEET, top: 42 - (fy / 1024) * FACE_SHEET }} />
            </View>
            <Text style={t(10, 700)}>{n}</Text>
          </View>
        ))}
      </View>
      <Text style={{ ...t(8.6, 400, "#616161"), position: "absolute", bottom: 50, left: 56, right: 56 }}>
        This reference book is not for sale. It is not affiliated with, and does not reproduce text from, any published coursebook. All rights in the new texts and pictures belong to their authors.
      </Text>
    </Page>
  );
}

function Contents() {
  const head = ["MODULE", "TOPIC", "VOCABULARY", "GRAMMAR", "READING", "SPEAKING & FUNCTIONS", "LISTENING", "WRITING"];
  const widths = [0.1, 0.13, 0.14, 0.14, 0.13, 0.15, 0.11, 0.1];
  const rows: { m: string; pp: string; color: string; cells: string[] }[] = [
    {
      m: "Welcome",
      pp: "pp. 4-9",
      color: "#7CB342",
      cells: ["• Review", "• family • school subjects • numbers & ordinals • countries • rooms • prepositions of movement", "• pronouns & possessives • plurals • there is/are", "• a dialogue", "• greetings and introductions • talking about family and places • telling the time", "• listening for specific information", "• about you (ID file)"],
    },
    {
      m: "1",
      pp: "pp. 10-17",
      color: RED,
      cells: [
        "• Moving day • Party night! • Free-time fun • Video games",
        "• things in a room • household chores • free-time activities • personality adjectives",
        "• Present Continuous • Present Continuous (future) • Present Simple, adverbs of frequency • -ing form",
        "• a dialogue • notes and speech bubbles • a quiz • game reviews",
        "• describing a room • making arrangements • inviting, accepting • talking about free time",
        "• identifying key information • true/false",
        "• about your room • an invitation • an email about a game",
      ],
    },
  ];
  const tw = W - 72;
  return (
    <Page size={[W, H]} style={{ paddingTop: 40, paddingHorizontal: 36, backgroundColor: "#fff" }}>
      <Puzzle l={20} tp={14} c="#F06292" s={46} rot={-12} />
      <Puzzle l={W - 80} tp={10} c="#FFD54F" s={50} rot={14} />
      <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 38, color: RED, textAlign: "center", marginBottom: 10 }}>Contents</Text>
      <View style={{ flexDirection: "row", backgroundColor: RED }}>
        {head.map((h, i) => (
          <Text key={h} style={{ ...t(8.4, 700, "#fff"), width: widths[i] * tw, padding: 4, textAlign: "center", borderRightWidth: 0.8, borderColor: "#fff" }}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.m} style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: r.color, backgroundColor: r.color + "18" }}>
          <View style={{ width: widths[0] * tw, backgroundColor: r.color, alignItems: "center", justifyContent: "center", padding: 3 }}>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: r.m.length > 2 ? 14 : 34, color: "#fff", lineHeight: 1 }}>{r.m}</Text>
            <Text style={t(8, 700, "#fff")}>{r.pp}</Text>
          </View>
          {r.cells.map((c, i) => (
            <Text key={i} style={{ ...t(9.2), width: widths[i + 1] * tw, padding: 4, borderRightWidth: 0.6, borderColor: "#E0E0E0" }}>
              {c}
            </Text>
          ))}
        </View>
      ))}
      <View style={{ backgroundColor: "#FFEBEE", padding: 4, borderBottomWidth: 1, borderColor: RED, flexDirection: "row", flexWrap: "wrap" }}>
        {[
          ["Rooms, chores, free time", "pp. 18-19", "Skills Practice"],
          ["", "p. 20", "Bolt the Robot (story)"],
          ["", "p. 21", "Fun Time"],
          ["", "pp. 22-23", "Modular Revision 1"],
        ].map(([a, p, b]) => (
          <Text key={p} style={{ ...t(8.6), marginRight: 16 }}>
            {a ? `${a}  ` : ""}
            <B c={RED}>{p}</B> {b}
          </Text>
        ))}
      </View>
      <View style={{ marginTop: 22, flexDirection: "row", gap: 14 }}>
        <View style={{ flex: 1, backgroundColor: YELLOW, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 16, color: RED }}>How this book works</Text>
          {["Each lesson is two pages: a reading or story page and a practice page.", "The red numbers go on across the two pages of a lesson.", "Look for the headphones: you listen to the recording.", "Check these words: learn the new words of the lesson.", "Workbook: more practice for every lesson."].map((x) => (
            <Text key={x} style={t(9.4)}>
              • {x}
            </Text>
          ))}
        </View>
        <View style={{ width: 170 }}>
          <Pic src={A.friends} w={170} h={170} r={14} />
        </View>
      </View>
    </Page>
  );
}

function BackCover() {
  return (
    <Page size={[W, H]} style={{ backgroundColor: "#29B6F6", padding: 46 }}>
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 0.42 * H }}>
        {/* the children from their raised fists down (at 80% their heads were cut off) */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={png(A.cover)} style={{ width: W, height: 0.42 * H, objectFit: "cover", objectPosition: "50% 57%" }} />
      </View>
      <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 44, color: "#fff" }}>{SERIES} 2</Text>
      <Text style={{ ...t(13, 700, "#0D47A1"), marginBottom: 16 }}>A2 · Student&apos;s Book</Text>
      <View style={{ backgroundColor: "#ffffffee", borderRadius: 14, padding: 14, width: 360 }}>
        <Text style={{ ...t(11), marginBottom: 6 }}>
          {SERIES} is a course for teenagers who want to talk about their own world in English - their rooms, their families, their plans and the things they love doing.
        </Text>
        {["Two-page lessons with a reading or a story and clear practice", "Grammar boxes, Check these words and Everyday English", "Skills Practice in exam format and a revision test in every module", "A story page and a Fun Time page in every module", "Workbook with practice for every lesson"].map((x) => (
          <Text key={x} style={t(10.4)}>
            <Text style={{ color: RED, fontWeight: 700 }}>✓ </Text>
            {x}
          </Text>
        ))}
      </View>
      <View style={{ position: "absolute", right: 46, top: 50, width: 90, height: 90, borderRadius: 45, backgroundColor: "#FFEB3B", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 34, color: RED, lineHeight: 1, marginTop: 8 }}>A2</Text>
        <Text style={t(8, 700, RED)}>CEFR</Text>
      </View>
    </Page>
  );
}

const WbCover = () => <CoverArt kind="Workbook" band="#0277BD" />;
function WbBack() {
  return (
    <Page size={[W, H]} style={{ backgroundColor: "#0277BD", padding: 46 }}>
      <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 40, color: "#fff" }}>{SERIES} 2 · Workbook</Text>
      <Text style={{ ...t(12, 400, "#E1F5FE"), width: 380, marginTop: 10 }}>
        One page of practice for every Student&apos;s Book lesson: vocabulary with pictures, word puzzles, grammar practice, short reading and a portfolio writing task.
      </Text>
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 0.45 * H }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={png(A.cover)} style={{ width: W, height: 0.45 * H, objectFit: "cover", objectPosition: "50% 60%" }} />
      </View>
    </Page>
  );
}

async function main() {
  A = await loadAssets();
  const missing = EMOJI.filter((e) => !A.emoji[e]);
  if (missing.length) console.warn("emoji not loaded:", missing.join(" "));
  const out = path.join(process.cwd(), ".handmade");
  // PAGES=P4,W1 renders only those pages (to .handmade/test.pdf) while designing.
  const only = process.env.PAGES?.split(",");
  const book = { Cover, Imprint, Contents, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22, P23, BackCover };
  const workbook = { WbCover, W1, W2, W3, W4, WbBack };
  if (only) {
    const all: Record<string, () => React.ReactElement> = { ...book, ...workbook };
    const buf = await renderToBuffer(<Document>{only.map((k) => React.createElement(all[k], { key: k }))}</Document>);
    fs.writeFileSync(path.join(out, "test.pdf"), buf);
    console.log("test.pdf", only.join(","), buf.length);
    return;
  }
  const sb = await renderToBuffer(
    <Document title="Welcome Module and Module 1 - Student's Book (hand-made reference)">
      {Object.entries(book).map(([k, C]) => (
        <C key={k} />
      ))}
    </Document>,
  );
  fs.writeFileSync(path.join(out, "student-book.pdf"), sb);
  const wb = await renderToBuffer(
    <Document title="Module 1 - Workbook (hand-made reference)">
      {Object.entries(workbook).map(([k, C]) => (
        <C key={k} />
      ))}
    </Document>,
  );
  fs.writeFileSync(path.join(out, "workbook.pdf"), wb);
  console.log("student-book.pdf", sb.length, "workbook.pdf", wb.length);
}
void main();
