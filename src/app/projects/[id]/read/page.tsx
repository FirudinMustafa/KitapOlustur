import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, generatedBooks } from "@/db/schema";
import { isUuid } from "@/lib/uuid";
import { latestDoneRun } from "@/lib/project-runs";

const READ_ORDER = ["student_book", "workbook", "teacher_book", "test_booklet"];

// "Oku" entry point (sidebar link): the sidebar can't know which book types a
// project has, and hardcoding /read/student_book 404'd for workbook-only
// projects - this picks the first book type the latest finished run built.
export default async function ReadIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!isUuid(id)) notFound();
  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project || !userId || project.ownerId !== userId) notFound();

  const run = await latestDoneRun(id);
  const books = run ? await db.query.generatedBooks.findMany({ where: eq(generatedBooks.runId, run.id) }) : [];
  const first = READ_ORDER.find((t) => books.some((b) => b.bookType === t && b.content));
  if (!first) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="font-heading text-2xl font-medium text-foreground">Oku</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bu projede henüz tamamlanmış bir kitap yok. Üretim bitince burada okuyabilirsin.
        </p>
      </div>
    );
  }
  redirect(`/projects/${id}/read/${first}`);
}
