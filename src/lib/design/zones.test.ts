import { describe, expect, it } from "vitest";
import { buildZonePlan, layoutZones, pictureShape, pictureSlotAspects, zonePictureCount, zonedBlocks, zonedPictures, type ZonePlan } from "./zones";
import type { SourcePageLayout } from "@/lib/source-layout";

const layout = (images: SourcePageLayout["images"], textColumns: 1 | 2 = 1): SourcePageLayout => ({
  widthPt: 600,
  heightPt: 800,
  images,
  textColumns,
  wordCount: 300,
  exerciseCount: 3,
  itemCount: 12,
  exerciseRubrics: [],
  bodyFontPt: 10,
  headingFontPt: 13,
  zone: "two_column",
});

describe("buildZonePlan", () => {
  it("lays a text-only page out in the source's columns, with no picture frames", () => {
    const plan = buildZonePlan(layout([], 2))!;
    expect(plan.bands).toEqual([{ kind: "text", columns: 2, weight: 1 }]);
    expect(zonePictureCount(plan)).toBe(0);
  });

  it("turns side-by-side pictures into a picture row and a side picture into a split band", () => {
    const plan = buildZonePlan(
      layout(
        [
          { x: 0.05, y: 0.4, w: 0.4, h: 0.2 },
          { x: 0.5, y: 0.42, w: 0.45, h: 0.2 },
          { x: 0.6, y: 0.7, w: 0.35, h: 0.25 },
        ],
        1,
      ),
    )!;
    expect(plan.bands.map((b) => b.kind)).toEqual(["text", "pictures", "text", "split"]);
    expect(plan.bands[0]).toMatchObject({ kind: "text", columns: 1 });
    expect(plan.bands[3]).toMatchObject({ kind: "split", side: "right", pictures: 1 });
    expect(zonePictureCount(plan)).toBe(3);
  });

  it("keeps a two-column page's pictures inside their columns", () => {
    const plan = buildZonePlan(
      layout(
        [
          { x: 0.05, y: 0.4, w: 0.4, h: 0.2 }, // left column
          { x: 0.55, y: 0.1, w: 0.4, h: 0.2 }, // right column
          { x: 0.05, y: 0.75, w: 0.9, h: 0.2 }, // spans the page
        ],
        2,
      ),
    )!;
    expect(plan.bands.map((b) => b.kind)).toEqual(["columns", "pictures"]);
    const [left, right] = (plan.bands[0] as Extract<ZonePlan["bands"][number], { kind: "columns" }>).columns;
    expect(left.map((i) => i.kind)).toEqual(["text", "picture", "text"]);
    expect(right.map((i) => i.kind)).toEqual(["text", "picture", "text"]);
    expect(zonePictureCount(plan)).toBe(3);
  });

  it("keeps pictures to at most 72% of the page height", () => {
    const plan = buildZonePlan(layout([{ x: 0, y: 0.05, w: 0.9, h: 0.45 }, { x: 0, y: 0.52, w: 0.9, h: 0.45 }]))!;
    const pictures = plan.bands.reduce((n, b) => n + (b.kind === "pictures" || b.kind === "split" ? b.height : 0), 0);
    expect(pictures).toBeLessThanOrEqual(0.72 + 1e-9);
    expect(plan.bands.some((b) => b.kind === "text")).toBe(true);
  });

  it("keeps a big source picture at its height and bleeds a row that runs off both side edges (i5 p.8)", () => {
    const plan = buildZonePlan(layout([{ x: 0.03, y: 0.02, w: 0.95, h: 0.61 }], 2))!;
    const row = plan.bands.find((b) => b.kind === "pictures")!;
    expect(row).toMatchObject({ kind: "pictures", height: 0.61, bleed: true });
    // laid out, the row keeps its bleed
    const laid = layoutZones(plan, [], 1, () => 0).find((b) => b.kind === "pictures")!;
    expect(laid).toMatchObject({ bleed: true });
  });

  it("carries the source's ground and sets a page with a side panel in two columns, the panel on the outer one", () => {
    const base = layout([]);
    const plan = buildZonePlan({ ...base, furniture: { ground: { color: "#7677b2", box: { x: 0.55, y: 0, w: 0.45, h: 1 } } } })!;
    expect(plan.ground).toEqual({ color: "#7677b2", box: { x: 0.5, y: 0, w: 0.5, h: 1 } });
    expect(plan.bands).toEqual([{ kind: "text", columns: 2, weight: 1 }]);
    // a band across the top keeps its measured box and the page its columns
    const band = buildZonePlan({ ...base, furniture: { ground: { color: "#bfd72f", box: { x: 0, y: 0, w: 1, h: 0.42 } } } })!;
    expect(band.ground?.box).toEqual({ x: 0, y: 0, w: 1, h: 0.42 });
    expect(band.bands).toEqual([{ kind: "text", columns: 1, weight: 1 }]);
  });
});

describe("layoutZones", () => {
  const plan: ZonePlan = {
    bands: [
      { kind: "text", columns: 1, weight: 0.3 },
      { kind: "pictures", height: 0.2, widths: [0.5, 0.5] },
      { kind: "split", side: "left", imageWidth: 0.4, height: 0.3, pictures: 1 },
      { kind: "text", columns: 2, weight: 0.3 },
    ],
  };
  const blocks = ["a", "b", "c", "d", "e", "f"];

  it("keeps every block, in reading order", () => {
    const bands = layoutZones(plan, blocks, 3, () => 1);
    const order = bands.flatMap(zonedBlocks);
    expect(order).toEqual(blocks);
    expect(bands.map((b) => b.kind)).toEqual(["text", "pictures", "split", "text"]);
  });

  it("puts the main picture in the largest slot and never prints an empty frame", () => {
    const bands = layoutZones(plan, blocks, 1, () => 1);
    const pictures = bands.flatMap(zonedPictures);
    expect(pictures).toEqual([0]);
    // the one picture is the main one: it takes the largest slot (the
    // split band), and the picture row it can't fill disappears
    expect(bands.some((b) => b.kind === "pictures")).toBe(false);
    expect(bands.find((b) => b.kind === "split")).toMatchObject({ pictures: [0] });
    expect(bands.flatMap(zonedBlocks)).toEqual(blocks);
  });
});

describe("picture rows and shapes (Faz G3)", () => {
  it("keeps a row where the source has it across the page", () => {
    const plan = buildZonePlan(layout([{ x: 0.24, y: 0.62, w: 0.61, h: 0.32 }]))!;
    const row = plan.bands.find((b) => b.kind === "pictures")!;
    expect(row).toMatchObject({ left: 0.24, span: 0.61 });
    // a row across the whole page stays full width
    const full = buildZonePlan(layout([{ x: 0.03, y: 0.02, w: 0.95, h: 0.4 }]))!;
    expect(full.bands.find((b) => b.kind === "pictures")).not.toHaveProperty("span");
  });

  it("gives each picture the shape of its slot, main picture in the largest", () => {
    const plan: ZonePlan = {
      bands: [
        { kind: "pictures", height: 0.2, widths: [1] }, // wide
        { kind: "split", side: "left", imageWidth: 0.3, height: 0.4, pictures: 1 }, // tall
      ],
    };
    const aspects = pictureSlotAspects(plan, 2);
    expect(pictureShape(aspects[0])).toBe("landscape");
    expect(aspects[0]).toBeCloseTo(0.75 / 0.2);
    expect(pictureShape(aspects[1])).toBe("portrait");
    expect(pictureShape(1)).toBe("square");
  });
});
