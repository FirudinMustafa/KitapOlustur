import { describe, expect, it } from "vitest";
import { pictureGroundTint, pictureTint, tintGround, whiteGroundMask } from "./picture-ground";

// A 20×20 RGB picture: white ground, a blue square object in the middle.
function objectOnWhite(): Uint8Array {
  const data = new Uint8Array(20 * 20 * 3).fill(255);
  for (let y = 6; y < 14; y++) for (let x = 6; x < 14; x++) data.set([30, 90, 220], (y * 20 + x) * 3);
  return data;
}

describe("whiteGroundMask", () => {
  it("marks the white ground joined to the border, not the object", () => {
    const mask = whiteGroundMask(objectOnWhite(), 20, 20, 3)!;
    expect(mask[0]).toBe(1);
    expect(mask[10 * 20 + 10]).toBe(0);
    expect(mask[3 * 20 + 3]).toBe(1);
  });

  it("is null for a scene with colour to its edges", () => {
    const data = new Uint8Array(20 * 20 * 3).fill(120);
    expect(whiteGroundMask(data, 20, 20, 3)).toBeNull();
  });

  it("prints the ground in a pale tile of the object's own colour", () => {
    const data = objectOnWhite();
    const mask = whiteGroundMask(data, 20, 20, 3)!;
    const tint = pictureTint(data, mask, 3)!;
    expect(tint[2]).toBeGreaterThan(tint[0]); // blue
    tintGround(data, mask, 3, tint);
    expect([...data.slice(0, 3)]).toEqual(tint);
    expect([...data.slice((10 * 20 + 10) * 3, (10 * 20 + 10) * 3 + 3)]).toEqual([30, 90, 220]);
  });
});

describe("pictureGroundTint", () => {
  it("is the book's panel tone, or its primary lifted when the tone reads as paper", () => {
    expect(pictureGroundTint({ primary: "#cc181f", primaryLight: "#f7e5ca" })).toEqual([247, 229, 202]);
    const lifted = pictureGroundTint({ primary: "#2563eb", primaryLight: "#eff6ff" });
    expect(lifted.some((v) => v <= 235)).toBe(true);
  });
});
