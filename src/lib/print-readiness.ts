import { isValidIsbn13 } from "@/lib/isbn";

// ISBN/baskıya hazırlık (2026-09-20, ROADMAP.md): a real, quantified
// print-readiness check rather than restating the vague "images may not be
// print-suitable" gap - this actually measures the generated cover's real
// pixel dimensions against a genuine print requirement and says pass/fail.
// Deliberately does NOT attempt to fix image generation itself (re-prompting
// for a portrait aspect ratio/specific pixel size) - that's a real,
// separate, higher-risk change to the whole image pipeline (affects every
// generated page image, not just the cover), which this pass intentionally
// left alone. See this feature's ROADMAP.md note for the full rationale.

// A common trade-paperback trim size (6in x 9in) at the print-industry
// standard of 300 DPI - used only as an honest, clearly-labeled reference
// point, not a hard requirement (real trim size varies by book/printer).
export const RECOMMENDED_COVER_WIDTH_PX = 1800;
export const RECOMMENDED_COVER_HEIGHT_PX = 2700;

export type PrintReadinessReport = {
  isbn: { provided: boolean; valid: boolean };
  cover:
    | {
        widthPx: number;
        heightPx: number;
        isPortrait: boolean;
        meetsRecommendedResolution: boolean;
      }
    | null;
  issues: string[];
};

export function checkPrintReadiness(input: {
  isbn?: string | null;
  coverWidthPx?: number | null;
  coverHeightPx?: number | null;
}): PrintReadinessReport {
  const issues: string[] = [];

  const isbnProvided = !!input.isbn;
  const isbnValid = isbnProvided ? isValidIsbn13(input.isbn!) : false;
  if (isbnProvided && !isbnValid) {
    issues.push("Girilen ISBN geçerli bir ISBN-13 sağlama toplamına (checksum) sahip değil.");
  }
  if (!isbnProvided) {
    issues.push("ISBN girilmemiş - barkod üretilmeyecek, bu bir basılı kitap için genellikle zorunludur.");
  }

  let cover: PrintReadinessReport["cover"] = null;
  if (input.coverWidthPx && input.coverHeightPx) {
    const isPortrait = input.coverHeightPx > input.coverWidthPx;
    const meetsRecommendedResolution =
      input.coverWidthPx >= RECOMMENDED_COVER_WIDTH_PX && input.coverHeightPx >= RECOMMENDED_COVER_HEIGHT_PX;
    cover = {
      widthPx: input.coverWidthPx,
      heightPx: input.coverHeightPx,
      isPortrait,
      meetsRecommendedResolution,
    };
    if (!isPortrait) {
      issues.push(
        `Kapak görseli yatay (${input.coverWidthPx}×${input.coverHeightPx}px) - gerçek kitap kapakları dikey olur, bu pipeline tüm görselleri 16:9 (yatay) oranında üretiyor.`,
      );
    }
    if (!meetsRecommendedResolution) {
      issues.push(
        `Kapak çözünürlüğü (${input.coverWidthPx}×${input.coverHeightPx}px), yaygın bir baskı boyutu (6"×9", 300 DPI) için önerilen ${RECOMMENDED_COVER_WIDTH_PX}×${RECOMMENDED_COVER_HEIGHT_PX}px'in altında.`,
      );
    }
  } else {
    issues.push("Kapak görseli henüz yok veya boyutu okunamadı.");
  }

  return { isbn: { provided: isbnProvided, valid: isbnValid }, cover, issues };
}
