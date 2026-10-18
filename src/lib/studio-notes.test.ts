import { describe, expect, it } from "vitest";
import { actionNote, isActionNote, latestStoryText, titleFromFirstMessage } from "./studio-notes";

describe("studio action notes", () => {
  it("recognises every note the studio posts", () => {
    expect(isActionNote(actionNote("done", "görsel", null))).toBe(true);
    expect(isActionNote(actionNote("done", "sesli anlatım", null))).toBe(true);
    expect(isActionNote(actionNote("pending", "video", null))).toBe(true);
    expect(isActionNote(actionNote("failed", "video", "kota doldu"))).toBe(true);
    expect(isActionNote("Minik kedi Pamuk topunu kaybetti.")).toBe(false);
  });

  it("finds the latest real story text", () => {
    const newestFirst = [
      { role: "assistant", content: "İstediğin görsel oluşturdum." },
      { role: "user", content: "(image üretimi istendi)" },
      { role: "assistant", content: "Minik kedi Pamuk topunu kaybetti." },
    ];
    expect(latestStoryText(newestFirst)).toBe("Minik kedi Pamuk topunu kaybetti.");
    expect(latestStoryText([{ role: "assistant", content: "İstediğin görsel oluşturdum." }])).toBe("");
  });
});

describe("titleFromFirstMessage", () => {
  it("uses a short first line as is", () => {
    expect(titleFromFirstMessage("  Uzaya giden kedi\nikinci satır")).toBe("Uzaya giden kedi");
  });

  it("cuts long text at a word boundary", () => {
    const title = titleFromFirstMessage(
      "Ormanda kaybolan küçük bir tilkinin arkadaşlarıyla birlikte evinin yolunu bulduğu bir hikaye yaz",
    );
    expect(title.length).toBeLessThanOrEqual(61);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/\s…$/);
  });
});
