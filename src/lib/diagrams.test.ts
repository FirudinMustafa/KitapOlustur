import { describe, expect, it } from "vitest";
import type { ContentBlock } from "@/lib/ai/schemas";
import { renderBlockHtml } from "@/lib/content-html";
import { PREPOSITIONS, diagramIssues, mapGrid, prepositionScene } from "./diagrams";

describe("diagrams", () => {
  it("draws a scene for every preposition", () => {
    for (const p of PREPOSITIONS) expect(prepositionScene(p).length).toBeGreaterThan(2);
  });

  it("rejects maps the questions can't rely on", () => {
    const issues = diagramIssues({
      heading: "Map",
      diagram: {
        type: "map",
        places: [
          { name: "bank", row: 1, col: 1 },
          { name: "café", row: 1, col: 1 },
          { name: "zoo", row: 5, col: 1 },
        ],
      },
    });
    expect(issues.some((i) => i.includes("share row 1"))).toBe(true);
    expect(issues.some((i) => i.includes("outside"))).toBe(true);
    expect(diagramIssues({ heading: "P", items: ["It is ___ the box.", "It is ___ the box."], diagram: { type: "prepositions", scenes: ["in"] } })).toHaveLength(1);
    expect(diagramIssues({ heading: "P", items: ["It is in the box."], diagram: { type: "prepositions", scenes: ["in"] } })[0]).toContain("___");
  });

  it("lays the map out on its grid", () => {
    const grid = mapGrid([
      { name: "bank", row: 1, col: 3 },
      { name: "park", row: 2, col: 1 },
    ]);
    expect([grid.rows, grid.cols]).toEqual([2, 3]);
    expect(grid.at(1, 3)?.name).toBe("bank");
    expect(grid.at(1, 1)).toBeUndefined();
  });

  it("exports scenes as inline SVG and the map as a table in EPUB", () => {
    const html = renderBlockHtml(
      {
        kind: "practice",
        heading: "Where is the ball?",
        body: "",
        items: ["The ball is ___ the box."],
        answerKey: ["on"],
        diagram: { type: "prepositions", scenes: ["on"] },
      } as ContentBlock,
      false,
    );
    expect(html).toContain("<svg xmlns=");
    const map = renderBlockHtml(
      { kind: "reference", heading: "Map", body: "", diagram: { type: "map", places: [{ name: "bank", row: 1, col: 1 }] } } as ContentBlock,
      false,
    );
    expect(map).toContain('<table class="town-map"><tr><td>bank</td></tr></table>');
  });
});
