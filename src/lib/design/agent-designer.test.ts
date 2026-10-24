import { describe, expect, it, vi } from "vitest";
import type { ModelMessage } from "ai";
import type { ContentBlock } from "@/lib/ai/schemas";
import type { SourcePageLayout } from "@/lib/source-layout";
import { designerBrief, designPage, dropOldRenderImages, type DesignerInput, type DesignRender } from "./agent-designer";
import { estimatePromptTokens, imageTokens, replaySpec, scriptedDesignerModel } from "./fake-designer-model";
import type { PageLayoutSpec } from "./page-layout-spec";

// The designer loop against a scripted model: no paid call anywhere.

// A 4×2 PNG (the loop only passes it through; the fake model counts its tokens).
const PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAAASFvFNAAAAEklEQVR4nGP4z8AARwyEOQAA+lUD/T8R0BoAAAAASUVORK5CYII=", "base64"));

const blocks: (ContentBlock | null)[] = [
  { kind: "practice", heading: "1 Listen and point", body: "Say the names.", items: ["Leo", "Amina"] },
  { kind: "practice", heading: "2 Ask and answer", body: "Ask a friend.", items: ["Hello!"] },
  null,
];

const sourceLayout: SourcePageLayout = {
  widthPt: 620,
  heightPt: 782,
  images: [{ x: 0.17, y: 0.12, w: 0.65, h: 0.42 }],
  textColumns: 1,
  wordCount: 20,
  exerciseCount: 2,
  itemCount: 0,
  exerciseRubrics: [],
  bodyFontPt: 12,
  headingFontPt: 15,
  zone: "image_top_text_bottom",
};

const input: DesignerInput = {
  sourcePng: PNG,
  sourceLayout,
  blocks,
  pictures: [{ aspect: 1.5, object: false, shows: "four children waving" }],
  available: { topBand: true, lessonTab: false, labels: 0, bubbles: 0 },
  page: { width: 620, height: 782, bodySize: 12, youngLearners: true },
  colors: ["#ee4136", "#ffd21f"],
};

const good: PageLayoutSpec = {
  version: 1,
  pictures: [{ picture: 0, box: { x: 0.06, y: 0.12, w: 0.88, h: 0.4 } }],
  regions: [
    { box: { x: 0.06, y: 0.05, w: 0.88, h: 0.06 }, blocks: [0] },
    { box: { x: 0.06, y: 0.54, w: 0.88, h: 0.1 }, blocks: [1] },
  ],
};

// Fits every region unless told which run over.
const renderer = (overflowing: number[] = []) =>
  vi.fn(async (spec: PageLayoutSpec): Promise<DesignRender> => ({
    png: PNG,
    fits: spec.regions.map((r, i) => ({ region: i, needed: 20, available: Math.round(r.box.h * 782), overflow: overflowing.includes(i) })),
    look: { palette: 0.5, colourfulness: 0.6, ink: 0.7, inkMap: 0.6, pictureArea: 0.8 },
  }));

describe("designPage", () => {
  it("returns the spec a model renders and hands in, and accounts every call", async () => {
    const onUsage = vi.fn();
    const render = renderer();
    const out = await designPage(input, { model: scriptedDesignerModel(replaySpec(good)), render, onUsage });
    expect(out.spec).toEqual(good);
    expect(out.stopped).toBe("finished");
    expect(out.turns).toBe(2);
    // render, then finish draws it again to check it
    expect(render).toHaveBeenCalledTimes(2);
    expect(onUsage).toHaveBeenCalledTimes(2);
    expect(out.usage.inputTokens).toBeGreaterThan(1000);
    expect(out.costUsd).toBeGreaterThan(0);
  });

  it("refuses a hand-in whose text runs over, and takes the fixed one", async () => {
    let calls = 0;
    const render = vi.fn(async (spec: PageLayoutSpec): Promise<DesignRender> => {
      calls++;
      // the first spec's region 1 runs over
      return { png: PNG, fits: spec.regions.map((r, i) => ({ region: i, needed: 90, available: Math.round(r.box.h * 782), overflow: calls === 1 && i === 1 })) };
    });
    const fixed = { ...good, regions: [good.regions[0], { ...good.regions[1], box: { x: 0.06, y: 0.54, w: 0.88, h: 0.2 } }] };
    const model = scriptedDesignerModel([
      { tool: "finish", spec: good },
      { tool: "finish", spec: fixed },
    ]);
    const out = await designPage(input, { model, render });
    expect(out.spec).toEqual(fixed);
    expect(out.turns).toBe(2);
    // the model saw why the first one was refused
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toMatch(/text runs over: region 1/);
  });

  it("refuses a spec that leaves a printed block out or places one that does not print", async () => {
    const missing = { ...good, regions: [good.regions[0]] };
    const hidden = { ...good, regions: [good.regions[0], { ...good.regions[1], blocks: [1, 2] }] };
    const model = scriptedDesignerModel([
      { tool: "finish", spec: missing },
      { tool: "finish", spec: hidden },
      { text: "I give up." },
    ]);
    const out = await designPage(input, { model, render: renderer() });
    expect(out.spec).toBeNull();
    expect(out.stopped).toBe("gave-up");
    const seen = JSON.stringify(model.doGenerateCalls[2].prompt);
    expect(seen).toMatch(/block 1 is not placed/);
    expect(seen).toMatch(/block 2 is not printed/);
  });

  it("stops after its turns, the last one forced to hand in", async () => {
    const model = scriptedDesignerModel([{ tool: "render", spec: good }]);
    const out = await designPage(input, { model, render: renderer(), maxTurns: 3 });
    // the forced last turn still replays a render here: no spec
    expect(out.spec).toBeNull();
    expect(out.stopped).toBe("turns");
    expect(out.turns).toBe(3);
    expect(model.doGenerateCalls[2].toolChoice).toEqual({ type: "tool", toolName: "finish" });
    expect(model.doGenerateCalls[0].toolChoice).toEqual({ type: "auto" });
  });

  it("stops when the page's budget is spent", async () => {
    const out = await designPage(input, { model: scriptedDesignerModel([{ tool: "render", spec: good }]), render: renderer(), maxCostUsd: 0.000001 });
    expect(out.stopped).toBe("budget");
    expect(out.turns).toBe(1);
  });

  it("passes on an accounting failure (the run's spend cap) after stopping", async () => {
    const model = scriptedDesignerModel(replaySpec(good));
    const onUsage = vi.fn(async () => {
      throw new Error("spend cap passed");
    });
    await expect(designPage(input, { model, render: renderer(), onUsage })).rejects.toThrow("spend cap passed");
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("survives a model call that fails", async () => {
    const model = scriptedDesignerModel(replaySpec(good));
    model.doGenerate = async () => {
      throw new Error("insufficient credit");
    };
    const out = await designPage(input, { model, render: renderer() });
    expect(out.spec).toBeNull();
    expect(out.log.join(" ")).toMatch(/insufficient credit/);
  });
});

describe("designerBrief", () => {
  it("lists the source's pictures, every block by index and the pictures to place", () => {
    const brief = designerBrief(input);
    expect(brief).toMatch(/\[0\.17, 0\.12, 0\.65, 0\.42\]/);
    expect(brief).toMatch(/\[0\] practice; heading: "1 Listen and point"/);
    expect(brief).toMatch(/\[2\] \(not printed on this page/);
    expect(brief).toMatch(/\[0\] aspect 1\.50 \(w\/h\), a scene/);
  });
});

describe("dropOldRenderImages", () => {
  const result = (n: number): ModelMessage => ({
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId: `c${n}`,
        toolName: "render",
        output: { type: "content", value: [{ type: "text", text: `report ${n}` }, { type: "image-data", data: "iVBOR", mediaType: "image/png" }] },
      },
    ],
  });
  it("keeps the last renders' images and the reports of all", () => {
    const out = dropOldRenderImages([result(1), result(2), result(3)], 2);
    const images = out.map((m) => JSON.stringify(m).includes("image-data"));
    expect(images).toEqual([false, true, true]);
    expect(JSON.stringify(out[0])).toMatch(/report 1.*older render image omitted/);
  });
});

describe("fake model token estimate", () => {
  it("counts an image by its pixels and text by its length", () => {
    expect(imageTokens({ width: 750, height: 1000 })).toBe(1000);
    // over 1568 px on the long side, scaled down first
    expect(imageTokens({ width: 3136, height: 1568 })).toBe(Math.ceil((1568 * 784) / 750));
    expect(estimatePromptTokens([{ role: "user", content: [{ type: "text", text: "x".repeat(350) }, { type: "file", data: PNG }] }])).toBeCloseTo(100 + 1, -1);
  });
});
