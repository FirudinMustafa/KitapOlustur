import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { generationRuns, generatedBooks, extractedOutlines } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth";
import { hasActiveRun, latestDoneRun } from "@/lib/project-runs";
import { renumberRealUnits } from "@/lib/arrangement-merge";
import { generatedUnitSchema, type GeneratedUnit, type BookOutline } from "@/lib/ai/schemas";
import { isOwnBlobUrl } from "@/lib/blob-url";

const patchBodySchema = z.object({
  units: z.array(generatedUnitSchema),
  // Faz C2 ("kullanıcının kendi görselini ekleyebilmesi", 2026-09-28):
  // optional partial update to generationRuns.pageImageUrls, keyed by
  // sourcePageNumber - same "Record<number,string>" shape the pipeline's own
  // generateUnitImages step already writes to. Merged (not replaced) into
  // the run's existing pageImageUrls so uploading one page's image never
  // drops every other page's AI-generated image.
  // Page images are fetched server-side when PDFs are rendered - only this
  // app's own Blob uploads are accepted (see isOwnBlobUrl).
  pageImages: z.record(z.string(), z.string().refine(isOwnBlobUrl)).optional(),
});

// "Dizilim" (2026-09-21, ROADMAP.md): GET/PATCH follow the exact same
// "latest done run, all generatedBooks rows share one content blob" pattern
// as src/app/api/projects/[id]/books/layout/route.ts - see that file for the
// original rationale. The one addition here is the outline: renumbering
// units needs outline.units kept in lockstep (see arrangement-merge.ts's
// renumberRealUnits doc comment) so buildContentsUnits/reviewBookCoherence's
// `outline.units.find(ou => ou.number === u.unitNumber)` lookups stay
// correct after a reorder.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;

  const ownerCheck = await requireProjectOwner(projectId);
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const run = await latestDoneRun(projectId);
  if (!run || run.status !== "done") {
    return NextResponse.json({ error: "Bu proje için tamamlanmış bir kitap yok" }, { status: 404 });
  }

  const book = await db.query.generatedBooks.findFirst({
    where: eq(generatedBooks.runId, run.id),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  if (!book) {
    return NextResponse.json({ error: "Bu proje için tamamlanmış bir kitap yok" }, { status: 404 });
  }

  const outlineRow = await db.query.extractedOutlines.findFirst({ where: eq(extractedOutlines.runId, run.id) });
  const outline = outlineRow ? (outlineRow.outline as { outline: BookOutline }).outline : null;

  return NextResponse.json({
    runId: run.id,
    units: book.content as GeneratedUnit[],
    pageImages: run.pageImageUrls ?? {},
    bookTitle: outline?.bookTitle ?? "",
    level: outline?.level ?? "",
  });
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

  const runBooks = await db.query.generatedBooks.findMany({ where: eq(generatedBooks.runId, run.id) });
  if (!runBooks.length) {
    return NextResponse.json({ error: "Bu proje için tamamlanmış bir kitap yok" }, { status: 404 });
  }

  const outlineRow = await db.query.extractedOutlines.findFirst({ where: eq(extractedOutlines.runId, run.id) });
  if (!outlineRow) {
    return NextResponse.json({ error: "Bu proje için dizelge bulunamadı" }, { status: 404 });
  }
  const outlineWrapper = outlineRow.outline as { outline: BookOutline; improvementPlan?: unknown };

  const { units: renumberedUnits, outlineUnits: renumberedOutlineUnits } = renumberRealUnits(
    body.data.units,
    outlineWrapper.outline.units,
  );

  // Aynı içeriğin kopyasını taşıyan her generatedBooks satırı birlikte
  // güncellenir (books/layout/route.ts'teki gibi), aksi halde birbirinden
  // sapmış (inconsistent) hale gelirler.
  await db.update(generatedBooks).set({ content: renumberedUnits }).where(eq(generatedBooks.runId, run.id));
  await db
    .update(extractedOutlines)
    .set({ outline: { ...outlineWrapper, outline: { ...outlineWrapper.outline, units: renumberedOutlineUnits } } })
    .where(eq(extractedOutlines.id, outlineRow.id));

  let pageImages = (run.pageImageUrls as Record<string, string> | null) ?? {};
  if (body.data.pageImages) {
    pageImages = { ...pageImages, ...body.data.pageImages };
    await db.update(generationRuns).set({ pageImageUrls: pageImages }).where(eq(generationRuns.id, run.id));
  }

  return NextResponse.json({ ok: true, units: renumberedUnits, pageImages });
}
