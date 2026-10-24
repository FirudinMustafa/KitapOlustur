// Runs the agent designer (src/lib/design/agent-designer.ts) on a stored
// run's Student Book pages, outside the workflow, and writes the designed
// pages as a PDF with every render as a PNG. Reads the database, never
// writes it.
//
//   npx tsx --env-file=.env.local scripts/agent-designer.mts <runId-prefix> <source.pdf> <sourcePages> --fake [--out <prefix>]
//   npx tsx --env-file=.env.local scripts/agent-designer.mts <runId-prefix> <source.pdf> <sourcePages> --paid [--turns 6] [--out <prefix>]
//
// <sourcePages>: the source page numbers the Student Book pages mirror, comma-separated ("2,3").
// --fake replays the hand-written specs in scripts/agent-designer-fixtures/
// (<runId-prefix>-p<page>.json) through the whole loop with a scripted model:
// free. A page without one is left to the template path (null).
// --brief prints what the designer is told about each page. --fake-renders N
// has the fake render N times before it finishes, to see what a full-length
// run would cost (the token counts are estimated from the real prompts).
// --paid calls the pipeline's model (Sonnet 5.5 via the AI Gateway) and
// costs money - it is refused without the flag. The specs it produces are
// written next to the PDF (<out>-p<page>.json), ready to be used as fixtures.
import fs from "node:fs";
import path from "node:path";
import { loadStoredBook } from "./stored-run.mjs";
import { resolveTrimSize } from "../src/lib/pdf/page-geometry";
import { rasterizePdf } from "../src/lib/pdf/rasterize";
import { renderSpecPages, type SpecPageContext } from "../src/lib/pdf/spec-page";
import { bookSpecContext, designBookPage, designerInputFor, withSpecTints } from "../src/lib/pdf/spec-design";
import { designerBrief, DEFAULT_MAX_TURNS } from "../src/lib/design/agent-designer";
import { replaySpec, scriptedDesignerModel } from "../src/lib/design/fake-designer-model";
import { parseSpec, type PageLayoutSpec } from "../src/lib/design/page-layout-spec";
import { BOOK_PIPELINE_MODEL, toTextModel } from "../src/lib/ai/model";

const FIXTURES = path.join(process.cwd(), "scripts", "agent-designer-fixtures");

function option(args: string[], name: string): string | null {
  const at = args.indexOf(name);
  return at >= 0 ? args.splice(at, 2)[1] : null;
}
function flag(args: string[], name: string): boolean {
  const at = args.indexOf(name);
  return at >= 0 && !!args.splice(at, 1).length;
}

function fixtureFor(prefix: string, sourcePage: number): PageLayoutSpec | null {
  const file = path.join(FIXTURES, `${prefix}-p${sourcePage}.json`);
  if (!fs.existsSync(file)) return null;
  const parsed = parseSpec(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!parsed.spec) throw new Error(`${file}: ${parsed.issues.join("; ")}`);
  return parsed.spec;
}

async function main() {
  const args = process.argv.slice(2);
  const fake = flag(args, "--fake");
  const brief = flag(args, "--brief");
  const fakeRenders = Number(option(args, "--fake-renders") ?? 1);
  const paid = flag(args, "--paid");
  const turns = Number(option(args, "--turns") ?? DEFAULT_MAX_TURNS);
  const outArg = option(args, "--out");
  const [prefix, sourcePdf, pagesArg] = args;
  if (!prefix || !sourcePdf || !pagesArg || fake === paid) {
    console.error("usage: npx tsx --env-file=.env.local scripts/agent-designer.mts <runId-prefix> <source.pdf> <sourcePages,...> (--fake | --paid) [--turns N] [--out <prefix>]");
    process.exit(1);
  }
  const out = outArg ?? path.join(".relayout", `agent-designer-${prefix}${fake ? "-fake" : ""}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const sourcePages = pagesArg.split(",").map(Number);

  const book = await loadStoredBook(prefix, { zonesFrom: sourcePdf });
  const { run, outline, units, measured, paletteColors, layouts } = book;
  const trimSize = resolveTrimSize(book.project?.trimSize ?? "a4");
  const pageImages = (run.pageImageUrls as Record<number, string> | null) ?? {};
  const sourceBytes = new Uint8Array(fs.readFileSync(sourcePdf));

  const designed: { ctx: SpecPageContext & { topic?: string }; spec: PageLayoutSpec; sourcePage: number }[] = [];
  let totalCost = 0;
  for (const sourcePage of sourcePages) {
    const unit = units.find((u) => u.studentBookPages.some((p) => p.sourcePageNumber === sourcePage));
    const ctx = unit
      ? await bookSpecContext({
          units,
          unitNumber: unit.unitNumber,
          pageIndex: unit.studentBookPages.findIndex((p) => p.sourcePageNumber === sourcePage),
          pageImages,
          sourceType: measured,
          dominantColors: paletteColors,
          designTheme: run.designTheme,
          trimSize,
          level: outline.level,
        })
      : null;
    if (!ctx) {
      console.warn(`p.${sourcePage}: no Student Book page mirrors it`);
      continue;
    }
    const layout = layouts?.[sourcePage - 1];
    if (!layout) throw new Error(`source has no page ${sourcePage}`);
    const [sourcePng] = await rasterizePdf(sourceBytes, { dpi: 80, pages: [sourcePage] });
    fs.writeFileSync(`${out}-p${sourcePage}-source.png`, sourcePng.png);
    const input = designerInputFor(ctx, { sourcePng: sourcePng.png, sourceLayout: layout }, pageImages);
    if (!input) {
      console.warn(`p.${sourcePage}: not designable (hand-positioned, or prints a glossary) - template path`);
      continue;
    }
    if (brief) console.log(`--- p.${sourcePage} brief ---
${designerBrief(input)}
`);
    const fixture = fake ? fixtureFor(prefix, sourcePage) : null;
    const model = fake ? scriptedDesignerModel(fixture ? replaySpec(fixture, fakeRenders) : [{ text: "No hand-written spec for this page." }]) : toTextModel(BOOK_PIPELINE_MODEL);
    let renders = 0;
    const started = Date.now();
    const designedPage = await designBookPage(ctx, { png: sourcePng.png, layout, pageImages }, {
      model,
      maxTurns: turns,
      onRender: (drawn) => fs.writeFileSync(`${out}-p${sourcePage}-r${++renders}.png`, drawn.png),
    });
    if (!designedPage) continue;
    const { result } = designedPage;
    totalCost += result.costUsd;
    console.log(
      `p.${sourcePage}: ${result.stopped}, ${result.turns} turns, ${result.renders} renders, ${result.usage.inputTokens} in / ${result.usage.outputTokens} out tokens, ` +
        `${fake ? "estimated " : ""}$${result.costUsd.toFixed(4)}, ${Math.round((Date.now() - started) / 1000)}s - ${result.log.join("; ")}`,
    );
    if (result.spec) {
      fs.writeFileSync(`${out}-p${sourcePage}.json`, JSON.stringify(result.spec, null, 2));
      // the final page as the book prints it: its pictures tinted as the spec asks
      designed.push({ ctx: await withSpecTints(result.spec, ctx), spec: result.spec, sourcePage });
    }
  }
  if (designed.length) {
    const pdf = await renderSpecPages(designed);
    fs.writeFileSync(`${out}.pdf`, pdf);
    for (const [i, png] of (await rasterizePdf(new Uint8Array(pdf), { dpi: 80 })).entries()) fs.writeFileSync(`${out}-p${designed[i].sourcePage}-final.png`, png.png);
  }
  console.log(`${designed.length}/${sourcePages.length} pages designed, ${fake ? "estimated " : ""}total $${totalCost.toFixed(4)} -> ${out}.pdf`);
  process.exit(0);
}
void main();
