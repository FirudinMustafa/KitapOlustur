import { MockLanguageModelV3 } from "ai/test";
import type { PageLayoutSpec } from "./page-layout-spec";

// A scripted stand-in for the designer's model (agent-designer.ts): each
// call answers with the next predetermined tool call, so the loop - tools,
// renders, checks, stop conditions, usage accounting - runs end to end at
// no cost (tests, `scripts/agent-designer.mts --fake`). Never used by the
// workflow.
//
// Its usage is an estimate of what the real model would be billed for the
// same prompt: text at ~3.5 characters a token, each PNG at Anthropic's
// (width × height) / 750 tokens, plus OUTPUT_PROSE tokens of reasoning a
// real model writes around its tool call. That is what the cost cap sees,
// and what the per-page cost estimate is worked out from.

export type FakeTurn = { tool: "render" | "finish"; spec: PageLayoutSpec } | { text: string };

const CHARS_PER_TOKEN = 3.5;
const OUTPUT_PROSE = 300;
const MAX_IMAGE_SIDE = 1568;

const PNG_B64 = /^iVBORw0KGgo/;

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export function imageTokens(size: { width: number; height: number }): number {
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(size.width, size.height));
  return Math.ceil((size.width * scale * (size.height * scale)) / 750);
}

// Input tokens of a prompt (messages and tool definitions) as the real model would count them, roughly.
export function estimatePromptTokens(prompt: unknown, tools?: unknown): number {
  let chars = 0;
  let images = 0;
  const walk = (v: unknown): void => {
    if (v instanceof Uint8Array) {
      const size = pngSize(v);
      if (size) images += imageTokens(size);
      return;
    }
    if (typeof v === "string") {
      if (PNG_B64.test(v)) {
        const size = pngSize(new Uint8Array(Buffer.from(v.slice(0, 64), "base64")));
        if (size) images += imageTokens(size);
      } else chars += v.length;
      return;
    }
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k !== "providerOptions") walk(x);
  };
  walk(prompt);
  if (tools) chars += JSON.stringify(tools).length;
  return Math.ceil(chars / CHARS_PER_TOKEN) + images;
}

export function scriptedDesignerModel(script: FakeTurn[]) {
  let turn = 0;
  const model = new MockLanguageModelV3({
    modelId: "scripted-designer",
    doGenerate: async (options) => {
      const next = script[Math.min(turn, script.length - 1)];
      turn++;
      const input = estimatePromptTokens(options.prompt, options.tools);
      if (!next || "text" in next) {
        const text = next?.text ?? "I cannot design this page.";
        return {
          content: [{ type: "text", text }],
          finishReason: { unified: "stop", raw: undefined },
          usage: usage(input, Math.ceil(text.length / CHARS_PER_TOKEN)),
          warnings: [],
        };
      }
      const args = JSON.stringify({ spec: next.spec });
      return {
        content: [{ type: "tool-call", toolCallId: `call-${turn}`, toolName: next.tool, input: args }],
        finishReason: { unified: "tool-calls", raw: undefined },
        usage: usage(input, Math.ceil(args.length / CHARS_PER_TOKEN) + OUTPUT_PROSE),
        warnings: [],
      };
    },
  });
  return model;
}

function usage(input: number, output: number) {
  return {
    inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: output, text: output, reasoning: undefined },
  };
}

/** The usual script for a hand-written spec: render it, look, hand it in. */
export function replaySpec(spec: PageLayoutSpec): FakeTurn[] {
  return [
    { tool: "render", spec },
    { tool: "finish", spec },
  ];
}
