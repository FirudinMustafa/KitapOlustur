"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { networkErrorMessage, responseErrorMessage } from "@/lib/api-error";
import { formatElapsedTurkish } from "@/lib/run-status";
import type { CharacterSheet } from "@/db/schema";

// Faz 2 "Karakter tutarlılığı": the art-director gate. Every illustration in
// the book is generated from these sheets, so this is the one moment to fix
// a character's look - after this they stay the same on every page.
export function CharacterApproval({
  projectId,
  sheets,
  waitingSince,
  onDone,
}: {
  projectId: string;
  sheets: CharacterSheet[];
  waitingSince: string;
  onDone: () => Promise<void>;
}) {
  const [redraw, setRedraw] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const marked = Object.keys(redraw);

  async function submit(approved: boolean) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/approve-characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved,
          redraw: approved ? [] : marked.map((id) => ({ id, note: redraw[id] })),
        }),
      });
      if (res.ok) {
        setRedraw({});
        await onDone();
      } else toast.error(await responseErrorMessage(res));
    } catch (err) {
      toast.error(networkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div data-approval-gate className="relative mt-5 scroll-mt-20 overflow-hidden rounded-2xl border border-warning/40 bg-warning-soft/50 p-5 pl-6 shadow-sm before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-warning">
      <h2 className="font-heading text-lg font-medium text-foreground">
        Karakterleri onayla
        <span className="ml-2 font-sans text-xs font-normal text-warning-soft-foreground">
          ({formatElapsedTurkish(new Date(waitingSince))} bekliyor)
        </span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Kitaptaki bütün görseller bu çizimlerden üretilecek; karakterler her sayfada aynı görünecek. Beğenmediğin
        karakteri işaretle, istersen ne değişmesi gerektiğini yaz.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sheets.map((c) => {
          const isMarked = c.id in redraw;
          return (
            <div key={c.id} className={`overflow-hidden rounded-xl border bg-card ${isMarked ? "border-warning ring-2 ring-warning/30" : ""}`}>
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image
                <img src={c.imageUrl} alt={`${c.name} karakter çizimi`} className="aspect-[3/2] w-full bg-muted object-contain" />
              ) : (
                <div className="flex aspect-[3/2] items-center justify-center bg-muted text-xs text-muted-foreground">Görsel yok</div>
              )}
              <div className="p-3">
                <div className="font-medium text-foreground">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.role}</div>
                <details className="mt-1 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Tanım</summary>
                  <p className="mt-1">{c.visualDescription}</p>
                  <p className="mt-1">Kıyafet: {c.outfit}</p>
                </details>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={isMarked}
                    onChange={() =>
                      setRedraw((prev) => {
                        const next = { ...prev };
                        if (isMarked) delete next[c.id];
                        else next[c.id] = "";
                        return next;
                      })
                    }
                  />
                  Yeniden çiz
                </label>
                {isMarked && (
                  <Textarea
                    value={redraw[c.id]}
                    onChange={(e) => setRedraw((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    placeholder="Ör. saçı daha kısa, gözlüksüz, mavi tişört"
                    className="mt-2 min-h-16 text-sm"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => submit(true)} disabled={submitting || marked.length > 0} size="sm">
          {submitting && !marked.length ? "Gönderiliyor…" : "Hepsini onayla ve devam et"}
        </Button>
        <Button onClick={() => submit(false)} disabled={submitting || !marked.length} variant="outline" size="sm">
          {submitting && marked.length ? "Gönderiliyor…" : `Seçilenleri yeniden çiz (${marked.length})`}
        </Button>
      </div>
    </div>
  );
}
