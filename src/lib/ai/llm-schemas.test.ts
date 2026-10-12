import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bookCoherenceReviewSchema,
  bookOutlineSchema,
  generatedComplementarySideSchema,
  generatedMirroredSideSchema,
  generatedPageSchema,
  imageReviewSchema,
  improvementPlanSchema,
  originalityLlmAssessmentSchema,
  pageMapSchema,
  pictureBookPagesSchema,
  styleBibleSchema,
  unitReviewSchema,
} from "./schemas";

// Every schema handed to generateObject is turned into the provider's
// response schema. Gemini (free mode) rejects some JSON-schema shapes
// outright with HTTP 400 - live test 2026-10-12: a numeric literal union and
// a tuple in the page schema failed every unit. Shapes it refuses:
// non-string enum/const values, and tuple items (an array under "items" or
// "prefixItems").
const WRITER_SCHEMAS = {
  bookCoherenceReviewSchema,
  bookOutlineSchema,
  generatedComplementarySideSchema,
  generatedMirroredSideSchema,
  generatedPageSchema,
  imageReviewSchema,
  improvementPlanSchema,
  originalityLlmAssessmentSchema,
  pageMapSchema,
  pictureBookPagesSchema,
  styleBibleSchema,
  unitReviewSchema,
};

function problems(node: unknown, path: string, out: string[]) {
  if (!node || typeof node !== "object") return;
  const n = node as Record<string, unknown>;
  if (Array.isArray(n.enum) && n.enum.some((v) => typeof v !== "string")) out.push(`${path}: non-string enum`);
  if ("const" in n && typeof n.const !== "string") out.push(`${path}: non-string const`);
  if (Array.isArray(n.items) || "prefixItems" in n) out.push(`${path}: tuple`);
  for (const [k, v] of Object.entries(n)) {
    if (Array.isArray(v)) v.forEach((x, i) => problems(x, `${path}.${k}[${i}]`, out));
    else problems(v, `${path}.${k}`, out);
  }
}

describe("schemas sent to the writer models", () => {
  for (const [name, schema] of Object.entries(WRITER_SCHEMAS)) {
    it(`${name} uses only shapes Gemini accepts`, () => {
      const out: string[] = [];
      problems(z.toJSONSchema(schema as z.ZodType, { unrepresentable: "any" }), name, out);
      expect(out).toEqual([]);
    });
  }
});
