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
export const BOOK_PIPELINE_MODEL_DRAFT = "google/gemini-2.5-flash-lite";

export function resolveTextModel(qualityMode: "draft" | "final"): string {
  return qualityMode === "draft" ? BOOK_PIPELINE_MODEL_DRAFT : BOOK_PIPELINE_MODEL;
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
export const BOOK_PIPELINE_IMAGE_MODEL_FINAL = "openai/gpt-image-2";
export const BOOK_PIPELINE_IMAGE_MODEL_DRAFT = "openai/gpt-image-1-mini";

export function resolveImageModel(qualityMode: "draft" | "final"): string {
  return qualityMode === "draft" ? BOOK_PIPELINE_IMAGE_MODEL_DRAFT : BOOK_PIPELINE_IMAGE_MODEL_FINAL;
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
