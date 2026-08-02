import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { sourceUploads, generationRuns } from "@/db/schema";
import { bookPipelineWorkflow } from "@workflows/book-pipeline";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;

  const upload = await db.query.sourceUploads.findFirst({
    where: eq(sourceUploads.projectId, projectId),
    orderBy: [desc(sourceUploads.createdAt)],
  });
  if (!upload) {
    return NextResponse.json({ error: "Bu proje için kaynak PDF bulunamadı" }, { status: 404 });
  }

  const previousRun = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.projectId, projectId),
    orderBy: [desc(generationRuns.createdAt)],
  });

  const body = await request.json().catch(() => ({}));
  const unitLimit = Number.isInteger(body?.unitLimit) && body.unitLimit > 0 ? body.unitLimit : null;

  const [run] = await db
    .insert(generationRuns)
    .values({
      projectId,
      status: "pending",
      selectedNiceToHaveIds: previousRun?.selectedNiceToHaveIds ?? [],
      customNotes: previousRun?.customNotes ?? null,
      unitLimit,
      requestedBookTypes: previousRun?.requestedBookTypes ?? ["student_book", "workbook"],
      variantCount: previousRun?.variantCount ?? 2,
    })
    .returning();

  const workflowRun = await start(bookPipelineWorkflow, [run.id]);

  await db
    .update(generationRuns)
    .set({ workflowRunId: workflowRun.runId })
    .where(eq(generationRuns.id, run.id));

  return NextResponse.json({ runId: run.id });
}
