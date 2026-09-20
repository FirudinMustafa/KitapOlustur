"use client";

import { useState } from "react";
import type { GeneratedUnit, GeneratedPage, ContentBlock } from "@/lib/ai/schemas";
import type { Variant } from "@/lib/pdf/BookDocument";

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

function AnswerKeyToggle({ answerKey }: { answerKey: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-blue-700 underline hover:no-underline dark:text-blue-400"
      >
        {open ? "Cevap anahtarını gizle" : "Cevap anahtarını göster"}
      </button>
      {open && (
        <ol className="mt-1 list-decimal pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          {answerKey.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

function BlockView({ block, showAnswerKey }: { block: ContentBlock; showAnswerKey: boolean }) {
  return (
    <section className="mb-4 rounded-lg border-l-4 border-blue-500 bg-zinc-50 p-4 dark:bg-zinc-900">
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{block.heading}</h3>
      {block.body.split(/\n+/).map((p, i) => (
        <p key={i} className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
          {p}
        </p>
      ))}
      {!!block.items?.length && (
        <ol className="mt-2 list-decimal pl-5 text-sm text-zinc-800 dark:text-zinc-200">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      )}
      {showAnswerKey && !!block.answerKey?.length && <AnswerKeyToggle answerKey={block.answerKey} />}
    </section>
  );
}

function GlossarySection({ glossary }: { glossary: GeneratedPage["glossary"] }) {
  if (!glossary?.length) return null;
  return (
    <section className="mt-4 rounded-lg bg-amber-50 p-4 dark:bg-amber-950">
      <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Glossary</h4>
      <dl className="mt-2 flex flex-col gap-2">
        {glossary.map((entry, i) => (
          <div key={i}>
            <dt className="text-sm font-medium text-amber-900 dark:text-amber-200">{entry.term}</dt>
            <dd className="text-sm text-amber-800 dark:text-amber-300">
              {entry.definition}
              {entry.example && <span className="italic"> · e.g. {entry.example}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PageView({
  page,
  showAnswerKey,
  imageUrl,
}: {
  page: GeneratedPage;
  showAnswerKey: boolean;
  imageUrl?: string;
}) {
  return (
    <div className="mb-6">
      {imageUrl && (
        <figure className="mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image, no build-time optimization to gain */}
          <img src={imageUrl} alt="" className="max-h-64 w-full rounded-md object-cover" />
          {page.imagePrompt && (
            <figcaption className="mt-1 text-xs italic text-zinc-500 dark:text-zinc-400">{page.imagePrompt}</figcaption>
          )}
        </figure>
      )}
      {page.blocks.map((block, i) => (
        <BlockView key={i} block={block} showAnswerKey={showAnswerKey} />
      ))}
      <GlossarySection glossary={page.glossary} />
    </div>
  );
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
  const showAnswerKey = variant === "workbook" || variant === "teacher_book";
  const current = unitsWithPages.find((u) => u.unitNumber === activeUnit);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 lg:flex-row">
      <nav className="w-full shrink-0 lg:w-56">
        <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{bookTitle}</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
                    ? "bg-zinc-950 text-white dark:bg-white dark:text-black"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
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
          <p className="text-sm text-zinc-500">Bu kitap tipi için içerik bulunamadı.</p>
        ) : (
          <>
            {current.unitNumber === unitsWithPages[0]?.unitNumber && coverImageSrc && (
              // eslint-disable-next-line @next/next/no-img-element -- see PageView's comment above
              <img src={coverImageSrc} alt="" className="mb-6 max-h-48 w-full rounded-lg object-cover" />
            )}
            <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Unit {current.unitNumber}: {current.title}
            </h2>
            {!!current.listeningAudio?.length && (
              <div className="mb-6 flex flex-col gap-2 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Dinleme</p>
                {current.listeningAudio.map((entry, i) =>
                  entry.audioUrl ? (
                    <div key={i}>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{entry.blockRef}</p>
                      <audio controls src={entry.audioUrl} className="w-full" />
                    </div>
                  ) : null,
                )}
              </div>
            )}
            {pagesForVariant(current, variant).map((page, i) => (
              <PageView
                key={i}
                page={page}
                showAnswerKey={showAnswerKey}
                imageUrl={pageImages[page.sourcePageNumber]}
              />
            ))}
          </>
        )}
      </main>
    </div>
  );
}
