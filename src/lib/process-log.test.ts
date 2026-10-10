import { describe, expect, it } from "vitest";
import { buildProcessLog, formatDuration } from "./process-log";

const t = (min: number) => new Date(Date.UTC(2026, 9, 10, 10, min));

const base = {
  events: [
    { kind: "status", status: "extracting", message: "Dizelge çıkarılıyor", createdAt: t(0) },
    { kind: "status", status: "awaiting_outline_approval", message: "Dizelge onayı bekleniyor", createdAt: t(2) },
    { kind: "human", status: "awaiting_outline_approval", message: "Dizelge onaylandı", createdAt: t(7) },
    { kind: "status", status: "generating", message: "Ünite 1/1: içerik üretiliyor", createdAt: t(7) },
    { kind: "status", status: "generating", message: "Ünite 1/1: geri bildirimle yeniden üretiliyor", createdAt: t(9) },
    { kind: "status", status: "awaiting_content_approval", message: "İçerik onayı bekleniyor", createdAt: t(12) },
  ],
  unitReviews: [
    { unitNumber: 1, reviewType: "language", passed: false, issues: ["'Giriş' is not English"], createdAt: t(8) },
    { unitNumber: 1, reviewType: "level", passed: true, issues: [], createdAt: t(8) },
  ],
  imageReviews: [],
  designReviews: [],
};

describe("buildProcessLog", () => {
  const log = buildProcessLog({ ...base, status: "awaiting_content_approval", currentStage: "İçerik onayı bekleniyor", updatedAt: t(12), now: t(15) });

  it("says what is waiting for the human right now", () => {
    expect(log.now.waitingForYou).toBe(true);
    expect(log.now.actorLabel).toBe("Baş Editör");
  });

  it("splits machine time from time spent waiting for the human", () => {
    expect(log.machineMs).toBe(2 * 60_000 + 5 * 60_000); // extracting 2 + generating 5
    expect(log.humanMs).toBe(5 * 60_000 + 3 * 60_000); // outline wait 5 + content wait so far 3
  });

  it("tells the story newest first, including the reviewers' findings and your decisions", () => {
    const titles = log.timeline.map((e) => e.title);
    expect(titles[0]).toContain("Onayını bekliyor");
    expect(log.timeline.some((e) => e.actor === "dil_denetcisi" && e.tone === "warn" && e.details?.[0].includes("Giriş"))).toBe(true);
    expect(log.timeline.some((e) => e.actor === "sen" && e.title === "Dizelge onaylandı")).toBe(true);
  });

  it("summarises each agent's work", () => {
    const writer = log.agents.find((a) => a.key === "icerik_uretici");
    expect(writer?.headline).toContain("1 kez");
    expect(log.agents.find((a) => a.key === "dil_denetcisi")?.headline).toBe("1 denetim, 1 kez düzeltme istedi");
  });
});

describe("formatDuration", () => {
  it("reads naturally", () => {
    expect(formatDuration(42_000)).toBe("42 sn");
    expect(formatDuration(252_000)).toBe("4 dk 12 sn");
    expect(formatDuration(3_900_000)).toBe("1 sa 5 dk");
  });
});
