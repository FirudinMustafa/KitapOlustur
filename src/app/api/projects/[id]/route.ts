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
  pageDesignReviews,
} from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { computeUnitProgress } from "@/lib/unit-progress";
import { summarizeUnitReviewsForPersona } from "@/lib/personas";
import type { OutlineDocument } from "@/app/projects/[id]/RunStatusView";
import { fetchCoverDimensions } from "@/lib/cover-dimensions";
import { bookTypesWithContent } from "@/lib/content-book-types";
import { summarizeDesignReviews } from "@/lib/design/design-summary";
import { loadProcessLog } from "@/lib/process-log-data";
import { deliveredBooks } from "@/lib/project-runs";
import { isCurrentGateSubmitted } from "@/lib/approval";
import type { GeneratedUnit } from "@/lib/ai/schemas";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const ownerCheck = await requireProjectOwner(id);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  // QA perf fix (2026-10-06): this endpoint is polled every few seconds by
  // the run page and took ~2.2s - ten sequential queries, with imageReviews
  // fetched twice. Independent queries now run in parallel.
  const [project, upload, run] = await Promise.all([
    db.query.projects.findFirst({ where: eq(projects.id, id) }),
    db.query.sourceUploads.findFirst({
      where: eq(sourceUploads.projectId, id),
      orderBy: [desc(sourceUploads.createdAt)],
    }),
    db.query.generationRuns.findFirst({
      where: eq(generationRuns.projectId, id),
      orderBy: [desc(generationRuns.createdAt)],
    }),
  ]);
  if (!project) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  // Faz 3: started alongside the queries below, awaited after them.
  const designRowsPromise = run
    ? db.query.pageDesignReviews.findMany({ where: eq(pageDesignReviews.runId, run.id) })
    : Promise.resolve([]);
  const [outline, runBooks, reviews, coherenceReview, originalityRows, feedback, allUnitReviews, coverDimensions] = run
    ? await Promise.all([
        db.query.extractedOutlines.findFirst({ where: eq(extractedOutlines.runId, run.id) }),
        db.query.generatedBooks.findMany({ where: eq(generatedBooks.runId, run.id) }),
        db.query.imageReviews.findMany({ where: eq(imageReviews.runId, run.id) }),
        db.query.bookCoherenceReviews.findFirst({
          where: eq(bookCoherenceReviews.runId, run.id),
          orderBy: (t, { desc }) => [desc(t.createdAt)],
        }),
        db.query.originalityChecks.findMany({ where: eq(originalityChecks.runId, run.id) }),
        db.query.teacherFeedback.findMany({
          where: eq(teacherFeedback.runId, run.id),
          orderBy: (t, { desc }) => [desc(t.createdAt)],
        }),
        db.query.unitReviews.findMany({ where: eq(unitReviews.runId, run.id) }),
        fetchCoverDimensions(run.coverImageUrl),
      ])
    : [null, [], [], null, [], [], [], null];

  const { books, fromRunId } = await deliveredBooks(id, run, runBooks);
  const gateSubmitted = run ? await isCurrentGateSubmitted(run) : false;

  // Faz D: surface how many illustrations still failed QA after their final
  // retry attempt, so the project page can flag them for manual review
  // without needing to render every generated image inline.
  const latestByKey = new Map<string, (typeof reviews)[number]>();
  for (const r of reviews) {
    const key = `${r.unitNumber ?? "cover"}:${r.pageNumber ?? "cover"}`;
    const existing = latestByKey.get(key);
    if (!existing || r.attempt > existing.attempt) latestByKey.set(key, r);
  }
  const flaggedImageCount = [...latestByKey.values()].filter((r) => !r.passed).length;

  // Faz F1/F2: flagged (unit, page) pairs, each optionally carrying an F2
  // LLM second opinion (src/db/schema.ts's OriginalityLlmAssessment). Logged
  // across every generated variant (not just the one eventually selected),
  // so this can over-count relative to the final assembled book - acceptable
  // for a soft, informational signal. See ROADMAP.md Faz F.
  const flaggedOriginalityChecks = originalityRows.filter((r) => r.flagged);
  const flaggedOriginalityCount = flaggedOriginalityChecks.length;

  // Faz "Panel/Çizelge": per-unit progress reconstructed from unitReviews +
  // imageReviews (see computeUnitProgress's doc comment for why - there's no
  // per-unit signal until generatedBooks rows exist at the very end).
  // Faz "Onay Zinciri Görünürlüğü": the same unitReviews rows also feed the
  // persona sign-off summary on the content-approval screen.
  let unitProgress: ReturnType<typeof computeUnitProgress> = [];
  let unitReviewSummary: ReturnType<typeof summarizeUnitReviewsForPersona> = [];
  if (run) {
    const outlineUnits = (outline?.outline as OutlineDocument["outline"] | undefined)?.outline?.units ?? [];
    const limitedUnits = run.unitLimit ? outlineUnits.slice(0, run.unitLimit) : outlineUnits;
    if (limitedUnits.length) {
      unitProgress = computeUnitProgress(limitedUnits, run.status, run.currentStage, allUnitReviews, reviews);
      unitReviewSummary = summarizeUnitReviewsForPersona(allUnitReviews);
    }
  }

  // Süreç Günlüğü
  const designRows = await designRowsPromise;
  const processLog = run
    ? await loadProcessLog(run, { unitReviews: allUnitReviews, imageReviews: reviews, designReviews: designRows })
    : null;

  return NextResponse.json({
    project,
    upload,
    run,
    outline,
    books,
    booksFromEarlierRun: Boolean(run && fromRunId && fromRunId !== run.id),
    gateSubmitted,
    flaggedImageCount,
    coherenceReview,
    flaggedOriginalityCount,
    flaggedOriginalityChecks,
    feedback,
    unitProgress,
    unitReviewSummary,
    coverDimensions,
    contentBookTypes: bookTypesWithContent(books[0]?.content as GeneratedUnit[] | null),
    designReview: summarizeDesignReviews(designRows),
    processLog,
  });
}

// Project deletion (QA, 2026-10-06: projects could be created but never
// removed). Every per-project row cascades from projects.id. Refused while a
// run is still working or waiting on an approval, since its workflow would
// keep writing to rows that no longer exist. Generated Blob files are left in
// place (they're addressed by run id and unreachable once the rows are gone).
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const ownerCheck = await requireProjectOwner(id);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const latestRun = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.projectId, id),
    orderBy: [desc(generationRuns.createdAt)],
  });
  if (latestRun && !["done", "failed", "changes_requested"].includes(latestRun.status)) {
    return NextResponse.json(
      { error: "Devam eden bir üretim varken proje silinemez - bitmesini bekle ya da reddet." },
      { status: 409 },
    );
  }

  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ ok: true });
}
