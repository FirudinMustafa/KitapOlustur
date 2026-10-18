// Faz G4 (audit 2026-10-18): the free writer filled exercises with
// stand-ins - "Picture of a ball", "Item 1" - that printed in the book as
// if they were the exercise. An item must be the thing the learner reads.

const PLACEHOLDER = /^(?:(?:a |the )?(?:picture|image|photo|drawing|illustration) of\b|item \d+$|question \d+$|answer \d+$|example \d+$)/i;

export function isPlaceholderItem(item: string): boolean {
  return PLACEHOLDER.test(item.trim());
}

export function placeholderItemIssue(block: { heading: string; items?: string[] }, where: string): string | null {
  const found = (block.items ?? []).filter(isPlaceholderItem);
  if (!found.length) return null;
  return `${where}, block "${block.heading}": items ${found.map((f) => `"${f}"`).join(", ")} are placeholders, not exercise text. Write the real item the learner reads (for a picture item: the word itself, with the activity's emoji picture).`;
}
