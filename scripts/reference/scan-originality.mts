// Originality check of the hand-made book against the phone scan it was
// re-made from. The scan has no text layer, so its text is transcribed by
// hand into .handmade-scan/scan-text.json (untracked; { "<book page>":
// { rubrics: string[], text: string } }). Uses the system's own guards:
// structural mirroring (src/lib/mirroring.ts) and the source's names
// (src/lib/source-names.ts), plus a plain shared-sentence count.
//
//   npx tsx scripts/reference/scan-originality.mts <book.pdf> <first-pdf-page-of-book-p7>
import fs from "node:fs";
import path from "node:path";
import * as m from "mupdf";
import { structuralMirroring, sentences } from "../../src/lib/mirroring";
import { usedNames } from "../../src/lib/source-names";

const [pdf, firstArg] = process.argv.slice(2);
if (!pdf) throw new Error("usage: scan-originality.mts <book.pdf> <pdf page of book p.7>");
const first = Number(firstArg ?? 5);
const scan = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".handmade-scan", "scan-text.json"), "utf8")) as Record<string, { rubrics: string[]; text: string }>;
// the scan's own people, places and feature names
const SOURCE_NAMES = ["Oscar", "Lucy", "Ozzy", "Rose", "Paul", "Mrs Battle", "Max", "BR-001", "Bad Robot", "Time-taxi", "Time-Taxi", "Huggi", "Susan", "Dave", "Jane", "Emily", "Lisa", "Roy", "Mrs Smith", "Blue Lake School", "Mike", "Ashley", "Sonia", "David", "Jessica", "Mr James", "London High School", "Alan", "Fred", "Linda", "Simon", "Lucky", "Storm", "Tommy", "Peter", "Tim", "Mr White", "Jill", "Raul", "Mary", "Jack", "Mrs Scott", "Mr Sawyer", "Mars", "time travel"];

const doc = m.Document.openDocument(fs.readFileSync(pdf), "application/pdf");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
let flagged = 0;
let shared = 0;
for (let page = 7; page <= 22; page++) {
  const src = scan[String(page)];
  const i = first - 1 + (page - 7);
  if (!src || i >= doc.countPages()) continue;
  const text = doc.loadPage(i).toStructuredText("preserve-whitespace").asText();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const r = structuralMirroring({ text: src.text, rubrics: src.rubrics }, { blocks: lines.map((heading) => ({ heading })) });
  const srcSent = new Set(sentences(src.text).map(norm).filter((s) => s.split(" ").length >= 4));
  const mine = sentences(lines.join(" ")).map(norm).filter((s) => s.split(" ").length >= 4);
  const same = [...new Set(mine.filter((s) => srcSent.has(s)))];
  const names = usedNames(text, SOURCE_NAMES);
  if (r.flagged) flagged++;
  shared += same.length;
  console.log(`${r.flagged ? "FLAG" : "  ok"} p${page}: ${r.mirroredItems}/${r.comparedItems} frames in source order, shared instructions ${JSON.stringify(r.sharedRubrics)}, identical sentences ${same.length}${same.length ? ` ${JSON.stringify(same)}` : ""}${names.length ? `, SOURCE NAMES ${names.join(", ")}` : ""}`);
  if (r.flagged) for (const e of r.examples) console.log(`       "${e.source}"  ~  "${e.generated}"`);
}
console.log(`\npages mirroring the scan: ${flagged}/16; identical sentences of 4+ words: ${shared}`);
