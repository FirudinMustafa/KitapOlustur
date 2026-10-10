import { describe, expect, it } from "vitest";
import { officeAgents, officeSummary } from "./agent-office";

const state = (status: string, stage: string | null = null) =>
  Object.fromEntries(officeAgents(status, stage).map((a) => [a.key, a.state]));

describe("officeAgents", () => {
  it("puts the source analyst to work first and nobody else", () => {
    const s = state("extracting", "Dizelge çıkarılıyor");
    expect(s.kaynak_analisti).toBe("working");
    expect(s.icerik_uretici).toBe("idle");
  });

  it("marks earlier desks done and calls the human from the right desk", () => {
    const agents = officeAgents("awaiting_content_approval", null);
    const s = Object.fromEntries(agents.map((a) => [a.key, a.state]));
    expect(s.kaynak_analisti).toBe("done");
    expect(s.icerik_uretici).toBe("done");
    expect(s.bas_editor).toBe("waiting_human");
    expect(agents.find((a) => a.key === "bas_editor")?.speech).toContain("onay");
  });

  it("gives character drawing to the art director, not the illustrator", () => {
    const s = state("generating_images", "4 karakter için referans çizimleri üretiliyor");
    expect(s.sanat_yonetmeni).toBe("working");
    expect(s.gorsel_tasarimci).toBe("idle");
  });

  it("has two reviewers working together", () => {
    expect(officeSummary(officeAgents("reviewing", null)).working).toBe(2);
  });

  it("is all done when the book is done", () => {
    const sum = officeSummary(officeAgents("done", null));
    expect(sum.working + sum.waiting).toBe(0);
    expect(sum.done).toBe(9);
  });
});
