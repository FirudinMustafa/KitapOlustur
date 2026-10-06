import { notFound } from "next/navigation";
import { isUuid } from "@/lib/uuid";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, generationRuns, generatedBooks, extractedOutlines } from "@/db/schema";
import type { GeneratedUnit, BookOutline } from "@/lib/ai/schemas";
import { ArrangementEditor } from "./ArrangementEditor";

export const dynamic = "force-dynamic";

// "Dizilim" (2026-09-21, ROADMAP.md): editing surface for an already-
// completed book (status='done') - not a step in the generation pipeline
// itself, same 404-not-403 server-component auth pattern as
// layout/page.tsx. Distinct from that page: this one reorders whole units/
// pages relative to each other, that one positions blocks within one page.
export default async function ArrangementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { userId } = await auth();
  if (!isUuid(id)) notFound();
  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project || !userId || project.ownerId !== userId) {
    notFound();
  }

  const run = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.projectId, id),
    orderBy: [desc(generationRuns.createdAt)],
  });
  if (!run || run.status !== "done") {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-foreground">Dizilim</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ünite/sayfa dizilimini düzenlemek için önce bu projede tamamlanmış (durum: &quot;Tamamlandı&quot;) bir
          kitap olması gerekiyor.
        </p>
      </div>
    );
  }

  const book = await db.query.generatedBooks.findFirst({
    where: eq(generatedBooks.runId, run.id),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  if (!book || !book.content) notFound();

  const outlineRow = await db.query.extractedOutlines.findFirst({ where: eq(extractedOutlines.runId, run.id) });
  const outline = outlineRow ? (outlineRow.outline as { outline: BookOutline }).outline : null;

  return (
    <ArrangementEditor
      projectId={id}
      bookTitle={project.name}
      level={outline?.level ?? ""}
      initialUnits={book.content as GeneratedUnit[]}
      pageImages={(run.pageImageUrls as Record<number, string> | null) ?? {}}
    />
  );
}
