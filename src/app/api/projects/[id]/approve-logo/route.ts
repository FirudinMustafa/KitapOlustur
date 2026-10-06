import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";

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
  if (run.status !== "awaiting_logo_upload") {
    return NextResponse.json({ error: "Bu üretim logo onayı beklemiyor" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const skip = body?.skip === true;
  const logoUrl = typeof body?.logoUrl === "string" && body.logoUrl ? body.logoUrl : null;

  try {
    await resumeHook(`logo-upload:${run.id}`, { logoUrl, skip });
  } catch {
    return NextResponse.json({ error: "Onay gönderilemedi (token geçersiz veya süresi doldu)" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
