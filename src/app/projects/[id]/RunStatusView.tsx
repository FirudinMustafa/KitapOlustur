"use client";

import { useEffect, useState } from "react";

type GeneratedBook = {
  id: string;
  bookType: "student_book" | "workbook" | "teacher_book" | "test_booklet";
  markdown: string | null;
  pdfBlobUrl: string | null;
};

type Run = {
  id: string;
  status: string;
  currentStage: string | null;
  errorMessage: string | null;
  updatedAt: string;
};

type Outline = {
  outline: unknown;
} | null;

type ProjectData = {
  project: { id: string; name: string; level: string | null };
  upload: { filename: string; bookType: string } | null;
  run: Run | null;
  outline: Outline;
  books: GeneratedBook[];
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  mapping_pages: "Sayfalar haritalanıyor",
  extracting: "Dizelge çıkarılıyor",
  analyzing: "Analiz ediliyor",
  generating: "Üretiliyor",
  reviewing: "İnceleniyor",
  generating_images: "Görseller üretiliyor",
  assembling: "Birleştiriliyor",
  done: "Tamamlandı",
  failed: "Hata",
};

const BOOK_TYPE_LABELS: Record<string, string> = {
  student_book: "Student Book",
  workbook: "Workbook",
  teacher_book: "Teacher's Book",
  test_booklet: "Test Kitapçığı",
};

const TERMINAL_STATUSES = new Set(["done", "failed"]);

export function RunStatusView({ projectId, initial }: { projectId: string; initial: ProjectData }) {
  const [data, setData] = useState(initial);
  const [showMarkdown, setShowMarkdown] = useState<Record<string, boolean>>({});
  const [rerunUnitLimit, setRerunUnitLimit] = useState("");
  const [rerunning, setRerunning] = useState(false);

  useEffect(() => {
    if (!data.run || TERMINAL_STATUSES.has(data.run.status)) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const next: ProjectData = await res.json();
        setData(next);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [projectId, data.run]);

  const { project, upload, run, outline, books } = data;
  const outlineObj = outline?.outline as { outline?: { units?: { number: number }[] } } | undefined;
  const unitCount = outlineObj?.outline?.units?.length;

  async function handleRerun() {
    setRerunning(true);
    try {
      const parsedLimit = rerunUnitLimit.trim() ? Number(rerunUnitLimit.trim()) : undefined;
      const res = await fetch(`/api/projects/${projectId}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitLimit: parsedLimit }),
      });
      if (res.ok) {
        const fresh = await fetch(`/api/projects/${projectId}`);
        if (fresh.ok) setData(await fresh.json());
      }
    } finally {
      setRerunning(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{project.name}</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {project.level ? `${project.level} · ` : ""}
        {upload ? `Kaynak: ${upload.filename}` : ""}
      </p>

      <div className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Pipeline durumu</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              run?.status === "done"
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                : run?.status === "failed"
                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {run ? STATUS_LABELS[run.status] ?? run.status : "—"}
          </span>
        </div>
        {run?.currentStage && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{run.currentStage}</p>
        )}
        {run?.status === "failed" && run.errorMessage && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{run.errorMessage}</p>
        )}
        {unitCount !== undefined && (
          <p className="mt-2 text-xs text-zinc-500">Dizelgede {unitCount} ünite bulundu.</p>
        )}
      </div>

      {upload && (
        <div className="mt-4 flex items-end gap-3 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Ünite sınırıyla yeniden çalıştır (opsiyonel)
            </label>
            <input
              type="number"
              min={1}
              value={rerunUnitLimit}
              onChange={(e) => setRerunUnitLimit(e.target.value)}
              placeholder="Örn. 4"
              className="h-9 w-32 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <button
            onClick={handleRerun}
            disabled={rerunning}
            className="h-9 rounded-full bg-zinc-950 px-4 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {rerunning ? "Başlatılıyor…" : "Yeniden çalıştır"}
          </button>
        </div>
      )}

      {books.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Üretilen kitaplar</h2>
          {books.map((book) => (
            <div key={book.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {BOOK_TYPE_LABELS[book.bookType] ?? book.bookType}
                </span>
                <div className="flex gap-2">
                  {book.pdfBlobUrl && (
                    <a
                      href={book.pdfBlobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    >
                      PDF indir
                    </a>
                  )}
                  {book.markdown && (
                    <button
                      onClick={() =>
                        setShowMarkdown((prev) => ({ ...prev, [book.id]: !prev[book.id] }))
                      }
                      className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      {showMarkdown[book.id] ? "Önizlemeyi gizle" : "Önizle"}
                    </button>
                  )}
                </div>
              </div>
              {showMarkdown[book.id] && book.markdown && (
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {book.markdown}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
