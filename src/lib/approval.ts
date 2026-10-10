import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { generationRuns, runEvents } from "@/db/schema";

// Resumes the workflow paused at an approval gate. Returns null on success,
// or the response to send back.
//
// A gate whose hook no longer exists can never be resumed - e.g. a local
// dev run whose workflow state was wiped by `next build` (it recreates
// .next/, where the local workflow world lives). Before this, the run sat
// "awaiting approval" forever: every approval failed with "token invalid"
// and a rerun was refused because a run was still in progress. Such a run
// is now closed as failed with an explanation, so "Yeniden çalıştır" can
// pick up from the content it already produced.
export async function resumeApprovalHook(runId: string, token: string, payload: unknown): Promise<NextResponse | null> {
  try {
    await resumeHook(token, payload);
    return null;
  } catch (err) {
    const missing = err instanceof Error && err.name === "HookNotFoundError";
    if (!missing) {
      return NextResponse.json(
        { error: "Onay şu an iş akışına iletilemedi - birkaç saniye sonra tekrar dene." },
        { status: 502 },
      );
    }
    const message =
      "Bu üretimin bekleyen onay adımı artık mevcut değil (iş akışının durumu kaybolmuş). Üretim durdu olarak işaretlendi; 'Yeniden çalıştır' ile yazılmış içerik yeniden kullanılarak kaldığı yerden devam edebilirsin.";
    await db
      .update(generationRuns)
      .set({ status: "failed", currentStage: null, errorMessage: message, updatedAt: new Date() })
      .where(eq(generationRuns.id, runId));
    await db.insert(runEvents).values({ runId, kind: "status", status: "failed", message }).catch(() => {});
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
