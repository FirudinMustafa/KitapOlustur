import sharp from "sharp";
import { isEmoji, twemojiUrl } from "@/lib/activities";

// Pictures for workbook activities (src/lib/activities.ts) without an image
// model: the writer picks one emoji per picture and it is drawn from
// Twemoji - a complete, consistent, flat illustration set, free to print
// under CC-BY 4.0 (credited on the imprint page, see TWEMOJI_CREDIT).
// No AI quota, no cost, and the same picture every time.

export { TWEMOJI_CREDIT, TWEMOJI_VERSION } from "@/lib/activities";
const ICON_PX = 160;

const cache = new Map<string, Promise<string | null>>();

async function loadIcon(emoji: string): Promise<string | null> {
  try {
    const res = await fetch(twemojiUrl(emoji), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const png = await sharp(Buffer.from(await res.arrayBuffer()), { density: 300 })
      .resize(ICON_PX, ICON_PX, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

// emoji -> PNG data URI for every emoji that could be drawn. Missing ones
// are simply absent: the PDF then prints the picture's short description.
export async function loadEmojiIcons(emojis: Iterable<string>): Promise<Record<string, string>> {
  const unique = [...new Set([...emojis].map((e) => e.trim()).filter(isEmoji))];
  const out: Record<string, string> = {};
  for (let i = 0; i < unique.length; i += 8) {
    const batch = unique.slice(i, i + 8);
    const icons = await Promise.all(
      batch.map((e) => {
        if (!cache.has(e)) cache.set(e, loadIcon(e));
        return cache.get(e)!;
      }),
    );
    batch.forEach((e, k) => {
      if (icons[k]) out[e] = icons[k]!;
      else cache.delete(e); // retry next time - a network blip shouldn't stick
    });
  }
  return out;
}

export function activityEmojis(units: { [field: string]: unknown }[]): string[] {
  const found: string[] = [];
  const visit = (pages: unknown) => {
    if (!Array.isArray(pages)) return;
    for (const page of pages as { blocks?: { activity?: { pictures?: { emoji?: string }[] }; diagram?: { places?: { emoji?: string }[] } }[] }[]) {
      for (const block of page.blocks ?? []) {
        for (const p of [...(block.activity?.pictures ?? []), ...(block.diagram?.places ?? [])]) if (p.emoji) found.push(p.emoji);
      }
    }
  };
  for (const u of units) {
    visit(u.studentBookPages);
    visit(u.workbookPages);
    visit(u.teacherBookPages);
    visit(u.testBookletPages);
  }
  return found;
}
