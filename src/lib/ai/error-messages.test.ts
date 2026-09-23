import { describe, expect, it } from "vitest";
import { APICallError } from "ai";
import { translateAiError } from "./error-messages";

function makeApiError(statusCode: number | undefined, message = "raw provider message"): APICallError {
  return new APICallError({
    message,
    url: "https://ai-gateway.vercel.sh/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
  });
}

describe("translateAiError", () => {
  it("translates HTTP 402 into a credit-exhausted message", () => {
    expect(translateAiError(makeApiError(402))).toMatch(/kredisi tükenmiş/);
  });

  it("translates HTTP 429 into a rate-limit message", () => {
    expect(translateAiError(makeApiError(429))).toMatch(/rate limit/);
  });

  it("translates HTTP 401 and 403 into an auth message", () => {
    expect(translateAiError(makeApiError(401))).toMatch(/kimlik doğrulama/);
    expect(translateAiError(makeApiError(403))).toMatch(/kimlik doğrulama/);
  });

  it("falls back to a structured-but-raw message for other status codes", () => {
    const result = translateAiError(makeApiError(500, "internal server error"));
    expect(result).toContain("HTTP 500");
    expect(result).toContain("internal server error");
  });

  it("falls back to the raw message when there's no status code", () => {
    const result = translateAiError(makeApiError(undefined, "network hiccup"));
    expect(result).toContain("network hiccup");
  });

  it("passes through a plain Error's message unchanged", () => {
    expect(translateAiError(new Error("schema validation failed"))).toBe("schema validation failed");
  });

  it("stringifies a non-Error value", () => {
    expect(translateAiError("weird throw")).toBe("weird throw");
  });
});
