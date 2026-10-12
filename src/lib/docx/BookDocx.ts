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
import { resolvePageImageUrls } from "@/lib/page-image";
import { buildCrossword, buildWordSearch, crosswordCells, oddOneOutOptions, scrambleWord } from "@/lib/puzzles";
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
const cell = (text: string, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold })] })] });
const grid = (rows: string[][]) =>
  new Table({ rows: rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) })) });

// Audit 2026-10-12: dialogues, tables, callouts and every activity format
// were missing from DOCX - an editor saw only headings, body and items.
// Puzzles use the same grids as the PDF (src/lib/puzzles.ts).
function renderActivity(block: ContentBlock): (Paragraph | Table)[] | null {
  const a = block.activity;
  const items = block.items ?? [];
  const answers = block.answerKey ?? [];
  const numbered = (texts: string[], mark = "") => texts.map((t, i) => new Paragraph({ text: `${mark}${i + 1}. ${t}` }));
  switch (a?.type) {
    case "crossword": {
      const cw = buildCrossword(answers);
      const rows = crosswordCells(cw).map((r) => r.map((c) => (c ? (c.starts.length ? c.starts.join("/") : " ") : "")));
      const clue = (dir: "across" | "down", label: string) => {
        const words = cw.words.filter((w) => w.dir === dir);
        return words.length
          ? [new Paragraph({ children: [new TextRun({ text: label, bold: true })] }), ...words.map((w) => new Paragraph({ text: `${w.item + 1} ${itemText(items[w.item] ?? "")}` }))]
          : [];
      };
      return rows.length ? [grid(rows), ...clue("across", "Across"), ...clue("down", "Down")] : null;
    }
    case "wordsearch": {
      const words = answers.length ? answers : items;
      return [grid(buildWordSearch(words, block.heading).grid), new Paragraph({ text: words.join(" · ") })];
    }
    case "unscramble":
      return items.map((item, i) => new Paragraph({ text: `${i + 1}. ${scrambleWord(answers[i] ?? "", block.heading)}  ________  ${itemText(item)}` }));
    case "odd_one_out":
      return items.map((item, i) => new Paragraph({ text: `${i + 1}. ${oddOneOutOptions(item).join("     ")}` }));
    case "tick_cross":
      return items.map((item, i) => new Paragraph({ text: `${i + 1}. ${itemText(item)}   ☐` }));
    case "ordering":
      return items.map((item) => new Paragraph({ text: `☐ ${itemText(item)}` }));
    case "match_lines": {
      const right = seededShuffle(answers, block.heading);
      return [grid(items.map((item, i) => [`${i + 1} ${itemText(item)}`, `${String.fromCharCode(97 + i)} ${right[i] ? itemText(right[i]) : ""}`]))];
    }
    case "picture_label":
      return numbered(items.map((item, i) => `${a.pictures?.[i]?.emoji ?? ""} ${itemText(item)} ________`.trim()));
    case "picture_match":
      return [
        ...numbered(items.map(itemText)),
        ...(a.pictures ?? []).map((p, i) => new Paragraph({ text: `${String.fromCharCode(97 + i)}) ${p.emoji ?? ""} ${p.label}` })),
      ];
    case "draw_box":
      return [...numbered(items.map(itemText)), new Paragraph({ text: "[ draw here ]", spacing: { before: 400, after: 400 } })];
    default:
      return null;
  }
}

function renderBlockParagraphs(block: ContentBlock, showAnswerKey: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [
    new Paragraph({ text: block.heading, heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }),
  ];
  if (block.callout) out.push(new Paragraph({ children: [new TextRun({ text: block.callout.replace(/_/g, " ").toUpperCase(), bold: true, size: 16 })] }));
  for (const p of block.body.split(/\n+/).filter(Boolean)) {
    out.push(new Paragraph({ text: p }));
  }
  for (const d of block.dialogue ?? []) {
    out.push(new Paragraph({ children: [new TextRun({ text: `${d.speaker}: `, bold: true }), new TextRun(d.line)] }));
  }
  if (block.table) {
    out.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: block.table.headers.map((h) => cell(h, true)) }),
          ...block.table.rows.map((row) => new TableRow({ children: block.table!.headers.map((_, c) => cell(row[c] ?? "")) })),
        ],
      }),
    );
  }
  if (block.activity?.words?.length) out.push(new Paragraph({ children: [new TextRun({ text: block.activity.words.join("   "), bold: true })] }));
  const activity = renderActivity(block);
  if (activity) out.push(...activity);
  else if (block.items?.length) {
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

  const matrix = contentsUnits.some((u) => u.grammar || u.skills);
  if (contentsUnits.length) {
    children.push(new Paragraph({ text: "Contents", heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: (matrix ? ["Unit", "Title", "Vocabulary", "Grammar", "Skills"] : ["Unit", "Title", "Key terms", "Objectives", "Level"]).map((h) => cell(h, true)),
          }),
          ...contentsUnits.map(
            (u) =>
              new TableRow({
                children: (matrix
                  ? [String(u.number), u.title, u.keyTerms, u.grammar ?? "", u.skills ?? u.objectives]
                  : [String(u.number), u.title, u.keyTerms, u.objectives, u.level]
                ).map((t) => cell(t)),
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
      // every picture of the page (Faz B3), main picture first
      for (const [k, imageUrl] of resolvePageImageUrls(page, pageImages).entries()) {
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
                  transformation: k === 0 ? { width: 400, height: 225 } : { width: 180, height: 180 },
                }),
              ],
            }),
          );
          if (k === 0 && page.imagePrompt) {
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
