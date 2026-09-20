import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { savedReferenceImages } from "@/db/schema";

// Faz "Gelişmiş Görsel Üretim Paneli": ownership checked inline (and(...))
// rather than a shared requireXOwner helper - this is the only place a
// savedReferenceImages row is looked up by id, doesn't warrant a new helper
// alongside requireProjectOwner/requireStoryProjectOwner (src/lib/auth.ts).
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0)
    : null;
  if (tags === null) {
    return NextResponse.json({ error: "Geçerli bir etiket listesi gerekli" }, { status: 400 });
  }

  const [row] = await db
    .update(savedReferenceImages)
    .set({ tags })
    .where(and(eq(savedReferenceImages.id, id), eq(savedReferenceImages.ownerId, userId)))
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Referans görsel bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ referenceImage: row });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 });
  }

  const [row] = await db
    .delete(savedReferenceImages)
    .where(and(eq(savedReferenceImages.id, id), eq(savedReferenceImages.ownerId, userId)))
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Referans görsel bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
