import { describe, expect, it } from "vitest";
import { currentGateToken } from "./approval";

const base = { id: "r1", pendingCharacterApproval: null, pendingVariants: null, pendingContentApproval: null };

describe("currentGateToken", () => {
  it("matches the hook tokens the workflow registers", () => {
    expect(currentGateToken({ ...base, status: "awaiting_outline_approval" })).toBe("outline-approval:r1");
    expect(currentGateToken({ ...base, status: "awaiting_logo_upload" })).toBe("logo-upload:r1");
    expect(currentGateToken({ ...base, status: "awaiting_character_approval", pendingCharacterApproval: { round: 2 } })).toBe(
      "character-approval:r1:2",
    );
    expect(currentGateToken({ ...base, status: "awaiting_content_approval", pendingContentApproval: { round: 1 } })).toBe(
      "content-approval:r1:1",
    );
    expect(currentGateToken({ ...base, status: "awaiting_content_approval" })).toBe("content-approval:r1:0");
    expect(currentGateToken({ ...base, status: "awaiting_image_review" })).toBe("image-review:r1");
    expect(currentGateToken({ ...base, status: "awaiting_final_approval" })).toBe("final-approval:r1");
  });

  it("takes the variant unit from the run, not the client", () => {
    expect(currentGateToken({ ...base, status: "awaiting_variant_selection", pendingVariants: { unitNumber: 3, variants: [] } })).toBe(
      "variant-selection:r1:3",
    );
    expect(currentGateToken({ ...base, status: "awaiting_variant_selection" })).toBeNull();
  });

  it("is null when the run is not at a gate", () => {
    expect(currentGateToken({ ...base, status: "generating" })).toBeNull();
    expect(currentGateToken({ ...base, status: "awaiting_character_approval" })).toBeNull();
  });
});
