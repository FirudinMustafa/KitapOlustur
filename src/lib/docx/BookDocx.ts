import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  AlignmentType,
  WidthType,
} from "docx";
import type { GeneratedUnit, ContentBlock, GeneratedPage } from "@/lib/ai/schemas";
import type { Variant } from "@/lib/pdf/BookDocument";
import type { CourseUnitSummary } from "@/lib/pdf/ContentsDocument";
import { VARIANT_LABELS, pagesForVariant, seededShuffle, fetchAsset } from "@/lib/content-html";
import { resolvePageImageUrl } from "@/lib/page-image";
import { withUnitGlossary } from "@/lib/unit-glossary";
import { itemText } from "@/lib/item-text";

// DOCX export - the "editor can actually mark it up in Word/Google Docs"
// format flagged as the top remaining gap in ROADMAP.md's project-wide
// assessment (2026-09-20): PDF/EPUB/Common Cartridge are all read-only
// outputs, none of them let a human copyeditor make inline tracked-change
// edits the way a real publishing workflow's copyedit stage requires.
//
// Unlike EPUB/Common Cartridge (hand-rolled zip+XML - a small, well-defined
// format), DOCX/OOXML is a large, genuinely complex spec, so a real library
// (docx, npm) is used here instead of hand-rolling - the opposite tradeoff
// deliberately made for the two zip-based formats above.
//
// Mirrors the same pagesForVariant/showAnswerKey logic every other export
// format uses, so all formats show the same content - just rendered for a
// different target (here: editable paragraphs/tables instead of read-only
// HTML/PDF primitives).

function renderInteractiveParagraphs(block: ContentBlock, showAnswerKey: boolean): Paragraph[] {
  const interactive = block.interactive;
  if (!interactive) return [];

  if (interactive.type === "multiple_choice") {
    const paragraphs = [new Paragraph({ text: interactive.question, spacing: { before: 100 } })];
    interactive.options.forEach((o, i) => {
      const isCorrect = showAnswerKey && i === interactive.correctIndex;
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun(`${String.fromCharCode(97 + i)}) ${o}`),
            ...(isCorrect ? [new TextRun({ text: " ✓", bold: true })] : []),
          ],
        }),
      );
    });
    return paragraphs;
  }

  if (interactive.type === "fill_blank") {
    const printed = interactive.template.replace(/___/g, "_____");
    const paragraphs = [new Paragraph({ text: printed, spacing: { before: 100 } })];
    if (showAnswerKey) {
      paragraphs.push(new Paragraph({ text: "ANSWER KEY", spacing: { before: 100 }, children: [new TextRun({ text: "ANSWER KEY", bold: true, size: 18 })] }));
      interactive.blanks.forEach((b, i) => paragraphs.push(new Paragraph({ text: `${i + 1}. ${b}`, bullet: { level: 0 } })));
    }
    return paragraphs;
  }

  // matching
  const leftItems = interactive.pairs.map((p) => p.left);
  const rightItems = showAnswerKey
    ? interactive.pairs.map((p) => p.right)
    : seededShuffle(
        interactive.pairs.map((p) => p.right),
        block.heading,
      );
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: leftItems.map(
      (left, i) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(left)] }),
            new TableCell({ children: [new Paragraph(rightItems[i])] }),
          ],
        }),
    ),
  });
  return [new Paragraph({ spacing: { before: 100 } }), table as unknown as Paragraph];
}

// Faz "Sayfa Dizilimi Editörü": `block.layout` (if present) is intentionally
// ignored here - Word's document model is fundamentally sequential/flow-
// based, and the `docx` library as used in this file has no wired-up
// mechanism for absolute-positioned text frames. Layout only affects the PDF
// renderer (src/lib/pdf/BookDocument.tsx) and the web reader's preview
// (BookReader.tsx) - DOCX always renders every block in plain reading order.
function renderBlockParagraphs(block: ContentBlock, showAnswerKey: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [
    new Paragraph({ text: block.heading, heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }),
  ];
  for (const p of block.body.split(/\n+/).filter(Boolean)) {
    out.push(new Paragraph({ text: p }));
  }
  if (block.items?.length) {
    for (const [i, item] of block.items.entries()) {
      out.push(new Paragraph({ text: `${i + 1}. ${itemText(item)}` }));
    }
  }
  out.push(...(renderInteractiveParagraphs(block, showAnswerKey) as (Paragraph | Table)[]));
  if (showAnswerKey && block.answerKey?.length) {
    out.push(
      new Paragraph({ children: [new TextRun({ text: "ANSWER KEY", bold: true, size: 18 })], spacing: { before: 100 } }),
    );
    for (const [i, a] of block.answerKey.entries()) {
      out.push(new Paragraph({ text: `${i + 1}. ${itemText(a)}` }));
    }
  }
  return out;
}

function renderGlossaryParagraphs(glossary: GeneratedPage["glossary"]): Paragraph[] {
  if (!glossary?.length) return [];
  const out = [new Paragraph({ text: "Glossary", heading: HeadingLevel.HEADING_4, spacing: { before: 200 } })];
  for (const entry of glossary) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({ text: entry.term, bold: true }),
          new TextRun(`: ${entry.definition}${entry.example ? ` (e.g. ${entry.example})` : ""}`),
        ],
      }),
    );
  }
  return out;
}

export async function buildDocx(input: {
  bookTitle: string;
  variant: Variant;
  units: GeneratedUnit[];
  level: string;
  contentsUnits: CourseUnitSummary[];
  pageImages?: Record<number, string>;
}): Promise<Buffer> {
  const { bookTitle, variant, units, level, contentsUnits, pageImages } = input;
  const variantLabel = VARIANT_LABELS[variant];
  // Faz "Teacher's Book/Test Booklet Genişletme": test_booklet was missing
  // here despite always generating an answer key - it was silently dropped.
  const showAnswerKey = variant === "workbook" || variant === "teacher_book" || variant === "test_booklet";

  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: `${bookTitle} — ${variantLabel}`, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: level, spacing: { after: 300 } }),
  ];

  if (contentsUnits.length) {
    children.push(new Paragraph({ text: "Contents", heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: ["Unit", "Title", "Key terms", "Objectives", "Level"].map(
              (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }),
            ),
          }),
          ...contentsUnits.map(
            (u) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(String(u.number))] }),
                  new TableCell({ children: [new Paragraph(u.title)] }),
                  new TableCell({ children: [new Paragraph(u.keyTerms)] }),
                  new TableCell({ children: [new Paragraph(u.objectives)] }),
                  new TableCell({ children: [new Paragraph(u.level)] }),
                ],
              }),
          ),
        ],
      }),
    );
  }

  for (const unit of units) {
    const pages = withUnitGlossary(unit, pagesForVariant(unit, variant), variant);
    if (!pages.length) continue;

    children.push(
      new Paragraph({
        text: `Unit ${unit.unitNumber}: ${unit.title}`,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
      }),
    );

    for (const page of pages) {
      const imageUrl = resolvePageImageUrl(page, pageImages);
      if (imageUrl) {
        try {
          const { buffer } = await fetchAsset(imageUrl, "image/png");
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  // Word only actually reads the `type` field for the image
                  // codec here - the source URL is always a generated PNG
                  // (see generateReviewedImage in workflows/book-pipeline.tsx).
                  type: "png",
                  data: buffer,
                  transformation: { width: 400, height: 225 },
                }),
              ],
            }),
          );
          if (page.imagePrompt) {
            children.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: page.imagePrompt, italics: true, size: 18 })],
              }),
            );
          }
        } catch {
          // Best-effort - a failed image fetch shouldn't fail the whole
          // export, same philosophy as EPUB's per-run best-effort embed.
        }
      }

      if (page === pages[0] && unit.listeningAudio?.length) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "Listening script", bold: true })],
            spacing: { before: 150 },
          }),
        );
        for (const entry of unit.listeningAudio) {
          children.push(new Paragraph({ children: [new TextRun({ text: `${entry.blockRef}: `, bold: true }), new TextRun(entry.script)] }));
        }
      }

      for (const block of page.blocks) {
        children.push(...renderBlockParagraphs(block, showAnswerKey));
      }
      children.push(...renderGlossaryParagraphs(page.glossary));
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
