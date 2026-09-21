"use client";

import { useEffect, useState } from "react";
import type { storyProjects, storyMessages, storyArtifacts } from "@/db/schema";
import { AdvancedImagePanel } from "./AdvancedImagePanel";
import { Button } from "@/components/ui/button";

type StoryProject = typeof storyProjects.$inferSelect;
type StoryMessage = typeof storyMessages.$inferSelect;
type StoryArtifact = typeof storyArtifacts.$inferSelect;

const GENRE_OPTIONS = ["", "Macera", "Fantastik", "Bilim kurgu", "Günlük yaşam", "Eğitici masal"];
const AGE_OPTIONS = ["", "3-6 yaş", "7-10 yaş", "11-14 yaş", "Yetişkin"];
const TONE_OPTIONS = ["", "Esprili", "Sıcak/sakin", "Heyecanlı", "Ciddi"];

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
      const data = await res.json();
      if (!res.ok) {
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
      setError("Ağ hatası, tekrar dener misin?");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">{storyProject.title}</h1>
          <div className="flex items-center gap-2">
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

        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground"
          >
            {GENRE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g || "Tür seç…"}
              </option>
            ))}
          </select>
          <select
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground"
          >
            {AGE_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a || "Yaş grubu…"}
              </option>
            ))}
          </select>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground"
          >
            {TONE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t || "Ton…"}
              </option>
            ))}
          </select>
          <input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="Dil (örn. Türkçe)"
            className="w-32 rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-border p-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ne tür bir hikaye/içerik istediğini yaz. İstersen doğrudan bir görsel ya da ses de isteyebilirsin.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "self-end bg-primary text-primary-foreground"
                  : "self-start bg-card text-card-foreground ring-1 ring-foreground/10"
              }`}
            >
              {m.content}
              {artifacts
                .filter((a) => a.messageId === m.id)
                .map((a) => (
                  <div key={a.id} className="mt-2">
                    {a.status === "failed" ? (
                      <p className="text-xs text-destructive">Üretim başarısız: {a.errorMessage}</p>
                    ) : a.status === "pending" ? (
                      <p className="text-xs text-muted-foreground">Video üretiliyor…</p>
                    ) : a.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url ?? ""} alt={a.prompt} className="max-w-full rounded-md" />
                    ) : a.type === "audio" ? (
                      <audio controls src={a.url ?? ""} className="w-full" />
                    ) : a.type === "video" ? (
                      <video controls src={a.url ?? ""} className="max-w-full rounded-md" />
                    ) : null}
                  </div>
                ))}
            </div>
          ))}
        </div>

        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="Hikayeni anlat, bir sahneyi betimle ya da doğrudan bir görsel/ses iste…"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
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
              className="rounded-full border border-input bg-background px-2 text-xs text-foreground"
            >
              <option value="veo">Veo</option>
              <option value="higgsfield">Higgsfield</option>
            </select>
          </div>
        </div>

        <AdvancedImagePanel
          storyProjectId={storyProject.id}
          onArtifactsCreated={(newArtifacts) => setArtifacts((prev) => [...prev, ...newArtifacts])}
        />
      </div>

      <div className="w-full shrink-0 lg:w-72">
        <h2 className="text-sm font-medium text-foreground">Galeri</h2>
        <div className="mt-3 flex flex-col gap-3">
          {artifacts.length === 0 && <p className="text-xs text-muted-foreground">Henüz görsel/ses üretilmedi.</p>}
          {artifacts.map((a) => (
            <div key={a.id} className="rounded-xl bg-card p-2 text-card-foreground ring-1 ring-foreground/10">
              {a.status === "failed" ? (
                <p className="text-xs text-destructive">Başarısız: {a.errorMessage}</p>
              ) : a.status === "pending" ? (
                <p className="text-xs text-muted-foreground">Video üretiliyor…</p>
              ) : a.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url ?? ""} alt={a.prompt} className="w-full rounded-md" />
              ) : a.type === "audio" ? (
                <audio controls src={a.url ?? ""} className="w-full" />
              ) : a.type === "video" ? (
                <video controls src={a.url ?? ""} className="w-full rounded-md" />
              ) : null}
              <p className="mt-1 truncate text-xs text-muted-foreground" title={a.prompt}>
                {a.prompt}
              </p>
              {a.costUsd != null && (
                <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/70">~${a.costUsd.toFixed(3)}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
