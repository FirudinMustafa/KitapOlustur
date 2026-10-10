import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { logHumanDecision } from "@/lib/run-events";
import { resumeApprovalHook } from "@/lib/approval";

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
  if (run.status !== "awaiting_outline_approval") {
    return NextResponse.json({ error: "Bu üretim onay beklemiyor" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const approved = body?.approved === true;
  const unitLimit =
    body?.unitLimit === null || body?.unitLimit === undefined
      ? undefined
      : Number.isInteger(body.unitLimit) && body.unitLimit > 0
        ? body.unitLimit
        : null;

  const failure = await resumeApprovalHook(run.id, `outline-approval:${run.id}`, { approved, unitLimit });
  if (failure) return failure;

  await logHumanDecision(run.id, `awaiting_outline_approval`, approved ? `Dizelge onaylandı${unitLimit ? ` (ilk ${unitLimit} ünite)` : ""}` : "Dizelge reddedildi - üretim iptal");

  return NextResponse.json({ success: true });
}
