import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { start } from "workflow/api";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, sourceUploads, generationRuns } from "@/db/schema";
import { bookPipelineWorkflow } from "@workflows/book-pipeline";

const VALID_BOOK_TYPES = ["student_book", "workbook", "teacher_book", "test_booklet"];

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 });
  }

  const rows = await db.query.projects.findMany({
    where: eq(projects.ownerId, userId),
    orderBy: [desc(projects.createdAt)],
  });

  const withRuns = await Promise.all(
    rows.map(async (project) => {
      const latestRun = await db.query.generationRuns.findFirst({
        where: eq(generationRuns.projectId, project.id),
        orderBy: [desc(generationRuns.createdAt)],
      });
      return { ...project, latestRun: latestRun ?? null };
    }),
  );

  return NextResponse.json({ projects: withRuns });
}

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
    name,
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
    blobUrl,
    filename,
  } = body;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Proje adı gerekli" }, { status: 400 });
  }
  if (typeof blobUrl !== "string" || !blobUrl || typeof filename !== "string" || !filename) {
    return NextResponse.json({ error: "PDF dosyası gerekli" }, { status: 400 });
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

  const styleProfileId = typeof styleProfileIdRaw === "string" && styleProfileIdRaw ? styleProfileIdRaw : null;
  const qualityMode = qualityModeRaw === "draft" ? "draft" : "final";
  const targetLanguage =
    typeof targetLanguageRaw === "string" && targetLanguageRaw.trim() ? targetLanguageRaw.trim() : null;

  const [project] = await db
    .insert(projects)
    .values({
      name: name.trim(),
      level: typeof level === "string" && level.trim() ? level.trim() : null,
      ownerId: userId,
    })
    .returning();

  await db.insert(sourceUploads).values({
    projectId: project.id,
    blobUrl,
    filename,
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
      customNotes: typeof customNotes === "string" && customNotes.trim() ? customNotes.trim() : null,
      unitLimit,
      requestedBookTypes,
      variantCount,
    })
    .returning();

  const workflowRun = await start(bookPipelineWorkflow, [run.id]);

  await db
    .update(generationRuns)
    .set({ workflowRunId: workflowRun.runId })
    .where(eq(generationRuns.id, run.id));

  return NextResponse.json({ projectId: project.id, runId: run.id });
}
