import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { savedReferenceImages, storyMessages } from "@/db/schema";
import { requireStoryProjectOwner } from "@/lib/auth";
import { resolveTextModel, toTextModel } from "@/lib/ai/model";

const ideasSchema = z.object({ ideas: z.array(z.string()) });

// Faz "Gelişmiş Görsel Üretim Paneli" (2026-09-21, ROADMAP.md): "brainstorm
// ideas" mode from the YouTube-inspired UI - given a handful of tagged
// reference images and a desired idea count, ask the model for that many
// distinct image-prompt suggestions that draw on those references, instead
// of the user having to describe everything from scratch every time.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ownerCheck = await requireStoryProjectOwner(id);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const body = await request.json().catch(() => null);
  const referenceImageIds = Array.isArray(body?.referenceImageIds)
    ? body.referenceImageIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  const ideaCountRaw = body?.ideaCount;
  const ideaCount = Number.isInteger(ideaCountRaw) && ideaCountRaw >= 1 && ideaCountRaw <= 10 ? ideaCountRaw : 3;

  const userId = ownerCheck;
  const references = referenceImageIds.length
    ? await db.query.savedReferenceImages.findMany({
        where: and(inArray(savedReferenceImages.id, referenceImageIds), eq(savedReferenceImages.ownerId, userId)),
      })
    : [];

  // QA fix (2026-10-06): ideas used to ignore the story entirely (a cat
  // story got "a robot in a forest"); the latest conversation is now passed
  // as context so suggestions illustrate this story.
  const recentMessages = await db.query.storyMessages.findMany({
    where: eq(storyMessages.storyProjectId, id),
    orderBy: [asc(storyMessages.createdAt)],
  });
  const storyContext = recentMessages
    .map((m) => `${m.role === "user" ? "Kullanıcı" : "Asistan"}: ${m.content}`)
    .join("\n")
    .slice(-3000);
  const contextText = storyContext ? `\n\nThe story so far (illustrate THIS story):\n${storyContext}` : "";

  try {
    const { object } = await generateObject({
      model: toTextModel(resolveTextModel("final")),
      schema: ideasSchema,
      system:
        "You are a creative director brainstorming image-generation prompt ideas for an illustrated children's/educational story.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: references.length
                ? `Suggest exactly ${ideaCount} distinct, concrete image-generation prompt ideas that creatively use the reference image(s) below (their tags: ${references
                    .map((r) => r.tags.join(", "))
                    .join(" | ")}). Each idea should be a single, ready-to-use prompt sentence, in Turkish.${contextText}`
                : `Suggest exactly ${ideaCount} distinct, concrete image-generation prompt ideas for an illustrated children's/educational story. Each idea should be a single, ready-to-use prompt sentence, in Turkish.${contextText}`,
            },
            ...references.map((r) => ({ type: "image" as const, image: new URL(r.url) })),
          ],
        },
      ],
    });

    return NextResponse.json({ ideas: object.ideas.slice(0, ideaCount) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fikir üretilemedi" }, { status: 502 });
  }
}
