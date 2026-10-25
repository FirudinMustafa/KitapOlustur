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
import { CAST, CLIL_PICS, STORY, SUBJECTS, EX16 } from "./handcraft-meb5-content";

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
  "Social Studies": "a globe on a stand next to a folded map and a compass",
  English: "a large empty speech bubble next to a small world map",
  "P.E.": "a football, a skipping rope and a whistle",
  Art: "a paint palette with brushes and three paint tubes",
  Music: "a recorder (flute) with two big music notes",
  IT: "a laptop showing a simple coloured blocks screen and a mouse",
  "Religion and Morals": "an open book with a small crescent and star bookmark, beside a heart-shaped green leaf",
};
const OBJECT_CARDS: Record<string, string> = {
  scissors: "a pair of children's scissors with orange handles",
  notebook: "a closed blue notebook with a spiral binding",
  ruler: "a yellow 30 cm plastic ruler",
  crayons: "a small box of wax crayons, red, blue and green ones in front",
  "school bag": "a red school backpack",
  glue: "a glue stick with a purple cap",
  calculator: "a simple grey pocket calculator with big buttons",
  "pencil case": "a green zip pencil case",
};
const jobs: Job[] = [
  {
    name: "cast",
    size: "1536x1024",
    quality: "high",
    prompt: "",
    cards: CAST.map((c) => `${c.name.toUpperCase()}: ${c.look}, full body, standing, friendly smile, plain white background`),
    estimate: 0.05,
    why: "character sheet (6 figures): avatars, 'Meet 5/C', the reference look for every other picture",
  },
  {
    name: "scene",
    size: "3840x1584",
    quality: "high",
    prompt: `${CASTDESC} A wide classroom scene on a Monday morning in a Turkish lower secondary school, seen from the front corner, for a double-page spread. Left part: coat hooks on the wall by the door with coats on them, a wooden bookshelf full of books, a cork notice board with a paper timetable pinned on it. Centre: student desks; ARDA stands by the coat hooks waving; DEFNE hangs up a coat; CAN, the new student with a blue school bag on the floor, stands smiling. Right part: a big dark smart board with an empty screen on the front wall, above it a Turkish flag and a framed black-and-white portrait photo and a framed poem board (the classroom's Atatürk corner), a round wall clock with an EMPTY face (no hands, no numbers) to the right of the board; MS AKSOY stands beside the smart board; KEREM in his wheelchair at a desk with a green pencil case on it; ZEHRA sits at the next desk. Exactly these five children and one teacher, no other people. Keep the very centre of the picture (the middle 8 percent of the width) free of faces. The top 20 percent is plain wall for speech bubbles.`,
    estimate: 0.18,
    why: "opening spread pp. 4-5 (426 x 175 mm incl. bleed): ~229 dpi at 3840 px",
  },
  {
    name: "opener",
    size: "2560x1536",
    quality: "high",
    prompt: `${CASTDESC} Morning outside a modern Turkish state lower secondary school building with a Turkish flag on a flagpole, trees and a schoolyard: DEFNE, KEREM (in his wheelchair), ZEHRA, ARDA and CAN arrive together at the school gate, happy, with school bags. Bright sunny sky. The top quarter is plain sky.`,
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
    why: "10 school-subject pictures (SB pp. 8, 19; WB p. 3)",
  },
  {
    name: "objects",
    size: "1536x1024",
    quality: "high",
    prompt: "",
    cards: EX16.cards.map((c) => OBJECT_CARDS[c]),
    estimate: 0.05,
    why: "8 classroom-object cards for the riddles (SB p. 10)",
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
    name: "story",
    size: "2048x2560",
    quality: "high",
    prompt: `${CASTDESC} A comic page of exactly six equal panels in a grid of 2 columns and 3 rows, separated by thin white gutters, no speech bubbles, no text. In every panel the top third is plain background (wall or sky) for speech bubbles. ${STORY.map((p, i) => `Panel ${i + 1}: ${p.scene}`).join(" ")} The robot is a small cardboard box robot with bottle-top eyes. In panel 5 the classroom clock has an empty face.`,
    estimate: 0.15,
    why: "story p. 17: six panels of 91 x 75 mm, ~285 dpi each",
  },
  {
    name: "cover",
    size: "2304x3200",
    quality: "high",
    prompt: `${CASTDESC} Front cover artwork: DEFNE, KEREM (in his wheelchair), ZEHRA, ARDA and CAN in the schoolyard of their Turkish school fly a big diamond-shaped paper kite in coral, yellow, teal and purple; the school building and a Turkish flag behind them; blue sky with a few clouds. The top 32 percent is plain sky for the title. Joyful, sunny.`,
    estimate: 0.2,
    why: "Student's Book cover (216 x 303 mm): ~270 dpi",
  },
  {
    name: "wbcover",
    size: "2304x3200",
    quality: "high",
    prompt: `${CASTDESC} Workbook cover artwork: the same five children at home and at a library table doing homework together, a big paper kite pinned on the wall, warm afternoon light, coral and teal colours. The top 32 percent is a plain warm wall for the title.`,
    estimate: 0.2,
    why: "Workbook cover (216 x 303 mm): ~270 dpi; optional (the SB cover art can be reused for free)",
  },
];

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
