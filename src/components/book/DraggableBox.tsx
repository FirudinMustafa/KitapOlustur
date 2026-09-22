"use client";

import { motion } from "framer-motion";
import type { BlockLayout } from "@/lib/ai/schemas";

const MIN_BLOCK_SIZE = 24;

// Extracted from the old LayoutEditor.tsx (Faz "Sayfa Dizilimi Editörü") so
// the merged Dizilim page-positioning mode (ArrangementEditor.tsx) can reuse
// the exact same drag/resize behavior. `key` includes x/y/width/height so
// motion.div remounts after every commit - resets framer-motion's own
// internal drag transform so it can't drift from the persisted CSS
// left/top over repeated drags.
export function DraggableBox({
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
