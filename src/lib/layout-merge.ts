import type { BlockLayout, ContentBlock, GeneratedPage, GeneratedUnit } from "./ai/schemas";
import { PAGE_PADDING, CONTENT_WIDTH_PT, CONTENT_HEIGHT_PT } from "./pdf/page-geometry";

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
// QA fix (2026-10-06): with a fixed 130pt slot, a page with 6+ blocks
// stacked its later blocks below the 842pt page - invisible in the editor
// canvas (overflow hidden) and clamped on top of each other in the PDF. Slots
// now shrink so every unpositioned block starts out inside the content box.
const BLOCK_GAP = 12;
const MIN_DEFAULT_BLOCK_HEIGHT = 40;

export function withDefaultLayouts(page: GeneratedPage): (ContentBlock & { layout: BlockLayout })[] {
  const unpositioned = page.blocks.filter((b) => !b.layout).length;
  const slotHeight = unpositioned
    ? Math.max(
        MIN_DEFAULT_BLOCK_HEIGHT,
        Math.min(DEFAULT_BLOCK_HEIGHT, Math.floor(CONTENT_HEIGHT_PT / unpositioned) - BLOCK_GAP),
      )
    : DEFAULT_BLOCK_HEIGHT;
  let nextY = PAGE_PADDING.top;
  return page.blocks.map((block) => {
    if (block.layout) {
      nextY = Math.max(nextY, block.layout.y + block.layout.height);
      return block as ContentBlock & { layout: BlockLayout };
    }
    const layout: BlockLayout = { x: PAGE_PADDING.left, y: nextY, width: CONTENT_WIDTH_PT, height: slotHeight };
    nextY += slotHeight + BLOCK_GAP;
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

// QA fix (2026-10-06): a page where only SOME blocks carry a `.layout`
// (legacy data - today's editor always saves every block on a positioned
// page) printed its absolutely positioned blocks on top of the flow blocks
// in both the PDF and the web reader. Filling the gaps with
// withDefaultLayouts slots doesn't help either - those slots collide with
// the stored boxes and push text off the page. Such a page is rendered fully
// in normal flow instead (no overlap, no clipped text, page wrapping works);
// re-saving it in the Dizilim editor positions every block again. Fully
// positioned pages are left exactly as the user arranged them.
export function blocksForRender(page: GeneratedPage): ContentBlock[] {
  const positioned = page.blocks.filter((b) => b.layout).length;
  if (positioned === 0 || positioned === page.blocks.length) return page.blocks;
  return page.blocks.map((block) => ({ ...block, layout: undefined }));
}

// QA fix (2026-10-06): an absolutely positioned block that extends past the
// bottom of the page (e.g. dragged low in the editor, or a stacked default
// slot like y=800/height=130 on an 842pt A4 page) sent react-pdf's page
// wrapping into an endless loop - the assembly step ran until the process
// ran out of memory. Every positioned box is clamped inside the page before
// rendering.
export function clampLayoutToPage(layout: BlockLayout, pageWidth: number, pageHeight: number): BlockLayout {
  const width = Math.max(1, Math.min(layout.width, pageWidth));
  const height = Math.max(1, Math.min(layout.height, pageHeight));
  return {
    x: Math.min(Math.max(0, layout.x), pageWidth - width),
    y: Math.min(Math.max(0, layout.y), pageHeight - height),
    width,
    height,
  };
}
