import JSZip from "jszip";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import type { Variant } from "@/lib/pdf/BookDocument";
import type { CourseUnitSummary } from "@/lib/pdf/ContentsDocument";
import {
  VARIANT_LABELS,
  escapeXml,
  pagesForVariant,
  renderBlockHtml,
  renderGlossaryHtml,
  fetchAsset,
  extensionForMediaType,
} from "@/lib/content-html";
import { isValidIsbn13, normalizeIsbn } from "@/lib/isbn";

// EPUB export - the digital/accessible sibling to BookDocument.tsx's PDF.
// Deliberately hand-rolled with jszip rather than an epub-generation
// library: this is a well-defined, bounded file format (EPUB3 is just a
// zip with a fixed internal structure - container.xml + an OPF package
// document + XHTML content + a nav document), and hand-rolling avoids
// pulling in a third-party generator of unknown output quality/maintenance
// status for something this constrained. See ROADMAP.md's project-wide
// assessment (2026-09-20) - EPUB was the top-ranked "medium effort, real
// value" gap (e-reader support, and genuinely screen-reader-accessible
// text unlike the PDF, which react-pdf can't tag for accessibility - see
// BookDocument.tsx's image-caption comment).
//
// Mirrors BookDocument.tsx's variant logic (pagesForVariant, showAnswerKey)
// exactly, so the two formats present the same content - just rendered
// differently. Images and audio are embedded into the EPUB package itself
// (fetched from their Blob URLs at build time), not linked externally -
// external references aren't reliably supported across e-readers and would
// break once/if the source blob is ever removed.

export async function buildEpub(input: {
  bookTitle: string;
  variant: Variant;
  units: GeneratedUnit[];
  level: string;
  contentsUnits: CourseUnitSummary[];
  coverImageSrc?: string;
  pageImages?: Record<number, string>;
  generatedAt?: string;
  isbn?: string | null;
}): Promise<Buffer> {
  const { bookTitle, variant, units, level, contentsUnits, coverImageSrc, pageImages, generatedAt, isbn } = input;
  const variantLabel = VARIANT_LABELS[variant];
  // Faz "Teacher's Book/Test Booklet Genişletme": test_booklet was missing
  // here despite always generating an answer key - it was silently dropped.
  const showAnswerKey = variant === "workbook" || variant === "teacher_book" || variant === "test_booklet";

  const zip = new JSZip();
  // Must be the first file in the archive and stored uncompressed - part of
  // the EPUB spec, not a jszip default.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  zip.file(
    "OEBPS/style.css",
    `body { font-family: serif; line-height: 1.5; }
h1, h2, h3 { font-family: sans-serif; }
.block { margin-bottom: 1.5em; padding: 0.75em; border-left: 4px solid #2563eb; background: #f8fafc; }
.items { padding-left: 1.5em; }
.answer-key { margin-top: 0.75em; padding: 0.5em; background: #eef2ff; }
.answer-key-label { font-weight: bold; font-size: 0.85em; letter-spacing: 0.05em; }
.glossary dt { font-weight: bold; margin-top: 0.5em; }
.glossary dd { margin-left: 0; }
.page-image { max-width: 100%; }
.page-image-caption { font-size: 0.85em; font-style: italic; color: #6b7280; }
figure { margin: 0 0 1em 0; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #d1d5db; padding: 0.4em; text-align: left; font-size: 0.9em; }`,
  );

  const manifestItems: string[] = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="style.css" media-type="text/css"/>`,
  ];
  const spineItems: string[] = [`<itemref idref="nav"/>`];
  const navEntries: string[] = [];

  let coverManifestItem = "";
  if (coverImageSrc) {
    const { buffer, mediaType } = await fetchAsset(coverImageSrc, "image/png");
    const ext = extensionForMediaType(mediaType);
    zip.file(`OEBPS/images/cover.${ext}`, buffer);
    coverManifestItem = `<item id="cover-image" href="images/cover.${ext}" media-type="${mediaType}" properties="cover-image"/>`;
  }

  if (contentsUnits.length) {
    const rows = contentsUnits
      .map(
        (u) =>
          `<tr><td>${u.number}</td><td>${escapeXml(u.title)}</td><td>${escapeXml(u.keyTerms)}</td><td>${escapeXml(
            u.objectives,
          )}</td><td>${escapeXml(u.level)}</td></tr>`,
      )
      .join("\n");
    zip.file(
      "OEBPS/contents.xhtml",
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Contents</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
  <h1>${escapeXml(bookTitle)} — ${escapeXml(variantLabel)}</h1>
  <p>${escapeXml(level)}${generatedAt ? ` · Generated ${escapeXml(generatedAt)}` : ""}</p>
  <table>
    <thead><tr><th>Unit</th><th>Title</th><th>Key terms</th><th>Objectives</th><th>Level</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`,
    );
    manifestItems.push(`<item id="contents" href="contents.xhtml" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="contents"/>`);
    navEntries.push(`<li><a href="contents.xhtml">Contents</a></li>`);
  }

  for (const unit of units) {
    const pages = pagesForVariant(unit, variant);
    if (!pages.length) continue;

    const pageSections: string[] = [];
    for (const page of pages) {
      let imageHtml = "";
      const imageUrl = pageImages?.[page.sourcePageNumber];
      if (imageUrl) {
        const { buffer, mediaType } = await fetchAsset(imageUrl, "image/png");
        const ext = extensionForMediaType(mediaType);
        const epubPath = `images/unit-${unit.unitNumber}-page-${page.sourcePageNumber}.${ext}`;
        zip.file(`OEBPS/${epubPath}`, buffer);
        manifestItems.push(
          `<item id="img-${unit.unitNumber}-${page.sourcePageNumber}" href="${epubPath}" media-type="${mediaType}"/>`,
        );
        imageHtml = `<figure><img class="page-image" src="${epubPath}" alt=""/>${
          page.imagePrompt ? `<figcaption class="page-image-caption">${escapeXml(page.imagePrompt)}</figcaption>` : ""
        }</figure>`;
      }

      let audioHtml = "";
      // Audio is attached at the unit level (mirrored.listeningAudio), not
      // per-page - see GeneratedUnit. Rendered once, on the unit's first
      // page section, rather than repeated on every page.
      if (page === pages[0] && unit.listeningAudio?.length) {
        const clips: string[] = [];
        for (const [i, entry] of unit.listeningAudio.entries()) {
          if (!entry.audioUrl) continue;
          const { buffer, mediaType } = await fetchAsset(entry.audioUrl, "audio/mpeg");
          const epubPath = `audio/unit-${unit.unitNumber}-audio-${i}.mp3`;
          zip.file(`OEBPS/${epubPath}`, buffer);
          manifestItems.push(`<item id="audio-${unit.unitNumber}-${i}" href="${epubPath}" media-type="${mediaType}"/>`);
          clips.push(
            `<figure><figcaption>${escapeXml(entry.blockRef)}</figcaption><audio controls="controls" src="${epubPath}">Your reader does not support embedded audio.</audio></figure>`,
          );
        }
        audioHtml = clips.join("\n");
      }

      pageSections.push(`
        ${imageHtml}
        ${audioHtml}
        ${page.blocks.map((b) => renderBlockHtml(b, showAnswerKey)).join("\n")}
        ${renderGlossaryHtml(page.glossary)}
      `);
    }

    const unitId = `unit-${unit.unitNumber}`;
    zip.file(
      `OEBPS/${unitId}.xhtml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(unit.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
  <h1>Unit ${unit.unitNumber}: ${escapeXml(unit.title)}</h1>
  ${pageSections.join("\n")}
</body>
</html>`,
    );
    manifestItems.push(`<item id="${unitId}" href="${unitId}.xhtml" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="${unitId}"/>`);
    navEntries.push(`<li><a href="${unitId}.xhtml">Unit ${unit.unitNumber}: ${escapeXml(unit.title)}</a></li>`);
  }

  if (showAnswerKey) {
    const answerKeySections = units
      .map((unit) => {
        const entries = pagesForVariant(unit, variant)
          .flatMap((page) => page.blocks)
          .filter((block) => block.answerKey?.length)
          .map(
            (block) =>
              `<div class="answer-key"><p class="answer-key-label">${escapeXml(block.heading)}</p><ol>${block
                .answerKey!.map((a) => `<li>${escapeXml(a)}</li>`)
                .join("")}</ol></div>`,
          )
          .join("\n");
        return entries ? `<section><h2>Unit ${unit.unitNumber}: ${escapeXml(unit.title)}</h2>${entries}</section>` : "";
      })
      .join("\n");

    zip.file(
      "OEBPS/answer-key.xhtml",
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Answer Key</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
  <h1>Answer Key</h1>
  ${answerKeySections}
</body>
</html>`,
    );
    manifestItems.push(`<item id="answer-key" href="answer-key.xhtml" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="answer-key"/>`);
    navEntries.push(`<li><a href="answer-key.xhtml">Answer Key</a></li>`);
  }

  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${escapeXml(bookTitle)} — ${escapeXml(variantLabel)}</h1>
    <ol>
      ${navEntries.join("\n")}
    </ol>
  </nav>
</body>
</html>`,
  );

  // ISBN/baskıya hazırlık (2026-09-20, ROADMAP.md): a book's real ISBN is
  // its canonical EPUB identifier when it has one - only falls back to a
  // random UUID when no (valid) ISBN was given, same as before this existed.
  const identifier = isValidIsbn13(isbn ?? "") ? `urn:isbn:${normalizeIsbn(isbn!)}` : `urn:uuid:${crypto.randomUUID()}`;
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${identifier}</dc:identifier>
    <dc:title>${escapeXml(bookTitle)} — ${escapeXml(variantLabel)}</dc:title>
    <dc:language>en</dc:language>
    <dc:description>${escapeXml(`${variantLabel} · ${level}${generatedAt ? ` · Generated ${generatedAt}` : ""}`)}</dc:description>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    ${coverManifestItem}
    ${manifestItems.join("\n")}
  </manifest>
  <spine>
    ${spineItems.join("\n")}
  </spine>
</package>`,
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer", mimeType: "application/epub+zip" });
  return buffer;
}
