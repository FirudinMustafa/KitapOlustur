// Hand-made reference 4: a coursebook re-made from a PHONE SCAN
// (.spike/scan/scan.pdf - 32 CamScanner sheets, no text layer, some areas
// faded or cut off). Scope: cover, imprint, contents spread, the Starter
// unit (scan sheets 3-10 = book pp.7-14) and Theme 1 up to the end of
// module B (sheets 11-18 = book pp.15-22), back cover. Original
// characters, texts, exercises and pictures; the scan's level (A1), unit /
// module structure, page types, layout, page furniture and density.
// 205 x 297 mm (the scan's measured page aspect, 0.69).
//
//   npx tsx --env-file=.env.local scripts/reference/handcraft-scan-images.mts   (paid pictures, once)
//   npx tsx scripts/reference/handcraft-scan-crop.mts                           (clean scan pages, for scoring)
//   npx tsx scripts/reference/handcraft-scan.tsx
//     -> .handmade-scan/student-book.pdf
//   npx tsx scripts/fidelity.mts .handmade-scan/scan-pages.pdf .handmade-scan/student-book.pdf 1 5 16 20
//
// Pictures: 11 paid (.handmade-scan/img), free pictures reused from the
// hand-made i5 book (.handmade-scan/free), composites in
// handcraft-scan-art.ts, small pictures are Twemoji (CC-BY 4.0).
import path from "node:path";
import fs from "node:fs";
import React from "react";
import { Document, Page, View, Text, Image, Font, Svg, Path, Rect, Polygon, renderToBuffer } from "@react-pdf/renderer";
import { loadEmojiIcons } from "../../src/lib/pdf/emoji-icons";
import * as art from "./handcraft-scan-art";

const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "Noto", fonts: [{ src: path.join(FONTS, "NotoSans-Regular.ttf"), fontWeight: 400 }, { src: path.join(FONTS, "NotoSans-Bold.ttf"), fontWeight: 700 }, { src: path.join(FONTS, "NotoSans-Italic.ttf"), fontStyle: "italic" }] });
Font.register({ family: "Baloo", fonts: [{ src: path.join(FONTS, "Baloo2-Medium.ttf"), fontWeight: 500 }, { src: path.join(FONTS, "Baloo2-Bold.ttf"), fontWeight: 700 }] });
Font.register({ family: "Andika", fonts: [{ src: path.join(FONTS, "Andika-Regular.ttf"), fontWeight: 400 }, { src: path.join(FONTS, "Andika-Bold.ttf"), fontWeight: 700 }] });
Font.register({ family: "Nunito", fonts: [{ src: path.join(FONTS, "Nunito-Regular.ttf"), fontWeight: 400 }, { src: path.join(FONTS, "Nunito-Bold.ttf"), fontWeight: 700 }] });
Font.register({ family: "Sym", src: path.join(FONTS, "NotoSansSymbols2-Regular.ttf") });
Font.registerHyphenationCallback((w) => [w]);

// --- page geometry and palette --------------------------------------------------
const MM = 72 / 25.4;
const W = 205 * MM; // 581.1
const H = 297 * MM; // 841.9
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

type Src = Buffer | string;
const srcOf = (s: Src) => (typeof s === "string" ? s : { data: s, format: "png" as const });
const t = (size = BODY, weight: 400 | 700 = 400, color = INK) => ({ fontFamily: "Noto", fontSize: size, fontWeight: weight, color, lineHeight: 1.3 });
const hand = (size = 11, color = INK, weight: 400 | 700 = 400) => ({ fontFamily: "Andika", fontSize: size, color, fontWeight: weight, lineHeight: 1.3 });
const B = ({ children, c }: { children: React.ReactNode; c?: string }) => <Text style={{ fontWeight: 700, ...(c ? { color: c } : {}) }}>{children}</Text>;
const blank = (n = 10) => "_".repeat(n);
const ans = (s: string) => <Text style={{ fontFamily: "Andika", color: BLUE, textDecoration: "underline" }}>{`  ${s}  `}</Text>;

// --- assets -------------------------------------------------------------------------
const EMOJI = ["☂️", "🏀", "🌸", "🍌", "🐸", "🐳", "☁️", "📁", "🖨️", "🎧", "🖍️", "✂️", "🔊", "📎", "📏", "🍳", "👔", "🧰", "👫", "🩺", "📚", "🎸", "⚽", "🤖", "⭐", "🥄", "🔑", "🎒"];
let EM: Record<string, string> = {};
const E = (e: string) => EM[e];
const emoBuf = (e: string) => Buffer.from((EM[e] ?? "").split(",")[1] ?? "", "base64");

type FBox = [number, number, number, number];
const px = (f: number, side: number) => Math.round(f * side * art.PX);
const boxPx = (b: FBox) => [px(b[2], W), px(b[3], H)] as const;

// Picture boxes, measured on the scan pages (fractions of the page).
const BOX = {
  keyboard: [0, 0.125, 1, 0.5] as FBox,
  paints: [0.06, 0.03, 0.41, 0.43] as FBox,
  classroom: [0.07, 0.555, 0.86, 0.37] as FBox,
  numbers: [0.08, 0.125, 0.43, 0.6] as FBox,
  pegs: [0.535, 0.155, 0.44, 0.37] as FBox,
  ordinal: [0.535, 0.575, 0.465, 0.165] as FBox,
  bus: [0, 0.77, 1, 0.2] as FBox,
  clocks: [0.06, 0.14, 0.42, 0.24] as FBox,
  actClocks: [0.05, 0.665, 0.47, 0.26] as FBox,
  greetings: [0.47, 0.065, 0.46, 0.5] as FBox,
  town: [0.07, 0.105, 0.93, 0.255] as FBox,
};

async function loadAssets() {
  EM = await loadEmojiIcons(EMOJI);
  const I = art.img;
  const F = art.free;
  const [kw, kh] = boxPx(BOX.keyboard);
  const peopleT = await Promise.all(Array.from({ length: 9 }, (_, i) => art.trim(I(`people-${i + 1}`))));
  const tile = (name: string, emojis: string[], bg: string) =>
    art.compose(name, 420, 300, `<rect width="420" height="300" rx="18" fill="${bg}"/><circle cx="330" cy="70" r="90" fill="#ffffff55"/>`, emojis.map((e, i) => ({ buf: emoBuf(e), x: emojis.length === 1 ? 130 : 60 + i * 160, y: emojis.length === 1 ? 60 : 70 + (i % 2) * 30, w: emojis.length === 1 ? 180 : 150, h: emojis.length === 1 ? 180 : 150 })));
  const frameFaces = (name: string, faces: Buffer[], bg: string) => {
    const w = 420;
    const h = 300;
    return art.compose(
      name,
      w,
      h,
      `<rect width="${w}" height="${h}" fill="${bg}"/><rect y="${h * 0.62}" width="${w}" height="${h * 0.38}" fill="#C5A880"/>${Array.from({ length: 6 }, (_, i) => `<rect x="${i * 72}" y="${h * 0.3 - (i % 3) * 20}" width="58" height="${h * 0.34 + (i % 3) * 20}" fill="#B0BEC5"/>`).join("")}`,
      faces.map((f, i) => ({ buf: f, x: 30 + i * (faces.length === 3 ? 125 : faces.length === 1 ? 140 : 190), y: 120 - (i % 2) * 14, w: faces.length === 3 ? 120 : 160, h: faces.length === 3 ? 120 : 160, circle: true, ring: "#fff", ringW: 6 })),
    );
  };
  return {
    cover: I("cover"),
    starter: I("starter"),
    theme1: I("theme1"),
    story: I("story"),
    town: await art.vivid(I("town"), 1.15),
    classroom: I("classroom"),
    cast: await Promise.all(Array.from({ length: 7 }, (_, i) => art.trim(I(`cast-${i + 1}`)))),
    jobs: Array.from({ length: 10 }, (_, i) => I(`jobs-${i + 1}`)),
    classlang: await Promise.all(Array.from({ length: 8 }, (_, i) => art.trim(I(`classlang-${i + 1}`)))),
    people: Array.from({ length: 9 }, (_, i) => I(`people-${i + 1}`)),
    routines: Array.from({ length: 8 }, (_, i) => I(`routines-${i + 1}`)),
    keyboard: await art.keyboard(kw / art.PX, kh / art.PX),
    paints: await art.paintPots(BOX.paints[2] * W, BOX.paints[3] * H),
    numbers: await art.numberTiles(BOX.numbers[2] * W, BOX.numbers[3] * H * 0.97),
    pegs: await art.pegs(BOX.pegs[2] * W, BOX.pegs[3] * H),
    starGroundL: await art.starGround(W, H, { top: 0.075 * H, left: 0.055 * W, right: 0 }),
    starGroundR: await art.starGround(W, H, { top: 0.075 * H, left: 0, right: 0.055 * W }),
    ordinal: await art.compose("ordinal-panel", ...boxPx(BOX.ordinal), `<rect x="0" y="0" width="${boxPx(BOX.ordinal)[0] + 40}" height="${boxPx(BOX.ordinal)[1]}" rx="40" fill="#4C5B7C"/><rect x="10" y="10" width="${boxPx(BOX.ordinal)[0]}" height="${boxPx(BOX.ordinal)[1] - 20}" rx="34" fill="none" stroke="#8FA3C9" stroke-width="4"/>`),
    bus: await art.busQueue("bus-queue", BOX.bus[2] * W, BOX.bus[3] * H, ["w-family-7", "w-family-8", "w-family-10", "w-family-6", "w-family-9", "w-family-4", "w-family-3"].map(F)),
    skylineBus: await art.skyline("skyline-bus", W, BOX.bus[3] * H, "#CFD8DC"),
    clocks: [await art.clockRow("clocks-3a", BOX.clocks[2] * W, 0.085 * H, [[4, 0], [4, 15], [4, 20]], ["#7CB342", "#FBC02D", "#90A4AE"], 3), await art.clockRow("clocks-3b", BOX.clocks[2] * W, 0.085 * H, [[4, 30], [4, 45], [4, 55]], ["#E53935", "#3949AB", "#8E24AA"], 3)],
    actClocks: await art.clockRow(
      "clocks-8",
      BOX.actClocks[2] * W,
      BOX.actClocks[3] * H * 0.78,
      [[7, 0], [8, 30], [10, 15], [11, 45], [1, 10], [2, 50], [6, 25], [9, 35]],
      ["#E3F2FD", "#AED581", "#CE93D8", "#455A64"],
      4,
      true,
    ),
    schools: await Promise.all((["day", "day", "morning", "afternoon", "evening", "night"] as const).map((k, i) => art.schoolAt(`school-${i}`, 92, 64, k))),
    greetKids: [await art.knockout(F("w-friends")), await art.knockout(I("cast-2")), await art.knockout(I("cast-3"))],
    facesK: Object.fromEntries(await Promise.all(Array.from({ length: 10 }, async (_, i) => [`f${i + 1}`, await art.knockout(F(`w-family-${i + 1}`))]))) as Record<string, Buffer>,
    faces: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`f${i + 1}`, F(`w-family-${i + 1}`)])) as Record<string, Buffer>,
    friends: F("w-friends"),
    park: F("1c-park"),
    boys: F("d-games-4"),
    familyHome: F("1b-scene"),
    sydney: F("w-landmarks-2"),
    email: await art.emailWindow("email-19", 0.44 * W, 0.215 * H, F("w-family-10")),
    postcard: await art.postcard("postcard-22b", 0.41 * W, 0.235 * H, F("w-landmarks-2")),
    tiles3: await Promise.all(
      (
        [
          ["🍳", "#FFE0B2"],
          ["👔", "#C5CAE9"],
          ["🧰", "#CFD8DC"],
          ["👫", "#F8BBD0"],
          ["🏀", "#C8E6C9"],
          ["🩺", "#B3E5FC"],
          ["📚", "#FFF9C4"],
          ["🎸", "#E1BEE7"],
        ] as const
      ).map(([e, c], i) => tile(`tile3-${i}`, [e], c)),
    ),
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
    jobsArt: await art.compose(
      "jobs-circles",
      px(0.9, W),
      px(0.27, H),
      "",
      Array.from({ length: 10 }, (_, i) => {
        const cw = px(0.9, W) / 5;
        const ch = px(0.27, H) / 2;
        const d = Math.min(cw * 0.86, ch * 0.8);
        return { buf: I(`jobs-${i + 1}`), x: (i % 5) * cw + (cw - d) / 2, y: Math.floor(i / 5) * ch, w: d, h: d, circle: true, ring: ["#FFF59D", "#BBDEFB", "#E1BEE7", "#B2DFDB", "#FFCCBC"][i % 5], ringW: 10, bg: ["#FFF8C4", "#D6ECFF", "#EEDDF5", "#D5F0EA", "#FFE1D6"][i % 5] };
      }),
    ),
    peopleArt: await art.compose(
      "people-row-2",
      px(0.95, W),
      px(0.26, H),
      "",
      Array.from({ length: 9 }, (_, i) => {
        const top = i < 5;
        const cw = px(0.95, W) / (top ? 5 : 4);
        const ch = px(0.26, H) / 2;
        const col = top ? i : i - 5;
        return { buf: peopleT[i], x: col * cw + cw * 0.08 + (top ? 0 : cw * 0.1), y: (top ? 0 : ch) + 4, w: cw * 0.84, h: ch * 0.78, knock: true };
      }),
    ),
    huggi: await art.knockout(I("cast-4")),
  };
}
type Assets = Awaited<ReturnType<typeof loadAssets>>;
let A: Assets;

// --- layout primitives (page fractions) ------------------------------------------------
const At = ({ b, children, z, style }: { b: [number, number, number?, number?]; children?: React.ReactNode; z?: number; style?: object }) => (
  <View style={{ position: "absolute", left: b[0] * W, top: b[1] * H, ...(b[2] !== undefined ? { width: b[2] * W } : {}), ...(b[3] !== undefined ? { height: b[3] * H } : {}), ...(z ? { zIndex: z } : {}), ...style }}>{children}</View>
);
function Pic({ b, src, fit = "cover", r = 0, pos, border }: { b: FBox; src: Src; fit?: "cover" | "contain"; r?: number; pos?: string; border?: string }) {
  return (
    <At b={b}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={srcOf(src)} style={{ width: b[2] * W, height: b[3] * H, objectFit: fit, ...(pos ? { objectPosition: pos } : {}), borderRadius: r, ...(border ? { borderWidth: 2, borderColor: border } : {}) }} />
    </At>
  );
}
const Fill = ({ b, color, r = 0, border, bw = 2, opacity }: { b: FBox; color: string; r?: number; border?: string; bw?: number; opacity?: number }) => (
  <At b={b}>
    <View style={{ width: "100%", height: "100%", backgroundColor: color, borderRadius: r, ...(border ? { borderWidth: bw, borderColor: border } : {}), ...(opacity !== undefined ? { opacity } : {}) }} />
  </At>
);

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
// An exercise heading as the scan prints it: a big orange-red number, an
// optional green audio tag, the rubric in bold beside it (hanging indent).
function Ex({ n, children, audio, size = 10.4, numSize = 14, color = RUBRIC }: { n: string; children: React.ReactNode; audio?: string; size?: number; numSize?: number; color?: string }) {
  return (
    <View style={{ flexDirection: "row" }} wrap={false}>
      <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: numSize, color: NUM, width: n.length > 2 ? numSize * 1.9 : n.length > 1 ? numSize * 1.45 : numSize * 0.95, lineHeight: 1 }}>{n}</Text>
      {audio ? <AudioTag code={audio} /> : null}
      <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: size, color, flex: 1, letterSpacing: -0.25, lineHeight: 1.25, paddingTop: 1.5 }}>{children}</Text>
    </View>
  );
}
const ExAt = (p: { b: [number, number, number?]; n: string; children: React.ReactNode; audio?: string; size?: number; color?: string }) => (
  <At b={[p.b[0], p.b[1], p.b[2] ?? 0.42]}>
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

// Outlined cartoon title (the scan's Starter headings): copies of the text
// offset round the main one make the outline.
function Title({ text, size = 24, fill = GOLD, stroke = "#5A3E00", font = "Baloo" }: { text: string; size?: number; fill?: string | string[]; stroke?: string; font?: string }) {
  const off = size * 0.055;
  const dirs = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [1.6, 1.8]];
  const letters = (c: string | string[]) =>
    Array.isArray(c) ? text.split("").map((ch, i) => <Text key={i} style={{ color: c[i % c.length] }}>{ch}</Text>) : text;
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

// The crimson ribbon tab of the Theme pages ("Vocabulary", "Grammar"...).
function Tab({ b, label, faded }: { b: [number, number]; label: string; faded?: boolean }) {
  const two = label.includes("\n");
  const w = two ? 0.18 : label.length * 0.0132 + 0.06;
  const h = two ? 0.052 : 0.04;
  return (
    <At b={[b[0], b[1], w, h + 0.014]} style={faded ? { opacity: 0.45 } : undefined}>
      <Svg width={w * W} height={(h + 0.014) * H} style={{ position: "absolute", left: 0, top: 0 }}>
        <Polygon points={`0,${h * H} 10,${h * H} 10,${(h + 0.014) * H}`} fill="#5C0A24" />
        <Rect x={0} y={0} width={w * W} height={h * H} fill={CRIMSON} />
        <Rect x={0} y={0} width={w * W} height={(h * H) / 2} fill="#C0245A" opacity={0.55} />
        <Rect x={w * W - 5} y={0} width={5} height={h * H} fill="#00000033" />
      </Svg>
      <View style={{ position: "absolute", left: 0, top: 0, width: w * W, height: h * H, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: two ? 11.5 : 16, color: "#fff", textAlign: "center", lineHeight: two ? 1.0 : 1.1, letterSpacing: -0.4 }}>{label}</Text>
      </View>
    </At>
  );
}

function ModuleBadge({ code, right = true }: { code: string; right?: boolean }) {
  return (
    <At b={[right ? 0.82 : 0.06, 0, 0.14, 0.045]}>
      <Svg width={0.14 * W} height={0.045 * H}>
        <Path d={`M0 0 H${0.14 * W} Q${0.12 * W} ${0.04 * H} ${0.07 * W} ${0.045 * H} Q${0.02 * W} ${0.04 * H} 0 0 Z`} fill="#A5D6A7" />
      </Svg>
      <View style={{ position: "absolute", left: 0.07 * W - 15, top: 3, width: 30, height: 30, borderRadius: 15, backgroundColor: "#1E88E5", borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 14, color: "#fff", marginTop: 2 }}>{code}</Text>
      </View>
    </At>
  );
}

function WordBanner({ b, lines, color = GREEN, size = 10.5, tilt = -1 }: { b: FBox; lines: string[]; color?: string; size?: number; tilt?: number }) {
  return (
    <At b={b}>
      <View style={{ transform: `rotate(${tilt}deg)`, backgroundColor: color, borderWidth: 2, borderColor: "#fff", paddingVertical: 3, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", height: b[3] * H }}>
        {lines.map((l) => (
          <Text key={l} style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: size, color: "#fff", lineHeight: 1.15, textAlign: "center" }}>
            {l}
          </Text>
        ))}
      </View>
    </At>
  );
}

function Bubble({ b, children, color = "#fff", border = "#37474F", tail = "bl", r = 10, size = 10, font = "Andika", textColor = INK, center = true }: { b: [number, number, number]; children: React.ReactNode; color?: string; border?: string; tail?: "bl" | "br" | "tl" | "tr" | "none"; r?: number; size?: number; font?: string; textColor?: string; center?: boolean }) {
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
// Red number + white answer box (the scan's write-in boxes under pictures).
const AnswerBox = ({ n, w, label }: { n: string | number; w: number; label?: React.ReactNode }) => (
  <View style={{ flexDirection: "row", alignItems: "center", width: w }}>
    <NumTag n={n} size={13} />
    <View style={{ flex: 1, height: 13, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E57373", justifyContent: "center", paddingLeft: 3 }}>{label}</View>
  </View>
);
const Check = () => <View style={{ width: 11, height: 11, borderWidth: 1.2, borderColor: "#455A64", borderRadius: 3, marginRight: 5, marginTop: 1 }} />;

// --- footers ----------------------------------------------------------------------------
function StarterFooter({ n }: { n: number }) {
  const right = n % 2 === 1;
  return (
    <View style={{ position: "absolute", bottom: 0.022 * H, [right ? "right" : "left"]: 0, flexDirection: right ? "row-reverse" : "row", alignItems: "center" }}>
      <View style={{ width: 0.075 * W, height: 17, backgroundColor: MAGENTA, alignItems: right ? "flex-start" : "flex-end", justifyContent: "center", paddingHorizontal: 8 }}>
        <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 11, color: "#fff" }}>{n}</Text>
      </View>
      <View style={{ height: 17, backgroundColor: "#fff", paddingHorizontal: 5, justifyContent: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#F8BBD0" }}>
        <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 10.5, color: "#E53935", letterSpacing: -0.3 }}>STARTER</Text>
      </View>
    </View>
  );
}
function ThemeFooter({ n, module }: { n: number; module?: string }) {
  const right = n % 2 === 1;
  return (
    <View style={{ position: "absolute", bottom: 0.018 * H, [right ? "right" : "left"]: 0, flexDirection: right ? "row-reverse" : "row", alignItems: "center" }}>
      <View style={{ width: 0.07 * W, height: 18, backgroundColor: SLATE, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 11, color: "#fff" }}>{n}</Text>
      </View>
      <View style={{ height: 18, width: module ? 0.2 * W : 0.13 * W, backgroundColor: GOLD, paddingHorizontal: 9, justifyContent: "center", borderWidth: 1.5, borderColor: SLATE }}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 9.5, color: SLATE, lineHeight: 1, marginTop: 2 }}>{module ? `theme 1   module ${module}` : "Theme 1"}</Text>
      </View>
    </View>
  );
}

function BookPage({ children, bg = "#fff", ground, footer }: { children: React.ReactNode; bg?: string; ground?: Src; footer?: React.ReactNode }) {
  return (
    <Page size={[W, H]} style={{ backgroundColor: bg, position: "relative" }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      {ground ? <Image src={srcOf(ground)} style={{ position: "absolute", left: 0, top: 0, width: W, height: H - 0.5 }} /> : null}
      {children}
      {footer}
    </Page>
  );
}

// --- pages: Starter -------------------------------------------------------------------------
function P7StarterOpener() {
  return (
    <BookPage bg="#BFE3F8" footer={<StarterFooter n={7} />}>
      <Pic b={[0, 0, 1, 1]} src={A.starter} />
      <Fill b={[0, 0.088, 1, 0.012]} color={MAGENTA} />
      <Fill b={[0, 0.1, 1, 0.125]} color="#ffffff" opacity={0.93} />
      <At b={[0.045, 0.108, 0.6]}>
        <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 64, color: STARTER_BLUE, letterSpacing: -3, lineHeight: 1.1 }}>STARTER</Text>
      </At>
      <Fill b={[0.5, 0.188, 0.2, 0.008]} color={STARTER_BLUE} />
      <At b={[0.655, 0.06, 0.29, 0.255]}>
        <View style={{ backgroundColor: MAGENTA, height: "100%", padding: 9, borderWidth: 2, borderColor: "#fff", transform: "rotate(-1deg)" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#FFEB3B", lineHeight: 1.05 }}>Vocabulary</Text>
          {["The alphabet", "Colours", "Numbers 1-100", "Ordinal numbers", "Days of the week", "Greetings", "Classroom language", "Jobs and places"].map((x) => (
            <Text key={x} style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 9.2, color: "#fff", marginLeft: 6, lineHeight: 1.3 }}>
              {x}
            </Text>
          ))}
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#FFEB3B", marginTop: 3, lineHeight: 1.05 }}>Grammar</Text>
          {["a / an", "Telling the time"].map((x) => (
            <Text key={x} style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 9.2, color: "#fff", marginLeft: 6, lineHeight: 1.3 }}>
              {x}
            </Text>
          ))}
        </View>
      </At>
      <Bubble b={[0.03, 0.335, 0.2]} color="#F06292" border="#fff" textColor="#fff" size={12} tail="br" r={16}>
        Excuse me, what time is it?
      </Bubble>
      <Bubble b={[0.27, 0.36, 0.17]} color="#FFD54F" border="#fff" size={12} tail="br" r={16}>
        Goodbye, Mia!
      </Bubble>
      <Bubble b={[0.54, 0.47, 0.13]} color="#FFD54F" border="#fff" size={12} tail="tl" r={16}>
        Bye! See you!
      </Bubble>
      <Bubble b={[0.66, 0.325, 0.22]} color="#AED581" border="#fff" textColor="#4A148C" size={12} tail="bl" r={16}>
        {"I'm Kate.\nK-A-T-E!"}
      </Bubble>
      <Bubble b={[0.73, 0.555, 0.2]} color="#B3E5FC" border="#fff" size={12} tail="tl" r={16}>
        {"It's four\no'clock."}
      </Bubble>
    </BookPage>
  );
}

const KEY_SECRET = [[1, 2], [3, 4, 5], [6, 7], [8, 9]];
function P8Alphabet() {
  return (
    <BookPage footer={<StarterFooter n={8} />}>
      <Pic b={BOX.keyboard} src={A.keyboard} />
      <At b={[0, 0.67, 0.55, 0.3]}>
        <Svg width={0.55 * W} height={0.3 * H}>
          <Path d={`M0 0 Q${0.3 * W} ${0.02 * H} ${0.55 * W} ${0.3 * H} H0 Z`} fill="#DCEFFB" />
        </Svg>
      </At>
      <At b={[0.08, 0.035]}>
        <Title text="The Alphabet" size={25} fill="#FFD23F" stroke="#7A4B00" />
      </At>
      <ExAt b={[0.08, 0.085, 0.6]} n="1">
        Complete the keyboard with small letters. Then write the numbered letters and find the secret message.
      </ExAt>
      <At b={[0.14, 0.535, 0.74, 0.06]}>
        <View style={{ flexDirection: "row", justifyContent: "center", backgroundColor: "#FFFDE7", borderWidth: 1.5, borderColor: "#F2D46B", borderRadius: 8, paddingVertical: 6 }}>
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
      <ExAt b={[0.075, 0.65, 0.45]} n="2" audio="S.01">
        Listen and circle the word you hear.
      </ExAt>
      <At b={[0.1, 0.69, 0.4, 0.26]}>
        <View style={{ backgroundColor: "#fff", height: "100%", transform: "rotate(-1.5deg)", borderWidth: 1, borderColor: "#E0E0E0", paddingLeft: 30, paddingTop: 14 }}>
          <Items cols={2} down size={12.5} gap={12} font="Andika" items={["bag / back", "pen / ten", "hat / cat", "bus / box", "red / bed", "sit / six", "car / star", "boat / coat", "map / mop", "tree / three"]} />
        </View>
      </At>
      <Pic b={[0.0, 0.705, 0.17, 0.15]} src={A.faces.f10} fit="contain" />
      <ExAt b={[0.54, 0.65, 0.42]} n="3">
        Work with a partner. Read the dialogue and act it out.
      </ExAt>
      <Pic b={[0.55, 0.735, 0.45, 0.255]} src={art.img("people-5")} fit="contain" />
      <Bubble b={[0.56, 0.7, 0.2]} tail="bl" size={10.5}>
        {"Hello! I'm Tom.\nWhat's your name?"}
      </Bubble>
      <Bubble b={[0.57, 0.752, 0.15]} tail="bl" size={10.5}>
        {"How do you\nspell it?"}
      </Bubble>
      <Bubble b={[0.79, 0.71, 0.14]} tail="br" size={11} border="#AB47BC" r={2}>
        {"Nadia.\nN-A-D-I-A."}
      </Bubble>
    </BookPage>
  );
}

// Crossword (exercise 6): cells [row, col, number?].
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
  const cells = new Map<string, number | undefined>();
  for (const w of CROSS)
    w.word.split("").forEach((_, i) => {
      const k = `${w.r + (w.down ? i : 0)},${w.c + (w.down ? 0 : i)}`;
      if (!cells.has(k) || i === 0) cells.set(k, i === 0 ? w.n : cells.get(k));
    });
  return (
    <View style={{ width: cell * 9, height: cell * 9 }}>
      {[...cells.entries()].map(([k, n]) => {
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
const CLASS_LABELS: [string, number, number][] = [
  ["a board", 0.12, 0.2],
  ["door", 0.385, 0.26],
  ["umbrella", 0.2, 0.47],
  ["eraser", 0.13, 0.33],
  ["bookcase", 0.5, 0.44],
  ["chair", 0.02, 0.56],
  ["atlas", 0.08, 0.84],
  ["pencil case", 0.43, 0.63],
  ["ruler", 0.23, 0.92],
  ["pen", 0.48, 0.88],
  ["pencil", 0.73, 0.47],
  ["desk", 0.82, 0.74],
];
function P9Colours() {
  const cw = (BOX.paints[2] * W) / 3;
  const ch = (BOX.paints[3] * H - 170 / 3) / 3;
  return (
    <BookPage footer={<StarterFooter n={9} />}>
      <At b={[0.45, 0, 0.55, 0.55]}>
        <Svg width={0.55 * W} height={0.55 * H}>
          <Path d={`M${0.15 * W} 0 H${0.55 * W} V${0.55 * H} H${0.3 * W} Q${0.05 * W} ${0.25 * H} ${0.15 * W} 0 Z`} fill="#E3F1FB" />
        </Svg>
      </At>
      <Pic b={BOX.paints} src={A.paints} />
      <At b={[0.075, 0.042]}>
        <Title text="Colours" size={22} fill={["#E91E63", "#FB8C00", "#FDD835", "#43A047", "#1E88E5", "#8E24AA", "#E53935"]} stroke="#ffffff" />
      </At>
      <ExAt b={[0.225, 0.047, 0.24]} n="4" audio="S.02">
        Listen and repeat.
      </ExAt>
      {art.PAINTS.map(([name, col], i) => (
        <At key={name} b={[BOX.paints[0] + ((i % 3) * cw + 10) / W, BOX.paints[1] + (50 + Math.floor(i / 3) * ch + ch * 0.68) / H, cw / W - 0.02]}>
          <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: 13, color: col === "#F5F5F5" ? "#9E9E9E" : col, textAlign: "center" }}>{name}</Text>
        </At>
      ))}
      <ExAt b={[0.5, 0.042, 0.47]} n="6">
        Look at the pictures and complete the crossword with the colours.
      </ExAt>
      <At b={[0.55, 0.095, 0.42]}>
        <View style={{ flexDirection: "row", justifyContent: "space-around", borderBottomWidth: 1.5, borderColor: "#B0BEC5", paddingBottom: 3 }}>
          {[["🏀", 1], ["🌸", 2], ["🍌", 3], ["🐳", 5]].map(([e, n]) => (
            <View key={e} style={{ alignItems: "center" }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={E(e as string)} style={{ width: 34, height: 34 }} />
              <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: 11, color: "#C2185B" }}>{n}↓</Text>
            </View>
          ))}
        </View>
      </At>
      <At b={[0.49, 0.16, 0.08]}>
        {[["☂️", 2], ["🐸", 4], ["☁️", 6]].map(([e, n]) => (
          <View key={e} style={{ alignItems: "center", marginBottom: 22 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={E(e as string)} style={{ width: 34, height: 34 }} />
            <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: 11, color: "#C2185B" }}>{n}→</Text>
          </View>
        ))}
      </At>
      <At b={[0.6, 0.165]}>
        <Crossword cell={24} />
      </At>
      <ExAt b={[0.07, 0.49, 0.42]} n="5" audio="S.03">
        Complete with <Text style={{ color: BLUE }}>a</Text> or <Text style={{ color: BLUE }}>an</Text>. Then listen and check.
      </ExAt>
      <Pic b={BOX.classroom} src={A.classroom} r={6} />
      {CLASS_LABELS.map(([l, x, y], i) => (
        <At key={l} b={[BOX.classroom[0] + x * BOX.classroom[2], BOX.classroom[1] + y * BOX.classroom[3]]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <NumTag n={i + 1} size={13} />
            <View style={{ backgroundColor: "#ffffffDD", paddingHorizontal: 3, height: 13, justifyContent: "center" }}>
              <Text style={t(9.5)}>{i === 0 ? <Text style={{ fontFamily: "Andika", color: BLUE }}>a </Text> : "__ "}{i === 0 ? "board" : l}</Text>
            </View>
          </View>
        </At>
      ))}
      <At b={[0.51, 0.48, 0.43, 0.125]}>
        <View style={{ backgroundColor: "#fff", borderWidth: 3, borderColor: "#7CB342", borderRadius: 12, height: "100%" }}>
          <View style={{ backgroundColor: "#7CB342", borderTopLeftRadius: 8, paddingHorizontal: 30, paddingVertical: 2, alignSelf: "flex-start", borderBottomRightRadius: 10 }}>
            <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 13, color: "#fff" }}>a - an</Text>
          </View>
          <View style={{ padding: 5, paddingTop: 3 }}>
            <Text style={t(9.6)}>
              We use <B>a</B> before a consonant sound.
            </Text>
            <Text style={{ ...t(9.6), marginLeft: 8 }}>
              <B>a</B> chair{"            "}
              <B>a</B> ruler
            </Text>
            <Text style={{ ...t(9.6), marginTop: 2 }}>
              We use <B>an</B> before a vowel sound (a, e, i, o, u).
            </Text>
            <Text style={{ ...t(9.6), marginLeft: 8 }}>
              <B>an</B> orange{"         "}
              <B>an</B> eraser
            </Text>
          </View>
        </View>
      </At>
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
  const [bx, by, bw, bh] = BOX.numbers;
  return (
    <BookPage ground={A.starGroundL} footer={<StarterFooter n={10} />}>
      <At b={[0.1, 0.088]}>
        <Title text="Numbers" size={23} fill="#F06292" stroke="#7B1240" />
      </At>
      <ExAt b={[0.29, 0.095, 0.24]} n="7" audio="S.04">
        Listen and repeat.
      </ExAt>
      <Pic b={[bx, by, bw, bh * 0.97]} src={A.numbers} />
      {NUM_WORDS.map((w, i) => (
        <At key={w} b={[bx + ((i % 4) * bw) / 4, by + (Math.floor(i / 4) * bh * 0.97) / 7 + (bh * 0.97 * 0.73) / 7, bw / 4]}>
          <Text style={{ fontFamily: "Andika", fontSize: 10.5, color: INK, textAlign: "center" }}>{w}</Text>
        </At>
      ))}
      <At b={[0.535, 0.09, 0.465, 0.445]}>
        <View style={{ height: "100%", borderWidth: 2.5, borderColor: "#F2C230", borderRightWidth: 0, borderTopLeftRadius: 20, borderBottomLeftRadius: 20, backgroundColor: "#FFFDF4" }} />
      </At>
      <At b={[0.555, 0.1]}>
        <Title text="Days" size={21} fill="#FFD23F" stroke="#7A4B00" />
      </At>
      <ExAt b={[0.67, 0.105, 0.31]} n="8" audio="S.05" size={9.8}>
        Complete the days with the missing letters. Then listen and check.
      </ExAt>
      <Pic b={BOX.pegs} src={A.pegs} />
      <Pic b={BOX.ordinal} src={A.ordinal} />
      <At b={[0.56, 0.582]}>
        <Title text="Ordinal Numbers" size={17} fill="#E3F2FD" stroke="#1565C0" />
      </At>
      <At b={[0.56, 0.613, 0.4]}>
        <Ex n="9" audio="S.06" color="#fff" size={10}>
          Listen and repeat.
        </Ex>
      </At>
      <At b={[0.56, 0.637, 0.43]}>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {ORDINALS.map(([d, s, w]) => (
            <Text key={w} style={{ width: "33%", fontFamily: "Noto", fontSize: 8.6, color: "#fff", lineHeight: 1.32 }}>
              <B>
                {d}
                {s}
              </B>{" "}
              {w}
            </Text>
          ))}
        </View>
      </At>
      <ExAt b={[0.1, 0.745, 0.4]} n="10">
        Fill in the blanks with ordinal numbers.
      </ExAt>
      <Pic b={BOX.bus} src={A.skylineBus} />
      <Pic b={BOX.bus} src={A.bus} />
      {Array.from({ length: 7 }, (_, i) => (
        <At key={i} b={[0.36 + ((1 - 0.36 - 0.012) / 7) * i + 0.004, 0.785, 0.09]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <NumTag n={i + 1} size={11} />
            <Text style={{ fontFamily: "Andika", fontSize: 9.5, color: BLUE, marginLeft: 2, borderBottomWidth: 0.8, borderColor: INK, minWidth: 34 }}>{i === 0 ? "first" : " "}</Text>
          </View>
        </At>
      ))}
    </BookPage>
  );
}

const TIME_CAPTIONS = ["It's four\no'clock.", "It's quarter\npast four.", "It's twenty\npast four.", "It's half\npast four.", "It's quarter\nto five.", "It's five\nto five."];
const GREETINGS = ["Hi! / Hello!", "Goodbye! / Bye!", "Good morning!", "Good afternoon!", "Good evening!", "Good night!"];
function P11Time() {
  const [cx, cy, cw] = BOX.clocks;
  const [gx, gy, gw] = BOX.greetings;
  return (
    <BookPage ground={A.starGroundR} footer={<StarterFooter n={11} />}>
      <At b={[0.07, 0.085]}>
        <Title text="Telling the Time" size={21} fill="#EC407A" stroke="#6A1B4D" />
      </At>
      <ExAt b={[0.075, 0.122, 0.38]} n="11" audio="S.07">
        Listen and repeat.
      </ExAt>
      {[0, 1].map((row) => (
        <Pic key={row} b={[cx, cy + 0.005 + row * 0.128, cw, 0.085]} src={A.clocks[row]} />
      ))}
      {TIME_CAPTIONS.map((c, i) => (
        <At key={c} b={[cx + ((i % 3) * cw) / 3, cy + 0.088 + Math.floor(i / 3) * 0.128, cw / 3]}>
          <Text style={{ ...hand(10.5), textAlign: "center", lineHeight: 1.1 }}>{c}</Text>
        </At>
      ))}
      <ExAt b={[0.075, 0.405, 0.38]} n="12" audio="S.08">
        Listen and repeat.
      </ExAt>
      <Pic b={[0.02, 0.44, 0.15, 0.13]} src={A.facesK.f8} fit="contain" />
      <Pic b={[0.33, 0.55, 0.15, 0.13]} src={A.facesK.f7} fit="contain" />
      <Bubble b={[0.17, 0.432, 0.21]} color="#FFD54F" border="#F9A825" tail="bl" size={10.5} r={14}>
        {"Excuse me! What\ntime is it, please?"}
      </Bubble>
      <Bubble b={[0.17, 0.5, 0.12]} color="#FFD54F" border="#F9A825" tail="bl" size={10.5} r={14}>
        Thanks!
      </Bubble>
      <Bubble b={[0.14, 0.57, 0.16]} color="#81D4FA" border="#29B6F6" tail="br" size={10.5} r={14}>
        {"It's ten\nto nine."}
      </Bubble>
      <Bubble b={[0.15, 0.635, 0.15]} color="#81D4FA" border="#29B6F6" tail="br" size={10.5} r={14}>
        {"You're\nwelcome."}
      </Bubble>
      <Fill b={[0.05, 0.705, 0.47, 0.23]} color="#BBDEFB" r={18} border="#fff" bw={3} />
      <ExAt b={[0.075, 0.715, 0.44]} n="13">
        Now ask and answer with your partner.
      </ExAt>
      <Pic b={[0.06, 0.74, 0.45, 0.19]} src={A.actClocks} />
      <At b={[gx, gy, gw, BOX.greetings[3]]}>
        <View style={{ height: "100%", backgroundColor: "#B7DDE0", borderWidth: 2.5, borderColor: "#F2C230" }} />
      </At>
      <At b={[gx + 0.025, gy + 0.006]}>
        <Title text="Greetings" size={19} fill="#546E7A" stroke="#ffffff" />
      </At>
      <ExAt b={[gx + 0.02, gy + 0.042, gw - 0.04]} n="14" audio="S.09" size={9.8}>
        Listen and repeat. How do you say these in your language?
      </ExAt>
      {GREETINGS.map((g, i) => {
        const fx = gx + 0.025 + (i % 2) * 0.215;
        const fy = gy + 0.097 + Math.floor(i / 2) * 0.132;
        return (
          <React.Fragment key={g}>
            <Pic b={[fx, fy, 0.195, 0.1]} src={A.schools[i]} r={6} border="#ffffff" />
            {i < 2 ? <Pic b={[fx + 0.01, fy + 0.035, 0.12, 0.065]} src={i === 0 ? A.greetKids[0] : A.greetKids[1]} fit="contain" /> : null}
            {i === 1 ? <Pic b={[fx + 0.1, fy + 0.035, 0.08, 0.065]} src={A.greetKids[2]} fit="contain" /> : null}
            <At b={[fx, fy + 0.103, 0.195]}>
              <Text style={{ ...hand(10.5, INK, 700), textAlign: "center" }}>{g}</Text>
            </At>
          </React.Fragment>
        );
      })}
      <ExAt b={[0.55, 0.59, 0.42]} n="15" audio="S.10">
        Read and listen to the dialogue.
      </ExAt>
      <Pic b={[0.55, 0.625, 0.42, 0.2]} src={A.friends} r={8} pos="50% 30%" />
      <At b={[0.545, 0.795, 0.43]}>
        <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#90A4AE", padding: 6 }}>
          {(
            [
              ["Maya", "Good afternoon, Leo. How are you?"],
              ["Leo", "Hi, Maya. I'm OK, thanks. And you?"],
              ["Maya", "Very well, thank you."],
              ["Leo", "Oh no, it's half past three! My bus! See you tomorrow!"],
              ["Maya", "Bye, Leo!"],
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

const CLASS_SENTENCES = ["Can you say that again?", "Close your books.", "Listen carefully.", "Write the date.", "Work in pairs.", "Raise your hand.", "Can I open the window?", "Put it in the bin, please."];
const OBJECTS: [string, string][] = [["📁", "folder"], ["🖨️", "printer"], ["✂️", "scissors"], ["📎", "paper clip"], ["📏", "ruler"], ["🖍️", "crayon"], ["🔊", "speaker"], ["🎧", "headphones"]];
function P12Classroom() {
  return (
    <BookPage bg="#F3F8F8" footer={<StarterFooter n={12} />}>
      <Fill b={[0, 0, 1, 0.07]} color="#ffffff" />
      <At b={[0.04, 0.075, 0.96, 0.425]}>
        <View style={{ height: "100%", backgroundColor: "#fff", borderWidth: 3, borderRightWidth: 0, borderColor: "#F2C230" }} />
      </At>
      <At b={[0.065, 0.088]}>
        <Title text="Classroom Language" size={20} fill="#C0392B" stroke="#ffffff" />
      </At>
      <ExAt b={[0.46, 0.094, 0.53]} n="16" audio="S.11" size={10}>
        Listen and learn. Then match the pictures with the sentences.
      </ExAt>
      {A.classlang.map((c, i) => (
        <React.Fragment key={i}>
          <Pic b={[0.07 + (i % 4) * 0.23, 0.14 + Math.floor(i / 4) * 0.15, 0.2, 0.14]} src={c} fit="contain" />
          <At b={[0.07 + (i % 4) * 0.23, 0.145 + Math.floor(i / 4) * 0.15]}>
            <View style={{ alignItems: "center" }}>
              <NumTag n={"ABCDEFGH"[i]} size={13} />
              <View style={{ width: 13, height: 15, borderWidth: 1, borderColor: "#E57373", backgroundColor: "#fff" }} />
            </View>
          </At>
        </React.Fragment>
      ))}
      <Fill b={[0.04, 0.443, 0.96, 0.057]} color="#CDEBE9" />
      <At b={[0.07, 0.45, 0.92]}>
        <Items cols={4} down size={10} gap={2} items={CLASS_SENTENCES} />
      </At>
      <ExAt b={[0.07, 0.548, 0.36]} n="17">
        Match the words with the pictures.
      </ExAt>
      <WordBanner b={[0.42, 0.535, 0.46, 0.05]} lines={["folder - printer - scissors - paper clip", "ruler - crayon - speaker - headphones"]} />
      {OBJECTS.map(([e], i) => (
        <React.Fragment key={e}>
          <At b={[0.08 + (i % 4) * 0.225, 0.61 + Math.floor(i / 4) * 0.17, 0.2]}>
            <View style={{ alignItems: "center" }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={E(e)} style={{ width: 70, height: 70 }} />
            </View>
          </At>
          <At b={[0.07 + (i % 4) * 0.225, 0.725 + Math.floor(i / 4) * 0.17]}>
            <AnswerBox n={(i + 1) as number} w={0.18 * W} />
          </At>
        </React.Fragment>
      ))}
    </BookPage>
  );
}

const JOB_SENTENCES = [
  "This person looks after sick animals.",
  "This person puts out fires and helps people.",
  "This person repairs cars in a garage.",
  "This person makes bread and cakes early in the morning.",
  "This person takes pictures of people and places.",
  "This person grows fruit and vegetables and keeps cows.",
  "This person works in a hospital and helps the doctors.",
  "This person flies planes to different countries.",
  "This person brings food and drinks to your table.",
  "This person keeps the streets safe.",
];
const JOB_QUOTES = [
  '"Your dog is fine now. Give her this medicine every day."',
  '"Get out of the building, quick! Don\'t use the lift!"',
  '"Your car is ready. I changed the tyres."',
  '"Fresh bread! Get your warm rolls here!"',
  '"Smile, please! Say cheese!"',
  '"I need to feed the chickens before breakfast."',
  '"Sit down here, please. The doctor can see you now."',
  '"Good morning, everyone. We land in Rome in ten minutes."',
  '"Are you ready to order? Today\'s soup is tomato."',
  '"Stop, please! You can\'t park your car here."',
];
const JOBS = ["vet", "firefighter", "mechanic", "baker", "photographer", "farmer", "nurse", "pilot", "waiter", "police officer"];
const shuffled = (arr: string[], order: number[]) => order.map((i) => arr[i]);
function P13Jobs() {
  return (
    <BookPage footer={<StarterFooter n={13} />}>
      <At b={[0, 0.02, 0.5, 0.38]}>
        <Svg width={0.5 * W} height={0.38 * H}>
          <Path d={`M0 ${0.03 * H} L${0.42 * W} 0 L${0.36 * W} ${0.07 * H} L${0.08 * W} ${0.07 * H} L${0.08 * W} ${0.38 * H} L0 ${0.38 * H} Z`} fill="#9CCC65" />
        </Svg>
      </At>
      <ExAt b={[0.085, 0.06, 0.33]} n="18">
        Match the words with the pictures.
      </ExAt>
      <WordBanner b={[0.42, 0.045, 0.48, 0.055]} lines={["vet • firefighter • mechanic • baker • photographer", "farmer • nurse • pilot • waiter • police officer"]} size={10} />
      <Pic b={[0.08, 0.11, 0.9, 0.27]} src={A.jobsArt} />
      {JOBS.map((_, i) => (
        <At key={i} b={[0.085 + (i % 5) * 0.18, 0.225 + Math.floor(i / 5) * 0.135]}>
          <AnswerBox n={i + 1} w={0.15 * W} />
        </At>
      ))}
      <At b={[0.075, 0.39, 0.42, 0.04]}>
        <Svg width={0.42 * W} height={0.04 * H}>
          <Path d={`M0 0 H${0.42 * W} L${0.39 * W} ${0.04 * H} H0 Z`} fill="#AED581" />
        </Svg>
      </At>
      <ExAt b={[0.09, 0.397, 0.4]} n="19">
        Match the jobs with the sentences.
      </ExAt>
      <At b={[0.11, 0.44, 0.22]}>
        {JOBS.map((j, i) => (
          <View key={j} style={{ flexDirection: "row", marginBottom: 2.6 }}>
            <Check />
            <Text style={{ ...t(10), width: 16, fontWeight: 700 }}>{i + 1}</Text>
            <Text style={t(10)}>{j}</Text>
          </View>
        ))}
      </At>
      <At b={[0.33, 0.44, 0.63]}>
        <Items letters size={9.6} gap={2.6} items={shuffled(JOB_SENTENCES, [5, 3, 6, 8, 1, 4, 0, 9, 2, 7])} />
      </At>
      <Fill b={[0.08, 0.663, 0.85, 0.004]} color="#64B5F6" />
      <ExAt b={[0.08, 0.632, 0.7]} n="20">
        Who says it? Match the jobs with the sentences.
      </ExAt>
      <At b={[0.11, 0.68, 0.22]}>
        {JOBS.map((j, i) => (
          <View key={j} style={{ flexDirection: "row", marginBottom: 2.6 }}>
            <Check />
            <Text style={{ ...t(10), width: 16, fontWeight: 700 }}>{i + 1}</Text>
            <Text style={t(10)}>{j}</Text>
          </View>
        ))}
      </At>
      <At b={[0.33, 0.68, 0.62]}>
        <Items letters size={9.6} gap={2.6} items={shuffled(JOB_QUOTES, [3, 0, 9, 6, 2, 8, 4, 1, 7, 5])} />
      </At>
      <Fill b={[0.08, 0.905, 0.85, 0.004]} color="#64B5F6" />
      <Fill b={[0.085, 0.665, 0.008, 0.245]} color="#9CCC65" r={3} />
      <Fill b={[0.915, 0.665, 0.008, 0.245]} color="#9CCC65" r={3} />
    </BookPage>
  );
}

const TOWN_TAGS: [number, number][] = [[0.07, 0.62], [0.19, 0.14], [0.41, 0.3], [0.56, 0.32], [0.69, 0.4], [0.9, 0.42]];
const CLUES = [
  "You go here when you need medicine for a cold.",
  "You can buy apples, bananas and potatoes here.",
  "You sit in the dark and watch a film here.",
  "You buy fresh bread and a birthday cake here.",
  "You play football and have a picnic here.",
  "You look at old things from the past here.",
];
function P14Places() {
  const [tx, ty, tw, th] = BOX.town;
  const c = A.cast;
  return (
    <BookPage footer={<StarterFooter n={14} />}>
      <ExAt b={[0.07, 0.072, 0.5]} n="21">
        Match the words with the places in the picture.
      </ExAt>
      <Pic b={BOX.town} src={A.town} />
      <WordBanner b={[0.6, 0.11, 0.36, 0.05]} lines={["park • cinema • museum", "baker's • chemist's • greengrocer's"]} size={10} />
      {TOWN_TAGS.map(([x, y], i) => (
        <At key={i} b={[tx + x * tw, ty + y * th]}>
          <View style={{ flexDirection: "row" }}>
            <NumTag n={i + 1} size={14} />
            <View style={{ width: 16, height: 14, backgroundColor: "#fff" }} />
          </View>
        </At>
      ))}
      <ExAt b={[0.07, 0.372, 0.8]} n="22">
        Read the clues and write the places from <Text style={{ color: "#C62828" }}>Exercise 21</Text>.
      </ExAt>
      <Fill b={[0.1, 0.398, 0.9, 0.162]} color="#E1F0F7" />
      <At b={[0.12, 0.405, 0.86]}>
        <Items size={10.5} gap={4.6} items={CLUES.map((c2) => `${c2}  ${blank(18)}`)} />
      </At>
      <ExAt b={[0.07, 0.578, 0.5]} n="23" audio="S.12">
        Meet the space explorers.
      </ExAt>
      <Pic b={[0.03, 0.6, 0.25, 0.135]} src={c[0]} fit="contain" />
      <At b={[0.07, 0.725]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#283593" }}>Star-Bus</Text>
      </At>
      <Bubble b={[0.28, 0.615, 0.48]} tail="bl" font="Noto" size={10} center={false} r={12}>
        {"I'm Star-Bus. I'm not a normal school bus - I can fly to the stars! My passengers are Zara and Theo."}
      </Bubble>
      <Pic b={[0.82, 0.585, 0.18, 0.235]} src={c[1]} fit="contain" />
      <At b={[0.79, 0.62]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#283593" }}>Zara</Text>
      </At>
      <Bubble b={[0.44, 0.685, 0.37]} tail="br" font="Noto" size={10} center={false} r={12}>
        {"Hi, I'm Zara. I'm eleven and I'm from Moon Base Luna. Theo is my best friend. Come with us!"}
      </Bubble>
      <Pic b={[0.31, 0.72, 0.17, 0.205]} src={c[2]} fit="contain" />
      <At b={[0.24, 0.755]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#283593" }}>Theo</Text>
      </At>
      <Bubble b={[0.51, 0.775, 0.42]} tail="bl" font="Noto" size={10} center={false} r={12}>
        {"Hello! My name's Theo. I'm twelve and I'm a student at Luna School. My hobby is space football."}
      </Bubble>
      <Pic b={[0.0, 0.775, 0.17, 0.205]} src={c[3]} fit="contain" />
      <At b={[0.16, 0.83]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#283593" }}>K-77</Text>
      </At>
      <Bubble b={[0.15, 0.87, 0.36]} tail="tl" font="Noto" size={10} center={false} r={12}>
        {"I'm Officer K-77, a police robot on the Moon. I check the space buses. Star-Bus is always too fast!"}
      </Bubble>
      <Pic b={[0.84, 0.845, 0.16, 0.11]} src={c[4]} fit="contain" />
      <Bubble b={[0.53, 0.87, 0.32]} tail="br" font="Noto" size={10} center={false} r={12}>
        {"Hoo-hoo! I'm Pip, a robot owl. I fly with Zara and Theo and take photos of their trips."}
      </Bubble>
    </BookPage>
  );
}

// --- pages: Theme 1 ------------------------------------------------------------------------------
function P15ThemeOpener() {
  return (
    <BookPage bg="#CDE9F8" footer={<ThemeFooter n={15} />}>
      <Pic b={[0, 0, 1, 1]} src={A.theme1} />
      <At b={[0, 0, 1, 0.24]}>
        <Svg width={W} height={0.24 * H}>
          <Path d={`M0 0 H${W} V${0.15 * H} Q${0.7 * W} ${0.1 * H} ${0.45 * W} ${0.19 * H} Q${0.2 * W} ${0.26 * H} 0 ${0.2 * H} Z`} fill="#ffffff" opacity={0.92} />
        </Svg>
      </At>
      <Fill b={[0.32, 0.112, 0.68, 0.012]} color="#37404F" />
      <At b={[0.05, 0.085, 0.29, 0.075]}>
        <View style={{ height: "100%", backgroundColor: "#37404F", transform: "rotate(-2deg)" }}>
          <View style={{ position: "absolute", left: 6, top: -5, right: -6, bottom: 5, backgroundColor: "#C9A227", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 34, color: "#fff", marginTop: 6 }}>Theme 1</Text>
          </View>
        </View>
      </At>
      <At b={[0.55, 0.06, 0.34, 0.27]}>
        <View style={{ backgroundColor: GOLD, height: "100%", padding: 10, transform: "rotate(1.2deg)" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#fff", lineHeight: 1.05 }}>Vocabulary</Text>
          {["People at school", "School rules", "Things we do at school"].map((x) => (
            <Text key={x} style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 9.4, color: SLATE, marginLeft: 6, lineHeight: 1.3 }}>
              • {x}
            </Text>
          ))}
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#fff", marginTop: 3, lineHeight: 1.05 }}>Grammar</Text>
          {['The verb "to be"', "Subject pronouns", "Possessive adjectives", "Question words  • Imperatives", "like / love / hate + -ing", "must / can (permission)"].map((x) => (
            <Text key={x} style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 9.4, color: SLATE, marginLeft: 6, lineHeight: 1.3 }}>
              • {x}
            </Text>
          ))}
        </View>
      </At>
      <Bubble b={[0.22, 0.31, 0.17]} color="#EC407A" border="#fff" textColor="#fff" size={12} tail="bl" r={18}>
        {"Don't be\nlate!"}
      </Bubble>
      <Bubble b={[0.04, 0.4, 0.2]} color="#FFCA28" border="#fff" size={12} tail="bl" r={18}>
        {"Are you good\nat Maths?"}
      </Bubble>
      <Bubble b={[0.36, 0.37, 0.22]} color="#4DD0E1" border="#fff" size={12} tail="br" r={18}>
        {"What's your\nfavourite subject?"}
      </Bubble>
      <Bubble b={[0.62, 0.45, 0.2]} color="#BA68C8" border="#fff" textColor="#fff" size={12} tail="br" r={18}>
        {"I love\nFridays!"}
      </Bubble>
    </BookPage>
  );
}

function StoryBox({ b, lines, nameW = 42 }: { b: [number, number, number]; lines: [string, string][]; nameW?: number }) {
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
      <Pic b={[0, 0, 1, 1]} src={A.story} />
      <At b={[0.05, 0.022, 0.31]}>
        <View style={{ borderWidth: 1.5, borderColor: "#E53935", borderStyle: "dashed", borderRadius: 10, backgroundColor: "#fff", padding: 5, paddingTop: 13 }}>
          <View style={{ position: "absolute", top: -8, left: 8, backgroundColor: "#E53935", borderRadius: 9, paddingHorizontal: 7, paddingVertical: 1, flexDirection: "row" }}>
            <Text style={{ fontFamily: "Sym", fontSize: 9, color: "#FFEB3B" }}>✓ </Text>
            <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: 9.5, color: "#fff" }}>Check these words</Text>
          </View>
          <Text style={{ ...hand(10.5), textAlign: "center" }}>jumper - visitor - rule - gadget - allowed - copy - notebook</Text>
        </View>
      </At>
      <StoryBox
        b={[0.03, 0.09, 0.34]}
        nameW={30}
        lines={[
          ["Maya", "Here you are, Theo. This is your school jumper."],
          ["Theo", "A jumper? I hate jumpers!"],
          ["Maya", "Sorry, students wear jumpers at our school. It's a rule."],
          ["Zara", "Ha-ha! Green is your colour, Theo!"],
          ["Theo", "But I'm not a student here. I'm a visitor."],
          ["Maya", "You're a visitor for five days. Put it on, please!"],
        ]}
      />
      <StoryBox
        b={[0.685, 0.315, 0.31]}
        nameW={60}
        lines={[
          ["Maya", "Theo! Put that ball away! Mr Okafor is looking at you!"],
          ["Mr Okafor", "No games in class, please, young man."],
          ["Theo", "It's not a game. It's my space map."],
          ["Mr Okafor", "Map or not, gadgets are not allowed in class."],
          ["Zara", "Listen to Mr Okafor, Theo."],
          ["Theo", "OK. Sorry."],
        ]}
      />
      <StoryBox
        b={[0.03, 0.665, 0.37]}
        nameW={60}
        lines={[
          ["Mr Okafor", "Now, Mr Visitor. Come to the board, please."],
          ["Theo", "Me? Why?"],
          ["Mr Okafor", "Write our class rules on the board. Then copy them in your notebook."],
          ["Theo", "My notebook? We don't use notebooks on the Moon."],
          ["Mr Okafor", "On the Moon? Very funny. Write them three times, then!"],
        ]}
      />
      <At b={[0.1, 0.88, 0.62]}>
        <View style={{ backgroundColor: "#fff", borderWidth: 2.5, borderColor: "#E53935", borderRadius: 14, padding: 6, paddingTop: 3 }}>
          <Ex n="1" audio="1.01" size={10.2}>
            Read and listen to the story. Then answer Pip&apos;s questions.
          </Ex>
          <Items cols={2} size={9.8} gap={1.5} items={["Do students wear jumpers at Maya's school?", "What is Theo's ball?", "Who is cross with Theo? Why?", "Where is Theo's school?"]} />
        </View>
      </At>
      <Pic b={[0.72, 0.85, 0.1, 0.065]} src={A.cast[4]} fit="contain" />
    </BookPage>
  );
}

const PEOPLE = ["librarian", "cook", "coach", "music teacher", "classmates", "caretaker", "headteacher", "bus driver", "school nurse"];
const RIDDLES = [
  "I make lunch for all the students. I wear a white hat.",
  "I am the boss of the school. Teachers and parents talk to me.",
  "I look after the school books. I often say \"Shh!\"",
  "I help you when you are ill or hurt.",
  "We are in the same class. We sit together and help each other.",
  "I teach PE. I love football and basketball.",
  "I repair doors, windows and lights at school.",
  "I teach songs. I play the guitar and the piano.",
];
function P17Vocabulary() {
  return (
    <BookPage footer={<ThemeFooter n={17} module="A" />}>
      <Fill b={[0, 0, 1, 0.045]} color="#EAF4FB" />
      <ModuleBadge code="1A" />
      <Tab b={[0.04, 0.03]} label="Vocabulary" />
      <ExAt b={[0.04, 0.092, 0.4]} n="2" audio="1.02">
        Listen and repeat.
      </ExAt>
      <Pic b={[0.03, 0.115, 0.95, 0.26]} src={A.peopleArt} />
      {PEOPLE.map((p, i) => {
        const top = i < 5;
        const cw = 0.95 / (top ? 5 : 4);
        const col = top ? i : i - 5;
        return (
          <At key={p} b={[0.03 + col * cw + (top ? 0 : cw * 0.1), 0.115 + (top ? 0.105 : 0.235), cw * 0.84]}>
            <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: 11.5, color: SLATE, textAlign: "center" }}>{p}</Text>
          </At>
        );
      })}
      <ExAt b={[0.04, 0.392, 0.44]} n="3">
        Match the pictures with the words in the box.
      </ExAt>
      {A.tiles3.map((tl, i) => (
        <React.Fragment key={i}>
          <Pic b={[0.04 + (i % 2) * 0.225, 0.425 + Math.floor(i / 2) * 0.09, 0.16, 0.08]} src={tl} r={3} border="#455A64" />
          <At b={[0.205 + (i % 2) * 0.225, 0.43 + Math.floor(i / 2) * 0.09]}>
            <NumTag n={i + 1} size={13} />
            <View style={{ width: 13, height: 15, borderWidth: 1, borderColor: "#E57373", backgroundColor: "#fff" }} />
          </At>
        </React.Fragment>
      ))}
      <WordBanner b={[0.04, 0.79, 0.43, 0.055]} lines={["A. cook • B. headteacher • C. caretaker • D. classmates", "E. coach • F. nurse • G. librarian • H. music teacher"]} color="#F9C80E" size={9.4} tilt={1} />
      <Fill b={[0.49, 0.4, 0.47, 0.52]} color="#D9EEF9" r={16} border="#5DA9DD" bw={2} />
      <ExAt b={[0.51, 0.413, 0.44]} n="4">
        Read and answer the questions with the words in the box.
      </ExAt>
      <WordBanner b={[0.52, 0.465, 0.42, 0.048]} lines={["cook • headteacher • caretaker • classmates", "coach • nurse • librarian • music teacher"]} size={9.6} />
      <At b={[0.52, 0.53, 0.43]}>
        <Items
          size={10}
          gap={3.6}
          items={RIDDLES.map((r, i) => (
            <Text key={i} style={t(10)}>
              {r}
              {"\n"}
              {i === 4 ? "Who are we?" : "Who am I?"} {blank(16)}
            </Text>
          ))}
        />
      </At>
    </BookPage>
  );
}

function GrammarTable({ head, rows, w }: { head: string; rows: string[][]; w: number }) {
  return (
    <View style={{ width: w, borderWidth: 1, borderColor: "#37474F", marginRight: 6 }}>
      <View style={{ backgroundColor: "#4A5470", paddingVertical: 2 }}>
        <Text style={{ ...t(9.2, 700, "#fff"), textAlign: "center" }}>{head}</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", borderTopWidth: i ? 1 : 0, borderColor: "#90A4AE", backgroundColor: "#fff" }}>
          {r.map((c, j) => (
            <Text key={j} style={{ ...t(9), flex: j === r.length - 1 ? 1.4 : 1, textAlign: "center", paddingVertical: 2, borderLeftWidth: j ? 0.6 : 0, borderColor: "#CFD8DC" }}>
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
function P18Grammar() {
  const tw = 0.172 * W;
  return (
    <BookPage bg="#E6F2FB" footer={<ThemeFooter n={18} module="A" />}>
      <Fill b={[0.06, 0.03, 0.92, 0.95]} color="#ffffff" r={10} />
      <Tab b={[0.11, 0.05]} label="Grammar" />
      <At b={[0.3, 0.075, 0.6, 0.03]}>
        <View style={{ backgroundColor: "#F57C00", height: "100%", borderTopLeftRadius: 12, justifyContent: "center", paddingLeft: 12 }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 14, color: "#fff", marginTop: 2 }}>The verb &quot;to be&quot;</Text>
        </View>
      </At>
      <Pic b={[0.84, 0.035, 0.13, 0.08]} src={A.faces.f10} fit="contain" />
      <At b={[0.12, 0.105, 0.86, 0.165]}>
        <View style={{ height: "100%", borderWidth: 3, borderColor: "#F2C230", borderRadius: 14, padding: 6, flexDirection: "row", backgroundColor: "#FFFDF2" }}>
          <GrammarTable head="Positive" w={tw} rows={[["I", "am", "ready."], ["You", "are", "ready."], ["He/She/It", "is", "ready."], ["We/You/They", "are", "ready."]]} />
          <GrammarTable head="Negative" w={tw} rows={[["I", "am not", "late."], ["You", "are not", "late."], ["He/She/It", "is not", "late."], ["We/You/They", "are not", "late."]]} />
          <GrammarTable head="Questions" w={tw} rows={[["Am", "I", "OK?"], ["Are", "you", "OK?"], ["Is", "he/she/it", "OK?"], ["Are", "we/you/they", "OK?"]]} />
          <View style={{ width: 0.118 * W, borderWidth: 1, borderColor: "#37474F" }}>
            <View style={{ backgroundColor: "#4A5470", paddingVertical: 2 }}>
              <Text style={{ ...t(9.2, 700, "#fff"), textAlign: "center" }}>Short answers</Text>
            </View>
            {["Yes, I am.", "No, I'm not.", "Yes, she is.", "No, they aren't."].map((s) => (
              <Text key={s} style={{ ...t(9), paddingLeft: 4, paddingVertical: 3.2, backgroundColor: "#fff" }}>
                - {s}
              </Text>
            ))}
          </View>
        </View>
      </At>
      <At b={[0.855, 0.15, 0.145, 0.11]}>
        <View style={{ backgroundColor: GOLD, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, padding: 5, height: "100%" }}>
          <Text style={{ ...t(9.4, 700, "#fff"), textAlign: "center", backgroundColor: "#F9A825", borderRadius: 4, marginBottom: 2 }}>Short forms</Text>
          {["I am = I'm", "You are = You're", "He is = He's", "It is not = It isn't"].map((s) => (
            <Text key={s} style={t(8.6, 700, SLATE)}>
              {s}
            </Text>
          ))}
        </View>
      </At>
      <ExAt b={[0.13, 0.3, 0.38]} n="5">
        Look at the pictures and complete the sentences with the correct form of the verb <Text style={{ color: BLUE }}>&quot;to be&quot;</Text>.
      </ExAt>
      {(
        [
          [A.faces.f1, <>Grandpa Joe {ans("is")} old.</>],
          [A.boys, <>Tom and Sam {blank(6)} at home.</>],
          [A.faces.f8, <>Ella {blank(6)} sad.</>],
          [art.img("people-3"), <>Mr Reed {blank(6)} a coach.</>],
          [A.cast[0], <>The bus {blank(6)} red.</>],
          [A.park, <>We {blank(6)} in the park.</>],
        ] as [Buffer, React.ReactNode][]
      ).map(([src, cap], i) => (
        <React.Fragment key={i}>
          <Pic b={[0.15 + (i % 2) * 0.19, 0.355 + Math.floor(i / 2) * 0.115, 0.17, 0.085]} src={src} r={3} fit={i === 4 || i === 3 ? "contain" : "cover"} border="#B0BEC5" />
          <At b={[0.148 + (i % 2) * 0.19, 0.353 + Math.floor(i / 2) * 0.115]}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: ["#E53935", "#43A047", "#5E35B1", "#1E88E5", "#FB8C00", "#00897B"][i], alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" }}>
              <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 10, color: "#fff" }}>{i + 1}</Text>
            </View>
          </At>
          <At b={[0.14 + (i % 2) * 0.19, 0.443 + Math.floor(i / 2) * 0.115, 0.19]}>
            <Text style={{ ...t(9.6), textAlign: "center" }}>{cap}</Text>
          </At>
        </React.Fragment>
      ))}
      <At b={[0.12, 0.7, 0.4, 0.27]}>
        <View style={{ height: "100%", backgroundColor: "#FCE4EC", borderRadius: 30 }} />
      </At>
      <At b={[0.15, 0.725, 0.34, 0.235]}>
        <View style={{ height: "100%", backgroundColor: "#fff", borderWidth: 1, borderColor: "#E0E0E0", padding: 8 }}>
          <Ex n="6">
            Complete the sentences with the correct form of the verb <Text style={{ color: BLUE }}>&quot;to be&quot;</Text>.
          </Ex>
          <View style={{ height: 5 }} />
          <Items
            size={10.4}
            gap={3.4}
            items={[<>He {ans("is")} from Canada.</>, `They ${blank(6)} my friends.`, `I ${blank(6)} eleven years old.`, `${blank(6)} you cold?`, `My mum ${blank(6)} a doctor.`, `Our classroom ${blank(6)} on the first floor.`, `The Eiffel Tower ${blank(6)} in Paris.`]}
          />
        </View>
      </At>
      <ExAt b={[0.54, 0.3, 0.42]} n="7">
        Complete the text with <Text style={{ color: BLUE }}>am, is, are</Text>.
      </ExAt>
      <Pic b={[0.53, 0.53, 0.43, 0.2]} src={A.theme1} r={4} pos="50% 45%" />
      <At b={[0.52, 0.335, 0.45, 0.215]}>
        <View style={{ height: "100%", backgroundColor: "#F1F8E9", borderRadius: 120, borderWidth: 2, borderColor: "#C5E1A5", paddingHorizontal: 22, paddingVertical: 12, justifyContent: "center" }}>
          <Text style={{ ...t(10.2), textAlign: "center", lineHeight: 1.45 }}>
            Hi! My name ¹{ans("is")} Leo. I ² {blank(5)} eleven years old and I ³ {blank(5)} in Year 6. My school ⁴ {blank(5)} Hill Park School. My class ⁵ {blank(5)} 6C. My favourite subjects ⁶ {blank(5)} Art and PE. On Mondays, my Art lesson ⁷ {blank(5)} at 10:15. Our teacher ⁸ {blank(5)} Mrs Grant. She ⁹ {blank(5)} very kind. We ¹⁰ {blank(5)} a happy class!
          </Text>
        </View>
      </At>
      <ExAt b={[0.54, 0.75, 0.42]} n="8">
        Make questions and answer them.
      </ExAt>
      <At b={[0.555, 0.78, 0.42]}>
        <Items
          size={10}
          gap={2.6}
          items={[
            <Text key="a" style={t(10)}>
              Leo / ten years old? <Text style={hand(10, BLUE)}>Is Leo ten years old? - No, he isn&apos;t. He&apos;s eleven.</Text>
            </Text>,
            "he / in Year 5?",
            "his school / Green Park School?",
            "his favourite subjects / Maths and Music?",
            "his teacher / Mrs Grant?",
          ]}
        />
      </At>
      <ExAt b={[0.54, 0.915, 0.42]} n="9">
        Write about your school. Use <Text style={{ color: BLUE }}>Ex. 7</Text> as a model.
      </ExAt>
    </BookPage>
  );
}

function P19Speaking() {
  return (
    <BookPage footer={<ThemeFooter n={19} module="A" />}>
      <Fill b={[0, 0, 0.012, 1]} color="#7E57C2" />
      <Fill b={[0.012, 0.92, 0.36, 0.05]} color="#C77DD9" />
      <Tab b={[0.06, 0.03]} label="Speaking" />
      <ExAt b={[0.06, 0.09, 0.42]} n="10">
        Work with a partner. Ask and answer questions as in the example.
      </ExAt>
      <Pic b={[0.05, 0.14, 0.42, 0.36]} src={A.park} r={14} pos="35% 50%" />
      <Bubble b={[0.1, 0.2, 0.22]} color="#F06292" border="#fff" textColor="#fff" size={11} tail="bl" r={3}>
        {"What's your favourite\nday, Sam?"}
      </Bubble>
      <Bubble b={[0.12, 0.27, 0.15]} color="#F06292" border="#fff" textColor="#fff" size={11} tail="bl" r={3}>
        Saturday!
      </Bubble>
      <Bubble b={[0.28, 0.26, 0.18]} color="#64B5F6" border="#fff" textColor="#fff" size={11} tail="br" r={3}>
        {"Friday. What\nabout you?"}
      </Bubble>
      <Tab b={[0.06, 0.52]} label="Listening" faded />
      <At b={[0.06, 0.575, 0.42]} style={{ opacity: 0.55 }}>
        <Ex n="11" audio="1.03">
          Listen and complete the form.
        </Ex>
      </At>
      <At b={[0.012, 0.61, 0.33, 0.3]}>
        <View style={{ height: "100%", backgroundColor: "#fff", borderWidth: 1, borderColor: "#CFD8DC", paddingLeft: 12, paddingTop: 8, transform: "rotate(-1deg)" }}>
          {["Name", "Surname", "Age", "Class", "Favourite subject", "Favourite colour", "Favourite day", "Best friend"].map((f) => (
            <View key={f} style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 7.5 }}>
              <Text style={hand(10.5, "#37474F")}>{f}:</Text>
              <View style={{ flex: 1, borderBottomWidth: 0.8, borderColor: "#455A64", marginLeft: 4, marginRight: 10, height: 10 }} />
            </View>
          ))}
        </View>
      </At>
      <Fill b={[0.32, 0.6, 0.06, 0.32]} color="#90CAF9" />
      <Tab b={[0.5, 0.03]} label={"Everyday\nDialogues"} />
      <At b={[0.56, 0.088]}>
        <Title text="Greetings" size={18} fill="#EC407A" stroke="#ffffff" />
      </At>
      <ExAt b={[0.5, 0.128, 0.45]} n="12" audio="1.04">
        Listen to the dialogue and act it out with your partner.
      </ExAt>
      <At b={[0.51, 0.175, 0.37]}>
        <View style={{ borderWidth: 4, borderColor: "#F06292", backgroundColor: "#fff", padding: 8, transform: "rotate(1deg)" }}>
          {["Hi, I'm Sara. What's your name?", "I'm Daniel. Nice to meet you, Sara.", "Nice to meet you, too. How are you?", "Fine, thanks. And you?"].map((s) => (
            <Text key={s} style={{ ...t(10, 700), lineHeight: 1.45 }}>
              - {s}
            </Text>
          ))}
        </View>
      </At>
      <At b={[0.62, 0.32, 0.38, 0.33]}>
        <Svg width={0.38 * W} height={0.33 * H}>
          <Polygon points={`${0.05 * W},0 ${0.38 * W},${0.06 * H} ${0.38 * W},${0.3 * H} ${0.2 * W},${0.33 * H} ${0.1 * W},${0.14 * H}`} fill="#F3DDB8" />
        </Svg>
      </At>
      <Tab b={[0.5, 0.3]} label="Listening" />
      <ExAt b={[0.51, 0.36, 0.45]} n="13" audio="1.05">
        Listen and write True (T) or False (F).
      </ExAt>
      <At b={[0.51, 0.415, 0.3]}>
        {["Ella is in Year 6.", "It's Monday today.", "Art is on Wednesdays.", "Ella's favourite subject is Music.", "Maths is in the afternoon.", "Ella's best friend is Rosa."].map((s, i) => (
          <View key={s} style={{ flexDirection: "row", marginBottom: 8, alignItems: "flex-start" }}>
            <Text style={{ ...t(10.2, 700), width: 12 }}>{i + 1}</Text>
            <Text style={{ ...t(10.2), marginRight: 6 }}>{s}</Text>
            <View style={{ width: 13, height: 13, borderWidth: 1.4, borderColor: "#F9A825", borderRadius: 3, backgroundColor: "#fff" }} />
          </View>
        ))}
      </At>
      <Pic b={[0.8, 0.37, 0.2, 0.25]} src={art.img("people-5")} fit="contain" />
      <Tab b={[0.5, 0.645]} label="Writing" />
      <ExAt b={[0.51, 0.705, 0.45]} n="14">
        Read Sophie&apos;s email. Then write a similar one about you.
      </ExAt>
      <Pic b={[0.5, 0.74, 0.44, 0.215]} src={A.email} />
      <At b={[0.64, 0.772, 0.285]}>
        <Text style={{ fontFamily: "Andika", fontSize: 10.4, color: "#4A148C", lineHeight: 1.36 }}>
          Hi! My name is Sophie. I go to Bay View School. I&apos;m 11 years old. My favourite colour is blue and my favourite teacher is Mrs Lee. My best friends are Mia and Rosa. I&apos;m really happy today. Write soon!
        </Text>
      </At>
    </BookPage>
  );
}

const ROUTINES = ["hand in your homework", "line up", "pack your bag", "have lunch", "tidy your desk", "read the notice board", "wash your hands", "hang up your coat"];
function P20ModuleB() {
  return (
    <BookPage bg="#EFE6F7" footer={<ThemeFooter n={20} module="B" />}>
      <Fill b={[0.07, 0.015, 0.88, 0.965]} color="#ffffff" />
      <At b={[0.62, 0.03, 0.38, 0.3]}>
        <Svg width={0.38 * W} height={0.3 * H}>
          <Path d={`M${0.1 * W} 0 H${0.38 * W} V${0.3 * H} Q${0.15 * W} ${0.25 * H} ${0.1 * W} 0 Z`} fill="#DCEBF7" />
        </Svg>
      </At>
      <Pic b={[0.76, 0.03, 0.22, 0.19]} src={A.huggi} fit="contain" />
      <ModuleBadge code="1B" />
      <Tab b={[0.13, 0.05]} label="Vocabulary" />
      <ExAt b={[0.13, 0.11, 0.62]} n="1">
        Robo is a new robot at our school. It is learning English. Can you help it?
      </ExAt>
      <WordBanner b={[0.15, 0.14, 0.58, 0.05]} lines={["hand in your homework • line up • pack your bag • have lunch", "tidy your desk • read the notice board • wash your hands • hang up your coat"]} color="#D6E9F8" size={9.4} tilt={0.5} />
      <At b={[0.15, 0.14, 0.58, 0.05]}>
        <View style={{ height: "100%", alignItems: "center", justifyContent: "center", transform: "rotate(0.5deg)" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 9.4, color: SLATE, textAlign: "center", lineHeight: 1.15 }}>{"hand in your homework • line up • pack your bag • have lunch\ntidy your desk • read the notice board • wash your hands • hang up your coat"}</Text>
        </View>
      </At>
      {A.routines.map((r, i) => {
        const x = 0.15 + (i % 4) * 0.205;
        const y = 0.21 + Math.floor(i / 4) * 0.165;
        return (
          <React.Fragment key={i}>
            <At b={[x, y, 0.19, 0.155]}>
              <View style={{ height: "100%", borderWidth: 2.5, borderColor: "#DCE775", borderRadius: 10, backgroundColor: "#fff" }} />
            </At>
            <Pic b={[x + 0.01, y + 0.006, 0.17, 0.11]} src={r} r={4} />
            <At b={[x + 0.012, y + 0.01]}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#E53935", alignItems: "center", justifyContent: "center", borderWidth: 1.2, borderColor: "#fff" }}>
                <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 8.5, color: "#fff" }}>{i + 1}</Text>
              </View>
            </At>
            <Fill b={[x + 0.015, y + 0.14, 0.16, 0.0015]} color="#455A64" />
          </React.Fragment>
        );
      })}
      <ExAt b={[0.13, 0.555, 0.38]} n="2">
        Complete the sentences with the phrases in the box.
      </ExAt>
      <At b={[0.15, 0.59, 0.35, 0.075]}>
        <View style={{ height: "100%", backgroundColor: "#CFE5F5", borderWidth: 1, borderColor: "#90A4AE", justifyContent: "center", transform: "rotate(-0.5deg)" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 9.6, color: SLATE, textAlign: "center", lineHeight: 1.18 }}>{"hand in your homework • line up\npack your bag • have lunch • tidy your desk\nread the notice board • wash your hands\nhang up your coat"}</Text>
        </View>
      </At>
      <At b={[0.14, 0.68, 0.38]}>
        <Items
          size={9.8}
          gap={5.5}
          items={[
            `It's 12:30. Let's go to the canteen and ${blank(12)}.`,
            `Before lunch, you must ${blank(12)} with soap.`,
            `It's the end of the day. Please ${blank(12)} and go home.`,
            `The bell is ringing! Please ${blank(12)} at the door.`,
            `Your desk is a mess! Please ${blank(12)}.`,
            `Come in and ${blank(12)} on the hook.`,
            `There is news about the trip. Go and ${blank(12)}.`,
            `It's Monday. Please ${blank(12)} on my desk.`,
          ]}
        />
      </At>
      <ExAt b={[0.55, 0.555, 0.4]} n="3">
        Match the phrases with the sentences.
      </ExAt>
      <At b={[0.56, 0.59, 0.39, 0.075]}>
        <View style={{ height: "100%", backgroundColor: "#CFE5F5", borderWidth: 1, borderColor: "#90A4AE", flexDirection: "row", flexWrap: "wrap", padding: 4, paddingLeft: 10 }}>
          {ROUTINES.map((r, i) => (
            <Text key={r} style={{ width: "50%", fontFamily: "Baloo", fontWeight: 700, fontSize: 8.4, color: SLATE, lineHeight: 1.2 }}>
              <Text style={{ color: "#E53935" }}>{"abcdefgh"[i]}.</Text> {r}
            </Text>
          ))}
        </View>
      </At>
      <At b={[0.56, 0.68, 0.38]}>
        {[
          "It's raining and your coat is wet.",
          "You are hungry.",
          "Your hands are dirty after the Art lesson.",
          "Your homework is ready.",
          "There are pens and paper all over your desk.",
          "You want to know about the school trip.",
          "It's time to go out to the playground.",
          "The lessons are finished for today.",
        ].map((s, i) => (
          <View key={s} style={{ flexDirection: "row", marginBottom: 7.5 }}>
            <Text style={{ ...t(9.8, 700), width: 11 }}>{i + 1}</Text>
            <Text style={{ ...t(9.8), flex: 1 }}>{s}</Text>
            <View style={{ width: 11, height: 12, borderWidth: 1, borderColor: "#455A64", borderRadius: 2 }} />
          </View>
        ))}
      </At>
    </BookPage>
  );
}

const BUBBLES5 = ["am Lucy.", "are my friend.", "is my brother.", "is my sister.", "is my cat.", "are in Year 6.", "are from Spain.", "are twins!"];
function P21Pronouns() {
  return (
    <BookPage bg="#F1EAF8" footer={<ThemeFooter n={21} module="B" />}>
      <Fill b={[0.04, 0.015, 0.92, 0.965]} color="#ffffff" />
      <Tab b={[0.08, 0.03]} label="Grammar" />
      <Pic b={[0.33, 0.035, 0.12, 0.075]} src={A.faces.f9} fit="contain" />
      <At b={[0.08, 0.1, 0.36, 0.26]}>
        <View style={{ height: "100%", borderWidth: 3, borderColor: "#F2C230", borderRadius: 18, backgroundColor: "#FFFDF0", padding: 10, paddingTop: 0 }}>
          <View style={{ backgroundColor: "#F6B913", marginLeft: -10, marginRight: 30, paddingVertical: 4, paddingLeft: 12, borderTopLeftRadius: 14 }}>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 13.5, color: "#fff", lineHeight: 1.1 }}>{"Subject pronouns\nPossessive adjectives"}</Text>
          </View>
          <View style={{ flexDirection: "row", marginTop: 8, justifyContent: "center" }}>
            {[
              ["Subject pronouns", ["I", "You", "He", "She", "It", "We", "You", "They"]],
              ["Possessive adjectives", ["my", "your", "his", "her", "its", "our", "your", "their"]],
            ].map(([h, xs]) => (
              <View key={h as string} style={{ width: 0.15 * W, borderWidth: 1, borderColor: "#37474F", marginHorizontal: 3 }}>
                <Text style={{ ...t(8.6, 700, "#fff"), backgroundColor: "#4A5470", textAlign: "center", paddingVertical: 2 }}>{h as string}</Text>
                {(xs as string[]).map((x, i) => (
                  <Text key={i} style={{ ...t(9.6), textAlign: "center", lineHeight: 1.32 }}>
                    {x}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>
      </At>
      <ExAt b={[0.08, 0.39, 0.38]} n="4">
        Write the correct <Text style={{ color: BLUE }}>subject pronouns</Text>.
      </ExAt>
      <At b={[0.09, 0.44, 0.38]}>
        <Items cols={2} size={10.2} gap={9} items={[<>Tom and Ann {ans("they")}</>, `You and I ${blank(6)}`, `A pencil ${blank(6)}`, `Dogs ${blank(6)}`, `Books ${blank(6)}`, `A cat ${blank(6)}`, `Mrs Hall ${blank(6)}`, `Mr Jones ${blank(6)}`]} />
      </At>
      <ExAt b={[0.08, 0.6, 0.38]} n="5">
        Complete the speech bubbles with the correct <Text style={{ color: BLUE }}>subject pronouns</Text>.
      </ExAt>
      {A.frames5.map((f, i) => {
        const x = 0.08 + (i % 2) * 0.19;
        const y = 0.645 + Math.floor(i / 2) * 0.077;
        return (
          <React.Fragment key={i}>
            <Pic b={[x, y, 0.18, 0.072]} src={f} />
            <At b={[x + 0.003, y + 0.045]}>
              <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 14, color: "#fff", backgroundColor: "#E53935", paddingHorizontal: 3 }}>{i + 1}</Text>
            </At>
            <At b={[x + 0.05, y + 0.004, 0.125]}>
              <View style={{ backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#5C6BC0", paddingHorizontal: 3 }}>
                <Text style={{ ...hand(8.8), textAlign: "center" }}>
                  {i === 0 ? <Text style={{ color: BLUE }}>I </Text> : "___ "}
                  {BUBBLES5[i]}
                </Text>
              </View>
            </At>
          </React.Fragment>
        );
      })}
      <ExAt b={[0.48, 0.04, 0.47]} n="6">
        Look at the pictures and complete the sentences with the correct <Text style={{ color: BLUE }}>possessive adjectives</Text>.
      </ExAt>
      <Pic b={[0.48, 0.105, 0.22, 0.13]} src={A.faces.f4} />
      <Pic b={[0.71, 0.1, 0.24, 0.14]} src={art.img("people-7")} fit="contain" />
      <Pic b={[0.5, 0.245, 0.24, 0.13]} src={A.familyHome} pos="30% 50%" />
      <Pic b={[0.75, 0.25, 0.2, 0.12]} src={A.cast[0]} fit="contain" />
      {[[0.485, 0.2], [0.89, 0.2], [0.505, 0.33], [0.9, 0.33]].map(([x, y], i) => (
        <At key={i} b={[x, y]}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 26, color: "#fff", backgroundColor: "#263238", paddingHorizontal: 6, borderRadius: 14 }}>{i + 1}</Text>
        </At>
      ))}
      <At b={[0.52, 0.39, 0.42, 0.2]}>
        <View style={{ height: "100%", borderWidth: 1.2, borderColor: "#C62828", backgroundColor: "#fff", padding: 8, paddingLeft: 12 }}>
          <Items
            size={10.2}
            gap={3}
            items={[
              <>{ans("Her")} name is Lily.</>,
              `${blank(8)} name is Mr Brown.`,
              `${blank(8)} names are Sam and Kate.`,
              `${blank(8)} name is Star-Bus.`,
              <Text key="5" style={t(10.2)}>
                <B>a:</B> What is your name?{"\n"}
                <B>b:</B> {blank(6)} name is {blank(10)}.
              </Text>,
              <Text key="6" style={t(10.2)}>
                <B>a:</B> What is the name of your school?{"\n"}
                <B>b:</B> {blank(6)} school is {blank(10)}.
              </Text>,
            ]}
          />
        </View>
      </At>
      <ExAt b={[0.5, 0.61, 0.46]} n="7">
        Look at the picture and complete the text with the correct <Text style={{ color: BLUE }}>possessive adjectives</Text>.
      </ExAt>
      <At b={[0.51, 0.67, 0.22]}>
        <Text style={{ fontFamily: "Andika", fontSize: 11.2, lineHeight: 2.0 }}>
          Hi! ¹{ans("My")} name is Sam and this is my family. My mum - ² {blank(6)} name is Kate. My dad - ³ {blank(6)} name is Mark. ⁴ {blank(6)} surname is Lee. And the cats? ⁵ {blank(6)} names are Tiger and Smudge! What&apos;s ⁶ {blank(6)} name?
        </Text>
      </At>
      <Pic b={[0.74, 0.66, 0.23, 0.16]} src={A.familyHome} r={2} border="#ffffff" />
      <Pic b={[0.76, 0.82, 0.18, 0.13]} src={A.faces.f6} fit="contain" />
    </BookPage>
  );
}

function P22Speaking() {
  return (
    <BookPage bg="#E9F3FB" footer={<ThemeFooter n={22} module="B" />}>
      <Fill b={[0.08, 0.025, 0.86, 0.96]} color="#ffffff" />
      <At b={[0.08, 0.025, 0.34, 0.24]}>
        <View style={{ height: "100%", backgroundColor: "#D6EAF8", borderBottomRightRadius: 160 }} />
      </At>
      <Tab b={[0.13, 0.045]} label="Speaking" />
      <At b={[0.13, 0.105, 0.36]}>
        <Ex n="8.a">Work with a partner. Read the words in the box and put them into five groups. There are four words in each group.</Ex>
        <View style={{ height: 3 }} />
        <Ex n="8.b">Think of a title for each group.</Ex>
      </At>
      <At b={[0.14, 0.215, 0.36, 0.085]}>
        <View style={{ height: "100%", backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#F2C230", borderStyle: "dashed", justifyContent: "center", padding: 4, transform: "rotate(-1deg)" }}>
          <Text style={{ fontFamily: "Andika", fontWeight: 700, fontSize: 9.3, color: "#283593", textAlign: "center", lineHeight: 1.3 }}>
            {"evening - shy - Music - Sunday - pink\nfunny - Wednesday - night - brown - Science\nclever - morning - Geography - grey - Saturday\nafternoon - English - kind - Monday - green"}
          </Text>
        </View>
      </At>
      <Pic b={[0.16, 0.355, 0.33, 0.155]} src={A.boys} r={4} pos="50% 40%" />
      <Bubble b={[0.24, 0.31, 0.23]} tail="bl" font="Noto" size={10} center={false} border="#64B5F6" r={2}>
        {"Group 1\nDays: Sunday, Monday ..."}
      </Bubble>
      <Tab b={[0.12, 0.525]} label="Listening" />
      <ExAt b={[0.13, 0.585, 0.36]} n="9" audio="1.06">
        Listen to the dialogues and complete the sentences.
      </ExAt>
      <At b={[0.15, 0.635, 0.36]}>
        <Items
          size={9.8}
          gap={5}
          items={[
            `A: Is Anna shy, Tom?\nB: No, ${blank(4)} isn't. ${blank(4)} is very friendly.`,
            `A: Are Leo and Max in your class?\nB: Yes, ${blank(5)} are.`,
            `A: ${blank(4)} Mrs Kim your Science teacher?\nB: No, ${blank(4)} isn't. ${blank(4)} is ${blank(4)} Music teacher.`,
            `A: Are ${blank(4)} in the school team?\nB: No, ${blank(4)} aren't. ${blank(4)} are in the chess club.`,
            `A: Is Pedro from Mexico?\nB: Yes, ${blank(4)} is from Mexico City.`,
            `A: Is this ${blank(5)} pencil case, Ella?\nB: Yes, it's ${blank(5)} pencil case.`,
          ]}
        />
      </At>
      <Tab b={[0.53, 0.04]} label={"Everyday\nDialogues"} />
      <At b={[0.62, 0.1, 0.33]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#5D4037", textAlign: "right", lineHeight: 1 }}>{"Asking about age\nand personality"}</Text>
      </At>
      <ExAt b={[0.53, 0.155, 0.42]} n="10" audio="1.07">
        Listen to the dialogue and act it out with your partner.
      </ExAt>
      <At b={[0.55, 0.205, 0.39]}>
        <View style={{ borderWidth: 5, borderColor: "#9575CD", backgroundColor: "#fff", padding: 7 }}>
          {["Hi, Ben! How old are you?", "I'm twelve. And you?", "I'm eleven. What are you like?", "I'm friendly and a bit noisy!"].map((s) => (
            <Text key={s} style={{ ...t(10, 700), lineHeight: 1.4 }}>
              - {s}
            </Text>
          ))}
        </View>
      </At>
      <Tab b={[0.53, 0.335]} label="Listening" />
      <ExAt b={[0.53, 0.39, 0.42]} n="11" audio="1.08">
        Listen and complete the sentences with the phrases in the box.
      </ExAt>
      <WordBanner b={[0.55, 0.435, 0.41, 0.06]} lines={["hand in your homework • line up", "pack your bag • have lunch • tidy your desk", "read the notice board • wash your hands"]} color="#8E44AD" size={9.4} tilt={0} />
      <At b={[0.55, 0.51, 0.4]}>
        <Items
          size={9.8}
          gap={2.6}
          items={[
            `After Art, we always ${blank(14)}.`,
            `At 12:15 we go to the canteen and ${blank(12)}.`,
            `Please ${blank(14)} before you go home.`,
            `When the bell rings, we ${blank(10)} at the door.`,
            `Can I ${blank(14)} now, Miss Clark?`,
            `I ${blank(14)} every morning to see the news.`,
            `At the end of the day, we ${blank(12)}.`,
          ]}
        />
      </At>
      <Tab b={[0.53, 0.655]} label="Writing" />
      <ExAt b={[0.53, 0.71, 0.43]} n="12" size={10}>
        Imagine you are at a summer language school in Australia. Write a postcard to a friend at home. Use the phrases and your own ideas.
      </ExAt>
      <Pic b={[0.54, 0.775, 0.41, 0.19]} src={A.postcard} />
      <At b={[0.7, 0.8, 0.24]}>
        <Text style={{ fontFamily: "Andika", fontSize: 10.6, color: "#1A237E", lineHeight: 1.32 }}>{"Dear ...,\nHow are you?\nI'm fine. / I'm great.\nMy teacher is ...\nMy new friend is ...\nSee you soon! / Love, ..."}</Text>
      </At>
    </BookPage>
  );
}

// --- real-book parts --------------------------------------------------------------------------
const TITLE = "Bright Days";
function Cover() {
  return (
    <Page size={[W, H]} style={{ backgroundColor: "#7EC8F2" }}>
      <Pic b={[0, 0, 1, 1]} src={A.cover} />
      <At b={[0.06, 0.05, 0.88]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 72, color: "#fff", textAlign: "center", lineHeight: 1 }}>{TITLE}</Text>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 18, color: "#1A237E", textAlign: "center", marginTop: 2 }}>English for young learners</Text>
      </At>
      <At b={[0.08, 0.2, 0.2]}>
        <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: MAGENTA, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center", transform: "rotate(-8deg)" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 38, color: "#fff", lineHeight: 1, marginTop: 8 }}>1</Text>
        </View>
      </At>
      <At b={[0.72, 0.19, 0.2]}>
        <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: GOLD, alignItems: "center", justifyContent: "center", transform: "rotate(10deg)" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 24, color: SLATE, marginTop: 3 }}>A1</Text>
        </View>
      </At>
      <At b={[0.34, 0.2, 0.32]}>
        <View style={{ backgroundColor: "#E53935", borderRadius: 16, paddingVertical: 4, borderWidth: 2, borderColor: "#fff" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 17, color: "#fff", textAlign: "center", marginTop: 2 }}>Student&apos;s Book</Text>
        </View>
      </At>
    </Page>
  );
}

function Imprint() {
  return (
    <Page size={[W, H]} style={{ backgroundColor: "#fff", padding: 56 }}>
      <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 30, color: STARTER_BLUE }}>{TITLE} 1</Text>
      <Text style={{ ...t(11, 700, MAGENTA), marginBottom: 14 }}>Student&apos;s Book · English for young learners · CEFR A1</Text>
      <Text style={{ ...t(10), marginBottom: 8 }}>
        This sample contains the Starter unit and Theme 1 &quot;School Life&quot; (modules A and B). It was made by hand as a reference for an automatic coursebook maker: the page plan, page types, furniture and density follow a printed A1 coursebook (photographed with a phone), while every character, text, exercise and picture is new.
      </Text>
      <Text style={{ ...t(11, 700), marginTop: 10, marginBottom: 6 }}>Meet the characters</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {(["Star-Bus", "Zara", "Theo", "Officer K-77", "Pip", "Maya", "Mr Okafor"] as const).map((n, i) => (
          <View key={n} style={{ width: "25%", alignItems: "center", marginBottom: 10 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={srcOf(A.cast[i])} style={{ width: 90, height: 90, objectFit: "contain" }} />
            <Text style={t(9.5, 700)}>{n}</Text>
          </View>
        ))}
      </View>
      <View style={{ position: "absolute", left: 56, right: 56, bottom: 56 }}>
        <Text style={{ ...t(8.5), color: "#555" }}>
          Pictures: generated illustrations (GPT Image) and drawings made for this book. Small pictures: Twemoji, © Twitter, Inc. and other contributors, CC-BY 4.0. Fonts: Noto Sans, Baloo 2, Andika, Nunito (SIL Open Font License).
        </Text>
        <Text style={{ ...t(8.5), color: "#555", marginTop: 6 }}>Audio track codes (S.01, 1.01 ...) refer to the class audio. Not for sale - reference sample.</Text>
      </View>
    </Page>
  );
}

const UNITS: { name: string; pp: string; col: string; v: string[]; g: string[]; r: string[]; w: string[]; s: string[]; d: string[] }[] = [
  { name: "My School", pp: "15 - 35", col: "#5DADE2", v: ["People at school", "School rules", "Things we do at school"], g: ['The verb "to be"', "Subject pronouns & possessive adjectives", "Question words", "Imperatives", "like / love / hate + -ing", "must / can (permission)"], r: ["Moon Visitors", "Clubs Are Cool!", "Dos and Don'ts"], w: ["Write a reply to an email.", "Write a postcard to a friend.", "Write your class rules."], s: ["Ask and answer about favourites.", "Guess the job.", "Talk about the things you like and hate."], d: ["Greetings", "Asking about age and personality", "Giving directions at school"] },
  { name: "School Days", pp: "36 - 50", col: "#EC407A", v: ["Daily routines", "School subjects", "Feelings"], g: ["Present simple", "Adverbs of frequency", "Object pronouns", "have to"], r: ["A Day on a Boat School"], w: ["Write an email about your day.", "Answer questions about a diary."], s: ["Ask and answer about routines.", "Talk about the rules at home."], d: ["Asking about frequency", "Asking for the time", "Making plans"] },
  { name: "All About Me", pp: "51 - 71", col: "#F5A25D", v: ["Appearance", "Clothes", "Personality"], g: ["have got", "can", "Present continuous", "Possessive 's", "Comparatives"], r: ["Super Talents", "Hot Day, Cold Day", "The Kite Festival"], w: ["Describe your best friend.", "Write about your talents.", "Write a party invitation."], s: ["Guess who it is.", "Mime a talent.", "Compare two pets."], d: ["What do you look like?", "Inviting - accepting - refusing", "Saying what you prefer"] },
  { name: "Home and Family", pp: "72 - 84", col: "#8BC34A", v: ["Family members", "Jobs", "Rooms and furniture"], g: ["Present continuous for the future", "will", "be going to"], r: ["Teens at Work", "My Life in 2040"], w: ["Write about a family trip.", "Write an email to a cousin."], s: ["Talk about weekend plans.", "Predict your future."], d: ["Making a request", "Talking about the future"] },
  { name: "Around Town", pp: "85 - 97", col: "#9575CD", v: ["Places in town", "Transport"], g: ["Past simple"], r: ["City Break!", "Lost at the Station"], w: ["Write about last weekend.", "Write a short story."], s: ["Say where you were yesterday.", "Ask about a holiday."], d: ["Asking for information", "Sequencing words"] },
  { name: "Food and Fun", pp: "98 - 114", col: "#C850C0", v: ["Food and cooking"], g: ["Countable / uncountable", "some / any", "How much? / How many?", "Superlatives"], r: ["Healthy Lunchboxes", "A Party Menu"], w: ["Write a recipe.", "Write an email about a restaurant."], s: ["Plan a class party.", "Order a meal."], d: ["Shopping", "Booking a table"] },
  { name: "Wild World", pp: "115 - 127", col: "#F4D03F", v: ["Countries", "Landscapes", "Animals"], g: ["Past continuous", "should"], r: ["The Long Way Home", "Lucky Escapes"], w: ["Describe an event.", "Write about a problem and a solution."], s: ["Tell a true or false story.", "Talk about saving animals."], d: ["when / while", "Asking for advice"] },
  { name: "Space and Beyond", pp: "128 - 134", col: "#48C9B0", v: ["Space"], g: ["Zero conditional", "First conditional"], r: ["A Day on the Moon"], w: ["—"], s: ["Make if-sentences with a partner."], d: ["Firstly, secondly, finally"] },
];
function ContentsLeft() {
  const cols: [string, string][] = [["VOCABULARY", "#4DB6AC"], ["GRAMMAR", "#5C6BC0"], ["READING", "#E91E63"], ["LISTENING", "#FF7043"]];
  return (
    <Page size={[W, H]} style={{ backgroundColor: "#fff" }}>
      <At b={[0, 0, 0.5, 0.1]}>
        <View style={{ height: "100%", backgroundColor: "#D1D9FF", borderBottomRightRadius: 80 }} />
      </At>
      <At b={[0.05, 0.02]}>
        <Title text="CONTENTS" size={30} fill="#FFC107" stroke="#6D4C00" />
      </At>
      <At b={[0.25, 0.075, 0.75, 0.025]}>
        <View style={{ backgroundColor: "#5C6BC0", height: "100%", borderTopLeftRadius: 12, borderBottomLeftRadius: 12, justifyContent: "center", paddingLeft: 10 }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 12, color: "#fff", marginTop: 2 }}>STARTER pp. 7 - 14 · alphabet, colours, numbers, days, time, greetings, classroom language, jobs</Text>
        </View>
      </At>
      <ContentsGrid cols={cols} first fields={(u) => [u.v, u.g, u.r, ["Short dialogues"]]} />
    </Page>
  );
}
function ContentsRight() {
  const cols: [string, string][] = [["WRITING", "#AB47BC"], ["SPEAKING", "#EC407A"], ["EVERYDAY DIALOGUES", "#42A5F5"]];
  return (
    <Page size={[W, H]} style={{ backgroundColor: "#fff" }}>
      <ContentsGrid cols={cols} fields={(u) => [u.w, u.s, u.d]} />
    </Page>
  );
}
function ContentsGrid({ cols, first, fields }: { cols: [string, string][]; first?: boolean; fields: (u: (typeof UNITS)[number]) => string[][] }) {
  const x0 = first ? 0.2 : 0.02;
  const wAll = first ? 0.8 : 0.93;
  const top = 0.11;
  const rowH = 0.105;
  return (
    <>
      {cols.map(([c, col], i) => (
        <At key={c} b={[x0 + (i * wAll) / cols.length + 0.003, top, wAll / cols.length - 0.006, 0.035]}>
          <View style={{ height: "100%", backgroundColor: col, borderTopLeftRadius: 10, borderTopRightRadius: 10, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: cols.length === 3 ? 12 : 11, color: "#fff", marginTop: 2 }}>{c}</Text>
          </View>
        </At>
      ))}
      {UNITS.map((u, r) => {
        const y = top + 0.04 + r * rowH;
        return (
          <React.Fragment key={u.name}>
            <Fill b={[first ? 0.03 : 0.02, y, first ? 0.97 : 0.93, rowH - 0.004]} color={u.col} opacity={0.35} />
            {first ? (
              <At b={[0.035, y + 0.003, 0.16, rowH - 0.01]}>
                <View style={{ height: "100%", backgroundColor: u.col, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 11, color: "#fff", textAlign: "center", lineHeight: 1 }}>{u.name}</Text>
                  <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 36, color: "#fff", lineHeight: 1 }}>{r + 1}</Text>
                  <Text style={{ fontFamily: "Baloo", fontWeight: 500, fontSize: 9, color: "#fff" }}>pp. {u.pp}</Text>
                </View>
              </At>
            ) : null}
            {fields(u).map((cell, i) => (
              <At key={i} b={[x0 + (i * wAll) / cols.length + 0.008, y + 0.004, wAll / cols.length - 0.014]}>
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

function BackCover() {
  return (
    <Page size={[W, H]} style={{ backgroundColor: STARTER_BLUE }}>
      <Pic b={[0, 0.55, 1, 0.45]} src={A.cover} pos="50% 85%" />
      <At b={[0.1, 0.08, 0.8]}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 36, color: "#fff" }}>{TITLE} 1</Text>
        <Text style={{ ...t(12, 400, "#fff"), marginTop: 8, lineHeight: 1.45 }}>
          Zara and Theo come from Moon Base Luna - and this year they visit a school on Earth! Join them, Star-Bus and Pip the robot owl as they learn the rules, make new friends and discover English, one bright day at a time.
        </Text>
        {["A Starter unit that revises the basics: letters, colours, numbers, time and greetings", "Eight themes with modules A, B and C", "A comic story at the start of every theme", "Everyday Dialogues for real-life English", "Class audio for every listening task"].map((f) => (
          <View key={f} style={{ flexDirection: "row", marginTop: 7 }}>
            <Text style={{ fontFamily: "Sym", fontSize: 12, color: GOLD, width: 18 }}>✓</Text>
            <Text style={{ ...t(11, 700, "#fff"), flex: 1 }}>{f}</Text>
          </View>
        ))}
      </At>
      <At b={[0.76, 0.43, 0.2]}>
        <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: GOLD, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 13, color: SLATE, marginTop: 2 }}>CEFR</Text>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 24, color: SLATE, lineHeight: 0.9 }}>A1</Text>
        </View>
      </At>
    </Page>
  );
}

async function main() {
  A = await loadAssets();
  const doc = (
    <Document title={`${TITLE} 1 - Student's Book (sample)`} author="hand-made reference">
      <Cover />
      <Imprint />
      <ContentsLeft />
      <ContentsRight />
      <P7StarterOpener />
      <P8Alphabet />
      <P9Colours />
      <P10Numbers />
      <P11Time />
      <P12Classroom />
      <P13Jobs />
      <P14Places />
      <P15ThemeOpener />
      <P16Story />
      <P17Vocabulary />
      <P18Grammar />
      <P19Speaking />
      <P20ModuleB />
      <P21Pronouns />
      <P22Speaking />
      <BackCover />
    </Document>
  );
  const out = path.join(process.cwd(), ".handmade-scan", "student-book.pdf");
  fs.writeFileSync(out, await renderToBuffer(doc));
  console.log("->", out);
}
void main();
