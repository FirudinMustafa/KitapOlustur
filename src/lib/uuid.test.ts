import { describe, expect, it } from "vitest";
import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("accepts canonical uuids in either case", () => {
    expect(isUuid("818e5415-369e-4e2f-8c99-1994b153fd65")).toBe(true);
    expect(isUuid("818E5415-369E-4E2F-8C99-1994B153FD65")).toBe(true);
  });

  it("rejects malformed ids", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("818e5415-369e-4e2f-8c99-1994b153fd6")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});
