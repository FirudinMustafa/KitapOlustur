import { describe, expect, it } from "vitest";
import { fitPicture, frameWidthFor, leavesGround, pointInFrame, visiblePart, type PictureRect } from "./picture-fit";
import { mapToFrame } from "./label-overlay";

// react-pdf's object-fit "cover" (render/lib applyCoverObjectFit) with
// percentage object positions: the drawn size and offset in its box.
function reactPdfCover(cw: number, ch: number, aspect: number, px: number, py: number) {
  if (cw / ch > aspect) {
    const width = cw;
    const height = width / aspect;
    return { left: 0, top: (ch - height) * py, width, height };
  }
  const height = ch;
  const width = height * aspect;
  return { left: (cw - width) * px, top: 0, width, height };
}

const inside = (rect: PictureRect, box: { x0: number; y0: number; x1: number; y1: number }, w: number, h: number) => {
  const a = pointInFrame(rect, { x: box.x0, y: box.y0 });
  const b = pointInFrame(rect, { x: box.x1, y: box.y1 });
  return a.px >= -0.01 && a.py >= -0.01 && b.px <= w + 0.01 && b.py <= h + 0.01;
};

describe("fitPicture", () => {
  it("crops a scene as react-pdf's cover does, at its anchor", () => {
    // A 3:2 picture in a 3:1 frame, 30% from the top: 100pt of 200pt cut, 30 above.
    expect(fitPicture(300, 100, { aspect: 1.5 }, { anchorY: 0.3 })).toEqual({ left: 0, top: -30, width: 300, height: 200 });
    // A square picture in a portrait sheet: cropped at the sides, centred.
    expect(fitPicture(620, 782, { aspect: 1 }, { anchorY: 0.4 })).toEqual({ left: -81, top: 0, width: 782, height: 782 });
  });

  it("contains a picture centred", () => {
    expect(fitPicture(300, 100, { aspect: 1 }, { fit: "contain" })).toEqual({ left: 100, top: 0, width: 100, height: 100 });
  });

  it("keeps a row of objects on a plain ground whole instead of cutting its ends", () => {
    // KIYAS-13 workbook p.5: six objects across a 3:2 picture, frame 4:3 -
    // cover cut the apple and the flower in half.
    const subject = { x0: 0.02, y0: 0.35, x1: 0.98, y1: 0.65 };
    const rect = fitPicture(160, 120, { aspect: 1.5, subject });
    expect(inside(rect, subject, 160, 120)).toBe(true);
    // centred vertically on the objects
    const mid = pointInFrame(rect, { x: 0.5, y: 0.5 });
    expect(mid.py).toBeCloseTo(60, 0);
    expect(leavesGround(rect, 160, 120)).toBe(true);
  });

  it("centres a small object and grows it no further than cover", () => {
    // KIYAS-11 p.6: a globe low in a square picture, in a wide frame.
    const subject = { x0: 0.17, y0: 0.39, x1: 0.83, y1: 0.92 };
    const rect = fitPicture(560, 300, { aspect: 1, subject });
    expect(inside(rect, subject, 560, 300)).toBe(true);
    expect(rect.width).toBeLessThanOrEqual(560);
    const centre = pointInFrame(rect, { x: 0.5, y: (0.39 + 0.92) / 2 });
    expect(centre.px).toBeCloseTo(280, 0);
    expect(centre.py).toBeCloseTo(150, 0);
    // a tiny object never makes the picture larger than cover
    const tiny = fitPicture(200, 200, { aspect: 1, subject: { x0: 0.45, y0: 0.45, x1: 0.55, y1: 0.55 } });
    expect(tiny.width).toBe(200);
  });
});

describe("visiblePart", () => {
  // The box and object position FramedImage draws must put the picture
  // exactly where fitPicture says, under react-pdf's own cover rule.
  const cases: [string, number, number, Parameters<typeof fitPicture>[2], Parameters<typeof fitPicture>[3]][] = [
    ["scene cropped top and bottom", 300, 100, { aspect: 1.5 }, { anchorY: 0.3 }],
    ["scene cropped at the sides", 620, 782, { aspect: 1 }, { anchorY: 0.4 }],
    ["object inside the frame", 160, 120, { aspect: 1.5, subject: { x0: 0.02, y0: 0.35, x1: 0.98, y1: 0.65 } }, {}],
    ["object wider than tall frame", 560, 300, { aspect: 1, subject: { x0: 0.17, y0: 0.39, x1: 0.83, y1: 0.92 } }, {}],
    ["object running past one side", 300, 300, { aspect: 1.5, subject: { x0: 0.3, y0: 0.1, x1: 0.6, y1: 0.9 } }, {}],
  ];
  for (const [name, w, h, picture, options] of cases) {
    it(name, () => {
      const rect = fitPicture(w, h, picture, options);
      const { box, positionX, positionY } = visiblePart(rect, w, h);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.left + box.width).toBeLessThanOrEqual(w + 1e-6);
      expect(box.top + box.height).toBeLessThanOrEqual(h + 1e-6);
      const drawn = reactPdfCover(box.width, box.height, picture.aspect, positionX, positionY);
      expect(box.left + drawn.left).toBeCloseTo(rect.left, 6);
      expect(box.top + drawn.top).toBeCloseTo(rect.top, 6);
      expect(drawn.width).toBeCloseTo(rect.width, 6);
      expect(drawn.height).toBeCloseTo(rect.height, 6);
    });
  }
});

describe("mapToFrame", () => {
  it("maps a label through the very rectangle the picture is drawn in", () => {
    const rect = fitPicture(620, 782, { aspect: 1 }, { anchorY: 0.4 });
    expect(mapToFrame({ x: 0.26, y: 0.5 }, 620, 782, { crop: rect })).toEqual({ ...pointInFrame(rect, { x: 0.26, y: 0.5 }), drawnH: 782 });
  });

  it("misplaced labels when it assumed another shape than the stored picture (KIYAS-14 p.4)", () => {
    // The scene was assumed 3:2 (its zone slot, counted with one picture);
    // the stored picture is square. The boy at 26% of the picture:
    const assumed = mapToFrame({ x: 0.26, y: 0.5 }, 620, 782, { imageAspect: 1.5, positionY: 0.4 });
    const real = mapToFrame({ x: 0.26, y: 0.5 }, 620, 782, { crop: fitPicture(620, 782, { aspect: 1 }, { anchorY: 0.4 }) });
    expect(Math.round(real.px)).toBe(122);
    expect(Math.round(assumed.px)).toBe(28); // at the picture's edge, off the boy
  });
});

describe("frameWidthFor", () => {
  it("narrows a scene's frame to what keeps most of the scene", () => {
    expect(frameWidthFor({ aspect: 1 }, 175, 70, 1.6)).toBe(112);
    expect(frameWidthFor({ aspect: 1.5 }, 527, 125, 1.6)).toBe(250);
  });
  it("keeps the frame for an object on a plain ground, and for a frame already narrow enough", () => {
    expect(frameWidthFor({ aspect: 1, subject: { x0: 0, y0: 0.3, x1: 1, y1: 0.6 } }, 527, 125, 1.6)).toBe(527);
    expect(frameWidthFor({ aspect: 1.5 }, 150, 100, 1.6)).toBe(150);
  });
  it("caps an unmeasured picture at the given shape", () => {
    expect(frameWidthFor(undefined, 527, 125, 1.6)).toBe(200);
  });
});
