// Deterministic, LLM-free text-overlap check (ROADMAP.md Faz F1). Cheap
// enough to run on every mirrored page: a 5-gram Jaccard similarity between
// the source page's transcribed text and the generated page's text. This
// only flags word-for-word closeness, not conceptual/structural similarity
// (which is expected and fine - mirroring page structure isn't the risk;
// reusing actual wording is).

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function ngramSet(tokens: string[], n: number): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i <= tokens.length - n; i++) {
    grams.add(tokens.slice(i, i + n).join(" "));
  }
  return grams;
}

export function ngramJaccardSimilarity(sourceText: string, generatedText: string, n = 5): number {
  const a = ngramSet(tokenize(sourceText), n);
  const b = ngramSet(tokenize(generatedText), n);
  if (!a.size || !b.size) return 0;

  let intersection = 0;
  for (const gram of a) {
    if (b.has(gram)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}
