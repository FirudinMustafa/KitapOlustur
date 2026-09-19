export const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  mapping_pages: "Sayfalar haritalanıyor",
  extracting: "Dizelge çıkarılıyor",
  analyzing: "Analiz ediliyor",
  awaiting_outline_approval: "Onay bekleniyor",
  awaiting_variant_selection: "Varyant seçimi bekleniyor",
  generating: "Üretiliyor",
  reviewing: "İnceleniyor",
  generating_images: "Görseller üretiliyor",
  reviewing_coherence: "Kitap geneli tutarlılık kontrol ediliyor",
  assembling: "Birleştiriliyor",
  done: "Tamamlandı",
  failed: "Hata",
};

// Faz G6: the platform (Vercel Workflow) already tracks step-level timing
// and retries internally (see ROADMAP.md Faz G6) - duplicating that isn't
// useful. What's missing is app-level visibility into how long a run has
// been sitting in a human-in-the-loop wait state, since that's what a
// project owner actually needs to notice and act on.
export const AWAITING_STATUSES = new Set(["awaiting_outline_approval", "awaiting_variant_selection"]);

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

export const BOOK_TYPE_LABELS: Record<string, string> = {
  student_book: "Student Book",
  workbook: "Workbook",
  teacher_book: "Teacher's Book",
  test_booklet: "Test Kitapçığı",
};
