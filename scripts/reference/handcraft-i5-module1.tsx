// Hand-set reference 2: i5 Team 2 Module 1, lessons 1a-1c (source pp.12-17),
// re-made by hand with original content and GPT Image pictures (gen.mts).
//   npx tsx .spike/handcraft2/lessons.tsx  ->  .spike/handcraft2/lessons.pdf
import path from "node:path";
import fs from "node:fs";
import React from "react";
import { Document, Page, View, Text, Image, Font, renderToBuffer } from "@react-pdf/renderer";

const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "Nunito", fonts: [{ src: path.join(FONTS, "Nunito-Regular.ttf"), fontWeight: 400 }, { src: path.join(FONTS, "Nunito-Bold.ttf"), fontWeight: 700 }] });
Font.register({ family: "Noto", fonts: [{ src: path.join(FONTS, "NotoSans-Regular.ttf"), fontWeight: 400 }, { src: path.join(FONTS, "NotoSans-Bold.ttf"), fontWeight: 700 }, { src: path.join(FONTS, "NotoSans-Italic.ttf"), fontStyle: "italic" }] });
Font.register({ family: "Sym", src: path.join(FONTS, "NotoSansSymbols2-Regular.ttf") });
Font.registerHyphenationCallback((w) => [w]);

const IMG = (n: string) => ({ data: fs.readFileSync(path.join(process.cwd(), ".spike", "handcraft2", "img", `${n}.png`)), format: "png" as const });
const W = 659;
const H = 795;
const M = 30;
const CW = W - 2 * M;
const MAG = "#C2185B";
const MAG_LIGHT = "#FCE4EC";
const YEL = "#FFF4B8";
const TEAL = "#00897B";
const BLUE = "#1E88E5";
const INK = "#1d1d1f";
const BODY = 9.6;

const t = (size = BODY, weight = 400) => ({ fontFamily: "Noto", fontSize: size, fontWeight: weight as 400 | 700, color: INK, lineHeight: 1.32 });

// --- furniture --------------------------------------------------------------
function LessonHeader({ code, title }: { code: string; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
      <View style={{ backgroundColor: MAG, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 2, marginRight: 8 }}>
        <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 24, color: "#fff" }}>{code}</Text>
      </View>
      <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 24, color: MAG }}>{title}</Text>
    </View>
  );
}

function Footer({ n, refs }: { n: number; refs?: boolean }) {
  const right = n % 2 === 1;
  return (
    <View style={{ position: "absolute", bottom: 14, left: M, right: M, flexDirection: right ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }} fixed>
      <View style={{ flexDirection: right ? "row-reverse" : "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: MAG, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 10, color: "#fff" }}>{n}</Text>
        </View>
        <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 9, color: MAG }}>Module 1</Text>
      </View>
      {refs ? (
        <Text style={{ fontFamily: "Nunito", fontSize: 8, color: "#555" }}>Student&apos;s Book: Language Review {refsCode(n)}  •  Workbook: {refsCode(n)}</Text>
      ) : null}
    </View>
  );
}
const refsCode = (n: number) => (n <= 11 ? "1a" : n <= 13 ? "1b" : "1c");

function CheckWords({ words, extraTitle, extra }: { words: string[]; extraTitle?: string; extra?: string[] }) {
  return (
    <View style={{ backgroundColor: YEL, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "#E9C93D" }}>
      <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 10, color: "#8A6D00", marginBottom: 3 }}>Check these words</Text>
      <Text style={t(8.6)}>{words.map((w) => `• ${w}`).join("   ")}</Text>
      {extra ? (
        <>
          <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 9, color: "#8A6D00", marginTop: 4, marginBottom: 2 }}>{extraTitle}</Text>
          {extra.map((e) => (
            <Text key={e} style={t(8.6)}>• {e}</Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

function Section({ name, color = MAG }: { name: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 4 }}>
      <View style={{ backgroundColor: color, borderTopRightRadius: 8, borderBottomRightRadius: 8, paddingHorizontal: 8, paddingVertical: 1.5, marginLeft: -M, paddingLeft: M }}>
        <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 10.5, color: "#fff" }}>{name}</Text>
      </View>
    </View>
  );
}

function Ex({ n, children, listen }: { n: string; children: React.ReactNode; listen?: boolean }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 4 }}>
      <View style={{ width: 17, height: 17, borderRadius: 3, backgroundColor: MAG, alignItems: "center", justifyContent: "center", marginRight: 5, marginTop: 0.5 }}>
        <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 10, color: "#fff" }}>{n}</Text>
      </View>
      {listen ? (
        <View style={{ width: 17, height: 17, borderRadius: 9, backgroundColor: BLUE, alignItems: "center", justifyContent: "center", marginRight: 5, marginTop: 0.5 }}>
          <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 8, color: "#fff" }}>CD</Text>
        </View>
      ) : null}
      <Text style={{ ...t(10, 700), flex: 1 }}>{children}</Text>
    </View>
  );
}

const Pic = ({ src, w, h, fit = "cover", r = 6, border }: { src: ReturnType<typeof IMG>; w: number | string; h: number; fit?: "cover" | "contain"; r?: number; border?: boolean }) => (
  <View style={{ width: w, height: h, borderRadius: r, overflow: "hidden", ...(border ? { borderWidth: 1, borderColor: "#ddd" } : {}) }}>
    {/* eslint-disable-next-line jsx-a11y/alt-text */}
    <Image src={src} style={{ width: "100%", height: "100%", objectFit: fit }} />
  </View>
);

function Dialogue({ lines }: { lines: [string, string][] }) {
  return (
    <View>
      {lines.map(([who, said], i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 1.5 }}>
          <Text style={{ ...t(BODY, 700), width: 44, color: MAG }}>{who}:</Text>
          <Text style={{ ...t(BODY), flex: 1 }}>{said}</Text>
        </View>
      ))}
    </View>
  );
}

function GrammarBox({ title, sub, rows, notes }: { title: string; sub?: string; rows: string[]; notes: string[] }) {
  return (
    <View style={{ borderWidth: 1.4, borderColor: TEAL, borderRadius: 8, overflow: "hidden", marginBottom: 6 }}>
      <View style={{ backgroundColor: TEAL, paddingHorizontal: 8, paddingVertical: 2.5, flexDirection: "row", gap: 6 }}>
        <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 10.5, color: "#fff" }}>Grammar</Text>
        {sub ? <Text style={{ fontFamily: "Nunito", fontSize: 9.5, color: "#E0F2F1" }}>({sub})</Text> : null}
      </View>
      <View style={{ padding: 7, backgroundColor: "#E0F2F1" }}>
        <Text style={{ ...t(9.2, 700), color: TEAL, marginBottom: 2 }}>{title}</Text>
        {rows.map((r) => (
          <Text key={r} style={t(9.4)}>{r}</Text>
        ))}
        {notes.map((n) => (
          <Text key={n} style={{ ...t(8.8), marginTop: 2 }}>• {n}</Text>
        ))}
      </View>
    </View>
  );
}

function Items({ items, cols = 1, size = BODY }: { items: string[]; cols?: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: 22, marginBottom: 4 }}>
      {items.map((it, i) => (
        <View key={i} style={{ width: `${100 / cols}%`, flexDirection: "row", marginBottom: 1.5, paddingRight: 6 }}>
          <Text style={{ ...t(size, 700), width: 13, color: MAG }}>{i + 1}</Text>
          <Text style={{ ...t(size), flex: 1 }}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

function Cards({ name, labels, h = 62 }: { name: string; labels: string[]; h?: number }) {
  const n = labels.length;
  const w = (CW - 22 - (n - 1) * 6) / n;
  return (
    <View style={{ flexDirection: "row", gap: 6, marginLeft: 22, marginBottom: 5 }}>
      {labels.map((l, i) => (
        <View key={l} style={{ width: w, alignItems: "center" }}>
          <View style={{ width: w, height: h, borderRadius: 6, borderWidth: 1, borderColor: "#eee", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
            <Pic src={IMG(`${name}-${i + 1}`)} w={w - 8} h={h - 8} fit="contain" r={0} />
          </View>
          <Text style={{ ...t(8.4, 700), textAlign: "center", marginTop: 2 }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

const PageBase = ({ children, n, refs }: { children: React.ReactNode; n: number; refs?: boolean }) => (
  <Page size={[W, H]} style={{ paddingTop: 26, paddingHorizontal: M, paddingBottom: 44, backgroundColor: "#fff" }}>
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, backgroundColor: MAG }} fixed />
    {children}
    <Footer n={n} refs={refs} />
  </Page>
);

// --- 1a ---------------------------------------------------------------------
function P10() {
  return (
    <PageBase n={10}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <LessonHeader code="1a" title="Our new flat" />
          <Section name="Reading" />
          <Ex n="1" listen>Look at the picture and the title. In pairs, decide what the dialogue is about. Listen, read and check.</Ex>
        </View>
        <View style={{ width: 196 }}>
          <CheckWords
            words={["decorate", "wardrobe", "bookcase", "curtains", "beanbag", "carry", "unpack", "take a break", "Wi-Fi", "go with"]}
            extraTitle="SMALL TALK"
            extra={["Welcome to my new room!", "It looks amazing!"]}
          />
        </View>
      </View>
      <View style={{ marginTop: 6, marginBottom: 8 }}>
        <Pic src={IMG("1a-scene")} w={CW} h={372} r={8} />
      </View>
      <Text style={{ ...t(BODY), fontStyle: "italic", marginBottom: 4 }}>Lily&apos;s family has got a new flat. Her friends are helping her with her new room.</Text>
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={{ flex: 1 }}>
          <Dialogue
            lines={[
              ["Zoe", "Your room looks amazing, Lily!"],
              ["Lily", "Thanks! Dad's buying a new bookcase for me today. This one is too small."],
              ["Sam", "Where do you want this box?"],
              ["Lily", "Next to the desk, please. It's full of books!"],
              ["Zoe", "I love the colour of your wardrobe."],
              ["Lily", "I'm painting it light blue. It goes with the curtains."],
            ]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Dialogue
            lines={[
              ["Sam", "Kenji! What are you doing?"],
              ["Kenji", "I'm checking the Wi-Fi. It's working!"],
              ["Lily", "Kenji, you're playing a game, aren't you?"],
              ["Kenji", "Just a quick one... I'm taking a break!"],
              ["Zoe", "A break? We aren't finished yet!"],
              ["Kenji", "OK, OK. I'm coming. Where's the next box?"],
            ]}
          />
        </View>
      </View>
    </PageBase>
  );
}

function P11() {
  return (
    <PageBase n={11} refs>
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={{ flex: 1 }}>
          <Ex n="2">a) Read again and circle a or b.</Ex>
          <Items
            items={[
              "Lily's dad is ___ a new bookcase.   a painting   b buying",
              "The box is full of ___.   a books   b clothes",
              "Lily is painting her wardrobe ___.   a light blue   b yellow",
              "Kenji says he is ___.   a unpacking   b taking a break",
            ]}
          />
          <Text style={{ ...t(10, 700), marginLeft: 22, marginBottom: 4 }}>b) Give the dialogue a new title.</Text>
        </View>
        <View style={{ width: 170, backgroundColor: MAG_LIGHT, borderRadius: 8, padding: 7, alignSelf: "flex-start" }}>
          <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 10, color: MAG }}>Did you know?</Text>
          <Text style={t(8.8)}>In Japan, many people sleep on a futon. In the morning they fold it and put it away in a cupboard!</Text>
        </View>
      </View>
      <Section name="Vocabulary" />
      <Ex n="3" listen>Listen and repeat. Use the words to complete the sentences.</Ex>
      <Cards name="1a-cards" labels={["wardrobe", "desk lamp", "rug", "beanbag", "bookcase", "curtains"]} />
      <Items
        cols={2}
        items={[
          "It's dark. Please turn on the desk lamp.",
          "Hang your jackets in the ___.",
          "Close the ___. The sun is in my eyes!",
          "My cat sleeps on the ___ by the fire.",
          "I keep all my comics in the ___.",
          "Sit on the ___. It's really comfy!",
        ]}
      />
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={{ width: 236 }}>
          <GrammarBox
            title="Present Continuous"
            rows={["I am (I'm) unpacking.", "She is (She's) painting.", "They are not (aren't) watching TV.", "Are you helping? Yes, I am. / No, I'm not."]}
            notes={["We use the present continuous for actions happening now.", "make – making   sit – sitting   carry – carrying", "now, right now, at the moment, today"]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Ex n="4">Go through the Grammar box. Read the dialogue again and underline the Present Continuous.</Ex>
          <Ex n="5">a) Complete the message with the verbs in the present continuous.</Ex>
          <Text style={{ ...t(8.6), marginLeft: 22, color: TEAL }}>• hang  • paint  • carry  • unpack  • have</Text>
          <View style={{ marginLeft: 22, marginTop: 3, borderWidth: 1, borderColor: "#ddd", borderRadius: 6, padding: 6 }}>
            <Text style={t(9.2)}>
              Hi Mia! It&apos;s moving day! Right now my mum 1) ________ pictures in the hall and my dad 2) ________ the kitchen walls. My brothers 3) ________ boxes up the stairs and
              my grandma 4) ________ the plates. And me? I 5) ________ a snack! See you soon, Lily
            </Text>
          </View>
          <Text style={{ ...t(10, 700), marginLeft: 22, marginTop: 4 }}>b) In pairs, ask and answer.  A: What is Lily&apos;s mum doing?  B: She&apos;s ...</Text>
        </View>
      </View>
      <Section name="Speaking and Writing" />
      <Ex n="6">Over to you: Answer the questions.</Ex>
      <Items cols={2} items={["What colour is your room?", "What is on your walls?", "What can you see from your window?", "What would you change in your room? Why?"]} />
      <Ex n="7">Write about your room (40–50 words). Start like this: My room is small but cosy. I&apos;ve got ...</Ex>
    </PageBase>
  );
}

// --- 1b ---------------------------------------------------------------------
function Bubble({ who, text, left, top, w = 120 }: { who: string; text: string; left: number; top: number; w?: number }) {
  return (
    <View style={{ position: "absolute", left, top, width: w, backgroundColor: "#fff", borderRadius: 9, borderWidth: 1.2, borderColor: INK, padding: 5 }}>
      <Text style={{ ...t(8.2, 700), color: MAG }}>{who}</Text>
      <Text style={t(8.2)}>{text}</Text>
    </View>
  );
}

function P12() {
  return (
    <PageBase n={12}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <LessonHeader code="1b" title="Busy Saturday" />
          <Section name="Vocabulary" />
          <Ex n="1" listen>Listen and repeat. Which chores do you do at home? Which do you like doing?</Ex>
        </View>
        <View style={{ width: 210 }}>
          <CheckWords words={["chores", "be exhausted", "thirsty", "No way!", "the rest", "count me in", "costume", "out of this world", "be free", "arrangement"]} />
        </View>
      </View>
      <Cards name="1b-cards" labels={["do the laundry", "load the dishwasher", "take out the rubbish", "water the plants", "set the table", "vacuum the floor"]} h={58} />
      <Text style={{ ...t(9.2), marginLeft: 22, fontStyle: "italic", marginBottom: 2 }}>I like watering the plants. I don&apos;t like doing the laundry.</Text>
      <Section name="Reading" />
      <Ex n="2" listen>Read Mum&apos;s note and the speech bubbles. Which chores from Ex. 1 is each person doing? Listen, read and find out.</Ex>
      <View style={{ position: "relative", marginTop: 4 }}>
        <Pic src={IMG("1b-scene")} w={CW} h={330} r={8} />
        <View style={{ position: "absolute", right: 8, bottom: 8, width: 150, backgroundColor: "#FFFDE7", padding: 7, borderRadius: 3, transform: "rotate(2deg)", borderWidth: 1, borderColor: "#E9C93D" }}>
          <Text style={t(8.4, 700)}>Family,</Text>
          <Text style={t(8.2)}>It&apos;s Grandpa&apos;s 70th birthday dinner tonight! Eight people are coming.</Text>
          <Text style={t(8.2)}>– shopping  – laundry  – dishwasher  – rubbish  – plants  – table</Text>
          <Text style={t(8.2)}>Thanks! Mum x</Text>
        </View>
        <Bubble who="Mum" text="I'm going to the supermarket now. Back at eleven!" left={8} top={8} />
        <Bubble who="Dad" text="The dishwasher is full again! Who's eating all these snacks?" left={CW - 132} top={8} />
        <Bubble who="Emily" text="I'm vacuuming the living room. Then I'm meeting Zoe." left={250} top={6} w={130} />
        <Bubble who="Tom" text="I'm taking out the rubbish. Can I play football after this?" left={110} top={64} w={130} />
        <Bubble who="Grandma" text="I'm watering the plants. They're thirsty too!" left={8} top={248} w={118} />
        <Bubble who="Biscuit the cat" text="Me? I'm resting. It's Saturday!" left={148} top={276} w={118} />
      </View>
      <Section name="Pronunciation" color={BLUE} />
      <Ex n="3" listen>Listen and tick (<Text style={{ fontFamily: "Sym" }}>✓</Text>). /ɪ/ or /iː/?</Ex>
      <View style={{ flexDirection: "row", marginLeft: 22, gap: 4 }}>
        {["sit", "seat", "fill", "feel", "ship", "sheep", "live", "leave"].map((w) => (
          <View key={w} style={{ flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 4, padding: 3, alignItems: "center" }}>
            <Text style={t(9, 700)}>{w}</Text>
            <Text style={t(8.4)}>/ɪ/ <Text style={{ fontFamily: "Sym" }}>☐</Text>  /iː/ <Text style={{ fontFamily: "Sym" }}>☐</Text></Text>
          </View>
        ))}
      </View>
    </PageBase>
  );
}

function P13() {
  return (
    <PageBase n={13} refs>
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={{ width: 236 }}>
          <GrammarBox
            title="Present Continuous with future meaning"
            sub="arrangements"
            rows={["What are you doing on Saturday?", "I'm visiting my cousins.", "We aren't going to school tomorrow.", "Is Sam having a party? Yes, he is."]}
            notes={["We use the present continuous to talk about fixed arrangements in the near future.", "tonight, tomorrow, on Saturday, next week"]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Ex n="4">Go through the Grammar box. Then read Ex. 2 again and underline the Present Continuous. Which sentences are about the future?</Ex>
          <Ex n="5">Complete the sentences.</Ex>
          <Items
            size={9.2}
            items={[
              "Are you doing (you/do) anything tonight?",
              "We ________ (have) a picnic on Sunday.",
              "My brother ________ (fly) to Rome next week.",
              "________ (Lily/come) to the party?",
              "They ________ (not/play) tennis tomorrow.",
              "I ________ (meet) Sam at the cinema at six.",
            ]}
          />
        </View>
      </View>
      <Section name="Listening" color={BLUE} />
      <Ex n="6" listen>Sam is having a party. Listen, read and circle the right words.</Ex>
      <View style={{ flexDirection: "row", gap: 12, marginLeft: 22, marginBottom: 4 }}>
        <Pic src={IMG("1b-party")} w={180} h={180} r={8} />
        <View style={{ flex: 1, backgroundColor: "#1A237E", borderRadius: 10, padding: 12, justifyContent: "center" }}>
          <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 17, color: "#FFEB3B", marginBottom: 4 }}>You&apos;re invited!</Text>
          <Text style={{ ...t(10.4), color: "#fff" }}>
            Come to my 1) Space / Jungle Party on 2) 14th / 24th May at 3) 6:00 / 7:00 pm! Food, music and games for everyone.
          </Text>
          <Text style={{ ...t(10.4), color: "#fff", marginTop: 3 }}>My flat: 4) 18 / 80 Park Road.</Text>
          <Text style={{ ...t(9.6), color: "#B3E5FC", marginTop: 4, fontStyle: "italic" }}>PS Wear something out of this world!  Sam</Text>
        </View>
      </View>
      <Section name="Speaking and Writing" />
      <Ex n="7">a) Over to you: In groups, you are having a party at the weekend. Decide on the theme, the time and place, the food and drinks, and the costumes. Tell the class.</Ex>
      <Text style={{ ...t(9.2), marginLeft: 22, fontStyle: "italic" }}>We&apos;re having a superhero party on Saturday at ...</Text>
      <Text style={{ ...t(10, 700), marginLeft: 22, marginVertical: 3 }}>b) Write the invitation for your party.</Text>
      <Section name="Everyday English" color={TEAL} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Ex n="8" listen>Listen. In pairs, read out the dialogue. Then replace the phrases in bold with phrases from the box.</Ex>
          <View style={{ marginLeft: 22 }}>
            <Dialogue
              lines={[
                ["Zoe", "Hi Kenji! Are you free on Saturday afternoon?"],
                ["Kenji", "I think so. Why?"],
                ["Zoe", "We're going ice skating. Do you want to come?"],
                ["Kenji", "Sure, why not! What time are you meeting?"],
                ["Zoe", "At three, outside the sports centre."],
                ["Kenji", "Great. Count me in!"],
              ]}
            />
          </View>
          <Ex n="9">Work in pairs and make your own dialogues.</Ex>
        </View>
        <View style={{ width: 176, backgroundColor: "#E0F2F1", borderRadius: 8, padding: 7, alignSelf: "flex-start" }}>
          <Text style={{ ...t(9, 700), color: TEAL, marginBottom: 2 }}>INVITING – ACCEPTING – REFUSING</Text>
          {["Are you free on ...? / What are your plans for ...?", "Do you want to ...? / Why don't you come ...?", "Sure, why not! / I'd love to. / Count me in!", "Sorry, I can't. I'm ...ing."].map((p) => (
            <Text key={p} style={t(8.6)}>• {p}</Text>
          ))}
        </View>
      </View>
    </PageBase>
  );
}

// --- 1c ---------------------------------------------------------------------
function P14() {
  const quiz = [
    ["On a free afternoon, you'd rather ...", "draw or bake something.", "meet friends at the park."],
    ["Your favourite present is ...", "a sketchbook.", "a new football."],
    ["At a party, you ...", "take photos of everyone.", "dance all night."],
    ["On a rainy day, you ...", "play the guitar.", "play video games with friends."],
    ["You prefer doing things ...", "on your own.", "in a team."],
    ["Your dream job is ...", "an artist.", "a sports coach."],
  ];
  return (
    <PageBase n={14}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <LessonHeader code="1c" title="Free-time fun" />
          <Section name="Vocabulary" />
          <Ex n="1" listen>Listen and repeat. Which of these do you do in your free time? Tell the class.</Ex>
        </View>
        <View style={{ width: 200 }}>
          <CheckWords words={["free time", "would rather", "prefer", "creative", "sporty", "sociable", "patient", "on your own", "as long as", "dream job"]} />
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginLeft: 22, marginBottom: 2 }}>
        {["go skateboarding", "play video games", "bake cakes", "draw comics", "take photos", "go swimming", "play the guitar", "play football"].map((l, i) => {
          const w = (CW - 22 - 3 * 6) / 4;
          return (
            <View key={l} style={{ width: w, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#eee", borderRadius: 6, padding: 3 }}>
              <Pic src={IMG(`1c-cards-${i + 1}`)} w={54} h={50} fit="contain" r={0} />
              <Text style={{ ...t(8.8, 700), marginLeft: 4, flex: 1 }}>{l}</Text>
            </View>
          );
        })}
      </View>
      <Text style={{ ...t(9.2), marginLeft: 22, fontStyle: "italic", marginBottom: 2 }}>I go swimming at the weekend.</Text>
      <Section name="Reading" />
      <Ex n="2">What&apos;s your free-time style? Do the quiz and find out! Then tell the class.</Ex>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, backgroundColor: MAG_LIGHT, borderRadius: 10, padding: 9 }}>
          <Text style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 15, color: MAG, marginBottom: 2 }}>What&apos;s your free-time style?</Text>
          <Text style={{ ...t(8.8), fontStyle: "italic", marginBottom: 4 }}>The things you do in your free time say a lot about you. Try our quiz and see!</Text>
          {quiz.map(([q, a, b], i) => (
            <View key={q} style={{ marginBottom: 6 }}>
              <Text style={t(10.2, 700)}>
                {i + 1} {q}
              </Text>
              <Text style={{ ...t(10.2), marginLeft: 10 }}>A {a}    B {b}</Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 6, padding: 5 }}>
              <Text style={{ ...t(8.8, 700), color: MAG }}>Mostly A</Text>
              <Text style={t(8.4)}>You&apos;re creative and patient. You don&apos;t mind spending time on your own, and you love making things.</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 6, padding: 5 }}>
              <Text style={{ ...t(8.8, 700), color: MAG }}>Mostly B</Text>
              <Text style={t(8.4)}>You&apos;re sporty and sociable. You&apos;re happy doing anything, as long as it&apos;s with friends!</Text>
            </View>
          </View>
        </View>
        <Pic src={IMG("1c-quiz")} w={200} h={380} r={10} />
      </View>
    </PageBase>
  );
}

function P15() {
  return (
    <PageBase n={15} refs>
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={{ width: 250 }}>
          <GrammarBox
            title="Present Simple – adverbs of frequency"
            rows={["always  usually  often  sometimes  never", "I always play football on Fridays.", "She is never late.", "How often do you go swimming?"]}
            notes={["Adverbs of frequency go before the main verb but after be.", "love / like / enjoy / don't mind / hate + -ing: I love baking cakes."]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Ex n="3">Put the words in the right order.</Ex>
          <Items
            size={9.2}
            items={["always / Kenji / skateboarding / goes / on Sundays", "late / is / never / Zoe / for school", "photos / often / Sam / takes / of animals", "you / do / how often / play / video games / ?"]}
          />
          <Ex n="4">Complete with the -ing form of the verbs.</Ex>
          <Items size={9.2} items={["Lily loves ________ (draw) comics.", "I don't mind ________ (set) the table.", "Do you enjoy ________ (swim)?"]} />
        </View>
      </View>
      <Section name="Listening" color={BLUE} />
      <Ex n="5" listen>Listen to Kenji talking about his week. Tick (<Text style={{ fontFamily: "Sym" }}>✓</Text>) what he does each day.</Ex>
      <View style={{ marginLeft: 22, marginBottom: 6, borderWidth: 1, borderColor: "#ccc", borderRadius: 6, overflow: "hidden" }}>
        {[["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], ["go skateboarding"], ["play video games"], ["take photos"], ["go swimming"]].map((row, r) => (
          <View key={r} style={{ flexDirection: "row", backgroundColor: r === 0 ? "#E3F2FD" : r % 2 ? "#fff" : "#FAFAFA" }}>
            {(r === 0 ? row : [row[0], "", "", "", "", "", "", ""]).map((c, k) => (
              <Text key={k} style={{ ...t(8.8, r === 0 || k === 0 ? 700 : 400), width: k === 0 ? 130 : (CW - 22 - 130) / 7, padding: 3, borderRightWidth: k < 7 ? 1 : 0, borderColor: "#e0e0e0", textAlign: k === 0 ? "left" : "center" }}>
                {c || (r > 0 && k > 0 ? <Text style={{ fontFamily: "Sym", fontSize: 11 }}>☐</Text> : "")}
              </Text>
            ))}
          </View>
        ))}
      </View>
      <View style={{ marginBottom: 6 }}>
        <Pic src={IMG("1c-park")} w={CW} h={210} r={8} />
      </View>
      <Section name="Speaking and Writing" />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Ex n="6">In pairs, ask and answer about your free time.</Ex>
          <Text style={{ ...t(9.2), marginLeft: 22, fontStyle: "italic" }}>A: How often do you play video games?  B: I sometimes play at the weekend. What about you?</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Ex n="7">Write a short post for the class blog: My free time (50–60 words). Use adverbs of frequency.</Ex>
        </View>
      </View>
    </PageBase>
  );
}

async function main() {
  const pdf = await renderToBuffer(
    <Document title="i5-style lessons 1a-1c (hand-set reference)">
      <P10 />
      <P11 />
      <P12 />
      <P13 />
      <P14 />
      <P15 />
    </Document>,
  );
  const out = path.join(process.cwd(), ".spike", "handcraft2", "lessons.pdf");
  fs.writeFileSync(out, pdf);
  console.log(out, pdf.length);
}
main();
