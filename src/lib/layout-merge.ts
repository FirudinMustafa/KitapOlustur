import type { BlockLayout, ContentBlock, GeneratedUnit } from "./ai/schemas";

export type PageArrayField = "studentBookPages" | "workbookPages" | "teacherBookPages" | "testBookletPages";

// Faz "Sayfa Dizilimi Editörü": the one place that mutates a run's assembled
// content post-hoc (every generatedBooks row for a run stores an identical
// copy of the same `units` array - see the API route that calls this for why
// all rows get rewritten together). Pure/deterministic on purpose so it's
// testable without a DB - the route itself only does the load/save I/O.
export function mergePageLayout(
  units: GeneratedUnit[],
  unitNumber: number,
  pageArrayField: PageArrayField,
  pageIndex: number,
  updatedBlocks: ContentBlock[],
  imageLayout?: BlockLayout,
): GeneratedUnit[] {
  const unitIndex = units.findIndex((u) => u.unitNumber === unitNumber);
  if (unitIndex === -1) {
    throw new Error(`Ünite ${unitNumber} bulunamadı.`);
  }
  const unit = units[unitIndex];
  const pages = unit[pageArrayField];
  if (!pages || pageIndex < 0 || pageIndex >= pages.length) {
    throw new Error(`Ünite ${unitNumber} için ${pageArrayField}[${pageIndex}] sayfası bulunamadı.`);
  }

  const updatedPage = {
    ...pages[pageIndex],
    blocks: updatedBlocks,
    ...(imageLayout ? { imageLayout } : {}),
  };
  const updatedPages = pages.map((p, i) => (i === pageIndex ? updatedPage : p));
  const updatedUnit = { ...unit, [pageArrayField]: updatedPages };

  return units.map((u, i) => (i === unitIndex ? updatedUnit : u));
}
