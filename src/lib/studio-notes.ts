// The short notes the studio posts after a direct image/audio/video action
// ("İstediğin görsel oluşturdum."). Everything that needs "the latest story
// text" - the quick image/audio buttons, "Kitaba dönüştür" - must skip them:
// live test 2026-10-12, a picture and a picture book were both made from
// "İstediğin görsel oluşturdum." instead of the story.
export function actionNote(status: "done" | "pending" | "failed", label: string, error: string | null): string {
  if (status === "done") return `İstediğin ${label} oluşturdum.`;
  if (status === "pending") return "Video üretimi başladı, hazır olunca burada görünecek.";
  return `Üzgünüm, ${label} üretimi başarısız oldu: ${error}`;
}

export function isActionNote(text: string): boolean {
  return /^(İstediğin .{1,30} oluşturdum\.|Video üretimi başladı, hazır olunca burada görünecek\.|Üzgünüm, .{1,30} üretimi başarısız oldu:)/.test(text.trim());
}

// The newest assistant message that is real story text (newest first input).
export function latestStoryText<M extends { role: string; content: string }>(newestFirst: M[]): string {
  return newestFirst.find((m) => m.role === "assistant" && !isActionNote(m.content))?.content.trim() ?? "";
}

export const DEFAULT_STORY_TITLE = "Yeni Hikaye";

// A story is created as "Yeni Hikaye" and was never renamed, so every story
// in the list - and every picture book made with "Kitaba dönüştür" - was
// called that (audit 2026-10-18). The first message the user writes names it.
export function titleFromFirstMessage(text: string): string {
  const firstLine = text.trim().split(/\r?\n/)[0].replace(/\s+/g, " ");
  if (firstLine.length <= 60) return firstLine;
  const cut = firstLine.slice(0, 60);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
