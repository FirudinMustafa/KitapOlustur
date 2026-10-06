import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { start } from "workflow/api";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, sourceUploads, generationRuns } from "@/db/schema";
import { bookPipelineWorkflow } from "@workflows/book-pipeline";
import { TRIM_SIZES, type TrimSizeId } from "@/lib/pdf/page-geometry";
import { isOwnBlobUrl } from "@/lib/blob-url";

const VALID_BOOK_TYPES = ["student_book", "workbook", "teacher_book", "test_booklet"];

// Faz "Toplu/seri üretim" (2026-09-20, ROADMAP.md): "bu serinin 6 kitabını
// da aynı stille üret" gap - previously each book required a full separate
// trip through /projects/new. This creates several independent projects +
// runs from one submission, all sharing the same settings (style profile,
// quality mode, output types, etc.) - each one is still just a normal,
// independent generationRuns row/workflow run under the hood; nothing about
// the pipeline itself changes or knows about "batches". A batch is purely a
// creation-time convenience, not a new runtime concept.
const MAX_UNIT_LIMIT = 30;
const MAX_BATCH_ITEMS = 10;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const {
    items: itemsRaw,
    level,
    customNotes,
    bookType,
    niceToHaveIds: niceToHaveIdsRaw,
    requestedBookTypes: requestedBookTypesRaw,
    variantCount: variantCountRaw,
    unitLimit: unitLimitRaw,
    styleProfileId: styleProfileIdRaw,
    qualityMode: qualityModeRaw,
    targetLanguage: targetLanguageRaw,
    unitSkeleton: unitSkeletonRaw,
    spacedRepetition: spacedRepetitionRaw,
    trimSize: trimSizeRaw,
  } = body;

  if (!Array.isArray(itemsRaw) || itemsRaw.length < 2) {
    return NextResponse.json({ error: "En az 2 dosya gerekli (tek dosya için normal yükleme akışını kullanın)" }, { status: 400 });
  }
  const items = itemsRaw.filter(
    (x): x is { name: string; blobUrl: string; filename: string } =>
      typeof x === "object" &&
      x !== null &&
      typeof x.name === "string" &&
      x.name.trim() &&
      typeof x.blobUrl === "string" &&
      isOwnBlobUrl(x.blobUrl) &&
      typeof x.filename === "string" &&
      x.filename,
  );
  // QA fix (2026-10-06): the batch route had neither the single route's
  // 30-unit cap nor any limit on how many books one request may start.
  if (itemsRaw.length > MAX_BATCH_ITEMS) {
    return NextResponse.json({ error: `Tek seferde en fazla ${MAX_BATCH_ITEMS} kitap başlatılabilir` }, { status: 400 });
  }
  if (Number.isInteger(unitLimitRaw) && unitLimitRaw > MAX_UNIT_LIMIT) {
    return NextResponse.json({ error: `Ünite sayısı en fazla ${MAX_UNIT_LIMIT} olabilir` }, { status: 400 });
  }
  if (items.length !== itemsRaw.length) {
    return NextResponse.json({ error: "Bazı dosyalar geçersiz (ad veya blob URL eksik)" }, { status: 400 });
  }
  if (bookType !== "student_book" && bookType !== "workbook") {
    return NextResponse.json({ error: "Geçersiz kitap tipi" }, { status: 400 });
  }

  let niceToHaveIds: string[] = [];
  if (Array.isArray(niceToHaveIdsRaw)) {
    niceToHaveIds = niceToHaveIdsRaw.filter((x): x is string => typeof x === "string");
  }

  let requestedBookTypes: string[] = ["student_book", "workbook"];
  if (Array.isArray(requestedBookTypesRaw)) {
    const filtered = requestedBookTypesRaw.filter(
      (x): x is string => typeof x === "string" && VALID_BOOK_TYPES.includes(x),
    );
    if (filtered.length) requestedBookTypes = filtered;
  }

  let unitLimit: number | null = null;
  if (Number.isInteger(unitLimitRaw) && unitLimitRaw > 0) {
    unitLimit = unitLimitRaw;
  }

  let variantCount = 1;
  if (Number.isInteger(variantCountRaw) && variantCountRaw >= 1 && variantCountRaw <= 4) {
    variantCount = variantCountRaw;
  }

  // Faz "Sabit Ünite İskeleti": shared across the whole batch, same as every
  // other setting on this form.
  let unitSkeleton: string[] | null = null;
  if (Array.isArray(unitSkeletonRaw)) {
    const filtered = unitSkeletonRaw
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim());
    if (filtered.length) unitSkeleton = filtered;
  }

  // Aralıklı Tekrar (Spaced Repetition) Sayfaları: shared across the whole
  // batch, same as every other setting on this form.
  const spacedRepetition = spacedRepetitionRaw === true;

  // Yapılandırılabilir Trim Size: shared across the whole batch - falls back
  // to "a4" (unchanged existing behavior) for anything missing/invalid.
  const trimSize: TrimSizeId =
    typeof trimSizeRaw === "string" && trimSizeRaw in TRIM_SIZES ? (trimSizeRaw as TrimSizeId) : "a4";

  const styleProfileId = typeof styleProfileIdRaw === "string" && styleProfileIdRaw ? styleProfileIdRaw : null;
  const qualityMode = qualityModeRaw === "draft" ? "draft" : "final";
  const targetLanguage =
    typeof targetLanguageRaw === "string" && targetLanguageRaw.trim() ? targetLanguageRaw.trim() : null;
  const sharedLevel = typeof level === "string" && level.trim() ? level.trim() : null;
  const sharedNotes = typeof customNotes === "string" && customNotes.trim() ? customNotes.trim() : null;

  const created: { projectId: string; runId: string }[] = [];

  for (const item of items) {
    const [project] = await db
      .insert(projects)
      .values({ name: item.name.trim(), level: sharedLevel, trimSize, ownerId: userId })
      .returning();

    await db.insert(sourceUploads).values({
      projectId: project.id,
      blobUrl: item.blobUrl,
      filename: item.filename,
      bookType,
    });

    const [run] = await db
      .insert(generationRuns)
      .values({
        projectId: project.id,
        status: "pending",
        selectedNiceToHaveIds: niceToHaveIds,
        styleProfileId,
        qualityMode,
        targetLanguage,
        customNotes: sharedNotes,
        unitLimit,
        requestedBookTypes,
        variantCount,
        unitSkeleton,
        spacedRepetition,
      })
      .returning();

    const workflowRun = await start(bookPipelineWorkflow, [run.id]);
    await db.update(generationRuns).set({ workflowRunId: workflowRun.runId }).where(eq(generationRuns.id, run.id));

    created.push({ projectId: project.id, runId: run.id });
  }

  return NextResponse.json({ created });
}
