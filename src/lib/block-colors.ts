import type { ContentBlockKind } from "@/lib/ai/schemas";

// Shared between the PDF renderer (src/lib/pdf/BookDocument.tsx) and the web
// reader (src/components/book/PageContent.tsx) so both surfaces
// differentiate a block visually by its `kind` the same way. Kept in its own
// module (2026-09-23) rather than re-exported from BookDocument.tsx because
// that file pulls in @react-pdf/renderer and a Node-only font-registration
// module ("node:path", process.cwd()) - importing it from PageContent.tsx
// (a "use client" component) would leak server-only code into the browser
// bundle.
export const BLOCK_COLORS: Record<ContentBlockKind, { text: string; bg: string; border: string }> = {
  narrative: { text: "#c2410c", bg: "#fff7ed", border: "#fb923c" },
  explanation: { text: "#1d4ed8", bg: "#eff6ff", border: "#60a5fa" },
  example: { text: "#0f766e", bg: "#f0fdfa", border: "#2dd4bf" },
  practice: { text: "#be185d", bg: "#fdf2f8", border: "#f472b6" },
  assessment: { text: "#374151", bg: "#f3f4f6", border: "#9ca3af" },
  reference: { text: "#3730a3", bg: "#eef2ff", border: "#818cf8" },
};
