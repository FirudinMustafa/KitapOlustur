export const BOOK_PIPELINE_MODEL = "anthropic/claude-sonnet-5";
export const BOOK_PIPELINE_SPEECH_MODEL = "openai/tts-1-hd";

// Faz H6: cheaper text model for "draft" quality mode - a fast, low-cost
// pass to preview a book's unit content before committing to a full "final"
// run. Deliberately scoped to only the per-unit writing steps (mirrored/
// complementary side, teacher's book, test booklet) - those run once per
// unit x variant, so they're both the dominant cost driver (see the Faz G5
// cost dashboard's step breakdown) and the biggest saving lever. Source
// extraction (page map, outline) and cross-unit scaffolding (improvement
// plan, style bible) run once per book and stay on BOOK_PIPELINE_MODEL in
// every mode, since a weaker model there would corrupt the outline/page-map
// fidelity that everything downstream (including Faz F1's originality
// check) depends on. Review/QA steps (reviewUnit, reviewLanguageAccuracy,
// reviewImage, reviewBookCoherence) also always stay on BOOK_PIPELINE_MODEL,
// so QA fidelity doesn't degrade along with draft content. See ROADMAP.md
// Faz H6.
export const BOOK_PIPELINE_MODEL_DRAFT = "anthropic/claude-haiku-4-5";

export function resolveTextModel(qualityMode: "draft" | "final"): string {
  return qualityMode === "draft" ? BOOK_PIPELINE_MODEL_DRAFT : BOOK_PIPELINE_MODEL;
}

// Faz H6 extension (2026-09-19): the same draft/final quality tiering now
// also picks the image model, not just text. "final" (the default) uses
// Nano Banana Pro (Gemini 3 Pro Image) - Google's current top-tier image
// model, available directly through the existing Vercel AI Gateway wiring
// (no new provider/account needed, just a different gateway model string;
// verified live against Vercel's own AI Gateway model pages, not recalled
// from training data - see ROADMAP.md). "draft" keeps the model this
// pipeline already used for every run before this tiering existed
// (Imagen 4), so draft-mode cost/behavior is unchanged.
export const BOOK_PIPELINE_IMAGE_MODEL_FINAL = "google/gemini-3-pro-image";
export const BOOK_PIPELINE_IMAGE_MODEL_DRAFT = "google/imagen-4.0-generate-001";

export function resolveImageModel(qualityMode: "draft" | "final"): string {
  return qualityMode === "draft" ? BOOK_PIPELINE_IMAGE_MODEL_DRAFT : BOOK_PIPELINE_IMAGE_MODEL_FINAL;
}

// Faz H6 extension (2026-09-19): ElevenLabs was investigated for "final"-tier
// listening audio (genuinely higher production value for a language-learning
// product, where the audio is the pronunciation model students hear) but is
// NOT wired in yet. Vercel AI Gateway's text-to-speech endpoint supports
// OpenAI speech models only, so ElevenLabs needs the separate official
// `@ai-sdk/elevenlabs` provider package - and that package (all 3.0.x
// releases) requires `@ai-sdk/provider` v4 (the spec used by the `ai` v7
// line), while this project is on `ai` v6.0.230 (`@ai-sdk/provider` v3).
// Confirmed via `tsc`: SpeechModelV4 (from @ai-sdk/elevenlabs) is not
// assignable to the v6 `generateSpeech`'s `SpeechModel` type - a real
// protocol mismatch, not just a type nit. Enabling ElevenLabs for real
// requires upgrading `ai` (and `@ai-sdk/gateway`) to the v7 line first,
// which touches every generateObject/generateImage/generateSpeech call site
// in workflows/book-pipeline.tsx - a separate, bigger migration than this
// model-tiering feature. Both quality tiers use BOOK_PIPELINE_SPEECH_MODEL
// (OpenAI tts-1-hd) until that upgrade happens. See ROADMAP.md Faz H6.
export function resolveSpeechModel(qualityMode: "draft" | "final"): string {
  void qualityMode; // no tiering yet - see comment above
  return BOOK_PIPELINE_SPEECH_MODEL;
}
