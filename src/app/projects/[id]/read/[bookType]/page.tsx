import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, generationRuns, generatedBooks, type BookType } from "@/db/schema";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import type { Variant } from "@/lib/pdf/BookDocument";
import { BookReader } from "./BookReader";

export const dynamic = "force-dynamic";

const VALID_BOOK_TYPES: BookType[] = ["student_book", "workbook", "teacher_book", "test_booklet"];

// Faz H2 (see ROADMAP.md): a static interactive web viewer for content
// that's already fully generated - reads generatedBooks.content (the exact
// GeneratedUnit[] snapshot BookDocument.tsx renders to PDF from) and
// renders it as a real, screen-reader-friendly, click-to-reveal web page
// instead of a flat document. No new AI calls, no schema change: this is
// purely a second rendering of data the pipeline already produces.
export default async function BookReaderPage({
  params,
}: {
  params: Promise<{ id: string; bookType: string }>;
}) {
  const { id, bookType } = await params;

  // Same 404-not-403 reasoning as requireProjectOwner (src/lib/auth.ts) -
  // kept in sync manually since this is a server component, not an API
  // route, matching the existing pattern in src/app/projects/[id]/page.tsx.
  const { userId } = await auth();
  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project || !userId || project.ownerId !== userId) {
    notFound();
  }

  if (!VALID_BOOK_TYPES.includes(bookType as BookType)) {
    notFound();
  }
  const variant = bookType as Variant;

  const run = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.projectId, id),
    orderBy: [desc(generationRuns.createdAt)],
  });
  if (!run) notFound();

  const book = await db.query.generatedBooks.findFirst({
    where: and(eq(generatedBooks.runId, run.id), eq(generatedBooks.bookType, variant)),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  if (!book || !book.content) notFound();

  return (
    <BookReader
      bookTitle={project.name}
      level={project.level}
      variant={variant}
      units={book.content as GeneratedUnit[]}
      coverImageSrc={run.coverImageUrl}
      pageImages={(run.pageImageUrls as Record<number, string> | null) ?? {}}
      logoUrl={run.userLogoUrl}
      logoPosition={run.logoPosition}
      paletteColors={(run.paletteColors as string[] | null) ?? undefined}
    />
  );
}
