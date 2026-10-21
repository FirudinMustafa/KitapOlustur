import type { ContentBlock, GeneratedPage, GeneratedUnit, ListeningAudio } from "@/lib/ai/schemas";
import { isListeningRubric } from "@/lib/source-layout";

// Listening exercises and their recordings (2026-10-21). A coursebook's
// "Listen and point" is only usable with its recording: the writer is asked
// for a script per listening exercise (writerBlueprint), these helpers find
// the ones it skipped (so one small call can write just those), and number
// the recordings through the book the way printed coursebooks do ("1 [03]
// Listen and point.", with the scripts at the back).

const PAGE_FIELDS = ["studentBookPages", "workbookPages", "teacherBookPages", "testBookletPages"] as const;

const norm = (text: string) =>
  text
    .toLowerCase()
    .replace(/^\s*\d{1,2}[.)]?\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// The exercise's instruction: its heading, or the start of its body when the
// heading is only a title ("Classroom objects" + "Listen and point.").
function rubricOf(block: ContentBlock): string {
  return `${block.heading ?? ""} ${(block.body ?? "").split(/(?<=[.!?])\s/)[0] ?? ""}`;
}

export function isListeningBlock(block: ContentBlock): boolean {
  return !block.callout && isListeningRubric(rubricOf(block));
}

// The script written for this block: blockRef names the block's heading
// (the writer is told so); either may carry the exercise number.
export function scriptFor(block: ContentBlock, audio: ListeningAudio[] | undefined): ListeningAudio | undefined {
  const heading = norm(block.heading ?? "");
  if (!heading || !audio?.length) return undefined;
  return (
    audio.find((a) => norm(a.blockRef) === heading) ??
    audio.find((a) => {
      const ref = norm(a.blockRef);
      return ref.length >= 6 && (heading.includes(ref) || ref.includes(heading));
    })
  );
}

export type ListeningGap = { id: string; heading: string; body: string; items: string[] };

// Listening exercises on the given pages with no script yet.
export function findListeningGaps(pages: GeneratedPage[], audio: ListeningAudio[] | undefined): ListeningGap[] {
  const gaps: ListeningGap[] = [];
  pages.forEach((page, p) =>
    page.blocks.forEach((block, b) => {
      if (isListeningBlock(block) && !scriptFor(block, audio)) {
        gaps.push({ id: `${p}:${b}`, heading: block.heading, body: block.body, items: block.items ?? [] });
      }
    }),
  );
  return gaps;
}

// Scripts for the gaps, as listening entries pointing at their blocks.
export function applyListeningScripts(
  pages: GeneratedPage[],
  audio: ListeningAudio[] | undefined,
  scripts: { id: string; script: string; dialogueLines?: ListeningAudio["dialogueLines"] }[],
): ListeningAudio[] {
  const out = [...(audio ?? [])];
  for (const s of scripts) {
    const [p, b] = s.id.split(":").map(Number);
    const block = pages[p]?.blocks[b];
    if (!block || !s.script.trim() || scriptFor(block, out)) continue;
    out.push({ blockRef: block.heading, script: s.script.trim(), ...(s.dialogueLines?.length ? { dialogueLines: s.dialogueLines } : {}) });
  }
  return out;
}

// Keyed by content, so copies of a block made while laying out (and the
// same exercise reprinted in the Teacher's Book) still find their number.
const trackKey = (block: ContentBlock) => `${block.heading}|${block.body}`;

export type AudioTrack = { track: string; unitNumber: number; heading: string; entry: ListeningAudio };

// Every recording in book order - student book first, then the other
// books, page by page - numbered "01", "02"... Scripts no printed block
// points at are left out (nothing in the book would play them).
export function audioTracks(units: GeneratedUnit[]): AudioTrack[] {
  const tracks: AudioTrack[] = [];
  const taken = new Set<ListeningAudio>();
  for (const unit of [...units].sort((a, b) => a.unitNumber - b.unitNumber)) {
    for (const field of PAGE_FIELDS) {
      for (const page of unit[field] ?? []) {
        for (const block of page.blocks) {
          if (!isListeningBlock(block)) continue;
          const entry = scriptFor(block, unit.listeningAudio);
          if (!entry || taken.has(entry)) continue;
          taken.add(entry);
          tracks.push({ track: String(tracks.length + 1).padStart(2, "0"), unitNumber: unit.unitNumber, heading: block.heading, entry });
        }
      }
    }
  }
  return tracks;
}

// Block -> printed track number, for the renderers.
export function audioTrackMap(units: GeneratedUnit[]): Map<string, string> {
  const byEntry = new Map(audioTracks(units).map((t) => [t.entry, t.track]));
  const map = new Map<string, string>();
  for (const unit of units) {
    for (const field of PAGE_FIELDS) {
      for (const page of unit[field] ?? []) {
        for (const block of page.blocks) {
          if (!isListeningBlock(block)) continue;
          const entry = scriptFor(block, unit.listeningAudio);
          const track = entry && byEntry.get(entry);
          if (track) map.set(trackKey(block), track);
        }
      }
    }
  }
  return map;
}

export function trackOf(map: ReadonlyMap<string, string> | undefined, block: ContentBlock): string | undefined {
  return map?.get(trackKey(block));
}
