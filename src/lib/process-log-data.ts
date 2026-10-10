import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { runEvents, type PageDesignReviewRow } from "@/db/schema";
import { buildProcessLog, type ProcessLog } from "@/lib/process-log";

// Server-side loader shared by the project page and its polling API route,
// so both build the Süreç Günlüğü from the same rows.
export async function loadProcessLog(
  run: { id: string; status: string; currentStage: string | null; updatedAt: Date; pageImageUrls?: unknown },
  rows: {
    unitReviews: { unitNumber: number; reviewType: string; passed: boolean; issues: string[]; createdAt: Date }[];
    imageReviews: { unitNumber: number | null; pageNumber: number | null; passed: boolean; issues: string[]; attempt: number; createdAt: Date }[];
    designReviews: Pick<PageDesignReviewRow, "round" | "bookType" | "score" | "pageCount" | "appliedFix" | "createdAt">[];
  },
): Promise<ProcessLog> {
  const events = await db.query.runEvents.findMany({ where: eq(runEvents.runId, run.id), orderBy: [asc(runEvents.createdAt)] });
  return buildProcessLog({
    status: run.status,
    currentStage: run.currentStage,
    updatedAt: run.updatedAt,
    events,
    unitReviews: rows.unitReviews,
    imageReviews: rows.imageReviews,
    designReviews: rows.designReviews,
    pageImageCount: Object.keys((run.pageImageUrls as Record<string, string> | null) ?? {}).length,
  });
}
