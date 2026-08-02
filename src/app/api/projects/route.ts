import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { start } from "workflow/api";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, sourceUploads, generationRuns } from "@/db/schema";
import { bookPipelineWorkflow } from "@workflows/book-pipeline";

export async function GET() {
  const rows = await db.query.projects.findMany({
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
  const formData = await request.formData();

  const name = formData.get("name");
  const level = formData.get("level");
  const customNotes = formData.get("customNotes");
  const bookType = formData.get("bookType");
  const niceToHaveIdsRaw = formData.get("niceToHaveIds");
  const unitLimitRaw = formData.get("unitLimit");
  const file = formData.get("file");

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Proje adı gerekli" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF dosyası gerekli" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Sadece PDF dosyaları desteklenir" }, { status: 400 });
  }
  if (bookType !== "student_book" && bookType !== "workbook") {
    return NextResponse.json({ error: "Geçersiz kitap tipi" }, { status: 400 });
  }

  let niceToHaveIds: string[] = [];
  if (typeof niceToHaveIdsRaw === "string" && niceToHaveIdsRaw.length) {
    try {
      const parsed = JSON.parse(niceToHaveIdsRaw);
      if (Array.isArray(parsed)) niceToHaveIds = parsed.filter((x) => typeof x === "string");
    } catch {
      return NextResponse.json({ error: "Geçersiz nice-to-have seçimi" }, { status: 400 });
    }
  }

  let unitLimit: number | null = null;
  if (typeof unitLimitRaw === "string" && unitLimitRaw.trim()) {
    const parsed = Number(unitLimitRaw);
    if (Number.isInteger(parsed) && parsed > 0) unitLimit = parsed;
  }

  const [project] = await db
    .insert(projects)
    .values({ name: name.trim(), level: typeof level === "string" && level.trim() ? level.trim() : null })
    .returning();

  const blob = await put(`sources/${project.id}/${file.name}`, file, {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: false,
  });

  await db.insert(sourceUploads).values({
    projectId: project.id,
    blobUrl: blob.url,
    filename: file.name,
    bookType,
  });

  const [run] = await db
    .insert(generationRuns)
    .values({
      projectId: project.id,
      status: "pending",
      selectedNiceToHaveIds: niceToHaveIds,
      customNotes: typeof customNotes === "string" && customNotes.trim() ? customNotes.trim() : null,
      unitLimit,
    })
    .returning();

  const workflowRun = await start(bookPipelineWorkflow, [run.id]);

  await db
    .update(generationRuns)
    .set({ workflowRunId: workflowRun.runId })
    .where(eq(generationRuns.id, run.id));

  return NextResponse.json({ projectId: project.id, runId: run.id });
}
