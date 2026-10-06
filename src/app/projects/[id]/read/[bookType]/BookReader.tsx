"use client";

import Link from "next/link";
import { useState } from "react";
import type { GeneratedUnit, GeneratedPage } from "@/lib/ai/schemas";
import type { Variant } from "@/lib/pdf/BookDocument";
import { KaraokeAudio, PageView } from "@/components/book/PageContent";
import { BookFlipViewer, type FlipPageEntry } from "@/components/book/BookFlipViewer";
import { resolvePageImageUrl } from "@/lib/page-image";
import { resolveLogoPositionStyle } from "@/lib/logo-position";
import { derivePaletteFromColors } from "@/lib/pdf/derive-palette";
import { withUnitGlossary } from "@/lib/unit-glossary";

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
  projectId,
  availableTypes,
  units,
  coverImageSrc,
  pageImages,
  logoUrl,
  logoPosition,
  paletteColors,
}: {
  bookTitle: string;
  level: string | null;
  variant: Variant;
  projectId: string;
  availableTypes: Variant[];
  units: GeneratedUnit[];
  coverImageSrc?: string | null;
  pageImages: Record<number, string>;
  // "Kaynağa görsel sadakat" web parity (2026-09-28): same source-derived
  // logo/palette data BookDocument.tsx (PDF export) already renders - see
  // generationRuns.userLogoUrl/logoPosition/paletteColors in schema.ts.
  // Undefined/null on every field (a "sıfırdan" project, or a source PDF
  // with no detected brand mark/palette) means the cover renders exactly as
  // before this existed.
  logoUrl?: string | null;
  logoPosition?: string | null;
  paletteColors?: string[];
}) {
  const unitsWithPages = units.filter((u) => pagesForVariant(u, variant).length > 0);
  const palette = derivePaletteFromColors(paletteColors);
  const accentStyle = palette ? { borderColor: palette.primary } : undefined;
  const [activeUnit, setActiveUnit] = useState(unitsWithPages[0]?.unitNumber ?? null);
  // Faz C1 ("gerçek sayfa-çevirmeli okuma deneyimi", 2026-09-28): the
  // ArrangementEditor's flip-book preview (BookFlipViewer, react-pageflip)
  // was previously only reachable from Dizilim, a post-hoc editor - readers
  // never saw it. "Liste" (the pre-existing scroll-through-one-unit view)
  // stays the default so nothing changes for anyone who doesn't switch modes.
  const [viewMode, setViewMode] = useState<"list" | "flip">("list");
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

  const flatPages: FlipPageEntry[] = unitsWithPages.flatMap((u) =>
    withUnitGlossary(u, pagesForVariant(u, variant), variant).map((page, index) => ({ page, unitNumber: u.unitNumber, unitTitle: u.title, index })),
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 lg:flex-row">
      <nav className="w-full shrink-0 lg:w-56">
        <h1 className="font-heading text-lg font-semibold text-foreground">{bookTitle}</h1>
        <p className="text-xs text-muted-foreground">
          {VARIANT_LABELS[variant]}
          {level ? ` · ${level}` : ""}
        </p>
        {availableTypes.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {(["student_book", "workbook", "teacher_book", "test_booklet"] as Variant[])
              .filter((t) => availableTypes.includes(t))
              .map((t) => (
                <Link
                  key={t}
                  href={`/projects/${projectId}/read/${t}`}
                  aria-current={t === variant ? "page" : undefined}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${
                    t === variant
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {VARIANT_LABELS[t]}
                </Link>
              ))}
          </div>
        )}
        <div className="mt-3 flex gap-1 rounded-md bg-muted p-0.5 text-xs">
          <button
            onClick={() => setViewMode("list")}
            className={`flex-1 rounded px-2 py-1 ${viewMode === "list" ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Liste
          </button>
          <button
            onClick={() => setViewMode("flip")}
            className={`flex-1 rounded px-2 py-1 ${viewMode === "flip" ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Sayfa çevir
          </button>
        </div>
        <ul className={`mt-4 flex flex-col gap-1 ${viewMode === "flip" ? "opacity-50" : ""}`}>
          {unitsWithPages.map((unit) => (
            <li key={unit.unitNumber}>
              <button
                onClick={() => setActiveUnit(unit.unitNumber)}
                style={unit.unitNumber === activeUnit && palette ? { backgroundColor: palette.primary, color: "#fff" } : undefined}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                  unit.unitNumber === activeUnit
                    ? palette
                      ? ""
                      : "bg-primary text-primary-foreground"
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
        ) : viewMode === "flip" ? (
          <BookFlipViewer
            flatPages={flatPages}
            pageImages={pageImages}
            showAnswerKey={showAnswerKey}
            listeningAudioByUnit={(unitNumber) => unitsWithPages.find((u) => u.unitNumber === unitNumber)?.listeningAudio}
          />
        ) : (
          <>
            {current.unitNumber === unitsWithPages[0]?.unitNumber && coverImageSrc && (
              <div className="relative mb-6">
                {/* eslint-disable-next-line @next/next/no-img-element -- see PageView's comment above */}
                <img src={coverImageSrc} alt="" className="max-h-48 w-full rounded-lg object-cover" />
                {logoUrl && (
                  <div
                    className="absolute flex h-11 w-11 items-center justify-center rounded-md bg-white p-1 shadow"
                    style={resolveLogoPositionStyle(logoPosition)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- see PageView's comment above */}
                    <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                  </div>
                )}
              </div>
            )}
            <h2
              className="font-heading mb-4 border-l-4 pl-3 text-xl font-semibold text-foreground"
              style={accentStyle ?? { borderColor: "transparent" }}
            >
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
