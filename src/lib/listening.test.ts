import { describe, expect, it } from "vitest";
import type { ContentBlock, GeneratedPage, GeneratedUnit } from "@/lib/ai/schemas";
import { applyListeningScripts, audioTrackMap, audioTracks, findListeningGaps, isListeningBlock, trackOf } from "./listening";

const block = (heading: string, body = "", items?: string[]): ContentBlock => ({ kind: "practice", heading, body, items });
const page = (...blocks: ContentBlock[]): GeneratedPage => ({ sourcePageNumber: 1, pageType: "content", blocks }) as unknown as GeneratedPage;
const unit = (n: number, pages: GeneratedPage[], listeningAudio?: GeneratedUnit["listeningAudio"]): GeneratedUnit => ({
  unitNumber: n,
  title: `Unit ${n}`,
  studentBookPages: pages,
  workbookPages: [],
  glossary: [],
  listeningAudio,
});

describe("isListeningBlock", () => {
  it("reads the rubric from the heading or the body's first sentence", () => {
    expect(isListeningBlock(block("1 Listen and point."))).toBe(true);
    expect(isListeningBlock(block("Classroom objects", "Listen and chant. Clap your hands."))).toBe(true);
    expect(isListeningBlock(block("2 Read and match."))).toBe(false);
  });
});

describe("findListeningGaps / applyListeningScripts", () => {
  const pages = [page(block("1 Listen and point.", "", ["pencil", "book"]), block("2 Listen and sing.")), page(block("3 Read and match."))];

  it("finds listening exercises without a script, matching blockRef with or without the number", () => {
    const gaps = findListeningGaps(pages, [{ blockRef: "Listen and point.", script: "A pencil. A book." }]);
    expect(gaps.map((g) => g.id)).toEqual(["0:1"]);
  });

  it("adds a script per gap, pointing at its block", () => {
    const audio = applyListeningScripts(pages, [], [
      { id: "0:0", script: "Number one. A pencil." },
      { id: "0:1", script: "Hello, hello!" },
      { id: "9:9", script: "nowhere" },
    ]);
    expect(audio.map((a) => a.blockRef)).toEqual(["1 Listen and point.", "2 Listen and sing."]);
    expect(findListeningGaps(pages, audio)).toEqual([]);
  });
});

describe("audio tracks", () => {
  const u1 = unit(1, [page(block("1 Listen and point."), block("2 Ask and answer."), block("3 Listen and chant."))], [
    { blockRef: "Listen and chant.", script: "chant" },
    { blockRef: "1 Listen and point.", script: "point" },
    { blockRef: "Unused", script: "never printed" },
  ]);
  const u2 = unit(2, [page(block("1 Watch and listen to the story."))], [{ blockRef: "Watch and listen to the story.", script: "story" }]);

  it("numbers recordings in book order, across units, leaving out unprinted scripts", () => {
    const tracks = audioTracks([u2, u1]);
    expect(tracks.map((t) => [t.track, t.entry.script])).toEqual([
      ["01", "point"],
      ["02", "chant"],
      ["03", "story"],
    ]);
  });

  it("maps each printed listening block to its track", () => {
    const map = audioTrackMap([u1, u2]);
    expect(trackOf(map, block("3 Listen and chant."))).toBe("02");
    expect(trackOf(map, block("2 Ask and answer."))).toBeUndefined();
  });
});
