import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { storyProjects } from "@/db/schema";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 });
  }

  const rows = await db.query.storyProjects.findMany({
    where: eq(storyProjects.ownerId, userId),
    orderBy: [desc(storyProjects.updatedAt)],
  });

  return NextResponse.json({ storyProjects: rows });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title = body && typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Yeni Hikaye";
  const qualityMode = body?.qualityMode === "draft" ? "draft" : "final";

  const [storyProject] = await db
    .insert(storyProjects)
    .values({ ownerId: userId, title, qualityMode })
    .returning();

  return NextResponse.json({ storyProject });
}
