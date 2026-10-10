"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { upload as uploadToBlob } from "@vercel/blob/client";
import {
  DndContext,
  PointerSensor,
  useDraggable,
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

import type { BlockLayout, ContentBlock, GeneratedUnit } from "@/lib/ai/schemas";
import type { PageArrayField } from "@/lib/layout-merge";
import { withDefaultImageLayout, withDefaultLayouts } from "@/lib/layout-merge";
import { moveAudio, moveBlock, moveImage, movePage, reorderUnits } from "@/lib/arrangement-merge";
import type { Variant } from "@/lib/pdf/BookDocument";
import { PAGE_WIDTH_PT, PAGE_HEIGHT_PT, PAGE_PADDING } from "@/lib/pdf/page-geometry";
import { resolvePageImageUrl } from "@/lib/page-image";
import { DraggableBox } from "@/components/book/DraggableBox";
import type { WebLook } from "@/components/book/PageContent";
import { resolveDesignTheme } from "@/lib/design/themes";
import { derivePaletteFromColors } from "@/lib/pdf/derive-palette";
import { BookFlipViewer } from "@/components/book/BookFlipViewer";
import { Button } from "@/components/ui/button";

const PAGE_ARRAY_LABELS: Record<PageArrayField, string> = {
  studentBookPages: "Student Book",
  workbookPages: "Workbook",
  teacherBookPages: "Teacher's Book",
  testBookletPages: "Test Kitapçığı",
};

const PAGE_ARRAY_TO_VARIANT: Record<PageArrayField, Variant> = {
  studentBookPages: "student_book",
  workbookPages: "workbook",
  teacherBookPages: "teacher_book",
  testBookletPages: "test_booklet",
};

type PageDragData =
  | { kind: "page"; unitNumber: number; index: number }
  | { kind: "block"; unitNumber: number; pageIndex: number; blockIndex: number; heading: string }
  | { kind: "image"; unitNumber: number; pageIndex: number }
  | { kind: "audio"; unitNumber: number; audioIndex: number; blockRef: string };

// "Dizilim → Gerçek Kitap" (2026-09-22): merges what used to be two separate
// post-hoc editors - this one (whole unit/page reordering + a flip-book
// preview) and the old LayoutEditor.tsx (free-form block drag/resize within
// one page) - into a single editor, per the approved plan. The flip-book
// preview now renders real page content (PageView/PositionedPage, same
// components BookReader.tsx uses) instead of a "first block only" stub, and
// a block can be dragged from its page card onto another page's card to move
// it there (see moveBlock in arrangement-merge.ts) - LayoutEditor.tsx's
// within-page drag/resize lives on here as the "Konumlandır" panel below.
// Works on an already-completed book only (same "post-hoc editor, not a
// pipeline step" scope as before). Unit order is shared by every book type
// (one `units` array drives all variants); page order/block edits are
// scoped to whichever book type is currently selected (its own page array).
export function ArrangementEditor({
  projectId,
  bookTitle,
  level,
  initialUnits,
  pageImages: initialPageImages,
  designTheme,
  paletteColors,
}: {
  projectId: string;
  bookTitle: string;
  level: string;
  initialUnits: GeneratedUnit[];
  pageImages: Record<number, string>;
  /** Faz 1: so the flip-book preview shows the book's real page designs. */
  designTheme?: string | null;
  paletteColors?: string[];
}) {
  const [units, setUnits] = useState(initialUnits);
  const [pageArrayField, setPageArrayField] = useState<PageArrayField>("studentBookPages");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<{ unitNumber: number; pageIndex: number } | null>(null);
  // Faz C2 ("kullanıcının kendi görselini ekleyebilmesi", 2026-09-28): state
  // (not just the initial prop) because handleImageUpload below needs to
  // update it locally right after a successful upload, same as `units`.
  const [pageImages, setPageImages] = useState(initialPageImages);
  const [uploadingImage, setUploadingImage] = useState(false);
  const editCanvasRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const availableFields = (Object.keys(PAGE_ARRAY_LABELS) as PageArrayField[]).filter((f) =>
    units.some((u) => (u[f]?.length ?? 0) > 0),
  );

  const showAnswerKey = ["workbook", "teacher_book", "test_booklet"].includes(PAGE_ARRAY_TO_VARIANT[pageArrayField]);
  const theme = resolveDesignTheme(designTheme);
  const look: WebLook = {
    theme,
    palette: derivePaletteFromColors(paletteColors) ?? theme.palettes[PAGE_ARRAY_TO_VARIANT[pageArrayField]],
  };

  const flatPages = useMemo(
    () =>
      units.flatMap((u) =>
        (u[pageArrayField] ?? []).map((page, index) => ({ page, unitNumber: u.unitNumber, unitTitle: u.title, index })),
      ),
    [units, pageArrayField],
  );

  const editingUnit = editingPage ? units.find((u) => u.unitNumber === editingPage.unitNumber) : undefined;
  const editingPageData = editingUnit ? (editingUnit[pageArrayField] ?? [])[editingPage!.pageIndex] : undefined;
  const editingBlocks = editingPageData ? withDefaultLayouts(editingPageData) : [];
  const editingImageUrl = editingPageData ? resolvePageImageUrl(editingPageData, pageImages) : undefined;
  const editingImageLayout = editingPageData ? withDefaultImageLayout(editingPageData) : undefined;

  function handleUnitDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = units.findIndex((u) => `unit-${u.unitNumber}` === active.id);
    const toIndex = units.findIndex((u) => `unit-${u.unitNumber}` === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    setUnits((prev) => reorderUnits(prev, fromIndex, toIndex));
    setMessage(null);
  }

  // Handles BOTH whole-page drags (SortablePageCard) and single-block drags
  // (DraggableBlockChip) - they share one DndContext ("page-dnd") so a block
  // can be dropped onto any page card regardless of which unit column it's
  // in. Disambiguated via active.data.current.kind.
  function handlePageDndEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as PageDragData | undefined;
    if (!activeData) return;

    if (activeData.kind === "block") {
      const overId = String(over.id);
      // Bir bloğu doğrudan bir ünite sütununa (belirli bir sayfa değil)
      // bırakmak anlamsız - hangi sayfaya ekleneceği belirsiz kalır.
      if (overId.startsWith("column-")) return;
      const overData = over.data.current as PageDragData | undefined;
      if (!overData || overData.kind !== "page") return;
      if (overData.unitNumber === activeData.unitNumber && overData.index === activeData.pageIndex) return;

      setUnits((prev) => {
        const { units: next, audioMoved } = moveBlock(
          prev,
          { unitNumber: activeData.unitNumber, pageArrayField, pageIndex: activeData.pageIndex, blockIndex: activeData.blockIndex },
          { unitNumber: overData.unitNumber, pageArrayField, pageIndex: overData.index },
        );
        setMessage(
          audioMoved
            ? `"${activeData.heading}" bloğu ve bağlı dinleme sesi Ünite ${overData.unitNumber}'e taşındı.`
            : `"${activeData.heading}" bloğu taşındı.`,
        );
        return next;
      });
      return;
    }

    if (activeData.kind === "image") {
      const overId = String(over.id);
      // Aynı gerekçe: bir görseli belirli bir sayfa yerine bir ünite
      // sütununa bırakmak anlamsız kalır.
      if (overId.startsWith("column-")) return;
      const overData = over.data.current as PageDragData | undefined;
      if (!overData || overData.kind !== "page") return;
      if (overData.unitNumber === activeData.unitNumber && overData.index === activeData.pageIndex) return;

      setUnits((prev) => {
        try {
          const next = moveImage(
            prev,
            { unitNumber: activeData.unitNumber, pageArrayField, pageIndex: activeData.pageIndex },
            { unitNumber: overData.unitNumber, pageArrayField, pageIndex: overData.index },
            pageImages,
          );
          setMessage(`Görsel Ünite ${overData.unitNumber}'e taşındı.`);
          return next;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Görsel taşınamadı.");
          return prev;
        }
      });
      return;
    }

    if (activeData.kind === "audio") {
      // Ses ünite bazlı olduğu için (bkz. ListeningAudio.blockRef) hedef
      // her zaman bir ÜNİTE - hem bir sayfa kartına hem doğrudan sütuna
      // bırakmak aynı anlama gelir, ikisi de o ünitenin numarasını verir.
      const overId = String(over.id);
      let toUnitNumber: number;
      if (overId.startsWith("column-")) {
        toUnitNumber = Number(overId.replace("column-", ""));
      } else {
        const overData = over.data.current as PageDragData | undefined;
        if (!overData || (overData.kind !== "page" && overData.kind !== "audio")) return;
        toUnitNumber = overData.unitNumber;
      }
      if (toUnitNumber === activeData.unitNumber) return;

      setUnits((prev) => {
        try {
          const next = moveAudio(prev, activeData.unitNumber, activeData.audioIndex, toUnitNumber);
          setMessage(`"${activeData.blockRef}" dinleme sesi Ünite ${toUnitNumber}'e taşındı.`);
          return next;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Ses taşınamadı.");
          return prev;
        }
      });
      return;
    }

    let toUnitNumber: number;
    let toIndex: number;
    const overId = String(over.id);
    if (overId.startsWith("column-")) {
      toUnitNumber = Number(overId.replace("column-", ""));
      toIndex = units.find((u) => u.unitNumber === toUnitNumber)?.[pageArrayField]?.length ?? 0;
    } else {
      const overData = over.data.current as PageDragData | undefined;
      if (!overData || overData.kind !== "page") return;
      toUnitNumber = overData.unitNumber;
      toIndex = overData.index;
    }
    if (toUnitNumber === activeData.unitNumber && toIndex === activeData.index) return;

    setUnits((prev) => movePage(prev, activeData.unitNumber, pageArrayField, activeData.index, toUnitNumber, toIndex));
    setMessage(null);
  }

  function commitPageBlocks(unitNumber: number, pageIndex: number, blocks: ContentBlock[]) {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.unitNumber !== unitNumber) return u;
        const pages = (u[pageArrayField] ?? []).map((p, i) => (i === pageIndex ? { ...p, blocks } : p));
        return { ...u, [pageArrayField]: pages };
      }),
    );
  }

  function updateBlockLayout(index: number, layout: BlockLayout) {
    if (!editingPage) return;
    const nextBlocks = editingBlocks.map((b, i) => (i === index ? { ...b, layout } : b));
    commitPageBlocks(editingPage.unitNumber, editingPage.pageIndex, nextBlocks);
  }

  function reorderBlock(index: number, direction: "front" | "back") {
    if (!editingPage) return;
    const nextBlocks = [...editingBlocks];
    const [moved] = nextBlocks.splice(index, 1);
    if (direction === "front") nextBlocks.push(moved);
    else nextBlocks.unshift(moved);
    commitPageBlocks(editingPage.unitNumber, editingPage.pageIndex, nextBlocks);
  }

  function updateImageLayout(layout: BlockLayout) {
    if (!editingPage) return;
    setUnits((prev) =>
      prev.map((u) => {
        if (u.unitNumber !== editingPage.unitNumber) return u;
        const pages = (u[pageArrayField] ?? []).map((p, i) => (i === editingPage.pageIndex ? { ...p, imageLayout: layout } : p));
        return { ...u, [pageArrayField]: pages };
      }),
    );
  }

  // Faz C2 ("kullanıcının kendi görselini ekleyebilmesi", 2026-09-28): the
  // page's own single image slot (imagePrompt/pageImages, the same slot
  // generateUnitImages fills with an AI-generated image) can now also be set
  // by the user directly - uploaded, then persisted immediately (not
  // deferred to the "Kaydet" button, so a page refresh never loses it), and
  // freely repositioned afterward via the existing imageLayout/DraggableBox
  // mechanism below - no schema change needed, this reuses the exact same
  // one-image-per-page slot every other renderer already reads.
  async function handleImageUpload(file: File) {
    if (!editingPage || !editingPageData) return;
    setUploadingImage(true);
    setError(null);
    try {
      const blob = await uploadToBlob(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload-page-image",
        contentType: file.type,
      });
      const key = editingPageData.imageOverrideSourcePageNumber ?? editingPageData.sourcePageNumber;
      const nextPageImages = { ...pageImages, [key]: blob.url };
      const res = await fetch(`/api/projects/${projectId}/books/arrangement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units, pageImages: nextPageImages }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Görsel yüklenemedi.");
      }
      setPageImages(nextPageImages);
      setMessage("Görsel yüklendi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Görsel yüklenemedi.");
    } finally {
      setUploadingImage(false);
    }
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
        // QA fix (2026-10-06): only book types that actually have pages -
        // requesting all four built empty (cover + contents only) Teacher's
        // Book / Test Booklet PDFs for projects that never generated them.
        body: JSON.stringify({ bookTypes: availableFields.map((f) => PAGE_ARRAY_TO_VARIANT[f]) }),
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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Sayfa düzeni</p>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-[2.1rem]">Dizilim</h1>
          <p className="text-sm text-muted-foreground">
            {bookTitle} {level && `· ${level}`}
          </p>
        </div>
        <Button variant="outline" render={<Link href={`/projects/${projectId}`} />}>
          Projeye dön
        </Button>
      </div>

      <p className="mt-4 max-w-3xl text-xs text-muted-foreground">
        Üniteleri sürükleyerek birbirine göre sıralayabilir, bir sayfayı aynı ünite içinde ya da BAŞKA bir üniteye
        sürükleyip taşıyabilirsiniz. Bir sayfanın içindeki blokları serbestçe konumlandırmak için
        &quot;Konumlandır&quot;a tıklayın. Ünite sırası TÜM kitap tiplerinde ortaktır; sayfa/blok/görsel/ses
        düzenlemeleri sadece aşağıda seçili kitap tipi içindir. Sağdaki dijital önizleme artık sayfadaki tüm içeriği
        ve varsa dinleme sesini gösterir.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Sürükle-bırak:</span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>⠿</span> metin bloğu
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>🖼</span> görsel
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>🔊</span> dinleme sesi
        </span>
        <span>— her birini başka bir sayfa kartının üzerine sürükleyerek oraya taşıyabilirsiniz.</span>
      </div>

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
              <h2 className="text-sm font-medium text-foreground">Sayfa ve blok düzeni</h2>
              <select
                value={pageArrayField}
                onChange={(e) => {
                  setPageArrayField(e.target.value as PageArrayField);
                  setEditingPage(null);
                }}
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
              >
                {availableFields.map((f) => (
                  <option key={f} value={f}>
                    {PAGE_ARRAY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            <DndContext id="page-dnd" sensors={sensors} onDragEnd={handlePageDndEnd}>
              <div className="mt-2 flex flex-col gap-4">
                {units.map((u) => (
                  <PageColumn
                    key={u.unitNumber}
                    unitNumber={u.unitNumber}
                    unitTitle={u.title}
                    pages={u[pageArrayField] ?? []}
                    pageImages={pageImages}
                    listeningAudio={u.listeningAudio ?? []}
                    onEditPage={(pageIndex) => setEditingPage({ unitNumber: u.unitNumber, pageIndex })}
                  />
                ))}
              </div>
            </DndContext>
          </section>
        </div>

        <aside className="flex flex-col items-center gap-3">
          <h2 className="self-start text-sm font-medium text-foreground">Dijital önizleme</h2>
          <BookFlipViewer
            flatPages={flatPages}
            pageImages={pageImages}
            showAnswerKey={showAnswerKey}
            listeningAudioByUnit={(unitNumber) => units.find((u) => u.unitNumber === unitNumber)?.listeningAudio}
            look={look}
          />
        </aside>
      </div>

      {editingPage && editingPageData && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">
              Sayfa Konumlandırma — Ünite {editingPage.unitNumber}, Sayfa {editingPage.pageIndex + 1}
            </h2>
            <div className="flex gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent">
                {uploadingImage ? "Yükleniyor…" : "Görsel yükle"}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  disabled={uploadingImage}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void handleImageUpload(file);
                  }}
                />
              </label>
              <Button variant="outline" size="sm" onClick={() => setEditingPage(null)}>
                Kapat
              </Button>
            </div>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Bir bloğu sürükleyerek taşı, sağ-alt köşesinden sürükleyerek yeniden boyutlandır. Kutu sınırlarını aşan
            içerik gerçek PDF&apos;te de görsel olarak kırpılır. Bu bloğu BAŞKA bir sayfaya taşımak için önce
            kapatıp yukarıdaki sayfa kartındaki etiketi sürükleyin. &quot;Görsel yükle&quot; ile bu sayfanın görselini
            kendi fotoğrafınızla değiştirip yukarıdaki kutuyu sürükleyerek istediğiniz konum/boyuta getirebilirsiniz.
          </p>
          <div
            ref={editCanvasRef}
            className="relative mt-4 overflow-hidden rounded-lg border border-border bg-white shadow-sm"
            style={{ width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT }}
          >
            <div
              className="pointer-events-none absolute border border-dashed border-border/60"
              style={{
                left: PAGE_PADDING.left,
                top: PAGE_PADDING.top,
                right: PAGE_PADDING.right,
                bottom: PAGE_PADDING.bottom,
              }}
            />
            {editingImageUrl && editingImageLayout && (
              <DraggableBox
                layout={editingImageLayout}
                canvasRef={editCanvasRef}
                onChange={updateImageLayout}
                className="border-2 border-dashed border-primary/50 bg-primary/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image */}
                <img src={editingImageUrl} alt="" className="h-full w-full object-cover" />
              </DraggableBox>
            )}
            {editingBlocks.map((block, i) => (
              <DraggableBox key={i} layout={block.layout} canvasRef={editCanvasRef} onChange={(layout) => updateBlockLayout(i, layout)}>
                <div className="flex h-full flex-col overflow-hidden rounded-md border-l-4 border-primary bg-card p-2 text-card-foreground">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs font-semibold">{block.heading}</p>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => reorderBlock(i, "back")}
                        className="rounded bg-secondary px-1 text-[10px] text-secondary-foreground"
                        title="Arkaya gönder"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => reorderBlock(i, "front")}
                        className="rounded bg-secondary px-1 text-[10px] text-secondary-foreground"
                        title="Öne getir"
                      >
                        ↑
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 overflow-hidden text-[10px] text-muted-foreground">{block.body}</p>
                </div>
              </DraggableBox>
            ))}
          </div>
        </section>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {message && <p className="mt-4 text-sm text-success">{message}</p>}

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
  listeningAudio,
  onEditPage,
}: {
  unitNumber: number;
  unitTitle: string;
  pages: GeneratedUnit["studentBookPages"];
  pageImages: Record<number, string>;
  listeningAudio: NonNullable<GeneratedUnit["listeningAudio"]>;
  onEditPage: (pageIndex: number) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `column-${unitNumber}` });
  return (
    <div ref={setNodeRef} className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Ünite {unitNumber} · {unitTitle}
        </p>
        {!!listeningAudio.length && (
          <div className="flex flex-wrap gap-1">
            {listeningAudio.map((audio, i) => (
              <DraggableAudioChip key={i} unitNumber={unitNumber} audioIndex={i} blockRef={audio.blockRef} />
            ))}
          </div>
        )}
      </div>
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
              imageUrl={resolvePageImageUrl(page, pageImages)}
              blocks={page.blocks}
              onEdit={() => onEditPage(index)}
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
  blocks,
  onEdit,
}: {
  id: string;
  unitNumber: number;
  index: number;
  heading: string;
  sectionLabel?: string;
  imageUrl?: string;
  blocks: ContentBlock[];
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { kind: "page", unitNumber, index } satisfies PageDragData,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex w-40 flex-col gap-1 rounded-md border border-border bg-secondary p-2 text-secondary-foreground"
    >
      <div {...attributes} {...listeners} className="flex cursor-grab flex-col gap-1 active:cursor-grabbing">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image
          <img src={imageUrl} alt="" className="h-14 w-full rounded object-cover" />
        )}
        {sectionLabel && <span className="text-[9px] font-semibold uppercase text-primary">{sectionLabel}</span>}
        <span className="truncate text-[11px]">{heading}</span>
      </div>
      {imageUrl && (
        <div className="border-t border-border/60 pt-1">
          <DraggableImageChip unitNumber={unitNumber} pageIndex={index} />
        </div>
      )}
      {!!blocks.length && (
        <div className="flex flex-col gap-0.5 border-t border-border/60 pt-1">
          {blocks.map((b, i) => (
            <DraggableBlockChip key={i} unitNumber={unitNumber} pageIndex={index} blockIndex={i} heading={b.heading} />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="mt-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20"
      >
        Konumlandır
      </button>
    </div>
  );
}

// Denetim sonrası düzeltme (2026-09-23): daha önce 10px, tek renkli, "etiket
// listesi" gibi görünen bir buton olduğundan çoğu kullanıcı bunun sürüklenebilir
// olduğunu fark etmiyordu - artık gerçek bir "tutamak" ikonu (⠿), belirgin
// kenarlık ve daha büyük dokunma alanı var; üstteki lejant de bunu açıkça
// anlatıyor (bkz. ArrangementEditor'ün üst kısmındaki "Sürükle-bırak" satırı).
const CHIP_BASE_CLASS =
  "flex w-full cursor-grab items-center gap-1 truncate rounded border px-1.5 py-1 text-left text-[10px] active:cursor-grabbing";

// Bir sayfadaki tek bir metin bloğunu temsil eden, sürüklenebilir küçük
// etiket - başka bir SortablePageCard'ın üzerine bırakıldığında
// ArrangementEditor'ün handlePageDndEnd'i moveBlock'u tetikler. Aynı
// "page-dnd" DndContext'i paylaştığı için (useDraggable, useSortable'ın da
// üzerine kurulu olduğu aynı ilkel), sayfa sürükleme ile aynı sürükle-bırak
// oturumunda sorunsuz bir arada çalışır.
function DraggableBlockChip({
  unitNumber,
  pageIndex,
  blockIndex,
  heading,
}: {
  unitNumber: number;
  pageIndex: number;
  blockIndex: number;
  heading: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${unitNumber}-${pageIndex}-${blockIndex}`,
    data: { kind: "block", unitNumber, pageIndex, blockIndex, heading } satisfies PageDragData,
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      title="Başka bir sayfaya sürükle"
      className={`${CHIP_BASE_CLASS} border-primary/40 bg-primary/5 text-foreground/80 ${isDragging ? "opacity-40" : ""}`}
    >
      <span aria-hidden className="shrink-0 text-primary">
        ⠿
      </span>
      <span className="truncate">{heading}</span>
    </button>
  );
}

// Sayfanın görselini temsil eden sürüklenebilir etiket - moveImage'ı
// tetikler (arrangement-merge.ts). Sadece görseli olan sayfa kartlarında
// görünür (bkz. SortablePageCard).
function DraggableImageChip({ unitNumber, pageIndex }: { unitNumber: number; pageIndex: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `image-${unitNumber}-${pageIndex}`,
    data: { kind: "image", unitNumber, pageIndex } satisfies PageDragData,
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      title="Görseli başka bir sayfaya sürükle"
      className={`${CHIP_BASE_CLASS} border-warning/40 bg-warning-soft text-warning-soft-foreground ${isDragging ? "opacity-40" : ""}`}
    >
      <span aria-hidden>🖼</span>
      <span className="truncate">Görsel</span>
    </button>
  );
}

// Ünitenin bir dinleme sesini temsil eden sürüklenebilir etiket - ses
// sayfa değil ünite bazlı olduğundan (bkz. ListeningAudio şeması) bu, tek
// tek sayfa kartlarında değil PageColumn'un başlığında görünür ve hedefi
// her zaman bir ünite (bir sayfa kartına ya da doğrudan sütuna bırakılabilir
// - moveAudio'yu tetikler, arrangement-merge.ts).
function DraggableAudioChip({
  unitNumber,
  audioIndex,
  blockRef,
}: {
  unitNumber: number;
  audioIndex: number;
  blockRef: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `audio-${unitNumber}-${audioIndex}`,
    data: { kind: "audio", unitNumber, audioIndex, blockRef } satisfies PageDragData,
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      title="Başka bir üniteye sürükle"
      className={`${CHIP_BASE_CLASS} w-auto max-w-28 border-info/40 bg-info-soft text-info-soft-foreground ${isDragging ? "opacity-40" : ""}`}
    >
      <span aria-hidden>🔊</span>
      <span className="truncate">{blockRef}</span>
    </button>
  );
}
