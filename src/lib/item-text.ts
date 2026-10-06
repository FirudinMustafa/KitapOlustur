// QA fix (2026-10-06): the writer model often numbers practice items and
// answer-key entries itself ("1. The big, green monster."), while every
// renderer (reader <ol>, PDF/DOCX/Markdown "{n}. ", EPUB/LMS <ol>) adds its
// own number too - so books printed "1. 1. The big, green monster." Strip a
// leading numeric marker before rendering; the renderer's own numbering stays.
const LEADING_NUMBER = /^\s*\(?\d{1,3}[.)]\s+/;

export function itemText(item: string): string {
  return item.replace(LEADING_NUMBER, "");
}
