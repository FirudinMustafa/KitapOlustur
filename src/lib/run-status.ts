export const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  mapping_pages: "Sayfalar haritalanıyor",
  extracting: "Dizelge çıkarılıyor",
  analyzing: "Analiz ediliyor",
  awaiting_outline_approval: "Onay bekleniyor",
  awaiting_variant_selection: "Varyant seçimi bekleniyor",
  generating: "Üretiliyor",
  reviewing: "İnceleniyor",
  awaiting_content_approval: "İçerik onayı bekleniyor",
  generating_images: "Görseller üretiliyor",
  awaiting_image_review: "Görsel incelemesi bekleniyor",
  reviewing_coherence: "Kitap geneli tutarlılık kontrol ediliyor",
  awaiting_final_approval: "Nihai onay bekleniyor",
  assembling: "Birleştiriliyor",
  done: "Tamamlandı",
  changes_requested: "Değişiklik istendi",
  failed: "Hata",
};

// Faz G6: the platform (Vercel Workflow) already tracks step-level timing
// and retries internally (see ROADMAP.md Faz G6) - duplicating that isn't
// useful. What's missing is app-level visibility into how long a run has
// been sitting in a human-in-the-loop wait state, since that's what a
// project owner actually needs to notice and act on.
export const AWAITING_STATUSES = new Set([
  "awaiting_outline_approval",
  "awaiting_variant_selection",
  "awaiting_content_approval",
  "awaiting_image_review",
  "awaiting_final_approval",
]);

export function formatElapsedTurkish(from: Date, now: Date = new Date()): string {
  const ms = Math.max(0, now.getTime() - from.getTime());
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dakikadır`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saattir`;
  const days = Math.floor(hours / 24);
  return `${days} gündür`;
}

// Faz "Panel/Çizelge": a coarse top-level stage rail for the pipeline
// tracker. Several runStatusEnum values recur multiple times per run (e.g.
// "generating"/"reviewing"/"generating_images" all repeat once per unit,
// interleaved), so they're deliberately bucketed into one "generate" mega
// stage here - a rail that ping-ponged between separate "content" and
// "images" nodes across every unit would be noisier than useful. Per-unit
// content/image/audio granularity belongs in the per-unit chip grid
// (PipelineStageTracker), not this top rail.
export type PipelineStageKey = "extract" | "approval" | "generate" | "coherence" | "assemble" | "done";

export const PIPELINE_STAGES: { key: PipelineStageKey; label: string }[] = [
  { key: "extract", label: "Kaynak analizi" },
  { key: "approval", label: "Dizelge onayı" },
  { key: "generate", label: "Ünite üretimi" },
  { key: "coherence", label: "Tutarlılık kontrolü" },
  { key: "assemble", label: "Derleme" },
  { key: "done", label: "Tamamlandı" },
];

const STATUS_TO_STAGE_INDEX: Record<string, number> = {
  pending: 0,
  mapping_pages: 0,
  extracting: 0,
  analyzing: 0,
  awaiting_outline_approval: 1,
  generating: 2,
  reviewing: 2,
  awaiting_content_approval: 2,
  generating_images: 2,
  awaiting_image_review: 2,
  awaiting_variant_selection: 2,
  reviewing_coherence: 3,
  awaiting_final_approval: 3,
  assembling: 4,
  done: 5,
};

export function getPipelineStageIndex(status: string): number {
  return STATUS_TO_STAGE_INDEX[status] ?? 0;
}

export type PipelineNodeState = "done" | "active" | "pending";

// "failed" is deliberately not positioned on the rail: the run row only
// stores the current status, which gets overwritten to "failed" - there's no
// preserved record of which stage it was in when it failed - so pretending
// to pinpoint a failed node would fabricate precision the data doesn't have.
// The failure itself is already surfaced separately via run.errorMessage.
export function getPipelineNodeStates(status: string): PipelineNodeState[] {
  if (status === "failed" || status === "changes_requested") {
    return PIPELINE_STAGES.map(() => "pending" as const);
  }
  const currentIndex = getPipelineStageIndex(status);
  return PIPELINE_STAGES.map((_, i) => {
    if (i < currentIndex) return "done";
    if (i === currentIndex) return status === "done" ? "done" : "active";
    return "pending";
  });
}

export const BOOK_TYPE_LABELS: Record<string, string> = {
  student_book: "Student Book",
  workbook: "Workbook",
  teacher_book: "Teacher's Book",
  test_booklet: "Test Kitapçığı",
};
