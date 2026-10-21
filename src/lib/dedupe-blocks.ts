import { itemText } from "@/lib/item-text";

// KIYAS-13 (live, 2026-10-21): the writer repeated an exercise on the same
// page under a shortened heading - "5 Partner time: say and do" and then
// "5 Partner time", both with "Stand up, please." / "Thank you." - and the
// Student Book printed it twice. A later block with the same items as an
// earlier one, whose heading is the earlier heading or a prefix of it (or
// the other way round), is that repeat and is dropped.
type BlockLike = { heading?: string; items?: string[] };

const norm = (text: string) =>
  text
    .toLowerCase()
    .replace(/^\s*\d+[.)]?\s*/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function sameHeading(a: string | undefined, b: string | undefined): boolean {
  const x = norm(a ?? "");
  const y = norm(b ?? "");
  return !!x && !!y && (x.startsWith(y) || y.startsWith(x));
}

export function dropRepeatedBlocks<P extends { blocks: BlockLike[] }>(page: P): P {
  const kept: BlockLike[] = [];
  for (const block of page.blocks) {
    const items = (block.items ?? []).map((i) => norm(itemText(i))).join("|");
    const repeat =
      (block.items?.length ?? 0) >= 2 &&
      kept.some((k) => sameHeading(k.heading, block.heading) && (k.items ?? []).map((i) => norm(itemText(i))).join("|") === items);
    if (!repeat) kept.push(block);
  }
  return kept.length === page.blocks.length ? page : { ...page, blocks: kept as P["blocks"] };
}
