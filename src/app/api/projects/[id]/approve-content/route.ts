import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { logHumanDecision } from "@/lib/run-events";

// Faz "İnsan-onaylı üretim hattı" (ROADMAP.md) - resumes the batched
// content-approval gate (all units' text at once, before any image
// generation starts). Same pattern as approve-outline/route.ts.
//
// Faz "Granüler editöryel feedback": the gate can now loop (see
// workflows/book-pipeline.tsx) - each round has its own hook token, numbered
// via pendingContentApproval.round. `approved: true` with a non-empty
// `changes` array means "approve everything else, but regenerate these
// specific units with this comment" - not a final approval; the workflow
// re-shows the updated units for another round. `approved: false` cancels
// the whole run regardless of `changes`.
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
  if (run.status !== "awaiting_content_approval") {
    return NextResponse.json({ error: "Bu üretim içerik onayı beklemiyor" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const approved = body?.approved === true;
  const changesRaw: unknown[] = Array.isArray(body?.changes) ? body.changes : [];
  const changes = changesRaw
    .filter(
      (c: unknown): c is { unitNumber: number; comment: string } =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).unitNumber === "number" &&
        typeof (c as Record<string, unknown>).comment === "string" &&
        ((c as Record<string, string>).comment.trim().length > 0),
    )
    .map((c) => ({ unitNumber: c.unitNumber, comment: c.comment.trim() }));

  const round = (run.pendingContentApproval as { round?: number } | null)?.round ?? 0;

  try {
    await resumeHook(`content-approval:${run.id}:${round}`, { approved, changes });
  } catch {
    return NextResponse.json({ error: "Onay gönderilemedi (token geçersiz veya süresi doldu)" }, { status: 404 });
  }

  await logHumanDecision(run.id, `awaiting_content_approval`, !approved ? "İçerik reddedildi - üretim iptal" : changes.length ? `İçerik onaylandı, ${changes.length} ünite için değişiklik istendi: ${changes.map((c) => `Ünite ${c.unitNumber}: ${c.comment.slice(0, 160)}`).join(" | ")}` : "İçerik onaylandı");

  return NextResponse.json({ success: true });
}
