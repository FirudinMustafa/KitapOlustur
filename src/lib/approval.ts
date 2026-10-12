import { NextResponse } from "next/server";
import { getRun, resumeHook } from "workflow/api";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { generationRuns, runEvents } from "@/db/schema";

type GenerationRunRow = typeof generationRuns.$inferSelect;

// The hook token the workflow (workflows/book-pipeline.tsx) is waiting on for
// the run's current approval gate, or null when the run is not at a gate.
// Built only from server-side state, so a stale client can never address the
// wrong gate (e.g. a variant selection for a unit that is no longer pending).
export function currentGateToken(
  run: Pick<GenerationRunRow, "id" | "status" | "pendingCharacterApproval" | "pendingVariants" | "pendingContentApproval">,
): string | null {
  switch (run.status) {
    case "awaiting_outline_approval":
      return `outline-approval:${run.id}`;
    case "awaiting_logo_upload":
      return `logo-upload:${run.id}`;
    case "awaiting_character_approval":
      return run.pendingCharacterApproval ? `character-approval:${run.id}:${run.pendingCharacterApproval.round}` : null;
    case "awaiting_variant_selection": {
      const unitNumber = (run.pendingVariants as { unitNumber?: number } | null)?.unitNumber;
      return Number.isInteger(unitNumber) ? `variant-selection:${run.id}:${unitNumber}` : null;
    }
    case "awaiting_content_approval":
      return `content-approval:${run.id}:${(run.pendingContentApproval as { round?: number } | null)?.round ?? 0}`;
    case "awaiting_image_review":
      return `image-review:${run.id}`;
    case "awaiting_final_approval":
      return `final-approval:${run.id}`;
    default:
      return null;
  }
}

// A decision already delivered for this gate. The workflow keeps the
// awaiting_* status while it works on the decision (style bible, rewrites,
// image regeneration...), and the hook stays resumable until the run ends -
// so without this a second click "succeeded" and was silently dropped.
// Recorded as a run_events row of kind "gate" (hidden from the Süreç Günlüğü).
export async function isGateSubmitted(runId: string, token: string): Promise<boolean> {
  const row = await db.query.runEvents.findFirst({
    where: and(eq(runEvents.runId, runId), eq(runEvents.kind, "gate"), eq(runEvents.status, token)),
    columns: { id: true },
  });
  return Boolean(row);
}

// True when the run waits at a gate whose decision was already delivered -
// the project page then shows "işleniyor" instead of live buttons.
export async function isCurrentGateSubmitted(run: Parameters<typeof currentGateToken>[0]): Promise<boolean> {
  const token = currentGateToken(run);
  return token ? isGateSubmitted(run.id, token) : false;
}

const ALREADY_SUBMITTED = "Bu onay zaten iletildi - iş akışı kararını işliyor, birkaç dakika içinde sonraki adıma geçecek.";

// Resumes the workflow paused at the run's current approval gate. Returns
// null on success, or the response to send back.
//
// "Hook not found" has two causes that need opposite handling:
// - the workflow set the awaiting_* status but has not registered the hook
//   yet (it does so on its next replay, seconds later) -> ask to retry;
// - the workflow is gone (e.g. a local dev run whose state was wiped by
//   `next build`). Before the lost-run handling the run sat "awaiting
//   approval" forever, so such a run is closed as failed and "Yeniden
//   çalıştır" can pick up from the content it already produced.
// The real workflow state decides which one it is.
export async function resumeApprovalHook(
  run: Pick<GenerationRunRow, "id" | "workflowRunId">,
  token: string,
  payload: unknown,
): Promise<NextResponse | null> {
  // Claim the gate before resuming: a unique index (run_id, status) on gate
  // rows makes the claim atomic, so of two simultaneous submissions only
  // one reaches the workflow (live test 2026-10-12: a click and a second
  // request both got through when check and record were separate steps).
  const claimed = await db
    .insert(runEvents)
    .values({ runId: run.id, kind: "gate", status: token, message: null })
    .onConflictDoNothing()
    .returning({ id: runEvents.id });
  if (!claimed.length) {
    return NextResponse.json({ error: ALREADY_SUBMITTED }, { status: 409 });
  }
  const release = () => db.delete(runEvents).where(eq(runEvents.id, claimed[0].id)).catch(() => {});
  try {
    await resumeHook(token, payload);
  } catch (err) {
    await release();
    const missing = err instanceof Error && err.name === "HookNotFoundError";
    if (!missing || (await isWorkflowAlive(run.workflowRunId))) {
      return NextResponse.json(
        { error: "Onay şu an iş akışına iletilemedi - birkaç saniye sonra tekrar dene." },
        { status: missing ? 409 : 502 },
      );
    }
    const message =
      "Bu üretimin bekleyen onay adımı artık mevcut değil (iş akışının durumu kaybolmuş). Üretim durdu olarak işaretlendi; 'Yeniden çalıştır' ile yazılmış içerik yeniden kullanılarak kaldığı yerden devam edebilirsin.";
    await db
      .update(generationRuns)
      .set({ status: "failed", currentStage: null, errorMessage: message, updatedAt: new Date() })
      .where(eq(generationRuns.id, run.id));
    await db.insert(runEvents).values({ runId: run.id, kind: "status", status: "failed", message }).catch(() => {});
    return NextResponse.json({ error: message }, { status: 409 });
  }
  return null;
}

// True while the workflow behind a run can still make progress. Unknown runs
// (state wiped) and terminal ones are not alive.
export async function isWorkflowAlive(workflowRunId: string | null): Promise<boolean> {
  if (!workflowRunId) return false;
  try {
    const status = await getRun(workflowRunId).status;
    return status === "pending" || status === "running";
  } catch {
    return false;
  }
}
