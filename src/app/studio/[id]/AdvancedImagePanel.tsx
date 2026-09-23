"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { STUDIO_IMAGE_MODELS, STUDIO_IMAGE_SIZES, type StudioImageModelId, type StudioImageSizeId } from "@/lib/ai/model";
import type { savedReferenceImages, storyArtifacts } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Denetim sonrası düzeltme (2026-09-23): StudioWorkspace.tsx'in redesign'ıyla
// aynı select stili - ham <select>'lerin composer'ın hemen altında görsel
// bir "dikiş" oluşturmasını önlemek için (bkz. denetim raporu, bulgu 4).
const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type ReferenceImage = typeof savedReferenceImages.$inferSelect;
type StoryArtifact = typeof storyArtifacts.$inferSelect;

// Faz "Gelişmiş Görsel Üretim Paneli" (2026-09-21, ROADMAP.md): a separate,
// self-contained panel next to StudioWorkspace's simple chat flow - see
// that file's own comment on why the two aren't merged. This component
// owns its own state (references, model/size/count, prompt, brainstorm,
// magic-prompt) and only reports finished artifacts back up via
// onArtifactsCreated, the same "parent owns the gallery" shape
// StudioWorkspace already uses for the simple flow's artifacts.
export function AdvancedImagePanel({
  storyProjectId,
  onArtifactsCreated,
}: {
  storyProjectId: string;
  onArtifactsCreated: (artifacts: StoryArtifact[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [model, setModel] = useState<StudioImageModelId>(STUDIO_IMAGE_MODELS[0].id);
  const [size, setSize] = useState<StudioImageSizeId>(STUDIO_IMAGE_SIZES[0].id);
  const [count, setCount] = useState(1);
  const [prompt, setPrompt] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [uploadTags, setUploadTags] = useState("");
  const [uploadingRef, setUploadingRef] = useState(false);
  const [brainstormCount, setBrainstormCount] = useState(3);
  const [brainstormIdeas, setBrainstormIdeas] = useState<string[]>([]);
  const [brainstorming, setBrainstorming] = useState(false);
  const [improvingPrompt, setImprovingPrompt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/studio/reference-images")
      .then((res) => res.json())
      .then((data) => setReferences(data.referenceImages ?? []))
      .catch(() => {});
  }, [open]);

  const allTags = [...new Set(references.flatMap((r) => r.tags))];
  const estimatedCostUsd = (STUDIO_IMAGE_SIZES.find((s) => s.id === size) ? costForSize(size) : null);

  function costForSize(sizeId: StudioImageSizeId): number {
    // Mirrors src/lib/ai/pricing.ts's STUDIO_IMAGE_PRICE_USD_ESTIMATE_BY_SIZE
    // - duplicated as plain numbers here rather than importing server-only
    // pricing helpers into a client component (pricing.ts has no server-only
    // imports either, but keeping the client bundle from depending on the
    // pricing module avoids ever accidentally pulling in something that
    // does later).
    const table: Record<StudioImageSizeId, number> = { "1024x1024": 0.053, "1024x1536": 0.08, "1536x1024": 0.08 };
    return table[sizeId] * count;
  }

  function toggleTag(tag: string) {
    // Bug fixed here: calling setPrompt from inside setSelectedTags's updater
    // callback made that callback impure (a side effect during a state
    // computation) - React's Strict Mode dev double-invokes updater
    // functions specifically to catch this, which was firing the @tag
    // insertion twice on a single click. Both updates are now independent
    // and pure, deciding direction from `willSelect` (captured once, from
    // the render's own `selectedTags` snapshot) rather than from each
    // other's `prev`.
    const willSelect = !selectedTags.has(tag);
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (willSelect) next.add(tag);
      else next.delete(tag);
      return next;
    });
    setPrompt((p) =>
      willSelect ? (p ? `${p} @${tag}` : `@${tag}`) : p.replace(new RegExp(`\\s*@${tag}\\b`, "g"), "").trim(),
    );
  }

  function handlePromptChange(value: string) {
    setPrompt(value);
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const uptoCaret = value.slice(0, caret);
    const match = uptoCaret.match(/@([\p{L}\p{N}_-]*)$/u);
    setMentionQuery(match ? match[1].toLowerCase() : null);
  }

  function insertMentionTag(tag: string) {
    const caret = textareaRef.current?.selectionStart ?? prompt.length;
    const uptoCaret = prompt.slice(0, caret);
    const replaced = uptoCaret.replace(/@([\p{L}\p{N}_-]*)$/u, `@${tag} `);
    setPrompt(replaced + prompt.slice(caret));
    setMentionQuery(null);
  }

  async function handleUploadReference(file: File) {
    setUploadingRef(true);
    setError(null);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        contentType: file.type || "image/png",
      });
      const tags = uploadTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch("/api/studio/reference-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: blob.url, tags }),
      });
      const data = await res.json();
      if (res.ok) {
        setReferences((prev) => [data.referenceImage, ...prev]);
        setUploadTags("");
      } else {
        setError(data.error ?? "Referans görsel yüklenemedi");
      }
    } catch {
      setError("Referans görsel yüklenirken bir hata oluştu");
    } finally {
      setUploadingRef(false);
    }
  }

  async function handleBrainstorm() {
    setBrainstorming(true);
    setError(null);
    try {
      const referenceImageIds = references.filter((r) => r.tags.some((t) => selectedTags.has(t))).map((r) => r.id);
      const res = await fetch(`/api/studio/projects/${storyProjectId}/brainstorm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceImageIds, ideaCount: brainstormCount }),
      });
      const data = await res.json();
      if (res.ok) setBrainstormIdeas(data.ideas ?? []);
      else setError(data.error ?? "Fikir üretilemedi");
    } catch {
      setError("Fikir üretilirken bir hata oluştu");
    } finally {
      setBrainstorming(false);
    }
  }

  async function handleMagicPrompt() {
    if (!prompt.trim()) return;
    setImprovingPrompt(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/projects/${storyProjectId}/magic-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftText: prompt }),
      });
      const data = await res.json();
      if (res.ok) setPrompt(data.improvedPrompt ?? prompt);
      else setError(data.error ?? "Prompt geliştirilemedi");
    } catch {
      setError("Prompt geliştirilirken bir hata oluştu");
    } finally {
      setImprovingPrompt(false);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/projects/${storyProjectId}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model, size, count }),
      });
      const data = await res.json();
      if (res.ok && data.artifacts) {
        onArtifactsCreated(data.artifacts);
      } else {
        setError(data.errorMessage ?? data.error ?? "Görsel üretilemedi");
      }
    } catch {
      setError("Görsel üretilirken bir hata oluştu");
    } finally {
      setGenerating(false);
    }
  }

  const matchingMentionTags =
    mentionQuery !== null ? allTags.filter((t) => t.toLowerCase().includes(mentionQuery)) : [];

  return (
    <div className="mt-4 rounded-xl border border-border">
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="h-auto w-full justify-between rounded-xl px-4 py-3 text-left text-sm font-medium text-foreground"
      >
        Gelişmiş Görsel Üretimi
        <span className="text-xs text-muted-foreground">{open ? "Gizle" : "Göster"}</span>
      </Button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as StudioImageModelId)}
                className={SELECT_CLASS}
              >
                {STUDIO_IMAGE_MODELS.map((m) => (
                  <option key={m.id} value={m.id} title={m.description}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Çözünürlük</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as StudioImageSizeId)}
                className={SELECT_CLASS}
              >
                {STUDIO_IMAGE_SIZES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Adet</label>
              <Input
                type="number"
                min={1}
                max={4}
                value={count}
                onChange={(e) => setCount(Math.min(4, Math.max(1, Number(e.target.value) || 1)))}
                className="w-16"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Kayıtlı Referanslar</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {references.length === 0 && <p className="text-xs text-muted-foreground">Henüz kayıtlı referans yok.</p>}
              {references.map((r) => (
                <div key={r.id} className="w-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt={r.tags.join(", ")} className="h-20 w-20 rounded-md object-cover" />
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <button
                        key={t}
                        onClick={() => toggleTag(t)}
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                          selectedTags.has(t)
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        @{t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleUploadReference(e.target.files[0])}
                className="hidden"
              />
              <Input
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="Etiketler (virgülle ayır)"
                className="h-8 flex-1"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingRef}
                className="h-8 rounded-full px-3 text-xs"
              >
                {uploadingRef ? "Yükleniyor…" : "Referans yükle"}
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={10}
                value={brainstormCount}
                onChange={(e) => setBrainstormCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                className="h-8 w-16"
              />
              <Button
                variant="outline"
                onClick={handleBrainstorm}
                disabled={brainstorming}
                className="h-8 rounded-full px-3 text-xs"
              >
                {brainstorming ? "Fikir üretiliyor…" : "Fikir üret"}
              </Button>
            </div>
            {brainstormIdeas.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {brainstormIdeas.map((idea, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(idea)}
                    className="rounded-lg border border-border px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              rows={3}
              placeholder="Görsel için prompt yaz - @etiket ile kayıtlı bir referansa atıfta bulunabilirsin"
            />
            {mentionQuery !== null && matchingMentionTags.length > 0 && (
              <div className="absolute z-10 mt-1 w-48 rounded-lg border border-border bg-popover shadow-lg">
                {matchingMentionTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => insertMentionTag(t)}
                    className="block w-full px-3 py-1.5 text-left text-xs text-popover-foreground hover:bg-accent"
                  >
                    @{t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={handleMagicPrompt}
              disabled={improvingPrompt || !prompt.trim()}
              title="Promptu yapay zekanın anlayacağı şekilde geliştir"
              className="h-9 rounded-full px-3"
            >
              {improvingPrompt ? "Geliştiriliyor…" : "✨ Magic"}
            </Button>
            <Button onClick={handleGenerate} disabled={generating || !prompt.trim()} className="h-9 rounded-full px-4">
              {generating ? "Üretiliyor…" : "Üret"}
            </Button>
            {estimatedCostUsd != null && (
              <span className="text-xs text-muted-foreground">Tahmini maliyet: ~${estimatedCostUsd.toFixed(3)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
