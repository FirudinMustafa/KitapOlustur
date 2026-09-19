import { describe, expect, it } from "vitest";
import {
  pageMapSchema,
  bookOutlineSchema,
  generatedUnitSchema,
  imageReviewSchema,
  bookCoherenceReviewSchema,
  coherenceIssueSchema,
} from "./schemas";

// Fixture-based validation for the schemas that gate what the pipeline will
// accept from the model (generateObject) and what the DB layer persists.
// These exist so a schema edit that silently breaks a previously-valid shape
// (or accidentally accepts an invalid one) fails in CI, not in a live run
// hours into generation. See ROADMAP.md Faz G2.

describe("pageMapSchema", () => {
  it("accepts a minimal valid page map", () => {
    const result = pageMapSchema.safeParse({
      totalPages: 1,
      pages: [
        {
          pageNumber: 1,
          pageType: "cover",
          unitNumber: null,
          summary: "Front cover",
          hasImage: true,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown pageType", () => {
    const result = pageMapSchema.safeParse({
      totalPages: 1,
      pages: [
        { pageNumber: 1, pageType: "table_of_contents", unitNumber: null, summary: "x", hasImage: false },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts the optional sourceText and imageDescription fields", () => {
    const result = pageMapSchema.safeParse({
      totalPages: 1,
      pages: [
        {
          pageNumber: 1,
          pageType: "content",
          unitNumber: 1,
          summary: "A reading passage",
          sourceText: "Read the passage and answer the questions.",
          hasImage: true,
          imageDescription: "A classroom scene",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("bookOutlineSchema", () => {
  it("accepts a minimal valid outline", () => {
    const result = bookOutlineSchema.safeParse({
      bookTitle: "English for Everyone",
      subject: "English Language Teaching",
      contentLanguage: "en",
      level: "A2",
      tone: "friendly",
      targetAudience: "teenagers",
      units: [
        {
          number: 1,
          title: "Introductions",
          level: "A2",
          sourcePageRange: { start: 1, end: 6 },
          learningObjectives: ["Introduce yourself"],
          keyTerms: ["hello", "name"],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a unit missing required fields", () => {
    const result = bookOutlineSchema.safeParse({
      bookTitle: "Book",
      subject: "Subject",
      contentLanguage: "en",
      level: "A2",
      tone: "friendly",
      targetAudience: "teens",
      units: [{ number: 1, title: "Intro" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("generatedUnitSchema", () => {
  it("accepts a unit with only the required pages present", () => {
    const result = generatedUnitSchema.safeParse({
      unitNumber: 1,
      title: "Intro",
      studentBookPages: [],
      workbookPages: [],
      glossary: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a content block with an invalid kind", () => {
    const result = generatedUnitSchema.safeParse({
      unitNumber: 1,
      title: "Intro",
      studentBookPages: [
        {
          sourcePageNumber: 1,
          pageType: "content",
          unitNumber: 1,
          blocks: [{ kind: "trivia", heading: "h", body: "b" }],
        },
      ],
      workbookPages: [],
      glossary: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("imageReviewSchema (Faz D)", () => {
  it("accepts a passing review with no issues", () => {
    expect(imageReviewSchema.safeParse({ passed: true, issues: [] }).success).toBe(true);
  });

  it("accepts a failing review with a suggested prompt fix", () => {
    const result = imageReviewSchema.safeParse({
      passed: false,
      issues: ["Image contains garbled text"],
      suggestedPromptFix: "Same scene, no text or letters anywhere in the image",
    });
    expect(result.success).toBe(true);
  });
});

describe("bookCoherenceReviewSchema (Faz E)", () => {
  it("accepts scores within 0-100 and a valid issue", () => {
    const result = bookCoherenceReviewSchema.safeParse({
      passed: false,
      difficultyProgressionScore: 80,
      vocabularyRepetitionScore: 55,
      grammarSequencingScore: 90,
      thematicConsistencyScore: 70,
      issues: [{ unitNumber: 3, category: "vocabulary", description: "term dropped after unit 3", severity: "high" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a score outside the 0-100 range", () => {
    const result = bookCoherenceReviewSchema.safeParse({
      passed: true,
      difficultyProgressionScore: 120,
      vocabularyRepetitionScore: 55,
      grammarSequencingScore: 90,
      thematicConsistencyScore: 70,
      issues: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an issue with an invalid category", () => {
    const result = coherenceIssueSchema.safeParse({
      unitNumber: 1,
      category: "pacing",
      description: "too slow",
      severity: "low",
    });
    expect(result.success).toBe(false);
  });
});
