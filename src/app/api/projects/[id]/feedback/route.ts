import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns, teacherFeedback } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";

// Faz H4: lightweight feedback capture on a project's latest run - see
// teacherFeedback in src/db/schema.ts. Not yet consumed by generation; this
// is only the capture side of a future learning loop.
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

  const body = await request.json().catch(() => ({}));
  const rating =
    Number.isInteger(body?.rating) && body.rating >= 1 && body.rating <= 5 ? body.rating : null;
  const comment = typeof body?.comment === "string" && body.comment.trim() ? body.comment.trim() : null;

  if (rating === null && comment === null) {
    return NextResponse.json({ error: "Puan veya yorum gerekli" }, { status: 400 });
  }

  await db.insert(teacherFeedback).values({ runId: run.id, rating, comment });

  return NextResponse.json({ success: true });
}
