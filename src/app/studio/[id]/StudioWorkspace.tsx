"use client";

import { useEffect, useRef, useState } from "react";
import type { storyProjects, storyMessages, storyArtifacts } from "@/db/schema";
import { AdvancedImagePanel } from "./AdvancedImagePanel";
import { ChatMessage, PendingAssistantMessage } from "./ChatMessage";
import { ArtifactCard } from "./ArtifactCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeleteButton } from "@/components/app/delete-button";

type StoryProject = typeof storyProjects.$inferSelect;
type StoryMessage = typeof storyMessages.$inferSelect;
type StoryArtifact = typeof storyArtifacts.$inferSelect;

const GENRE_OPTIONS = ["", "Macera", "Fantastik", "Bilim kurgu", "Günlük yaşam", "Eğitici masal"];
const AGE_OPTIONS = ["", "3-6 yaş", "7-10 yaş", "11-14 yaş", "Yetişkin"];
const TONE_OPTIONS = ["", "Esprili", "Sıcak/sakin", "Heyecanlı", "Ciddi"];

// Denetim sonrası düzeltme (2026-09-23): filtre satırındaki ham <select>'ler
// artık kenarlıksız/şeffaf, ortak bir "chip toolbar" çerçevesi içinde -
// composer'ın pill-şekilli butonlarıyla aynı dilde, ayrı bir araç çubuğu
// gibi görünmüyor.
const FILTER_SELECT_CLASS =
  "h-7 rounded-md border-none bg-transparent px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function StudioWorkspace({
  storyProject,
  initialMessages,
  initialArtifacts,
}: {
  storyProject: StoryProject;
  initialMessages: StoryMessage[];
  initialArtifacts: StoryArtifact[];
}) {
  const [messages, setMessages] = useState<StoryMessage[]>(initialMessages);
  const [artifacts, setArtifacts] = useState<StoryArtifact[]>(initialArtifacts);
  const [input, setInput] = useState("");
  const [genre, setGenre] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [tone, setTone] = useState("");
  const [language, setLanguage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoProvider, setVideoProvider] = useState<"veo" | "higgsfield">("veo");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // Faz "Gelişmiş Görsel Üretim Paneli": computed from the already-loaded
  // `artifacts` state rather than a separate server-side sum - every
  // artifact for this project (including ones the advanced panel creates,
  // appended via onArtifactsCreated below) is already in this array.
  const totalCostUsd = artifacts.reduce((sum, a) => sum + (a.costUsd ?? 0), 0);

  function buildMessageText(raw: string) {
    const tags = [
      genre && `Tür: ${genre}`,
      ageGroup && `Yaş grubu: ${ageGroup}`,
      tone && `Ton: ${tone}`,
      language && `Dil: ${language}`,
    ].filter(Boolean);
    return tags.length ? `[${tags.join(", ")}] ${raw}` : raw;
  }

  // Chat redesign: auto-resizing composer (Claude/ChatGPT convention) - no
  // new dependency, just measuring/resetting scrollHeight on each change.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // Auto-scroll to the latest message/pending indicator, same expectation
  // any chat UI sets (a purely visual redesign that left this out would
  // feel broken the moment a conversation grows past one screen).
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  // Video generation is async (Higgsfield submit -> poll) - any "pending"
  // video artifact needs its status checked periodically until it reaches a
  // terminal state. See src/app/api/studio/projects/[id]/artifacts/[artifactId]/route.ts.
  useEffect(() => {
    const pendingIds = artifacts.filter((a) => a.type === "video" && a.status === "pending").map((a) => a.id);
    if (!pendingIds.length) return;

    const interval = setInterval(async () => {
      for (const artifactId of pendingIds) {
        try {
          const res = await fetch(`/api/studio/projects/${storyProject.id}/artifacts/${artifactId}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.artifact && data.artifact.status !== "pending") {
            setArtifacts((prev) => prev.map((a) => (a.id === artifactId ? data.artifact : a)));
          }
        } catch {
          // transient poll failure - next tick retries, no need to surface an error
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [artifacts, storyProject.id]);

  async function sendMessage(action?: "image" | "audio" | "video") {
    const raw = input.trim();
    if (!raw && !action) return;
    setSending(true);
    setError(null);

    const optimisticText = action ? raw : buildMessageText(raw);
    const optimisticMessage: StoryMessage = {
      id: `optimistic-${Date.now()}`,
      storyProjectId: storyProject.id,
      role: "user",
      content: optimisticText || `(${action} üretimi istendi)`,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setInput("");

    try {
      const res = await fetch(`/api/studio/projects/${storyProject.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          message: optimisticText,
          action,
          videoProvider: action === "video" ? videoProvider : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // QA fix (2026-10-06): a failed send left the optimistic bubble in
        // the chat and threw away what the user had typed.
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
        setInput(raw);
        setError(data.error ?? "Bir hata oluştu");
        return;
      }
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticMessage.id),
        data.userMessage,
        data.assistantMessage,
      ]);
      if (data.artifacts?.length) {
        setArtifacts((prev) => [...prev, ...data.artifacts]);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      setInput(raw);
      setError("Ağ hatası, tekrar dener misin?");
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending && input.trim()) sendMessage();
    }
  }

  return (
    // Denetim sonrası düzeltme (2026-09-23): eskiden sabit h-[28rem] yükseklikli,
    // kenarlıklı bir kutu, max-w-6xl'e ortalanmış bir "form"un içine gömülüydü -
    // artık gerçek bir tam-sayfa sohbet kabuğu: kök layout'taki 12'lik (3rem)
    // header'ın altındaki tüm dikey alanı kaplıyor, composer bu sütunun altına
    // sabit kalıyor (sayfa değil sütun kaydırılıyor), galeri kendi başına
    // kaydırılan bağımsız bir sütun.
    <div className="flex h-[calc(100dvh-3rem)] w-full">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
          <h1 className="truncate text-lg font-semibold text-foreground">{storyProject.title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <DeleteButton
              endpoint={`/api/studio/projects/${storyProject.id}`}
              redirectTo="/studio"
              title="Hikayeyi sil"
              description={`"${storyProject.title}" hikayesi, tüm mesajları ve ürettiği görsel/ses kayıtlarıyla birlikte kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
            />
            {totalCostUsd > 0 && (
              <span
                className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                title="Bu projede şu ana kadar üretilen tüm görsel/ses/video'ların toplam maliyeti"
              >
                Toplam maliyet: ${totalCostUsd.toFixed(3)}
              </span>
            )}
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {storyProject.qualityMode === "draft" ? "Taslak" : "Final"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-6 py-2">
          <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Ayarlar</span>
          <div className="flex flex-wrap items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
            <select value={genre} onChange={(e) => setGenre(e.target.value)} className={FILTER_SELECT_CLASS}>
              {GENRE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g || "Tür seç…"}
                </option>
              ))}
            </select>
            <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className={FILTER_SELECT_CLASS}>
              {AGE_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a || "Yaş grubu…"}
                </option>
              ))}
            </select>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className={FILTER_SELECT_CLASS}>
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t || "Ton…"}
                </option>
              ))}
            </select>
            <Input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="Dil (örn. Türkçe)"
              className="h-7 w-28 border-none bg-transparent text-xs shadow-none focus-visible:ring-2"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
            {messages.length === 0 && !sending && (
              <p className="text-sm text-muted-foreground">
                Ne tür bir hikaye/içerik istediğini yaz. İstersen doğrudan bir görsel ya da ses de isteyebilirsin.
              </p>
            )}
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} artifacts={artifacts.filter((a) => a.messageId === m.id)} />
            ))}
            {sending && <PendingAssistantMessage />}
            <div ref={scrollAnchorRef} />
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border px-6 py-4">
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={3}
              placeholder="Hikayeni anlat, bir sahneyi betimle ya da doğrudan bir görsel/ses iste… (Enter: gönder, Shift+Enter: yeni satır)"
              className="max-h-[200px] resize-none"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => sendMessage()} disabled={sending || !input.trim()} className="h-9 rounded-full px-4">
                {sending ? "Gönderiliyor…" : "Gönder"}
              </Button>
              <Button
                variant="outline"
                onClick={() => sendMessage("image")}
                disabled={sending}
                className="h-9 rounded-full px-4"
              >
                Bunun görselini üret
              </Button>
              <Button
                variant="outline"
                onClick={() => sendMessage("audio")}
                disabled={sending}
                className="h-9 rounded-full px-4"
              >
                Bunun sesini üret
              </Button>
              <Button
                variant="outline"
                onClick={() => sendMessage("video")}
                disabled={sending}
                title="Önce bir görsel üretilmiş olmalı"
                className="h-9 rounded-full px-4"
              >
                Bunun videosunu üret
              </Button>
              <select
                value={videoProvider}
                onChange={(e) => setVideoProvider(e.target.value as "veo" | "higgsfield")}
                title="Video sağlayıcısı"
                className="h-9 rounded-full border border-input bg-transparent px-2.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="veo">Veo</option>
                <option value="higgsfield">Higgsfield</option>
              </select>
            </div>

            <AdvancedImagePanel
              storyProjectId={storyProject.id}
              onArtifactsCreated={(newArtifacts) => setArtifacts((prev) => [...prev, ...newArtifacts])}
            />
          </div>
        </div>
      </div>

      <div className="hidden w-72 shrink-0 flex-col overflow-hidden border-l border-border lg:flex">
        <h2 className="shrink-0 border-b border-border px-4 py-3 text-sm font-medium text-foreground">Galeri</h2>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-3 p-4">
            {artifacts.length === 0 && <p className="text-xs text-muted-foreground">Henüz görsel/ses üretilmedi.</p>}
            {artifacts.map((a) => (
              <ArtifactCard key={a.id} artifact={a} variant="gallery" />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
