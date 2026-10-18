import type { CharacterSheet } from "@/db/schema";

// Faz 2 "Karakter tutarlılığı": pure helpers for putting the style bible's
// recurring characters into image prompts. Kept out of the workflow file so
// they're unit-testable.

type CharacterLike = Pick<CharacterSheet, "id" | "name" | "visualDescription" | "outfit">;

export function characterSheetPrompt(c: Pick<CharacterSheet, "name" | "role" | "visualDescription" | "outfit">): string {
  return [
    `Character reference sheet of ${c.name} (${c.role}).`,
    `Appearance: ${c.visualDescription}. Outfit: ${c.outfit}.`,
    "Show the same character twice side by side: a full-body front view and a full-body three-quarter view, neutral relaxed standing pose, friendly expression, plain very light background, even lighting, consistent proportions in both views. Only this one character - no other people, no props, no scenery.",
  ].join(" ");
}

// Written descriptions go into every prompt as well as the reference
// images: the free image model has no reference-image input, and even with
// references a short reminder of hair/outfit colour keeps details stable.
export function describeCharactersForPrompt(characters: CharacterLike[]): string {
  if (!characters.length) return "";
  return [
    "Recurring characters in this picture (draw them exactly as described and as on their reference sheets):",
    ...characters.map((c) => `- ${c.name}: ${c.visualDescription}; wearing ${c.outfit}.`),
  ].join("\n");
}

function mentions(text: string, name: string): boolean {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !!escaped && new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, "iu").test(text);
}

// Which characters to send as references for one page's picture: the ids
// the writer listed in imageCharacters, plus anyone the prompt names
// without listing (the model doesn't always fill the field).
export function charactersForImage<T extends CharacterLike>(
  page: { imagePrompt?: string; imageCharacters?: string[] },
  sheets: T[],
): T[] {
  const listed = new Set((page.imageCharacters ?? []).map((id) => id.toLowerCase()));
  const prompt = page.imagePrompt ?? "";
  return sheets.filter((c) => listed.has(c.id.toLowerCase()) || listed.has(c.name.toLowerCase()) || mentions(prompt, c.name));
}

// Cloudflare's flux endpoint rejects prompts over 2048 characters (live
// E2E 2026-10-09: scene + four character descriptions + style crossed it
// and every interior image failed). Budget in priority order: the scene
// first, then each character condensed, then the style line.
export const FREE_IMAGE_PROMPT_LIMIT = 2048;

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, Math.max(0, max - 1));
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function compactImagePrompt(
  scene: string,
  characters: CharacterLike[],
  styleSuffix: string | undefined,
  size: string,
  limit = FREE_IMAGE_PROMPT_LIMIT,
): string {
  // flux-1-schnell takes no width/height (always square); the composition
  // is steered in words so the crop into a wide or tall frame keeps the
  // subject (Faz G3).
  const sizeLine =
    size === "1536x1024"
      ? "Wide landscape composition, main subject centred, nothing important near the top or bottom edge."
      : size === "1024x1536"
        ? "Tall portrait composition, main subject centred, nothing important near the left or right edge."
        : `(Image size: ${size})`;
  const style = clip(styleSuffix ?? "", 420);
  const sceneText = clip(scene, 900);
  const room = limit - sizeLine.length - style.length - sceneText.length - 8;
  const perCharacter = characters.length ? Math.max(60, Math.floor(room / characters.length) - 4) : 0;
  const cast = characters.map((c) => clip(`${c.name}: ${c.visualDescription}; wearing ${c.outfit}.`, perCharacter)).join(" ");
  return clip([sceneText, cast, style, sizeLine].filter(Boolean).join("\n\n"), limit);
}
