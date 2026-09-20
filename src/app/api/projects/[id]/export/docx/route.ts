import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { put } from "@vercel/blob";

import { db } from "@/db/client";
import { projects, generationRuns, generatedBooks, type BookType } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { buildDocx } from "@/lib/docx/BookDocx";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import type { Variant } from "@/lib/pdf/BookDocument";

const VALID_BOOK_TYPES: BookType[] = ["student_book", "workbook", "teacher_book", "test_booklet"];

// DOCX export (see ROADMAP.md's project-wide assessment, 2026-09-20: "tek
// çıktı formatı PDF/EPUB/LMS, editörün elle düzenleyebileceği bir format
// yok"). Built on-demand rather than at pipeline-assembly time - same
// reasoning as export/common-cartridge/route.ts (a less common action than
// downloading the book itself, no reason to pay the packaging cost on every
// run). No contents table (the on-demand route doesn't have the outline
// handy, matching Common Cartridge's same simplification).
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const ownerCheck = await requireProjectOwner(id);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const bookType = new URL(request.url).searchParams.get("bookType");
  if (!bookType || !VALID_BOOK_TYPES.includes(bookType as BookType)) {
    return NextResponse.json({ error: "Geçersiz kitap tipi" }, { status: 400 });
  }
  const variant = bookType as Variant;

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  const run = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.projectId, id),
    orderBy: [desc(generationRuns.createdAt)],
  });
  if (!run) {
    return NextResponse.json({ error: "Bu proje için tamamlanmış bir üretim bulunamadı" }, { status: 404 });
  }

  const book = await db.query.generatedBooks.findFirst({
    where: and(eq(generatedBooks.runId, run.id), eq(generatedBooks.bookType, variant)),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  if (!book?.content) {
    return NextResponse.json({ error: "Bu kitap tipi için üretilmiş içerik bulunamadı" }, { status: 404 });
  }

  const docx = await buildDocx({
    bookTitle: project.name,
    variant,
    units: book.content as GeneratedUnit[],
    level: project.level ?? "",
    contentsUnits: [],
    pageImages: (run.pageImageUrls as Record<number, string> | null) ?? undefined,
  });

  const blob = await put(`generated/${run.id}/${variant}.docx`, docx, {
    access: "public",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return NextResponse.redirect(blob.url);
}
