import { db } from "@/db/client";
import { runEvents } from "@/db/schema";

// Süreç Günlüğü: records a human decision at an approval gate. Best-effort -
// the log must never be the reason an approval fails.
export async function logHumanDecision(runId: string, status: string, message: string): Promise<void> {
  try {
    await db.insert(runEvents).values({ runId, kind: "human", status, message });
  } catch {
    // ignore - see above
  }
}
