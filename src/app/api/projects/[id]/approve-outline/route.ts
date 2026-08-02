import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;

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

  try {
    await resumeHook(`outline-approval:${run.id}`, { approved, unitLimit });
  } catch {
    return NextResponse.json({ error: "Onay gönderilemedi (token geçersiz veya süresi doldu)" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
