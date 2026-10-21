// Real, sourced per-unit pricing for the non-text-token AI calls this app
// makes (image generation, text-to-speech) - the text/token pricing table
// already exists separately (MODEL_PRICING_PER_MILLION in RunStatusView.tsx).
// Verified via web search 2026-09-21, not guessed - see the note on each
// constant for the source and its precision.
//
// Video (Higgsfield/Veo) is deliberately NOT priced here yet - video
// generation is currently inert (Higgsfield needs API keys that aren't
// configured; see src/db/schema.ts's storyArtifacts comment), so there is
// no real, verifiable per-call cost to attach it to yet. Add entries here
// the same way once it's actually producing output.

// GPT Image 2 / GPT Image 1 Mini bill by internal image tokens, not a flat
// per-image price - OpenAI/community-published numbers below are for
// standard (medium) quality at 1024x1024, the closest match to this
// pipeline's generateImage calls (workflows/book-pipeline.tsx,
// src/lib/ai/studio-generation.ts), which don't request an explicit
// size/quality. Real per-call cost varies with whatever size/quality the
// provider actually renders at, so this is a labeled ESTIMATE, not exact -
// unlike the TTS rate below, which is an exact, published number.
export const IMAGE_PRICE_USD_ESTIMATE: Record<string, number> = {
  "openai/gpt-image-2": 0.053,
  "openai/gpt-image-1-mini": 0.011,
  // 2026-10-21: same tokens as GPT Image 2, landscape/portrait size. The
  // pipeline prefers imageCostFromUsage (real reported tokens) when it can.
  "openai/gpt-image-2.5-flare": 0.08,
  "openai/gpt-image-2.5-sunburst": 0.08,
};

// OpenAI tts-1-hd: $30.00 per 1,000,000 characters - official, exact rate
// (platform.openai.com/docs/pricing). Actual cost is computed from the real
// character count of the synthesized text, so this one is exact, not an
// estimate. tts-1 (now the draft-tier model, see model.ts's
// resolveSpeechModel) is $15.00 per 1,000,000 - confirmed live against the
// Vercel AI Gateway catalog (https://ai-gateway.vercel.sh/v1/models,
// 2026-09-23), also exact.
export const SPEECH_PRICE_USD_PER_MILLION_CHARS: Record<string, number> = {
  "openai/tts-1-hd": 30,
  "openai/tts-1": 15,
};

export function estimateImageCostUsd(model: string): number | null {
  return IMAGE_PRICE_USD_ESTIMATE[model] ?? null;
}

export function estimateSpeechCostUsd(model: string, characterCount: number): number | null {
  const ratePerMillion = SPEECH_PRICE_USD_PER_MILLION_CHARS[model];
  if (ratePerMillion == null || !characterCount) return null;
  return (characterCount / 1_000_000) * ratePerMillion;
}

// Faz "Gelişmiş Görsel Üretim Paneli" (2026-09-21, ROADMAP.md): GPT Image 2.5
// Flare and Sunburst publish identical token rates ($5/1M text input, $8/1M
// image input, $30/1M output - vercel.com/ai-gateway/models/gpt-image-2.5-flare
// and .../gpt-image-2.5-sunburst, checked 2026-09-21) - the two variants
// differ in speed/detail, not price, so one shared per-size estimate table
// covers both. Base 1024x1024 figure is the same published high-quality
// estimate used for the older GPT Image 2 above (~$0.053); the two
// non-square sizes have ~1.5x the pixel count, scaled proportionally - a
// labeled ESTIMATE like the flat rates above, not an exact number (OpenAI
// hasn't published exact output-token counts per size/quality).
export const STUDIO_IMAGE_PRICE_USD_ESTIMATE_BY_SIZE: Record<string, number> = {
  "1024x1024": 0.053,
  "1024x1536": 0.08,
  "1536x1024": 0.08,
};

export function estimateStudioImageCostUsd(size: string, count: number): number | null {
  const perImage = STUDIO_IMAGE_PRICE_USD_ESTIMATE_BY_SIZE[size];
  if (perImage == null || !count) return null;
  return perImage * count;
}


// Gateway token rates (USD per 1M tokens) for image models that report
// usage - checked against https://ai-gateway.vercel.sh/v1/models, 2026-10-21.
const IMAGE_TOKEN_PRICE_PER_MILLION: Record<string, { input: number; output: number }> = {
  "openai/gpt-image-2": { input: 5, output: 30 },
  "openai/gpt-image-2.5-flare": { input: 5, output: 30 },
  "openai/gpt-image-2.5-sunburst": { input: 5, output: 30 },
  "openai/gpt-image-1-mini": { input: 2, output: 8 },
};

/** Real cost of one image call from the usage the provider reported, or the
 *  flat estimate when it reported none. */
export function imageCostFromUsage(
  model: string,
  usage: { inputTokens?: number; outputTokens?: number } | undefined,
): number | null {
  const rate = IMAGE_TOKEN_PRICE_PER_MILLION[model];
  const tokens = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
  if (!rate || !tokens) return estimateImageCostUsd(model);
  return ((usage?.inputTokens ?? 0) * rate.input + (usage?.outputTokens ?? 0) * rate.output) / 1_000_000;
}

// Text model rates (USD per 1M tokens), Gateway catalog 2026-10-21. Shared by
// the run cost card (RunStatusView.tsx) and the pipeline's spend cap.
export const TEXT_PRICE_PER_MILLION: Record<string, { input: number; output: number }> = {
  "anthropic/claude-sonnet-5.5": { input: 2, output: 10 },
  "anthropic/claude-sonnet-5": { input: 2, output: 10 },
  "anthropic/claude-haiku-4-5": { input: 1, output: 5 },
  "google/gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "google/gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "openai/gpt-5-nano": { input: 0.05, output: 0.4 },
};

/** Cost of one text call. Unknown or free-mode (no "vendor/" prefix) models
 *  cost nothing here - free mode is not billed through the Gateway. */
export function textCostUsd(
  model: string,
  usage: { inputTokens?: number; outputTokens?: number },
): number | null {
  const rate = TEXT_PRICE_PER_MILLION[model];
  if (!rate) return null;
  const cost = ((usage.inputTokens ?? 0) * rate.input + (usage.outputTokens ?? 0) * rate.output) / 1_000_000;
  return cost || null;
}

// Per-run spend cap (2026-10-21): a paid run stops once its recorded spend
// (text + image + audio) passes this. RUN_COST_CAP_USD overrides; 0 turns the
// cap off.
export const DEFAULT_RUN_COST_CAP_USD = 6;

export function runCostCapUsd(): number {
  const raw = process.env.RUN_COST_CAP_USD;
  if (raw === undefined || raw === "") return DEFAULT_RUN_COST_CAP_USD;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_RUN_COST_CAP_USD;
}

export function isOverCostCap(totalUsd: number, cap = runCostCapUsd()): boolean {
  return cap > 0 && totalUsd > cap;
}
