// Faz "Onay Zinciri Görünürlüğü": tek bir insan aktör (proje sahibi) hâlâ
// her onay kapısında karar veriyor - burada eklenen hiçbir gerçek rol/RBAC
// değil, sadece zaten arka planda çalışan otomatik AI denetimlerini
// (unitReviews'daki reviewType'lar) isimlendirilmiş bir editöryel "persona"
// anlatısı olarak görünür kılan salt-etiketleme katmanı. Bkz. ROADMAP.md.
export type PersonaKey =
  | "kaynak_analisti"
  | "bas_editor"
  | "dil_denetcisi"
  | "seviye_uzmani"
  | "icerik_guvenligi"
  | "icerik_uretici"
  | "gorsel_tasarimci"
  | "sanat_yonetmeni"
  | "yayin_muduru"
  | "produksiyon"
  | "beceri_dengesi_uzmani";

export const PERSONA_LABELS: Record<PersonaKey, string> = {
  kaynak_analisti: "Kaynak Analisti",
  bas_editor: "Baş Editör",
  dil_denetcisi: "Dil Denetçisi",
  seviye_uzmani: "Seviye Uzmanı",
  icerik_guvenligi: "İçerik Güvenliği Denetçisi",
  icerik_uretici: "İçerik Üretici",
  gorsel_tasarimci: "Görsel Tasarımcı",
  sanat_yonetmeni: "Sanat Yönetmeni",
  yayin_muduru: "Yayın Müdürü",
  produksiyon: "Prodüksiyon",
  beceri_dengesi_uzmani: "Beceri Dengesi Uzmanı",
};

// src/db/schema.ts'teki reviewTypeEnum ile birebir eşleşiyor.
export type ReviewType = "structure" | "language" | "level" | "moderation" | "skill_balance";

export const REVIEW_TYPE_PERSONA: Record<ReviewType, PersonaKey> = {
  structure: "bas_editor",
  language: "dil_denetcisi",
  level: "seviye_uzmani",
  moderation: "icerik_guvenligi",
  skill_balance: "beceri_dengesi_uzmani",
};

export type UnitReviewRow = {
  unitNumber: number;
  reviewType: ReviewType;
  passed: boolean;
  issues: string[];
  createdAt: Date;
};

export type PersonaReviewSummary = {
  unitNumber: number;
  reviewType: ReviewType;
  persona: PersonaKey;
  passed: boolean;
  issueCount: number;
};

// unitReviews'da round kolonu yok - bir ünite/reviewType çifti için birden
// fazla satır birikebilir (ilk otomatik deneme + feedback-sonrası yeniden
// üretimler). Persona anlatısı için her zaman en son (createdAt en büyük)
// satır alınır - imageReviews için zaten kullanılan "en son deneme" desenine
// paralel (bkz. src/lib/unit-progress.ts, src/app/api/projects/[id]/route.ts).
export function summarizeUnitReviewsForPersona(reviews: UnitReviewRow[]): PersonaReviewSummary[] {
  const latestByKey = new Map<string, UnitReviewRow>();
  for (const r of reviews) {
    const key = `${r.unitNumber}:${r.reviewType}`;
    const existing = latestByKey.get(key);
    if (!existing || r.createdAt > existing.createdAt) latestByKey.set(key, r);
  }
  return [...latestByKey.values()].map((r) => ({
    unitNumber: r.unitNumber,
    reviewType: r.reviewType,
    persona: REVIEW_TYPE_PERSONA[r.reviewType],
    passed: r.passed,
    issueCount: r.issues.length,
  }));
}
