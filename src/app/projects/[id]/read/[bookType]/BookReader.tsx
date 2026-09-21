"use client";

import { useRef, useState } from "react";
import type { GeneratedUnit, GeneratedPage, ContentBlock, WordTimestamp, InteractiveExercise } from "@/lib/ai/schemas";
import type { Variant } from "@/lib/pdf/BookDocument";

// Faz H2 Faz 3: deterministic shuffle (not Math.random) so a matching
// exercise's right column doesn't render in the same order as the correct
// pairs (that would make it a non-exercise) - mirrors src/lib/content-html.ts's
// seededShuffle exactly (kept as its own copy: this one runs client-side
// per render, that one server-side at export time - not worth sharing a
// module across the client/server boundary for eight lines).
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function MultipleChoiceExercise({ exercise }: { exercise: Extract<InteractiveExercise, { type: "multiple_choice" }> }) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="mt-2">
      <p className="text-sm font-medium text-foreground">{exercise.question}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {exercise.options.map((option, i) => {
          const isCorrect = i === exercise.correctIndex;
          const isSelected = i === selected;
          const showFeedback = selected !== null;
          return (
            <button
              key={i}
              onClick={() => setSelected(i)}
              disabled={showFeedback}
              className={`rounded-md border px-3 py-1.5 text-left text-sm ${
                showFeedback && isCorrect
                  ? "border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200"
                  : showFeedback && isSelected
                    ? "border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200"
                    : "border-input text-foreground/80 hover:bg-accent"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <button
          onClick={() => setSelected(null)}
          className="mt-2 text-xs font-medium text-primary underline hover:no-underline"
        >
          Tekrar dene
        </button>
      )}
    </div>
  );
}

function FillBlankExercise({ exercise }: { exercise: Extract<InteractiveExercise, { type: "fill_blank" }> }) {
  const segments = exercise.template.split("___");
  const [answers, setAnswers] = useState<string[]>(() => exercise.blanks.map(() => ""));
  const [checked, setChecked] = useState(false);

  function isCorrect(i: number) {
    return answers[i]?.trim().toLowerCase() === exercise.blanks[i]?.trim().toLowerCase();
  }

  return (
    <div className="mt-2">
      <p className="text-sm leading-loose text-foreground">
        {segments.map((segment, i) => (
          <span key={i}>
            {segment}
            {i < exercise.blanks.length && (
              <input
                value={answers[i] ?? ""}
                onChange={(e) => setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))}
                className={`mx-1 w-24 rounded border px-1.5 py-0.5 text-sm ${
                  checked
                    ? isCorrect(i)
                      ? "border-green-500 bg-green-50 dark:bg-green-950"
                      : "border-red-500 bg-red-50 dark:bg-red-950"
                    : "border-input bg-background"
                }`}
              />
            )}
          </span>
        ))}
      </p>
      <button
        onClick={() => setChecked(true)}
        className="mt-2 rounded-full border border-input px-3 py-1 text-xs font-medium text-foreground/80 hover:bg-accent"
      >
        Kontrol et
      </button>
    </div>
  );
}

function MatchingExercise({ exercise }: { exercise: Extract<InteractiveExercise, { type: "matching" }> }) {
  const [rightOrder] = useState(() => seededShuffle(exercise.pairs.map((p) => p.right), exercise.pairs[0]?.left ?? ""));
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [solved, setSolved] = useState<Set<number>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);

  function attemptMatch(rightIndex: number) {
    if (selectedLeft === null) return;
    const isCorrect = exercise.pairs[selectedLeft].right === rightOrder[rightIndex];
    if (isCorrect) {
      setSolved((prev) => new Set(prev).add(selectedLeft));
      setSelectedLeft(null);
    } else {
      setWrongFlash(rightIndex);
      setTimeout(() => setWrongFlash(null), 500);
    }
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-1.5">
        {exercise.pairs.map((pair, i) => (
          <button
            key={i}
            onClick={() => !solved.has(i) && setSelectedLeft(i)}
            disabled={solved.has(i)}
            className={`rounded-md border px-2 py-1.5 text-left text-sm ${
              solved.has(i)
                ? "border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200"
                : selectedLeft === i
                  ? "border-primary bg-primary/10"
                  : "border-input text-foreground/80 hover:bg-accent"
            }`}
          >
            {pair.left}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {rightOrder.map((right, i) => {
          const solvedHere = [...solved].some((li) => exercise.pairs[li].right === right);
          return (
            <button
              key={i}
              onClick={() => attemptMatch(i)}
              disabled={solvedHere}
              className={`rounded-md border px-2 py-1.5 text-left text-sm ${
                solvedHere
                  ? "border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200"
                  : wrongFlash === i
                    ? "border-red-500 bg-red-50 dark:bg-red-950"
                    : "border-input text-foreground/80 hover:bg-accent"
              }`}
            >
              {right}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InteractiveExerciseView({ exercise }: { exercise: InteractiveExercise }) {
  switch (exercise.type) {
    case "multiple_choice":
      return <MultipleChoiceExercise exercise={exercise} />;
    case "fill_blank":
      return <FillBlankExercise exercise={exercise} />;
    case "matching":
      return <MatchingExercise exercise={exercise} />;
  }
}

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

// Faz H2 Faz 2: karaoke-style word highlighting, driven by the <audio>
// element's native `timeupdate` event (fires several times a second - no
// need for a manual rAF loop). `wordTimestamps` comes from forced alignment
// (workflows/book-pipeline.tsx's alignListeningAudio) - a real
// word-level transcription of the audio that was just synthesized from
// this exact script, not a guessed/even split of the text.
function KaraokeAudio({ audioUrl, wordTimestamps }: { audioUrl: string; wordTimestamps: WordTimestamp[] }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement>(null);

  function onTimeUpdate() {
    const currentMs = (audioRef.current?.currentTime ?? 0) * 1000;
    const idx = wordTimestamps.findIndex((w) => currentMs >= w.startMs && currentMs < w.endMs);
    setActiveIndex(idx);
  }

  return (
    <div>
      <audio ref={audioRef} controls src={audioUrl} className="w-full" onTimeUpdate={onTimeUpdate} />
      <p className="mt-2 text-sm leading-relaxed">
        {wordTimestamps.map((w, i) => (
          <span
            key={i}
            className={
              i === activeIndex
                ? "rounded bg-yellow-300 px-0.5 text-zinc-950 dark:bg-yellow-500"
                : "text-foreground/80"
            }
          >
            {w.word}{" "}
          </span>
        ))}
      </p>
    </div>
  );
}

function AnswerKeyToggle({ answerKey }: { answerKey: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-primary underline hover:no-underline"
      >
        {open ? "Cevap anahtarını gizle" : "Cevap anahtarını göster"}
      </button>
      {open && (
        <ol className="mt-1 list-decimal pl-5 text-sm text-foreground/80">
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
    <section className="mb-4 rounded-lg border-l-4 border-primary bg-card p-4 text-card-foreground">
      <h3 className="font-semibold text-foreground">{block.heading}</h3>
      {block.body.split(/\n+/).map((p, i) => (
        <p key={i} className="mt-1 text-sm text-foreground/80">
          {p}
        </p>
      ))}
      {!!block.items?.length && (
        <ol className="mt-2 list-decimal pl-5 text-sm text-foreground">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      )}
      {block.interactive && <InteractiveExerciseView exercise={block.interactive} />}
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
            <figcaption className="mt-1 text-xs italic text-muted-foreground">{page.imagePrompt}</figcaption>
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
        <h1 className="text-lg font-semibold text-foreground">{bookTitle}</h1>
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
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              Unit {current.unitNumber}: {current.title}
            </h2>
            {!!current.listeningAudio?.length && (
              <div className="mb-6 flex flex-col gap-2 rounded-lg bg-card p-3 text-card-foreground ring-1 ring-foreground/10">
                <p className="text-xs font-medium text-muted-foreground">Dinleme</p>
                {current.listeningAudio.map((entry, i) =>
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
