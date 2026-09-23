"use client";

import { useState } from "react";
import type { GeneratedUnit, GeneratedPage } from "@/lib/ai/schemas";
import type { Variant } from "@/lib/pdf/BookDocument";
import { KaraokeAudio, PageView } from "@/components/book/PageContent";
import { resolvePageImageUrl } from "@/lib/page-image";

const VARIANT_LABELS: Record<Variant, string> = {
  student_book: "Student Book",
  workbook: "Workbook",
  teacher_book: "Teacher's Book",
  test_booklet: "Test Booklet",
};

// Defensive `?? []` on every branch (not just the two already-optional
// schema fields): generatedBooks.content is untyped jsonb, so a row
// written by an older pipeline version - before a field existed, or with a
// different shape entirely - can violate the current GeneratedUnit type at
// runtime despite TypeScript treating it as trusted. Found live: a 2026-07
// legacy row had no studentBookPages/workbookPages at all, which crashed
// this page before this guard existed.
function pagesForVariant(unit: GeneratedUnit, variant: Variant): GeneratedPage[] {
  switch (variant) {
    case "student_book":
      return unit.studentBookPages ?? [];
    case "workbook":
      return unit.workbookPages ?? [];
    case "teacher_book":
      return unit.teacherBookPages ?? [];
    case "test_booklet":
      return unit.testBookletPages ?? [];
  }
}

export function BookReader({
  bookTitle,
  level,
  variant,
  units,
  coverImageSrc,
  pageImages,
}: {
  bookTitle: string;
  level: string | null;
  variant: Variant;
  units: GeneratedUnit[];
  coverImageSrc?: string | null;
  pageImages: Record<number, string>;
}) {
  const unitsWithPages = units.filter((u) => pagesForVariant(u, variant).length > 0);
  const [activeUnit, setActiveUnit] = useState(unitsWithPages[0]?.unitNumber ?? null);
  // Faz "Teacher's Book/Test Booklet Genişletme": test_booklet was missing
  // here despite always generating an answer key - it was silently dropped.
  const showAnswerKey = variant === "workbook" || variant === "teacher_book" || variant === "test_booklet";
  const current = unitsWithPages.find((u) => u.unitNumber === activeUnit);
  const currentPages = current ? pagesForVariant(current, variant) : [];

  // "Dizilim → Gerçek Kitap": listening audio now also renders inline under
  // its matching block (PageView/BlockView, via `listeningAudio` below) -
  // this fallback panel keeps showing only entries whose blockRef doesn't
  // match any block heading on the currently displayed pages, so a clip
  // never renders twice.
  const matchedBlockRefs = new Set(
    currentPages.flatMap((p) => p.blocks.map((b) => b.heading)).filter((heading) => current?.listeningAudio?.some((a) => a.blockRef === heading)),
  );
  const unmatchedAudio = current?.listeningAudio?.filter((a) => !matchedBlockRefs.has(a.blockRef)) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 lg:flex-row">
      <nav className="w-full shrink-0 lg:w-56">
        <h1 className="font-heading text-lg font-semibold text-foreground">{bookTitle}</h1>
        <p className="text-xs text-muted-foreground">
          {VARIANT_LABELS[variant]}
          {level ? ` · ${level}` : ""}
        </p>
        <ul className="mt-4 flex flex-col gap-1">
          {unitsWithPages.map((unit) => (
            <li key={unit.unitNumber}>
              <button
                onClick={() => setActiveUnit(unit.unitNumber)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                  unit.unitNumber === activeUnit
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-accent"
                }`}
              >
                Unit {unit.unitNumber}: {unit.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="min-w-0 flex-1">
        {!current ? (
          <p className="text-sm text-muted-foreground">Bu kitap tipi için içerik bulunamadı.</p>
        ) : (
          <>
            {current.unitNumber === unitsWithPages[0]?.unitNumber && coverImageSrc && (
              // eslint-disable-next-line @next/next/no-img-element -- see PageView's comment above
              <img src={coverImageSrc} alt="" className="mb-6 max-h-48 w-full rounded-lg object-cover" />
            )}
            <h2 className="font-heading mb-4 text-xl font-semibold text-foreground">
              Unit {current.unitNumber}: {current.title}
            </h2>
            {!!unmatchedAudio.length && (
              <div className="mb-6 flex flex-col gap-2 rounded-lg bg-card p-3 text-card-foreground ring-1 ring-foreground/10">
                <p className="text-xs font-medium text-muted-foreground">Dinleme</p>
                {unmatchedAudio.map((entry, i) =>
                  entry.audioUrl ? (
                    <div key={i}>
                      <p className="text-xs text-muted-foreground">{entry.blockRef}</p>
                      {entry.wordTimestamps?.length ? (
                        <KaraokeAudio audioUrl={entry.audioUrl} wordTimestamps={entry.wordTimestamps} />
                      ) : (
                        <audio controls src={entry.audioUrl} className="w-full" />
                      )}
                    </div>
                  ) : null,
                )}
              </div>
            )}
            {currentPages.map((page, i) => (
              <PageView
                key={i}
                page={page}
                showAnswerKey={showAnswerKey}
                imageUrl={resolvePageImageUrl(page, pageImages)}
                listeningAudio={current.listeningAudio}
              />
            ))}
          </>
        )}
      </main>
    </div>
  );
}
