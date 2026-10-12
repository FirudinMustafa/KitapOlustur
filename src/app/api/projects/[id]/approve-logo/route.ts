import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { generationRuns } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { logHumanDecision } from "@/lib/run-events";
import { currentGateToken, resumeApprovalHook } from "@/lib/approval";
import { isOwnBlobUrl } from "@/lib/blob-url";

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
  // The logo is fetched server-side when the PDF is rendered - only accept
  // this app's own Blob uploads (see isOwnBlobUrl).
  if (logoUrl && !isOwnBlobUrl(logoUrl)) {
    return NextResponse.json({ error: "Geçersiz logo adresi" }, { status: 400 });
  }

  const failure = await resumeApprovalHook(run, currentGateToken(run)!, { logoUrl, skip });
  if (failure) return failure;

  await logHumanDecision(run.id, `awaiting_logo_upload`, skip || !logoUrl ? "Logo adımı atlandı" : "Kendi logosu yüklendi");

  return NextResponse.json({ success: true });
}
