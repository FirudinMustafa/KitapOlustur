import { notFound } from "next/navigation";
import { isUuid } from "@/lib/uuid";
import { auth } from "@clerk/nextjs/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { storyProjects, storyMessages, storyArtifacts } from "@/db/schema";
import { StudioWorkspace } from "./StudioWorkspace";

export const dynamic = "force-dynamic";

export default async function StoryProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  if (!isUuid(id)) notFound();
  const storyProject = await db.query.storyProjects.findFirst({ where: eq(storyProjects.id, id) });
  if (!storyProject || storyProject.ownerId !== userId) {
    notFound();
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

  return <StudioWorkspace storyProject={storyProject} initialMessages={messages} initialArtifacts={artifacts} />;
}
