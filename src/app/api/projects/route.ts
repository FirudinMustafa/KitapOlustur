import { NextResponse } from "next/server";
import { isDesignThemeId } from "@/lib/design/themes";
import { isArtStyleId } from "@/lib/ai/art-styles";
import { auth } from "@clerk/nextjs/server";
import { start } from "workflow/api";
import { START_FAILED_MESSAGE, launchRun } from "@/lib/start-run";

import { db } from "@/db/client";
import { projects, sourceUploads, generationRuns } from "@/db/schema";
import { bookPipelineWorkflow } from "@workflows/book-pipeline";
import { isValidIsbn13, normalizeIsbn } from "@/lib/isbn";
import { isTrimSizeChoice, type TrimSizeChoice } from "@/lib/pdf/page-geometry";
import { isOwnBlobUrl } from "@/lib/blob-url";
import { listProjectsWithLatestRun } from "@/lib/project-list";

const VALID_BOOK_TYPES = ["student_book", "workbook", "teacher_book", "test_booklet"];
// Denetim sonrası düzeltme (2026-09-23): variantCount'un 1-4 kelepçelemesiyle
// aynı gerekçe - "Sıfırdan Kitap" modunda gerçek bir kaynak PDF (dolayısıyla
// doğal bir üst sınır) yok, bir yazım hatası onlarca gerçek AI üretim
// çağrısını tetikleyebilir. Normal (PDF) modda da aynı sınır uygulanıyor,
// tutarlılık için.
const MAX_UNIT_LIMIT = 30;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 });
  }

  const rows = await listProjectsWithLatestRun(userId);
  return NextResponse.json({ projects: rows.map(({ project, latestRun }) => ({ ...project, latestRun })) });
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
    designTheme: designThemeRaw,
    artStyle: artStyleRaw,
    referencePageUrls: referencePageUrlsRaw,
    pictureBookPageCount: pictureBookPageCountRaw,
    targetLanguage: targetLanguageRaw,
    unitSkeleton: unitSkeletonRaw,
    spacedRepetition: spacedRepetitionRaw,
    trimSize: trimSizeRaw,
    blobUrl,
    filename,
    isbn: isbnRaw,
    mode: modeRaw,
    brief: briefRaw,
  } = body;

  // "Sıfırdan Kitap" modu (2026-09-22): the same request shape as normal
  // (PDF-upload) project creation, just without blobUrl/filename - the
  // pipeline invents an outline instead of extracting one (see
  // generateOutlineFromBrief in workflows/book-pipeline.tsx). unitLimit
  // doubles as "how many units to generate" in this mode, so it's required
  // here instead of optional.
  // Faz 6 "Resimli hikâye kitabı": a from-scratch run that writes one
  // illustrated story (a single unit) instead of a coursebook.
  const isPictureBook = modeRaw === "picturebook";
  const isFromScratch = modeRaw === "scratch" || isPictureBook;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Proje adı gerekli" }, { status: 400 });
  }
  if (!isFromScratch && (typeof blobUrl !== "string" || !blobUrl || typeof filename !== "string" || !filename)) {
    return NextResponse.json({ error: "PDF dosyası gerekli" }, { status: 400 });
  }
  // The pipeline downloads this URL server-side - only accept uploads that
  // went through this app's own Blob store (QA fix, 2026-10-06).
  if (!isFromScratch && !isOwnBlobUrl(blobUrl)) {
    return NextResponse.json({ error: "Geçersiz PDF adresi" }, { status: 400 });
  }
  if (isFromScratch && !isPictureBook && (!Number.isInteger(unitLimitRaw) || unitLimitRaw <= 0)) {
    return NextResponse.json({ error: "Ünite sayısı gerekli" }, { status: 400 });
  }
  if (Number.isInteger(unitLimitRaw) && unitLimitRaw > MAX_UNIT_LIMIT) {
    return NextResponse.json({ error: `Ünite sayısı en fazla ${MAX_UNIT_LIMIT} olabilir` }, { status: 400 });
  }
  if (bookType !== "student_book" && bookType !== "workbook") {
    return NextResponse.json({ error: "Geçersiz kitap tipi" }, { status: 400 });
  }
  let isbn: string | null = null;
  if (typeof isbnRaw === "string" && isbnRaw.trim()) {
    if (!isValidIsbn13(isbnRaw)) {
      return NextResponse.json({ error: "Geçersiz ISBN-13 (sağlama toplamı tutmuyor)" }, { status: 400 });
    }
    isbn = normalizeIsbn(isbnRaw);
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

  // Faz "Sabit Ünite İskeleti": opt-in, user-defined section order - omitted
  // entirely (null) means the existing mirror-based generation, unchanged
  // default for every project unless the user explicitly fills this in.
  let unitSkeleton: string[] | null = null;
  if (Array.isArray(unitSkeletonRaw)) {
    const filtered = unitSkeletonRaw
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim());
    if (filtered.length) unitSkeleton = filtered;
  }

  // Aralıklı Tekrar (Spaced Repetition) Sayfaları: opt-in, default false -
  // unchanged behavior for every project unless explicitly checked.
  const spacedRepetition = spacedRepetitionRaw === true;

  // Yapılandırılabilir Trim Size: falls back to "a4" (unchanged existing
  // behavior) for anything missing/invalid - chosen once at project
  // creation, no edit-after-creation UI.
  const trimSize: TrimSizeChoice = isTrimSizeChoice(trimSizeRaw) ? trimSizeRaw : "a4";

  const styleProfileId = typeof styleProfileIdRaw === "string" && styleProfileIdRaw ? styleProfileIdRaw : null;
  const qualityMode = qualityModeRaw === "draft" ? "draft" : "final";
  // Faz 1 "Tasarım sistemi": unknown/absent ids store null (= classic).
  const designTheme = isDesignThemeId(designThemeRaw) ? designThemeRaw : isPictureBook ? "storybook" : null;
  // Faz 2 "İllüstrasyon stili": unknown/absent ids store null (= textbook).
  const artStyle = isArtStyleId(artStyleRaw) ? artStyleRaw : null;
  // Faz 3: sample pages of a published book to grade the design against -
  // only this app's own Blob uploads (they're fetched server-side).
  const referencePageUrls = Array.isArray(referencePageUrlsRaw)
    ? referencePageUrlsRaw.filter((u: unknown): u is string => typeof u === "string" && isOwnBlobUrl(u)).slice(0, 5)
    : [];
  const targetLanguage =
    typeof targetLanguageRaw === "string" && targetLanguageRaw.trim() ? targetLanguageRaw.trim() : null;

  const [project] = await db
    .insert(projects)
    .values({
      name: name.trim(),
      level: typeof level === "string" && level.trim() ? level.trim() : null,
      isbn,
      trimSize,
      ownerId: userId,
    })
    .returning();

  // Sıfırdan modda gerçek bir yüklenen dosya yok, ama sourceUploads satırı
  // yine de sentezlenip ekleniyor - böylece fetchRunContext ve diğer üç
  // call site (api/projects/[id], rerun, projects/[id]/page.tsx) hiç
  // değişmeden, bir satırın her zaman var olduğu varsayımıyla çalışmaya
  // devam edebiliyor (bkz. schema.ts'in isFromScratch dokümantasyonu).
  await db.insert(sourceUploads).values({
    projectId: project.id,
    blobUrl: isFromScratch ? `scratch://${project.id}` : blobUrl,
    filename: isFromScratch ? "(kaynak yok - sıfırdan oluşturuldu)" : filename,
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
      designTheme,
      artStyle,
      referencePageUrls: referencePageUrls.length ? referencePageUrls : null,
      targetLanguage,
      customNotes: typeof customNotes === "string" && customNotes.trim() ? customNotes.trim() : null,
      unitLimit: isPictureBook ? 1 : unitLimit,
      requestedBookTypes: isPictureBook ? ["student_book"] : requestedBookTypes,
      variantCount: isPictureBook ? 1 : variantCount,
      unitSkeleton: isPictureBook ? null : unitSkeleton,
      spacedRepetition: isPictureBook ? false : spacedRepetition,
      isFromScratch,
      bookKind: isPictureBook ? "picturebook" : null,
      pictureBookPageCount: isPictureBook
        ? Math.min(32, Math.max(8, Number.isInteger(pictureBookPageCountRaw) ? pictureBookPageCountRaw : 16))
        : null,
      scratchBrief: isFromScratch && typeof briefRaw === "string" && briefRaw.trim() ? briefRaw.trim() : null,
    })
    .returning();

  if (!(await launchRun(run.id, () => start(bookPipelineWorkflow, [run.id])))) {
    return NextResponse.json({ error: START_FAILED_MESSAGE, projectId: project.id }, { status: 502 });
  }

  return NextResponse.json({ projectId: project.id, runId: run.id });
}
