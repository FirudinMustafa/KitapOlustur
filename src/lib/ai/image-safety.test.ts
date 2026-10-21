import { describe, expect, it } from "vitest";
import { isSafetyRejection, softenForSafety } from "./image-safety";

describe("isSafetyRejection", () => {
  it("recognises GPT Image's safety rejection", () => {
    expect(isSafetyRejection(new Error("Your request was rejected by the safety system. If you believe this is an error..."))).toBe(true);
    expect(isSafetyRejection(new Error("fetch failed"))).toBe(false);
  });
});

describe("softenForSafety", () => {
  it("takes ages and child wording out of a scene", () => {
    expect(softenForSafety("Misty, a 6-year-old girl, and two little boys wave at the children.")).toBe(
      "Misty, a student, and two students wave at the friends.",
    );
  });

  it("leaves a scene without children unchanged", () => {
    expect(softenForSafety("Six coloured pencils on a wooden table.")).toBe("Six coloured pencils on a wooden table.");
  });
});
