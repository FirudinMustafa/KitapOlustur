// Originality and level check of "Paper Kite 5" Unit 2 (handcraft-meb5.tsx)
// against the official MEB Year 5 Theme 2 material it was written from: the
// Student's Book unit (PDF pp. 42-55), the Teacher's Guide digital-story
// script for Theme 2 and the official Workbook's Theme 2 (pp. 16-21). The
// MEB text stays outside git (.spike/meb5/txt in the main checkout).
// Uses the system's own guards: structural mirroring (src/lib/mirroring.ts),
// the source's names (src/lib/source-names.ts), a shared-sentence count, and
// levelProfile (src/lib/cefr-vocabulary.ts) for CEFR A1.
//
//   npx tsx scripts/reference/meb5-check.mts .spike/meb5-out/raw-sb.pdf .spike/meb5-out/raw-wb.pdf
import fs from "node:fs";
import path from "node:path";
import * as m from "mupdf";
import { structuralMirroring, sentences } from "../../src/lib/mirroring";
import { usedNames } from "../../src/lib/source-names";
import { levelProfile } from "../../src/lib/cefr-vocabulary";
import { WORDS } from "./handcraft-meb5-content";

const pdfs = process.argv.slice(2);
if (!pdfs.length) throw new Error("usage: meb5-check.mts <book.pdf> [...]");
const TXT = [path.resolve(process.cwd(), "..", "..", "..", ".spike", "meb5", "txt"), path.join(process.cwd(), ".spike", "meb5", "txt")].find((d) => fs.existsSync(path.join(d, "dk.txt")));
if (!TXT) throw new Error("MEB text not found (.spike/meb5/txt)");

function pages(file: string, first: number, last: number) {
  const t = fs.readFileSync(path.join(TXT!, file), "utf8");
  const out: { label: string; text: string }[] = [];
  for (let p = first; p <= last; p++) {
    const a = t.indexOf(`===== PAGE ${p} =====`);
    const b = t.indexOf(`===== PAGE ${p + 1} =====`);
    if (a < 0) continue;
    // the PDF text layer breaks rotated labels into one letter per line: drop those
    const text = t
      .slice(a, b < 0 ? undefined : b)
      .split("\n")
      .filter((l) => l.trim().length > 1)
      .join("\n");
    out.push({ label: `${file} p${p}`, text });
  }
  return out;
}
const ok = fs.readFileSync(path.join(TXT, "ok.txt"), "utf8");
const story = ok.slice(ok.indexOf("THEME 2\nCLASSROOM LIFE\nScene 1"), ok.indexOf("THEME 3\n", ok.indexOf("THEME 2\nCLASSROOM LIFE\nScene 1")));
const SOURCE = [...pages("dk.txt", 42, 55), ...pages("ck.txt", 16, 21), { label: "TG digital story (Theme 2)", text: story }];
const SOURCE_NAMES = ["Efe", "Mert", "Ceren", "Janet", "Sara", "Mary", "Kate", "Tom", "Emily", "Nick", "Ms Johnson", "Aylin", "Ali", "Zeynep", "Murat", "Seda", "Doruk", "Sharon", "Mike", "Ms Parker", "Elif", "George", "Terry", "Ann", "Cumhuriyet", "Aydın", "Ms Johnson"];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const srcSent = new Map<string, string>();
for (const s of SOURCE) for (const x of sentences(s.text)) {
  const k = norm(x);
  if (k.split(" ").length >= 4) srcSent.set(k, s.label);
}

let flagged = 0;
let shared = 0;
let names = 0;
const bookText: string[] = [];
for (const pdf of pdfs) {
  const doc = m.Document.openDocument(fs.readFileSync(pdf), "application/pdf");
  for (let i = 0; i < doc.countPages(); i++) {
    const text = doc.loadPage(i).toStructuredText("preserve-whitespace").asText();
    // the slug line under the trim is press information, not page content
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !/interior page \d+\/\d+/.test(l));
    bookText.push(lines.join("\n"));
    let worst = { flagged: false, mirroredItems: 0, comparedItems: 0, sharedRubrics: [] as string[], label: "" };
    for (const s of SOURCE) {
      const r = structuralMirroring({ text: s.text }, { blocks: lines.map((heading) => ({ heading })) });
      if (r.flagged || r.mirroredItems > worst.mirroredItems) worst = { ...r, label: s.label };
    }
    const mine = [...new Set(sentences(lines.join(" ")).map(norm).filter((s) => s.split(" ").length >= 4))];
    const same = mine.filter((s) => srcSent.has(s));
    const used = usedNames(lines.join(" "), SOURCE_NAMES);
    if (worst.flagged) flagged++;
    shared += same.length;
    names += used.length;
    console.log(`${worst.flagged ? "FLAG" : "  ok"} ${path.basename(pdf)} p${i + 1}: max ${worst.mirroredItems}/${worst.comparedItems} frames in source order (${worst.label || "-"}), shared instructions ${JSON.stringify(worst.sharedRubrics)}, identical sentences ${same.length}${same.length ? ` ${JSON.stringify(same.map((s) => `${s} [${srcSent.get(s)}]`))}` : ""}${used.length ? `, SOURCE NAMES ${used.join(", ")}` : ""}`);
  }
}
console.log(`\noriginality: pages mirroring a source page ${flagged}; identical sentences of 4+ words ${shared}; source names ${names}`);

// level: the whole book against CEFR A1, the unit's taught words allowed
const taught = WORDS.flatMap((g) => g.words.map((w) => w[0]));
const lp = levelProfile(bookText.join("\n"), "A1", taught);
const srcLp = levelProfile(SOURCE.slice(0, 14).map((s) => s.text).join("\n"), "A1", taught);
console.log(`level: ${(lp.aboveShare * 100).toFixed(1)}% of classified words above A1 (${lp.aboveTokens}/${lp.classifiedTokens}); source unit ${(srcLp.aboveShare * 100).toFixed(1)}%`);
console.log(`above A1: ${lp.aboveWords.slice(0, 40).map((w) => `${w.word}(${w.band})x${w.count}`).join(", ")}`);
