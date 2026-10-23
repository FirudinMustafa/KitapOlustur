// Hand-set reference (not part of the app): Super Minds Starter's welcome
// unit (source pp.1-6) re-made page by page by hand, with KIYAS-14's
// already-generated pictures - so the difference to the system's output is
// design and content decisions only.
//   npx tsx scripts/reference/handcraft-superminds-welcome.tsx -> .spike/handcraft/handcraft.pdf
// Pictures: KIYAS-14 (run e79072da) page images downloaded to .spike/handcraft/img/.
import path from "node:path";
import fs from "node:fs";
import React from "react";
import { Document, Page, View, Text, Image, Svg, Circle, Path, Font, renderToBuffer } from "@react-pdf/renderer";

const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "Nunito", fonts: [{ src: path.join(FONTS, "Nunito-Regular.ttf"), fontWeight: 400 }, { src: path.join(FONTS, "Nunito-Bold.ttf"), fontWeight: 700 }] });
Font.registerHyphenationCallback((w) => [w]);

const IMG = (n: string) => ({ data: fs.readFileSync(path.join(process.cwd(), ".spike", "handcraft", "img", `${n}.png`)), format: "png" as const });
const W = 620;
const H = 782;
const RED = "#EE4136";
const YELLOW = "#FFD21F";
const GREEN = "#8DC63F";
const PILL = "#FAD9CF";
const INK = "#222222";
const M = 34; // outer margin

// --- page furniture -------------------------------------------------------
function TopBand({ right }: { right: boolean }) {
  // a yellow strip with a red rounded tab on the outer side (source pp.2-4)
  return (
    <View style={{ position: "absolute", top: 0, left: 0, width: W, height: 26 }} fixed>
      <View style={{ position: "absolute", top: 0, left: 0, width: W, height: 14, backgroundColor: YELLOW }} />
      <View
        style={{
          position: "absolute",
          top: 0,
          [right ? "right" : "left"]: 0,
          width: W * 0.48,
          height: 26,
          backgroundColor: RED,
          [right ? "borderBottomLeftRadius" : "borderBottomRightRadius"]: 13,
        }}
      />
    </View>
  );
}

function Footer({ folio, topic, right }: { folio: number; topic: string; right: boolean }) {
  const ring = (
    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.4, borderColor: RED, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 9, color: INK }}>{folio}</Text>
    </View>
  );
  const pill = (
    <View style={{ backgroundColor: PILL, borderRadius: 3, paddingHorizontal: 8, paddingVertical: 2.5 }}>
      <Text style={{ fontFamily: "Nunito", fontSize: 8, color: INK, fontStyle: "normal" }}>{topic}</Text>
    </View>
  );
  return (
    <View style={{ position: "absolute", bottom: 16, [right ? "right" : "left"]: M - 10, flexDirection: "row", alignItems: "center", gap: 5 }}>
      {right ? pill : ring}
      {right ? ring : pill}
    </View>
  );
}

function TitleTab({ text }: { text: string }) {
  // the red tab with the page title over the top-left corner (source pp.1, 5)
  return (
    <View style={{ position: "absolute", top: 0, left: 0, backgroundColor: RED, borderBottomRightRadius: 18, paddingLeft: M - 6, paddingRight: 26, paddingTop: 12, paddingBottom: 10 }}>
      <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 26, color: "#fff" }}>{text}</Text>
    </View>
  );
}

function Disc({ n }: { n: number }) {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: RED, alignItems: "center", justifyContent: "center", marginRight: 6 }}>
      <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 13, color: "#fff", marginTop: -1 }}>{n}</Text>
    </View>
  );
}

function Track({ n }: { n: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: GREEN, borderRadius: 8, paddingLeft: 3, paddingRight: 6, height: 15, marginRight: 6 }}>
      <Svg width={10} height={10} viewBox="0 0 24 24">
        <Path d="M4 14v-2a8 8 0 0 1 16 0v2" stroke="#fff" strokeWidth={3} fill="none" />
        <Path d="M3 14h4v6H3zM17 14h4v6h-4z" fill="#fff" />
      </Svg>
      <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 8, color: "#fff", marginLeft: 2 }}>{n}</Text>
    </View>
  );
}

function Play() {
  return (
    <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: RED, alignItems: "center", justifyContent: "center", marginRight: 6 }}>
      <Svg width={7} height={8} viewBox="0 0 7 8">
        <Path d="M0 0 L7 4 L0 8 Z" fill="#fff" />
      </Svg>
    </View>
  );
}

function Rubric({ n, track, play, text, pill }: { n: number; track?: string; play?: boolean; text: string; pill?: boolean }) {
  const row = (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Disc n={n} />
      {track ? <Track n={track} /> : null}
      {play ? <Play /> : null}
      <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 15, color: INK }}>{text}</Text>
    </View>
  );
  if (!pill) return <View style={{ marginBottom: 10 }}>{row}</View>;
  return <View style={{ alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}>{row}</View>;
}

function NumberBadge({ n, color = YELLOW }: { n: number; color?: string }) {
  return (
    <View style={{ position: "absolute", top: 6, left: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 9, color: color === YELLOW ? INK : "#fff" }}>{n}</Text>
    </View>
  );
}

const Pic = ({ src, w, h, fit = "cover", r = 8, posY = "40%" }: { src: ReturnType<typeof IMG>; w: number; h: number; fit?: "cover" | "contain"; r?: number; posY?: string }) => (
  <View style={{ width: w, height: h, borderRadius: r, overflow: "hidden" }}>
    {/* eslint-disable-next-line jsx-a11y/alt-text */}
    <Image src={src} style={{ width: "100%", height: "100%", objectFit: fit, objectPositionY: posY }} />
  </View>
);

const CW = W - 2 * M; // content width

// --- the six pages --------------------------------------------------------
function P1() {
  // Source p.1: a full-page scene, title tab, one rubric on a white pill.
  return (
    <Page size={[W, H]} style={{ backgroundColor: "#fff" }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={IMG("unit-0-page-1")} style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover", objectPositionY: "35%" }} />
      <TitleTab text="Say Hello!" />
      <View style={{ position: "absolute", top: 70, left: M - 8 }}>
        <Rubric n={1} track="01" play text="Listen and sing." pill />
      </View>
      <Footer folio={4} topic="Singing for Pleasure" right={false} />
    </Page>
  );
}

function P2() {
  // Source p.2: the two main characters big, then "Ask and answer" on a photo-like scene.
  return (
    <Page size={[W, H]} style={{ backgroundColor: "#fff", paddingTop: 44, paddingHorizontal: M }}>
      <TopBand right />
      <Rubric n={1} track="02" text="Listen and point. Say the names." />
      <View style={{ alignItems: "center", marginBottom: 14 }}>
        <Pic src={IMG("unit-0-page-2")} w={CW * 0.86} h={300} r={10} posY="55%" />
      </View>
      <Rubric n={2} text="Ask and answer." />
      <View style={{ position: "relative" }}>
        <Pic src={IMG("unit-0-page-2-1")} w={CW} h={250} r={10} posY="30%" />
      </View>
      <Footer folio={5} topic="Hello! What's your name? I'm (Leo)." right />
    </Page>
  );
}

function P3() {
  // Source p.3: six numbered pencils (no words - the learners say them), then a scene.
  const cell = (CW - 2 * 14) / 3;
  return (
    <Page size={[W, H]} style={{ backgroundColor: "#fff", paddingTop: 44, paddingHorizontal: M }}>
      <TopBand right={false} />
      <Rubric n={1} track="03" text="Listen and point. Listen and say the words." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={{ width: cell, height: cell * 0.72, position: "relative" }}>
            <Pic src={IMG(`unit-0-page-3-${i}`)} w={cell} h={cell * 0.72} fit="contain" r={0} />
            <NumberBadge n={i} />
          </View>
        ))}
      </View>
      <Rubric n={2} text="Look and find. Say." />
      <Pic src={IMG("unit-0-page-3")} w={CW} h={232} r={10} posY="45%" />
      <Footer folio={6} topic="Colors" right={false} />
    </Page>
  );
}

const TILE = ["#F39C12", "#29A9E1", "#8CC63F", "#3C8D7A", "#EC6FA8", "#43A047", "#E53935", "#1E5AA8", "#FDD835", "#00A99D"];

function P4() {
  // Source p.4: ten numbered kites in two rows, then ten number tiles.
  const kite = (CW - 4 * 8) / 5;
  const tile = (CW - 4 * 12) / 5;
  return (
    <Page size={[W, H]} style={{ backgroundColor: "#fff", paddingTop: 44, paddingHorizontal: M }}>
      <TopBand right />
      <Rubric n={1} track="04" text="Listen and point. Listen and say the numbers." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <Pic key={i} src={IMG(`unit-0-page-4-${i}`)} w={kite} h={kite * 1.22} fit="contain" r={0} />
        ))}
      </View>
      <Rubric n={2} text="Point and say. Count." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <View key={i} style={{ width: tile, height: tile * 0.85, borderRadius: 8, backgroundColor: TILE[i - 1], alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 40, color: "#fff", marginTop: -4 }}>{i}</Text>
          </View>
        ))}
      </View>
      <Footer folio={7} topic="Numbers 1-10" right />
    </Page>
  );
}

function P5() {
  // Source p.5: pink page, title tab, six numbered story panels - no text under them (it's a video story).
  const pw = (CW - 14) / 2;
  const ph = 178;
  const panels = ["unit-0-page-5", "unit-0-page-5-1", "unit-0-page-5-2", "unit-0-page-5-3", "unit-0-page-5-4", "unit-0-page-5-5"];
  return (
    <Page size={[W, H]} style={{ backgroundColor: "#FBE3DC", paddingTop: 84, paddingHorizontal: M }}>
      <TitleTab text="Friends" />
      <View style={{ position: "absolute", top: 56, left: M - 6 }}>
        <Rubric n={1} track="05" play text="Watch and listen to the story." pill />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 22 }}>
        {panels.map((p, i) => (
          <View key={p} style={{ position: "relative", borderRadius: 8, borderWidth: 2, borderColor: "#fff" }}>
            <Pic src={IMG(p)} w={pw - 4} h={ph} r={6} posY="45%" />
            <View style={{ position: "absolute", top: 6, left: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff", borderWidth: 1.4, borderColor: "#E8B400", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 9, color: INK }}>{i + 1}</Text>
            </View>
          </View>
        ))}
      </View>
      <Footer folio={8} topic="Story and Value" right={false} />
    </Page>
  );
}

function P6() {
  // Source p.6: the story's end, then "Find and color" with numbered pictures.
  const cell = (CW - 2 * 12) / 3;
  return (
    <Page size={[W, H]} style={{ backgroundColor: "#fff", paddingTop: 44, paddingHorizontal: M }}>
      <TopBand right />
      <View style={{ backgroundColor: "#FBE3DC", marginHorizontal: -M, paddingHorizontal: M, paddingTop: 10, paddingBottom: 14, marginBottom: 16 }}>
        <Pic src={IMG("unit-0-page-6")} w={CW} h={210} r={10} posY="40%" />
      </View>
      <Rubric n={2} text="Find and color. Say the colors." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={{ width: cell, height: cell * 0.82, borderRadius: 8, borderWidth: 1.2, borderColor: "#E0E0E0", position: "relative", alignItems: "center", justifyContent: "center" }}>
            <Pic src={IMG(`unit-0-page-6-${i}`)} w={cell * 0.78} h={cell * 0.7} fit="contain" r={0} />
            <NumberBadge n={i} />
          </View>
        ))}
      </View>
      <Footer folio={9} topic="Value: Making Friends" right />
    </Page>
  );
}

async function main() {
  const pdf = await renderToBuffer(
    <Document title="Hand-set reference">
      <P1 />
      <P2 />
      <P3 />
      <P4 />
      <P5 />
      <P6 />
    </Document>,
  );
  const out = path.join(process.cwd(), ".spike", "handcraft", "handcraft.pdf");
  fs.writeFileSync(out, pdf);
  console.log(out, pdf.length);
}
main();
