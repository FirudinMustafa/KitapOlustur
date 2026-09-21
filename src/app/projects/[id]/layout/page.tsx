import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, generationRuns, generatedBooks } from "@/db/schema";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import { LayoutEditor } from "./LayoutEditor";

export const dynamic = "force-dynamic";

// Faz "Sayfa Dizilimi Editörü": editing surface for an already-completed
// book (status='done') - not a step in the generation pipeline itself. Same
// 404-not-403 server-component auth pattern as read/[bookType]/page.tsx.
export default async function LayoutEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { userId } = await auth();
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
        <h1 className="text-2xl font-semibold text-foreground">Sayfa Düzeni</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sayfa dizilimini düzenlemek için önce bu projede tamamlanmış (durum: &quot;Tamamlandı&quot;) bir kitap
          olması gerekiyor.
        </p>
      </div>
    );
  }

  const book = await db.query.generatedBooks.findFirst({
    where: eq(generatedBooks.runId, run.id),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  if (!book || !book.content) notFound();

  return (
    <LayoutEditor
      projectId={id}
      bookTitle={project.name}
      initialUnits={book.content as GeneratedUnit[]}
      pageImages={(run.pageImageUrls as Record<number, string> | null) ?? {}}
    />
  );
}
