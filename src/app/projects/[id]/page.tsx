import { notFound } from "next/navigation";
import { isUuid } from "@/lib/uuid";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  projects,
  sourceUploads,
  generationRuns,
  extractedOutlines,
  generatedBooks,
  imageReviews,
  bookCoherenceReviews,
  originalityChecks,
  teacherFeedback,
  unitReviews,
  pageDesignReviews,
} from "@/db/schema";
import {
  RunStatusView,
  type OutlineDocument,
  type GeneratedUnitContent,
  type PendingVariants,
  type PendingContentApproval,
  type PendingImageReview,
} from "./RunStatusView";
import { computeUnitProgress } from "@/lib/unit-progress";
import { fetchCoverDimensions } from "@/lib/cover-dimensions";
import { bookTypesWithContent } from "@/lib/content-book-types";
import { summarizeDesignReviews } from "@/lib/design/design-summary";
import { loadProcessLog } from "@/lib/process-log-data";
import type { GeneratedUnit } from "@/lib/ai/schemas";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Faz G3: 404 (not a 403) for "exists but isn't yours" - same reasoning as
  // requireProjectOwner in src/lib/auth.ts, kept in sync manually since this
  // is a server component rather than an API route.
  const { userId } = await auth();
  if (!isUuid(id)) notFound();
  // Independent queries run in parallel (same as /api/projects/[id]) -
  // sequentially they took ~2s per page load.
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
  if (!project || !userId || project.ownerId !== userId) notFound();

  // Faz 3: started alongside the queries below, awaited after them.
  const designRowsPromise = run
    ? db.query.pageDesignReviews.findMany({ where: eq(pageDesignReviews.runId, run.id) })
    : Promise.resolve([]);
  const [outline, books, reviews, coherenceReview, originalityRows, feedback, allUnitReviews, coverDimensions] = run
    ? await Promise.all([
        db.query.extractedOutlines.findFirst({ where: eq(extractedOutlines.runId, run.id) }).then((o) => o ?? null),
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

  // Faz D: same "latest attempt per image, count still-failing" logic as the
  // /api/projects/[id] route, kept in sync manually (see ROADMAP.md Faz D).
  const latestByKey = new Map<string, (typeof reviews)[number]>();
  for (const r of reviews) {
    const key = `${r.unitNumber ?? "cover"}:${r.pageNumber ?? "cover"}`;
    const existing = latestByKey.get(key);
    if (!existing || r.attempt > existing.attempt) latestByKey.set(key, r);
  }
  const flaggedImageCount = [...latestByKey.values()].filter((r) => !r.passed).length;

  const flaggedOriginalityChecks = originalityRows.filter((r) => r.flagged);
  const flaggedOriginalityCount = flaggedOriginalityChecks.length;

  // Faz "Panel/Çizelge": same reconstruction as /api/projects/[id], kept in
  // sync manually.
  let unitProgress: ReturnType<typeof computeUnitProgress> = [];
  if (run) {
    const outlineUnits = (outline?.outline as OutlineDocument["outline"] | undefined)?.outline?.units ?? [];
    const limitedUnits = run.unitLimit ? outlineUnits.slice(0, run.unitLimit) : outlineUnits;
    if (limitedUnits.length) {
      unitProgress = computeUnitProgress(limitedUnits, run.status, run.currentStage, allUnitReviews, reviews);
    }
  }

  // Süreç Günlüğü
  const designRows = await designRowsPromise;
  const processLog = run
    ? await loadProcessLog(run, { unitReviews: allUnitReviews, imageReviews: reviews, designReviews: designRows })
    : null;

  return (
    <RunStatusView
      projectId={project.id}
      initial={{
        project: { id: project.id, name: project.name, level: project.level, isbn: project.isbn },
        coverDimensions,
        contentBookTypes: bookTypesWithContent(books[0]?.content as GeneratedUnit[] | null),
        designReview: summarizeDesignReviews(designRows),
        processLog,
        upload: upload ? { filename: upload.filename, bookType: upload.bookType } : null,
        run: run
          ? {
              id: run.id,
              status: run.status,
              currentStage: run.currentStage,
              errorMessage: run.errorMessage,
              updatedAt: run.updatedAt.toISOString(),
              modelVersion: run.modelVersion,
              tokenUsage: run.tokenUsage,
              costUsage: run.costUsage,
              pendingVariants: run.pendingVariants as PendingVariants,
              pendingContentApproval: run.pendingContentApproval as PendingContentApproval,
              pendingImageReview: run.pendingImageReview as PendingImageReview[] | null,
              coverImageUrl: run.coverImageUrl,
              pageImageUrls: run.pageImageUrls,
              designTheme: run.designTheme,
              characterSheets: run.characterSheets,
            }
          : null,
        outline: outline ? { outline: outline.outline as OutlineDocument["outline"] } : null,
        flaggedImageCount,
        flaggedOriginalityCount,
        flaggedOriginalityChecks: flaggedOriginalityChecks.map((c) => ({
          unitNumber: c.unitNumber,
          pageNumber: c.pageNumber,
          ngramOverlapScore: c.ngramOverlapScore,
          llmAssessment: c.llmAssessment,
        })),
        unitProgress,
        feedback: feedback.map((f) => ({ id: f.id, rating: f.rating, comment: f.comment })),
        coherenceReview: coherenceReview
          ? {
              passed: coherenceReview.passed,
              difficultyProgressionScore: coherenceReview.difficultyProgressionScore,
              vocabularyRepetitionScore: coherenceReview.vocabularyRepetitionScore,
              grammarSequencingScore: coherenceReview.grammarSequencingScore,
              thematicConsistencyScore: coherenceReview.thematicConsistencyScore,
              issues: coherenceReview.issues,
            }
          : null,
        books: books.map((b) => ({
          id: b.id,
          bookType: b.bookType,
          markdown: b.markdown,
          pdfBlobUrl: b.pdfBlobUrl,
          epubBlobUrl: b.epubBlobUrl,
          printPdfBlobUrl: b.printPdfBlobUrl,
          coverSpreadBlobUrl: b.coverSpreadBlobUrl,
          printReport: b.printReport,
          coverMockup: b.coverMockup,
          content: b.content as GeneratedUnitContent[] | null,
        })),
      }}
    />
  );
}
