import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { logHumanDecision } from "@/lib/run-events";
import { currentGateToken, resumeApprovalHook } from "@/lib/approval";
import { normalizeImageDecisions } from "@/lib/gate-limits";

// Faz "İnsan-onaylı üretim hattı" (ROADMAP.md) - resumes the flagged-image
// review gate. Body: { decisions: Decision[] } - one entry per flagged
// image the human reviewed; images not mentioned default to "accept" in
// the workflow (see the hook consumer in workflows/book-pipeline.tsx).
// Only flagged images are accepted, each once (audit 2026-10-18: any page,
// any number of times, was a way to regenerate images without limit).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;

  const ownerCheck = await requireProjectOwner(projectId);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const run = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.projectId, projectId),
    orderBy: [desc(generationRuns.createdAt)],
  });
  if (!run) {
    return NextResponse.json({ error: "Bu proje için üretim bulunamadı" }, { status: 404 });
  }
  if (run.status !== "awaiting_image_review") {
    return NextResponse.json({ error: "Bu üretim görsel incelemesi beklemiyor" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const flagged = Array.isArray(run.pendingImageReview)
    ? (run.pendingImageReview as { unitNumber: number; pageNumber: number }[])
    : [];
  const decisions = normalizeImageDecisions(body?.decisions, flagged);

  const failure = await resumeApprovalHook(run, currentGateToken(run)!, { decisions });
  if (failure) return failure;

  await logHumanDecision(run.id, `awaiting_image_review`, `Görsel incelemesi: ${decisions.filter((d) => d.action === "regenerate").length} yeniden üretilecek, ${decisions.filter((d) => d.action === "accept").length} kabul edildi`);

  return NextResponse.json({ success: true });
}
