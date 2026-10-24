import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { measurePicture, measureSubject } from "./picture-info";

// An RGB raster filled with `bg`, with `paint` drawing on it.
function raster(w: number, h: number, bg: [number, number, number], paint?: (x: number, y: number) => [number, number, number] | null) {
  const data = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = paint?.(x, y) ?? bg;
      data.set(c, (y * w + x) * 3);
    }
  }
  return data;
}

describe("measureSubject", () => {
  it("finds an object on a white ground", () => {
    const data = raster(100, 50, [255, 255, 255], (x, y) => (x >= 20 && x < 60 && y >= 10 && y < 30 ? [200, 30, 30] : null));
    expect(measureSubject(data, 100, 50, 3)).toEqual({ subject: { x0: 0.2, y0: 0.2, x1: 0.6, y1: 0.6 }, ground: "#ffffff" });
  });

  it("finds it on a tinted ground and ignores a faint shadow", () => {
    const data = raster(80, 80, [230, 240, 250], (x, y) => (x >= 30 && x < 50 && y >= 30 && y < 50 ? [20, 90, 200] : y >= 50 && y < 54 && x >= 30 && x < 50 ? [215, 225, 235] : null));
    expect(measureSubject(data, 80, 80, 3)).toEqual({ subject: { x0: 0.375, y0: 0.375, x1: 0.625, y1: 0.625 }, ground: "#e6f0fa" });
  });

  it("calls a picture with colour to its edges a scene", () => {
    const data = raster(60, 60, [0, 0, 0], (x, y) => [(x * 4) % 256, (y * 4) % 256, 120]);
    expect(measureSubject(data, 60, 60, 3)).toBeNull();
  });

  it("calls an object that fills its picture a scene", () => {
    const data = raster(100, 100, [255, 255, 255], (x, y) => (x >= 4 && x < 96 && y >= 6 && y < 100 ? [120, 80, 40] : null));
    expect(measureSubject(data, 100, 100, 3)).toBeNull();
  });
});

describe("measurePicture", () => {
  it("reads a data URI's shape and object", async () => {
    const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#ffffff" } })
      .composite([{ input: await sharp({ create: { width: 60, height: 60, channels: 3, background: "#d02020" } }).png().toBuffer(), left: 30, top: 70 }])
      .png()
      .toBuffer();
    const info = await measurePicture(`data:image/png;base64,${png.toString("base64")}`);
    expect(info?.aspect).toBe(1.5);
    expect(info?.ground).toBe("#ffffff");
    expect(info?.subject?.x0).toBeCloseTo(0.1, 1);
    expect(info?.subject?.x1).toBeCloseTo(0.3, 1);
    expect(info?.subject?.y0).toBeCloseTo(0.35, 1);
  });

  it("returns null for what it cannot read", async () => {
    expect(await measurePicture("data:image/png;base64,AAAA")).toBeNull();
  });
});
