import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { storyProjects, storyMessages, storyArtifacts } from "@/db/schema";
import { requireStoryProjectOwner } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const ownerCheck = await requireStoryProjectOwner(id);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const storyProject = await db.query.storyProjects.findFirst({ where: eq(storyProjects.id, id) });
  if (!storyProject) {
    return NextResponse.json({ error: "Hikaye bulunamadı" }, { status: 404 });
  }

  const [messages, artifacts] = await Promise.all([
    db.query.storyMessages.findMany({
      where: eq(storyMessages.storyProjectId, id),
      orderBy: [asc(storyMessages.createdAt)],
    }),
    db.query.storyArtifacts.findMany({
      where: eq(storyArtifacts.storyProjectId, id),
      orderBy: [asc(storyArtifacts.createdAt)],
    }),
  ]);

  return NextResponse.json({ storyProject, messages, artifacts });
}

// Story deletion (QA, 2026-10-06: stories could be created but never
// removed). Messages and artifacts cascade from storyProjects.id.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const ownerCheck = await requireStoryProjectOwner(id);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  await db.delete(storyProjects).where(eq(storyProjects.id, id));
  return NextResponse.json({ ok: true });
}
