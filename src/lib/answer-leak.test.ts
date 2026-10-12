import { describe, expect, it } from "vitest";
import { answerLeakIssue, dropLeakingTable, tableLeaksAnswers } from "./answer-leak";

const leak = {
  heading: "2 Number Writing",
  items: ["12", "20"],
  answerKey: ["Twelve", "Twenty"],
  table: { headers: ["Number", "Word"], rows: [["12", "Twelve"], ["20", "Twenty"]] },
};

describe("answer leak", () => {
  it("catches a table that prints the answers (live test KIYAS-7)", () => {
    expect(tableLeaksAnswers(leak)).toBe(true);
    expect(answerLeakIssue(leak, "Student Book, page 7")).toMatch(/already shows the answers/);
    const fixed = dropLeakingTable(leak);
    expect(fixed.table).toBeUndefined();
    expect(fixed.items).toEqual(["12", "20"]);
  });

  it("keeps a table that only gives the prompts", () => {
    const ok = { ...leak, table: { headers: ["Number", "Word"], rows: [["12", "______"], ["20", "______"]] } };
    expect(tableLeaksAnswers(ok)).toBe(false);
    expect(dropLeakingTable(ok)).toBe(ok);
  });

  it("matches answers written as model answers", () => {
    expect(tableLeaksAnswers({ ...leak, answerKey: ["e.g. Twelve", "e.g., twenty"] })).toBe(true);
  });
});
