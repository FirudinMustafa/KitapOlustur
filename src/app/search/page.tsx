"use client";

import { useState } from "react";
import Link from "next/link";
import { BOOK_TYPE_LABELS } from "@/lib/run-status";
import type { SearchResult } from "@/lib/search";

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
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Kitaplarımda ara</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Tüm projelerindeki üretilmiş kitapların içeriğinde (ünite başlıkları, metin, sözlük) ara.
      </p>

      <form onSubmit={handleSearch} className="mt-6 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Örn. past perfect"
          className="h-10 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          className="h-10 rounded-full bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {loading ? "Aranıyor…" : "Ara"}
        </button>
      </form>

      {results !== null && (
        <div className="mt-8">
          {results.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Sonuç bulunamadı.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {results.map((r, i) => (
                <li key={i}>
                  <Link
                    href={`/projects/${r.projectId}`}
                    className="block rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.projectName}</span>
                      <span>·</span>
                      <span>{BOOK_TYPE_LABELS[r.bookType] ?? r.bookType}</span>
                      <span>·</span>
                      <span>
                        Ünite {r.unitNumber}: {r.unitTitle}
                      </span>
                      <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {FIELD_LABELS[r.field]}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">{r.snippet}</p>
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
