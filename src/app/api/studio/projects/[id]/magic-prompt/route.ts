import { NextResponse } from "next/server";
import { generateText } from "ai";

import { requireStoryProjectOwner } from "@/lib/auth";
import { resolveTextModel } from "@/lib/ai/model";

// Faz "Gelişmiş Görsel Üretim Paneli" (2026-09-21, ROADMAP.md): the "magic"
// button from the YouTube-inspired UI - rewrites the user's rough draft
// text into a more effective image-generation prompt. Returns the rewrite
// for the user to review/edit, never auto-submits it - same "human stays in
// the loop before anything is generated" principle as the rest of this app.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ownerCheck = await requireStoryProjectOwner(id);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const body = await request.json().catch(() => null);
  const draftText = typeof body?.draftText === "string" ? body.draftText.trim() : "";
  if (!draftText) {
    return NextResponse.json({ error: "Geliştirilecek bir metin gerekli" }, { status: 400 });
  }

  try {
    const { text } = await generateText({
      model: resolveTextModel("final"),
      system:
        "You rewrite a user's rough, casual description into a single, detailed, well-structured image-generation prompt - specific about subject, composition, lighting, and style. Output ONLY the rewritten prompt, in the same language as the input, no preamble or explanation.",
      prompt: draftText,
    });

    return NextResponse.json({ improvedPrompt: text.trim() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Prompt geliştirilemedi" }, { status: 502 });
  }
}
