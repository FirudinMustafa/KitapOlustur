import type { GeneratedUnit } from "@/lib/ai/schemas";

// Faz "Arama/kütüphane indeksleme" (2026-09-20, ROADMAP.md): pure matching
// logic factored out of src/app/api/search/route.ts so it's unit-testable
// without a database - the route itself just fetches the user's own
// generatedBooks and calls this. Deliberately a plain in-memory substring
// search, not a real full-text search index - see the route's own comment
// for why (personal tool, small per-user data volume).
export type SearchResult = {
  projectId: string;
  projectName: string;
  bookType: string;
  unitNumber: number;
  unitTitle: string;
  field: "unitTitle" | "blockHeading" | "blockBody" | "glossary";
  snippet: string;
};

function snippetAround(text: string, index: number, query: string): string {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + query.length + 60);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export function findMatches(
  projectId: string,
  projectName: string,
  bookType: string,
  units: GeneratedUnit[],
  query: string,
): SearchResult[] {
  const needle = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const unit of units) {
    const unitTitle = unit.title ?? "";
    const titleIdx = unitTitle.toLowerCase().indexOf(needle);
    if (titleIdx !== -1) {
      results.push({
        projectId,
        projectName,
        bookType,
        unitNumber: unit.unitNumber,
        unitTitle,
        field: "unitTitle",
        snippet: snippetAround(unitTitle, titleIdx, query),
      });
    }

    // Faz "Arama": defensive against pre-schema-change generatedBooks rows
    // that predate these fields (see the identical `?? []` fix applied to
    // pagesForVariant when this was first discovered, ROADMAP.md H2 Faz 1).
    const allPages = [
      ...(unit.studentBookPages ?? []),
      ...(unit.workbookPages ?? []),
      ...(unit.teacherBookPages ?? []),
      ...(unit.testBookletPages ?? []),
    ];
    for (const page of allPages) {
      for (const block of page.blocks ?? []) {
        const heading = block.heading ?? "";
        const body = block.body ?? "";
        const headingIdx = heading.toLowerCase().indexOf(needle);
        if (headingIdx !== -1) {
          results.push({
            projectId,
            projectName,
            bookType,
            unitNumber: unit.unitNumber,
            unitTitle,
            field: "blockHeading",
            snippet: snippetAround(heading, headingIdx, query),
          });
        }
        const bodyIdx = body.toLowerCase().indexOf(needle);
        if (bodyIdx !== -1) {
          results.push({
            projectId,
            projectName,
            bookType,
            unitNumber: unit.unitNumber,
            unitTitle,
            field: "blockBody",
            snippet: snippetAround(body, bodyIdx, query),
          });
        }
      }
      for (const entry of page.glossary ?? []) {
        const term = entry.term ?? "";
        const definition = entry.definition ?? "";
        const termIdx = term.toLowerCase().indexOf(needle);
        const defIdx = definition.toLowerCase().indexOf(needle);
        if (termIdx !== -1 || defIdx !== -1) {
          results.push({
            projectId,
            projectName,
            bookType,
            unitNumber: unit.unitNumber,
            unitTitle,
            field: "glossary",
            snippet:
              termIdx !== -1
                ? snippetAround(term, termIdx, query)
                : snippetAround(definition, defIdx, query),
          });
        }
      }
    }
  }

  return results;
}
