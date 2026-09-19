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
