import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { BookDocument } from "@/lib/pdf/BookDocument";
import { countPdfPages } from "@/lib/pdf/rasterize";
import { sampleContents, sampleUnit } from "@/lib/pdf/__fixtures__/sample-book";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import { buildPageSpans, decideFix, parseUnitPageKey } from "./page-review";
import { summarizeDesignReviews } from "./design-summary";

describe("buildPageSpans", () => {
  it("measures how many PDF pages each logical page occupies", () => {
    const spans = buildPageSpans({ cover: 1, "1:0": 4, "1:1": 5, "1:2": 8, answer_key: 9 }, 10);
    expect(spans).toEqual([
      { key: "cover", startPage: 1, pageCount: 1 },
      { key: "1:0", startPage: 4, pageCount: 1 },
      { key: "1:1", startPage: 5, pageCount: 3 },
      { key: "1:2", startPage: 8, pageCount: 1 },
      { key: "answer_key", startPage: 9, pageCount: 2 },
    ]);
  });

  it("parses unit page keys", () => {
    expect(parseUnitPageKey("3:12")).toEqual({ unitNumber: 3, pageIndex: 12 });
    expect(parseUnitPageKey("cover")).toBeNull();
  });
});

describe("proof render mapping", () => {
  it("detects a page that spills onto extra printed pages", async () => {
    const unit: GeneratedUnit = {
      ...sampleUnit,
      studentBookPages: [
        sampleUnit.studentBookPages[1],
        // Legacy (no template) page far longer than one A4 page.
        { sourcePageNumber: 50, pageType: "content", unitNumber: 1, blocks: [{ kind: "narrative", heading: "Long", body: "word ".repeat(2600) }] },
        sampleUnit.studentBookPages[6],
      ],
    };
    const starts: Record<string, number> = {};
    const pdf = await renderToBuffer(
      <BookDocument
        bookTitle="Proof"
        variant="student_book"
        units={[unit]}
        level="A2"
        contentsUnits={sampleContents}
        onPageStart={(key, n) => {
          starts[key] = Math.min(starts[key] ?? n, n);
        }}
      />,
    );
    const spans = buildPageSpans(starts, await countPdfPages(new Uint8Array(pdf)));
    const byKey = Object.fromEntries(spans.map((s) => [s.key, s.pageCount]));
    expect(byKey["1:0"]).toBe(1);
    expect(byKey["1:1"]).toBeGreaterThan(1);
    expect(byKey["1:2"]).toBe(1);
  }, 60_000);
});

describe("decideFix", () => {
  const span = { key: "1:0", startPage: 4, pageCount: 1 };
  it("always shortens a page that spilled, whatever the grade", () => {
    expect(decideFix({ score: 95, suggestedFix: "none", issues: [] }, { ...span, pageCount: 2 })).toBe("shorten_text");
  });
  it("leaves passing pages alone", () => {
    expect(decideFix({ score: 82, suggestedFix: "switch_template", suggestedTemplate: "two-column", issues: [] }, span)).toBe("none");
  });
  it("follows the art director on weak pages", () => {
    expect(decideFix({ score: 55, suggestedFix: "switch_template", suggestedTemplate: "exercise-grid", issues: [] }, span)).toBe("switch_template");
  });
  it("acts on a major issue even with a decent score", () => {
    expect(
      decideFix({ score: 78, suggestedFix: "shorten_text", issues: [{ type: "cut_off_text", severity: "major", description: "x" }] }, span),
    ).toBe("shorten_text");
  });
  it("ignores a template switch without a template", () => {
    expect(decideFix({ score: 40, suggestedFix: "switch_template", issues: [] }, span)).toBe("none");
  });
});

describe("summarizeDesignReviews", () => {
  const row = (round: number, pdfPage: number, score: number, extra: object = {}) => ({
    round,
    bookType: "student_book" as const,
    pdfPage,
    unitNumber: 1,
    score,
    imageUrl: `https://x/${round}-${pdfPage}.png`,
    issues: [],
    referenceGap: null,
    pageCount: 1,
    appliedFix: null,
    ...extra,
  });

  it("reports the latest round and how much the fixes helped", () => {
    const summary = summarizeDesignReviews([
      row(1, 4, 50, { appliedFix: "shorten_text" }),
      row(1, 5, 80),
      row(2, 4, 78),
      row(2, 5, 82),
    ]);
    expect(summary?.round).toBe(2);
    expect(summary?.firstRoundAverage).toBe(65);
    expect(summary?.bookTypes[0]).toMatchObject({ averageScore: 80, pages: 2, belowBar: 0 });
    expect(summary?.fixesApplied).toBe(1);
    expect(summary?.weakest.map((w) => w.pdfPage)).toEqual([4, 5]);
  });

  it("is null without reviews", () => {
    expect(summarizeDesignReviews([])).toBeNull();
  });
});

describe("decideFix on half-empty pages", () => {
  it("adds content instead of shuffling templates when the page is mostly blank", () => {
    const span = { key: "1:0", startPage: 4, pageCount: 1 };
    expect(
      decideFix(
        { score: 55, suggestedFix: "switch_template", suggestedTemplate: "two-column", issues: [{ type: "empty_space", severity: "major", description: "boş" }] },
        span,
      ),
    ).toBe("enrich_content");
  });
});
