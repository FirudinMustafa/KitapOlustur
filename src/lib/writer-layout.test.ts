import { describe, expect, it } from "vitest";
import { dropWriterLayouts } from "./writer-layout";

describe("dropWriterLayouts", () => {
  it("removes positions the writer invented", () => {
    const page = { imageLayout: { x: 1, y: 1, width: 5, height: 5 }, blocks: [{ heading: "a", layout: { x: 0, y: 0, width: 10, height: 5 } }, { heading: "b" }] };
    const out = dropWriterLayouts(page);
    expect(out.imageLayout).toBeUndefined();
    expect(out.blocks[0]).not.toHaveProperty("layout");
    expect(out.blocks[1]).toBe(page.blocks[1]);
  });

  it("leaves a page without positions untouched", () => {
    const page: { blocks: { heading: string; layout?: unknown }[] } = { blocks: [{ heading: "a" }] };
    expect(dropWriterLayouts(page)).toBe(page);
  });
});
