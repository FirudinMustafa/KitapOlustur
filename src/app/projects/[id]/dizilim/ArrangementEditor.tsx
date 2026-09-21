"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { GeneratedUnit } from "@/lib/ai/schemas";
import type { PageArrayField } from "@/lib/layout-merge";
import { movePage, reorderUnits } from "@/lib/arrangement-merge";
import { Button } from "@/components/ui/button";
import "./flipbook.css";

// react-pageflip touches the DOM directly (page-flip.js under the hood) -
// same "use client"-only reasoning as LayoutEditor.tsx's framer-motion drag,
// but this one also needs a dynamic import with ssr:false since it reads
// `window` at module scope.
const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

const PAGE_ARRAY_LABELS: Record<PageArrayField, string> = {
  studentBookPages: "Student Book",
  workbookPages: "Workbook",
  teacherBookPages: "Teacher's Book",
  testBookletPages: "Test Kitapçığı",
};

const FLIP_PAGE_WIDTH = 300;
const FLIP_PAGE_HEIGHT = 420;

// "Dizilim" (2026-09-21, ROADMAP.md): reorders whole UNITS and whole PAGES
// relative to each other (including moving a page into a different unit) -
// distinct from LayoutEditor.tsx, which positions blocks WITHIN one page.
// Works on an already-completed book only (same "post-hoc editor, not a
// pipeline step" scope as LayoutEditor.tsx). Unit order is shared by every
// book type (one `units` array drives all variants); page order is scoped
// to whichever book type is currently selected (its own page array).
export function ArrangementEditor({
  projectId,
  bookTitle,
  level,
  initialUnits,
  pageImages,
}: {
  projectId: string;
  bookTitle: string;
  level: string;
  initialUnits: GeneratedUnit[];
  pageImages: Record<number, string>;
}) {
  const [units, setUnits] = useState(initialUnits);
  const [pageArrayField, setPageArrayField] = useState<PageArrayField>("studentBookPages");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const flipBookRef = useRef<{ pageFlip: () => { flipNext: () => void; flipPrev: () => void } } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const availableFields = (Object.keys(PAGE_ARRAY_LABELS) as PageArrayField[]).filter((f) =>
    units.some((u) => (u[f]?.length ?? 0) > 0),
  );

  const flatPages = useMemo(
    () =>
      units.flatMap((u) =>
        (u[pageArrayField] ?? []).map((page, index) => ({ page, unitNumber: u.unitNumber, unitTitle: u.title, index })),
      ),
    [units, pageArrayField],
  );

  function handleUnitDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = units.findIndex((u) => `unit-${u.unitNumber}` === active.id);
    const toIndex = units.findIndex((u) => `unit-${u.unitNumber}` === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    setUnits((prev) => reorderUnits(prev, fromIndex, toIndex));
    setMessage(null);
  }

  function handlePageDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as { unitNumber: number; index: number } | undefined;
    if (!activeData) return;

    let toUnitNumber: number;
    let toIndex: number;
    const overId = String(over.id);
    if (overId.startsWith("column-")) {
      toUnitNumber = Number(overId.replace("column-", ""));
      toIndex = units.find((u) => u.unitNumber === toUnitNumber)?.[pageArrayField]?.length ?? 0;
    } else {
      const overData = over.data.current as { unitNumber: number; index: number } | undefined;
      if (!overData) return;
      toUnitNumber = overData.unitNumber;
      toIndex = overData.index;
    }
    if (toUnitNumber === activeData.unitNumber && toIndex === activeData.index) return;

    setUnits((prev) => movePage(prev, activeData.unitNumber, pageArrayField, activeData.index, toUnitNumber, toIndex));
    setMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/books/arrangement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Kaydedilemedi.");
      }
      const body = await res.json();
      setUnits(body.units as GeneratedUnit[]);
      setMessage("Dizilim kaydedildi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookTypes: ["student_book", "workbook", "teacher_book", "test_booklet"] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Yeniden oluşturma başlatılamadı.");
      }
      setMessage("Yeniden oluşturma başlatıldı - proje sayfasından ilerlemeyi takip edebilirsin.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yeniden oluşturma başlatılamadı.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dizilim</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {bookTitle} {level && `· ${level}`}
          </p>
        </div>
        <Button variant="outline" render={<Link href={`/projects/${projectId}`} />}>
          Projeye dön
        </Button>
      </div>

      <p className="mt-4 max-w-3xl text-xs text-muted-foreground">
        Üniteleri sürükleyerek birbirine göre sıralayabilir, bir sayfayı aynı ünite içinde ya da
        BAŞKA bir üniteye sürükleyip taşıyabilirsiniz. Ünite sırası TÜM kitap tiplerinde ortaktır
        (aynı ünite dizisi paylaşılıyor); sayfa sırası sadece aşağıda seçili kitap tipi içindir.
        Sağdaki dijital önizleme, kaydetmeden önce gerçek sırayı görmeniz için hafif bir vekildir -
        birebir PDF kopyası değildir.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="text-sm font-medium text-foreground">Ünite sırası</h2>
            <DndContext id="unit-dnd" sensors={sensors} onDragEnd={handleUnitDragEnd}>
              <SortableContext items={units.map((u) => `unit-${u.unitNumber}`)} strategy={verticalListSortingStrategy}>
                <div className="mt-2 flex flex-col gap-2">
                  {units.map((u) => (
                    <SortableUnitCard key={u.unitNumber} unitNumber={u.unitNumber} title={u.title} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">Sayfa sırası</h2>
              <select
                value={pageArrayField}
                onChange={(e) => setPageArrayField(e.target.value as PageArrayField)}
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
              >
                {availableFields.map((f) => (
                  <option key={f} value={f}>
                    {PAGE_ARRAY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            <DndContext id="page-dnd" sensors={sensors} onDragEnd={handlePageDragEnd}>
              <div className="mt-2 flex flex-col gap-4">
                {units.map((u) => (
                  <PageColumn
                    key={u.unitNumber}
                    unitNumber={u.unitNumber}
                    unitTitle={u.title}
                    pages={u[pageArrayField] ?? []}
                    pageImages={pageImages}
                  />
                ))}
              </div>
            </DndContext>
          </section>
        </div>

        <aside className="flex flex-col items-center gap-3">
          <h2 className="self-start text-sm font-medium text-foreground">Dijital önizleme</h2>
          {flatPages.length > 0 ? (
            <>
              {/* @ts-expect-error -- react-pageflip's IProps typing doesn't
                  export cleanly through next/dynamic's inferred component type */}
              <HTMLFlipBook
                ref={flipBookRef}
                width={FLIP_PAGE_WIDTH}
                height={FLIP_PAGE_HEIGHT}
                size="fixed"
                minWidth={FLIP_PAGE_WIDTH}
                maxWidth={FLIP_PAGE_WIDTH}
                minHeight={FLIP_PAGE_HEIGHT}
                maxHeight={FLIP_PAGE_HEIGHT}
                showCover
                drawShadow
                flippingTime={500}
                usePortrait
                startZIndex={0}
                autoSize={false}
                maxShadowOpacity={0.5}
                mobileScrollSupport
                clickEventForward
                useMouseEvents
                swipeDistance={30}
                showPageCorners
                disableFlipByClick={false}
                startPage={0}
                className="rounded-lg shadow-lg"
                style={{}}
              >
                {flatPages.map(({ page, unitNumber, unitTitle, index }) => (
                  <div
                    key={`${unitNumber}-${page.sourcePageNumber}-${index}`}
                    className="flex h-full w-full flex-col gap-2 border border-border bg-white p-4 text-zinc-900"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                      Ünite {unitNumber} · {unitTitle}
                      {page.sectionLabel && ` · ${page.sectionLabel}`}
                    </span>
                    {pageImages[page.sourcePageNumber] && (
                      // eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image
                      <img
                        src={pageImages[page.sourcePageNumber]}
                        alt=""
                        className="h-28 w-full rounded object-cover"
                      />
                    )}
                    {page.blocks[0] && (
                      <div className="flex flex-col gap-1 overflow-hidden">
                        <p className="text-sm font-semibold">{page.blocks[0].heading}</p>
                        <p className="line-clamp-6 text-xs text-zinc-600">{page.blocks[0].body}</p>
                      </div>
                    )}
                  </div>
                ))}
              </HTMLFlipBook>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => flipBookRef.current?.pageFlip().flipPrev()}
                >
                  ← Önceki
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => flipBookRef.current?.pageFlip().flipNext()}
                >
                  Sonraki →
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Bu kitap tipi için sayfa yok.</p>
          )}
        </aside>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {message && <p className="mt-4 text-sm text-green-700 dark:text-green-400">{message}</p>}

      <div className="mt-6 flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <Button variant="outline" onClick={handleRegenerate} disabled={regenerating}>
          {regenerating ? "Başlatılıyor…" : "Yeniden oluştur (PDF)"}
        </Button>
      </div>
    </div>
  );
}

function SortableUnitCard({ unitNumber, title }: { unitNumber: number; title: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `unit-${unitNumber}`,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex cursor-grab items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-card-foreground active:cursor-grabbing"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {unitNumber}
      </span>
      <span className="truncate text-sm">{title}</span>
    </div>
  );
}

function PageColumn({
  unitNumber,
  unitTitle,
  pages,
  pageImages,
}: {
  unitNumber: number;
  unitTitle: string;
  pages: GeneratedUnit["studentBookPages"];
  pageImages: Record<number, string>;
}) {
  const { setNodeRef } = useDroppable({ id: `column-${unitNumber}` });
  return (
    <div ref={setNodeRef} className="rounded-lg border border-border p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Ünite {unitNumber} · {unitTitle}
      </p>
      <SortableContext
        items={pages.map((p) => `page-${unitNumber}-${p.sourcePageNumber}`)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="flex flex-wrap gap-2">
          {pages.length === 0 && <p className="text-xs text-muted-foreground">Sayfa yok - buraya bir sayfa bırakabilirsin.</p>}
          {pages.map((page, index) => (
            <SortablePageCard
              key={`${unitNumber}-${page.sourcePageNumber}`}
              id={`page-${unitNumber}-${page.sourcePageNumber}`}
              unitNumber={unitNumber}
              index={index}
              heading={page.blocks[0]?.heading ?? "(başlıksız)"}
              sectionLabel={page.sectionLabel}
              imageUrl={pageImages[page.sourcePageNumber]}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortablePageCard({
  id,
  unitNumber,
  index,
  heading,
  sectionLabel,
  imageUrl,
}: {
  id: string;
  unitNumber: number;
  index: number;
  heading: string;
  sectionLabel?: string;
  imageUrl?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { unitNumber, index },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex w-32 cursor-grab flex-col gap-1 rounded-md border border-border bg-secondary p-2 text-secondary-foreground active:cursor-grabbing"
    >
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image
        <img src={imageUrl} alt="" className="h-14 w-full rounded object-cover" />
      )}
      {sectionLabel && <span className="text-[9px] font-semibold uppercase text-primary">{sectionLabel}</span>}
      <span className="truncate text-[11px]">{heading}</span>
    </div>
  );
}
