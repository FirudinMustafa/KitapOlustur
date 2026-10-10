"use client";

import { BOOK_TYPE_LABELS } from "@/lib/run-status";
import type { DesignReviewSummary } from "@/lib/design/design-summary";

// Faz 3 "Görsel sayfa denetimi": the art director's verdict on the typeset
// pages - shown before final approval so the human signs off on what the
// book actually looks like, not just its text.

function scoreTone(score: number): string {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-warning-soft-foreground";
  return "text-danger";
}

export function DesignQualityPanel({ summary }: { summary: DesignReviewSummary }) {
  return (
    <div className="mt-5 rounded-2xl border bg-card p-5 text-card-foreground shadow-xs">
      <h2 className="font-heading text-lg font-medium text-foreground">Tasarım kalitesi</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Kitap PDF olarak dizildi, her sayfa görüntüye çevrilip bir yayınevi sanat yönetmeni gözüyle puanlandı
        (85+ yayına hazır, 70 altı yayınevinin reddedeceği düzey).
        {summary.fixesApplied > 0 &&
          ` ${summary.fixesApplied} sayfa otomatik düzeltildi${summary.firstRoundAverage !== null ? ` (ilk tur ortalaması ${summary.firstRoundAverage})` : ""}.`}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {summary.bookTypes.map((t) => (
          <div key={t.bookType} className="rounded-xl border p-3">
            <div className="text-xs text-muted-foreground">{BOOK_TYPE_LABELS[t.bookType] ?? t.bookType}</div>
            <div className={`text-2xl font-semibold ${scoreTone(t.averageScore)}`}>{t.averageScore}</div>
            <div className="text-xs text-muted-foreground">
              {t.pages} sayfa · {t.belowBar} zayıf{t.spilled ? ` · ${t.spilled} taşan` : ""}
            </div>
          </div>
        ))}
      </div>

      {summary.weakest.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-medium text-foreground">En zayıf sayfalar</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary.weakest.map((p) => (
              <div key={`${p.bookType}-${p.pdfPage}`} className="flex gap-3 rounded-xl border p-2">
                <a href={p.imageUrl} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- proof page image on Vercel Blob */}
                  <img src={p.imageUrl} alt={`Sayfa ${p.pdfPage} provası`} className="h-32 w-24 rounded border bg-white object-contain" />
                </a>
                <div className="min-w-0 text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-base font-semibold ${scoreTone(p.score)}`}>{p.score}</span>
                    <span className="text-muted-foreground">
                      {BOOK_TYPE_LABELS[p.bookType] ?? p.bookType} · s. {p.pdfPage}
                      {p.unitNumber !== null && p.unitNumber < 90000 ? ` · Ünite ${p.unitNumber}` : ""}
                    </span>
                  </div>
                  {p.pageCount > 1 && <p className="mt-1 text-danger">İçerik {p.pageCount - 1} sayfa taşıyor</p>}
                  <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                    {p.issues.slice(0, 3).map((i, k) => (
                      <li key={k} className={i.severity === "major" ? "text-foreground" : undefined}>
                        {i.description}
                      </li>
                    ))}
                  </ul>
                  {p.referenceGap && <p className="mt-1 italic text-muted-foreground">Referansa göre: {p.referenceGap}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
