import type { storyMessages, storyArtifacts } from "@/db/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArtifactCard } from "./ArtifactCard";

type StoryMessage = typeof storyMessages.$inferSelect;
type StoryArtifact = typeof storyArtifacts.$inferSelect;

function formatTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

// "Hikaye Stüdyosu sohbet arayüzü yenileme" (2026-09-22): a real message
// bubble (avatar, role label, timestamp) replacing the old plain <div> that
// distinguished user/assistant only by background color/alignment.
export function ChatMessage({ message, artifacts }: { message: StoryMessage; artifacts: StoryArtifact[] }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex max-w-[85%] items-start gap-2 ${isUser ? "flex-row-reverse self-end" : "self-start"}`}>
      <Avatar size="sm" className="mt-4 shrink-0">
        <AvatarFallback className={isUser ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}>
          {isUser ? "S" : "✦"}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-1">
        <div className={`flex items-baseline gap-2 px-1 ${isUser ? "flex-row-reverse" : ""}`}>
          <span className="text-xs font-medium text-foreground/70">{isUser ? "Sen" : "Kitap Orkestrası"}</span>
          <span className="text-[10px] text-muted-foreground">{formatTime(message.createdAt)}</span>
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            isUser ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground ring-1 ring-foreground/10"
          }`}
        >
          {message.content}
          {artifacts.map((a) => (
            <div key={a.id} className="mt-2">
              <ArtifactCard artifact={a} variant="inline" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Shown in place of a real assistant bubble while a request is in flight -
// there's no streaming yet (see model.ts's documented ai v6/v7 boundary), so
// this is the loading feedback instead of the old "Gönderiliyor…" button text.
export function PendingAssistantMessage() {
  return (
    <div className="flex max-w-[85%] items-start gap-2 self-start">
      <Avatar size="sm" className="mt-4 shrink-0">
        <AvatarFallback className="bg-primary text-primary-foreground">✦</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-48 rounded-lg" />
      </div>
    </div>
  );
}
