import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { sourceUploads, generationRuns, extractedOutlines } from "@/db/schema";
import { bookPipelineWorkflow } from "@workflows/book-pipeline";
import { requireProjectOwner } from "@/lib/auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;

  const ownerCheck = await requireProjectOwner(projectId);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

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

  // Never start a second run while one is still working or waiting on an
  // approval - both would write to the same project concurrently (QA fix,
  // 2026-10-06).
  if (previousRun && !["done", "failed", "changes_requested"].includes(previousRun.status)) {
    return NextResponse.json(
      { error: "Bu projede devam eden bir üretim var - bitmesini ya da onay adımını bekle." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  // "Sıfırdan Kitap" modu: unitLimit doubles as "how many units" for a
  // from-scratch run - falling back to the previous run's value (instead of
  // always null when the caller doesn't pass one explicitly) so rerunning a
  // scratch project doesn't silently regenerate with DEFAULT_SCRATCH_UNIT_COUNT
  // units instead of the count the user originally chose.
  const unitLimit =
    Number.isInteger(body?.unitLimit) && body.unitLimit > 0 ? body.unitLimit : (previousRun?.unitLimit ?? null);

  const bookTypes: string[] | null =
    Array.isArray(body?.bookTypes) && body.bookTypes.every((t: unknown) => typeof t === "string")
      ? body.bookTypes
      : null;

  // "Assemble-only" rerun: reuse the previous run's already-generated units
  // and images, just rebuild PDFs for the requested book types - no AI calls.
  // QA fix (2026-10-06): the source is the newest *finished run that still
  // has its outline*, not blindly the latest run - assemble runs created
  // before copyForwardRunReports existed have no outline, so chaining a
  // second assembly off one always failed ("No outline found"), and a
  // failed assembly as the latest run blocked further assemblies entirely.
  const assembleSource = bookTypes ? await latestAssemblableRun(projectId) : null;
  if (bookTypes && !assembleSource) {
    // Never fall through to a full (paid, AI) rerun when the caller asked
    // for an AI-free assembly.
    return NextResponse.json(
      { error: "Derlenebilecek tamamlanmış bir üretim bulunamadı - önce projeyi yeniden çalıştır." },
      { status: 409 },
    );
  }
  if (bookTypes && assembleSource) {
    const [assembleRun] = await db
      .insert(generationRuns)
      .values({
        projectId,
        status: "pending",
        selectedNiceToHaveIds: assembleSource.selectedNiceToHaveIds,
        styleProfileId: assembleSource.styleProfileId,
        qualityMode: assembleSource.qualityMode,
        targetLanguage: assembleSource.targetLanguage,
        customNotes: assembleSource.customNotes,
        unitLimit: assembleSource.unitLimit,
        // QA fix (2026-10-06): the project page only shows the latest run's
        // books, so assembling just the newly ticked types made every
        // previously built book vanish from it (e.g. adding a Workbook hid
        // the Student Book). Assembly is AI-free, so the new run rebuilds the
        // union of what the project already had and what was just requested.
        requestedBookTypes: Array.from(new Set([...(assembleSource.requestedBookTypes ?? []), ...bookTypes])),
        variantCount: assembleSource.variantCount,
      })
      .returning();

    const workflowRun = await start(bookPipelineWorkflow, [
      assembleRun.id,
      { mode: "assemble", sourceRunId: assembleSource.id },
    ]);

    await db
      .update(generationRuns)
      .set({ workflowRunId: workflowRun.runId })
      .where(eq(generationRuns.id, assembleRun.id));

    return NextResponse.json({ runId: assembleRun.id });
  }

  const [run] = await db
    .insert(generationRuns)
    .values({
      projectId,
      status: "pending",
      selectedNiceToHaveIds: previousRun?.selectedNiceToHaveIds ?? [],
      styleProfileId: previousRun?.styleProfileId ?? null,
      qualityMode: previousRun?.qualityMode ?? "final",
      targetLanguage: previousRun?.targetLanguage ?? null,
      customNotes: previousRun?.customNotes ?? null,
      unitLimit,
      requestedBookTypes: previousRun?.requestedBookTypes ?? ["student_book", "workbook"],
      variantCount: previousRun?.variantCount ?? 2,
      isFromScratch: previousRun?.isFromScratch ?? false,
      scratchBrief: previousRun?.scratchBrief ?? null,
      // Denetim sonrası düzeltme (2026-09-23): bu ikisi hiç kopyalanmıyordu,
      // her rerun'da sessizce sütun varsayılanına (null/false) düşüyordu -
      // bir "Sıfırdan Kitap" kullanıcısının özel ünite iskeletini rerun'da
      // kaybetmesine yol açıyordu.
      unitSkeleton: previousRun?.unitSkeleton ?? null,
      spacedRepetition: previousRun?.spacedRepetition ?? false,
    })
    .returning();

  // "Yeniden çalıştır maliyeti": reuse the previous run's already-persisted
  // extraction results (pageMap/outline/improvementPlan) instead of always
  // re-paying for them - see copyForwardExtraction in book-pipeline.tsx.
  // Always safe to pass: if the previous run never got that far, it's a
  // no-op and this behaves exactly like a plain full restart.
  const workflowRun = await start(
    bookPipelineWorkflow,
    previousRun ? [run.id, { mode: "full", resumeFromRunId: previousRun.id }] : [run.id],
  );

  await db
    .update(generationRuns)
    .set({ workflowRunId: workflowRun.runId })
    .where(eq(generationRuns.id, run.id));

  return NextResponse.json({ runId: run.id });
}

async function latestAssemblableRun(projectId: string) {
  const doneRuns = await db.query.generationRuns.findMany({
    where: and(eq(generationRuns.projectId, projectId), eq(generationRuns.status, "done")),
    orderBy: [desc(generationRuns.createdAt)],
  });
  for (const run of doneRuns) {
    const outline = await db.query.extractedOutlines.findFirst({
      where: eq(extractedOutlines.runId, run.id),
      columns: { id: true },
    });
    if (outline) return run;
  }
  return null;
}
