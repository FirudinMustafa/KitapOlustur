// Paid pictures for the hand-made book re-made from a phone-scanned ELT
// coursebook (.spike/scan/scan.pdf: Starter + Theme 1, modules A and B).
// GPT Image via the Gateway, the system's path: medium quality (~$0.012),
// the cover high (~$0.04). Card sheets draw many objects in one call
// (src/lib/ai/card-sheet.ts) and are cut into cards here.
//   npx tsx --env-file=.env.local scripts/reference/handcraft-scan-images.mts [name ...]
// Pictures land in .handmade-scan/img (untracked). Every call is logged with
// its cost to .handmade-scan/img/costs.log; an existing picture is never
// redrawn. Hard cap: 12 calls and $0.20 for the whole book.
import fs from "node:fs";
import path from "node:path";
import { generateImage } from "ai";
import { imageCostFromUsage } from "../../src/lib/ai/pricing";
import { cardSheetGrid, cardSheetItemsPrompt, cardSheetSize, cardSheetStyle, sliceCardSheet } from "../../src/lib/ai/card-sheet";

const OUT = path.join(process.cwd(), ".handmade-scan", "img");
fs.mkdirSync(OUT, { recursive: true });
const MODEL = "openai/gpt-image-2.5-flare";
const MAX_CALLS = 12;
const MAX_USD = 0.2;
const STYLE =
  "Bright 2D cartoon illustration for a children's English coursebook (ages 10-12), clean bold outlines, saturated cheerful colours, soft cel shading, expressive friendly faces, no text, no letters, no numbers, no logos.";
const CAST =
  "Recurring characters (draw exactly so): ZARA, 11-year-old girl from a Moon base, short silver-white bob haircut with one teal streak, round goggles pushed up on her head, orange jumpsuit with round patches; THEO, 12-year-old boy, dark brown skin, black curly hair, lime-green space jacket, big headphones round his neck; MAYA, 11-year-old Earth girl, long black hair in a high ponytail, teal school jumper; MR OKAFOR, tall teacher with a short grey beard, glasses and a brown cardigan.";

type Job = { name: string; prompt: string; size: "1536x1024" | "1024x1536" | "1024x1024"; cards?: string[]; quality?: "medium" | "high" };
const jobs: Job[] = [
  {
    name: "cover",
    size: "1024x1536",
    quality: "high",
    prompt: `${CAST} Front cover artwork for a children's English coursebook. ZARA, THEO and MAYA run and wave happily in the lower half in front of a bright modern school with a big clock, a small round purple flying school bus with a glass bubble roof and tiny rocket thrusters zooms past, colourful books, a football and paper planes fly around them. Clear bright sky-blue background, the top third of the picture is plain empty sky for the title. Dynamic, joyful.`,
  },
  {
    name: "starter",
    size: "1024x1536",
    prompt: `A sunny city park scene: five children aged 10-12 greet each other - a boy on a red bicycle waving, two girls hugging goodbye with school bags, a girl jumping happily on the grass, a boy in a cap looking at his wristwatch. Green trees, a winding path, a few tall city buildings behind the trees, butterflies. The top 30% of the picture is plain light-blue sky with a few clouds and nothing else, and the upper right quarter is clear sky too.`,
  },
  {
    name: "theme1",
    size: "1024x1536",
    prompt: `In front of a colourful two-storey school with a big round clock above the entrance and a zebra crossing on the road: a girl kicking a football high, a boy on a kick scooter wearing a helmet, a tall boy with a backpack standing by the door, and a bright green parrot wearing a tiny red cap sitting on a tree branch on the left. The top 30% of the picture is plain pale sky with nothing in it.`,
  },
  {
    name: "story",
    size: "1024x1536",
    prompt: `${CAST} A comic page of exactly three wide horizontal panels stacked on top of each other, separated by thin white lines, no speech bubbles, no text. Panel 1 (top): in a school cloakroom MAYA holds up a teal school jumper for THEO, who looks unhappy; ZARA laughs; the LEFT half of this panel is a plain light wall. Panel 2 (middle): a classroom, THEO secretly plays with a small glowing floating hologram ball under his desk, classmates stare, MR OKAFOR stands with his arms crossed looking cross; the RIGHT third of this panel is a plain light wall. Panel 3 (bottom): THEO writes on a big whiteboard while MR OKAFOR points at it and ZARA and MAYA watch; the LEFT half of this panel is a plain light wall.`,
  },
  {
    name: "town",
    size: "1536x1024",
    prompt: `A busy, detailed old-town square seen from slightly above: on the left a greengrocer's shop with a striped green awning and boxes of fruit and vegetables; behind it a park with trees, benches and a fountain; in the middle a chemist's shop with a green cross sign and a bakery with bread and cakes in the window; on the right a cinema with a big marquee and film posters and a museum with tall stone columns and a statue. People walking, a clock post, lamp posts. All shop signs are blank. The top right corner is clear sky.`,
  },
  {
    name: "cast",
    size: "1536x1024",
    prompt: "",
    cards: [
      "a small round purple flying school bus with a glass bubble roof, big friendly headlight eyes and tiny rocket thrusters, floating",
      `ZARA: 11-year-old girl, short silver-white bob haircut with one teal streak, round goggles pushed up on her head, orange jumpsuit with round patches, waving, full body`,
      `THEO: 12-year-old boy, dark brown skin, black curly hair, lime-green space jacket, big headphones round his neck, thumbs up, full body`,
      "OFFICER K-77: a tall chrome-and-blue security robot with a single red visor and a small badge, holding a notepad, full body",
      "PIP: a small robot owl made of copper with big glowing green eyes and little propeller wings, flying",
      `MAYA: 11-year-old girl, long black hair in a high ponytail, teal school jumper, grey skirt, smiling, full body`,
      `MR OKAFOR: tall teacher with a short grey beard, glasses and a brown cardigan, holding a book, full body`,
    ],
  },
  {
    name: "classroom",
    size: "1536x1024",
    prompt: `A bright cartoon classroom: a green chalkboard on the left wall, a blue door in the middle, a red umbrella stand with an umbrella, a pile of books on a shelf, a pencil case and a pen on the front desk, a big blue atlas, a ruler, wooden chairs; a cheerful girl with curly brown hair and a yellow hoodie sits at a desk on the right drawing with a pencil. The upper right quarter is a plain empty orange wall.`,
  },
  {
    name: "jobs",
    size: "1536x1024",
    prompt: "",
    cards: [
      "upper body of a smiling vet holding a small puppy",
      "upper body of a firefighter in a yellow helmet and uniform",
      "upper body of a mechanic in blue overalls holding a spanner",
      "upper body of a baker in a white hat holding a tray of bread",
      "upper body of a photographer holding a big camera",
      "upper body of a farmer in a straw hat holding a basket of vegetables",
      "upper body of a nurse in blue scrubs with a stethoscope",
      "upper body of an airline pilot in a white shirt and pilot cap",
      "upper body of a waiter in a black waistcoat holding a plate",
      "upper body of a police officer in a dark blue uniform and cap",
    ],
  },
  {
    name: "classlang",
    size: "1536x1024",
    prompt: "",
    cards: [
      "a boy at a school desk raising his hand high",
      "a girl closing a big book",
      "a teacher with a hand behind her ear, listening",
      "a boy writing the date in his notebook",
      "two children sharing one book and talking",
      "a girl pointing at a window and asking",
      "a boy putting paper into a rubbish bin",
      "a puzzled girl with a question mark look, scratching her head",
    ],
  },
  {
    name: "people",
    size: "1536x1024",
    prompt: "",
    cards: [
      "a school librarian with glasses holding books, full body",
      "a school cook in a white apron and hat holding a ladle, full body",
      "a sports coach in a tracksuit with a whistle and a basketball, full body",
      "a music teacher holding a guitar, full body",
      "two smiling classmates, a boy and a girl with school bags, full body",
      "a school caretaker in grey overalls holding a toolbox, full body",
      "a headteacher in a dark suit with arms folded, full body",
      "a school bus driver in a cap standing by a small yellow bus door, full body",
      "a school nurse in a light blue uniform with a first-aid box, full body",
    ],
  },
  {
    name: "routines",
    size: "1536x1024",
    prompt: "",
    cards: [
      "a pupil handing in homework to a teacher",
      "children lining up at a classroom door",
      "a girl packing her school bag",
      "children having lunch in a school canteen",
      "a boy tidying his desk",
      "two children reading a school notice board",
      "a girl washing her hands at a sink",
      "a boy hanging up his coat on a hook",
    ],
  },
];

async function main() {
  const only = process.argv.slice(2);
  const log = path.join(OUT, "costs.log");
  const past = fs.existsSync(log) ? fs.readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
  let calls = past.length;
  let spent = past.reduce((s, l) => s + Number(l.split("\t")[3]?.replace("$", "") ?? 0), 0);
  for (const job of jobs.filter((j) => !only.length || only.includes(j.name))) {
    if (fs.existsSync(path.join(OUT, `${job.name}.png`))) {
      console.log(job.name, "exists, skipped");
      continue;
    }
    const expected = job.quality === "high" ? 0.045 : 0.015;
    if (calls >= MAX_CALLS || spent + expected > MAX_USD) {
      console.log("budget reached, stopping before", job.name, { calls, spent });
      break;
    }
    const grid = job.cards ? cardSheetGrid(job.cards.length) : null;
    const prompt = job.cards ? `${cardSheetItemsPrompt(job.cards)}\n\n${cardSheetStyle(job.cards.length, STYLE)}` : `${job.prompt}\n\n${STYLE}`;
    const size = grid ? cardSheetSize(grid) : job.size;
    calls++;
    const res = await generateImage({ model: MODEL, prompt, size, providerOptions: { openai: { quality: job.quality ?? "medium" } } });
    const cost = imageCostFromUsage(MODEL, res.usage) ?? 0;
    spent += cost;
    fs.appendFileSync(log, `${new Date().toISOString()}\t${job.name}\t${size}\t$${cost.toFixed(4)}\t${JSON.stringify(res.usage ?? {})}\n`);
    const png = Buffer.from(res.image.uint8Array);
    fs.writeFileSync(path.join(OUT, `${job.name}.png`), png);
    if (job.cards && grid) {
      const cards = await sliceCardSheet(png, grid.cols, grid.rows, job.cards.length);
      cards.forEach((c, i) => fs.writeFileSync(path.join(OUT, `${job.name}-${i + 1}.png`), c));
    }
    console.log(job.name, size, `$${cost.toFixed(4)}`);
  }
  console.log("total spent", `$${spent.toFixed(4)}`, "calls", calls);
}
void main();
