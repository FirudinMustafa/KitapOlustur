import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

// 2026-10-21: Sonnet 5.5 - same Gateway price as Sonnet 5 ($2/$10 per M,
// checked against https://ai-gateway.vercel.sh/v1/models), newer model.
export const BOOK_PIPELINE_MODEL = "anthropic/claude-sonnet-5.5";
export const BOOK_PIPELINE_SPEECH_MODEL = "openai/tts-1-hd";

// "Free mode" (2026-09-27): AI Gateway now requires a positive credit
// balance for every request, even BYOK ("A positive credit balance is
// required for all requests, including BYOK, so fallback providers remain
// available" - the FatalError that blocked buildStyleBible with a $0
// balance), so nothing on this file's Gateway path runs until credit is
// added. This mode is a bypass, not a replacement: it lets the pipeline be
// smoke-tested against genuinely free, no-credit-card provider tiers before
// paying for Gateway credit. Every existing Gateway export above/below is
// untouched - AI_PROVIDER_MODE defaults to "gateway" so current paid
// behavior is unchanged unless explicitly opted into.
//
// Text uses Google AI Studio (Gemini) directly via @ai-sdk/google, confirmed
// via live web research (2026-09-27) to have a genuinely free, no-card,
// no-GCP-billing tier (Flash/Flash-Lite, 1500 req/day) - and Gemini already
// has proven structured-output compatibility with this pipeline's
// z.discriminatedUnion schemas (see BOOK_PIPELINE_MODEL_DRAFT's comment
// below), so it's a low-risk swap for every generateObject call site.
// Image (Nano Banana, gemini-2.5-flash-image) and speech (ElevenLabs) free
// tiers also exist but need different call shapes than this pipeline's
// generateImage()/generateSpeech() - see resolveImageModel/
// resolveSpeechModel below and their callers in book-pipeline.tsx for how
// those are branched.
export type AiProviderMode = "gateway" | "free";

export function getAiProviderMode(): AiProviderMode {
  return process.env.AI_PROVIDER_MODE === "free" ? "free" : "gateway";
}

// Model IDs confirmed via a live spike (2026-09-27, real generateObject
// calls against Google AI Studio's free tier with a real API key) - NOT
// guessed from training data, which is stale here: gemini-2.5-flash and
// gemini-2.5-flash-lite both come back "no longer available to new users"
// from the live API despite still being listed by ListModels. gemini-3.8-
// flash/gemini-3.6-flash/gemini-3.7-flash/gemini-flash-latest all hit
// transient "high demand" 503s repeatedly on this key's free tier and
// aren't reliable.
//
// gemini-3.5-flash returned a real, schema-valid result in the isolated
// spike, but failed with the same "high demand" 503 - repeatedly, through
// every one of the workflow platform's own automatic step retries, not
// just the AI SDK's inner 3 - in a real end-to-end pipeline run
// (generateOutlineFromBrief, wrun_01M3HW3VS8MJTFK5BB28J515M0, stuck for
// several minutes). gemini-3.1-flash-lite was the only model that stayed
// reliable across both the isolated spike and the real pipeline run, so
// free mode uses it for both tiers - no cost pressure to prefer a stronger
// model in free mode anyway, and reliability matters more here than raw
// quality for a smoke test.
const FREE_TEXT_MODEL_ID = "gemini-3.1-flash-lite";
const FREE_TEXT_MODEL_ID_DRAFT = "gemini-3.1-flash-lite";
// Free-mode images do NOT go through Gemini (see isFreeImageModelActive's
// comment below for why that path is abandoned) - they go through
// Cloudflare Workers AI, see src/lib/ai/cloudflare-image.ts.

// resolveTextModel/resolveFinalTextModel (below) must keep returning a
// plain string, even in free mode: their result (as `textModel`) gets
// persisted to generationRuns.modelVersion and threaded across "use step"
// boundaries as a typed `string` field (see book-pipeline.tsx), which a
// durable Workflow step serializes between steps - a LanguageModel class
// instance isn't serializable there. The actual provider SDK wrapping
// happens only at the point of the generateObject/generateText call, via
// this helper, never stored or threaded through step params.
export function toTextModel(modelId: string): string | LanguageModel {
  return getAiProviderMode() === "free" ? google(modelId) : modelId;
}

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
//
// "Gateway kredisini idareli kullanma" (2026-09-23): tried openai/gpt-5-nano
// first (Haiku'dan ~20x ucuz, gateway kataloğundan doğrulanmıştı) ama gerçek
// bir canlı çalıştırmada generateSkeletonSide/generateMirroredSide'ın
// şeması (contentBlockSchema.interactive, bir z.discriminatedUnion) OpenAI
// modellerinin strict JSON-schema modunda kesin olarak reddedilen bir
// `oneOf` üretiyor - gerçek hata: "Invalid schema for response_format
// 'response': ... 'oneOf' is not permitted." Bu, şemayı değiştirmeden
// hiçbir OpenAI modeliyle (sadece gpt-5-nano değil) çözülemeyecek yapısal
// bir uyumsuzluk - bu yüzden OpenAI ailesi yerine google/gemini-2.5-flash-lite
// seçildi ($0.10/$0.40 per M token, Haiku'dan hâlâ ~10x ucuz, gateway
// kataloğundan doğrulandı) - Gemini'nin structured output'u Anthropic gibi
// discriminated union'ları kabul ediyor (aynı şema Haiku ile zaten
// çalışıyordu). Doğrulanmadan önce Anthropic'e (Haiku) geri dönmek en
// güvenli yedek - bu yüzden bu değişiklik gerçek bir canlı testle
// doğrulanana kadar Haiku'ya dönmek gerekirse buraya not düşülecek.
// 2026-10-21: gemini-3.5-flash-lite ($0.30/$2.50 per M in the live Gateway
// catalog) replaces 2.5 Flash-Lite, which Google no longer offers to new
// users (see FREE_TEXT_MODEL_ID's comment above).
export const BOOK_PIPELINE_MODEL_DRAFT = "google/gemini-3.5-flash-lite";

export function resolveTextModel(qualityMode: "draft" | "final"): string {
  if (getAiProviderMode() === "free") {
    return qualityMode === "draft" ? FREE_TEXT_MODEL_ID_DRAFT : FREE_TEXT_MODEL_ID;
  }
  return qualityMode === "draft" ? BOOK_PIPELINE_MODEL_DRAFT : BOOK_PIPELINE_MODEL;
}

// Free-mode override for the always-final-tier call sites (source
// extraction, style bible, outline, review/QA) that intentionally bypass
// resolveTextModel's draft/final split - see BOOK_PIPELINE_MODEL_DRAFT's
// comment above for why those stay on BOOK_PIPELINE_MODEL in gateway mode.
// Free mode still needs to redirect these away from Gateway, just without
// the draft/final choice (there's no cost pressure to differentiate in free
// mode).
export function resolveFinalTextModel(): string {
  return getAiProviderMode() === "free" ? FREE_TEXT_MODEL_ID : BOOK_PIPELINE_MODEL;
}

// 2026-10-23 (KIYAS-13: $6.80 of $8.80 was text, most of it Sonnet checking
// pictures): checks - language, level, safety, skill balance, picture QA,
// page-design grading, originality, coherence - run on a vision-capable
// model about seven times cheaper. The writer and the structure review that
// drives rewrites stay on BOOK_PIPELINE_MODEL. REVIEW_MODEL overrides.
export const BOOK_PIPELINE_REVIEW_MODEL = "google/gemini-3.5-flash-lite";

export function resolveReviewModel(): string {
  if (getAiProviderMode() === "free") return FREE_TEXT_MODEL_ID;
  return process.env.REVIEW_MODEL || BOOK_PIPELINE_REVIEW_MODEL;
}

// Faz H6 extension (2026-09-19), CORRECTED same day: the original pick here
// (`google/gemini-3-pro-image` for final, `google/imagen-4.0-generate-001`
// for draft) was wrong - verified live against the Vercel AI Gateway's own
// `gateway.getAvailableModels()` catalog, neither string is usable with
// `generateImage()`: the Gemini ones are catalogued as `language` models
// (Nano Banana is a chat model that emits image parts, not a dedicated
// image-generation model - it needs a different integration path, not
// attempted here), and the Imagen slug isn't in the catalog at all. Both
// failed with real errors from a live call, not a guess. Replaced with
// models the same catalog actually lists under `modelType: "image"`:
// OpenAI's GPT Image 2 (current top-tier per Artificial Analysis Arena,
// confirmed available - see ROADMAP.md "Hikaye Stüdyosu") for final, and
// the smaller/cheaper GPT Image 1 Mini for draft.
// 2026-10-21: GPT Image 2.5 Flare supersedes GPT Image 2 at the same token
// rates (see STUDIO_IMAGE_MODELS below). scripts/gateway-spike.mts checks it
// answers through generateImage() before a paid run relies on it.
export const BOOK_PIPELINE_IMAGE_MODEL_FINAL = "openai/gpt-image-2.5-flare";
export const BOOK_PIPELINE_IMAGE_MODEL_DRAFT = "openai/gpt-image-1-mini";

export function resolveImageModel(qualityMode: "draft" | "final"): string {
  return qualityMode === "draft" ? BOOK_PIPELINE_IMAGE_MODEL_DRAFT : BOOK_PIPELINE_IMAGE_MODEL_FINAL;
}

// Free mode's image path was originally attempted through Gemini's Nano
// Banana (gemini-2.5-flash-image via generateText()+result.files, since
// it's a chat model, not a generateImage()-compatible one) - abandoned
// after a live spike (2026-09-27) hit a real, repeatable 429 on every
// Gemini image model tried: "free_tier_requests limit: 0" for the Google
// Cloud project behind the API key. Confirmed via live web research
// (2026-09-27) to be a known, documented Google-side issue (affects a
// meaningful fraction of accounts, even some with billing configured) -
// not a wrong model ID or a code bug.
//
// Free mode now uses Cloudflare Workers AI instead (flux-1-schnell, see
// cloudflare-image.ts) - a genuinely free tier (100k requests/day, no
// credit card) that isn't subject to Google's quota bug. Like text, image
// still needs a caller-side branch (not a plain model-string swap) because
// Cloudflare's REST shape differs entirely from generateImage()'s.
export function isFreeImageModelActive(): boolean {
  return getAiProviderMode() === "free";
}

// Faz "Kapak/Görsel Oranı Düzeltmesi" (2026-09-21, ROADMAP.md): every image
// call in the book pipeline (generateReviewedImage, workflows/book-pipeline.tsx)
// used to pass `aspectRatio: "16:9"` to generateImage() - but GPT Image (the
// only model family this pipeline uses, see BOOK_PIPELINE_IMAGE_MODEL_* above)
// doesn't support a free aspectRatio string, only these three fixed `size`
// values (confirmed via STUDIO_IMAGE_SIZES below, which already uses `size`
// correctly for Hikaye Stüdyosu's advanced panel). Covers need a portrait
// size to look like a real book cover; interior page illustrations keep the
// existing landscape look since their PDF box (BookDocument.tsx's
// pageIllustrationWrap) already crops-to-fill and doesn't need to change.
export const BOOK_PIPELINE_COVER_IMAGE_SIZE: StudioImageSizeId = "1024x1536";
export const BOOK_PIPELINE_INTERIOR_IMAGE_SIZE: StudioImageSizeId = "1536x1024";

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
// model-tiering feature. See ROADMAP.md Faz H6.
//
// "Gateway kredisini idareli kullanma" (2026-09-23): now actually tiered -
// draft uses openai/tts-1 ($15/M chars, confirmed in the live Gateway
// catalog), half the price of tts-1-hd, same OpenAI API shape (no
// integration risk). final keeps tts-1-hd for the higher-fidelity
// pronunciation model a real listening exercise needs.
export const BOOK_PIPELINE_SPEECH_MODEL_DRAFT = "openai/tts-1";

export function resolveSpeechModel(qualityMode: "draft" | "final"): string {
  return qualityMode === "draft" ? BOOK_PIPELINE_SPEECH_MODEL_DRAFT : BOOK_PIPELINE_SPEECH_MODEL;
}

// Free mode's speech path is ElevenLabs, called directly via
// src/lib/ai/elevenlabs.ts's REST client rather than generateSpeech() - the
// official @ai-sdk/elevenlabs package's version conflict (see the comment
// above) rules out the ai-SDK SpeechModel path entirely, so there's no
// model-string swap here, only a signal for the caller
// (synthesizeSpeechWithRetry in book-pipeline.tsx) to branch to that REST
// client instead.
//
// STATUS (verified via live spike, 2026-09-27): ElevenLabs' API rejects
// premade/library voices on a free account with a real 402 -
// "Free users cannot use library voices via the API. Please upgrade your
// subscription to use this voice." - so this path does not currently work
// on ElevenLabs' free tier at all, regardless of voice ID chosen. This is
// a genuine ElevenLabs account-tier restriction, not a code bug. Free
// mode's speech generation will keep failing (falling back to no-audio,
// same as any other synthesis failure - see MAX_AUDIO_ATTEMPTS) until
// either the ElevenLabs account is upgraded or another free TTS provider
// is wired in here instead.
export function isFreeSpeechModelActive(): boolean {
  return getAiProviderMode() === "free";
}

// Hikaye Stüdyosu video: Google Veo, confirmed available directly through
// the same Vercel AI Gateway this app already uses (modelType "video" in
// gateway.getAvailableModels()) - no separate account/API key needed,
// unlike Higgsfield (src/lib/ai/higgsfield.ts). "final" uses full Veo 3.1;
// "draft" uses the "fast" variant (cheaper/quicker, lower fidelity).
export const VEO_VIDEO_MODEL_FINAL = "google/veo-3.1-generate-001";
export const VEO_VIDEO_MODEL_DRAFT = "google/veo-3.1-fast-generate-001";

export function resolveVeoModel(qualityMode: "draft" | "final"): string {
  return qualityMode === "draft" ? VEO_VIDEO_MODEL_DRAFT : VEO_VIDEO_MODEL_FINAL;
}

// Faz "Gelişmiş Görsel Üretim Paneli" (2026-09-21, ROADMAP.md): user-selectable
// image models for Hikaye Stüdyosu's advanced generation panel - separate
// from the book pipeline's fixed, quality-mode-driven resolveImageModel
// above (that pipeline stays untouched). "GPT Image 2" (the name the user
// originally asked for) is superseded by GPT Image 2.5 as of September
// 2026 (verified live against Vercel's own model pages, not assumed) - two
// variants, both callable via the same generateImage() path as the older
// GPT Image models (no new integration risk):
//   - Flare: faster, standard quality.
//   - Sunburst: slower, more detailed/precise editing.
// Nano Banana Pro/2 (google/gemini-3-pro-image, gemini-3.1-flash-image-preview)
// are deliberately NOT included here yet - per Vercel's own docs, those are
// chat-style models used via generateText()+result.files, not
// generateImage(), and whether ai@6.0.230 (pinned in package.json) supports
// that return shape is unverified - the exact same kind of v6/v7 boundary
// that blocked ElevenLabs (see resolveSpeechModel's comment above). The
// Gateway account is still billing-blocked, so this can't be verified with
// a real call yet - add them here the same way once it can be.
export const STUDIO_IMAGE_MODELS = [
  { id: "openai/gpt-image-2.5-flare", label: "GPT Image 2.5 Flare", description: "Hızlı, standart kalite" },
  { id: "openai/gpt-image-2.5-sunburst", label: "GPT Image 2.5 Sunburst", description: "Daha yavaş, daha detaylı/hassas düzenleme" },
] as const;

export type StudioImageModelId = (typeof STUDIO_IMAGE_MODELS)[number]["id"];

// Faz "Gelişmiş Görsel Üretim Paneli": the "Çözünürlük" selector merges what
// the user originally asked for as two separate controls ("oran" and
// "çözünürlük") into one - generateImage()'s `size` param already encodes
// both width/height (and therefore aspect ratio), and GPT Image only
// supports a handful of fixed sizes, so two independent selectors could
// produce invalid combinations. Three official GPT Image sizes.
export const STUDIO_IMAGE_SIZES = [
  { id: "1024x1024", label: "Kare (1024×1024)" },
  { id: "1024x1536", label: "Dikey (1024×1536)" },
  { id: "1536x1024", label: "Yatay (1536×1024)" },
] as const;

export type StudioImageSizeId = (typeof STUDIO_IMAGE_SIZES)[number]["id"];
