import JSZip from "jszip";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import type { Variant } from "@/lib/pdf/BookDocument";
import { withUnitGlossary } from "@/lib/unit-glossary";
import { resolvePageImageUrls } from "@/lib/page-image";
import {
  VARIANT_LABELS,
  escapeXml,
  pagesForVariant,
  renderBlockHtml,
  renderGlossaryHtml,
  fetchAsset,
  extensionForMediaType,
} from "@/lib/content-html";

// Faz H3 (see ROADMAP.md): IMS Common Cartridge 1.1 export - the format
// Moodle and Canvas both import directly (Google Classroom has no native
// import format at all, so that target from the original roadmap note was
// narrowed to "Moodle + Canvas" during planning). Static content only, no
// grade/progress tracking (that needs the heavier SCORM API wrapper -
// deliberately out of scope, see ROADMAP.md).
//
// Reuses the exact same (X)HTML block/glossary rendering as the EPUB
// export (src/lib/content-html.ts) - both are "turn a GeneratedUnit[] into
// real HTML", just packaged differently (EPUB's OPF+nav vs. CC's
// imsmanifest.xml+organization tree).
//
// HONESTY NOTE (also in ROADMAP.md): this manifest was written against the
// IMS Common Cartridge 1.1 XSD structure, not verified by importing the
// output into a real Moodle or Canvas instance - neither was available to
// test against. Treat this as "structurally follows the spec", not
// "confirmed to import cleanly" until someone does that real-LMS check.

function slug(prefix: string, n: number | string): string {
  return `${prefix}-${n}`;
}

export async function buildCommonCartridge(input: {
  bookTitle: string;
  variant: Variant;
  units: GeneratedUnit[];
  level: string;
  pageImages?: Record<number, string>;
}): Promise<Buffer> {
  const { bookTitle, variant, units, level, pageImages } = input;
  const variantLabel = VARIANT_LABELS[variant];
  // Faz "Teacher's Book/Test Booklet Genişletme": test_booklet was missing
  // here despite always generating an answer key - it was silently dropped.
  const showAnswerKey = variant === "workbook" || variant === "teacher_book" || variant === "test_booklet";

  const zip = new JSZip();
  const resourceItems: string[] = [];
  const organizationItems: string[] = [];

  for (const unit of units) {
    const pages = withUnitGlossary(unit, pagesForVariant(unit, variant), variant);
    if (!pages.length) continue;

    const unitId = slug("unit", unit.unitNumber);
    const htmlFile = `${unitId}.html`;
    const fileRefs = [`<file href="${htmlFile}"/>`];

    const pageSections: string[] = [];
    for (const page of pages) {
      // Every picture of the page (Dizilim overrides and Faz B3 extra
      // pictures included). The image prompt is the alt text, not a printed
      // caption - it is an instruction to the image model, not book text
      // (audit 2026-10-18).
      let imageHtml = "";
      for (const [k, imageUrl] of resolvePageImageUrls(page, pageImages).entries()) {
        const { buffer, mediaType } = await fetchAsset(imageUrl, "image/png");
        const ext = extensionForMediaType(mediaType);
        const imagePath = `images/${unitId}-page-${page.sourcePageNumber}${k ? `-${k + 1}` : ""}.${ext}`;
        zip.file(imagePath, buffer);
        fileRefs.push(`<file href="${imagePath}"/>`);
        const alt = k === 0 ? page.imagePrompt : page.extraImagePrompts?.[k - 1];
        imageHtml += `<figure><img src="${imagePath}" alt="${escapeXml(alt ?? "")}"/></figure>`;
      }
      pageSections.push(`
        ${imageHtml}
        ${page.blocks.map((b) => renderBlockHtml(b, showAnswerKey)).join("\n")}
        ${renderGlossaryHtml(page.glossary)}
      `);
    }

    zip.file(
      htmlFile,
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(unit.title)}</title></head>
<body>
  <h1>Unit ${unit.unitNumber}: ${escapeXml(unit.title)}</h1>
  ${pageSections.join("\n")}
</body>
</html>`,
    );

    const resourceId = slug("RES", unit.unitNumber);
    resourceItems.push(
      `<resource identifier="${resourceId}" type="webcontent" href="${htmlFile}">${fileRefs.join("")}</resource>`,
    );
    organizationItems.push(
      `<item identifier="${slug("ITEM", unit.unitNumber)}" identifierref="${resourceId}"><title>${escapeXml(
        `Unit ${unit.unitNumber}: ${unit.title}`,
      )}</title></item>`,
    );
  }

  zip.file(
    "imsmanifest.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-${crypto.randomUUID()}"
  xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1"
  xmlns:lomimscc="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imscp_v1p2_v1p0.xsd">
  <metadata>
    <schema>IMS Common Cartridge</schema>
    <schemaversion>1.1.0</schemaversion>
    <lomimscc:lom>
      <lomimscc:general>
        <lomimscc:title><lomimscc:string>${escapeXml(bookTitle)} — ${escapeXml(variantLabel)}</lomimscc:string></lomimscc:title>
        <lomimscc:description><lomimscc:string>${escapeXml(`${variantLabel} · ${level}`)}</lomimscc:string></lomimscc:description>
      </lomimscc:general>
    </lomimscc:lom>
  </metadata>
  <organizations>
    <organization identifier="ORG-1" structure="rooted-hierarchy">
      <item identifier="root">
        ${organizationItems.join("\n")}
      </item>
    </organization>
  </organizations>
  <resources>
    ${resourceItems.join("\n")}
  </resources>
</manifest>`,
  );

  return zip.generateAsync({ type: "nodebuffer" });
}
