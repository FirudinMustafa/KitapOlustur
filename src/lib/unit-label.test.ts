import { describe, expect, it } from "vitest";
import { unitBadgeText, unitKicker, unitName } from "./unit-label";
import { isYoungLearnerLevel } from "./cefr-vocabulary";
import { footerTopic } from "./pdf/BookDocument";

describe("unit labels", () => {
  it("prints unit 0 as the welcome unit", () => {
    expect([unitKicker(0), unitName(0), unitBadgeText(0)]).toEqual(["WELCOME", "Welcome", "Hi!"]);
    expect([unitKicker(3), unitName(3), unitBadgeText(3)]).toEqual(["UNIT 3", "Unit 3", "3"]);
  });
});

describe("isYoungLearnerLevel", () => {
  it("knows young learners' levels however they are written", () => {
    expect(["Pre-A1", "CEFR Pre-A1", "Pre A1", "Starters"].every(isYoungLearnerLevel)).toBe(true);
    expect(["A1", "CEFR A2", "B1"].some(isYoungLearnerLevel)).toBe(false);
  });
});

describe("footerTopic", () => {
  it("drops book and unit prefixes from the section label", () => {
    expect(footerTopic("Workbook: Colors")).toBe("Colors");
    expect(footerTopic("Unit 0: Hello, Friends!")).toBe("Hello, Friends!");
  });
});
