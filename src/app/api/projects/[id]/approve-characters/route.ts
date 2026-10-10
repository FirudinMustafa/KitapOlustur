import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { logHumanDecision } from "@/lib/run-events";

// Faz 2 "Karakter tutarlılığı": resumes the character-sheet approval gate.
// `approved: true` continues the run with the current sheets; otherwise the
// characters listed in `redraw` (each with an optional correction note, e.g.
// "saçı daha kısa, gözlüksüz") are drawn again and the gate re-opens with a
// new round number (pendingCharacterApproval.round) - same numbered-token
// pattern as approve-content.
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
  if (run.status !== "awaiting_character_approval" || !run.pendingCharacterApproval) {
    return NextResponse.json({ error: "Bu üretim karakter onayı beklemiyor" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const knownIds = new Set((run.characterSheets ?? []).map((c) => c.id));
  const redrawRaw: unknown[] = Array.isArray(body?.redraw) ? body.redraw : [];
  const redraw = redrawRaw
    .filter(
      (r): r is { id: string; note?: unknown } =>
        typeof r === "object" && r !== null && typeof (r as Record<string, unknown>).id === "string",
    )
    .filter((r) => knownIds.has(r.id))
    .map((r) => ({ id: r.id, note: typeof r.note === "string" && r.note.trim() ? r.note.trim().slice(0, 500) : undefined }));
  const approved = body?.approved === true && redraw.length === 0;

  try {
    await resumeHook(`character-approval:${run.id}:${run.pendingCharacterApproval.round}`, { approved, redraw });
  } catch {
    return NextResponse.json({ error: "Onay gönderilemedi (token geçersiz veya süresi doldu)" }, { status: 404 });
  }

  await logHumanDecision(run.id, `awaiting_character_approval`, approved ? "Karakterler onaylandı" : `Yeniden çizim istendi: ${redraw.map((r) => (r.note ? `${r.id} ("${r.note}")` : r.id)).join(", ")}`);

  return NextResponse.json({ success: true });
}
