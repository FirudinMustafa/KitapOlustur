// KIYAS-11 (live, 2026-10-18): the writer filled a block's `layout` -
// Dizilim's manual position - with {x:0, y:0, width:10, height:5}, though
// the schema says to leave it unset. A page with any manual position leaves
// its designed layout (resolvePageTemplate), so the page lost the source's
// arrangement and the block printed in a 10pt-wide box, a word per line.
// Positions come only from Dizilim, never from the writer.
export function dropWriterLayouts<P extends { imageLayout?: unknown; blocks: { layout?: unknown }[] }>(page: P): P {
  if (!page.imageLayout && !page.blocks.some((b) => b.layout)) return page;
  return {
    ...page,
    imageLayout: undefined,
    blocks: page.blocks.map((b) => {
      if (!b.layout) return b;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure-omit drops the key
      const { layout: _layout, ...rest } = b;
      return rest;
    }),
  };
}
