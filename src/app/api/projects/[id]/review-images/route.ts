import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { logHumanDecision } from "@/lib/run-events";

type Decision = { unitNumber: number; pageNumber: number; action: "accept" | "regenerate" };

// Faz "İnsan-onaylı üretim hattı" (ROADMAP.md) - resumes the flagged-image
// review gate. Body: { decisions: Decision[] } - one entry per flagged
// image the human reviewed; images not mentioned default to "accept" in
// the workflow (see the hook consumer in workflows/book-pipeline.tsx).
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
  if (run.status !== "awaiting_image_review") {
    return NextResponse.json({ error: "Bu üretim görsel incelemesi beklemiyor" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const decisions: Decision[] = Array.isArray(body?.decisions)
    ? body.decisions.filter(
        (d: unknown): d is Decision =>
          typeof d === "object" &&
          d !== null &&
          typeof (d as Decision).unitNumber === "number" &&
          typeof (d as Decision).pageNumber === "number" &&
          ((d as Decision).action === "accept" || (d as Decision).action === "regenerate"),
      )
    : [];

  try {
    await resumeHook(`image-review:${run.id}`, { decisions });
  } catch {
    return NextResponse.json({ error: "Onay gönderilemedi (token geçersiz veya süresi doldu)" }, { status: 404 });
  }

  await logHumanDecision(run.id, `awaiting_image_review`, `Görsel incelemesi: ${decisions.filter((d) => d.action === "regenerate").length} yeniden üretilecek, ${decisions.filter((d) => d.action === "accept").length} kabul edildi`);

  return NextResponse.json({ success: true });
}
