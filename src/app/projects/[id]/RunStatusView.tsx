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
  modelVersion?: string | null;
  tokenUsage?: Record<string, number> | null;
};

type OutlineUnit = { number: number; title: string; level: string };
type OutlineData = {
  bookTitle: string;
  subject: string;
  units: OutlineUnit[];
};
type ImprovementPlanData = {
  overallNotes: string;
};

export type OutlineDocument = {
  outline: { outline?: OutlineData; improvementPlan?: ImprovementPlanData };
};
type Outline = OutlineDocument | null;

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
  awaiting_outline_approval: "Onay bekleniyor",
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
  const [approving, setApproving] = useState(false);
  const [approvalUnitLimit, setApprovalUnitLimit] = useState("");
  const [assembleTypes, setAssembleTypes] = useState<Set<string>>(new Set());
  const [assembling, setAssembling] = useState(false);

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
  const outlineData = outline?.outline?.outline;
  const improvementPlan = outline?.outline?.improvementPlan;
  const unitCount = outlineData?.units?.length;

  async function refresh() {
    const fresh = await fetch(`/api/projects/${projectId}`);
    if (fresh.ok) setData(await fresh.json());
  }

  async function handleRerun() {
    setRerunning(true);
    try {
      const parsedLimit = rerunUnitLimit.trim() ? Number(rerunUnitLimit.trim()) : undefined;
      const res = await fetch(`/api/projects/${projectId}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitLimit: parsedLimit }),
      });
      if (res.ok) await refresh();
    } finally {
      setRerunning(false);
    }
  }

  async function handleApproval(approved: boolean) {
    setApproving(true);
    try {
      const parsedLimit = approvalUnitLimit.trim() ? Number(approvalUnitLimit.trim()) : undefined;
      const res = await fetch(`/api/projects/${projectId}/approve-outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, unitLimit: parsedLimit }),
      });
      if (res.ok) await refresh();
    } finally {
      setApproving(false);
    }
  }

  function toggleAssembleType(type: string) {
    setAssembleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  async function handleAssembleOnly() {
    if (!assembleTypes.size) return;
    setAssembling(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookTypes: Array.from(assembleTypes) }),
      });
      if (res.ok) {
        setAssembleTypes(new Set());
        await refresh();
      }
    } finally {
      setAssembling(false);
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
        {run?.tokenUsage?.total && (
          <p className="mt-1 text-xs text-zinc-400">
            Tahmini kullanım: ~{run.tokenUsage.total.toLocaleString("tr-TR")} token
            {run.modelVersion ? ` · ${run.modelVersion}` : ""}
          </p>
        )}
      </div>

      {run?.status === "awaiting_outline_approval" && outlineData && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Üretime başlamadan önce dizelgeyi onayla
          </h2>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            {outlineData.bookTitle} · {outlineData.subject}
          </p>
          <ol className="mt-3 flex flex-col gap-1 text-sm text-zinc-800 dark:text-zinc-200">
            {outlineData.units.map((u) => (
              <li key={u.number}>
                {u.number}. {u.title} <span className="text-xs text-zinc-500">({u.level})</span>
              </li>
            ))}
          </ol>
          {improvementPlan?.overallNotes && (
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="font-medium">İyileştirme planı: </span>
              {improvementPlan.overallNotes}
            </p>
          )}
          <div className="mt-4 flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-amber-800 dark:text-amber-300">
                Ünite sınırı (opsiyonel, değiştirmek için)
              </label>
              <input
                type="number"
                min={1}
                value={approvalUnitLimit}
                onChange={(e) => setApprovalUnitLimit(e.target.value)}
                placeholder="Örn. 4"
                className="h-9 w-32 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <button
              onClick={() => handleApproval(true)}
              disabled={approving}
              className="h-9 rounded-full bg-amber-600 px-4 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {approving ? "Gönderiliyor…" : "Onayla ve üret"}
            </button>
            <button
              onClick={() => handleApproval(false)}
              disabled={approving}
              className="h-9 rounded-full border border-zinc-300 px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Reddet
            </button>
          </div>
        </div>
      )}

      {run?.status === "done" && (
        <div className="mt-4 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            AI çağrısı yapmadan, mevcut içerikten ek kitap tipi derle
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {Object.entries(BOOK_TYPE_LABELS).map(([type, label]) => (
              <label key={type} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={assembleTypes.has(type)}
                  onChange={() => toggleAssembleType(type)}
                />
                {label}
              </label>
            ))}
          </div>
          <button
            onClick={handleAssembleOnly}
            disabled={assembling || !assembleTypes.size}
            className="mt-3 h-9 rounded-full bg-zinc-950 px-4 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {assembling ? "Başlatılıyor…" : "Seçilenleri derle"}
          </button>
        </div>
      )}

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
