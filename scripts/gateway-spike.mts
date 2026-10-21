// One cheap call per paid model the book pipeline uses, through the Vercel AI
// Gateway, before a real run relies on them (2026-10-21). Checks the call
// shapes the pipeline uses - a structured unit page with its discriminated
// unions, a picture at the pipeline's size/quality, a speech clip - and
// prints what each one cost. Nothing is written to the database or Blob.
//
//   npx tsx --env-file=.env.local scripts/gateway-spike.mts [--out <dir>]
//
// Needs AI_GATEWAY_API_KEY (or a fresh VERCEL_OIDC_TOKEN) and Gateway credit.
// Costs about $0.10.
import fs from "node:fs";
import path from "node:path";
import { generateImage, generateObject, experimental_generateSpeech as generateSpeech } from "ai";
import { generatedPageSchema } from "../src/lib/ai/schemas";
import {
  BOOK_PIPELINE_IMAGE_MODEL_FINAL,
  BOOK_PIPELINE_INTERIOR_IMAGE_SIZE,
  BOOK_PIPELINE_MODEL,
  BOOK_PIPELINE_SPEECH_MODEL,
} from "../src/lib/ai/model";
import { estimateSpeechCostUsd, imageCostFromUsage, textCostUsd } from "../src/lib/ai/pricing";

async function step<T>(name: string, run: () => Promise<T>): Promise<T | null> {
  const started = Date.now();
  try {
    const result = await run();
    console.log(`ok   ${name} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
    return result;
  } catch (err) {
    console.log(`FAIL ${name}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out");
  const outDir = outAt >= 0 ? args[outAt + 1] : ".spike";
  fs.mkdirSync(outDir, { recursive: true });
  let total = 0;

  const text = await step(`text ${BOOK_PIPELINE_MODEL}`, () =>
    generateObject({
      model: BOOK_PIPELINE_MODEL,
      schema: generatedPageSchema,
      prompt:
        "Write one Pre-A1 English coursebook page for young learners about classroom objects: a short 'Listen and point' exercise with 6 items and a picture prompt, and a 'Listen and chant' exercise with a 4-line chant. Original content.",
    }),
  );
  if (text) {
    const cost = textCostUsd(BOOK_PIPELINE_MODEL, text.usage) ?? 0;
    total += cost;
    console.log(`     ${text.usage.inputTokens} in / ${text.usage.outputTokens} out tokens, $${cost.toFixed(4)}`);
    console.log(`     blocks: ${text.object.blocks.map((b) => b.heading).join(" | ")}`);
  }

  const image = await step(`image ${BOOK_PIPELINE_IMAGE_MODEL_FINAL} ${BOOK_PIPELINE_INTERIOR_IMAGE_SIZE} medium`, () =>
    generateImage({
      model: BOOK_PIPELINE_IMAGE_MODEL_FINAL,
      prompt:
        "Children's coursebook illustration, edge-to-edge colourful classroom scene: a pencil, a book, a ruler, a bag, a rubber and a pen on a desk, two smiling children. Flat vector style, no text.",
      size: BOOK_PIPELINE_INTERIOR_IMAGE_SIZE,
      providerOptions: { openai: { quality: "medium" } },
    }),
  );
  if (image) {
    const cost = imageCostFromUsage(BOOK_PIPELINE_IMAGE_MODEL_FINAL, image.usage) ?? 0;
    total += cost;
    const file = path.join(outDir, "spike-image.png");
    fs.writeFileSync(file, Buffer.from(image.image.uint8Array));
    console.log(`     usage ${JSON.stringify(image.usage)}, $${cost.toFixed(4)} -> ${file}`);
  }

  const script = "Pencil, pencil, on my desk. Book, book, open your book. Ruler, ruler, in my bag. Ready, steady, let's go!";
  const speech = await step(`speech ${BOOK_PIPELINE_SPEECH_MODEL}`, () =>
    generateSpeech({ model: BOOK_PIPELINE_SPEECH_MODEL, text: script, voice: "nova", outputFormat: "mp3" }),
  );
  if (speech) {
    const cost = estimateSpeechCostUsd(BOOK_PIPELINE_SPEECH_MODEL, script.length) ?? 0;
    total += cost;
    const file = path.join(outDir, "spike-speech.mp3");
    fs.writeFileSync(file, Buffer.from(speech.audio.uint8Array));
    console.log(`     $${cost.toFixed(4)} -> ${file}`);
  }

  console.log(`total ~$${total.toFixed(3)}`);
  process.exit(text && image && speech ? 0 : 1);
}

main();
