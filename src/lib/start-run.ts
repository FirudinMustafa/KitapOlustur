import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { generationRuns, runEvents } from "@/db/schema";

export const START_FAILED_MESSAGE = "Üretim başlatılamadı (iş akışı servisine ulaşılamadı). 'Yeniden çalıştır' ile tekrar dene.";

// Starts the workflow for an already-inserted run and links it. If the start
// itself fails, the run is closed as failed: a "pending" row with no workflow
// behind it used to block rerun and delete forever.
export async function launchRun(runId: string, launch: () => Promise<{ runId: string }>): Promise<boolean> {
  try {
    const workflowRun = await launch();
    await db.update(generationRuns).set({ workflowRunId: workflowRun.runId }).where(eq(generationRuns.id, runId));
    return true;
  } catch (err) {
    console.error("[launchRun] workflow start failed", runId, err);
    await db
      .update(generationRuns)
      .set({ status: "failed", errorMessage: START_FAILED_MESSAGE, updatedAt: new Date() })
      .where(eq(generationRuns.id, runId))
      .catch(() => {});
    await db.insert(runEvents).values({ runId, kind: "status", status: "failed", message: START_FAILED_MESSAGE }).catch(() => {});
    return false;
  }
}
