import { describe, expect, it } from "vitest";
import { charactersForImage, characterSheetPrompt, describeCharactersForPrompt } from "./characters";

const leo = { id: "leo", name: "Leo", role: "student", visualDescription: "11-year-old boy, short curly black hair", outfit: "yellow hoodie", imageUrl: "https://x/leo.png" };
const ayse = { id: "ayse", name: "Ayşe", role: "student", visualDescription: "11-year-old girl, long brown braid, glasses", outfit: "green dress", imageUrl: "https://x/ayse.png" };
const sheets = [leo, ayse];

describe("charactersForImage", () => {
  it("uses the ids the writer listed", () => {
    expect(charactersForImage({ imagePrompt: "Two kids at a bus stop", imageCharacters: ["ayse"] }, sheets)).toEqual([ayse]);
  });

  it("also catches characters named in the prompt but not listed", () => {
    expect(charactersForImage({ imagePrompt: "Leo waves at the baker" }, sheets)).toEqual([leo]);
  });

  it("matches non-ASCII names as whole words only", () => {
    expect(charactersForImage({ imagePrompt: "Ayşe reads a map" }, sheets)).toEqual([ayse]);
    expect(charactersForImage({ imagePrompt: "Leonardo paints" }, sheets)).toEqual([]);
  });

  it("returns nobody for a scene without the cast", () => {
    expect(charactersForImage({ imagePrompt: "A quiet harbour at dawn" }, sheets)).toEqual([]);
  });
});

describe("prompts", () => {
  it("writes each character's look and outfit into the picture prompt", () => {
    const text = describeCharactersForPrompt([leo]);
    expect(text).toContain("Leo: 11-year-old boy, short curly black hair; wearing yellow hoodie.");
  });

  it("is empty when no character is in the picture", () => {
    expect(describeCharactersForPrompt([])).toBe("");
  });

  it("asks for a clean two-view reference sheet", () => {
    const text = characterSheetPrompt(leo);
    expect(text).toContain("full-body front view");
    expect(text).toContain("Only this one character");
  });
});

describe("compactImagePrompt", () => {
  it("never exceeds the free image model's 2048-character limit", async () => {
    const { compactImagePrompt } = await import("./characters");
    const long = { ...leo, visualDescription: "very detailed ".repeat(80), outfit: "layered outfit ".repeat(30) };
    const out = compactImagePrompt("A busy market scene ".repeat(100), [long, long, long, long], "Style: ".repeat(200), "1536x1024");
    expect(out.length).toBeLessThanOrEqual(2048);
    expect(out).toContain("A busy market scene");
    expect(out).toContain("Leo:");
  });
});
