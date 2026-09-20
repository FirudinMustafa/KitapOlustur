import { notFound } from "next/navigation";
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
} from "@/db/schema";
import {
  RunStatusView,
  type OutlineDocument,
  type GeneratedUnitContent,
  type PendingVariants,
  type PendingContentUnit,
  type PendingImageReview,
} from "./RunStatusView";
import { computeUnitProgress } from "@/lib/unit-progress";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Faz G3: 404 (not a 403) for "exists but isn't yours" - same reasoning as
  // requireProjectOwner in src/lib/auth.ts, kept in sync manually since this
  // is a server component rather than an API route.
  const { userId } = await auth();
  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project || !userId || project.ownerId !== userId) notFound();

  const upload = await db.query.sourceUploads.findFirst({
    where: eq(sourceUploads.projectId, id),
    orderBy: [desc(sourceUploads.createdAt)],
  });

  const run = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.projectId, id),
    orderBy: [desc(generationRuns.createdAt)],
  });

  const outline = run
    ? (await db.query.extractedOutlines.findFirst({ where: eq(extractedOutlines.runId, run.id) })) ?? null
    : null;

  const books = run
    ? await db.query.generatedBooks.findMany({ where: eq(generatedBooks.runId, run.id) })
    : [];

  // Faz D: same "latest attempt per image, count still-failing" logic as the
  // /api/projects/[id] route, kept in sync manually (see ROADMAP.md Faz D).
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

  // Faz "Panel/Çizelge": same reconstruction as /api/projects/[id], kept in
  // sync manually (matches this file's existing dual-query pattern).
  let unitProgress: ReturnType<typeof computeUnitProgress> = [];
  if (run) {
    const outlineUnits = (outline?.outline as OutlineDocument["outline"] | undefined)?.outline?.units ?? [];
    const limitedUnits = run.unitLimit ? outlineUnits.slice(0, run.unitLimit) : outlineUnits;
    if (limitedUnits.length) {
      const [allUnitReviews, allImageReviews] = await Promise.all([
        db.query.unitReviews.findMany({ where: eq(unitReviews.runId, run.id) }),
        db.query.imageReviews.findMany({ where: eq(imageReviews.runId, run.id) }),
      ]);
      unitProgress = computeUnitProgress(limitedUnits, run.status, run.currentStage, allUnitReviews, allImageReviews);
    }
  }

  return (
    <RunStatusView
      projectId={project.id}
      initial={{
        project: { id: project.id, name: project.name, level: project.level },
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
              pendingVariants: run.pendingVariants as PendingVariants,
              pendingContentApproval: run.pendingContentApproval as PendingContentUnit[] | null,
              pendingImageReview: run.pendingImageReview as PendingImageReview[] | null,
              coverImageUrl: run.coverImageUrl,
              pageImageUrls: run.pageImageUrls,
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
          content: b.content as GeneratedUnitContent[] | null,
        })),
      }}
    />
  );
}
