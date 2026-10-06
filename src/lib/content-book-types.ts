import type { GeneratedUnit } from "@/lib/ai/schemas";

const PAGE_FIELDS = {
  student_book: "studentBookPages",
  workbook: "workbookPages",
  teacher_book: "teacherBookPages",
  test_booklet: "testBookletPages",
} as const;

export type ContentBookType = keyof typeof PAGE_FIELDS;

// Book types the generated content actually has pages for. Teacher's Book /
// Test Booklet pages are only written when those types were requested at
// project creation - assembling one that has no pages produced an empty
// book (cover + contents only).
export function bookTypesWithContent(units: GeneratedUnit[] | null | undefined): ContentBookType[] {
  if (!Array.isArray(units)) return [];
  return (Object.keys(PAGE_FIELDS) as ContentBookType[]).filter((type) =>
    units.some((u) => (u[PAGE_FIELDS[type]]?.length ?? 0) > 0),
  );
}
