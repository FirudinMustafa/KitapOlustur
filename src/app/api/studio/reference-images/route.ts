import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { savedReferenceImages } from "@/db/schema";

// Faz "Gelişmiş Görsel Üretim Paneli" (2026-09-21, ROADMAP.md): a personal,
// cross-story reference-image library (schema comment on savedReferenceImages
// explains why it's not scoped to one storyProjectId). Same auth pattern as
// src/app/api/studio/projects/route.ts.
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 });
  }

  const rows = await db.query.savedReferenceImages.findMany({
    where: eq(savedReferenceImages.ownerId, userId),
    orderBy: [desc(savedReferenceImages.createdAt)],
  });

  return NextResponse.json({ referenceImages: rows });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const url = body && typeof body.url === "string" && body.url ? body.url : null;
  if (!url) {
    return NextResponse.json({ error: "Görsel URL'si gerekli" }, { status: 400 });
  }
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0)
    : [];

  const [row] = await db
    .insert(savedReferenceImages)
    .values({ ownerId: userId, url, tags })
    .returning();

  return NextResponse.json({ referenceImage: row });
}
