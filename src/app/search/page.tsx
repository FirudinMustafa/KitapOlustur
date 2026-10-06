"use client";

import { useState } from "react";
import { toast } from "sonner";
import { networkErrorMessage, responseErrorMessage } from "@/lib/api-error";
import Link from "next/link";
import { BOOK_TYPE_LABELS } from "@/lib/run-status";
import type { SearchResult } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FIELD_LABELS: Record<SearchResult["field"], string> = {
  unitTitle: "Ünite başlığı",
  blockHeading: "Bölüm başlığı",
  blockBody: "Metin",
  glossary: "Sözlük",
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
      } else {
        toast.error(await responseErrorMessage(res, "Arama yapılamadı"));
      }
    } catch (err) {
      toast.error(networkErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">Kitaplarımda ara</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tüm projelerindeki üretilmiş kitapların içeriğinde (ünite başlıkları, metin, sözlük) ara.
      </p>

      <form onSubmit={handleSearch} className="mt-6 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Örn. past perfect"
          className="h-10 flex-1"
        />
        <Button type="submit" disabled={loading || query.trim().length < 2} className="h-10 rounded-full px-4">
          {loading ? "Aranıyor…" : "Ara"}
        </Button>
      </form>

      {results !== null && (
        <div className="mt-8">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sonuç bulunamadı.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {results.map((r, i) => (
                <li key={i}>
                  <Link
                    href={`/projects/${r.projectId}/read/${r.bookType}`}
                    className="block rounded-xl bg-card p-3 text-card-foreground ring-1 ring-foreground/10 transition-colors hover:bg-accent hover:ring-primary/30"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{r.projectName}</span>
                      <span>·</span>
                      <span>{BOOK_TYPE_LABELS[r.bookType] ?? r.bookType}</span>
                      <span>·</span>
                      <span>
                        Ünite {r.unitNumber}: {r.unitTitle}
                      </span>
                      <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                        {FIELD_LABELS[r.field]}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-foreground/80">{r.snippet}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
