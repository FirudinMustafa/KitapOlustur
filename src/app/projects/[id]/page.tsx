import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, sourceUploads, generationRuns, extractedOutlines, generatedBooks } from "@/db/schema";
import { RunStatusView } from "./RunStatusView";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) notFound();

  const upload = await db.query.sourceUploads.findFirst({
    where: eq(sourceUploads.projectId, id),
    orderBy: [desc(sourceUploads.createdAt)],
  });

  const run = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.projectId, id),
    orderBy: [desc(generationRuns.createdAt)],
  });

  const outline = run
    ? (await db.query.extractedOutlines.findFirst({ where: eq(extractedOutlines.runId, run.id) })) ?? null
    : null;

  const books = run
    ? await db.query.generatedBooks.findMany({ where: eq(generatedBooks.runId, run.id) })
    : [];

  return (
    <RunStatusView
      projectId={project.id}
      initial={{
        project: { id: project.id, name: project.name, level: project.level },
        upload: upload ? { filename: upload.filename, bookType: upload.bookType } : null,
        run: run
          ? {
              id: run.id,
              status: run.status,
              currentStage: run.currentStage,
              errorMessage: run.errorMessage,
              updatedAt: run.updatedAt.toISOString(),
            }
          : null,
        outline: outline ? { outline: outline.outline } : null,
        books: books.map((b) => ({
          id: b.id,
          bookType: b.bookType,
          markdown: b.markdown,
          pdfBlobUrl: b.pdfBlobUrl,
        })),
      }}
    />
  );
}
