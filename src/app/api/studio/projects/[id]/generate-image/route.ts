import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { savedReferenceImages, storyArtifacts } from "@/db/schema";
import { requireStoryProjectOwner } from "@/lib/auth";
import { STUDIO_IMAGE_MODELS, STUDIO_IMAGE_SIZES, type StudioImageSizeId } from "@/lib/ai/model";
import { generateAdvancedStoryImage } from "@/lib/ai/studio-generation";

// Faz "Gelişmiş Görsel Üretim Paneli" (2026-09-21, ROADMAP.md): a separate
// endpoint from messages/route.ts's chat/tool-calling flow, not an
// extension of it - the advanced panel (StudioWorkspace.tsx) is a distinct
// parametrized tool next to the chat, not part of the linear conversation,
// so its artifacts aren't tied to a storyMessages row (messageId stays
// null, same as how a "pending" video-source-missing artifact can already
// have no message in the existing schema).
//
// @-mention resolution happens here, not client-side: the prompt text
// itself (with "@etiket" tokens the UI inserted when the user checked a
// reference image) is the single source of truth - no separate
// referenceImageIds array to keep in sync with edits the user makes to the
// text afterward.
function extractMentionedTags(prompt: string): string[] {
  const matches = prompt.match(/@([\p{L}\p{N}_-]+)/gu) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ownerCheck = await requireStoryProjectOwner(id);
  if (ownerCheck instanceof NextResponse) return ownerCheck;
  const userId = ownerCheck;

  const body = await request.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "Prompt gerekli" }, { status: 400 });
  }

  const modelId = STUDIO_IMAGE_MODELS.find((m) => m.id === body?.model)?.id ?? STUDIO_IMAGE_MODELS[0].id;
  const size: StudioImageSizeId =
    STUDIO_IMAGE_SIZES.find((s) => s.id === body?.size)?.id ?? STUDIO_IMAGE_SIZES[0].id;
  const countRaw = body?.count;
  const count = Number.isInteger(countRaw) && countRaw >= 1 && countRaw <= 4 ? countRaw : 1;

  const mentionedTags = extractMentionedTags(prompt);
  let referenceImageUrls: string[] | undefined;
  if (mentionedTags.length) {
    const allReferences = await db.query.savedReferenceImages.findMany({
      where: eq(savedReferenceImages.ownerId, userId),
    });
    const matched = allReferences.filter((r) => r.tags.some((t) => mentionedTags.includes(t.toLowerCase())));
    if (matched.length) referenceImageUrls = matched.map((r) => r.url).slice(0, 4);
  }

  const result = await generateAdvancedStoryImage(id, prompt, modelId, size, count, referenceImageUrls);

  if (result.status === "failed") {
    await db.insert(storyArtifacts).values({
      storyProjectId: id,
      type: "image",
      prompt,
      model: result.model,
      status: "failed",
      errorMessage: result.errorMessage,
    });
    return NextResponse.json({ status: "failed", errorMessage: result.errorMessage }, { status: 502 });
  }

  const rows = await db
    .insert(storyArtifacts)
    .values(
      result.urls.map((url) => ({
        storyProjectId: id,
        type: "image" as const,
        url,
        prompt,
        model: result.model,
        status: "done" as const,
        costUsd: result.costUsd != null ? result.costUsd / result.urls.length : null,
      })),
    )
    .returning();

  return NextResponse.json({ status: "done", artifacts: rows });
}
