import { describe, expect, it } from "vitest";
import { overlapArea, parseSpec, specContentIssues, specIssues, specWarnings, touches, type PageLayoutSpec } from "./page-layout-spec";

// Super Minds p.2 as the hand-made reference sets it: a scene under
// exercise 1, a big photo under exercise 2.
const spec: PageLayoutSpec = {
  version: 1,
  pictures: [
    { picture: 0, box: { x: 0.1, y: 0.1, w: 0.8, h: 0.36 } },
    { picture: 1, box: { x: 0.05, y: 0.55, w: 0.9, h: 0.33 } },
  ],
  regions: [
    { box: { x: 0.06, y: 0.05, w: 0.88, h: 0.05 }, blocks: [0] },
    { box: { x: 0.06, y: 0.49, w: 0.88, h: 0.05 }, blocks: [1] },
  ],
  furniture: { topBand: true, footer: true },
};

describe("parseSpec", () => {
  it("accepts a drawable spec", () => {
    const out = parseSpec(spec);
    expect(out.spec).not.toBeNull();
    expect(out.issues).toEqual([]);
  });

  it("rejects what is not a spec, saying where", () => {
    const out = parseSpec({ ...spec, pictures: [{ picture: 0, box: { x: 0.1, y: 0.1, w: 0, h: 0.3 } }] });
    expect(out.spec).toBeNull();
    expect(out.issues.join(" ")).toMatch(/pictures\.0\.box\.w/);
  });

  it("rejects colours that are not #rrggbb (no CSS reaches the renderer)", () => {
    expect(parseSpec({ ...spec, grounds: [{ box: { x: 0, y: 0, w: 1, h: 1 }, color: "red; url(x)" }] }).spec).toBeNull();
  });
});

describe("specIssues", () => {
  it("finds boxes running off the page", () => {
    const off = { ...spec, pictures: [{ picture: 0, box: { x: 0.5, y: 0.1, w: 0.6, h: 0.3 } }] };
    expect(specIssues(off).join(" ")).toMatch(/picture box 0 .* runs off the page/);
  });

  it("finds pictures on top of each other, and text on a picture unless meant", () => {
    const clash: PageLayoutSpec = {
      ...spec,
      pictures: [spec.pictures[0], { picture: 1, box: { x: 0.5, y: 0.3, w: 0.4, h: 0.3 } }],
      regions: [{ box: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 }, blocks: [0] }],
    };
    const issues = specIssues(clash).join(" ");
    expect(issues).toMatch(/picture boxes 0 and 1 overlap/);
    expect(issues).toMatch(/region 0 overlaps picture box 0/);
    const meant = { ...clash, pictures: [spec.pictures[0]], regions: [{ ...clash.regions[0], over: true }] };
    expect(specIssues(meant)).toEqual([]);
  });

  it("lets boxes meet edge to edge", () => {
    const meet: PageLayoutSpec = {
      ...spec,
      pictures: [
        { picture: 0, box: { x: 0, y: 0, w: 0.5, h: 0.5 } },
        { picture: 1, box: { x: 0.5, y: 0, w: 0.5, h: 0.5 } },
      ],
      regions: [{ box: { x: 0.06, y: 0.5, w: 0.88, h: 0.3 }, blocks: [0, 1] }],
    };
    expect(specIssues(meet)).toEqual([]);
  });

  it("finds a block or a picture placed twice, and labels off the main picture", () => {
    const twice: PageLayoutSpec = {
      ...spec,
      pictures: [spec.pictures[0], { ...spec.pictures[1], picture: 0 }, { picture: 2, box: { x: 0, y: 0.9, w: 0.1, h: 0.05 }, labels: true }],
      regions: [spec.regions[0], { ...spec.regions[1], blocks: [0] }],
    };
    const issues = specIssues(twice).join(" ");
    expect(issues).toMatch(/block 0 is placed twice/);
    expect(issues).toMatch(/picture 0 is placed twice/);
    expect(issues).toMatch(/main picture \(0\) only, not picture 2/);
  });
});

describe("specContentIssues", () => {
  it("wants every printed block and every picture placed, and nothing else", () => {
    expect(specContentIssues(spec, { blocks: [{}, {}], pictureCount: 2 })).toEqual([]);
    const issues = specContentIssues(spec, { blocks: [{}, null, {}], pictureCount: 3 }).join(" ");
    expect(issues).toMatch(/block 1 is not printed/);
    expect(issues).toMatch(/block 2 is not placed/);
    expect(issues).toMatch(/picture 2 is not placed/);
    expect(specContentIssues(spec, { blocks: [{}], pictureCount: 1 }).join(" ")).toMatch(/block 1 does not exist.*picture 1 does not exist/);
  });
});

describe("helpers", () => {
  it("measures overlap and edge contact", () => {
    expect(overlapArea({ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 })).toBeCloseTo(0.0625);
    expect(touches({ x: 0, y: 0.58, w: 0.5, h: 0.42 })).toEqual({ left: true, top: false, right: false, bottom: true });
  });

  it("warns about text in the trim margin", () => {
    expect(specWarnings(spec)).toEqual([]);
    expect(specWarnings({ ...spec, regions: [{ box: { x: 0.01, y: 0.2, w: 0.4, h: 0.1 }, blocks: [0] }] })[0]).toMatch(/trim margin/);
  });
});
