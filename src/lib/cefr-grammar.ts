import { targetBand } from "@/lib/cefr-vocabulary";

// Grammar a learner has at each CEFR level, for the writer and the level
// reviewer of an English book (2026-10-21). Our own short summary, ordered
// after the CEFR-J Grammar Profile (version 20180315, Tono Laboratory, TUFS)
// and the usual young learners' syllabus - a checklist, not the profile's
// 500 items. Each band includes everything before it.
const INVENTORY: { band: "A1" | "A2" | "B1" | "B2"; items: string[] }[] = [
  {
    band: "A1",
    items: [
      "be (am/is/are) - statements, negatives, questions, short answers",
      "have got",
      "can / can't (ability, requests)",
      "present simple (routines, likes) with adverbs of frequency",
      "present continuous (now)",
      "there is / there are",
      "this/that/these/those; a/an/the; some/any",
      "plural nouns; possessive 's; my/your/his/her/our/their",
      "imperatives (Open your book. Don't run.)",
      "prepositions of place (in, on, under, next to, behind, between)",
      "question words: what, where, who, how many, how old, when",
      "past simple of be (was/were)",
    ],
  },
  {
    band: "A2",
    items: [
      "past simple, regular and irregular - statements, negatives, questions",
      "comparatives and superlatives",
      "going to (plans), will (predictions, offers)",
      "must / mustn't, have to, should",
      "countable/uncountable with much, many, a lot of",
      "adverbs of manner (slowly, carefully)",
      "object pronouns; possessive pronouns (mine, yours)",
      "present perfect with ever / never",
      "like / love / hate + -ing; want to",
    ],
  },
  {
    band: "B1",
    items: [
      "past continuous; past simple vs past continuous",
      "present perfect with just / already / yet / for / since",
      "first and second conditional",
      "passive (present and past simple)",
      "defining relative clauses (who, which, that, where)",
      "used to",
      "modals of possibility (might, may, could)",
      "reported statements (simple)",
    ],
  },
  {
    band: "B2",
    items: [
      "third and mixed conditionals; wish / if only",
      "passive in all tenses; have something done",
      "reported speech (questions, commands)",
      "future continuous and future perfect",
      "non-defining relative clauses",
      "modals of deduction in the past (must have, can't have)",
    ],
  },
];

// The grammar line for an English book's prompts, or null when the level is
// not a CEFR level.
export function grammarInventory(level: string): string | null {
  const band = targetBand(level);
  if (!band || band === "C1") return null;
  const upTo = INVENTORY.findIndex((g) => g.band === band);
  const allowed = INVENTORY.slice(0, upTo + 1).flatMap((g) => g.items);
  const next = INVENTORY[upTo + 1];
  return [
    `Grammar at ${band} (CEFR-J Grammar Profile, cumulative) - build every sentence, rubric and script from these structures only:`,
    ...allowed.map((i) => `- ${i}`),
    next ? `Not yet at this level (avoid): ${next.items.slice(0, 5).join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
