import type { GeneratedUnit, GeneratedPage, ContentBlock } from "@/lib/ai/schemas";
import { mapGrid, prepositionScene, sceneSvgMarkup } from "@/lib/diagrams";
import type { Variant } from "@/lib/pdf/BookDocument";
import { itemText } from "@/lib/item-text";
import { buildCrossword, buildWordSearch, crosswordCells, oddOneOutOptions, scrambleWord } from "@/lib/puzzles";

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

// Faz "Sayfa Dizilimi Editörü": `block.layout` (if present) is intentionally
// ignored here - EPUB is reflowable by design (this file feeds BookEpub.ts
// and Common Cartridge), and arbitrary absolute positioning only makes sense
// against a fixed canvas (EPUB3 Fixed Layout), which would sacrifice the
// reflow/accessibility that's the whole reason EPUB exists as a sibling to
// PDF. Layout only affects the PDF renderer (src/lib/pdf/BookDocument.tsx)
// and the web reader's preview (BookReader.tsx) - EPUB/Common Cartridge
// always render every block in plain reading order, same as before this
// field existed.
// Faz B4: puzzle and marking formats as reflowable HTML - grids as tables,
// the same grids/scrambles/order as the PDF (src/lib/puzzles.ts).
function renderPuzzleHtml(block: ContentBlock): string | null {
  const type = block.activity?.type;
  const items = block.items ?? [];
  const answers = block.answerKey ?? [];
  switch (type) {
    case "crossword": {
      const cw = buildCrossword(answers);
      const grid = crosswordCells(cw)
        .map((row) => `<tr>${row.map((c) => (c ? `<td class="cw-cell">${c.starts.length ? `<sup>${c.starts.join("/")}</sup>` : ""}</td>` : `<td class="cw-blank"></td>`)).join("")}</tr>`)
        .join("");
      const clues = (dir: "across" | "down", label: string) => {
        const words = cw.words.filter((w) => w.dir === dir);
        return words.length ? `<p><strong>${label}</strong></p><ul>${words.map((w) => `<li>${w.item + 1} ${escapeXml(itemText(items[w.item] ?? ""))}</li>`).join("")}</ul>` : "";
      };
      return `<table class="crossword">${grid}</table>${clues("across", "Across")}${clues("down", "Down")}`;
    }
    case "wordsearch": {
      const words = answers.length ? answers : items;
      const ws = buildWordSearch(words, block.heading);
      return `<table class="wordsearch">${ws.grid.map((row) => `<tr>${row.map((l) => `<td>${escapeXml(l)}</td>`).join("")}</tr>`).join("")}</table><p>${words.map(escapeXml).join(" · ")}</p>`;
    }
    case "unscramble":
      return `<ol class="items">${items.map((item, i) => `<li><strong>${escapeXml(scrambleWord(answers[i] ?? "", block.heading))}</strong> ________ ${escapeXml(itemText(item))}</li>`).join("")}</ol>`;
    case "odd_one_out":
      return `<ol class="items">${items.map((item) => `<li>${oddOneOutOptions(item).map(escapeXml).join(" &#160; &#160; ")}</li>`).join("")}</ol>`;
    case "tick_cross":
      return `<ol class="items">${items.map((item) => `<li>${escapeXml(itemText(item))} &#9744;</li>`).join("")}</ol>`;
    case "ordering":
      return `<ul class="items">${items.map((item) => `<li>&#9744; ${escapeXml(itemText(item))}</li>`).join("")}</ul>`;
    case "match_lines": {
      const right = seededShuffle(answers, block.heading);
      return `<table class="match">${items.map((item, i) => `<tr><td>${i + 1} ${escapeXml(itemText(item))}</td><td>${String.fromCharCode(97 + i)} ${escapeXml(right[i] ? itemText(right[i]) : "")}</td></tr>`).join("")}</table>`;
    }
    default:
      return null;
  }
}

export function renderBlockHtml(block: ContentBlock, showAnswerKey: boolean): string {
  // Workbook activities (src/lib/activities.ts) reflow as text: the word
  // bank as a line, pictures as their emoji (e-readers draw them natively).
  const a = block.activity;
  const pictures = a?.pictures ?? [];
  const wordBank = a?.words?.length ? `<p class="word-bank"><strong>${a.words.map(escapeXml).join(" · ")}</strong></p>` : "";
  const itemLabel = (item: string, i: number) =>
    a?.type === "picture_label" && pictures[i]?.emoji ? `${pictures[i].emoji} ${itemText(item)}` : itemText(item);
  // Code-drawn diagrams (src/lib/diagrams.ts): scenes as inline SVG, the
  // town map as a table of its street grid.
  const scenes = block.diagram?.type === "prepositions" ? (block.diagram.scenes ?? []) : [];
  const puzzle = renderPuzzleHtml(block);
  const items = puzzle
    ? puzzle
    : block.items?.length
    ? `<ol class="items">${block.items
        .map((item, i) => `<li>${scenes[i] ? `${sceneSvgMarkup(prepositionScene(scenes[i]), 78)} ` : ""}${escapeXml(itemLabel(item, i))}</li>`)
        .join("")}</ol>`
    : "";
  const places = block.diagram?.type === "map" ? (block.diagram.places ?? []) : [];
  const grid = places.length ? mapGrid(places) : null;
  const townMap = grid
    ? `<table class="town-map">${Array.from(
        { length: grid.rows },
        (_, r) =>
          `<tr>${Array.from({ length: grid.cols }, (_, c) => {
            const place = grid.at(r + 1, c + 1);
            return `<td>${place ? escapeXml(place.emoji ? `${place.emoji} ${place.name}` : place.name) : ""}</td>`;
          }).join("")}</tr>`,
      ).join("")}</table>`
    : "";
  const matchPictures =
    a?.type === "picture_match" && pictures.length
      ? `<ol class="items" type="a">${pictures.map((pic) => `<li>${escapeXml(pic.emoji ? `${pic.emoji} ${pic.label}` : pic.label)}</li>`).join("")}</ol>`
      : "";
  const answerKey =
    showAnswerKey && block.answerKey?.length
      ? `<div class="answer-key"><p class="answer-key-label">ANSWER KEY</p><ol>${block.answerKey
          .map((a) => `<li>${escapeXml(itemText(a))}</li>`)
          .join("")}</ol></div>`
      : "";
  // Audit 2026-10-12: dialogues, tables and callouts were dropped from
  // EPUB/LMS - a dialogue page lost its conversation (the writer keeps the
  // body to a one-line lead-in when there is one).
  const dialogue = block.dialogue?.length
    ? `<div class="dialogue">${block.dialogue.map((d) => `<p><strong>${escapeXml(d.speaker)}:</strong> ${escapeXml(d.line)}</p>`).join("")}</div>`
    : "";
  const table = block.table
    ? `<table class="content-table"><tr>${block.table.headers.map((h) => `<th>${escapeXml(h)}</th>`).join("")}</tr>${block.table.rows
        .map((row) => `<tr>${block.table!.headers.map((_, c) => `<td>${escapeXml(row[c] ?? "")}</td>`).join("")}</tr>`)
        .join("")}</table>`
    : "";
  return `<section class="block block-${block.kind}${block.callout ? ` callout callout-${block.callout}` : ""}">
    <h3>${escapeXml(block.heading)}</h3>
    ${paragraphs(block.body)}
    ${dialogue}
    ${table}
    ${townMap}
    ${wordBank}
    ${items}
    ${matchPictures}
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
