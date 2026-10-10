export const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  mapping_pages: "Sayfalar haritalanıyor",
  extracting: "Dizelge çıkarılıyor",
  analyzing: "Analiz ediliyor",
  awaiting_outline_approval: "Onay bekleniyor",
  awaiting_logo_upload: "Logo onayı bekleniyor",
  awaiting_character_approval: "Karakter onayı bekleniyor",
  awaiting_variant_selection: "Varyant seçimi bekleniyor",
  generating: "Üretiliyor",
  reviewing: "İnceleniyor",
  awaiting_content_approval: "İçerik onayı bekleniyor",
  generating_images: "Görseller üretiliyor",
  awaiting_image_review: "Görsel incelemesi bekleniyor",
  reviewing_coherence: "Kitap geneli tutarlılık kontrol ediliyor",
  reviewing_design: "Sayfa tasarımları denetleniyor",
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
  "awaiting_logo_upload",
  "awaiting_character_approval",
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

// Faz "Onay Zinciri Görünürlüğü": bu etiketler, aşamada zaten çalışan otomatik
// AI denetimlerini (dil/seviye/güvenlik/görsel/tutarlılık) isimlendirilmiş bir
// editöryel "persona" anlatısı olarak görünür kılıyor - gerçek bir çoklu-
// kullanıcı/rol sistemi kurmadan (bkz. src/lib/personas.ts). Salt görsel bir
// alt-etiket; getPipelineNodeStates/getPipelineStageIndex mantığını etkilemez.
export const PIPELINE_STAGES: { key: PipelineStageKey; label: string; persona?: string }[] = [
  { key: "extract", label: "Kaynak analizi", persona: "Kaynak Analisti" },
  { key: "approval", label: "Dizelge onayı", persona: "Baş Editör → Proje Sahibi" },
  {
    key: "generate",
    label: "Ünite üretimi",
    persona: "İçerik Üretici → Dil Denetçisi/Seviye Uzmanı/Güvenlik/Beceri Dengesi",
  },
  { key: "coherence", label: "Tutarlılık kontrolü", persona: "Baş Editör" },
  { key: "assemble", label: "Derleme", persona: "Prodüksiyon" },
  { key: "done", label: "Tamamlandı" },
];

const STATUS_TO_STAGE_INDEX: Record<string, number> = {
  pending: 0,
  mapping_pages: 0,
  extracting: 0,
  analyzing: 0,
  awaiting_outline_approval: 1,
  awaiting_logo_upload: 1,
  awaiting_character_approval: 1,
  generating: 2,
  reviewing: 2,
  awaiting_content_approval: 2,
  generating_images: 2,
  awaiting_image_review: 2,
  awaiting_variant_selection: 2,
  reviewing_coherence: 3,
  reviewing_design: 3,
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
