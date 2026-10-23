// KIYAS-13 review: a "Find, color and say" exercise listed "Picture 1:
// Misty's T-shirt" ... "Picture 4: the door" on a page with one picture -
// the source page had four, the generated one did not. Items that point at
// a numbered picture the page does not have are sent back to the writer;
// if they survive, the "Picture N:" pointer is dropped so the item still
// reads ("Misty's T-shirt").
type RefBlock = { heading?: string; body?: string; items?: string[] };
type RefPage = { sourcePageNumber: number; blocks: RefBlock[]; imagePrompt?: string; extraImagePrompts?: string[] };

const PICTURE_REF = /\bpicture\s+(\d+)\b/gi;
const PICTURE_PREFIX = /^\s*picture\s+(\d+)\s*[:.)-]\s*/i;

export function pagePictureCount(page: RefPage): number {
  return (page.imagePrompt?.trim() ? 1 : 0) + (page.extraImagePrompts?.filter((p) => p.trim()).length ?? 0);
}

function highestRef(block: RefBlock): number {
  let max = 0;
  for (const text of [block.body ?? "", ...(block.items ?? [])]) for (const m of text.matchAll(PICTURE_REF)) max = Math.max(max, Number(m[1]));
  return max;
}

export function missingPictureRefIssue(page: RefPage, label: string): string | null {
  const have = pagePictureCount(page);
  const block = page.blocks.find((b) => highestRef(b) > have);
  if (!block) return null;
  return `${label}, page ${page.sourcePageNumber}, block "${block.heading}": refers to picture ${highestRef(block)} but the page has ${have} picture${have === 1 ? "" : "s"}. Either give the page that many pictures (imagePrompt + extraImagePrompts) or rewrite the items so they do not point at numbered pictures.`;
}

// `have`: the pictures that will really print, when known (the PDF passes the
// images it has - a prompt whose picture failed prints nothing).
export function dropMissingPictureRefs<P extends RefPage>(page: P, have = pagePictureCount(page)): P {
  let changed = false;
  const blocks = page.blocks.map((b) => {
    if (highestRef(b) <= have || !b.items?.length) return b;
    changed = true;
    return { ...b, items: b.items.map((i) => i.replace(PICTURE_PREFIX, (m, n) => (Number(n) > have ? "" : m))) };
  });
  return changed ? { ...page, blocks } : page;
}
