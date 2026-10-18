import { describe, expect, it } from "vitest";
import { diversifyTemplates, estimateTemplateFit, isChecklistBlock, planZones, resolvePageTemplate } from "./layouts";
import type { ZonePlan } from "./zones";
import type { GeneratedPage } from "@/lib/ai/schemas";

function page(overrides: Partial<GeneratedPage>): GeneratedPage {
  return { sourcePageNumber: 1, pageType: "content", unitNumber: 1, blocks: [], ...overrides };
}

const shortBlock = { kind: "explanation" as const, heading: "Intro", body: "A short paragraph about the topic." };
const longBlock = { kind: "narrative" as const, heading: "Story", body: "word ".repeat(900) };

describe("resolvePageTemplate", () => {
  it("infers a template from the content when none was chosen", () => {
    expect(resolvePageTemplate(page({ blocks: [shortBlock] }), false)).toBe("two-column");
    const dlg = { ...shortBlock, dialogue: [{ speaker: "A", line: "Hi" }, { speaker: "B", line: "Hello" }] };
    expect(resolvePageTemplate(page({ blocks: [dlg] }), false)).toBe("dialogue-strip");
    expect(resolvePageTemplate(page({ blocks: [shortBlock] }), true, { isUnitFirstPage: true })).toBe("unit-opener-hero");
  });

  it("uses the chosen template when the content fits", () => {
    expect(resolvePageTemplate(page({ layoutTemplate: "two-column", blocks: [shortBlock, shortBlock] }), false)).toBe("two-column");
  });

  it("falls back to standard when the content can't fit the arrangement on one page", () => {
    expect(resolvePageTemplate(page({ layoutTemplate: "two-column", blocks: [longBlock, longBlock] }), false)).toBe("standard");
  });

  it("swaps image templates for two-column when the page has no picture", () => {
    expect(resolvePageTemplate(page({ layoutTemplate: "image-left-text-right", blocks: [shortBlock] }), false)).toBe("two-column");
  });

  it("swaps dialogue-strip for two-column when there is no dialogue", () => {
    expect(resolvePageTemplate(page({ layoutTemplate: "dialogue-strip", blocks: [shortBlock] }), false)).toBe("two-column");
  });

  it("lets Dizilim's manual positions win over any template", () => {
    const positioned = { ...shortBlock, layout: { x: 0, y: 0, width: 100, height: 100 } };
    expect(resolvePageTemplate(page({ layoutTemplate: "two-column", blocks: [positioned] }), false)).toBe("standard");
  });

  it("needs more room at larger body sizes", () => {
    const p = page({ layoutTemplate: "two-column", blocks: [longBlock] });
    const small = estimateTemplateFit(p, "two-column", false, false, { width: 595, height: 842, bodySize: 10 });
    const large = estimateTemplateFit(p, "two-column", false, false, { width: 595, height: 842, bodySize: 13 });
    expect(large.needed).toBeGreaterThan(small.needed);
  });
});

describe("isChecklistBlock", () => {
  it("treats 'I can' statements as a checklist", () => {
    expect(isChecklistBlock({ kind: "practice", items: ["I can say hello.", "I can count to ten."] })).toBe(true);
  });
  it("treats ordinary exercises as exercises", () => {
    expect(isChecklistBlock({ kind: "practice", items: ["She ___ to school.", "They ___ happy."] })).toBe(false);
  });
});

describe("diversifyTemplates", () => {
  it("breaks up three identical templates in a row", () => {
    const out = diversifyTemplates([
      { layoutTemplate: "two-column" as const },
      { layoutTemplate: "two-column" as const },
      { layoutTemplate: "two-column" as const },
    ]);
    expect(out.map((p) => p.layoutTemplate)).toEqual(["two-column", "two-column", "reading-with-sidebar"]);
  });
  it("leaves image templates alone", () => {
    const pages = [1, 2, 3].map(() => ({ layoutTemplate: "image-left-text-right" as const }));
    expect(diversifyTemplates(pages)).toEqual(pages);
  });
});

describe("template requirements", () => {
  it("never prints an empty sidebar", () => {
    const p = page({ layoutTemplate: "reading-with-sidebar", blocks: [shortBlock] });
    expect(resolvePageTemplate(p, false)).toBe("two-column");
  });
  it("needs exercises for the exercise grid and a glossary for vocab cards", () => {
    expect(resolvePageTemplate(page({ layoutTemplate: "exercise-grid", blocks: [shortBlock] }), false)).toBe("two-column");
    expect(resolvePageTemplate(page({ layoutTemplate: "vocab-cards", blocks: [shortBlock] }), false)).toBe("two-column");
  });
});

describe("source-zones (Faz G2)", () => {
  const plan: ZonePlan = {
    bands: [
      { kind: "pictures", height: 0.3, widths: [1] },
      { kind: "text", columns: 2, weight: 1 },
    ],
  };
  const metrics = { width: 595, height: 842, bodySize: 10 };

  it("keeps the source's arrangement when the pictures are missing", () => {
    const p = page({ zonePlan: plan, layoutTemplate: "image-left-text-right", blocks: [shortBlock, shortBlock] });
    expect(resolvePageTemplate(p, false, { pictureCount: 0, metrics })).toBe("source-zones");
  });

  it("keeps it for a page measured running over (tight), whatever the estimate", () => {
    const p = page({ zonePlan: plan, blocks: [longBlock, longBlock] });
    expect(resolvePageTemplate(p, true, { pictureCount: 1, metrics })).not.toBe("source-zones");
    expect(resolvePageTemplate(p, true, { pictureCount: 1, metrics, tight: true })).toBe("source-zones");
  });

  it("goes further down in tight mode", () => {
    const p = page({ zonePlan: plan, blocks: [longBlock] });
    const normal = planZones(p, 1, false, metrics);
    const tight = planZones(p, 1, false, metrics, true);
    expect(normal.pictureScale).toBeGreaterThanOrEqual(0.5);
    expect(tight.pictureScale).toBeLessThan(normal.pictureScale);
    expect(tight.textScale).toBeLessThan(normal.textScale);
  });
});
