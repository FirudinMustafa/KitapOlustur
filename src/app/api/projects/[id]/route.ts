import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, generationRuns, extractedOutlines, generatedBooks, sourceUploads } from "@/db/schema";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  const upload = await db.query.sourceUploads.findFirst({
    where: eq(sourceUploads.projectId, id),
    orderBy: [desc(sourceUploads.createdAt)],
  });

  const run = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.projectId, id),
    orderBy: [desc(generationRuns.createdAt)],
  });

  const outline = run
    ? await db.query.extractedOutlines.findFirst({ where: eq(extractedOutlines.runId, run.id) })
    : null;

  const books = run
    ? await db.query.generatedBooks.findMany({ where: eq(generatedBooks.runId, run.id) })
    : [];

  return NextResponse.json({ project, upload, run, outline, books });
}
