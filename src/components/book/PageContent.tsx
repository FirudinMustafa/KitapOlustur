"use client";

import { useRef, useState } from "react";
import type { ContentBlock, GeneratedPage, InteractiveExercise, ListeningAudio, WordTimestamp } from "@/lib/ai/schemas";
import { PAGE_WIDTH_PT, PAGE_HEIGHT_PT, PAGE_PADDING } from "@/lib/pdf/page-geometry";
import { BLOCK_COLORS } from "@/lib/block-colors";
import { blocksForRender } from "@/lib/layout-merge";
import { itemText } from "@/lib/item-text";
import { isEmoji, letterFor, twemojiUrl, type ActivityPicture } from "@/lib/activities";
import { SCENE_H, SCENE_W, mapGrid, prepositionScene, type Shape } from "@/lib/diagrams";
import { isChecklistBlock, resolvePageTemplate } from "@/lib/design/layouts";
import { CALLOUT_STYLES, DESIGN_THEMES, speakerColorMap } from "@/lib/design/themes";
import { TemplatedPage, lookFonts, type WebLook } from "./TemplatedPage";

export type { WebLook } from "./TemplatedPage";

// The look every book had before themes existed - used when a caller passes
// no theme (older runs, Dizilim before it learned about themes).
export const CLASSIC_WEB_LOOK: WebLook = { theme: DESIGN_THEMES.classic, palette: DESIGN_THEMES.classic.palettes.student_book };

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
                  ? "border-success bg-success-soft text-success-soft-foreground"
                  : showFeedback && isSelected
                    ? "border-danger bg-danger-soft text-danger-soft-foreground"
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
                      ? "border-success bg-success-soft"
                      : "border-danger bg-danger-soft"
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
                ? "border-success bg-success-soft text-success-soft-foreground"
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
                  ? "border-success bg-success-soft text-success-soft-foreground"
                  : wrongFlash === i
                    ? "border-danger bg-danger-soft"
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
                ? "rounded bg-warning/60 px-0.5 text-foreground"
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
            <li key={i}>{itemText(a)}</li>
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

// Faz 1 "Tasarım sistemi": speech bubbles - same speaker colours/sides as
// the PDF (src/lib/pdf/blocks.tsx DialogueView).
function DialogueBubbles({ lines }: { lines: NonNullable<ContentBlock["dialogue"]> }) {
  const colors = speakerColorMap(lines);
  const order = [...colors.keys()];
  return (
    <div className="mt-2 flex flex-col gap-2">
      {lines.map((l, i) => {
        const color = colors.get(l.speaker) ?? "#2563eb";
        const right = order.indexOf(l.speaker) % 2 === 1;
        return (
          <div key={i} className={right ? "flex flex-row-reverse items-start gap-2" : "flex items-start gap-2"}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: color }}>
              {l.speaker.trim().charAt(0).toUpperCase()}
            </span>
            <div className="max-w-[78%] rounded-xl border bg-gray-50 px-2.5 py-1.5 text-sm text-gray-800" style={{ borderColor: color }}>
              <div className="text-[9px] font-bold" style={{ color }}>
                {l.speaker}
              </div>
              {l.line}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BlockTable({ table, primary, light }: { table: NonNullable<ContentBlock["table"]>; primary: string; light: string }) {
  return (
    <div className="mt-2 overflow-hidden rounded border text-xs" style={{ borderColor: primary }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: primary }}>
            {table.headers.map((h, i) => (
              <th key={i} className="px-2 py-1 text-left font-bold text-white">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r} style={{ background: r % 2 ? light : "#ffffff" }} className="text-gray-800">
              {table.headers.map((_, c) => (
                <td key={c} className="px-2 py-1 align-top">
                  {row[c] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Workbook activity formats (src/lib/activities.ts) - the screen twin of
// the PDF drawing in src/lib/pdf/blocks.tsx.
function ActivityPictureBox({ picture, fallback, light }: { picture?: ActivityPicture; fallback: string; light: string }) {
  return (
    <div className="flex h-16 items-center justify-center rounded-lg border bg-white p-1 text-center" style={{ borderColor: light }}>
      {picture?.emoji && isEmoji(picture.emoji) ? (
        // Same Twemoji picture the PDF prints (not the OS's own emoji font).
        // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG from a CDN, nothing for next/image to optimise
        <img src={twemojiUrl(picture.emoji)} alt={picture.label} className="h-12 w-12 object-contain" loading="lazy" />
      ) : (
        <span className="text-[10px] leading-tight text-muted-foreground">{fallback}</span>
      )}
    </div>
  );
}

function RuledLines({ count }: { count: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-6 border-b border-gray-400" />
      ))}
    </div>
  );
}

// Code-drawn diagrams (src/lib/diagrams.ts) - same shapes as the PDF.
function SceneSvg({ shapes, width }: { shapes: Shape[]; width: number }) {
  return (
    <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} width={width} height={(width * SCENE_H) / SCENE_W} aria-hidden>
      {shapes.map((sh, i) => {
        switch (sh.t) {
          case "rect":
            return <rect key={i} x={sh.x} y={sh.y} width={sh.w} height={sh.h} rx={sh.rx} fill={sh.fill} stroke={sh.stroke} strokeWidth={0.8} />;
          case "poly":
            return <polygon key={i} points={sh.points.map((pt) => pt.join(",")).join(" ")} fill={sh.fill} stroke={sh.stroke} strokeWidth={0.8} />;
          case "circle":
            return <circle key={i} cx={sh.cx} cy={sh.cy} r={sh.r} fill={sh.fill} stroke={sh.stroke} strokeWidth={sh.stroke ? 0.8 : 0} />;
          case "line":
            return <line key={i} x1={sh.x1} y1={sh.y1} x2={sh.x2} y2={sh.y2} stroke={sh.stroke} strokeWidth={sh.width ?? 1} strokeDasharray={sh.dash} />;
        }
      })}
    </svg>
  );
}

function PrepositionList({ block }: { block: ContentBlock }) {
  const scenes = block.diagram?.scenes ?? [];
  return (
    <ol className="mt-2 flex flex-col gap-2 text-sm">
      {(block.items ?? []).map((item, i) => (
        <li key={i} className="flex items-center gap-3">
          <span className="shrink-0 rounded-md bg-white p-0.5">{scenes[i] && <SceneSvg shapes={prepositionScene(scenes[i])} width={78} />}</span>
          <span>
            {i + 1}. {itemText(item)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function TownMap({ block, primary }: { block: ContentBlock; primary: string }) {
  const places = block.diagram?.places ?? [];
  if (!places.length) return null;
  const { rows, cols, at } = mapGrid(places);
  return (
    <div className="my-2 grid gap-2.5 rounded-lg bg-stone-300 p-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: rows * cols }, (_, k) => {
        const place = at(Math.floor(k / cols) + 1, (k % cols) + 1);
        return (
          <div
            key={k}
            className={place ? "flex h-16 flex-col items-center justify-center rounded border bg-white p-1 text-center" : "h-16 rounded bg-green-200"}
            style={place ? { borderColor: primary } : undefined}
          >
            {place?.emoji && isEmoji(place.emoji) && (
              // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG from a CDN
              <img src={twemojiUrl(place.emoji)} alt="" className="h-7 w-7" loading="lazy" />
            )}
            {place && (
              <span className="text-[10px] leading-tight font-bold" style={{ color: primary }}>
                {place.name}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActivityView({ block, primary, light }: { block: ContentBlock; primary: string; light: string }) {
  const a = block.activity!;
  const items = block.items ?? [];
  const pictures = a.pictures ?? [];
  return (
    <div className="mt-2 text-sm">
      {!!a.words?.length && (
        <div className="mb-3 flex flex-wrap justify-center gap-x-4 gap-y-1 rounded-md border border-dashed bg-white px-3 py-2 font-bold" style={{ borderColor: primary, color: primary }}>
          {a.words.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
      )}
      {a.type === "picture_label" ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((item, i) => (
            <div key={i}>
              <ActivityPictureBox picture={pictures[i]} fallback={itemText(item)} light={light} />
              <div className="mt-1 flex items-end gap-1">
                <span className="text-xs font-bold" style={{ color: primary }}>
                  {i + 1}
                </span>
                <span className="mb-1 h-0 flex-1 border-b border-gray-400" />
              </div>
            </div>
          ))}
        </div>
      ) : a.type === "picture_match" ? (
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1">
                {i + 1}. {itemText(item)}
              </span>
              <span className="h-2 w-2 rounded-full" style={{ background: primary }} />
              <span className="w-10 sm:w-16" />
              <span className="h-2 w-2 rounded-full" style={{ background: primary }} />
              <span className="text-xs font-bold" style={{ color: primary }}>
                {letterFor(i)}
              </span>
              <div className="w-20">
                <ActivityPictureBox picture={pictures[i]} fallback={pictures[i]?.label ?? ""} light={light} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <ol className="list-decimal pl-5">
            {items.map((item, i) => (
              <li key={i}>
                {itemText(item)}
                {a.type === "write_lines" && <RuledLines count={a.lines ?? 1} />}
              </li>
            ))}
          </ol>
          {a.type === "write_lines" && !items.length && <RuledLines count={a.lines ?? 5} />}
          {a.type === "draw_box" && <div className="mt-2 rounded-lg border bg-white" style={{ borderColor: primary, height: (a.lines ?? 8) * 18 }} />}
        </>
      )}
    </div>
  );
}

export function BlockView({
  block,
  showAnswerKey,
  audio,
  look,
  frameless,
}: {
  block: ContentBlock;
  showAnswerKey: boolean;
  audio?: ListeningAudio;
  /** Faz 1: when set, the block is drawn in the book's theme (templated pages) instead of the per-kind colours. */
  look?: WebLook;
  frameless?: boolean;
}) {
  const color = BLOCK_COLORS[block.kind];
  const callout = block.callout ? CALLOUT_STYLES[block.callout] : null;
  const checklist = isChecklistBlock(block);
  const themed = look
    ? callout
      ? { background: callout.bg, border: `1px solid ${callout.border}`, borderRadius: Math.max(6, look.theme.radius) }
      : frameless
        ? {}
        : look.theme.cardStyle === "tinted"
          ? { background: look.palette.primaryLight, borderRadius: look.theme.radius }
          : look.theme.cardStyle === "outlined"
            ? { border: "1px solid #d1d5db", borderRadius: look.theme.radius }
            : { borderLeft: `3px solid ${look.palette.primary}` }
    : null;
  const primary = look?.palette.primary ?? color.text;
  const light = look?.palette.primaryLight ?? color.bg;
  return (
    <section
      className={themed ? (frameless && !callout ? "mb-3" : "mb-3 p-3") : "mb-4 rounded-lg border-l-4 p-4 text-card-foreground"}
      style={themed ?? { borderLeftColor: callout?.border ?? color.border, backgroundColor: callout?.bg ?? color.bg }}
    >
      {callout ? (
        <span className="mb-1 inline-block text-[9px] font-bold tracking-widest" style={{ color: callout.text }}>
          {callout.label}
        </span>
      ) : !look ? (
        <span
          className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
          style={{ color: color.text, backgroundColor: "#ffffff" }}
        >
          {BLOCK_KIND_LABELS[block.kind]}
        </span>
      ) : null}
      {block.heading && (
        <h3
          className={look ? "font-bold" : "font-heading font-semibold"}
          style={{
            color: callout?.text ?? (look ? (look.theme.cardStyle === "accent-bar" ? undefined : look.palette.primaryDark) : color.text),
            fontFamily: look ? lookFonts(look).heading : undefined,
          }}
        >
          {block.heading}
        </h3>
      )}
      {block.body.split(/\n+/).filter(Boolean).map((p, i) => (
        <p key={i} className={look ? "mt-1 leading-relaxed" : "font-reading mt-1 text-sm leading-relaxed text-foreground/80"}>
          {p}
        </p>
      ))}
      {!!block.dialogue?.length && <DialogueBubbles lines={block.dialogue} />}
      {block.table && <BlockTable table={block.table} primary={primary} light={light} />}
      {block.diagram?.type === "map" && <TownMap block={block} primary={primary} />}
      {checklist ? (
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {block.items!.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-[3px] border-[1.5px]" style={{ borderColor: primary }} />
              {itemText(item)}
            </li>
          ))}
        </ul>
      ) : block.diagram?.type === "prepositions" ? (
        <PrepositionList block={block} />
      ) : block.activity ? (
        <ActivityView block={block} primary={primary} light={light} />
      ) : (
        !!block.items?.length && (
          <ol className={look ? "mt-2 list-decimal pl-5" : "mt-2 list-decimal pl-5 text-sm text-foreground"}>
            {block.items.map((item, i) => (
              <li key={i}>{itemText(item)}</li>
            ))}
          </ol>
        )
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
    <section className="mt-4 rounded-xl border border-warning/30 bg-warning-soft p-4">
      <h4 className="font-heading text-base font-medium text-warning-soft-foreground">Glossary</h4>
      <dl className="mt-2 flex flex-col gap-2">
        {glossary.map((entry, i) => (
          <div key={i}>
            <dt className="text-sm font-medium text-foreground">{entry.term}</dt>
            <dd className="text-sm text-muted-foreground">
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
            <img src={imageUrl} alt="" className="h-full w-full object-contain" />
          </div>
        )}
        {imageUrl && !page.imageLayout && (
          <div
            className="absolute overflow-hidden rounded-md"
            style={{ left: PAGE_PADDING.left, top: PAGE_PADDING.top, right: PAGE_PADDING.right, height: 170 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image */}
            <img src={imageUrl} alt="" className="h-full w-full object-contain" />
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
  imageUrls,
  listeningAudio,
  renderBlockWrapper,
  look,
  unit,
  isUnitFirstPage = false,
}: {
  page: GeneratedPage;
  showAnswerKey: boolean;
  imageUrl?: string;
  /** Faz B3: every picture of the page (resolvePageImageUrls), main first. */
  imageUrls?: string[];
  listeningAudio?: ListeningAudio[];
  renderBlockWrapper?: BlockWrapper;
  /** Faz 1: the book's theme; templated pages fall back to the classic look without it. */
  look?: WebLook;
  /** Needed to draw a templated page's unit heading/running header. */
  unit?: { unitNumber: number; title: string };
  isUnitFirstPage?: boolean;
}) {
  const hasLayout = page.blocks.some((b) => b.layout) || !!page.imageLayout;
  // Faz 1 "Tasarım sistemi": same decision BookDocument.tsx makes, so the
  // reader shows the page the way it prints. Dizilim's block-dragging mode
  // (renderBlockWrapper) always gets the free-form canvas below.
  const template = !hasLayout && !renderBlockWrapper && unit ? resolvePageTemplate(page, !!imageUrl, { isUnitFirstPage, pictureCount: imageUrls?.length ?? (imageUrl ? 1 : 0) }) : "standard";
  if (template !== "standard" && unit) {
    const pageLook = look ?? CLASSIC_WEB_LOOK;
    return (
      <TemplatedPage
        template={template}
        page={page}
        unit={unit}
        isUnitFirstPage={isUnitFirstPage}
        imageUrl={imageUrl}
        imageUrls={imageUrls}
        look={pageLook}
        renderBlock={(block, { frameless }) => (
          <BlockView
            block={block}
            showAnswerKey={showAnswerKey}
            audio={listeningAudio?.find((a) => a.blockRef === block.heading)}
            look={pageLook}
            frameless={frameless}
          />
        )}
      />
    );
  }
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
          <img src={imageUrl} alt="" className="h-64 w-full rounded-md bg-muted/40 object-contain" />
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
