export const BOOK_PIPELINE_MODEL = "anthropic/claude-sonnet-5";
export const BOOK_PIPELINE_IMAGE_MODEL = "google/imagen-4.0-generate-001";
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
