"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRightIcon, Loader2Icon, SearchIcon, SearchXIcon } from "lucide-react";
import { networkErrorMessage, responseErrorMessage } from "@/lib/api-error";
import { BOOK_TYPE_LABELS } from "@/lib/run-status";
import type { SearchResult } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

const FIELD_LABELS: Record<SearchResult["field"], string> = {
  unitTitle: "Ünite başlığı",
  blockHeading: "Bölüm başlığı",
  blockBody: "Metin",
  glossary: "Sözlük",
};

// Highlights every case-insensitive occurrence of the query in a snippet.
function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "giu"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLocaleLowerCase("tr-TR") === q.toLocaleLowerCase("tr-TR") ? (
          <mark key={i} className="rounded bg-warning/40 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search field from anywhere on the page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (e.key === "/" && target?.tagName !== "INPUT" && target?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
        setSearchedQuery(query.trim());
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
    <PageContainer size="narrow">
      <PageHeader
        eyebrow="Kütüphane"
        title="Kitaplarımda ara"
        description="Tüm projelerindeki üretilmiş kitapların içeriğinde ara: ünite başlıkları, metinler ve sözlük."
      />

      <form onSubmit={handleSearch} className="mt-6">
        <div className="flex items-center gap-2 rounded-2xl border bg-card p-1.5 shadow-sm transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
          <SearchIcon className="ml-2.5 size-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Örn. past perfect"
            aria-label="Arama"
            className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <Kbd className="hidden sm:inline-flex">/</Kbd>
          <Button type="submit" disabled={loading || query.trim().length < 2}>
            {loading && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {loading ? "Aranıyor" : "Ara"}
          </Button>
        </div>
        {query.trim().length === 1 && <p className="mt-2 text-xs text-muted-foreground">En az 2 karakter yaz.</p>}
      </form>

      <div className="mt-8">
        {loading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!loading && results !== null && results.length === 0 && (
          <EmptyState
            icon={SearchXIcon}
            title="Sonuç bulunamadı"
            description={`"${searchedQuery}" hiçbir kitapta geçmiyor. Farklı bir kelime dene.`}
          />
        )}

        {!loading && !!results?.length && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {results.length} sonuç{results.length === 100 ? " (ilk 100)" : ""}
            </p>
            <ul className="flex flex-col gap-2.5">
              {results.map((r, i) => (
                <li key={i}>
                  <Link
                    href={`/projects/${r.projectId}/read/${r.bookType}`}
                    className="group block rounded-xl border bg-card p-4 text-card-foreground transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
                  >
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{r.projectName}</span>
                      <span>·</span>
                      <span>{BOOK_TYPE_LABELS[r.bookType] ?? r.bookType}</span>
                      <span>·</span>
                      <span className="truncate">
                        Ünite {r.unitNumber}: {r.unitTitle}
                      </span>
                      <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                        {FIELD_LABELS[r.field]}
                      </span>
                    </div>
                    <p className="mt-2 flex items-start gap-2 text-sm text-foreground/85">
                      <span className="min-w-0 flex-1">
                        <Highlighted text={r.snippet} query={searchedQuery} />
                      </span>
                      <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </PageContainer>
  );
}
