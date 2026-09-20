import type { GeneratedUnit, GeneratedPage, ContentBlock } from "@/lib/ai/schemas";
import type { Variant } from "@/lib/pdf/BookDocument";

// Shared (X)HTML-rendering helpers for the two container formats that both
// turn a GeneratedUnit[] into real HTML content: EPUB (src/lib/epub/BookEpub.ts)
// and Common Cartridge (src/lib/lms-export/CommonCartridge.ts). Factored out
// once a second consumer needed the exact same block/glossary rendering -
// PDF (BookDocument.tsx, react-pdf primitives) and Markdown (markdown.ts)
// render to genuinely different targets and are left as their own thing.

export const VARIANT_LABELS: Record<Variant, string> = {
  student_book: "Student Book",
  workbook: "Workbook",
  teacher_book: "Teacher's Book",
  test_booklet: "Test Booklet",
};

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function paragraphs(text: string): string {
  return text
    .split(/\n+/)
    .filter(Boolean)
    .map((p) => `<p>${escapeXml(p)}</p>`)
    .join("\n");
}

export function pagesForVariant(unit: GeneratedUnit, variant: Variant): GeneratedPage[] {
  switch (variant) {
    case "student_book":
      return unit.studentBookPages ?? [];
    case "workbook":
      return unit.workbookPages ?? [];
    case "teacher_book":
      return unit.teacherBookPages ?? [];
    case "test_booklet":
      return unit.testBookletPages ?? [];
  }
}

// Deterministic shuffle (Fisher-Yates with a simple string-seeded PRNG, not
// Math.random) - used so a matching exercise's right-hand column doesn't
// print in the same order as the correct answers (that would make it a
// non-exercise), while still producing the exact same scrambled order on
// every export of the same book instead of a different one each time.
// Exported so BookDocument.tsx's PDF rendering can use the identical
// algorithm rather than a second copy.
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Faz H2 Faz 3: static (non-interactive) rendering of a structured exercise
// for PDF/EPUB/Common Cartridge - the same content, just printed instead of
// clickable (see BookReader.tsx's real interactive components for the web
// reader). Correct answers are only revealed when showAnswerKey is true
// (same rule as the existing plain items/answerKey), matching or MC options
// are otherwise scrambled/hidden so print output stays a genuine exercise.
function renderInteractiveHtml(block: ContentBlock, showAnswerKey: boolean): string {
  const interactive = block.interactive;
  if (!interactive) return "";

  if (interactive.type === "multiple_choice") {
    const options = interactive.options
      .map((o, i) => `<li>${escapeXml(o)}${showAnswerKey && i === interactive.correctIndex ? " ✓" : ""}</li>`)
      .join("");
    return `<div class="interactive interactive-mc"><p>${escapeXml(interactive.question)}</p><ol type="a">${options}</ol></div>`;
  }

  if (interactive.type === "fill_blank") {
    const printed = escapeXml(interactive.template).replace(/___/g, "_____");
    const answers = showAnswerKey
      ? `<p class="answer-key-label">ANSWER KEY</p><ol>${interactive.blanks.map((b) => `<li>${escapeXml(b)}</li>`).join("")}</ol>`
      : "";
    return `<div class="interactive interactive-fill-blank"><p>${printed}</p>${answers}</div>`;
  }

  // matching
  const leftItems = interactive.pairs.map((p) => p.left);
  const rightItems = showAnswerKey
    ? interactive.pairs.map((p) => p.right)
    : seededShuffle(
        interactive.pairs.map((p) => p.right),
        block.heading,
      );
  const rows = leftItems
    .map((left, i) => `<tr><td>${escapeXml(left)}</td><td>${escapeXml(rightItems[i])}</td></tr>`)
    .join("");
  return `<div class="interactive interactive-matching"><table>${rows}</table></div>`;
}

export function renderBlockHtml(block: ContentBlock, showAnswerKey: boolean): string {
  const items = block.items?.length
    ? `<ol class="items">${block.items.map((item) => `<li>${escapeXml(item)}</li>`).join("")}</ol>`
    : "";
  const answerKey =
    showAnswerKey && block.answerKey?.length
      ? `<div class="answer-key"><p class="answer-key-label">ANSWER KEY</p><ol>${block.answerKey
          .map((a) => `<li>${escapeXml(a)}</li>`)
          .join("")}</ol></div>`
      : "";
  return `<section class="block block-${block.kind}">
    <h3>${escapeXml(block.heading)}</h3>
    ${paragraphs(block.body)}
    ${items}
    ${renderInteractiveHtml(block, showAnswerKey)}
    ${answerKey}
  </section>`;
}

export function renderGlossaryHtml(glossary: GeneratedPage["glossary"]): string {
  if (!glossary?.length) return "";
  return `<section class="glossary">
    <h3>Glossary</h3>
    <dl>
      ${glossary
        .map(
          (entry) =>
            `<dt>${escapeXml(entry.term)}</dt><dd>${escapeXml(entry.definition)}${
              entry.example ? ` <em>e.g. ${escapeXml(entry.example)}</em>` : ""
            }</dd>`,
        )
        .join("\n")}
    </dl>
  </section>`;
}

export async function fetchAsset(url: string, fallbackMediaType: string): Promise<{ buffer: Buffer; mediaType: string }> {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mediaType = res.headers.get("content-type") ?? fallbackMediaType;
  return { buffer, mediaType };
}

export function extensionForMediaType(mediaType: string): string {
  if (mediaType.includes("png")) return "png";
  if (mediaType.includes("jpeg") || mediaType.includes("jpg")) return "jpg";
  if (mediaType.includes("mpeg") || mediaType.includes("mp3")) return "mp3";
  return "bin";
}
