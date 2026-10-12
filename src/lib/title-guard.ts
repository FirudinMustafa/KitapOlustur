// Live test 2026-10-12: the outline prompt says "invent a fresh title, never
// the source's series name", and the model still named the new book
// "The Incredible 5 Team: Student Book 2" - the source's trademarked title.
// A deterministic check: the title copies the source when two or more of its
// distinctive words appear in the source's front pages (cover, title page,
// contents). Generic coursebook words don't count.
const GENERIC = new Set([
  "the", "and", "for", "with", "your", "book", "books", "student", "students", "student's", "workbook", "teacher",
  "teacher's", "level", "english", "edition", "course", "coursebook", "unit", "units", "grade", "starter", "test",
  "booklet", "practice", "skills", "language",
]);

export function distinctiveWords(title: string, locale = "en"): string[] {
  return [
    ...new Set(
      title
        .toLocaleLowerCase(locale)
        .split(/[^\p{L}\p{N}']+/u)
        .filter((w) => w.length >= 4 && !GENERIC.has(w) && !/^\d+$/.test(w)),
    ),
  ];
}

export function titleCopiesSource(title: string, sourceFrontText: string, locale = "en"): boolean {
  const words = distinctiveWords(title, locale);
  if (!words.length) return false;
  const text = ` ${sourceFrontText.toLocaleLowerCase(locale).replace(/[^\p{L}\p{N}']+/gu, " ")} `;
  const found = words.filter((w) => text.includes(` ${w} `));
  return found.length >= Math.min(2, words.length);
}
