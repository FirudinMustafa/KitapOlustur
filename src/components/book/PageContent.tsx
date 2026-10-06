"use client";

import { useRef, useState } from "react";
import type { ContentBlock, GeneratedPage, InteractiveExercise, ListeningAudio, WordTimestamp } from "@/lib/ai/schemas";
import { PAGE_WIDTH_PT, PAGE_HEIGHT_PT, PAGE_PADDING } from "@/lib/pdf/page-geometry";
import { BLOCK_COLORS } from "@/lib/block-colors";
import { blocksForRender } from "@/lib/layout-merge";

// Extracted from BookReader.tsx ("Dizilim → Gerçek Kitap") so the merged
// Dizilim flip-book preview can render the exact same real content (all
// blocks + audio, not a "first block only" stub) instead of duplicating this
// rendering logic. Behavior is unchanged from the original inline versions
// except where noted (BlockView's `audio` prop, PositionedPage/PageView's
// `listeningAudio` + `renderBlockWrapper` props - both additive).

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

// Faz H2 Faz 2: karaoke-style word highlighting, driven by the <audio>
// element's native `timeupdate` event (fires several times a second - no
// need for a manual rAF loop). `wordTimestamps` comes from forced alignment
// (workflows/book-pipeline.tsx's alignListeningAudio) - a real
// word-level transcription of the audio that was just synthesized from
// this exact script, not a guessed/even split of the text.
export function KaraokeAudio({ audioUrl, wordTimestamps }: { audioUrl: string; wordTimestamps: WordTimestamp[] }) {
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

// "Dizilim → Gerçek Kitap": `audio` is additive - when a listening-audio
// entry's blockRef matches this block's heading, it renders inline right
// under the block instead of only in BookReader's unit-level fallback panel
// (see BookReader.tsx's `unmatchedAudio` - it filters out anything a page's
// blocks already claimed here, so the same clip never renders twice).
// Turkish labels for the small kind chip - matches the vocabulary already
// used elsewhere in the Turkish-facing UI (project creation form etc.).
const BLOCK_KIND_LABELS: Record<ContentBlock["kind"], string> = {
  narrative: "Anlatı",
  explanation: "Açıklama",
  example: "Örnek",
  practice: "Alıştırma",
  assessment: "Değerlendirme",
  reference: "Kaynak",
};

export function BlockView({
  block,
  showAnswerKey,
  audio,
}: {
  block: ContentBlock;
  showAnswerKey: boolean;
  audio?: ListeningAudio;
}) {
  const color = BLOCK_COLORS[block.kind];
  return (
    <section
      className="mb-4 rounded-lg border-l-4 p-4 text-card-foreground"
      style={{ borderLeftColor: color.border, backgroundColor: color.bg }}
    >
      <span
        className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
        style={{ color: color.text, backgroundColor: "#ffffff" }}
      >
        {BLOCK_KIND_LABELS[block.kind]}
      </span>
      <h3 className="font-heading font-semibold" style={{ color: color.text }}>
        {block.heading}
      </h3>
      {block.body.split(/\n+/).map((p, i) => (
        <p key={i} className="font-reading mt-1 text-sm leading-relaxed text-foreground/80">
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
      {audio?.audioUrl && (
        <div className="mt-3">
          {audio.wordTimestamps?.length ? (
            <KaraokeAudio audioUrl={audio.audioUrl} wordTimestamps={audio.wordTimestamps} />
          ) : (
            <audio controls src={audio.audioUrl} className="w-full" />
          )}
        </div>
      )}
    </section>
  );
}

export function GlossarySection({ glossary }: { glossary: GeneratedPage["glossary"] }) {
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

// "Dizilim → Gerçek Kitap": lets an editor (ArrangementEditor's page-
// positioning mode) wrap each positioned block in a draggable container
// instead of the plain absolutely-positioned <div> below - BookReader.tsx
// passes nothing, so its rendering is byte-for-byte unchanged from before
// this existed. The wrapper receives the block's OWN content (unpositioned)
// and is responsible for placing it at `layout` itself (see DraggableBox.tsx)
// - it must not be nested inside another absolutely-positioned element using
// the same coordinates, or the block would be offset twice.
export type BlockWrapper = (
  block: ContentBlock,
  index: number,
  layout: ContentBlock["layout"],
  children: React.ReactNode,
) => React.ReactNode;

// Faz "Sayfa Dizilimi Editörü": if the user positioned anything on this page
// via the layout editor, render it on a fixed-size A4-shaped canvas (same
// point values as BookDocument.tsx's react-pdf render, used directly as CSS
// px - no scale conversion, so what's positioned here matches the PDF
// output 1:1) so the reader sees the same layout the printed book has.
// Blocks without a `layout` (the common case) keep rendering in normal flow
// underneath, exactly as before - this is additive, not a replacement.
export function PositionedPage({
  page,
  showAnswerKey,
  imageUrl,
  listeningAudio,
  renderBlockWrapper,
}: {
  page: GeneratedPage;
  showAnswerKey: boolean;
  imageUrl?: string;
  listeningAudio?: ListeningAudio[];
  renderBlockWrapper?: BlockWrapper;
}) {
  const renderBlocks = blocksForRender(page);
  const positionedBlocks = renderBlocks.filter((b) => b.layout);
  const flowBlocks = renderBlocks.filter((b) => !b.layout);
  return (
    <div className="mb-6">
      <div
        className="relative mx-auto overflow-hidden rounded-lg border border-border bg-card"
        style={{ width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT }}
      >
        {imageUrl && page.imageLayout && (
          <div
            className="absolute overflow-hidden rounded-md"
            style={{
              left: page.imageLayout.x,
              top: page.imageLayout.y,
              width: page.imageLayout.width,
              height: page.imageLayout.height,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image */}
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        {imageUrl && !page.imageLayout && (
          <div
            className="absolute overflow-hidden rounded-md"
            style={{ left: PAGE_PADDING.left, top: PAGE_PADDING.top, right: PAGE_PADDING.right, height: 170 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image */}
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        {positionedBlocks.map((block, i) => {
          const audio = listeningAudio?.find((a) => a.blockRef === block.heading);
          const inner = <BlockView block={block} showAnswerKey={showAnswerKey} audio={audio} />;
          if (renderBlockWrapper) {
            return <div key={i}>{renderBlockWrapper(block, i, block.layout, inner)}</div>;
          }
          return (
            <div
              key={i}
              className="absolute overflow-hidden rounded-lg border-l-4 border-primary bg-card p-3 text-card-foreground"
              style={{ left: block.layout!.x, top: block.layout!.y, width: block.layout!.width, height: block.layout!.height }}
            >
              {inner}
            </div>
          );
        })}
      </div>
      {!!flowBlocks.length && (
        <div className="mt-4">
          {flowBlocks.map((block, i) => (
            <BlockView
              key={i}
              block={block}
              showAnswerKey={showAnswerKey}
              audio={listeningAudio?.find((a) => a.blockRef === block.heading)}
            />
          ))}
        </div>
      )}
      <GlossarySection glossary={page.glossary} />
    </div>
  );
}

export function PageView({
  page,
  showAnswerKey,
  imageUrl,
  listeningAudio,
  renderBlockWrapper,
}: {
  page: GeneratedPage;
  showAnswerKey: boolean;
  imageUrl?: string;
  listeningAudio?: ListeningAudio[];
  renderBlockWrapper?: BlockWrapper;
}) {
  const hasLayout = page.blocks.some((b) => b.layout) || !!page.imageLayout;
  if (hasLayout) {
    return (
      <PositionedPage
        page={page}
        showAnswerKey={showAnswerKey}
        imageUrl={imageUrl}
        listeningAudio={listeningAudio}
        renderBlockWrapper={renderBlockWrapper}
      />
    );
  }
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
        <BlockView
          key={i}
          block={block}
          showAnswerKey={showAnswerKey}
          audio={listeningAudio?.find((a) => a.blockRef === block.heading)}
        />
      ))}
      <GlossarySection glossary={page.glossary} />
    </div>
  );
}
