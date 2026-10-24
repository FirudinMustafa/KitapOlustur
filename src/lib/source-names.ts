// KIYAS-14 jury (2026-10-24): the new Super Minds book said "Point to Misty.
// Point to Leo." - Misty is the source's own character. The outline copied
// the source's example "I'm (Misty)", the improvement plan built a mascot on
// it, and every unit after that used her. title-guard.ts only ever checked
// the book title.
//
// Deterministic, no model call: the source's people and its series' own
// feature names are read out of the source page map (transcribed text and
// the page summaries), then
//   - given to the writer as names not to use (sourceNamesPrompt),
//   - checked on every written page (sourceNameIssues, validateUnitStructure),
//   - replaced, one fixed new name per source name for the whole book, in the
//     outline, improvement plan, style bible and any page they survive on
//     (renameSourceNames).
import { bandOf, isHeadword } from "@/lib/cefr-vocabulary";

export type SourceNamePage = { pageNumber: number; pageType?: string; sourceText?: string | null; summary?: string | null };

export type SourceNames = {
  // The source's recurring cast: on two or more pages, a speaker with two or
  // more turns, or introducing themselves ("I'm (Misty)"). A written page
  // using one of them is sent back.
  characters: string[];
  // Every person named in the source (characters included) - the writer is
  // told not to use them and they are renamed where they survive.
  names: string[];
  // The series' own feature headings ("Singing for Pleasure", "BIG
  // QUESTION", "Modular Revision"). A page heading using one is sent back.
  features: string[];
};

const CAP = "\\p{Lu}[\\p{Ll}]+";
const NAME_RE = new RegExp(`^${CAP}$`, "u");

// Capitalised words that are never a person, though no word list has them.
const NOT_NAMES = new Set([
  "let's", "lets", "ok", "okay", "mr", "mrs", "ms", "dr", "miss", "sir", "madam", "mum", "mom", "dad", "mummy", "daddy",
  "grandma", "grandpa", "granny", "grandad", "granddad", "auntie", "uncle", "teacher", "student", "students", "narrator",
  "boy", "girl", "man", "woman", "all", "both", "class", "everyone", "ex", "eg", "pp", "isbn", "tel", "fax", "email",
  "cds", "dvd", "dvds", "tv", "pc", "wow", "oops", "hey", "hi", "hello", "bye", "yeah", "yes", "no", "oh", "ah", "um",
  "book", "workbook", "grammar", "vocabulary", "reading", "listening", "speaking", "writing", "module", "unit", "lesson",
  "example", "note", "answer", "question", "questions", "key", "tip", "remember", "time", "today", "now",
]);

// Places a new book may well use too (a geography quiz, a pen friend's town)
// - not the source's own invention.
const PLACES = new Set([
  "africa", "america", "asia", "europe", "australia", "antarctica", "atlantic", "pacific", "arctic", "indian", "mediterranean",
  "usa", "uk", "britain", "england", "scotland", "wales", "ireland", "france", "germany", "spain", "italy", "greece",
  "portugal", "turkey", "egypt", "china", "japan", "india", "russia", "canada", "mexico", "brazil", "argentina", "kenya",
  "poland", "sweden", "norway", "finland", "denmark", "holland", "netherlands", "belgium", "switzerland", "austria",
  "korea", "thailand", "vietnam", "peru", "chile", "morocco", "nigeria", "london", "paris", "rome", "athens", "madrid",
  "berlin", "tokyo", "beijing", "istanbul", "ankara", "cairo", "sydney", "dublin", "edinburgh", "manchester", "liverpool",
  "oxford", "cambridge", "york", "new", "washington", "california", "texas", "florida", "nile", "amazon", "thames",
  "everest", "alps", "sahara", "christmas", "easter", "halloween", "english", "french", "spanish", "german", "italian",
  "greek", "turkish", "chinese", "japanese", "american", "british", "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december", "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday",
]);

// Words a coursebook's own section and exercise heads are made of. A heading
// built only from these is any coursebook's ("Listen and repeat",
// "Vocabulary Review", "Grammar box") - never a series feature.
export const GENERIC_HEADING = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "at", "with", "by", "from", "about", "my", "your", "our",
  "their", "his", "her", "its", "this", "that", "these", "it", "i", "you", "we", "me", "let's", "lets", "let", "what's",
  "unit", "units", "module", "modules", "lesson", "lessons", "starter", "welcome", "intro", "introduction", "review",
  "revision", "vocabulary", "grammar", "reading", "listening", "speaking", "writing", "pronunciation", "phonics", "song",
  "songs", "chant", "story", "stories", "project", "projects", "culture", "test", "tests", "quiz", "check", "progress",
  "extra", "practice", "practise", "skills", "skill", "language", "word", "words", "list", "bank", "box", "functions",
  "function", "phrases", "phrase", "everyday", "english", "focus", "time", "fun", "game", "games", "page", "pages",
  "contents", "book", "workbook", "student's", "students", "teacher's", "notes", "reference", "tables", "table",
  "listen", "repeat", "read", "write", "say", "point", "look", "match", "circle", "complete", "choose", "ask", "answer",
  "tick", "number", "find", "colour", "color", "count", "sing", "draw", "stick", "play", "act", "talk", "work", "pair",
  "pairs", "partner", "group", "groups", "then", "again", "sentences", "sentence", "picture", "pictures", "dialogue",
  "dialogues", "text", "texts", "question", "questions", "out", "up", "and", "can", "do", "i", "now", "more", "new",
  "part", "section", "exercise", "exercises", "activity", "activities", "task", "tasks", "topic", "topics", "learn",
  "learning", "learner", "learners", "end", "self", "assessment", "evaluation", "portfolio", "dictionary", "glossary",
  "wordlist", "irregular", "verbs", "verb", "audio", "video", "track", "cd", "dvd", "home", "school", "classroom", "hello",
  "goodbye", "about", "you", "me", "us", "all", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "first", "second", "third", "little", "yes", "no", "true", "false", "not", "given", "great", "good", "world", "life", "real",
  // grammar and function labels
  "present", "past", "future", "simple", "continuous", "progressive", "perfect", "passive", "conditional", "tense",
  "tenses", "comparatives", "superlatives", "comparative", "superlative", "plurals", "plural", "pronouns", "pronoun",
  "adjectives", "adjective", "adverbs", "adverb", "nouns", "noun", "articles", "prepositions", "preposition", "modals",
  "modal", "imperative", "imperatives", "short", "answers", "possessive", "possessives", "countable", "uncountable",
  "quantifiers", "inviting", "accepting", "refusing", "invitations", "invitation", "describing", "talking", "giving",
  "asking", "making", "suggestions", "directions", "opinions", "apologising", "greetings", "introductions",
]);

const CONNECTORS = new Set(["and", "for", "of", "the", "a", "to", "in", "on", "with", "&"]);

const isWord = (w: string) => isHeadword(w);
const cleanText = (s: string | null | undefined) => (s ?? "").replace(/[’‘`´]/g, "'");

type Evidence = { pages: Set<number>; speaker: number; intro: number; possessive: number; listed: number; inText: number; parens: boolean };

function plausibleName(w: string): boolean {
  const l = w.toLowerCase();
  return (NAME_RE.test(w) || /^\p{Lu}{2,6}$/u.test(w)) && w.length >= 2 && (w.length >= 3 || /^\p{Lu}+$/u.test(w)) && !NOT_NAMES.has(l) && !PLACES.has(l);
}

export function extractSourceNames(pages: SourceNamePage[]): SourceNames {
  const ev = new Map<string, Evidence>();
  const note = (name: string, page: number, kind: keyof Omit<Evidence, "pages" | "parens">, parens = false) => {
    if (!plausibleName(name)) return;
    const e = ev.get(name) ?? { pages: new Set(), speaker: 0, intro: 0, possessive: 0, listed: 0, inText: 0, parens: false };
    e.pages.add(page);
    e[kind]++;
    e.parens ||= parens;
    ev.set(name, e);
  };

  // The front matter (cover, title page, contents) names authors and the
  // series, not characters - its feature names are still read below.
  const bodyPages = pages.filter((p) => p.pageType !== "cover" && p.pageType !== "contents");
  for (const p of bodyPages) {
    const text = cleanText(p.sourceText);
    // "Sue: Hi!" - a speaker's turn ("Time expressions:" is two words, lower case).
    for (const m of text.matchAll(new RegExp(`(?:^|[\\n.!?]\\s*|\\s)(${CAP})(?: (${CAP}))?\\s*:\\s`, "gu"))) {
      if (!m[2]) note(m[1], p.pageNumber, "speaker");
    }
    // "ELF: Greetings, players!" - a speaker written in capitals.
    for (const m of text.matchAll(/(?:^|\n)(\p{Lu}{2,6})\s*:\s/gu)) {
      if (!isWord(m[1]) && !NOT_NAMES.has(m[1].toLowerCase())) note(m[1], p.pageNumber, "speaker");
    }
    // "I'm (Misty)", "My name's Lucy", "Hi, Anna", "This is Jenny".
    for (const m of text.matchAll(new RegExp(`\\b(?:I'm|I am|my name's|my name is|My name's|My name is|This is|this is|Hi,?|Hello,?|call me|called|named)\\s+(\\()?(${CAP})\\b`, "gu"))) {
      note(m[2], p.pageNumber, "intro", !!m[1]);
    }
    // "Kate's family tree", "Tina's room".
    for (const m of text.matchAll(new RegExp(`\\b(${CAP})'s\\b`, "gu"))) note(m[1], p.pageNumber, "possessive");
    // "Emma, Lee and Harry are..."
    for (const m of text.matchAll(new RegExp(`\\b(${CAP}), (${CAP})(?:, (${CAP}))*,? and (${CAP})\\b`, "gu"))) {
      for (const n of [m[1], m[2], m[3], m[4]]) if (n) note(n, p.pageNumber, "listed");
    }
    // A capitalised word inside a sentence ("helping Mona decorate").
    for (const m of text.matchAll(new RegExp(`(?<=[\\p{Ll},] )(${CAP})\\b(?!')`, "gu"))) note(m[1], p.pageNumber, "inText");
  }

  const names: string[] = [];
  const characters: string[] = [];
  for (const [name, e] of ev) {
    // A plain word ("Mark the sentences", "Frank") needs more than one sighting
    // to count as a person: a turn of its own twice, or "I'm (Frank)".
    const word = isWord(name);
    const named = e.speaker || e.intro || e.possessive || e.listed || (e.inText && e.pages.size >= 2);
    if (!named) continue;
    if (word && !(e.speaker >= 2 || e.parens)) continue;
    names.push(name);
    if (e.pages.size >= 2 || e.speaker >= 2 || e.intro) characters.push(name);
  }

  // A family tree or a class list: lines of one name each. Where three or
  // more such lines stand on a page and one of them is a known name, the
  // others are names too (i5 p.6: Bob, Helen, Beth, Frank, Jane...).
  const known = new Set(names);
  for (const p of bodyPages) {
    const lines = cleanText(p.sourceText)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => NAME_RE.test(l) && plausibleName(l) && !isWord(l));
    const unique = [...new Set(lines)];
    if (unique.length >= 3 && unique.some((l) => known.has(l))) {
      for (const l of unique) {
        if (known.has(l)) continue;
        known.add(l);
        names.push(l);
      }
    }
  }

  return { characters: characters.sort(), names: names.sort(), features: extractFeatures(pages, known) };
}

// A heading made only of generic coursebook words, numbers, names or places
// is not the series' own invention.
function distinctiveHeadingWords(phrase: string, names: Set<string>): string[] {
  return phrase
    .split(/[^\p{L}']+/u)
    .filter(Boolean)
    .filter((w) => !GENERIC_HEADING.has(w.toLowerCase()) && !names.has(w) && !PLACES.has(w.toLowerCase()));
}

const titleCaseWord = (w: string) => /^\p{Lu}/u.test(w);

function extractFeatures(pages: SourceNamePage[], names: Set<string>): string[] {
  const out = new Map<string, string>(); // lower-case key -> as printed
  const add = (phrase: string) => {
    const p = phrase.trim().replace(/\s+/g, " ").replace(/[\s\d:!.?-]+$/u, "");
    if (p.length < 4) return;
    const key = p.toLowerCase();
    if (!out.has(key)) out.set(key, p);
  };

  // Title-case runs of 2-5 words ("Singing for Pleasure", "Knowledge of
  // Language Means"), connectors allowed inside.
  const runRe = new RegExp(`${CAP}(?:\\s+(?:(?:and|for|of|the|to|in|on|with|&)\\s+)?${CAP}){1,4}`, "gu");
  const pagesOf = new Map<string, Set<number>>();
  for (const p of pages) {
    const text = cleanText(p.sourceText);
    for (const m of text.matchAll(runRe)) {
      const key = m[0].replace(/\s+/g, " ");
      (pagesOf.get(key) ?? pagesOf.set(key, new Set()).get(key)!).add(p.pageNumber);
    }
    // ALL-CAPS heads of two to four words ("BIG QUESTION", "SMALL TALK"),
    // which may wrap onto a second line.
    for (const m of text.matchAll(/\b\p{Lu}{2,}(?:\s+\p{Lu}{2,}){1,3}\b/gu)) {
      const words = m[0].split(/\s+/);
      if (words.length <= 4 && distinctiveHeadingWords(m[0].toLowerCase(), names).length && words.every((w) => bandOf(w) || GENERIC_HEADING.has(w.toLowerCase()))) add(m[0]);
    }
  }
  // Printed on two or more pages: the series' running feature - not a
  // person's full name ("Jenny Dooley", the author).
  for (const [phrase, on] of pagesOf) {
    if (on.size >= 2 && distinctiveHeadingWords(phrase, names).length && !phrase.split(/\s+/).every((w) => !isWord(w))) add(phrase);
  }
  // Quoted as a page's label in its summary ("labeled 'Story and Value'",
  // "'Modular Revision 1' review page", "'FunTime' page").
  for (const p of pages) {
    for (const m of cleanText(p.summary).matchAll(/'([^']{3,40})'/g)) {
      const phrase = m[1].replace(/\s+\d+$/, "");
      const words = phrase.split(/\s+/);
      if (!words.every((w) => titleCaseWord(w) || CONNECTORS.has(w.toLowerCase()))) continue;
      const distinctive = distinctiveHeadingWords(phrase, names);
      if (!distinctive.length || words.every((w) => names.has(w))) continue;
      // "My Classroom", "Say Hello!" are a page's topic; a series' feature
      // has a coined word ("FunTime"), a connector ("Story and Value") or
      // three or more words.
      const coined = distinctive.some((w) => !bandOf(w.replace(/[^\p{L}]/gu, "")));
      if (coined || words.length >= 3 || words.some((w) => CONNECTORS.has(w.toLowerCase()))) add(phrase);
    }
  }
  return [...out.values()].sort();
}

// ---- the writer's instruction ----

export function sourceNamesPrompt(names: SourceNames): string {
  const people = names.names;
  if (!people.length && !names.features.length) return "";
  return [
    "ORIGINALITY - the source book's own names belong to its publisher. Never use them anywhere (texts, dialogues, items, picture prompts, character names):",
    people.length ? `- people and characters in the source: ${people.join(", ")}` : "",
    names.features.length ? `- the source series' own feature and section names: ${names.features.map((f) => `"${f}"`).join(", ")} - name your book's features in your own words` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---- the check ----

type NamedBlock = { heading?: string; body?: string; items?: string[]; answerKey?: string[]; dialogue?: { speaker: string; line: string }[]; table?: { headers?: string[]; rows?: string[][] } };
type NamedPage = { sourcePageNumber: number; blocks: NamedBlock[]; imagePrompt?: string; extraImagePrompts?: string[]; sectionLabel?: string; lessonTitle?: string };

function pageStrings(page: NamedPage): string[] {
  return [
    page.imagePrompt ?? "",
    ...(page.extraImagePrompts ?? []),
    page.sectionLabel ?? "",
    page.lessonTitle ?? "",
    ...page.blocks.flatMap((b) => [
      b.heading ?? "",
      b.body ?? "",
      ...(b.items ?? []),
      ...(b.answerKey ?? []),
      ...(b.dialogue ?? []).flatMap((d) => [d.speaker, d.line]),
      ...(b.table?.headers ?? []),
      ...(b.table?.rows ?? []).flat(),
    ]),
  ].filter(Boolean);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A name as a whole word, written as a name.
function nameRegex(name: string): RegExp {
  return new RegExp(`(?<![\\p{L}])${escape(name)}(?![\\p{L}])`, "gu");
}

// A name that is also a plain word starts sentences as that word too: "Mark
// the sentences", "Will you...". At a sentence start it counts as the name
// unless an object follows it ("Frank is", "Frank's" and "Frank:" count).
const OBJECT_WORDS = new Set(["the", "a", "an", "your", "his", "her", "their", "our", "my", "you", "it", "this", "these", "those", "them", "all", "each", "every", "some", "any", "and", "or", "in", "on", "at", "to", "up", "down", "out"]);

function nameAt(text: string, name: string, index: number): boolean {
  if (!isWord(name)) return true;
  const before = text.slice(0, index).trimEnd();
  if (!(before === "" || /[.!?:"\n]$/.test(before))) return true;
  const next = text.slice(index + name.length).match(/^\s+([\p{L}']+)/u)?.[1]?.toLowerCase();
  return !next || !OBJECT_WORDS.has(next);
}

export function usedNames(text: string, names: string[]): string[] {
  return names.filter((n) => [...text.matchAll(nameRegex(n))].some((m) => nameAt(text, n, m.index!)));
}

export function usedFeatures(headings: string[], features: string[]): string[] {
  const text = headings.join("\n").toLowerCase();
  return features.filter((f) => new RegExp(`(?<![\\p{L}])${escape(f.toLowerCase())}(?![\\p{L}])`, "u").test(text));
}

export function sourceNameIssues(page: NamedPage, names: SourceNames, label: string): string[] {
  const issues: string[] = [];
  const people = usedNames(pageStrings(page).join("\n"), names.characters);
  if (people.length) {
    issues.push(
      `${label}, page ${page.sourcePageNumber}: uses the source book's own character name${people.length > 1 ? "s" : ""} ${people.map((n) => `"${n}"`).join(", ")} - this book has its own cast. Use the style bible's characters (or new names) instead, everywhere on the page including imagePrompt.`,
    );
  }
  const headings = [page.sectionLabel ?? "", page.lessonTitle ?? "", ...page.blocks.map((b) => b.heading ?? "")];
  const features = usedFeatures(headings, names.features);
  if (features.length) {
    issues.push(
      `${label}, page ${page.sourcePageNumber}: a heading uses the source series' own feature name ${features.map((f) => `"${f}"`).join(", ")} - name this feature in your own words.`,
    );
  }
  return issues;
}

// ---- the deterministic rename ----

// New names for the book: short, easy to read for young learners, and rare
// in published coursebooks.
const REPLACEMENT_NAMES = [
  "Pip", "Nell", "Arlo", "Juno", "Ravi", "Tess", "Kofi", "Mina", "Otis", "Wren", "Rafi", "Cleo", "Bodhi", "Effie", "Remy",
  "Suki", "Ivo", "Lark", "Nico", "Ada", "Teo", "Yara", "Bram", "Isla", "Zane", "Odile", "Kit", "Esme", "Joss", "Nia",
  "Ari", "Bea", "Cai", "Dara", "Eli", "Fen", "Gus", "Hana", "Ines", "Jago", "Kai", "Lulu", "Milo", "Noor", "Oona", "Pia",
  "Quin", "Rio", "Sana", "Timo", "Uma", "Vik", "Wim", "Xia", "Yusuf", "Zia", "Alba", "Bruno", "Coco", "Dev",
];

// One fixed replacement per source name, the same on every page. Names the
// book already uses (its style bible's cast) are not handed out again, nor
// is one name given to two source names; past the list a name stays as it is.
export function sourceNameReplacements(names: SourceNames, taken: string[] = []): Record<string, string> {
  const blocked = new Set([...names.names, ...taken].map((n) => n.toLowerCase()));
  const pool = REPLACEMENT_NAMES.filter((n) => !blocked.has(n.toLowerCase()));
  return Object.fromEntries(names.names.slice(0, pool.length).map((n, i) => [n, pool[i]]));
}

export function renameInText(text: string, map: Record<string, string>): string {
  let out = text;
  for (const [from, to] of Object.entries(map)) {
    out = out.replace(nameRegex(from), (m, index: number, whole: string) => (nameAt(whole, from, index) ? to : m));
  }
  return out;
}

// Keys that hold ids, links or audio data, never printed text.
const UNTOUCHED_KEYS = new Set(["id", "imageCharacters", "audioUrl", "imageUrl", "url", "wordTimestamps", "zonePlan", "sourceShape", "layout", "imageLayout"]);

// Every printed string in an outline, plan, style bible or unit, renamed.
export function renameSourceNames<T>(value: T, map: Record<string, string>): T {
  if (!Object.keys(map).length) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return renameInText(v, map);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, UNTOUCHED_KEYS.has(k) ? x : walk(x)]));
    return v;
  };
  return walk(value) as T;
}
