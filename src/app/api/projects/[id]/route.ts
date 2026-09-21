import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  projects,
  generationRuns,
  extractedOutlines,
  generatedBooks,
  sourceUploads,
  imageReviews,
  bookCoherenceReviews,
  originalityChecks,
  teacherFeedback,
  unitReviews,
} from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { computeUnitProgress } from "@/lib/unit-progress";
import { summarizeUnitReviewsForPersona } from "@/lib/personas";
import type { OutlineDocument } from "@/app/projects/[id]/RunStatusView";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const ownerCheck = await requireProjectOwner(id);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  const upload = await db.query.sourceUploads.findFirst({
    where: eq(sourceUploads.projectId, id),
    orderBy: [desc(sourceUploads.createdAt)],
  });

  const run = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.projectId, id),
    orderBy: [desc(generationRuns.createdAt)],
  });

  const outline = run
    ? await db.query.extractedOutlines.findFirst({ where: eq(extractedOutlines.runId, run.id) })
    : null;

  const books = run
    ? await db.query.generatedBooks.findMany({ where: eq(generatedBooks.runId, run.id) })
    : [];

  // Faz D: surface how many illustrations still failed QA after their final
  // retry attempt, so the project page can flag them for manual review
  // without needing to render every generated image inline.
  let flaggedImageCount = 0;
  if (run) {
    const reviews = await db.query.imageReviews.findMany({ where: eq(imageReviews.runId, run.id) });
    const latestByKey = new Map<string, (typeof reviews)[number]>();
    for (const r of reviews) {
      const key = `${r.unitNumber ?? "cover"}:${r.pageNumber ?? "cover"}`;
      const existing = latestByKey.get(key);
      if (!existing || r.attempt > existing.attempt) latestByKey.set(key, r);
    }
    flaggedImageCount = [...latestByKey.values()].filter((r) => !r.passed).length;
  }

  const coherenceReview = run
    ? await db.query.bookCoherenceReviews.findFirst({
        where: eq(bookCoherenceReviews.runId, run.id),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      })
    : null;

  // Faz F1/F2: flagged (unit, page) pairs, each optionally carrying an F2
  // LLM second opinion (src/db/schema.ts's OriginalityLlmAssessment). Logged
  // across every generated variant (not just the one eventually selected),
  // so this can over-count relative to the final assembled book - acceptable
  // for a soft, informational signal. See ROADMAP.md Faz F.
  const flaggedOriginalityChecks = run
    ? (await db.query.originalityChecks.findMany({ where: eq(originalityChecks.runId, run.id) })).filter(
        (r) => r.flagged,
      )
    : [];
  const flaggedOriginalityCount = flaggedOriginalityChecks.length;

  const feedback = run
    ? await db.query.teacherFeedback.findMany({
        where: eq(teacherFeedback.runId, run.id),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      })
    : [];

  // Faz "Panel/Çizelge": per-unit progress reconstructed from unitReviews +
  // imageReviews (see computeUnitProgress's doc comment for why - there's no
  // per-unit signal until generatedBooks rows exist at the very end).
  let unitProgress: ReturnType<typeof computeUnitProgress> = [];
  // Faz "Onay Zinciri Görünürlüğü": aynı unitReviews sorgusundan, içerik onayı
  // ekranında "Dil Denetçisi ✓ / Seviye Uzmanı ⚠" gibi persona rozetleri için
  // kullanılan bir özet türetiliyor - ikinci bir DB gidiş-dönüşü açmadan.
  let unitReviewSummary: ReturnType<typeof summarizeUnitReviewsForPersona> = [];
  if (run) {
    const outlineUnits = (outline?.outline as OutlineDocument["outline"] | undefined)?.outline?.units ?? [];
    const limitedUnits = run.unitLimit ? outlineUnits.slice(0, run.unitLimit) : outlineUnits;
    if (limitedUnits.length) {
      const [allUnitReviews, allImageReviews] = await Promise.all([
        db.query.unitReviews.findMany({ where: eq(unitReviews.runId, run.id) }),
        db.query.imageReviews.findMany({ where: eq(imageReviews.runId, run.id) }),
      ]);
      unitProgress = computeUnitProgress(limitedUnits, run.status, run.currentStage, allUnitReviews, allImageReviews);
      unitReviewSummary = summarizeUnitReviewsForPersona(allUnitReviews);
    }
  }

  return NextResponse.json({
    project,
    upload,
    run,
    outline,
    books,
    flaggedImageCount,
    coherenceReview,
    flaggedOriginalityCount,
    flaggedOriginalityChecks,
    feedback,
    unitProgress,
    unitReviewSummary,
  });
}
