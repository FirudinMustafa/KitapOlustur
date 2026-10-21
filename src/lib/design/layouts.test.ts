import { describe, expect, it } from "vitest";
import { diversifyTemplates, estimateBlockHeight, estimateTemplateFit, inlineRubric, isChecklistBlock, itemColumns, planZones, resolvePageTemplate, zoneRowFrames } from "./layouts";
import type { ZoneBand, ZonePlan } from "./zones";
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

describe("planZones with measured slack (Faz G3)", () => {
  const plan: ZonePlan = {
    bands: [
      { kind: "pictures", height: 0.35, widths: [1] },
      { kind: "text", columns: 1, weight: 1 },
    ],
  };
  const metrics = { width: 595, height: 842, bodySize: 10 };
  const p = page({ zonePlan: plan, blocks: [longBlock] });

  it("lets pictures grow into space a render left empty", () => {
    const estimated = planZones(p, 1, false, metrics);
    expect(estimated.pictureScale).toBeLessThan(1);
    const grown = planZones(p, 1, false, metrics, false, 200);
    expect(grown.pictureScale).toBeGreaterThan(estimated.pictureScale);
  });

  it("changes nothing without slack", () => {
    expect(planZones(p, 1, false, metrics, false, 0)).toEqual(planZones(p, 1, false, metrics));
  });
});

describe("growing into leftover room (KIYAS-13)", () => {
  const metrics = { width: 595, height: 842, bodySize: 10 };
  const short = { kind: "practice" as const, heading: "1 Listen and say", body: "Say the words.", items: ["one", "two", "three"] };

  it("grows pictures past the source's size on a page with room left", () => {
    const plan: ZonePlan = { bands: [{ kind: "pictures", height: 0.25, widths: [1], left: 0.1, span: 0.8 }, { kind: "text", columns: 1, weight: 1 }] };
    const p = page({ zonePlan: plan, blocks: [short] });
    expect(planZones(p, 1, false, metrics).pictureScale).toBe(1);
    const grown = planZones(p, 1, false, metrics, false, 300);
    expect(grown.pictureScale).toBeGreaterThan(1);
    // the frame never exceeds the page's content area
    const frame = zoneRowFrames(plan.bands[0] as Extract<ZoneBand, { kind: "pictures" }>, 507, 842, grown.pictureScale);
    expect(frame.left + frame.width).toBeLessThanOrEqual(507 + 0.01);
    expect(frame.height).toBeLessThanOrEqual(grown.contentHeight);
  });

  it("stops a grown frame before cover cropping takes more than a fifth", () => {
    const band = { height: 0.3, widths: [1] };
    const big = zoneRowFrames(band, 507, 842, 3);
    // drawn landscape (3:2): the frame stays at least 0.8 x 1.5 wide for its height
    expect(big.frames[0] / big.height).toBeGreaterThanOrEqual(1.2 - 0.01);
    // below 1 a row shrinks as a whole, as before
    const small = zoneRowFrames(band, 507, 842, 0.5);
    expect(small.height).toBe(Math.round(0.3 * 842 * 0.5));
  });

  it("sets the text of a page with no picture larger and spreads it", () => {
    const plan: ZonePlan = { bands: [{ kind: "text", columns: 1, weight: 1 }] };
    const p = page({ zonePlan: plan, blocks: [short, short] });
    const grown = planZones(p, 0, false, metrics, false, 500);
    expect(grown.textScale).toBeGreaterThan(1);
    expect(grown.spread).toBeGreaterThan(0);
    expect(planZones(p, 0, false, metrics).spread).toBe(0);
  });
});

describe("coursebook density on mirrored pages (Faz G4)", () => {
  it("runs a short rubric on after the heading", () => {
    expect(inlineRubric({ heading: "1 Plurals", body: "Make these nouns plural." })).toBe(true);
    expect(inlineRubric({ heading: "1 Story", body: "x".repeat(400) })).toBe(false);
    expect(inlineRubric({ heading: "1 Talk", body: "Act it out.", dialogue: [{}] })).toBe(false);
  });

  it("sets short items side by side", () => {
    expect(itemColumns(["desk", "clock", "lamp", "bed"])).toBe(3);
    expect(itemColumns(["Good morning", "Good night", "Hello there"])).toBe(2);
    expect(itemColumns(["How many beds are there in the room?", "a", "b"])).toBe(1);
    expect(itemColumns(["one", "two"])).toBe(1);
  });

  it("estimates a dense exercise well below the card style", () => {
    const b = { kind: "practice", heading: "1 Plurals", body: "Make these nouns plural.", items: ["desk", "clock", "lamp", "bed", "box", "cat"], answerKey: ["desks", "clocks", "lamps", "beds", "boxes", "cats"] };
    expect(estimateBlockHeight(b, 500, 10, true)).toBeLessThan(estimateBlockHeight(b, 500, 10) * 0.6);
  });
});
