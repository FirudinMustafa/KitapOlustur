// Paid pictures for "Paper Kite 5" Unit 2 (handcraft-meb5.tsx). GPT Image via
// the Gateway (openai/gpt-image-2.5-flare), the system's path. The character
// sheet goes first so every later prompt can carry the same cast.
//   npx tsx --env-file=.env.local scripts/reference/handcraft-meb5-images.mts [name ...]
//   npx tsx scripts/reference/handcraft-meb5-images.mts --plan      (prints the jobs and estimates, no calls)
// Pictures land in .handmade-meb5/img (untracked); an existing picture is
// never redrawn. Every call is logged with its real cost to
// .handmade-meb5/img/costs.log, and the run stops before a call that could
// take the total past MAX_USD (the owner's budget for the whole book).
import fs from "node:fs";
import path from "node:path";
import { generateImage } from "ai";
import { imageCostFromUsage } from "../../src/lib/ai/pricing";
import { cardSheetItemsPrompt, cardSheetStyle } from "../../src/lib/ai/card-sheet";
import { CAST, CLIL_PICS, STORY, SUBJECTS, EX16, EXTRA_OBJECTS, VIGNETTES } from "./handcraft-meb5-content";

const OUT = path.join(process.cwd(), ".handmade-meb5", "img");
const MODEL = "openai/gpt-image-2.5-flare";
const MAX_USD = 3;
const STYLE =
  "Warm, bright 2D children's book illustration for a Year 5 English coursebook in Türkiye (ages 10-11): clean confident outlines, soft flat colours with gentle shading, friendly natural faces, modern Turkish state school setting. No text, no letters, no numbers, no logos, no watermark.";
const CASTDESC = `The recurring characters (draw them exactly like this every time): ${CAST.map((c) => `${c.name.toUpperCase()}: ${c.look}`).join("; ")}.`;

type Job = { name: string; size: string; quality: "medium" | "high"; prompt: string; cards?: string[]; estimate: number; why: string };
const SUBJECT_CARDS: Record<string, string> = {
  Maths: "a set square, a ruler and a protractor with a simple bar chart",
  Science: "a microscope next to two test tubes with green and blue liquid",
  Turkish: "an open storybook with a feather pen and an inkpot",
  "Social Studies": "a globe on a stand next to a folded paper map and a compass",
  English: "a large empty speech bubble in front of the Big Ben clock tower and a red London double-decker bus",
  "P.E.": "a football, a skipping rope and a whistle",
  Art: "a paint palette with brushes and three paint tubes",
  Music: "a recorder (flute) with two big music notes",
  IT: "a laptop showing a simple coloured blocks screen and a mouse",
  "Religion and Morals": "a simple mosque silhouette with a dome and one minaret behind an open book resting on a wooden folding book stand (rahle)",
};
const OBJECT_CARDS: Record<string, string> = {
  scissors: "a pair of children's scissors with orange handles",
  notebook: "a closed blue notebook with a spiral binding",
  ruler: "a yellow 30 cm plastic ruler",
  crayons: "a small box of wax crayons, red, blue and green ones in front",
  "school bag": "a red school backpack",
  glue: "a glue stick with a purple cap",
  rubber: "a pink and blue pencil rubber (eraser)",
  "pencil case": "a green zip pencil case",
  "board marker": "a whiteboard marker pen with a blue cap",
  "rubbish bin": "a small grey classroom rubbish bin with crumpled paper in it",
  "sheet of paper": "one plain white sheet of A4 paper, slightly curled",
};
const TURKISH = "The children are Turkish children with Anatolian Turkish facial features (light olive skin, large round eyes, Mediterranean look, not East Asian), drawn exactly like the character descriptions.";
/** Per-panel notes (after a first try: the robot must not exist before panel 3; the clock must stay out of the bubble area). */
const PANEL_EXTRA: Record<number, string> = {
  0: " Only ARDA, MS AKSOY and, in the background, DEFNE are in this picture. There is NO robot anywhere in this picture.",
  1: " The robot exists only as a drawing on the paper; there is NO real robot anywhere in this picture. Only KEREM, DEFNE and ZEHRA are in this picture.",
  2: " Only KEREM, DEFNE and ZEHRA are in this picture (Arda is not there; no teacher).",
  3: " EXACTLY TWO people in this picture: DEFNE and ZEHRA, each drawn once, standing next to a desk with the half-finished robot in the RIGHT half. No other children, no teacher. The round wall clock with the EMPTY face (no hands, no numbers) hangs on the wall at the LEFT edge of the picture at 60 percent of the picture height from the top (in the lower half, below the empty upper half), away from the people.",
};
const jobs: Job[] = [
  {
    name: "cast",
    size: "1536x1024",
    quality: "high",
    prompt: "",
    cards: CAST.map((c) => `${c.name.toUpperCase()}: ${c.look}, a person from Türkiye with Anatolian Turkish facial features (light olive skin, large round eyes with visible eyelids, straight nose, Mediterranean look, not East Asian), full body, standing, friendly smile, plain white background`),
    estimate: 0.05,
    why: "character sheet (6 figures): avatars, 'Meet 5/C', the reference look for every other picture",
  },
  {
    name: "scene",
    size: "3840x1584",
    quality: "high",
    prompt: `${CASTDESC} ${TURKISH} A wide classroom on a Monday morning in a Turkish state lower secondary school, seen from the back of the room, for a double-page spread. Along the walls, from LEFT to RIGHT, in exactly this order: a wooden bookshelf full of books; a row of coat hooks with coats on them; a classroom rules poster with five simple picture icons and no writing; a cork notice board with a few blank papers pinned on it; then (right half) a big smart board with a completely empty dark screen; a round wall clock with a completely EMPTY white face (no hands, no numbers) to the right of the board; then a Turkish flag on the wall; next to the flag three plain frames hanging side by side: one small EMPTY picture frame with only a plain light grey inside, and two tall framed boards whose insides are plain cream with no writing. People: ARDA stands by the coat hooks; DEFNE hangs her cardigan on a coat hook; CAN, the new student, stands near the notice board holding his blue school bag in his hand; MS AKSOY stands next to the smart board; KEREM in his wheelchair sits at a desk with a green pencil case on it and holds a paper timetable; ZEHRA sits at the next desk. Exactly five children and one teacher, no other people. Nobody stands in the very centre of the picture (the middle 10 percent of the width is desks and floor only). The top 22 percent of the picture is plain wall above the furniture.`,
    estimate: 0.18,
    why: "opening spread pp. 4-5 (426 x 175 mm incl. bleed): ~229 dpi at 3840 px",
  },
  {
    name: "opener",
    size: "2560x1536",
    quality: "high",
    prompt: `${CASTDESC} ${TURKISH} Morning outside a modern Turkish state lower secondary school building with a Turkish flag on a flagpole, trees and a schoolyard: DEFNE, KEREM (in his wheelchair), ZEHRA, ARDA and CAN arrive together at the school gate, happy, with school bags. Bright sunny sky. The top quarter is plain sky.`,
    estimate: 0.1,
    why: "unit opener p. 3 (216 x 130 mm): ~300 dpi",
  },
  {
    name: "subjects",
    size: "1536x1024",
    quality: "high",
    prompt: "",
    cards: SUBJECTS.map((s) => SUBJECT_CARDS[s]),
    estimate: 0.05,
    why: "10 school-subject pictures (SB pp. 8, 19; WB pp. 3, 12)",
  },
  {
    name: "objects",
    size: "1536x1024",
    quality: "high",
    prompt: "",
    cards: [...EX16.cards, ...EXTRA_OBJECTS].map((c) => OBJECT_CARDS[c]),
    estimate: 0.05,
    why: "11 classroom-object cards (SB p. 10, WB p. 5)",
  },
  {
    name: "clil",
    size: "1536x1024",
    quality: "high",
    prompt: "",
    cards: CLIL_PICS.map((p) => `a small square scene: ${p.desc}`),
    estimate: 0.05,
    why: "5 small culture pictures (SB p. 16), one extra",
  },
  {
    name: "vignettes",
    size: "1536x1024",
    quality: "high",
    prompt: "",
    cards: VIGNETTES.map((v) => `${v.desc}; ${CAST.filter((c) => v.desc.includes(c.name.toUpperCase())).map((c) => `${c.name.toUpperCase()}: ${c.look}`).join("; ")}; a Turkish child with features typical of Türkiye; plain white background`),
    estimate: 0.05,
    why: "10 small cast pictures for picture-poor pages (SB 6, 8, 14, 15; WB 2-4, 7-9)",
  },
  ...STORY.map((p, i) => ({
    name: `story-${i + 1}`,
    size: "1536x1280",
    quality: "high" as const,
    prompt: `${CASTDESC} ${TURKISH} One single comic panel (no panel border, no speech bubbles, no text): ${p.scene} The robot is a small cardboard-box robot with bottle-top eyes and paper-cup arms. Composition (very important): a wide view from a little further away, the people drawn smaller; EVERY head and face is BELOW the middle of the picture (lower half only); the whole upper half of the picture is plain empty wall with nothing on it (speech bubbles will cover it).${PANEL_EXTRA[i] ?? ""}`,
    estimate: 0.055,
    why: `story panel ${i + 1} (91 x 76 mm): ~430 dpi`,
  })),
  {
    name: "cover",
    size: "2304x3200",
    quality: "high",
    prompt: `${CASTDESC} ${TURKISH} Front cover artwork: DEFNE, KEREM (in his wheelchair), ZEHRA, ARDA and CAN in the schoolyard of their Turkish school fly a big diamond-shaped paper kite in coral, yellow, teal and purple; the school building and a Turkish flag behind them; blue sky with a few clouds. The top 32 percent is plain sky for the title. Joyful, sunny.`,
    estimate: 0.2,
    why: "cover (216 x 303 mm), used for the Student's Book and the Workbook: ~270 dpi",
  },
];
// The Workbook cover reuses the Student's Book cover art (owner's decision, 2026-10-25).

function promptOf(job: Job) {
  return job.cards ? `${cardSheetItemsPrompt(job.cards)}\n\n${cardSheetStyle(job.cards.length, STYLE)}` : `${job.prompt}\n\n${STYLE}`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--plan")) {
    for (const j of jobs) console.log(`${j.name.padEnd(9)} ${j.size.padEnd(10)} ${j.quality}  ~$${j.estimate.toFixed(2)}  ${j.why}`);
    console.log(`total estimate ~$${jobs.reduce((s, j) => s + j.estimate, 0).toFixed(2)} (budget $${MAX_USD})`);
    return;
  }
  fs.mkdirSync(OUT, { recursive: true });
  const log = path.join(OUT, "costs.log");
  const past = fs.existsSync(log) ? fs.readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
  let spent = past.reduce((s, l) => s + Number(l.split("\t")[3]?.replace("$", "") ?? 0), 0);
  for (const job of jobs.filter((j) => !args.length || args.includes(j.name))) {
    if (fs.existsSync(path.join(OUT, `${job.name}.png`))) {
      console.log(job.name, "exists, skipped");
      continue;
    }
    if (spent + job.estimate * 1.5 > MAX_USD) {
      console.log("budget reached, stopping before", job.name, { spent });
      break;
    }
    const res = await generateImage({ model: MODEL, prompt: promptOf(job), size: job.size as `${number}x${number}`, providerOptions: { openai: { quality: job.quality } } });
    const cost = imageCostFromUsage(MODEL, res.usage) ?? job.estimate;
    spent += cost;
    fs.appendFileSync(log, `${new Date().toISOString()}\t${job.name}\t${job.size}\t$${cost.toFixed(4)}\t${JSON.stringify(res.usage ?? {})}\n`);
    fs.writeFileSync(path.join(OUT, `${job.name}.png`), Buffer.from(res.image.uint8Array));
    console.log(job.name, job.size, `$${cost.toFixed(4)}`, `total $${spent.toFixed(4)}`);
  }
  console.log("total spent", `$${spent.toFixed(4)}`);
}
void main();
