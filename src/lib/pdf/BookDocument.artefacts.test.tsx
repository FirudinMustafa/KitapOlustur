import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import { ARTEFACT_FIXTURES as A } from "@/lib/text-style.fixtures";
import { BookDocument } from "./BookDocument";
import { rasterizePdf } from "./rasterize";

// One page of each artefact style (src/lib/pdf/artefacts.tsx) - a note,
// an email, a text message, an invitation, a quiz and a poster - in the
// card flow. FIXTURE_OUT=<dir> writes the page PNGs for a visual check.
const OUT = process.env.FIXTURE_OUT;

const unit: GeneratedUnit = {
  unitNumber: 1,
  title: "Home and Free Time",
  glossary: [],
  workbookPages: [],
  studentBookPages: [
    { sourcePageNumber: 1, pageType: "content", unitNumber: 1, sectionLabel: "1a", blocks: [A.email, A.note, A.message] },
    { sourcePageNumber: 2, pageType: "content", unitNumber: 1, sectionLabel: "1b", blocks: [A.invitation, A.quiz, A.poster] },
  ],
};

describe("BookDocument artefacts", () => {
  it("prints every artefact style on its own page, items still numbered", async () => {
    const buffer = await renderToBuffer(
      <BookDocument bookTitle="Team Up" variant="student_book" units={[unit]} level="A2" contentsUnits={[]} pageImages={{}} contentLanguage="en" />,
    );
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    const pages = await rasterizePdf(new Uint8Array(buffer), { dpi: OUT ? 110 : 20 });
    if (OUT) {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(path.join(OUT, "artefacts.pdf"), buffer);
      for (const p of pages) writeFileSync(path.join(OUT, `artefacts-${String(p.pageNumber).padStart(2, "0")}.png`), p.png);
    }
    const text = await pdfText(buffer);
    for (const s of ["Hi, Ben!", "Talk to you soon.", "From:", "Ricky,", "Jane X", "See you soon, Lily", "Hollywood", "1 Which of these do you prefer to do?", "SUMMER FUN DAY"]) {
      expect(text).toContain(s);
    }
    // the email's own items and the invitation's still print as a numbered list
    expect(text).toContain("1. Tom's mum");
    expect(text).toContain("4. 45 / 55");
  }, 60_000);
});

async function pdfText(buffer: Buffer): Promise<string> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(buffer, "application/pdf");
  let out = "";
  for (let i = 0; i < doc.countPages(); i++) out += doc.loadPage(i).toStructuredText("preserve-whitespace").asText() + "\n";
  return out.replace(/[ \t]+\n/g, "\n");
}
