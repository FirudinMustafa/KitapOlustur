import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { logHumanDecision } from "@/lib/run-events";
import { currentGateToken, resumeApprovalHook } from "@/lib/approval";

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
  if (run.status !== "awaiting_variant_selection") {
    return NextResponse.json({ error: "Bu üretim varyant seçimi beklemiyor" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const selectedIndex = body?.selectedIndex;
  // The pending unit comes from the run, never from the client: a stale
  // tab's unit number used to address a hook that no longer existed.
  const pending = run.pendingVariants as { unitNumber?: number; variants?: unknown[] } | null;
  const unitNumber = pending?.unitNumber;
  const token = currentGateToken(run);

  if (!token || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= (pending?.variants?.length ?? 0)) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const failure = await resumeApprovalHook(run, token, { selectedIndex });
  if (failure) return failure;

  await logHumanDecision(run.id, `awaiting_variant_selection`, `Ünite ${unitNumber} için ${selectedIndex + 1}. varyant seçildi`);

  return NextResponse.json({ success: true });
}
