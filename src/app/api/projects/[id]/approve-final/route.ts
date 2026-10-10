import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { logHumanDecision } from "@/lib/run-events";
import { resumeApprovalHook } from "@/lib/approval";

// Faz "İnsan-onaylı üretim hattı" (ROADMAP.md) - resumes the final
// sign-off gate, right before assembly. Rejecting doesn't fail the run
// (see "changes_requested" in workflows/book-pipeline.tsx) - it's a
// deliberate "not ready yet" outcome, not an error.
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
  if (run.status !== "awaiting_final_approval") {
    return NextResponse.json({ error: "Bu üretim nihai onay beklemiyor" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const approved = body?.approved === true;

  const failure = await resumeApprovalHook(run.id, `final-approval:${run.id}`, { approved });
  if (failure) return failure;

  await logHumanDecision(run.id, `awaiting_final_approval`, approved ? "Nihai onay verildi - kitaplar derleniyor" : "Nihai onayda değişiklik istendi");

  return NextResponse.json({ success: true });
}
