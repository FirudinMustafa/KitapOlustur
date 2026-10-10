import { z } from "zod";
import { LAYOUT_TEMPLATE_IDS } from "./layouts";

// Faz 3 "Görsel sayfa denetimi": the typeset book is rendered to page
// images and an art director (vision model) grades each page the way a
// publisher's production editor would. This module is the pure part:
// mapping PDF pages back to logical pages, the grading schema and rubric,
// and the decision what to do about a weak page.

export type ProofSpan = {
  /** "cover", "answer_key", or "<unitNumber>:<pageIndex>" (index within the book type's pages). */
  key: string;
  startPage: number;
  /** How many PDF pages this logical page occupies - more than 1 means it spilled. */
  pageCount: number;
};

// BookDocument's PageMarker reports where each logical page starts; the
// span of each is everything up to the next start. The cover is always one
// page - the unmarked imprint and contents pages follow it, not spill from it.
export function buildPageSpans(starts: Record<string, number>, totalPages: number): ProofSpan[] {
  const ordered = Object.entries(starts).sort((a, b) => a[1] - b[1]);
  return ordered.map(([key, startPage], i) => {
    const next = ordered[i + 1]?.[1] ?? totalPages + 1;
    return { key, startPage, pageCount: key === "cover" ? 1 : Math.max(1, next - startPage) };
  });
}

export function parseUnitPageKey(key: string): { unitNumber: number; pageIndex: number } | null {
  const m = /^(\d+):(\d+)$/.exec(key);
  return m ? { unitNumber: Number(m[1]), pageIndex: Number(m[2]) } : null;
}

export const DESIGN_ISSUE_TYPES = [
  "overflow",
  "cut_off_text",
  "empty_space",
  "crowded",
  "alignment",
  "readability",
  "image_problem",
  "image_text_mismatch",
  "monotony",
  "other",
] as const;

export const DESIGN_FIXES = ["none", "shorten_text", "enrich_content", "switch_template", "regenerate_image"] as const;
export type DesignFix = (typeof DESIGN_FIXES)[number];

export const pageDesignGradeSchema = z.object({
  pages: z.array(
    z.object({
      pdfPage: z.number().describe("The page number printed in the label above the image"),
      score: z.number().min(0).max(100).describe("0-100: how close this page is to a professionally published coursebook page"),
      issues: z.array(
        z.object({
          type: z.enum(DESIGN_ISSUE_TYPES),
          severity: z.enum(["minor", "major"]),
          description: z.string().describe("Concrete, in Turkish, e.g. 'Alt yarı tamamen boş'"),
        }),
      ),
      suggestedFix: z.enum(DESIGN_FIXES),
      suggestedTemplate: z
        .enum(LAYOUT_TEMPLATE_IDS)
        .optional()
        .describe("Only with suggestedFix=switch_template: the template that would suit this content better"),
      referenceGap: z
        .string()
        .optional()
        .describe("Only when reference pages were shown: in Turkish, what most separates this page from the reference design"),
    }),
  ),
});
export type PageDesignGrade = z.infer<typeof pageDesignGradeSchema>["pages"][number];

export const PASSING_DESIGN_SCORE = 70;

export function designRubric(hasReferences: boolean): string {
  return [
    "You are the art director at an educational publisher (think Oxford University Press / Cambridge ELT). Below are typeset pages of a coursebook, each preceded by a label with its PDF page number. Grade every page against a professionally published coursebook page.",
    "Check: text cut off or overflowing a box; content that obviously continues from or onto another page; large accidental empty areas (more than about a third of the page blank, except a deliberate full-page picture); crowding or boxes touching; misalignment; text too small or low contrast; a picture that is broken, clipped, distorted or unrelated to the text; and pages that look like a plain document rather than a designed page.",
    "Score 85-100 = could ship in a published book; 70-84 = acceptable with minor polish; below 70 = would be rejected by a production editor.",
    "suggestedFix: 'shorten_text' when the page is overfull or spills; 'enrich_content' when the page looks thin or half-empty (too little content for a published page); 'switch_template' when the arrangement doesn't suit the content (then give suggestedTemplate from: " +
      LAYOUT_TEMPLATE_IDS.join(", ") +
      "); 'regenerate_image' when the picture itself is the problem; otherwise 'none'.",
    hasReferences
      ? "After the book pages you will also see REFERENCE pages from a published book the user wants to match. Use them as the quality bar: score relative to them and fill referenceGap with the single most important difference (layout richness, use of colour/boxes, picture size, typography). Never suggest copying their content."
      : "",
    "Write every description and referenceGap in Turkish.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Decide the automatic fix for a graded page. Spilling onto extra PDF pages
// is measured, not judged, so it always wins over the model's suggestion.
export function decideFix(grade: Pick<PageDesignGrade, "score" | "suggestedFix" | "suggestedTemplate" | "issues">, span: ProofSpan): DesignFix {
  if (span.pageCount > 1) return "shorten_text";
  const major = grade.issues.some((i) => i.severity === "major");
  if (grade.score >= PASSING_DESIGN_SCORE && !major) return "none";
  // Live E2E 2026-10-09: on half-empty pages the art director kept asking
  // for another template, which can't add what isn't there - every page
  // scored the same in round 2. A page that is mostly blank needs content.
  if (grade.issues.some((i) => i.type === "empty_space" && i.severity === "major") && grade.suggestedFix !== "regenerate_image") {
    return "enrich_content";
  }
  if (grade.suggestedFix === "switch_template" && !grade.suggestedTemplate) return "none";
  return grade.suggestedFix;
}
