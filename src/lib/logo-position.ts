import type { CSSProperties } from "react";

// Web-side (CSS) counterpart of BrandMarkPosition/LOGO_POSITION_STYLE in
// src/lib/pdf/BookDocument.tsx. Kept as its own tiny, framework-agnostic
// module rather than importing from BookDocument.tsx, same reasoning as
// src/lib/block-colors.ts's doc comment: that file pulls in
// @react-pdf/renderer and Node-only font registration ("node:path",
// process.cwd()), which must never leak into a "use client" bundle.
export type BrandMarkPosition =
  | "top_left"
  | "top_right"
  | "bottom_left"
  | "bottom_right"
  | "top_center"
  | "bottom_center"
  | "other";

// "other"/unset falls back to top_right, matching BookDocument.tsx's same
// fallback rationale (most common real-world placement).
export const LOGO_POSITION_CSS: Record<BrandMarkPosition, CSSProperties> = {
  top_left: { top: 12, left: 12 },
  top_right: { top: 12, right: 12 },
  top_center: { top: 12, left: "50%", transform: "translateX(-50%)" },
  bottom_left: { bottom: 12, left: 12 },
  bottom_right: { bottom: 12, right: 12 },
  bottom_center: { bottom: 12, left: "50%", transform: "translateX(-50%)" },
  other: { top: 12, right: 12 },
};

export function resolveLogoPositionStyle(position: string | null | undefined): CSSProperties {
  const key = (position ?? "top_right") as BrandMarkPosition;
  return LOGO_POSITION_CSS[key] ?? LOGO_POSITION_CSS.top_right;
}
