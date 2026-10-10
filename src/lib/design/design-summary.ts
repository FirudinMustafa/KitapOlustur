import type { PageDesignReviewRow } from "@/db/schema";

// Faz 3 "Görsel sayfa denetimi": condenses the page_design_reviews rows of a
// run into what the project page shows - the latest round's grade per book
// type, the weakest pages, and what the automatic fixes did.

export type DesignReviewSummary = {
  round: number;
  bookTypes: { bookType: string; averageScore: number; pages: number; spilled: number; belowBar: number }[];
  weakest: {
    bookType: string;
    pdfPage: number;
    unitNumber: number | null;
    score: number;
    imageUrl: string;
    issues: { type: string; severity: "minor" | "major"; description: string }[];
    referenceGap: string | null;
    pageCount: number;
  }[];
  fixesApplied: number;
  firstRoundAverage: number | null;
};

const BAR = 70;

function avg(rows: { score: number }[]): number {
  return rows.length ? Math.round(rows.reduce((n, r) => n + r.score, 0) / rows.length) : 0;
}

export function summarizeDesignReviews(rows: Pick<PageDesignReviewRow, "round" | "bookType" | "pdfPage" | "unitNumber" | "score" | "imageUrl" | "issues" | "referenceGap" | "pageCount" | "appliedFix">[]): DesignReviewSummary | null {
  if (!rows.length) return null;
  const round = Math.max(...rows.map((r) => r.round));
  const latest = rows.filter((r) => r.round === round);
  const types = [...new Set(latest.map((r) => r.bookType))];
  const firstRound = rows.filter((r) => r.round === 1);
  return {
    round,
    bookTypes: types.map((bookType) => {
      const own = latest.filter((r) => r.bookType === bookType);
      return {
        bookType,
        averageScore: avg(own),
        pages: own.length,
        spilled: own.filter((r) => r.pageCount > 1).length,
        belowBar: own.filter((r) => r.score < BAR).length,
      };
    }),
    weakest: [...latest]
      .sort((a, b) => a.score - b.score)
      .slice(0, 6)
      .filter((r) => r.score < 85 || r.pageCount > 1)
      .map((r) => ({
        bookType: r.bookType,
        pdfPage: r.pdfPage,
        unitNumber: r.unitNumber,
        score: r.score,
        imageUrl: r.imageUrl,
        issues: r.issues,
        referenceGap: r.referenceGap,
        pageCount: r.pageCount,
      })),
    fixesApplied: rows.filter((r) => r.appliedFix && r.appliedFix !== "none").length,
    firstRoundAverage: round > 1 ? avg(firstRound) : null,
  };
}
