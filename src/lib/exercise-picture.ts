// Jury finding (2026-10-24): the system's pictures decorate the page and are
// often unrelated to its exercise - i5: a boy pointing at a blank board next
// to a family-tree exercise, an empty room for "What is in the room?", a lone
// globe for a school-subjects exercise. In the source the picture IS the
// exercise: numbered objects on a board, clocks showing the times, the
// family tree with its names.
//
// Deterministic, no model call: when an exercise works from the picture
// ("Look at the picture", "Listen and point", "Find", "Count", "What's in the
// room?") and the page's picture prompt names fewer than half of what the
// exercise asks about, the prompt is extended to show exactly those things -
// the listed objects, the clock times, the actions, the people named.
import { isHeadword } from "@/lib/cefr-vocabulary";
import { isExerciseBlock } from "@/lib/design/layouts";

type PictureBlock = Parameters<typeof isExerciseBlock>[0] & { heading: string; body: string; items?: string[]; answerKey?: string[] };
type PicturePage = { blocks: PictureBlock[]; imagePrompt?: string; sourceShape?: { pageType?: string } };

// Instructions that send the learner to the picture.
const LOOKS_AT_PICTURE =
  /\b(?:look at the [\p{L}' ]{0,24}?(?:picture|pictures|photo|photos|images?|scene|poster|board|family tree|map|room|clocks?|objects|things|desk|table|shelf)|look and (?:say|find|point|count|write|match|circle|colou?r|answer|choose|label|tick|complete)|listen and (?:point|find|number|circle|tick|colou?r|choose)|point (?:to|at|and say)|find (?:and|the|in)|count\b|how many\b|what(?:'s| is) (?:in|on) (?:the|his|her|my|your)|what is there|is there (?:a|an|any)\b|in the picture|label the|family tree|what time is it|what is \p{Lu}\p{Ll}+ doing)/iu;

// "Find the words", a word search or crossword: the words, not a picture.
const WORD_TASK = /\b(?:find|circle|look for|search)\b[^.]*\bwords?\b/i;

const STOP = new Set([
  "a", "an", "the", "some", "any", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "one", "my", "your",
  "his", "her", "their", "our", "its", "this", "that", "these", "those", "is", "are", "it", "there", "it's", "there's", "and",
  "or", "of", "in", "on", "at", "under", "next", "to", "behind", "between", "with", "for", "big", "small", "little", "new", "old",
]);

// Words in a speech line or a question, never in a thing's name.
const SPEECH = new Set(["i", "i'm", "you", "you're", "your", "we", "we're", "what", "what's", "where", "where's", "who", "how", "hello", "hi", "bye", "yes", "no", "is", "are", "am", "do", "does", "can", "look", "let's", "please", "thanks", "name"]);

// A thing's name too vague to draw: a riddle's "a tool for cutting paper"
// is drawn from its answer.
const VAGUE = new Set(["object", "objects", "thing", "things", "tool", "item", "place", "person", "animal", "word", "something", "kind", "type", "part"]);

const SELF_DRAWN = new Set(["picture_label", "picture_match", "crossword", "wordsearch", "unscramble"]);

const COLOURS = new Set(["red", "blue", "green", "yellow", "orange", "pink", "purple", "brown", "black", "white", "grey", "gray"]);

const NUMBER_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";
const TIME = new RegExp(`\\b(?:(?:half|quarter|(?:${NUMBER_WORDS}|twenty|twenty-five)) (?:past|to) (?:${NUMBER_WORDS})|(?:${NUMBER_WORDS}) o'clock|\\d{1,2}[:.]\\d{2})\\b`, "i");

const clean = (s: string) =>
  s
    .replace(/[’‘]/g, "'")
    .replace(/^\s*(?:\d{1,2}[.)]?|[a-h][.)]|picture \d+\s*[:.)-])\s*/i, "")
    .replace(/_{2,}|\.{3,}|…/g, " ___ ")
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .replace(/\s+/g, " ")
    .trim();

function nounAfterArticle(text: string): string | null {
  for (const m of text.matchAll(/\b(?:a|an|the|two|three|four|five|some)\s+((?:[\p{L}-]+\s+)?[\p{L}-]+)/giu)) {
    const words = m[1].split(/\s+/).filter((w) => !STOP.has(w.toLowerCase()) && !SPEECH.has(w.toLowerCase()));
    if (words.length && !words.some((w) => VAGUE.has(w.toLowerCase()))) return words.join(" ");
  }
  return null;
}

// What one item asks the picture to show, or null when it shows nothing
// (a number, a yes/no answer, a speech line, a sentence without a thing in it).
// `answer` stands in for a riddle's vague thing; `who` for an action's "she".
export function itemSubjects(item: string, answer = "", who = ""): string[] {
  const text = clean(item);
  if (!text || /^\d+$/.test(text) || /^(?:yes|no|true|false)\b/i.test(text)) return [];
  const time = text.match(TIME);
  if (time) return [`a clock showing ${time[0].toLowerCase()}`];
  const bare = text.replace(/[?!.,;:]+$/g, "");
  const words = bare.split(/\s+/);
  const speech = /[!?]/.test(bare) || words.some((w) => SPEECH.has(w.toLowerCase()));
  // "chair", "teddy bears", "a globe and a world map": the item names the things.
  if (!speech && !bare.includes("___") && words.length <= 6 && !/\b(?:is|are|was|were|has|have)\b/i.test(bare)) {
    const parts = bare.split(/\s*(?:,|\band\b)\s*/).map((p) => p.replace(/^(?:a|an|the)\s+/i, "").trim()).filter(Boolean);
    if (parts.every((p) => p.split(/\s+/).length <= 3)) return parts;
  }
  // "She is going into the park.": the action, as the picture shows it.
  const action = bare.match(/^(he|she|they|it|\p{Lu}\p{Ll}+) (?:is|are|'s) (\p{Ll}+ing\b.*)$/u);
  if (action) return [`${/^(he|she|they|it)$/i.test(action[1]) ? who || "a child" : action[1]} ${action[2]}`];
  if (speech) return [];
  const noun = nounAfterArticle(bare);
  if (noun) return [noun];
  const a = clean(answer).replace(/[?!.,;:]+$/g, "");
  return a && a.split(/\s+/).length <= 3 && !/^\d+$/.test(a) && !STOP.has(a.split(/\s+/)[0].toLowerCase()) ? [a.replace(/^(?:a|an|the)\s+/i, "")] : [];
}

// People an exercise names ("Helen is Leo's ___") - a family tree or a class
// photo has to show them. "Meow!" is not a person.
function namedPeople(items: string[]): string[] {
  const names = new Set<string>();
  for (const item of items) for (const m of clean(item).matchAll(/\b(\p{Lu}\p{Ll}{2,})\b(?![!,])/gu)) if (!isHeadword(m[1]) && !SPEECH.has(m[1].toLowerCase())) names.add(m[1]);
  return [...names];
}

const stem = (w: string) => w.toLowerCase().replace(/ies$/, "y").replace(/(?:es|s)$/, "");

function mentioned(prompt: string, subject: string): boolean {
  const lower = prompt.toLowerCase();
  // a clock's time must be in the prompt as written
  if (subject.startsWith("a clock showing ")) return lower.includes(subject.slice("a clock showing ".length));
  if (subject.startsWith("things coloured ")) return subject.slice("things coloured ".length).split(", ").every((c) => lower.includes(c));
  const have = new Set((lower.match(/[\p{L}']+/gu) ?? []).map(stem));
  const key = subject.split(/\s+/).filter((w) => !STOP.has(w.toLowerCase()) && !/ing$/.test(w));
  return !!key.length && key.filter((w) => have.has(stem(w))).length >= Math.ceil(key.length / 2);
}

export type ExercisePicture = { heading: string; subjects: string[]; missing: string[]; counting: boolean };

// The exercise the page's main picture serves: the first one that works
// from a picture and asks about things a picture can show.
export function pictureExercise(page: PicturePage): ExercisePicture | null {
  // Card and panel pages picture each item in a frame of its own
  // (fillZonePictures, BLUEPRINT_INSTRUCTIONS) - not in the main picture.
  const type = page.sourceShape?.pageType;
  if (type === "cards" || type === "panels") return null;
  for (const block of page.blocks) {
    // Activities and diagrams that draw their own pictures or grids.
    if (!isExerciseBlock(block) || !block.items?.length || block.diagram || (block.activity && SELF_DRAWN.has(block.activity.type))) continue;
    const instruction = `${block.heading} ${block.body}`;
    if (!LOOKS_AT_PICTURE.test(instruction) || WORD_TASK.test(instruction)) continue;
    const items = block.items;
    const who = instruction.match(/\b[Ww]hat is (\p{Lu}\p{Ll}+) doing/u)?.[1] ?? "";
    // "How many chairs?" with the answer "4": four chairs.
    const counted = items.map((item, i) => {
      const what = clean(item).match(/how many ([\p{L} -]+?)(?: (?:are|can|do|is)\b|\?|$)/iu)?.[1];
      const n = (block.answerKey?.[i] ?? "").match(/\d+/)?.[0];
      return what ? (n ? `${n} ${what}` : what) : null;
    });
    const counting = counted.some(Boolean) || /\bcount\b|how many/i.test(instruction);
    const people = namedPeople(items).filter((p) => p !== who);
    let things = items.flatMap((item, i) => (counted[i] ? [counted[i]!] : itemSubjects(item, block.answerKey?.[i], who))).filter((s) => !people.includes(s));
    // A list of colours is things in those colours.
    const colours = things.filter((t) => COLOURS.has(t.toLowerCase()));
    if (colours.length >= 2) things = [...things.filter((t) => !COLOURS.has(t.toLowerCase())), `things coloured ${colours.map((c) => c.toLowerCase()).join(", ")}`];
    const cast = /family tree/i.test(instruction) ? `a family tree of ${people.join(", ")}, each face with its name` : `the people named ${people.join(", ")}`;
    const subjects = [...new Set([...things, ...(people.length >= 2 ? [cast] : [])])].slice(0, 8);
    if (!subjects.length || (subjects.length < 2 && !people.length)) continue;
    const prompt = page.imagePrompt ?? "";
    const missing = subjects.filter((s) => (s === cast ? !people.every((p) => prompt.includes(p)) : !mentioned(prompt, s)));
    return { heading: block.heading.replace(/^\d+\s*/, ""), subjects, missing, counting };
  }
  return null;
}

// The page's picture prompt, extended to show what its exercise asks about
// when it names fewer than half of those things. Other pages are returned
// unchanged.
export function alignPictureWithExercise<P extends PicturePage>(page: P): P {
  if (!page.imagePrompt?.trim()) return page;
  const exercise = pictureExercise(page);
  if (!exercise || exercise.missing.length * 2 <= exercise.subjects.length) return page;
  const list = exercise.subjects.join("; ");
  const addition = `This picture is the exercise "${exercise.heading}": it must clearly show ${list}${exercise.counting ? " - each one separate and easy to count" : " - each one large and easy to find"}, with nothing else in the foreground.`;
  return { ...page, imagePrompt: `${page.imagePrompt.trim().replace(/[.\s]*$/, ".")} ${addition}` };
}
