// Short texts a published ELT book sets as designed artefacts instead of
// running prose: a note on a sticky paper, an email in a mail window, a
// text message in a phone bubble, a party invitation card, a magazine quiz
// box, a poster (i5 Team 2 pp.13-16: Tom's email, Jane's note, Mike's
// invitation, "What kind of person are you?"). The writer marks such a
// block with `textStyle`; blocks written before it existed (or where the
// writer left it out) are recognised here from their text. Pure and
// deterministic - the PDF, the web reader and the height estimate all call
// it, so they agree on every block.
//
// Detection is deliberately conservative: an exercise that only talks
// about an email ("Write an email to a friend") or a quiz-like exercise
// ("Geography Quiz", "Read again and circle a or b") stays plain text.

export const TEXT_STYLES = ["note", "email", "message", "invitation", "quiz", "poster"] as const;
export type TextStyle = (typeof TEXT_STYLES)[number];

type BlockText = {
  heading?: string;
  body?: string;
  items?: string[];
  textStyle?: TextStyle | null;
  callout?: string | null;
  dialogue?: unknown[] | null;
  table?: unknown;
  diagram?: unknown;
  activity?: { type: string; pictures?: unknown[] } | null;
};

/** The block's artefact style: the writer's, else the one its text shows, else null. */
export function resolveTextStyle(b: BlockText): TextStyle | null {
  // A callout box, a conversation, a table or a drawn diagram has its own print form.
  if (b.callout || b.dialogue?.length || b.table || b.diagram) return null;
  if (b.textStyle) return b.textStyle;
  return inferTextStyle(b);
}

// "Hi, Ben!", "Hello Mia,", "Dear Mr Brown," - a greeting with a name.
// The names in these patterns must stay capitalised, so the words around
// them take either case letter by letter instead of the `i` flag.
const anyCase = (words: string) => words.replace(/[a-z]/g, (c) => `[${c}${c.toUpperCase()}]`);
const NAME = String.raw`(?!I\b)[A-Z][\p{L}-]+(?:\s+[A-Z][\p{L}-]+)?`;
const GREETING = new RegExp(String.raw`^(?:${anyCase("hi|hello|hey|dear")})\b,?\s+(?:(?:Mr|Mrs|Ms)\.?\s+|Miss\s+)?${NAME}\s*[,!]`, "u");
// A bare name opening a note on its own: "Ricky," then the text.
const NAME_OPENING = /^[A-Z][\p{L}'-]+,(?:\s*\n|\s+(?=[A-Z]))/u;
// Words before an opening "Ricky," that are not a name.
const NOT_NAMES = new Set(["Yes", "No", "Well", "Look", "Now", "Then", "So", "Oh", "Ok", "Okay", "First", "Next", "Finally", "Today", "Please", "Sorry", "Thanks", "Hi", "Hello", "Hey", "Dear"]);
// The sign-off: an optional closing phrase, then a name (and kisses) at the
// very end, after a sentence end or a line break.
const CLOSING = anyCase(
  "lots of love|love|best wishes|best|bye for now|bye|see you soon|see you then|see you later|see you|talk to you soon|write soon|take care|thanks a lot|thanks|thank you|cheers|kind regards|regards|yours",
);
const SIGN_OFF = new RegExp(String.raw`(?:^|[.!?)]\s+|\n\s*)(?:(?:${CLOSING})[,!.]?\s+)?${NAME}(?:\s*[xX]{1,3})?[.!]?\s*$`, "u");
// "A: ... B: ..." / "Tom: ...": a conversation written as prose, not a letter.
const SPEAKERS = /(?:^|\n|[.!?]\s+)[A-Z]\p{L}*\s?:\s/gu;
const NOTE_ASK = /\b(?:please|don'?t forget|do not forget|remember to)\b|(?:^|\n)\s*[–—-]\s*\w/i;
const INVITE = /\b(?:you'?re invited|you are invited|(?:please )?come to my\b[^.!?\n]{0,60}\bparty|join us (?:for|at)\b|rsvp)\b/i;
const WHEN =
  /\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|o'clock)|\d{1,2}[:.]\d{2}|\d{1,2}(?:st|nd|rd|th)\b|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|tonight|tomorrow|weekend)/i;
const QUIZ_WORD = /\bquiz\b|\bwhat kind of (?:person|friend|learner)\b|\bmostly (?:a|b)s?\b/i;
// "... A collect comics B hang out with friends" / "a) ... b) ...": a choice item.
const CHOICE = /(?:^|\s)(?:A|\(?a\))[.):]?\s+\S.*?\s(?:B|\(?b\))[.):]?\s+\S/;

const MESSAGE_MAX = 160;

/** The style a block's text shows, or null - see the file comment. */
export function inferTextStyle(b: BlockText): TextStyle | null {
  if (b.callout || b.dialogue?.length || b.table || b.diagram) return null;
  // A picture activity prints its own grid; a word bank above an email is fine.
  if (b.activity?.pictures?.length) return null;
  const body = (b.body ?? "").trim();
  const { lead, text } = splitArtefact(body);
  if (isQuiz(b)) return "quiz";
  if (text.length < 40) return null;
  if (INVITE.test(text) && WHEN.test(text)) return "invitation";
  if ((text.match(SPEAKERS) ?? []).length >= 2) return null;
  const signed = SIGN_OFF.test(text);
  if (GREETING.test(text) && signed) {
    // The rubric names it ("Read Tom's email", "Complete the message").
    const named = /\b(e-?mail|letter|postcard)\b|\b(message|text|chat)\b|\b(note)\b/i.exec(`${b.heading ?? ""} ${lead}`);
    if (named) return named[1] ? "email" : named[2] ? "message" : "note";
    if (NOTE_ASK.test(text) && text.length <= 260 && !hasGaps(text)) return "note";
    return text.length <= MESSAGE_MAX && !hasGaps(text) ? "message" : "email";
  }
  if (nameOpening(text) && signed && NOTE_ASK.test(text) && text.length <= 320) return "note";
  return null;
}

function nameOpening(text: string): boolean {
  const m = NAME_OPENING.exec(text);
  return !!m && !NOT_NAMES.has(m[0].replace(/[,\s]/g, ""));
}

function hasGaps(text: string): boolean {
  return /_{3,}|\.{4,}/.test(text);
}

function isQuiz(b: BlockText): boolean {
  const items = b.items ?? [];
  if (items.length < 3) return false;
  if (!QUIZ_WORD.test(`${b.heading ?? ""} ${b.body ?? ""}`)) return false;
  return items.filter((i) => CHOICE.test(i)).length >= Math.ceil(items.length * 0.6);
}

// Where the artefact's own text starts in a body that opens with a lead-in
// ("Complete Tom's email. Hi, Ben! ..."): at a greeting or a name opening
// after the lead-in's sentence end or line break. The lead-in prints above
// the artefact as plain text.
const LEAD_MAX = 200;
export function splitArtefact(body: string): { lead: string; text: string } {
  const text = body.trim();
  if (GREETING.test(text) || nameOpening(text)) return { lead: "", text };
  const at = /(?:\n|[.:!?]\s+)(?=(?:hi|hello|hey|dear)\b)/gi;
  for (const m of text.matchAll(at)) {
    const cut = m.index + m[0].length;
    if (cut > LEAD_MAX) break;
    const rest = text.slice(cut).trim();
    if (GREETING.test(rest)) return { lead: text.slice(0, cut).trim(), text: rest };
  }
  // An invitation or note after a line of rubric.
  const nl = text.indexOf("\n");
  if (nl > 0 && nl <= LEAD_MAX && !INVITE.test(text.slice(0, nl)) && INVITE.test(text.slice(nl))) {
    return { lead: text.slice(0, nl).trim(), text: text.slice(nl + 1).trim() };
  }
  return { lead: "", text };
}

/**
 * An artefact's text in its parts: the greeting line, the body paragraphs
 * and the sign-off lines (email, message, note), so a renderer can set them
 * like a letter. Lines the writer already broke are kept.
 */
export function letterParts(text: string): { greeting: string; body: string; signOff: string } {
  let rest = text.trim();
  let greeting = "";
  const g = GREETING.exec(rest) ?? (nameOpening(rest) ? NAME_OPENING.exec(rest) : null);
  if (g) {
    greeting = g[0].trim();
    rest = rest.slice(g[0].length).trim();
  }
  let signOff = "";
  const s = SIGN_OFF.exec(rest);
  if (s && s.index > 0) {
    // keep the sentence end with the body, the rest is the sign-off
    const lead = /^[.!?)]/.exec(s[0]) ? 1 : 0;
    signOff = s[0].slice(lead).trim();
    rest = rest.slice(0, s.index + lead).trim();
  }
  return { greeting, body: rest, signOff };
}

/** A quiz item split into its question and A/B(/C) options; options empty when it has none. */
export function quizParts(item: string): { question: string; options: { letter: string; text: string }[] } {
  const marks = [...item.matchAll(/(?:^|\s)(?:([A-D])|\(?([a-d])\))[.):]?\s+(?=\S)/g)];
  const letter = (m: RegExpMatchArray) => (m[1] ?? m[2]).toUpperCase();
  // Options run A, B, C... in order; the question is what comes before A.
  // The last A that starts a run wins - an earlier "A" is the article.
  for (let start = marks.length - 1; start >= 0; start--) {
    if (letter(marks[start]) !== "A") continue;
    const run: RegExpMatchArray[] = [];
    for (const m of marks.slice(start)) if (letter(m) === String.fromCharCode(65 + run.length)) run.push(m);
    if (run.length < 2) continue;
    const options = run.map((m, i) => ({
      letter: letter(m),
      text: item.slice((m.index ?? 0) + m[0].length, i + 1 < run.length ? run[i + 1].index : item.length).trim(),
    }));
    return { question: item.slice(0, run[0].index).trim(), options };
  }
  return { question: item.trim(), options: [] };
}

// The first line is the card's title when it is short ("You're invited!",
// "Sam's Space Party"); otherwise the card has no title of its own.
export function artefactTitle(text: string): { title: string; rest: string } {
  const lines = text.split(/\n+/);
  const first = lines[0].trim();
  if (lines.length > 1 && first.length <= 40 && !/_{2,}|\d\)/.test(first)) return { title: first, rest: lines.slice(1).join("\n").trim() };
  const lead = /^(you'?re invited!?|you are invited!?)\s*/i.exec(first);
  if (lead) return { title: lead[1], rest: text.slice(lead[0].length).trim() };
  return { title: "", rest: text };
}
