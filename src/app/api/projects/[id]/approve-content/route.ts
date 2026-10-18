import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { logHumanDecision } from "@/lib/run-events";
import { currentGateToken, resumeApprovalHook } from "@/lib/approval";
import { MAX_CONTENT_CHANGE_ROUNDS, normalizeContentChanges } from "@/lib/gate-limits";

// Faz "İnsan-onaylı üretim hattı" (ROADMAP.md) - resumes the batched
// content-approval gate (all units' text at once, before any image
// generation starts). Same pattern as approve-outline/route.ts.
//
// Faz "Granüler editöryel feedback": the gate can now loop (see
// workflows/book-pipeline.tsx) - each round has its own hook token, numbered
// via pendingContentApproval.round. `approved: true` with a non-empty
// `changes` array means "approve everything else, but regenerate these
// specific units with this comment" - not a final approval; the workflow
// re-shows the updated units for another round. `approved: false` cancels
// the whole run regardless of `changes`.
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
  if (run.status !== "awaiting_content_approval") {
    return NextResponse.json({ error: "Bu üretim içerik onayı beklemiyor" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const approved = body?.approved === true;
  // Audit 2026-10-18: one change per shown unit, and a cap on change
  // rounds - each entry is a paid unit rebuild in the workflow.
  const pending = run.pendingContentApproval as { round?: number; units?: { unitNumber: number }[] } | null;
  const knownUnits = new Set((pending?.units ?? []).map((u) => u.unitNumber));
  const changes = approved ? normalizeContentChanges(body?.changes, knownUnits) : [];
  if (changes.length && (pending?.round ?? 0) >= MAX_CONTENT_CHANGE_ROUNDS) {
    return NextResponse.json(
      { error: `En fazla ${MAX_CONTENT_CHANGE_ROUNDS} değişiklik turu yapılabilir - içeriği onayla ya da reddet.` },
      { status: 400 },
    );
  }

  const failure = await resumeApprovalHook(run, currentGateToken(run)!, { approved, changes });
  if (failure) return failure;

  await logHumanDecision(run.id, `awaiting_content_approval`, !approved ? "İçerik reddedildi - üretim iptal" : changes.length ? `İçerik onaylandı, ${changes.length} ünite için değişiklik istendi: ${changes.map((c) => `Ünite ${c.unitNumber}: ${c.comment.slice(0, 160)}`).join(" | ")}` : "İçerik onaylandı");

  return NextResponse.json({ success: true });
}
