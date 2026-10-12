import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns, runEvents } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { logHumanDecision } from "@/lib/run-events";

const TERMINAL = ["done", "failed", "changes_requested"];
const CANCELLED_MESSAGE = "Üretim kullanıcı tarafından durduruldu. 'Yeniden çalıştır' ile yazılmış içerik yeniden kullanılarak devam edebilirsin.";

// Stops the project's active run - working, waiting at any approval gate, or
// stuck "pending" with no workflow behind it. Several gates (logo,
// characters, variants, image review) have no reject option, and rerun and
// delete are refused while a run is active, so without this a run that was
// abandoned or lost could never be cleared.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;

  const ownerCheck = await requireProjectOwner(projectId);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const run = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.projectId, projectId),
    orderBy: [desc(generationRuns.createdAt)],
  });
  if (!run || TERMINAL.includes(run.status)) {
    return NextResponse.json({ error: "Durdurulacak devam eden bir üretim yok" }, { status: 409 });
  }

  if (run.workflowRunId) {
    try {
      await getRun(run.workflowRunId).cancel();
    } catch (err) {
      // Already finished or unknown to the workflow world (state wiped) -
      // either way nothing is left running, so closing the row is correct.
      console.warn("[cancel] workflow cancel failed", run.workflowRunId, err);
    }
  }

  await db
    .update(generationRuns)
    .set({ status: "failed", currentStage: null, errorMessage: CANCELLED_MESSAGE, updatedAt: new Date() })
    .where(eq(generationRuns.id, run.id));
  await db.insert(runEvents).values({ runId: run.id, kind: "status", status: "failed", message: CANCELLED_MESSAGE }).catch(() => {});
  await logHumanDecision(run.id, run.status, "Üretim durduruldu");

  return NextResponse.json({ success: true });
}
