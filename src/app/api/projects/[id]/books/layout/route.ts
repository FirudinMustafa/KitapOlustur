import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { generatedBooks } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { hasActiveRun, latestDoneRun } from "@/lib/project-runs";
import { mergePageLayout, type PageArrayField } from "@/lib/layout-merge";
import { contentBlockSchema, blockLayoutSchema, type GeneratedUnit } from "@/lib/ai/schemas";

const PAGE_ARRAY_FIELDS = ["studentBookPages", "workbookPages", "teacherBookPages", "testBookletPages"] as const;

const patchBodySchema = z.object({
  unitNumber: z.number().int(),
  pageArrayField: z.enum(PAGE_ARRAY_FIELDS),
  pageIndex: z.number().int().min(0),
  blocks: z.array(contentBlockSchema),
  imageLayout: blockLayoutSchema.optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;

  const ownerCheck = await requireProjectOwner(projectId);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const run = await latestDoneRun(projectId);
  if (!run || run.status !== "done") {
    return NextResponse.json({ error: "Bu proje için tamamlanmış bir kitap yok" }, { status: 404 });
  }

  // Faz "Sayfa Dizilimi Editörü": bir run'ın TÜM generatedBooks satırları
  // (student_book/workbook/...) aynı GeneratedUnit[] içeriğinin birer
  // kopyasını taşıyor (assembleAndSaveBooks hepsine aynı `units`'i yazıyor) -
  // hangisini okuduğumuz önemsiz, en son eklenen yeterli.
  const book = await db.query.generatedBooks.findFirst({
    where: eq(generatedBooks.runId, run.id),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  if (!book) {
    return NextResponse.json({ error: "Bu proje için tamamlanmış bir kitap yok" }, { status: 404 });
  }

  return NextResponse.json({ runId: run.id, units: book.content as GeneratedUnit[] });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;

  const ownerCheck = await requireProjectOwner(projectId);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  if (await hasActiveRun(projectId)) {
    return NextResponse.json(
      { error: "Bu projede devam eden bir üretim var - bitince dizilimi kaydedebilirsin." },
      { status: 409 },
    );
  }

  const run = await latestDoneRun(projectId);
  if (!run || run.status !== "done") {
    return NextResponse.json({ error: "Bu proje için tamamlanmış bir kitap yok" }, { status: 404 });
  }

  const body = patchBodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }
  const { unitNumber, pageArrayField, pageIndex, blocks, imageLayout } = body.data;

  const runBooks = await db.query.generatedBooks.findMany({ where: eq(generatedBooks.runId, run.id) });
  if (!runBooks.length) {
    return NextResponse.json({ error: "Bu proje için tamamlanmış bir kitap yok" }, { status: 404 });
  }

  let updatedUnits: GeneratedUnit[];
  try {
    updatedUnits = mergePageLayout(
      runBooks[0].content as GeneratedUnit[],
      unitNumber,
      pageArrayField as PageArrayField,
      pageIndex,
      blocks,
      imageLayout,
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Düzen kaydedilemedi" }, { status: 400 });
  }

  // Her satır aynı içeriğin kopyasını taşıdığı için hepsi birlikte
  // güncellenir - sadece birini güncelleyip diğerlerini eski bırakmak onları
  // birbirinden sapmış (inconsistent) hale getirir.
  await db.update(generatedBooks).set({ content: updatedUnits }).where(eq(generatedBooks.runId, run.id));

  return NextResponse.json({ ok: true });
}
