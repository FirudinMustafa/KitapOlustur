import type { GeneratedUnit, GeneratedPage } from "@/lib/ai/schemas";
import type { Variant } from "@/lib/pdf/BookDocument";

const VARIANT_LABELS: Record<Variant, string> = {
  student_book: "Student Book",
  workbook: "Workbook",
  teacher_book: "Teacher's Book",
  test_booklet: "Test Booklet",
};

function pagesForVariant(unit: GeneratedUnit, variant: Variant): GeneratedPage[] {
  switch (variant) {
    case "student_book":
      return unit.studentBookPages;
    case "workbook":
      return unit.workbookPages;
    case "teacher_book":
      return unit.teacherBookPages ?? [];
    case "test_booklet":
      return unit.testBookletPages ?? [];
  }
}

function renderPages(pages: GeneratedPage[], showAnswerKey: boolean): string {
  return pages
    .map((page) => {
      const blockParts = page.blocks.map((block) => {
        const parts = [`### ${block.heading}`, block.body];
        if (block.items?.length) {
          parts.push(`**${block.kind.toUpperCase()}**`);
          parts.push(block.items.map((item, i) => `${i + 1}. ${item}`).join("\n"));
          if (showAnswerKey && block.answerKey?.length) {
            parts.push(
              `<details><summary>Answer key</summary>\n\n${block.answerKey
                .map((a, i) => `${i + 1}. ${a}`)
                .join("\n")}\n\n</details>`,
            );
          }
        }
        return parts.join("\n\n");
      });
      const glossary = page.glossary?.length
        ? `\n\n#### Glossary\n\n${page.glossary
            .map((g) => `- **${g.term}** — ${g.definition}${g.example ? ` _e.g. ${g.example}_` : ""}`)
            .join("\n")}`
        : "";
      return blockParts.join("\n\n") + glossary;
    })
    .join("\n\n");
}

export function unitsToMarkdown(bookTitle: string, units: GeneratedUnit[], variant: Variant): string {
  const header = `# ${bookTitle} — ${VARIANT_LABELS[variant]}\n`;
  // Faz "Teacher's Book/Test Booklet Genişletme": test_booklet was missing
  // here despite always generating an answer key - it was silently dropped.
  const showAnswerKey = variant === "workbook" || variant === "teacher_book" || variant === "test_booklet";

  const body = units
    .map(
      (unit) =>
        `## Unit ${unit.unitNumber}: ${unit.title}\n\n${renderPages(pagesForVariant(unit, variant), showAnswerKey)}`,
    )
    .join("\n\n---\n\n");

  return `${header}\n${body}\n`;
}
