// Lesson furniture (2026-10-24, hand-made i5 comparison): what a teen or
// adult coursebook prints around a lesson's exercises, and the hand-set
// version of i5 Team 2 printed while the system did not -
//   - a lesson tab at the top of the lesson's first page: its code on a
//     badge and its title ("1a Moving day"), or the title alone (the
//     starter module's "Let's Start!");
//   - section heads before the exercise groups (Reading, Vocabulary,
//     Grammar, Listening, Speaking and Writing, Everyday English,
//     Pronunciation);
//   - a "Check these words" box beside the tab: the lesson's key words;
//   - footer pointers to the lesson's review and workbook pages.
// Measured from the source (source-layout.ts lessonFurniture) so a young
// learners' book, which prints none of it, gets none. The writer may name
// a page's lessonCode / lessonTitle / lessonWords and a block's section;
// where it did not, they are worked out here.
//
// Pure - shared by the renderer, the workflow and scripts.

export const LESSON_SECTIONS = [
  "Reading",
  "Vocabulary",
  "Grammar",
  "Listening",
  "Speaking",
  "Writing",
  "Speaking and Writing",
  "Listening and Speaking",
  "Everyday English",
  "Pronunciation",
] as const;
export type LessonSection = (typeof LESSON_SECTIONS)[number];

// A line that is a section head: exactly a section's name, whatever is
// printed around it (an icon glyph, a leading space).
export function sectionHeadOf(text: string): LessonSection | null {
  const t = text.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "").replace(/\s+/g, " ").toLowerCase();
  return LESSON_SECTIONS.find((s) => s.toLowerCase() === t) ?? null;
}

type BlockLike = {
  heading: string;
  body: string;
  items?: string[];
  table?: unknown;
  callout?: string;
  dialogue?: unknown[];
  textStyle?: string;
  section?: LessonSection;
};

const short = (items: string[] | undefined) => !!items?.length && items.every((i) => i.split(/\s+/).length <= 3);

// The section an exercise belongs to, from its rubric when the writer did
// not say: "Listen and repeat" over a word list is Vocabulary, a table or
// grammar box is Grammar, "Read..." is Reading, "Talk / Ask / Write..." is
// Speaking and Writing. Null when the rubric does not tell.
export function inferSection(b: BlockLike): LessonSection | null {
  if (b.section) return b.section;
  const t = `${b.heading} ${b.body}`.toLowerCase();
  if (/\b(pronunciation|stress|intonation|sounds?)\b/.test(t)) return "Pronunciation";
  if (b.callout === "grammar" || b.table || /\b(grammar|the table)\b/.test(t)) return "Grammar";
  if (/\blisten and repeat\b/.test(t) && short(b.items)) return "Vocabulary";
  if (/\bread\b/.test(t)) return "Reading";
  if (/\blisten\b/.test(t)) return "Listening";
  if (/\b(everyday english|useful phrases|role[- ]?play)\b/.test(t)) return "Everyday English";
  // "Write about your room" is a writing task; "Write the numbers" fills gaps.
  if (/\b(talk|ask|discuss|tell|act out|interview|portfolio|in pairs|in groups|over to you)\b|\bwrite (about|a|an|your|to)\b/.test(t)) return "Speaking and Writing";
  if (/\b(words?|vocabulary|label|phrases)\b/.test(t)) return "Vocabulary";
  return null;
}

// What the source page prints of a lesson's furniture, as stored on the
// mirrored page (sourceShape.lesson).
export type LessonShape = {
  /** The page opens a lesson: with a code ("1a") or a title alone. */
  head?: "coded" | "titled";
  /** How many section heads the page prints. */
  sections?: number;
  wordBox?: boolean;
  pointers?: boolean;
};

export function lessonShape(layout: {
  lessonHead?: { coded: boolean };
  sectionHeads?: string[];
  wordBox?: boolean;
  pointers?: boolean;
}): LessonShape | undefined {
  const shape: LessonShape = {
    ...(layout.lessonHead ? { head: layout.lessonHead.coded ? ("coded" as const) : ("titled" as const) } : {}),
    ...(layout.sectionHeads?.length ? { sections: layout.sectionHeads.length } : {}),
    ...(layout.wordBox ? { wordBox: true } : {}),
    ...(layout.pointers ? { pointers: true } : {}),
  };
  return Object.keys(shape).length ? shape : undefined;
}

// Book level: the source has lessons when it prints lesson codes or section
// heads on at least two pages. Super Minds prints page titles but neither.
export function hasLessonFurniture(layouts: ({ lessonHead?: { coded: boolean }; sectionHeads?: string[] } | null | undefined)[]): boolean {
  const coded = layouts.filter((l) => l?.lessonHead?.coded).length;
  const sectioned = layouts.filter((l) => l?.sectionHeads?.length).length;
  return coded >= 2 || sectioned >= 2;
}

type PageLike<B extends BlockLike> = {
  blocks: B[];
  sectionLabel?: string;
  lessonCode?: string;
  lessonTitle?: string;
  lessonWords?: string[];
  glossary?: { term: string }[];
  sourceShape?: { lesson?: LessonShape } | null;
};

export type PageLesson = {
  tab?: { code?: string; title: string };
  /** The lesson's key words, for the box beside the tab. */
  words?: string[];
  /** The footer pointers ("Student's Book: Language Review 1a", "Workbook: 1a"). */
  pointers?: string[];
};

const MAX_WORDS = 10;
const LETTERS = "abcdefghij";

// Each page's lesson furniture through a unit's pages: a lesson starts on a
// page whose source opens one, and goes on until the next. Codes run 1a,
// 1b... in a numbered unit (the writer's own code wins); a unit 0 (a
// starter module) has titled lessons only.
export function planLessons<B extends BlockLike, P extends PageLike<B>>(
  pages: P[],
  unit: { unitNumber: number; title: string; glossary?: { term: string }[] },
): PageLesson[] {
  let lesson = -1;
  let code: string | undefined;
  const used = new Set<string>();
  return pages.map((page, i) => {
    const shape = page.sourceShape?.lesson;
    const out: PageLesson = {};
    if (shape?.head) {
      lesson++;
      code =
        page.lessonCode?.trim() || (shape.head === "coded" && unit.unitNumber >= 1 ? `${unit.unitNumber}${LETTERS[lesson] ?? ""}` : undefined);
      const title = page.lessonTitle?.trim() || (code ? page.sectionLabel?.trim() : undefined) || unit.title;
      out.tab = { ...(code ? { code } : {}), title };
      if (shape.wordBox) {
        const words = lessonWords(pages, i, unit.glossary ?? [], used);
        if (words.length) out.words = words;
      }
    }
    if (shape?.pointers && code) out.pointers = [`Student's Book: Language Review ${code}`, `Workbook: ${code}`];
    return out;
  });
}

// The lesson's key words: the writer's, else the page's glossary, else the
// unit glossary's terms that the lesson's pages use (then the unit's
// terms no earlier lesson took).
function lessonWords<B extends BlockLike>(pages: PageLike<B>[], start: number, glossary: { term: string }[], used: Set<string>): string[] {
  const page = pages[start];
  const pick = (words: string[]) => {
    const out = [...new Set(words.map((w) => w.trim()).filter(Boolean))].slice(0, MAX_WORDS);
    out.forEach((w) => used.add(w.toLowerCase()));
    return out;
  };
  if (page.lessonWords?.length) return pick(page.lessonWords);
  if (page.glossary?.length) return pick(page.glossary.map((g) => g.term));
  let end = start + 1;
  while (end < pages.length && !pages[end].sourceShape?.lesson?.head) end++;
  const text = pages
    .slice(start, end)
    .flatMap((p) => p.blocks.flatMap((b) => [b.heading, b.body, ...(b.items ?? [])]))
    .join(" ")
    .toLowerCase();
  const terms = glossary.map((g) => g.term).filter((t) => !used.has(t.toLowerCase()));
  const inLesson = terms.filter((t) => new RegExp(`\\b${t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text));
  return pick(inLesson.length >= 3 ? inLesson : [...inLesson, ...terms.filter((t) => !inLesson.includes(t))].slice(0, 8));
}

// The page's blocks with `section` kept only where a head prints: on a page
// whose source prints section heads, before the first exercise of each new
// section (at most as many as the source page has, plus one). Elsewhere
// none - the page prints no section heads.
export function withSectionHeads<B extends BlockLike>(blocks: B[], sections: number | undefined, isExercise: (b: B) => boolean): B[] {
  let current: LessonSection | null = null;
  let printed = 0;
  return blocks.map((b) => {
    const { section: _drop, ...plain } = b;
    void _drop;
    if (!sections || !isExercise(b)) return plain as B;
    const section = inferSection(b);
    if (!section || section === current || printed >= sections + 1) return plain as B;
    current = section;
    printed++;
    return { ...plain, section } as B;
  });
}
