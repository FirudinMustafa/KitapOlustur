// Pictures for the hand-made i5-style Student Book (welcome module + Module 1)
// and its workbook - the ones handcraft-i5-module1-images.mts did not make.
// Paid: GPT Image via the Gateway (~$0.011-0.014 a call, medium quality).
// Card sheets draw many objects in one call (src/lib/ai/card-sheet.ts).
//   npx tsx --env-file=.env.local scripts/reference/handcraft-i5-full-images.mts [name ...]
// Pictures land in .handmade/img (untracked). Every call is logged with its
// cost to .handmade/img/costs.log; an existing picture is never redrawn.
import fs from "node:fs";
import path from "node:path";
import { generateImage } from "ai";
import { imageCostFromUsage } from "../../src/lib/ai/pricing";
import { cardSheetGrid, cardSheetItemsPrompt, cardSheetSize, cardSheetStyle, sliceCardSheet } from "../../src/lib/ai/card-sheet";

const OUT = path.join(process.cwd(), ".handmade", "img");
fs.mkdirSync(OUT, { recursive: true });
const MODEL = "openai/gpt-image-2.5-flare";
const STYLE =
  "Bright 2D cartoon illustration for a teenage English coursebook, clean bold outlines, flat cheerful colours, light cel shading, expressive faces, no text, no letters, no numbers, no logos.";
const CAST =
  "Characters (draw exactly so): LILY, 12-year-old girl, curly red hair in a ponytail, freckles, green hoodie, jeans; SAM, 12-year-old boy, short black hair, round glasses, orange T-shirt; ZOE, 12-year-old girl, dark brown skin, long braids, purple top; KENJI, 12-year-old boy, spiky brown hair, blue striped shirt.";
const MAX_CALLS = 10; // hard budget for this reference (<= $0.15)

type Job = { name: string; prompt: string; size: "1536x1024" | "1024x1536" | "1024x1024"; cards?: string[] };
const jobs: Job[] = [
  {
    name: "w-friends",
    size: "1024x1024",
    prompt: `${CAST} LILY, SAM, ZOE and KENJI standing close together outside their school on the first day of term, smiling and waving at the viewer, school bags on their backs. Upper bodies, close framing, sunny day.`,
  },
  {
    name: "w-family",
    size: "1536x1024",
    prompt: "",
    cards: [
      "head-and-shoulders portrait of a smiling grandfather with white hair and a grey moustache",
      "head-and-shoulders portrait of a grandmother with grey hair in a bun and round glasses",
      "head-and-shoulders portrait of a man with short brown hair and a short beard",
      "head-and-shoulders portrait of a woman with long straight black hair",
      "head-and-shoulders portrait of a woman with short blonde hair and earrings",
      "head-and-shoulders portrait of a man with curly red hair",
      "head-and-shoulders portrait of a teenage boy with dark brown skin and short black hair",
      "head-and-shoulders portrait of a ten-year-old girl with two dark pigtails",
      "head-and-shoulders portrait of a six-year-old boy wearing a red cap",
      "head-and-shoulders portrait of a teenage girl with a blonde ponytail and freckles",
    ],
  },
  {
    name: "w-subjects",
    size: "1536x1024",
    prompt: "",
    cards: ["a globe on a stand", "a microscope", "a paint palette with a brush", "a trumpet", "a calculator and a ruler", "a football and a whistle", "an open laptop", "an ancient Greek helmet"],
  },
  {
    name: "w-landmarks",
    size: "1536x1024",
    prompt: "",
    cards: ["the Taj Mahal", "the Sydney Opera House", "a section of the Great Wall of China on green hills", "the Christ the Redeemer statue on a mountain top", "Mount Fuji with a red pagoda in front", "the Sagrada Familia church in Barcelona"],
  },
  {
    name: "w-moves",
    size: "1536x1024",
    prompt: "",
    cards: [
      "the same small orange cartoon cat with a blue scarf walking into a cardboard box",
      "the same orange cat with a blue scarf jumping out of a cardboard box",
      "the same orange cat with a blue scarf running through a play tunnel",
      "the same orange cat with a blue scarf walking under a little wooden bridge",
      "the same orange cat with a blue scarf walking across a zebra crossing",
      "the same orange cat with a blue scarf walking along the top of a brick wall",
      "the same orange cat with a blue scarf climbing up some stairs",
      "the same orange cat with a blue scarf running down some stairs",
      "the same orange cat with a blue scarf jumping over a wooden fence",
    ],
  },
  {
    name: "d-games",
    size: "1024x1024",
    prompt: "",
    cards: [
      "a video game box cover showing a girl astronaut flying through space past colourful planets",
      "a video game box cover showing a young wizard with a glowing wand in front of a castle at night",
      "a white video game controller",
      "two teenage boys sitting on a sofa playing a video game, excited faces, seen from the front",
    ],
  },
  {
    name: "c-comic",
    size: "1024x1536",
    prompt:
      "A comic page of six panels in a grid of 2 columns and 3 rows with white gutters between panels. No speech bubbles, no text. The hero in every panel is BOLT, a small friendly round blue robot with one antenna and big eyes. Panel 1: BOLT bored on a sofa at home while a girl vacuums. Panel 2: BOLT trying to play basketball in a park and missing the hoop. Panel 3: BOLT painting at an easel, paint splashed everywhere, a teacher looking shocked. Panel 4: BOLT baking in a kitchen, smoke coming out of the oven. Panel 5: BOLT looking through the window of a dance studio where children are dancing. Panel 6: BOLT dancing happily with the children and a smiling dance teacher. Leave some plain space near the top of each panel.",
  },
  {
    name: "f-fun",
    size: "1024x1024",
    prompt: "",
    cards: [
      "a pair of slippers with small mop pads on the soles",
      "a baseball cap with a small open umbrella fixed on top",
      "a toothbrush joined to a tiny music player with headphones",
      "a cheerful cartoon superhero kid in a green cape flying, full body",
    ],
  },
];

async function main() {
  const only = process.argv.slice(2);
  const log = path.join(OUT, "costs.log");
  let total = 0;
  let calls = fs.existsSync(log) ? fs.readFileSync(log, "utf8").split("\n").filter(Boolean).length : 0;
  for (const job of jobs.filter((j) => !only.length || only.includes(j.name))) {
    if (fs.existsSync(path.join(OUT, `${job.name}.png`))) {
      console.log(job.name, "exists, skipped");
      continue;
    }
    if (calls >= MAX_CALLS) {
      console.log("budget reached, stopping before", job.name);
      break;
    }
    const grid = job.cards ? cardSheetGrid(job.cards.length) : null;
    const prompt = job.cards ? `${cardSheetItemsPrompt(job.cards)}\n\n${cardSheetStyle(job.cards.length, STYLE)}` : `${job.prompt}\n\n${STYLE}`;
    const size = grid ? cardSheetSize(grid) : job.size;
    calls++;
    const res = await generateImage({ model: MODEL, prompt, size, providerOptions: { openai: { quality: "medium" } } });
    const cost = imageCostFromUsage(MODEL, res.usage) ?? 0;
    total += cost;
    fs.appendFileSync(log, `${new Date().toISOString()}\t${job.name}\t${size}\t$${cost.toFixed(4)}\t${JSON.stringify(res.usage ?? {})}\n`);
    const png = Buffer.from(res.image.uint8Array);
    fs.writeFileSync(path.join(OUT, `${job.name}.png`), png);
    if (job.cards && grid) {
      const cards = await sliceCardSheet(png, grid.cols, grid.rows, job.cards.length);
      cards.forEach((c, i) => fs.writeFileSync(path.join(OUT, `${job.name}-${i + 1}.png`), c));
    }
    console.log(job.name, size, `$${cost.toFixed(4)}`);
  }
  console.log("this run", `$${total.toFixed(4)}`, "calls so far", calls);
}
void main();
