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
};

// OpenAI tts-1-hd: $30.00 per 1,000,000 characters - official, exact rate
// (platform.openai.com/docs/pricing). Actual cost is computed from the real
// character count of the synthesized text, so this one is exact, not an
// estimate.
export const SPEECH_PRICE_USD_PER_MILLION_CHARS: Record<string, number> = {
  "openai/tts-1-hd": 30,
};

export function estimateImageCostUsd(model: string): number | null {
  return IMAGE_PRICE_USD_ESTIMATE[model] ?? null;
}

export function estimateSpeechCostUsd(model: string, characterCount: number): number | null {
  const ratePerMillion = SPEECH_PRICE_USD_PER_MILLION_CHARS[model];
  if (ratePerMillion == null || !characterCount) return null;
  return (characterCount / 1_000_000) * ratePerMillion;
}
