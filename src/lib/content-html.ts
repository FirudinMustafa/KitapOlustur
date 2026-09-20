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
