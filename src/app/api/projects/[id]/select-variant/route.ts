import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { logHumanDecision } from "@/lib/run-events";

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
  const unitNumber = body?.unitNumber;
  const selectedIndex = body?.selectedIndex;

  if (!Number.isInteger(unitNumber) || !Number.isInteger(selectedIndex)) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  try {
    await resumeHook(`variant-selection:${run.id}:${unitNumber}`, { selectedIndex });
  } catch {
    return NextResponse.json({ error: "Seçim gönderilemedi (token geçersiz veya süresi doldu)" }, { status: 404 });
  }

  await logHumanDecision(run.id, `awaiting_variant_selection`, `Ünite ${unitNumber} için ${selectedIndex + 1}. varyant seçildi`);

  return NextResponse.json({ success: true });
}
