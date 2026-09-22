import type { BlockLayout, ContentBlock, GeneratedPage, GeneratedUnit } from "./ai/schemas";
import { PAGE_PADDING, CONTENT_WIDTH_PT } from "./pdf/page-geometry";

export type PageArrayField = "studentBookPages" | "workbookPages" | "teacherBookPages" | "testBookletPages";

// Naive starting height for a block that has never been positioned - just
// enough to start editing from something close to the current flow's
// stacked look; the user resizes to fit their actual content immediately
// after. (Originally lived inline in the old LayoutEditor.tsx; moved here
// once the merged Dizilim editor needed the same default.)
const DEFAULT_BLOCK_HEIGHT = 130;

// "Dizilim → Gerçek Kitap" (ArrangementEditor's page-positioning mode):
// assigns every block on a page a `.layout` - blocks that already have one
// keep it untouched, blocks that don't get a sensible stacked default (full
// content width, positioned below whatever came before) so an editor can
// always render/drag every block on a fixed canvas instead of everything
// piling up at (0,0). Pure/side-effect-free - does not mutate `page`.
export function withDefaultLayouts(page: GeneratedPage): (ContentBlock & { layout: BlockLayout })[] {
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
}

// Same idea as withDefaultLayouts but for a page's own illustration.
export function withDefaultImageLayout(page: GeneratedPage): BlockLayout {
  return page.imageLayout ?? { x: PAGE_PADDING.left, y: PAGE_PADDING.top, width: CONTENT_WIDTH_PT, height: 170 };
}

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
