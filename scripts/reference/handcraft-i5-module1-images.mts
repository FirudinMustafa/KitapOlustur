// Pictures for the hand-set i5-style lessons (1a-1c). Paid: GPT Image via the Gateway.
//   npx tsx --env-file=.env.local .spike/handcraft2/gen.mts [name ...]
import fs from "node:fs";
import path from "node:path";
import { generateImage } from "ai";
import { imageCostFromUsage } from "../../src/lib/ai/pricing";
import { cardSheetGrid, cardSheetItemsPrompt, cardSheetSize, cardSheetStyle, sliceCardSheet } from "../../src/lib/ai/card-sheet";

const OUT = path.join(process.cwd(), ".spike", "handcraft2", "img");
fs.mkdirSync(OUT, { recursive: true });
const MODEL = "openai/gpt-image-2.5-flare";
const STYLE =
  "Bright 2D cartoon illustration for a teenage English coursebook, clean bold outlines, flat cheerful colours, light cel shading, expressive faces, no text, no letters, no numbers, no logos.";
const CAST =
  "Characters (draw exactly so): LILY, 12-year-old girl, curly red hair in a ponytail, freckles, green hoodie, jeans; SAM, 12-year-old boy, short black hair, round glasses, orange T-shirt; ZOE, 12-year-old girl, dark brown skin, long braids, purple top; KENJI, 12-year-old boy, spiky brown hair, blue striped shirt.";

type Job = { name: string; prompt: string; size: "1536x1024" | "1024x1536" | "1024x1024"; cards?: string[] };
const jobs: Job[] = [
  {
    name: "1a-scene",
    size: "1536x1024",
    prompt: `${CAST} A half-decorated teenage bedroom on moving day: LILY is painting a wardrobe light blue, ZOE is standing on a stool hanging yellow curtains, SAM is carrying a big cardboard box, KENJI is sitting at a desk playing a game on a laptop. Cardboard boxes, a rolled rug, a beanbag and an empty bookcase. Sunny window.`,
  },
  { name: "1a-cards", size: "1536x1024", prompt: "", cards: ["a wooden wardrobe", "a desk lamp", "a round striped rug", "a red beanbag chair", "a bookcase with books", "a pair of curtains"] },
  {
    name: "1b-scene",
    size: "1536x1024",
    prompt: `A busy family home on a Saturday morning, shown as a cutaway of a living room and kitchen: a mum at the front door holding a shopping list and bags, a dad loading a dishwasher, a teenage girl vacuuming the rug, a teenage boy carrying a rubbish bag, a grandma watering plants, a lazy cat sleeping on the sofa. Leave plain wall space near the top of the picture.`,
  },
  { name: "1b-cards", size: "1536x1024", prompt: "", cards: ["a laundry basket full of clothes", "an open dishwasher with plates", "a black rubbish bag", "a watering can and a plant", "a table set with plates and cups", "a vacuum cleaner"] },
  {
    name: "1b-party",
    size: "1024x1024",
    prompt: `${CAST} A space theme party in a living room: SAM dressed as an astronaut, ZOE wearing alien antennae, LILY and KENJI with planet costumes, paper planets and stars hanging from the ceiling, a table with snacks and drinks, everyone dancing and laughing.`,
  },
  { name: "1c-cards", size: "1536x1024", prompt: "", cards: ["a skateboard", "a video game controller", "cupcakes on a baking tray", "a sketchbook with a comic drawing", "a camera", "swimming goggles", "a guitar", "a football"] },
  {
    name: "1c-quiz",
    size: "1024x1536",
    prompt: `${CAST} LILY and ZOE sitting together on a big beanbag, doing a fun magazine quiz on a tablet, laughing, holding pens; posters and fairy lights on the wall behind them.`,
  },
  {
    name: "1c-park",
    size: "1536x1024",
    prompt: `${CAST} A sunny park after school: KENJI skateboarding on a ramp, SAM taking photos with a camera, ZOE drawing in a sketchbook on a bench, LILY playing the guitar on the grass.`,
  },
];

async function main() {
  const only = process.argv.slice(2);
  let total = 0;
  for (const job of jobs.filter((j) => !only.length || only.includes(j.name))) {
    if (fs.existsSync(path.join(OUT, `${job.name}.png`))) {
      console.log(job.name, "exists, skipped");
      continue;
    }
    const grid = job.cards ? cardSheetGrid(job.cards.length) : null;
    const prompt = job.cards ? `${cardSheetItemsPrompt(job.cards)}\n\n${cardSheetStyle(job.cards.length, STYLE)}` : `${job.prompt}\n\n${STYLE}`;
    const size = grid ? cardSheetSize(grid) : job.size;
    const res = await generateImage({ model: MODEL, prompt, size, providerOptions: { openai: { quality: "medium" } } });
    const cost = imageCostFromUsage(MODEL, res.usage) ?? 0;
    total += cost;
    const png = Buffer.from(res.image.uint8Array);
    fs.writeFileSync(path.join(OUT, `${job.name}.png`), png);
    if (job.cards && grid) {
      const cards = await sliceCardSheet(png, grid.cols, grid.rows, job.cards.length);
      cards.forEach((c, i) => fs.writeFileSync(path.join(OUT, `${job.name}-${i + 1}.png`), c));
    }
    console.log(job.name, size, `$${cost.toFixed(4)}`);
  }
  console.log("total", `$${total.toFixed(4)}`);
}
main();
