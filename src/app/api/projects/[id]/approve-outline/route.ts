import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { logHumanDecision } from "@/lib/run-events";
import { currentGateToken, resumeApprovalHook } from "@/lib/approval";

import { MAX_UNIT_LIMIT } from "@/lib/gate-limits";

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
  // Omitted/null keeps the limit chosen at creation. Anything else must be a
  // valid count - an invalid value used to become null, which the workflow
  // reads as "every unit", silently ignoring the 30-unit cap.
  const rawLimit = body?.unitLimit;
  const unitLimit: number | undefined = rawLimit === null || rawLimit === undefined ? undefined : rawLimit;
  if (unitLimit !== undefined && (!Number.isInteger(unitLimit) || unitLimit < 1 || unitLimit > MAX_UNIT_LIMIT)) {
    return NextResponse.json({ error: `Ünite sayısı 1 ile ${MAX_UNIT_LIMIT} arasında bir tam sayı olmalı` }, { status: 400 });
  }

  const failure = await resumeApprovalHook(run, currentGateToken(run)!, { approved, unitLimit });
  if (failure) return failure;

  await logHumanDecision(run.id, `awaiting_outline_approval`, approved ? `Dizelge onaylandı${unitLimit ? ` (ilk ${unitLimit} ünite)` : ""}` : "Dizelge reddedildi - üretim iptal");

  return NextResponse.json({ success: true });
}
