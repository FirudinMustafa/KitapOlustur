import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { put } from "@vercel/blob";

import { db } from "@/db/client";
import { projects, generationRuns, generatedBooks, type BookType } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { buildCommonCartridge } from "@/lib/lms-export/CommonCartridge";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import type { Variant } from "@/lib/pdf/BookDocument";

const VALID_BOOK_TYPES: BookType[] = ["student_book", "workbook", "teacher_book", "test_booklet"];

// Faz H3 (see ROADMAP.md): built on-demand rather than at pipeline-assembly
// time like PDF/EPUB - LMS export is a less common action than downloading
// the book itself, so there's no reason to pay the packaging cost (and
// image re-fetches) on every run for a feature most runs may never use.
// Redirects straight to the uploaded Blob, matching the existing "PDF
// indir"/"EPUB indir" plain-link download UX (see RunStatusView.tsx) - no
// client-side JS needed to trigger the download.
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

  const cartridge = await buildCommonCartridge({
    bookTitle: project.name,
    variant,
    units: book.content as GeneratedUnit[],
    level: project.level ?? "",
    pageImages: (run.pageImageUrls as Record<number, string> | null) ?? undefined,
  });

  const blob = await put(`generated/${run.id}/${variant}-common-cartridge.imscc`, cartridge, {
    access: "public",
    contentType: "application/zip",
    addRandomSuffix: false,
    // Unlike PDF/EPUB (written once per run, at assembly time), this is
    // built on every request to this route - a second click on "LMS paketi
    // indir" (or an accidental double-request, as caught live here) would
    // otherwise 500 on Vercel Blob's default overwrite protection.
    allowOverwrite: true,
  });

  return NextResponse.redirect(blob.url);
}
