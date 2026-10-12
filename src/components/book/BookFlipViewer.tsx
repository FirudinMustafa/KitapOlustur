"use client";

import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import type { GeneratedPage, ListeningAudio } from "@/lib/ai/schemas";
import { PAGE_WIDTH_PT, PAGE_HEIGHT_PT } from "@/lib/pdf/page-geometry";
import { resolvePageImageUrl, resolvePageImageUrls } from "@/lib/page-image";
import { PageView, type WebLook } from "@/components/book/PageContent";
import { Button } from "@/components/ui/button";
import "./flipbook.css";

// react-pageflip touches the DOM directly (page-flip.js under the hood) -
// needs a dynamic import with ssr:false since it reads `window` at module
// scope. Extracted from ArrangementEditor.tsx's inline flip-book (Faz C1,
// "gerçek sayfa-çevirmeli okuma deneyimi", 2026-09-28) so BookReader.tsx can
// reuse the exact same real 3D page-turning viewer instead of duplicating
// it - both surfaces render the same PageView content, just from different
// data sources (a live edit session vs. a finished book's saved content).
const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

const FLIP_PAGE_WIDTH = 320;
const FLIP_PAGE_HEIGHT = Math.round(FLIP_PAGE_WIDTH * (PAGE_HEIGHT_PT / PAGE_WIDTH_PT));
const FLIP_SCALE = FLIP_PAGE_WIDTH / PAGE_WIDTH_PT;

// Cheap stable string hash (djb2) - only used to derive a React key.
function hashString(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export type FlipPageEntry = {
  page: GeneratedPage;
  unitNumber: number;
  unitTitle: string;
  index: number;
};

export function BookFlipViewer({
  flatPages,
  pageImages,
  showAnswerKey,
  listeningAudioByUnit,
  look,
}: {
  /** Faz 1: the book's theme, so templated pages flip the way they print. */
  look?: WebLook;
  flatPages: FlipPageEntry[];
  pageImages: Record<number, string>;
  showAnswerKey: boolean;
  listeningAudioByUnit: (unitNumber: number) => ListeningAudio[] | undefined;
}) {
  const flipBookRef = useRef<{ pageFlip: () => { flipNext: () => void; flipPrev: () => void } } | null>(null);

  // QA fix (2026-10-06): page-flip.js re-parents the page elements React
  // rendered into its own wrapper. Any later change to the pages (Dizilim:
  // dragging a page/block, editing a layout, uploading an image) made React
  // try to remove/reorder those nodes where they no longer are -
  // "removeChild: The node to be removed is not a child of this node" - which
  // crashed the whole editor. The flip-book is instead remounted from scratch
  // whenever its content changes, so React never patches nodes the library
  // has moved.
  const contentKey = useMemo(
    () => hashString(JSON.stringify([flatPages.map((e) => [e.unitNumber, e.index, e.page]), pageImages, showAnswerKey, look?.theme.id])),
    [flatPages, pageImages, showAnswerKey, look],
  );

  // Verified live (2026-09-28): page-flip.js (react-pageflip's engine)
  // measures its container once and caches that measurement - if it
  // measures before the surrounding layout has settled (routine right
  // after the dynamic import resolves, and again if a cover image loads
  // afterward and shifts page height), it either renders nothing at all or
  // renders every item offset by stale math (observed live: items pushed
  // up by exactly half their own height). A `resize` event is what it
  // listens for internally to re-measure and correct itself - a single
  // one-shot dispatch fixed Dizilim's flip-book (whose layout settles
  // before any image load matters) but NOT BookReader's, where the cover
  // image can still be loading past that point, so this fires a few times
  // over the first second to also catch a late image-driven reflow.
  useEffect(() => {
    const delays = [50, 300, 800];
    const ids = delays.map((ms) => setTimeout(() => window.dispatchEvent(new Event("resize")), ms));
    return () => ids.forEach(clearTimeout);
  }, [contentKey]);

  if (!flatPages.length) {
    return <p className="text-sm text-muted-foreground">Bu kitap tipi için sayfa yok.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* @ts-expect-error -- react-pageflip's IProps typing doesn't export
          cleanly through next/dynamic's inferred component type */}
      <HTMLFlipBook
        key={contentKey}
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
            className="paper flex h-full w-full flex-col overflow-hidden border border-border bg-background text-foreground"
          >
            <span className="shrink-0 bg-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
              Ünite {unitNumber} · {unitTitle}
              {page.sectionLabel && ` · ${page.sectionLabel}`}
            </span>
            <div className="min-h-0 flex-1 overflow-hidden">
              <div style={{ width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT, transform: `scale(${FLIP_SCALE})`, transformOrigin: "top left" }}>
                <PageView
                  page={page}
                  showAnswerKey={showAnswerKey}
                  imageUrl={resolvePageImageUrl(page, pageImages)}
                  imageUrls={resolvePageImageUrls(page, pageImages)}
                  listeningAudio={listeningAudioByUnit(unitNumber)}
                  look={look}
                  unit={{ unitNumber, title: unitTitle }}
                  isUnitFirstPage={index === 0}
                />
              </div>
            </div>
          </div>
        ))}
      </HTMLFlipBook>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => flipBookRef.current?.pageFlip().flipPrev()}>
          ← Önceki
        </Button>
        <Button variant="outline" size="sm" onClick={() => flipBookRef.current?.pageFlip().flipNext()}>
          Sonraki →
        </Button>
      </div>
    </div>
  );
}
