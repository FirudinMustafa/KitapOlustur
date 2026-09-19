export type UnitChipStatus = "pending" | "active" | "done" | "attention";

export type UnitProgress = {
  unitNumber: number;
  title: string;
  content: UnitChipStatus;
  image: UnitChipStatus;
  audio: UnitChipStatus;
  review: UnitChipStatus;
};

type ReviewRow = { unitNumber: number; passed: boolean };
type ImageReviewRow = { unitNumber: number | null; pageNumber: number | null; attempt: number; passed: boolean };

// Faz "Panel/Çizelge": reconstructs per-unit pipeline progress from the
// signals actually persisted during an in-progress run. generatedBooks rows
// (the "real" content) only exist after assembleAndSaveBooks runs at the very
// end, so during generation the only per-unit signals available are
// unitReviews (inserted right after a unit's content+audio finish - see
// buildUnit's ordering in workflows/book-pipeline.tsx: generateMirroredSide/
// generateComplementarySide/generateListeningAudio all resolve before
// reviewUnit/reviewLanguageAccuracy run) and imageReviews (inserted after
// review, once generateUnitImages runs).
//
// There is no independent per-unit audio signal - audio generation is
// bundled into the same buildUnit() call as content, so it's reported as
// "done" whenever content is. This is a known, accepted approximation: it
// can't distinguish a silent per-line audio failure (generateListeningAudio
// already soft-warns and degrades gracefully - see ROADMAP.md Faz G4) from
// full success. Flagged here rather than silently assumed.
export function computeUnitProgress(
  units: { number: number; title: string }[],
  runStatus: string,
  currentStage: string | null,
  unitReviews: ReviewRow[],
  imageReviews: ImageReviewRow[],
): UnitProgress[] {
  const allDone = runStatus === "done" || runStatus === "assembling" || runStatus === "reviewing_coherence";
  const activeMatch = currentStage?.match(/Ünite (\d+)\//);
  const activeUnitNumber = activeMatch ? Number(activeMatch[1]) : null;

  // Dedup imageReviews to the latest attempt per (unit, page) - mirrors the
  // flaggedImageCount logic in src/app/api/projects/[id]/route.ts.
  const latestImageByKey = new Map<string, ImageReviewRow>();
  for (const r of imageReviews) {
    const key = `${r.unitNumber ?? "cover"}:${r.pageNumber ?? "cover"}`;
    const existing = latestImageByKey.get(key);
    if (!existing || r.attempt > existing.attempt) latestImageByKey.set(key, r);
  }
  const latestImages = [...latestImageByKey.values()];

  return units.map((u) => {
    const reviews = unitReviews.filter((r) => r.unitNumber === u.number);
    const images = latestImages.filter((r) => r.unitNumber === u.number);

    const contentDone = allDone || reviews.length > 0;
    const isActiveUnit = !allDone && activeUnitNumber === u.number;

    const content: UnitChipStatus = contentDone ? "done" : isActiveUnit ? "active" : "pending";
    const audio: UnitChipStatus = content;

    const image: UnitChipStatus = allDone
      ? "done"
      : images.length > 0
        ? images.some((r) => !r.passed)
          ? "attention"
          : "done"
        : contentDone && isActiveUnit
          ? "active"
          : "pending";

    const review: UnitChipStatus = allDone
      ? "done"
      : reviews.length > 0
        ? reviews.some((r) => !r.passed)
          ? "attention"
          : "done"
        : "pending";

    return { unitNumber: u.number, title: u.title, content, image, audio, review };
  });
}
