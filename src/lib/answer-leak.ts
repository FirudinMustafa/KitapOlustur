// Live test 2026-10-12 (KIYAS-7): the writer opened most exercises with a
// table that already held the answers ("12 | Twelve", "The bag of Maya |
// Maya's bag") and then listed the same items as questions - the learner
// read every answer on the page, and each exercise took twice the space, so
// pages ran over. A table that shows at least half of a block's answers is
// an answer leak.

type LeakBlock = { heading: string; items?: string[]; answerKey?: string[]; table?: { headers: string[]; rows: string[][] } };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/^e\.g\.,?\s*/, "")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim();

export function tableLeaksAnswers(block: LeakBlock): boolean {
  if (!block.table || !block.answerKey?.length) return false;
  const cells = new Set(block.table.rows.flat().map(norm).filter(Boolean));
  const answers = block.answerKey.map(norm).filter((a) => a.length > 0);
  if (!answers.length) return false;
  const shown = answers.filter((a) => cells.has(a)).length;
  return shown / answers.length >= 0.5;
}

export function answerLeakIssue(block: LeakBlock, where: string): string | null {
  return tableLeaksAnswers(block)
    ? `${where}, block "${block.heading}": its table already shows the answers in answerKey, so the exercise gives itself away. Remove the table (or show only the prompts in it, never the answers).`
    : null;
}

// Deterministic backstop: the leaking table goes, the exercise (items +
// answerKey) stays.
export function dropLeakingTable<B extends LeakBlock>(block: B): B {
  if (!tableLeaksAnswers(block)) return block;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure-omit drops the key
  const { table: _leak, ...rest } = block;
  return rest as B;
}
