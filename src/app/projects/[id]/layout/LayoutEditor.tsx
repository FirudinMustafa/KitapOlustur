"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { GeneratedUnit, ContentBlock, BlockLayout } from "@/lib/ai/schemas";
import type { PageArrayField } from "@/lib/layout-merge";
import { PAGE_WIDTH_PT, PAGE_HEIGHT_PT, PAGE_PADDING, CONTENT_WIDTH_PT } from "@/lib/pdf/page-geometry";
import { Button } from "@/components/ui/button";

const PAGE_ARRAY_LABELS: Record<PageArrayField, string> = {
  studentBookPages: "Student Book",
  workbookPages: "Workbook",
  teacherBookPages: "Teacher's Book",
  testBookletPages: "Test Kitapçığı",
};
const MIN_BLOCK_SIZE = 24;
// Naive starting height for a block that has never been positioned - just
// enough to start editing from something close to the current flow's stacked
// look; the user resizes to fit their actual content immediately after.
const DEFAULT_BLOCK_HEIGHT = 130;

// Faz "Sayfa Dizilimi Editörü": drags/resizes ONE page's blocks (and its
// optional page image) at a time on a fixed-size canvas matching the real
// A4 PDF page 1:1 in PDF points - see page-geometry.ts and BookDocument.tsx's
// BlockCard for why coordinates are relative to the page's own top-left
// corner. State pattern mirrors AdvancedImagePanel.tsx (per-concern
// useState, plain fetch + try/catch/finally, no external state library).
export function LayoutEditor({
  projectId,
  bookTitle,
  initialUnits,
  pageImages,
}: {
  projectId: string;
  bookTitle: string;
  initialUnits: GeneratedUnit[];
  pageImages: Record<number, string>;
}) {
  const [units, setUnits] = useState(initialUnits);
  const [unitNumber, setUnitNumber] = useState(initialUnits[0]?.unitNumber ?? 1);
  const [pageArrayField, setPageArrayField] = useState<PageArrayField>("studentBookPages");
  const [pageIndex, setPageIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const unit = units.find((u) => u.unitNumber === unitNumber);
  const pages = unit?.[pageArrayField] ?? [];
  const page = pages[pageIndex];

  // Blocks always carry a layout once this page is opened for editing - any
  // block that never had one gets a sensible default (stacked, full content
  // width) so dragging always starts from something close to the current
  // flow's look instead of everything piling up at (0,0).
  const blocks: (ContentBlock & { layout: BlockLayout })[] = (() => {
    if (!page) return [];
    let nextY = PAGE_PADDING.top;
    return page.blocks.map((block) => {
      if (block.layout) {
        nextY = Math.max(nextY, block.layout.y + block.layout.height);
        return block as ContentBlock & { layout: BlockLayout };
      }
      const layout: BlockLayout = { x: PAGE_PADDING.left, y: nextY, width: CONTENT_WIDTH_PT, height: DEFAULT_BLOCK_HEIGHT };
      nextY += DEFAULT_BLOCK_HEIGHT + 12;
      return { ...block, layout };
    });
  })();

  const imageUrl = page ? pageImages[page.sourcePageNumber] : undefined;
  const imageLayout: BlockLayout = page?.imageLayout ?? {
    x: PAGE_PADDING.left,
    y: PAGE_PADDING.top,
    width: CONTENT_WIDTH_PT,
    height: 170,
  };

  function updateBlockLayout(index: number, layout: BlockLayout) {
    const nextBlocks = blocks.map((b, i) => (i === index ? { ...b, layout } : b));
    commitBlocks(nextBlocks);
  }

  function reorderBlock(index: number, direction: "front" | "back") {
    const nextBlocks = [...blocks];
    const [moved] = nextBlocks.splice(index, 1);
    if (direction === "front") nextBlocks.push(moved);
    else nextBlocks.unshift(moved);
    commitBlocks(nextBlocks);
  }

  function commitBlocks(nextBlocks: (ContentBlock & { layout: BlockLayout })[]) {
    if (!unit || !page) return;
    const nextUnits = units.map((u) => {
      if (u.unitNumber !== unitNumber) return u;
      const nextPages = (u[pageArrayField] ?? []).map((p, i) => (i === pageIndex ? { ...p, blocks: nextBlocks } : p));
      return { ...u, [pageArrayField]: nextPages };
    });
    setUnits(nextUnits);
  }

  function updateImageLayout(layout: BlockLayout) {
    if (!unit) return;
    const nextUnits = units.map((u) => {
      if (u.unitNumber !== unitNumber) return u;
      const nextPages = (u[pageArrayField] ?? []).map((p, i) => (i === pageIndex ? { ...p, imageLayout: layout } : p));
      return { ...u, [pageArrayField]: nextPages };
    });
    setUnits(nextUnits);
  }

  async function handleSave() {
    if (!page) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/books/layout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitNumber,
          pageArrayField,
          pageIndex,
          blocks,
          imageLayout: imageUrl ? imageLayout : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Kaydedilemedi.");
      }
      setMessage("Düzen kaydedildi.");
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

  if (!unit || !page) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-foreground">Sayfa Düzeni</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bu ünite/kitap tipi için düzenlenecek bir sayfa yok.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Sayfa Düzeni</h1>
          <p className="mt-1 text-sm text-muted-foreground">{bookTitle}</p>
        </div>
        <Button variant="outline" render={<Link href={`/projects/${projectId}`} />}>
          Projeye dön
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground">Ünite</span>
          <select
            value={unitNumber}
            onChange={(e) => {
              setUnitNumber(Number(e.target.value));
              setPageIndex(0);
            }}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          >
            {units.map((u) => (
              <option key={u.unitNumber} value={u.unitNumber}>
                Ünite {u.unitNumber}: {u.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground">Kitap tipi</span>
          <select
            value={pageArrayField}
            onChange={(e) => {
              setPageArrayField(e.target.value as PageArrayField);
              setPageIndex(0);
            }}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          >
            {(Object.keys(PAGE_ARRAY_LABELS) as PageArrayField[])
              .filter((f) => (unit[f]?.length ?? 0) > 0)
              .map((f) => (
                <option key={f} value={f}>
                  {PAGE_ARRAY_LABELS[f]}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground">Sayfa</span>
          <select
            value={pageIndex}
            onChange={(e) => setPageIndex(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          >
            {pages.map((p, i) => (
              <option key={i} value={i}>
                Sayfa {i + 1} (kaynak s.{p.sourcePageNumber})
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Bir bloğu sürükleyerek taşı, sağ-alt köşesinden sürükleyerek yeniden boyutlandır. Kutu sınırlarını aşan
        içerik gerçek PDF&apos;te de görsel olarak kırpılır - bu, react-pdf&apos;in otomatik sayfa taşırmasının
        (wrap) mutlak konumlandırılmış bloklarda çalışmamasından kaynaklanan bilinen bir sınır.
      </p>

      <div
        ref={canvasRef}
        className="relative mt-4 overflow-hidden rounded-lg border border-border bg-white shadow-sm"
        style={{ width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT }}
      >
        {/* Sayfa kenar boşluğu göstergesi - salt görsel bir kılavuz */}
        <div
          className="pointer-events-none absolute border border-dashed border-border/60"
          style={{
            left: PAGE_PADDING.left,
            top: PAGE_PADDING.top,
            right: PAGE_PADDING.right,
            bottom: PAGE_PADDING.bottom,
          }}
        />
        {imageUrl && (
          <DraggableBox
            layout={imageLayout}
            canvasRef={canvasRef}
            onChange={updateImageLayout}
            className="border-2 border-dashed border-primary/50 bg-primary/5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image */}
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          </DraggableBox>
        )}
        {blocks.map((block, i) => (
          <DraggableBox key={i} layout={block.layout} canvasRef={canvasRef} onChange={(layout) => updateBlockLayout(i, layout)}>
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

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {message && <p className="mt-3 text-sm text-green-700 dark:text-green-400">{message}</p>}

      <div className="mt-4 flex gap-3">
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

// Tek bir sürüklenebilir/yeniden boyutlandırılabilir kutu. `key`'e x/y/width/
// height dahil edilerek her commit sonrası motion.div yeniden mount edilir -
// framer-motion'ın kendi iç drag transform'unu sıfırlar, böylece kalıcı
// state (CSS left/top) ile görsel konum arasında sapma birikmez.
function DraggableBox({
  layout,
  canvasRef,
  onChange,
  className,
  children,
}: {
  layout: BlockLayout;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onChange: (layout: BlockLayout) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      key={`${layout.x}-${layout.y}-${layout.width}-${layout.height}`}
      drag
      dragMomentum={false}
      dragConstraints={canvasRef}
      onDragEnd={(_e, info) => {
        onChange({ ...layout, x: layout.x + info.offset.x, y: layout.y + info.offset.y });
      }}
      className={`absolute cursor-move ${className ?? ""}`}
      style={{ left: layout.x, top: layout.y, width: layout.width, height: layout.height }}
    >
      {children}
      <motion.div
        drag
        dragMomentum={false}
        onPointerDown={(e) => e.stopPropagation()}
        onDragEnd={(_e, info) => {
          onChange({
            ...layout,
            width: Math.max(MIN_BLOCK_SIZE, layout.width + info.offset.x),
            height: Math.max(MIN_BLOCK_SIZE, layout.height + info.offset.y),
          });
        }}
        className="absolute bottom-0 right-0 size-3 cursor-nwse-resize rounded-tl bg-primary"
      />
    </motion.div>
  );
}
