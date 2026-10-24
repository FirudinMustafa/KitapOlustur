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
    familyTree: await art.familyTree(),
    chalkboard: await art.chalkboard(),
    landmarks: await art.landmarkCollage(),
    clocks: await art.clocks(),
    moves: await art.cardGrid("moves", Array.from({ length: 9 }, (_, i) => card(`w-moves-${i + 1}`)), 3, { caption: 64, tiles: ["#E8F5E9", "#E3F2FD", "#FFF8E1"] }),
    modules: await art.cardGrid("modules", ["1a-cards-4", "1c-cards-7", "w-landmarks-2", "d-games-3", "w-family-2", "1b-cards-6", "f-fun-4"].map(card), 4, { caption: 70, tiles: ["#B3E5FC", "#F8BBD0", "#C8E6C9", "#FFE0B2", "#D1C4E9", "#FFF59D", "#B2DFDB"] }),
    scene1a: card("1a-scene"),
    vocab1a: await art.cardGrid("vocab-1a", Array.from({ length: 6 }, (_, i) => card(`1a-cards-${i + 1}`)), 3, { caption: 56 }),
    didYouKnow: await art.didYouKnow(),
    girl: card("w-family-10"),
    scene1b: card("1b-scene"),
    chores: await art.cardGrid("chores-1b", Array.from({ length: 6 }, (_, i) => card(`1b-cards-${i + 1}`)), 3, { caption: 56, tiles: ["#FFF3E0", "#E1F5FE", "#F3E5F5"] }),
    party: card("1b-party"),
    hobbies: await art.cardGrid("hobbies-1c", Array.from({ length: 8 }, (_, i) => card(`1c-cards-${i + 1}`)), 4, { tiles: ["#FFCDD2", "#C5CAE9", "#FFF9C4", "#C8E6C9", "#B3E5FC", "#F8BBD0", "#FFE0B2", "#DCEDC8"] }),
    quiz: card("1c-quiz"),
    park: card("1c-park"),
    listenFaces: await art.stackedFaces("listen-faces", ["w-family-7", "w-family-8", "w-family-10"], ["#4FC3F7", "#F06292", "#AED581"]),
    games: [1, 2, 3, 4].map((i) => card(`d-games-${i}`)),
    likeScale: await art.likeScale(["😍", "🙂", "😐", "🙁", "😖"].map((e) => Buffer.from((emoji[e] ?? "").split(",")[1] ?? "", "base64"))),
    talkFaces: await art.stackedFaces("talk-faces", ["w-family-9", "w-family-7", "w-family-8"], ["#FFB74D", "#4DB6AC", "#BA68C8"]),
    comic: card("c-comic"),
    fun: [1, 2, 3, 4].map((i) => card(`f-fun-${i}`)),
    nowICan: await art.nowICan(),
    hobbyCards: Array.from({ length: 8 }, (_, i) => card(`1c-cards-${i + 1}`)),
    roomCards: Array.from({ length: 6 }, (_, i) => card(`1a-cards-${i + 1}`)),
    choreCards: Array.from({ length: 6 }, (_, i) => card(`1b-cards-${i + 1}`)),
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
function Ex({ n, children, listen, mt = 3, color = INK, tag }: { n: string; children: React.ReactNode; listen?: boolean; mt?: number; color?: string; tag?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", marginTop: mt, marginBottom: 2.5 }} wrap={false}>
      <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 14, color: RED, width: n.length > 1 ? 22 : 15, lineHeight: 1 }}>{n}</Text>
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

function EmailBox({ head, children, ml = 15, w }: { head?: string[]; children: React.ReactNode; ml?: number; w?: number | string }) {
  return (
    <View style={{ marginLeft: ml, borderWidth: 1.2, borderColor: "#90A4AE", borderRadius: 5, overflow: "hidden", marginBottom: 4, ...(w ? { width: w } : {}) }}>
      <View style={{ backgroundColor: "#CFD8DC", height: 13, flexDirection: "row", alignItems: "center", paddingHorizontal: 4, gap: 3 }}>
        {["#EF5350", "#FFCA28", "#66BB6A"].map((c) => (
          <View key={c} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
        ))}
      </View>
      <View style={{ padding: 6, backgroundColor: "#fff" }}>
        {head?.map((h) => (
          <Text key={h} style={{ ...t(9.2), borderBottomWidth: 0.5, borderColor: "#CFD8DC", marginBottom: 1 }}>
            {h}
          </Text>
        ))}
        {children}
      </View>
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
// WELCOME MODULE (source pp.6-11)
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

function P4() {
  return (
    <BookPage n={4} label="Welcome Module" bg="#DCEB9A">
      <Puzzle l={W - 92} tp={-6} c="#F06292" s={44} rot={12} />
      <Puzzle l={W - 52} tp={20} c="#FFD54F" s={34} rot={-20} />
      <Abs l={CW - 232} tp={6} w={232} h={214}>
        <Pic src={A.friends} w={232} h={214} r={14} border="#fff" />
      </Abs>
      <View style={{ width: 300 }}>
        <UnitTitle title="Let's Begin!" />
        <Ex n="1" listen>
          a) Read and complete the dialogue with the phrases below. Listen and check.
        </Ex>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: 15, marginVertical: 3, gap: 4 }}>
          {["How's it going", "This is my cousin", "Where do you live", "Nice to meet you", "How old are you", "Not bad, thanks"].map((p) => (
            <Text key={p} style={{ ...t(9.4), backgroundColor: "#fff", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1.5, borderWidth: 0.8, borderColor: "#AED581" }}>
              • {p}
            </Text>
          ))}
        </View>
        <View style={{ marginLeft: 15, backgroundColor: "#ffffffcc", borderRadius: 8, padding: 7 }}>
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
      <Ex n="2" mt={9}>
        a) Look at Leo&apos;s family tree. Complete the sentences with words from the box.
      </Ex>
      <WordBox words={["aunt", "uncle", "cousin", "daughter", "wife", "granddad", "nephew", "niece", "son"]} color={GREEN} />
      <Items
        cols={2}
        items={[
          <Text key="1" style={t()}>Leo is Ruth&apos;s <Text style={{ color: BLUE, fontWeight: 700 }}>grandson</Text>.</Text>,
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
      <Abs l={0} tp={500} w={150}>
        <Sub ml={15}>b) Who is Jack&apos;s mum? Who is Ella&apos;s uncle? Who is Mia&apos;s aunt? Ask and answer in class.</Sub>
        <Text style={{ ...it(9.4), marginLeft: 15, marginTop: 4 }}>A: Who is Jack&apos;s mum?{"\n"}B: Anna. Who is ...?</Text>
      </Abs>
      <Abs l={170} tp={478} w={420} h={266}>
        <Pic src={A.familyTree} w={420} h={266} fit="contain" r={0} />
      </Abs>
    </BookPage>
  );
}

function P5() {
  const nums = [
    { n: "37", c: "#43A047", w: "thirty-seven" },
    { n: "14", c: "#1E88E5" },
    { n: "58", c: "#E53935" },
    { n: "90", c: "#8E24AA" },
    { n: "26", c: "#FB8C00" },
    { n: "71", c: "#00ACC1" },
  ];
  return (
    <BookPage n={5} label="Welcome Module">
      <Ex n="3">What&apos;s the subject? Look, choose and write.</Ex>
      <View style={{ marginTop: 4, marginBottom: 4 }}>
        <Pic src={A.chalkboard} w={CW} h={CW / 2.344} fit="contain" r={0} />
      </View>
      <WordBox words={["Art", "Maths", "Music", "Science", "History", "PE", "IT"]} color={RED} />
      <View style={{ flexDirection: "row", gap: GAP, marginTop: 4 }}>
        <View style={{ width: COL }}>
          <Ex n="4">Write the numbers.</Ex>
          {nums.map((x, i) => (
            <View key={x.n} style={{ flexDirection: "row", alignItems: "flex-end", marginLeft: 15, marginBottom: 4 }}>
              <View style={{ width: 42, height: 28, borderRadius: 6, backgroundColor: x.c, transform: `rotate(${i % 2 ? 4 : -5}deg)` }}>
                <Text style={{ fontFamily: "Noto", fontWeight: 700, fontSize: 17, color: "#fff", width: 42, textAlign: "center", marginTop: 2, lineHeight: 1.2 }}>{x.n}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10, borderBottomWidth: 0.8, borderColor: "#9E9E9E", height: 18 }}>
                {x.w ? <Text style={{ ...t(10, 700, BLUE) }}>{x.w}</Text> : null}
              </View>
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
              <View key={w} style={{ width: "50%", marginBottom: 6, paddingRight: 8 }}>
                <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 13, color: c }}>{w}:</Text>
                <View style={{ borderBottomWidth: 0.8, borderColor: "#9E9E9E", height: 14 }}>{a ? <Text style={t(10, 700, BLUE)}>{a}</Text> : null}</View>
              </View>
            ))}
          </View>
          <Ex n="7">Complete the short dialogues. Then take roles and act out.</Ex>
          <Items
            rowGap={4}
            items={[
              <Text key="1" style={t()}>A: Is your mum&apos;s birthday on the <Text style={{ color: BLUE, fontWeight: 700 }}>twentieth</Text> (20) of May?{"\n"}B: No, it&apos;s on the {GAPLINE} (21).</Text>,
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
  const ch = W / 1.5417;
  const tags = ["The Taj Mahal", "The Sydney Opera House", "The Great Wall", "Christ the Redeemer", "Mount Fuji", "The Sagrada Família"];
  return (
    <BookPage n={6} label="Welcome Module" strip={false}>
      <UnitTitle title="Let's Begin!" />
      <Ex n="1">Are you good at Geography? Look and say the country.</Ex>
      <View style={{ flexDirection: "row", marginLeft: 15, gap: 12 }}>
        {countries.map(([c, col]) => (
          <Text key={c} style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 14, color: col }}>
            {c}
          </Text>
        ))}
      </View>
      <Text style={{ ...it(), marginLeft: 15 }}>The Taj Mahal is in India.</Text>
      <Abs l={-ML} tp={86} w={W} h={ch}>
        <Pic src={A.landmarks} w={W} h={ch} fit="contain" r={0} />
        {art.LANDMARK_TILES.map((tile, i) => (
          <Text
            key={i}
            style={{ position: "absolute", left: ((tile.x + 20) / 1480) * W, top: ((tile.y + tile.h - 18) / 960) * ch, ...t(8.6, 700, "#fff"), backgroundColor: ["#E53935", "#1E88E5", "#43A047", "#FB8C00", "#8E24AA", "#00897B"][i], paddingHorizontal: 5, borderRadius: 4 }}
          >
            {tags[i]}
          </Text>
        ))}
      </Abs>
      <View style={{ flexDirection: "row", gap: GAP, marginTop: ch + 6 - 56 }}>
        <View style={{ width: COL - 30 }}>
          <Ex n="2">Complete the table.</Ex>
          <View style={{ marginLeft: 15, borderWidth: 1.2, borderColor: PEACH_LINE, borderRadius: 8, overflow: "hidden" }}>
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
              <View key={r} style={{ flexDirection: "row", backgroundColor: r === 0 ? PEACH : "#fff", borderTopWidth: r ? 0.6 : 0, borderColor: "#F8CDB8" }}>
                {row.map((c, k) => (
                  <Text key={k} style={{ ...t(r === 0 ? 8.4 : 9.4, r === 0 ? 700 : 400, r === 1 && k > 0 ? BLUE : INK), width: "25%", textAlign: "center", paddingVertical: 2, borderLeftWidth: k ? 0.6 : 0, borderColor: "#F8CDB8" }}>
                    {c || "______"}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>
        <View style={{ width: COL + 30 }}>
          <Ex n="3">Complete the short dialogues. Then take roles and act out.</Ex>
          <Items
            size={9.4}
            rowGap={2}
            items={[
              <Text key="1" style={t(9.4)}>A: Are these <Text style={{ color: BLUE, fontWeight: 700 }}>your</Text> (you) headphones? B: Yes, they&apos;re <Text style={{ color: BLUE, fontWeight: 700 }}>mine</Text> (I). Thanks!</Text>,
              `A: Is this Maria's scarf? B: No, it isn't ________ (she). ________ (she) scarf is red.`,
              `A: Whose keys are these? B: They're ________ (we). Thank you!`,
              `A: Is that Sam's bike? B: Yes, it's ________ (he). He loves ________ (it) colour.`,
              `A: Can you help ________ (I) with my homework? B: Sure. Give ________ (it) to me.`,
              `A: Are the twins coming? B: Yes. I'm meeting ________ (they) at the station.`,
              `A: This umbrella isn't mine. Is it ________ (you)? B: Yes! I need it today.`,
              `A: My cousins are here. Do you want to meet ________ (they)? B: Sure! What are ________ (they) names?`,
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
      <Ex n="4">What is there in Lily&apos;s new room? Talk with your friend.</Ex>
      <View style={{ marginTop: 4, marginBottom: 6 }}>
        <Pic src={A.scene1a} w={CW} h={268} r={10} pos="50% 60%" />
      </View>
      <Items cols={4} items={["boxes", "a rug", "a wardrobe", "curtains", "a beanbag", "a laptop", "a bookcase", "a paint pot"]} />
      <View style={{ marginLeft: 15, marginBottom: 8 }}>
        <Text style={it()}>A: There&apos;s a beanbag in Lily&apos;s room.   B: Where is it?   A: It&apos;s next to the desk.</Text>
      </View>
      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: COL }}>
          <Ex n="5" listen>
            Listen and choose.
          </Ex>
          <View style={{ marginLeft: 15, marginTop: 4 }}>
            <Pic src={A.clocks} w={COL - 15} h={(COL - 15) * (760 / 700)} fit="contain" r={0} />
          </View>
        </View>
        <View style={{ width: COL }}>
          <Ex n="6">Make the words plural.</Ex>
          <Items
            rowGap={5}
            items={[
              <Text key="1" style={t()}>a door  –  <Text style={{ color: BLUE, fontWeight: 700 }}>doors</Text></Text>,
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
        </View>
      </View>
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
          <Ex n="1">What is Tiger the cat doing? Look and say.</Ex>
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
          <Ex n="3" color="#fff">
            Put the words in the right category.
          </Ex>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: 15, marginTop: 3, marginBottom: 8, backgroundColor: "#fff", borderRadius: 8, padding: 6 }}>
            {["tennis", "museum", "sofa", "cheese", "judo", "library", "cooker", "pasta", "swimming", "stadium", "bath", "bananas", "chess", "café", "wardrobe", "soup", "golf", "bakery", "fridge", "rice"].map((w) => (
              <Text key={w} style={{ ...t(9.4), width: "33%" }}>
                • {w}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginLeft: 6 }}>
            {cats.map(([c, col, e], i) => (
              <View key={c} style={{ width: (COL - 14 - 16) / 2, backgroundColor: "#fff", borderRadius: i % 2 ? 40 : 14, borderWidth: 4, borderColor: col, padding: 8, paddingTop: 16, marginTop: 8 }}>
                <View style={{ position: "absolute", top: -11, left: 10, flexDirection: "row", alignItems: "center", backgroundColor: col, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 1 }}>
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
  const mw = 470;
  const cell = mw / (1272 / 300);
  const mh = mw * (764 / 1272);
  return (
    <BookPage n={9} label="Welcome Module">
      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: COL }}>
          <Ex n="4" listen>
            Read and choose. Then listen and check your answers.
          </Ex>
          <Items
            rowGap={3}
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
        </View>
        <View style={{ width: COL }}>
          <View style={{ backgroundColor: "#EDE7F6", borderRadius: 10, borderWidth: 2, borderColor: PURPLE, padding: 8, paddingTop: 4 }}>
            <Text style={{ position: "absolute", right: 8, top: -6, fontFamily: "Baloo", fontWeight: 700, fontSize: 64, color: "#D1C4E9" }}>ID</Text>
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
                  <View style={{ height: 6, borderBottomWidth: 0.8, borderColor: "#9575CD", marginBottom: 2 }} />
                </View>
              ))}
            />
          </View>
        </View>
      </View>
      <Ex n="6" mt={8}>
        Look at the pictures from the modules in this book. What do you think each module is about? Then go through the contents and find the modules.
      </Ex>
      <View style={{ width: mw, height: mh, alignSelf: "center", marginTop: 4 }}>
        <Pic src={A.modules} w={mw} h={mh} fit="contain" r={0} />
        {Array.from({ length: 7 }, (_, i) => {
          const gx = mw / (1272 / 24);
          const x = (i % 4) * (cell + gx);
          const y = Math.floor(i / 4) * (cell + (70 / 300) * cell + gx) + cell + 2;
          return (
            <Text key={i} style={{ position: "absolute", left: x, top: y, width: cell, textAlign: "center", ...t(9.6, 700) }}>
              {i === 0 ? "Module 1" : "Module ___"}
            </Text>
          );
        })}
      </View>
    </BookPage>
  );
}

// =============================================================================
// MODULE 1 - 1a Moving day (source pp.12-13)
// =============================================================================
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

function P10() {
  const ih = W / 1.5;
  return (
    <BookPage n={10} strip={false}>
      <Abs l={-ML} tp={150 - TOP} w={W} h={ih}>
        <Pic src={A.scene1a} w={W} h={ih} r={0} />
      </Abs>
      <LessonHeader code="1a" title="Moving day" />
      <Abs l={W - MR - 205 - ML} tp={4} w={205}>
        <CheckWords
          w={205}
          words={["decorate", "wardrobe", "bookcase", "curtains", "beanbag", "carry", "unpack", "take a break", "Wi-Fi", "go with"]}
          extraTitle="SMALL TALK"
          extra={["It looks amazing!", "Who's hungry?"]}
        />
      </Abs>
      <View style={{ width: 300, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1.5, borderColor: RED, padding: 7, marginTop: 6 }}>
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
      </View>
      <View style={{ flexDirection: "row", gap: GAP, marginTop: ih - 150 + 20 }}>
        <View style={{ width: COL, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1.5, borderColor: RED, padding: 7 }}>
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
        </View>
        <View style={{ width: COL, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1.5, borderColor: RED, padding: 7 }}>
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
        </View>
      </View>
    </BookPage>
  );
}

function P11() {
  const vw = COL - 15;
  const vh = vw * (724 / 948);
  const cell = vw / (948 / 300);
  return (
    <BookPage n={11} refs="1a">
      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: COL }}>
          <Section name="Reading" icon="📖" mt={0} />
          <Ex n="1" listen>
            Look at the picture and the title. In pairs, decide what the dialogue is about. Listen, read and check your answers.
          </Ex>
          <Ex n="2">a) Read again and circle a or b.</Ex>
          <Items
            rowGap={2}
            items={[
              ["Lily's dad is ________ a new bookcase.", "painting", "building"],
              ["Lily's box is full of ________.", "comics", "clothes"],
              ["Lily is painting her wardrobe ________.", "light blue", "yellow"],
              ["Kenji says he is ________.", "unpacking", "taking a break"],
            ].map(([s, a, b]) => (
              <View key={s}>
                <Text style={t()}>{s}</Text>
                <Opts opts={[a, b]} letters="ab" w={110} />
              </View>
            ))}
          />
          <Sub>b) Give the dialogue a new title.</Sub>
          <Section name="Vocabulary" icon="🔤" />
          <Ex n="3" listen>
            Listen and repeat. Use the words to complete the sentences.
          </Ex>
          <View style={{ width: vw, height: vh, marginLeft: 15, marginVertical: 3 }}>
            <Pic src={A.vocab1a} w={vw} h={vh} fit="contain" r={0} />
            {["wardrobe", "desk lamp", "rug", "beanbag", "bookcase", "curtains"].map((c, i) => (
              <Text key={c} style={{ position: "absolute", left: (i % 3) * (cell + (24 / 300) * cell), top: Math.floor(i / 3) * (cell + (56 / 300) * cell + (24 / 300) * cell) + cell, width: cell, textAlign: "center", ...t(9.4) }}>
                {c}
              </Text>
            ))}
          </View>
          <Items
            items={[
              <Text key="1" style={t()}>It&apos;s dark in here. Please turn on the <Text style={{ color: BLUE, fontWeight: 700 }}>desk lamp</Text>.</Text>,
              `Hang your school jacket in the ${GAPLINE}.`,
              `Close the ${GAPLINE}. The sun is in my eyes!`,
              `My cat sleeps on the ${GAPLINE} in front of the fire.`,
              `I keep all my comics on the ${GAPLINE}.`,
              `Sit on the ${GAPLINE}. It's really comfy!`,
            ]}
          />
          <View style={{ width: 200, height: 86, marginLeft: 20 }}>
            <Pic src={A.didYouKnow} w={200} h={86} fit="contain" r={0} />
            <Text style={{ position: "absolute", left: 76, top: 26, width: 108, ...t(8.4), fontFamily: "Andika", transform: "rotate(-8deg)" }}>In Japan, lots of people sleep on a futon on the floor!</Text>
          </View>
        </View>
        <View style={{ width: COL }}>
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
          <Ex n="5">a) Complete the email.</Ex>
          <Text style={{ ...t(), marginLeft: 15, marginBottom: 2 }}>• hang  • build  • carry  • put  • take</Text>
          <EmailBox>
            <Text style={t(9.6)}>
              Hi Mia,{"\n"}It&apos;s moving day at our new flat and everybody is busy! Right now my mum <B>1)</B> ________ pictures in the hall and my dad <B>2)</B> ________ a bookcase in my room. My brothers <B>3)</B> ________ boxes up the stairs and my grandma <B>4)</B> ________ the plates into the cupboards. And me? I <B>5)</B> ________ a short break!{"\n"}Write soon,{"\n"}Lily
            </Text>
          </EmailBox>
          <Sub>b) Read the email again. In pairs, ask and answer questions.</Sub>
          <Text style={{ ...it(), marginLeft: 15 }}>A: What is Lily&apos;s mum doing?   B: She&apos;s ...</Text>
          <Section name="Speaking and Writing" icon="💬" />
          <Ex n="6">
            <Text style={{ color: RED }}>Over to you:</Text> Answer the questions.
          </Ex>
          <View style={{ marginLeft: 15, backgroundColor: SKY, borderRadius: 8, padding: 6, width: COL - 15 - 60 }}>
            <Items
              ml={0}
              items={["What colour is your bedroom?", "Have you got any pictures on the walls?", "What can you see from your window?", "Where do you keep your books?", "You want to change one thing in your room. What is it? Why?"].map((q) => (
                <Text key={q} style={it()}>
                  {q}
                </Text>
              ))}
            />
          </View>
          <Abs l={COL - 92} tp={538} w={100} h={110}>
            <Pic src={A.girl} w={100} h={110} fit="contain" r={0} />
          </Abs>
          <Ex
            n="7"
            mt={6}
            tag={<Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 10, color: "#fff", backgroundColor: RED, paddingHorizontal: 4, marginRight: 4, borderRadius: 2 }}>PORTFOLIO</Text>}
          >
            Write about your room. Start like this: <Text style={{ fontStyle: "italic" }}>My room is small but cosy. I&apos;ve got ...</Text>
          </Ex>
        </View>
      </View>
    </BookPage>
  );
}

// =============================================================================
// 1b Party night! (source pp.14-15)
// =============================================================================
function P12() {
  const iw = 512;
  const ih = iw / 1.5;
  const vw = COL - 15;
  const vh = vw * (724 / 948);
  const cell = vw / (948 / 300);
  return (
    <BookPage n={12}>
      <LessonHeader code="1b" title="Party night!" />
      <Abs l={W - MR - 215 - ML} tp={4} w={215}>
        <CheckWords w={215} words={["chores", "dishwasher", "rubbish", "laundry", "be exhausted", "No way!", "count me in", "costume", "theme party", "arrangement"]} />
      </Abs>
      <Section name="Reading" icon="📖" mt={8} />
      <View style={{ height: ih + 10 }}>
        <Abs l={CW - iw + 10} tp={0} w={iw} h={ih}>
          <Pic src={A.scene1b} w={iw} h={ih} r={12} />
          <Bubble l={6} tp={4} w={120} who="Mum" tail="bl">I&apos;m going to the market. Grandpa&apos;s party is at seven!</Bubble>
          <Bubble l={iw - 132} tp={6} w={126} who="Dad" tail="br">The dishwasher is full again! Who&apos;s eating all the snacks?</Bubble>
          <Bubble l={250} tp={32} w={128} who="Emily" tail="bl">I&apos;m vacuuming the living room. Then I&apos;m going to a sleepover.</Bubble>
          <Bubble l={120} tp={66} w={118} who="Tom" tail="bl">I&apos;m taking out the rubbish. Can I play football after this?</Bubble>
          <Bubble l={18} tp={ih - 70} w={130} who="Biscuit the cat" tail="tr">Me? I&apos;m resting. It&apos;s Saturday!</Bubble>
          <Bubble l={iw - 160} tp={ih - 70} w={150} who="Grandma" tail="tl">I&apos;m watering the plants. They&apos;re thirsty too, you know!</Bubble>
        </Abs>
        <Abs l={-8} tp={70} w={128}>
          <View style={{ backgroundColor: "#E1F5FE", padding: 8, transform: "rotate(-4deg)", borderWidth: 1, borderColor: "#81D4FA" }}>
            <Text style={{ fontFamily: "Andika", fontSize: 9.4, lineHeight: 1.3 }}>
              Family,{"\n"}It&apos;s Grandpa&apos;s 70th birthday dinner tonight! Eight people are coming. Things to do:{"\n"}– shopping{"\n"}– rubbish{"\n"}– plants{"\n"}– dishwasher{"\n"}– vacuuming{"\n"}– set the table{"\n"}Thanks!{"\n"}Mum x
            </Text>
          </View>
        </Abs>
      </View>
      <View style={{ flexDirection: "row", gap: GAP, marginTop: 4 }}>
        <View style={{ width: COL }}>
          <Ex n="1" listen>
            Listen and repeat. Do you help your parents at home? Which of the following do you like doing?
          </Ex>
          <View style={{ width: vw, height: vh, marginLeft: 15, marginTop: 2 }}>
            <Pic src={A.chores} w={vw} h={vh} fit="contain" r={0} />
            {["do the laundry", "load the dishwasher", "take out the rubbish", "water the plants", "set the table", "vacuum the floor"].map((c, i) => (
              <Text key={c} style={{ position: "absolute", left: (i % 3) * (cell + (24 / 300) * cell), top: Math.floor(i / 3) * (cell + (56 / 300) * cell + (24 / 300) * cell) + cell + 1, width: cell, textAlign: "center", ...t(8.8, 700) }}>
                • {c}
              </Text>
            ))}
          </View>
          <Text style={{ ...it(), marginLeft: 15 }}>I like setting the table.</Text>
        </View>
        <View style={{ width: COL }}>
          <Ex n="2" listen>
            Which of the chores in Ex. 1 are in the text? Listen, read and find out.
          </Ex>
          <Section name="Pronunciation" icon="🗣️" />
          <Ex n="3" listen>
            Listen and tick (<Text style={{ fontFamily: "Sym" }}>✓</Text>).
          </Ex>
          <View style={{ marginLeft: 15, borderWidth: 1, borderColor: PEACH_LINE, borderRadius: 6, overflow: "hidden", width: 200 }}>
            {[["", "/ɪ/", "/iː/"], ["sit"], ["seat"], ["fill"], ["feel"], ["ship"], ["sheep"]].map((row, r) => (
              <View key={r} style={{ flexDirection: "row", backgroundColor: r === 0 ? PEACH : r % 2 ? "#fff" : "#FFF8F4", borderTopWidth: r ? 0.6 : 0, borderColor: "#F8CDB8" }}>
                {(r === 0 ? row : [row[0], "", ""]).map((c, k) => (
                  <Text key={k} style={{ ...t(9.6, r === 0 || k === 0 ? 700 : 400), width: k === 0 ? 100 : 50, padding: 2, textAlign: k ? "center" : "left", borderLeftWidth: k ? 0.6 : 0, borderColor: "#F8CDB8" }}>
                    {c}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    </BookPage>
  );
}

function P13() {
  return (
    <BookPage n={13} refs="1b">
      <View style={{ flexDirection: "row", gap: GAP }}>
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
            rowGap={3}
            items={[
              <Text key="1" style={t()}><Text style={{ color: BLUE, fontWeight: 700 }}>Are you doing</Text> (you/do) anything this weekend?</Text>,
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
          <View style={{ marginLeft: 15, borderRadius: 10, overflow: "hidden", backgroundColor: "#1A237E" }}>
            <Pic src={A.party} w={COL - 15} h={150} r={0} pos="50% 35%" />
            <View style={{ padding: 9 }}>
              <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 19, color: "#FFEB3B", transform: "rotate(-2deg)" }}>We&apos;re having a party!</Text>
              <Text style={{ fontFamily: "Andika", fontSize: 10.4, color: "#fff", lineHeight: 1.35 }}>
                Come to my <B>1)</B> Space/Jungle party on <B>2)</B> 14th/24th May at <B>3)</B> 6:00/7:00 pm! Food, music and games for everyone. My flat: <B>4)</B> 18/80 Park Road.
              </Text>
              <Text style={{ fontFamily: "Andika", fontSize: 10, color: "#B3E5FC", marginTop: 3 }}>PS Wear something out of this world!   Sam</Text>
            </View>
          </View>
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
          <Section name="Everyday English" sub="Inviting/Accepting invitations" icon="💬" />
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
                <View style={{ padding: 4 }}>
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
              ["⛸", "go ice skating"],
              ["🎵", "go to a concert"],
              ["🍕", "have a pizza"],
            ].map(([e, x]) => (
              <View key={x} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                <Ico e={e === "⛸" ? "⭐" : e} s={16} />
                <Text style={{ ...t(), marginLeft: 6 }}>{x}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </BookPage>
  );
}

// =============================================================================
// 1c Free-time fun (source pp.16-17)
// =============================================================================
function P14() {
  const hw = CW * 0.88;
  const hh = hw * (624 / 1272);
  const cell = hw / (1272 / 300);
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
      <LessonHeader code="1c" title="Free-time fun" />
      <Abs l={W - MR - 200 - ML} tp={4} w={200}>
        <CheckWords w={200} words={["free time", "would rather", "prefer", "creative", "sporty", "sociable", "patient", "on your own", "as long as", "dream job"]} />
      </Abs>
      <Section name="Vocabulary" icon="🔤" mt={6} />
      <Ex n="1" listen>
        Listen and repeat. Which of these do you do in your free time? Tell the class.
      </Ex>
      <View style={{ width: hw, height: hh, marginTop: 4, marginLeft: 15 }}>
        <Pic src={A.hobbies} w={hw} h={hh} fit="contain" r={0} />
        {caps.map((c, i) => (
          <Text
            key={c}
            style={{ position: "absolute", left: (i % 4) * (cell + (24 / 300) * cell) + 8, top: Math.floor(i / 4) * (cell + (24 / 300) * cell) + cell - 20, ...t(9, 700), backgroundColor: "#fff", borderRadius: 4, paddingHorizontal: 4 }}
          >
            {c}
          </Text>
        ))}
      </View>
      <Text style={{ ...it(), marginTop: 3 }}>I take photos at the weekend.</Text>
      <Section name="Reading" icon="📖" />
      <Ex n="2">What&apos;s your free-time style? Do the quiz and find out! Then tell the class.</Ex>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 3 }}>
        <View style={{ width: 345, backgroundColor: "#FCE4EC", borderRadius: 12, padding: 9 }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 20, color: PINK, textAlign: "center", lineHeight: 1 }}>WHAT&apos;S YOUR STYLE?</Text>
          <Text style={{ ...t(9.4, 700, PURPLE), marginBottom: 4 }}>The things you do in your free time say a lot about you. Try our quiz and see!</Text>
          <Items
            ml={0}
            rowGap={4}
            items={quiz.map(([q, a, b]) => (
              <View key={q}>
                <Text style={t(10)}>{q}</Text>
                <Text style={t(10)}>
                  <B c={PINK}>A</B> {a}   <B c={PINK}>B</B> {b}
                </Text>
              </View>
            ))}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Pic src={A.quiz} w="100%" h={150} r={10} pos="50% 30%" />
          {[
            ["MOSTLY A", "You're creative and patient. You don't mind spending time on your own, and you love making things."],
            ["MOSTLY B", "You're sporty and sociable. You're happy doing anything, as long as it's with friends!"],
          ].map(([h, s]) => (
            <View key={h} style={{ backgroundColor: PURPLE, borderRadius: 6, padding: 5, marginTop: 4 }}>
              <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 11, color: "#FFEB3B" }}>{h}</Text>
              <Text style={t(8.8, 400, "#fff")}>{s}</Text>
            </View>
          ))}
        </View>
      </View>
    </BookPage>
  );
}

function P15() {
  const fw = 86;
  const fh = fw * (810 / 300);
  return (
    <BookPage n={15} refs="1c">
      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: COL }}>
          <Section name="Grammar" sub="Present Simple" icon="✏️" mt={0} />
          <GrammarBox
            examples={[
              <Text key="1">I {g("go")} skateboarding on Sundays.</Text>,
              <Text key="2">Kenji {g("doesn't like")} football.</Text>,
              <Text key="3">{g("Do")} you {g("play")} the guitar? {g("Yes")}, I {g("do")}./{g("No")}, I {g("don't")}.</Text>,
            ]}
            notes={[<Text key="n">We use the <B>present simple</B> for <B>habits</B> and <B>daily routines</B>.</Text>]}
            extras={[
              { title: "Spelling rules", body: "play – plays    go – goes    watch – watches    study – studies" },
              { title: "Adverbs of frequency: always, usually, often, sometimes, hardly ever, never", body: "I always meet my friends on Saturday. Sam is never late." },
            ]}
          />
          <Ex n="3">Make sentences.</Ex>
          <Items
            rowGap={1}
            items={["Zoe/skateboarding/never/goes", "swimming/you/do/often/go/?", "always/I/breakfast/have/at 7:30", "late/is/hardly ever/Sam", "Kenji/usually/get up/doesn't/early/on Sundays"].map((s) => (
              <View key={s}>
                <Text style={t()}>{s}</Text>
                <View style={{ height: 11, borderBottomWidth: 0.8, borderColor: "#9E9E9E", marginBottom: 2 }} />
              </View>
            ))}
          />
          <Section name="Listening and Speaking" icon="🎧" />
          <Ex n="4" listen>
            Listen and choose A, B or C.
          </Ex>
          <View style={{ flexDirection: "row", marginLeft: 6 }}>
            <Pic src={A.listenFaces} w={fw} h={fh} fit="contain" r={0} />
            <View style={{ flex: 1, marginLeft: 6 }}>
              {[
                ["How often does Leo go swimming?", ["every day", "twice a week", "hardly ever"]],
                ["How often does Mia tidy her room?", ["once a week", "every day", "never"]],
                ["What does Ella always do before bed?", ["read a book", "watch TV", "play games"]],
              ].map(([q, os], i) => (
                <View key={i} style={{ height: fh / 3, justifyContent: "center" }}>
                  <View style={{ borderWidth: 1, borderColor: "#B0BEC5", borderRadius: 8, padding: 5, backgroundColor: "#FAFAFA" }}>
                    <Text style={t(9.6, 700)}>
                      <Text style={{ color: RED }}>{i + 1}</Text> {q as string}
                    </Text>
                    {(os as string[]).map((o, k) => (
                      <Text key={o} style={t(9.4)}>
                        <B c={RED}>{"ABC"[k]}</B> {o}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
        <View style={{ width: COL }}>
          <Ex n="5" mt={0}>
            Talk with your friend. Use ideas from Ex. 1.
          </Ex>
          <View style={{ marginLeft: 15, height: 168, marginBottom: 4 }}>
            <Pic src={A.park} w={COL - 15} h={168} r={10} />
            <Bubble l={4} tp={6} w={98} tail="bl">How often do you take photos?</Bubble>
            <Bubble l={COL - 15 - 104} tp={6} w={100} tail="br">Almost every day! What about you?</Bubble>
            <Bubble l={70} tp={118} w={120} tail="tl">I hardly ever take photos.</Bubble>
          </View>
          <Section name="Grammar" sub="Present Simple – Present Continuous" icon="✏️" />
          <GrammarBox
            examples={[
              <Text key="1">I {g("usually walk")} to school. <B>(habit)</B></Text>,
              <Text key="2">Today I{g("'m taking")} the bus. <B>(action happening now)</B></Text>,
              <Text key="3">We{g("'re having")} a party on Friday. <B>(fixed arrangement)</B></Text>,
            ]}
          />
          <Ex n="6">
            Complete the sentences. Use the <Text style={{ fontStyle: "italic" }}>present simple</Text> or the <Text style={{ fontStyle: "italic" }}>present continuous</Text>.
          </Ex>
          <Items
            rowGap={2.5}
            items={[
              <Text key="1" style={t()}>We usually <Text style={{ color: BLUE, fontWeight: 700 }}>go</Text> (go) to the park on Saturday, but today we<Text style={{ color: BLUE, fontWeight: 700 }}>&apos;re staying</Text> (stay) at home.</Text>,
              `Why ${GAPLINE} (you/laugh)? What's so funny?`,
              `Zoe ${GAPLINE} (play) the guitar every evening.`,
              `Look! Kenji ${GAPLINE} (skate) on the ramp.`,
              `I ${GAPLINE} (not/watch) TV in the mornings.`,
            ]}
          />
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 14, color: "#fff", backgroundColor: RED, borderRadius: 6, paddingHorizontal: 7, transform: "rotate(-4deg)" }}>Let&apos;s Play!</Text>
            <Text style={{ ...t(10, 700, RED), marginLeft: 6 }}>(Noughts and Crosses)</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", width: 210, marginLeft: 22, marginTop: 4 }}>
            {["always", "does", "when", "how often", "never", "free time", "where", "usually", "doing"].map((w, i) => (
              <Text
                key={w}
                style={{ width: 70, height: 26, paddingTop: 5, textAlign: "center", ...t(10, 700, ["#1E88E5", "#8E24AA", "#43A047"][i % 3]), borderRightWidth: i % 3 < 2 ? 3 : 0, borderBottomWidth: i < 6 ? 3 : 0, borderColor: "#F48FB1" }}
              >
                {w}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </BookPage>
  );
}

// =============================================================================
// 1d Skills work (source pp.18-19)
// =============================================================================
function P16() {
  return (
    <BookPage n={16}>
      <View style={{ flexDirection: "row", alignItems: "center", marginLeft: -26, marginTop: -14 }}>
        <Splash code="1d" />
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 22, color: "#fff", backgroundColor: RED, borderRadius: 8, paddingHorizontal: 10, marginLeft: 8, marginTop: 4 }}>Skills work</Text>
      </View>
      <Abs l={W - MR - 215 - ML} tp={4} w={215}>
        <CheckWords w={215} words={["mission", "explore", "crystal", "pirates", "trap", "spell", "potion", "broomstick", "tunnel", "thief", "solve", "a must"]} />
      </Abs>
      <View style={{ width: 300 }}>
        <Section name="Reading" icon="📖" mt={6} />
        <Ex n="1">
          <Text style={{ color: RED }}>Over to you:</Text> Do you like video games? Which ones do you play? Tell the class.
        </Ex>
      </View>
      <Ex n="2" listen>
        Look at the pictures and the title. What do you think the texts are about? Listen, read and check your answers.
      </Ex>
      <View style={{ backgroundColor: "#311B92", borderRadius: 16, borderWidth: 6, borderColor: "#B39DDB", padding: 12, marginTop: 6 }}>
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 30, color: "#FFEB3B", transform: "rotate(-3deg)", marginBottom: 4 }}>GAME ON!</Text>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
              <Pic src={A.games[0]} w={128} h={150} fit="contain" r={4} />
              <Text style={{ ...t(9.6, 700, "#FFEB3B"), flex: 1, marginTop: 20 }}>Do you love adventure? Are you good at puzzles? Then these two games are for you!</Text>
            </View>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 14, color: "#80DEEA" }}>Star Rider</Text>
            <Text style={t(10.8, 400, "#fff")}>
              Your <B>mission</B> in Star Rider: find the lost crystals and save the planet Zorna! Captain Nova flies her spaceship through dangerous asteroid fields and fights space <B>pirates</B>. You can <B>explore</B> twelve planets, collect power stars and build your own space station. But watch out for the pirates&apos; traps! It&apos;s fast, funny and full of surprises.
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 14, color: "#F48FB1" }}>Spellbound Academy</Text>
            <Text style={t(10.8, 400, "#fff")}>
              In Spellbound Academy, you are a new student at a school for young wizards. Learn spells, make a magic <B>potion</B> and fly on a broomstick over the castle. But someone is stealing the school&apos;s magic books! <B>Solve</B> puzzles, explore secret <B>tunnels</B> and catch the thief before the end of term. Can you become the best wizard in the school? A must for fans of fantasy stories!
            </Text>
            <View style={{ alignItems: "flex-end", marginTop: 4 }}>
              <Pic src={A.games[1]} w={128} h={150} fit="contain" r={4} />
            </View>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: GAP, marginTop: 8 }}>
        <View style={{ width: COL }}>
          <Ex n="3">Match the words in bold in the texts with their definitions.</Ex>
          <Items
            rowGap={2}
            items={[
              <Text key="1" style={t()}>people who rob ships   <Text style={{ color: BLUE, fontWeight: 700 }}>pirates</Text></Text>,
              `look around a new place  ________`,
              `ways under the ground  ________`,
              `a magic drink  ________`,
              `a job that a hero has to do  ________`,
              `find the answer to  ________`,
            ]}
          />
        </View>
        <View style={{ width: COL }}>
          <Ex n="4">a) Read the texts again and complete.</Ex>
          <View style={{ marginLeft: 15, borderWidth: 1, borderColor: "#B39DDB", borderRadius: 6, overflow: "hidden" }}>
            {[
              ["Name", "Star Rider", "Spellbound ..."],
              ["Hero", "Captain Nova", ""],
              ["Story", "find the lost crystals", ""],
              ["You can", "", "learn spells"],
            ].map((row, r) => (
              <View key={r} style={{ flexDirection: "row", backgroundColor: r === 0 ? "#EDE7F6" : "#fff", borderTopWidth: r ? 0.6 : 0, borderColor: "#D1C4E9" }}>
                {row.map((c, k) => (
                  <Text key={k} style={{ ...t(9.2, r === 0 || k === 0 ? 700 : 400, r === 0 && k ? PURPLE : INK), width: k ? "38%" : "24%", padding: 2.5, borderLeftWidth: k ? 0.6 : 0, borderColor: "#D1C4E9" }}>
                    {c || "..."}
                  </Text>
                ))}
              </View>
            ))}
          </View>
          <Sub>b) Now, choose a video game and tell the class.</Sub>
          <Text style={{ ...it(), marginLeft: 15 }}>&apos;Star Rider&apos; is a space game. The hero is ...</Text>
        </View>
      </View>
    </BookPage>
  );
}

function P17() {
  const sw = COL - 15;
  const sh = sw * (590 / 760);
  return (
    <BookPage n={17} refs="1d">
      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: COL }}>
          <Section name="Grammar" sub="-ing form" icon="✏️" mt={0} />
          <GrammarBox
            examples={[<Text key="1">I {g("love playing")} video games.</Text>, <Text key="2">Zoe {g("enjoys drawing")} comics.</Text>, <Text key="3">Kenji {g("doesn't mind setting")} the table.</Text>]}
            notes={[<Text key="n">We use the <B>-ing form</B> after the verbs/phrases: <B>like, love, enjoy, hate, can&apos;t stand, don&apos;t mind, be crazy about</B>.</Text>, <Text key="m"><B>Note:</B> I like <Text style={{ color: BLUE }}>playing</Text> = I like <Text style={{ color: BLUE }}>to play</Text>.</Text>]}
          />
          <Ex n="5">
            What do you like doing in your free time? Talk with your friend. Use: <Text style={{ color: BLUE }}>play video games, take photos, read comics, go skateboarding, bake cakes</Text>.
          </Ex>
          <View style={{ width: sw, height: sh, marginLeft: 15, marginVertical: 3 }}>
            <Pic src={A.likeScale} w={sw} h={sh} fit="contain" r={0} />
            {["I'm crazy about ...", "I (really) like ...", "I don't mind ...", "I don't (really) like ...", "I can't stand ..."].map((x, i) => {
              const rowH = sh / 5;
              const len = (640 - i * 90) / 760;
              return (
                <Text key={x} style={{ position: "absolute", left: (110 / 760 + len - 250 / 760) * sw, top: i * rowH + rowH * 0.36, width: (230 / 760) * sw, ...t(8.4, 700), textAlign: "center" }}>
                  {x}
                </Text>
              );
            })}
          </View>
          <Text style={{ ...it(), marginLeft: 15 }}>A: I love taking photos. What about you?{"\n"}B: I don&apos;t mind taking photos, but I ...</Text>
          <Ex n="6" mt={6}>Join the sentences.</Ex>
          <View style={{ marginLeft: 15, borderWidth: 1.2, borderColor: GREEN, borderRadius: 8, padding: 6, marginBottom: 4 }}>
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 12, color: "#fff", backgroundColor: GREEN, alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 5, marginBottom: 2 }}>Writing Tip</Text>
            <Text style={t(9.2)}>I like <Text style={{ fontStyle: "italic" }}>Star Rider</Text>. I like <Text style={{ fontStyle: "italic" }}>Robo Racers</Text>, too.  →  I like <Text style={{ fontStyle: "italic" }}>Star Rider</Text> <B c={BLUE}>and</B> <Text style={{ fontStyle: "italic" }}>Robo Racers</Text>.</Text>
            <Text style={t(9.2)}>• We use <B>and</B> to join similar ideas and <B>but</B> to join different ideas.</Text>
          </View>
          <Items
            rowGap={1.5}
            items={["I've got a skateboard. I've got a helmet, too.", "Zoe likes jazz. She doesn't like rap.", "I can play chess. I can't play cards.", "Sam loves swimming. He hates running.", "In Star Rider you can fly a spaceship. You can build a space station, too."]}
          />
        </View>
        <View style={{ width: COL }}>
          <Section name="Listening and Speaking" icon="🎧" mt={0} />
          <Ex n="7" listen>
            Listen to Ben talking to Max about a computer game and write <Text style={{ fontFamily: "Sym" }}>✗</Text> in the right box.
          </Ex>
          <View style={{ marginLeft: 15, marginVertical: 3 }}>
            <Pic src={A.games[3]} w={COL - 15} h={150} fit="cover" r={10} pos="50% 40%" />
          </View>
          <View style={{ marginLeft: 15, backgroundColor: "#E3F2FD", borderRadius: 8, padding: 5 }}>
            <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
              <Text style={{ ...t(8.8, 700), width: 30, textAlign: "center" }}>YES</Text>
              <Text style={{ ...t(8.8, 700), width: 30, textAlign: "center" }}>NO</Text>
            </View>
            <Items
              ml={0}
              rowGap={2}
              items={["The name of the game is Robo Racers.", "You build your own robots.", "Players race on the Moon.", "The game costs £50."].map((s) => (
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
          <Ex
            n="8"
            mt={6}
            tag={<Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 10, color: "#fff", backgroundColor: ORANGE, paddingHorizontal: 4, marginRight: 4, borderRadius: 2 }}>THINK</Text>}
          >
            Think of a video game you want to buy and talk with your friend about:
          </Ex>
          <View style={{ marginLeft: 22, flexDirection: "row", flexWrap: "wrap" }}>
            {["the name", "the story", "the characters", "what players can do"].map((x) => (
              <Text key={x} style={{ ...t(), width: "50%" }}>
                • {x}
              </Text>
            ))}
          </View>
          <Section name="Writing" icon="📝" />
          <Ex n="9">Write an email to your friend about your favourite video game.</Ex>
          <View style={{ flexDirection: "row" }}>
            <EmailBox w={COL - 15 - 64}>
              <Text style={{ ...t(9.6), fontFamily: "Andika" }}>
                Dear ...,{"\n"}My favourite video game is ... The characters in the game are ... They ... This video game is really exciting! Players can ...{"\n"}What&apos;s your favourite video game? Write and tell me.{"\n"}Talk to you soon,{"\n"}...
              </Text>
            </EmailBox>
            <View style={{ marginLeft: 4, marginTop: 30 }}>
              <Pic src={A.games[2]} w={60} h={60} fit="contain" r={0} />
            </View>
          </View>
        </View>
      </View>
    </BookPage>
  );
}

// =============================================================================
// Skills Practice (source pp.20-21)
// =============================================================================
function VocabBank({ title, color, words, cols = 2 }: { title: string; color: string; words: string[]; cols?: number }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ ...t(9.6, 700, "#fff"), backgroundColor: color, alignSelf: "flex-start", borderTopLeftRadius: 6, borderTopRightRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>{title}</Text>
      <View style={{ backgroundColor: color + "22", borderTopRightRadius: 6, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, padding: 5, flexDirection: "row", flexWrap: "wrap" }}>
        {words.map((w) => (
          <Text key={w} style={{ ...t(9.4, 700), width: `${100 / cols}%` }}>
            {w}
          </Text>
        ))}
      </View>
    </View>
  );
}

function ExamTip({ title, sub, body }: { title: string; sub: string; body: string }) {
  return (
    <View style={{ marginLeft: 15, borderWidth: 1.2, borderColor: "#7E57C2", borderRadius: 8, padding: 6, paddingTop: 10, marginTop: 10, marginBottom: 4 }}>
      <Text style={{ position: "absolute", right: 8, top: -10, fontFamily: "Baloo", fontWeight: 700, fontSize: 13, color: "#fff", backgroundColor: "#7E57C2", borderRadius: 5, paddingHorizontal: 6 }}>Exam TIP</Text>
      <Text style={t(9.2, 700)}>{title}</Text>
      <Text style={t(9.2, 700)}>({sub})</Text>
      <Text style={t(9.2)}>{body}</Text>
    </View>
  );
}

function P18() {
  const items: [Src, string][] = [
    [art.img("1c-cards-5"), "1"],
    [art.img("1c-cards-7"), "2"],
    [art.img("d-games-3"), "3"],
    [art.img("1c-cards-1"), "4"],
  ];
  return (
    <BookPage n={18}>
      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: COL - 40 }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 20, color: "#fff", backgroundColor: RED, alignSelf: "flex-start", paddingHorizontal: 12, borderBottomRightRadius: 12, marginLeft: -ML, paddingLeft: ML, marginTop: -8, marginBottom: 6 }}>SKILLS PRACTICE</Text>
          <Text style={{ ...t(10.5, 700, "#fff"), backgroundColor: RED, alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 8, marginBottom: 5 }}>Vocabulary Bank</Text>
          <VocabBank title="Things in a room" color="#E53935" words={["wardrobe", "desk lamp", "rug", "beanbag", "bookcase", "curtains"]} />
          <VocabBank title="Household chores" color="#00897B" words={["do the laundry", "load the dishwasher", "take out the rubbish", "water the plants", "set the table", "vacuum the floor"]} cols={1} />
          <VocabBank title="Free-time activities" color="#8E24AA" words={["go skateboarding", "play video games", "bake cakes", "draw comics", "take photos", "go swimming", "play the guitar", "play football"]} />
          <VocabBank title="Personality adjectives" color="#1E88E5" words={["creative", "sporty", "sociable", "patient", "shy", "friendly"]} />
          <VocabBank title="Other" color="#FB8C00" words={["decorate", "carry", "unpack", "costume", "mission", "explore", "potion", "tunnel"]} />
          <VocabBank
            title="Useful phrases"
            color="#E91E63"
            cols={1}
            words={["It looks amazing!", "Who's hungry?", "Are you free on ...?", "Count me in!", "Sure, why not!", "I'd love to.", "Sorry, I can't.", "How often do you ...?", "I'm crazy about ...", "I can't stand ..."]}
          />
        </View>
        <View style={{ width: COL + 40 }}>
          <Section name="Listening Comprehension" icon="🎧" mt={0} />
          <Text style={{ ...t(10.5, 700), marginBottom: 2 }}>Before listening</Text>
          <Items ml={4} items={["What furniture is there in your bedroom?", "What do you usually do after school?", "Which chores do you do at home? Which do you hate?"]} />
          <ExamTip title="Identifying location" sub="Multiple matching" body="Look at the items and the places in the picture. Say their names in English. Be careful! One place in the picture is extra." />
          <Ex n="1" listen mt={4}>
            You will hear a dialogue twice. Match each item (1-4) with its place (A-E) in the picture. Write the letter in the box. One place is extra.
          </Ex>
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginLeft: 15, marginVertical: 6 }}>
            {items.map(([s, n]) => (
              <View key={n} style={{ alignItems: "center" }}>
                <Pic src={s} w={64} h={58} fit="contain" r={0} />
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={t(10, 700)}>{n}. </Text>
                  <Box s={16} />
                </View>
              </View>
            ))}
          </View>
          <View style={{ marginLeft: 15, height: 196 }}>
            <Pic src={A.scene1a} w={COL + 25} h={196} r={10} />
            {[
              ["A", 70, 150],
              ["B", 140, 40],
              ["C", 200, 120],
              ["D", 236, 40],
              ["E", 250, 150],
            ].map(([L, x, y]) => (
              <Text key={L as string} style={{ position: "absolute", left: x as number, top: y as number, ...t(11, 700, "#fff"), backgroundColor: RED, borderRadius: 3, paddingHorizontal: 4 }}>
                {L as string}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </BookPage>
  );
}

function P19() {
  const fw = 78;
  const fh = fw * (810 / 300);
  return (
    <BookPage n={19}>
      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: COL }}>
          <Section name="Knowledge of Language Functions" icon="💬" mt={0} />
          <Ex n="2">Fill in each conversation with the missing line. Write the letter A, B or C in each box.</Ex>
          <View style={{ flexDirection: "row", marginTop: 2 }}>
            <Pic src={A.talkFaces} w={fw} h={fh} fit="contain" r={0} />
            <View style={{ flex: 1, marginLeft: 6 }}>
              {[
                ["When is the party?", ["On Friday evening.", "It's a space party.", "Count me in!"]],
                ["Do you want to come skating?", ["Of course you can.", "Sure, why not?", "I'm skating now."]],
                ["How often do you play chess?", ["It's great!", "Yes, I do.", "Hardly ever."]],
              ].map(([q, os], i) => (
                <View key={i} style={{ height: fh / 3, justifyContent: "center" }}>
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
            </View>
          </View>
          <Section name="Knowledge of Language Means" icon="🔤" />
          <Ex n="3">
            Read the text. Out of the words given in the box, choose the ones which correctly fill gaps 1-3. Write the letter (A-F) next to each gap number. Careful! Three words are extra.
          </Ex>
          <View style={{ marginLeft: 15, flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: "#B0BEC5", borderRadius: 4, padding: 4, marginVertical: 3 }}>
            {["A. at", "B. enjoy", "C. on", "D. mind", "E. in", "F. hate"].map((x) => (
              <Text key={x} style={{ ...t(9.6), width: "33%" }}>
                {x}
              </Text>
            ))}
          </View>
          <Text style={{ ...t(9.8), marginLeft: 15 }}>
            My name is Daniel and I&apos;m thirteen. I live <B>1.</B> ____ a small flat in Leeds with my mum and my sister. I really <B>2.</B> ____ playing basketball, and I don&apos;t <B>3.</B> ____ helping at home - I usually set the table and take out the rubbish.
          </Text>
        </View>
        <View style={{ width: COL }}>
          <Section name="Reading Comprehension" icon="📖" mt={0} />
          <ExamTip title="Identifying specific information" sub="Multiple choice" body="Read the questions first. Then read the text and find the answers. Be careful: all the options are in the text." />
          <Ex n="4">
            Read the text. Choose the correct answer. Write <Text style={{ fontFamily: "Sym" }}>✗</Text> in the box next to answer A, B or C.
          </Ex>
          <EmailBox head={["To: maya.reads@mailbox.com", "From: kai.jones@mailbox.com", "Subject: Hi from Kai!"]}>
            <Text style={t(9.4)}>
              Hi Maya,{"\n"}Thanks for your email. I&apos;m eleven, not twelve like you! I love music and I play the drums in a band with my friends. I&apos;m also crazy about cooking - I make pancakes every Sunday. My parents are having a barbecue on Saturday and they want us to help in the garden. My sister is watering the plants right now and I&apos;m cutting the grass. Do you help your parents at home?{"\n"}Write back,{"\n"}Kai
            </Text>
          </EmailBox>
          <Items
            rowGap={3}
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
                      {isEmoji ? <Ico e={o} s={34} /> : <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 24, color: ["#43A047", "#1E88E5", "#E53935"][k] }}>{o}</Text>}
                      <Text style={{ ...t(9.6, 700), marginLeft: 3 }}>{"ABC"[k]}. </Text>
                      <Box s={14} />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          />
        </View>
      </View>
    </BookPage>
  );
}

// =============================================================================
// Bolt the Robot (comic, source p.22) and Fun Time (p.23)
// =============================================================================
function P20() {
  const ih = 650;
  const iw = ih * (1024 / 1536);
  const x0 = (CW - iw) / 2;
  const pw = iw / 2;
  const ph = ih / 3;
  const panels: { n: number; bubbles: { dx: number; dy: number; w: number; text: string; tail?: "bl" | "br" | "tl" | "tr" }[] }[] = [
    { n: 1, bubbles: [{ dx: 30, dy: 10, w: 110, text: "Bolt, you're always on that sofa! Find a hobby!", tail: "br" }, { dx: 8, dy: 150, w: 70, text: "But I'm bored ...", tail: "tr" }] },
    { n: 2, bubbles: [{ dx: 10, dy: 12, w: 96, text: "Basketball? Easy!", tail: "bl" }, { dx: 120, dy: 170, w: 100, text: "Oops! I missed again.", tail: "tl" }] },
    { n: 3, bubbles: [{ dx: 70, dy: 8, w: 150, text: "Bolt! What are you doing? That's my best paint!", tail: "bl" }, { dx: 150, dy: 180, w: 76, text: "It's art!", tail: "tl" }] },
    { n: 4, bubbles: [{ dx: 10, dy: 10, w: 120, text: "Cooking is fun ... Hey, what's that smell?", tail: "bl" }] },
    { n: 5, bubbles: [{ dx: 60, dy: 10, w: 150, text: "Look! They're dancing. They look so happy.", tail: "bl" }] },
    { n: 6, bubbles: [{ dx: 8, dy: 10, w: 104, text: "Come in, Bolt! You're a great dancer!", tail: "br" }, { dx: 140, dy: 150, w: 86, text: "At last - a hobby I love!", tail: "tl" }] },
  ];
  return (
    <BookPage n={20} strip={false} bg="#FFFDE7">
      <Abs l={x0} tp={34} w={iw} h={ih}>
        <Pic src={A.comic} w={iw} h={ih} r={4} />
        {panels.map((p) => {
          const px = ((p.n - 1) % 2) * pw;
          const py = Math.floor((p.n - 1) / 2) * ph;
          return (
            <React.Fragment key={p.n}>
              <View style={{ position: "absolute", left: px + 6, top: py + ph - 30, width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", borderWidth: 1.5, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
                <Text style={t(BODY, 700)}>{p.n}</Text>
              </View>
              {p.bubbles.map((b, i) => (
                <Bubble key={i} l={px + b.dx} tp={py + b.dy} w={b.w} tail={b.tail}>
                  {b.text}
                </Bubble>
              ))}
            </React.Fragment>
          );
        })}
      </Abs>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: -14 }}>
        <Ico e="🤖" s={34} />
        <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 30, color: "#1565C0", marginLeft: 6 }}>Bolt the Robot</Text>
      </View>
      <Abs l={x0 - 30} tp={ih + 38} w={iw + 30}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ width: 170 }}>
            <Ex n="1" listen mt={0}>
              a) Listen and read.
            </Ex>
          </View>
          <Text style={t(10.5, 700, RED)}>b) Now, take roles and read again.</Text>
        </View>
      </Abs>
    </BookPage>
  );
}

function P21() {
  const lw = 268;
  const inventions: [number, string, string][] = [
    [0, "Mop ppsrleis", "Clean the floor while you walk around the house!"],
    [1, "An mbrlelua hat", "Keep your head dry and your hands free on rainy days."],
    [2, "A singing hottbhsuro", "It plays your favourite song for two minutes - the perfect time to brush!"],
  ];
  return (
    <BookPage n={21} bg="#FFF8E1">
      <Abs l={lw + 10} tp={-TOP} w={W - ML - lw - 10} h={H}>
        <View style={{ flex: 1, backgroundColor: "#283593" }} />
      </Abs>
      <View style={{ flexDirection: "row", gap: 20 }}>
        <View style={{ width: lw }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 17, color: ORANGE }}>CRAZY BUT TRUE? HOME INVENTIONS!</Text>
          <Text style={t(11, 700, RED)}>What are they? Unscramble the words and find out!</Text>
          {inventions.map(([i, w, s]) => (
            <View key={i} style={{ flexDirection: i % 2 ? "row-reverse" : "row", alignItems: "center", marginTop: 8 }}>
              <View style={{ width: 98, height: 92, backgroundColor: "#fff", borderRadius: 46, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: ["#FFB74D", "#4FC3F7", "#AED581"][i] }}>
                <Pic src={A.fun[i]} w={76} h={72} fit="contain" r={0} />
              </View>
              <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 6, marginHorizontal: 6, borderWidth: 1, borderColor: "#FFE082" }}>
                <Text style={t(10)}>
                  <B c={RED}>{i + 1} </B>
                  <B>{w}</B>: {s}
                </Text>
              </View>
            </View>
          ))}
          <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center" }}>
            <Ico e="😂" s={34} />
            <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 24, color: GREEN, marginLeft: 6 }}>Ha ha ha!</Text>
          </View>
          <View style={{ backgroundColor: "#fff", borderRadius: 10, padding: 8, marginTop: 4, flexDirection: "row", alignItems: "center" }}>
            <Ico e="🎹" s={44} />
            <Text style={{ ...t(10.5), fontFamily: "Andika", flex: 1, marginLeft: 8 }}>
              <B>Q:</B> What has lots of keys but can&apos;t open a single door?{"\n"}
              <B>A:</B> A piano!
            </Text>
          </View>
        </View>
        <View style={{ flex: 1, paddingRight: 4 }}>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 15, color: "#fff", backgroundColor: GREEN, alignSelf: "flex-end", borderRadius: 8, paddingHorizontal: 10, transform: "rotate(3deg)" }}>Fun Time</Text>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 26, color: "#fff", marginTop: 6, lineHeight: 1 }}>I Want a</Text>
          <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 40, color: "#FFEB3B", lineHeight: 1, marginBottom: 6 }}>HERO</Text>
          {[
            "I want a hero,\nSomeone brave and true,\nSomeone who can help me\nWhen I'm feeling blue.",
            "She's quick and she's clever,\nShe never runs away,\nShe flies above the city\nTo save another day!",
            "She's kind and she's funny,\nShe's always there for me,\nMy hero is my best friend,\nAs cool as cool can be!",
          ].map((v, i) => (
            <Text key={i} style={{ ...t(10.6, 700, "#FFF59D"), marginBottom: 6, marginLeft: i === 1 ? 24 : 0 }}>
              {v}
            </Text>
          ))}
          <Ex n="1" listen color="#fff">
            Listen to the song. What&apos;s the singer&apos;s hero like?
          </Ex>
          <Ex
            n="2"
            color="#fff"
            tag={<Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 10, color: "#fff", backgroundColor: ORANGE, paddingHorizontal: 4, marginRight: 4, borderRadius: 2 }}>THINK</Text>}
          >
            What&apos;s your hero like? Write your own version. Read it to the class.
          </Ex>
          <View style={{ alignItems: "center", marginTop: 2 }}>
            <Pic src={A.fun[3]} w={180} h={170} fit="contain" r={0} />
          </View>
        </View>
      </View>
    </BookPage>
  );
}

// =============================================================================
// Modular Revision 1 (source pp.24-25)
// =============================================================================
const Marks = ({ n, total }: { n?: number; total: number }) => (
  <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 2, marginBottom: 4 }}>
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
            rowGap={2}
            items={[
              <Text key="0" style={t()}>I love <Text style={{ color: BLUE, fontWeight: 700 }}>baking</Text> cakes with my grandma.</Text>,
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
            rowGap={1}
            items={[
              <View key="0">
                <Text style={t()}>never/Zoe/late/is</Text>
                <Text style={t(10, 700, BLUE)}>Zoe is never late.</Text>
              </View>,
              ...["usually/Sam/at 7/gets up", "often/we/to the park/go", "always/Lily/her room/tidies", "hardly ever/Kenji/TV/watches", "sometimes/they/pizza/have"].map((s) => (
                <View key={s}>
                  <Text style={t()}>{s}</Text>
                  <View style={{ height: 10, borderBottomWidth: 0.8, borderColor: "#9E9E9E", marginBottom: 2 }} />
                </View>
              )),
            ]}
          />
          <Marks total={10} />
          <Ex n="3" mt={0}>Read and underline. (10 marks)</Ex>
          <Items
            start={0}
            rowGap={0.5}
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
            In sentences 1-3, out of the given answers, choose the one which matches the picture. Write <Text style={{ fontFamily: "Sym" }}>✗</Text> in the box next to answer A, B or C. (15 marks)
          </Ex>
          <View style={{ marginLeft: 15, marginVertical: 6 }}>
            <Pic src={A.scene1b} w={COL - 15} h={(COL - 15) * 0.9} r={10} pos="60% 50%" />
          </View>
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
        </View>
      </View>
    </BookPage>
  );
}

function P23() {
  return (
    <BookPage n={23}>
      <View style={{ flexDirection: "row", gap: GAP }}>
        <View style={{ width: COL }}>
          <Section name="Knowledge of Language Functions" icon="💬" mt={0} />
          <Ex n="5">Read and choose. (15 marks)</Ex>
          <Items
            start={0}
            rowGap={2}
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
            rowGap={1.5}
            items={["The party is for Zoe's birthday.", "The party is on Saturday.", "It starts at 7 o'clock.", "It's at 12 Park Road.", "It's a pirate party.", "Kenji can't go to the party."].map((s, i) => (
              <View key={s} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={t()}>{s}</Text>
                <Text style={t(9.6, 700)}>{i === 0 ? <Text style={{ borderWidth: 1 }}>True</Text> : "True"} / False</Text>
              </View>
            ))}
          />
          <Marks total={10} />
          <View style={{ marginTop: 2 }}>
            <Pic src={A.nowICan} w={200} h={48} fit="contain" r={0} />
            <View style={{ borderWidth: 1.5, borderColor: RED, borderRadius: 8, padding: 6, marginTop: 2 }}>
              {["talk about things in my room", "describe actions happening now", "make arrangements and invite friends", "talk about free-time activities", "read and write about video games"].map((x) => (
                <Text key={x} style={t(9.8)}>
                  <Text style={{ fontFamily: "Sym", color: RED }}>✓</Text> {x}
                </Text>
              ))}
              <Text style={{ fontFamily: "Baloo", fontWeight: 700, fontSize: 14, color: RED, textAlign: "right" }}>IN ENGLISH</Text>
            </View>
          </View>
        </View>
        <View style={{ width: COL }}>
          <Section name="Reading Comprehension" icon="📖" mt={0} />
          <Ex n="7">
            Read the email. Mark the sentences 1-5 <Text style={{ color: BLUE }}>T</Text> (True) or <Text style={{ color: RED }}>F</Text> (False). (10 marks)
          </Ex>
          <EmailBox>
            <Text style={t(9.4)}>
              Dear Tom,{"\n"}Hi! How are you? My name&apos;s Ana and I&apos;m twelve. I live in Recife, a big city by the sea in Brazil. I&apos;d like a penfriend because I want to practise my English.{"\n"}I&apos;m quite sporty. I go surfing every weekend and I play volleyball on the beach with my cousins. I&apos;m also crazy about video games - my favourite is Spellbound Academy. I&apos;m in the castle tunnels now, looking for the thief!{"\n"}What do you like doing in your free time? Write soon!{"\n"}Ana
            </Text>
          </EmailBox>
          <Items
            start={0}
            rowGap={1}
            items={["Ana lives in Brazil.", "Ana wants to practise her Spanish.", "Ana never goes surfing.", "Ana plays volleyball with her cousins.", "Ana doesn't like video games.", "Ana is playing Spellbound Academy at the moment."].map((s, i) => (
              <View key={s} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={t()}>{s}</Text>
                <Text style={t(10, 700, BLUE)}>{i === 0 ? "T" : "____"}</Text>
              </View>
            ))}
          />
          <Marks total={10} />
          <Section name="Writing" icon="📝" mt={0} />
          <Ex n="8">Read Kai&apos;s notes below. Then, use his notes to write an email to a new penfriend. (20 marks)</Ex>
          <View style={{ marginLeft: 15, backgroundColor: YELLOW, borderRadius: 4, padding: 7, transform: "rotate(-1deg)" }}>
            {[
              ["Name & age:", "Kai, eleven years old"],
              ["Where you live:", "Cardiff, Wales"],
              ["Reasons for writing:", "find a penfriend, practise Spanish"],
              ["Free-time activities:", "play the drums, make pancakes, play basketball"],
              ["Favourite video game:", "Star Rider - find the lost crystals and save the planet"],
            ].map(([k, v]) => (
              <Text key={k} style={{ ...t(9.6), fontFamily: "Andika" }}>
                <B>{k}</B> {v}
              </Text>
            ))}
          </View>
          <Lines n={3} />
          <Marks total={20} />
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Text style={{ ...t(10, 700), marginRight: 6 }}>Total</Text>
            <Text style={{ ...t(10, 700), width: 34, textAlign: "center", borderWidth: 1, borderColor: "#90A4AE" }}>100</Text>
          </View>
        </View>
      </View>
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
    <WbPage n={4} code="1a" title="Moving day">
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
    <WbPage n={5} code="1b" title="Party night!">
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
    <WbPage n={6} code="1c" title="Free-time fun">
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
    <WbPage n={7} code="1d" title="Skills work">
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

async function main() {
  A = await loadAssets();
  const missing = EMOJI.filter((e) => !A.emoji[e]);
  if (missing.length) console.warn("emoji not loaded:", missing.join(" "));
  const out = path.join(process.cwd(), ".handmade");
  // PAGES=P4,W1 renders only those pages (to .handmade/test.pdf) while designing.
  const only = process.env.PAGES?.split(",");
  const book = { P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22, P23 };
  const workbook = { W1, W2, W3, W4 };
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
