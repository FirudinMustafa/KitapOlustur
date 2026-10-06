import type { GeneratedPage, GeneratedUnit } from "@/lib/ai/schemas";

type Variant = "student_book" | "workbook" | "teacher_book" | "test_booklet";

// QA fix (2026-10-06): the writer model is explicitly asked for a
// unit-level glossary (unit.glossary - key terms with definitions and
// examples) and the language reviewer checks it, but no renderer ever showed
// it - PDF, EPUB, DOCX, Common Cartridge, Markdown and the web reader all only
// render page.glossary, so those definitions were silently dropped from every
// export. Rather than teaching six renderers a new section, the unit
// glossary's entries that aren't already on one of the unit's pages are
// appended to the unit's LAST page glossary, which every renderer already
// displays. Test booklets are excluded - a definitions list there would hand
// students the answers.
//
// Display-only: never feed the result back into a save path (Dizilim's
// arrangement merge), or the merged entries would be persisted onto the page.
export function withUnitGlossary(unit: GeneratedUnit, pages: GeneratedPage[], variant: Variant): GeneratedPage[] {
  if (variant === "test_booklet" || !pages.length || !unit.glossary?.length) return pages;

  const key = (term: string) => term.trim().toLocaleLowerCase("tr-TR");
  const onPages = new Set(pages.flatMap((p) => p.glossary ?? []).map((g) => key(g.term)));
  const extras = unit.glossary.filter((g) => g.term?.trim() && !onPages.has(key(g.term)));
  if (!extras.length) return pages;

  const last = pages[pages.length - 1];
  return [...pages.slice(0, -1), { ...last, glossary: [...(last.glossary ?? []), ...extras] }];
}
