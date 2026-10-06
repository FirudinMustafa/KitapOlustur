import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";

import { db } from "@/db/client";
import { storyArtifacts } from "@/db/schema";
import { isUuid } from "@/lib/uuid";
import { requireStoryProjectOwner } from "@/lib/auth";
import { pollHiggsfieldStatus } from "@/lib/ai/higgsfield";

// Polled by the frontend (see StudioWorkspace.tsx) every few seconds while a
// video artifact is "pending" - Higgsfield's API is async, so there's no way
// to know a video is ready except asking it. A "done"/"failed" artifact is
// returned as-is without calling Higgsfield again (nothing left to check).
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; artifactId: string }> },
) {
  const { id, artifactId } = await context.params;

  const ownerCheck = await requireStoryProjectOwner(id);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const artifact = isUuid(artifactId)
    ? await db.query.storyArtifacts.findFirst({ where: eq(storyArtifacts.id, artifactId) })
    : undefined;
  if (!artifact || artifact.storyProjectId !== id) {
    return NextResponse.json({ error: "Artifact bulunamadı" }, { status: 404 });
  }

  if (artifact.status !== "pending" || !artifact.providerRequestId) {
    return NextResponse.json({ artifact });
  }

  const result = await pollHiggsfieldStatus(artifact.providerRequestId);

  if (result.status === "queued" || result.status === "in_progress") {
    return NextResponse.json({ artifact });
  }

  if (result.status === "completed") {
    // Higgsfield only guarantees the output stays reachable for "at least
    // seven days" (see ROADMAP.md) - re-hosted on our own Blob storage
    // immediately, same as every other generated asset in this app.
    const videoRes = await fetch(result.videoUrl);
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    const blob = await put(`studio/${id}/video-${Date.now()}.mp4`, videoBuffer, {
      access: "public",
      contentType: videoRes.headers.get("content-type") ?? "video/mp4",
      addRandomSuffix: false,
    });
    const [updated] = await db
      .update(storyArtifacts)
      .set({ status: "done", url: blob.url })
      .where(eq(storyArtifacts.id, artifactId))
      .returning();
    return NextResponse.json({ artifact: updated });
  }

  const [updated] = await db
    .update(storyArtifacts)
    .set({ status: "failed", errorMessage: "errorMessage" in result ? result.errorMessage : "Video üretimi tamamlanamadı." })
    .where(eq(storyArtifacts.id, artifactId))
    .returning();
  return NextResponse.json({ artifact: updated });
}
