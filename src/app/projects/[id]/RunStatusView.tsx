"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BOOK_TYPE_LABELS, formatElapsedTurkish } from "@/lib/run-status";
import type { UnitProgress } from "@/lib/unit-progress";
import { PipelineStageTracker } from "./PipelineStageTracker";
import { Badge } from "@/components/ui/badge";

type ListeningAudioEntry = { blockRef: string; script: string; audioUrl?: string };
export type GeneratedUnitContent = { unitNumber: number; listeningAudio?: ListeningAudioEntry[] };

type GeneratedBook = {
  id: string;
  bookType: "student_book" | "workbook" | "teacher_book" | "test_booklet";
  markdown: string | null;
  pdfBlobUrl: string | null;
  epubBlobUrl?: string | null;
  content?: GeneratedUnitContent[] | null;
};

function audioTracksFor(book: GeneratedBook): { unitNumber: number; blockRef: string; audioUrl: string }[] {
  if (!Array.isArray(book.content)) return [];
  return book.content.flatMap((unit) =>
    (unit.listeningAudio ?? [])
      .filter((entry): entry is ListeningAudioEntry & { audioUrl: string } => Boolean(entry.audioUrl))
      .map((entry) => ({ unitNumber: unit.unitNumber, blockRef: entry.blockRef, audioUrl: entry.audioUrl })),
  );
}

type PendingVariantPage = { blocks: { heading: string; body: string }[] };
type PendingVariantUnit = {
  title: string;
  studentBookPages: PendingVariantPage[];
  workbookPages: PendingVariantPage[];
};
type PendingVariant = { index: number; unit: PendingVariantUnit; issues: string[]; passed: boolean };
export type PendingVariants = { unitNumber: number; variants: PendingVariant[] } | null;

// Faz "İnsan-onaylı üretim hattı": preview shape for the batched
// content-approval gate - deliberately the same light shape as
// PendingVariantUnit above (title + pages + block heading/body), not the
// full GeneratedUnit - this is a read-through preview, not an edit UI.
export type PendingContentUnit = {
  unitNumber: number;
  title: string;
  studentBookPages: PendingVariantPage[];
  workbookPages: PendingVariantPage[];
};

// Faz "Granüler editöryel feedback": each approval round is numbered so its
// resume token (content-approval:${runId}:${round}) stays unique across
// however many regenerate-and-reapprove cycles a run goes through.
export type PendingContentApproval = { round: number; units: PendingContentUnit[] } | null;

export type PendingImageReview = { unitNumber: number; pageNumber: number; imageUrl: string; issues: string[] };

type Run = {
  id: string;
  status: string;
  currentStage: string | null;
  errorMessage: string | null;
  updatedAt: string;
  modelVersion?: string | null;
  tokenUsage?: Record<string, number> | null;
  pendingVariants?: PendingVariants;
  pendingContentApproval?: PendingContentApproval;
  pendingImageReview?: PendingImageReview[] | null;
  coverImageUrl?: string | null;
  pageImageUrls?: Record<number, string> | null;
};

type OutlineUnit = { number: number; title: string; level: string };
// Faz "Müfredat hizalaması": only present when the user declared a target
// level at project creation - compares it against what extractOutline
// actually observed in the source material (see workflows/book-pipeline.tsx).
type DeclaredLevelAlignment = { matches: boolean; note: string };
type OutlineData = {
  bookTitle: string;
  subject: string;
  units: OutlineUnit[];
  declaredLevelAlignment?: DeclaredLevelAlignment;
};
type ImprovementPlanData = {
  overallNotes: string;
};

export type OutlineDocument = {
  outline: { outline?: OutlineData; improvementPlan?: ImprovementPlanData };
};
type Outline = OutlineDocument | null;

type CoherenceIssue = { unitNumber: number; category: string; description: string; severity: "low" | "medium" | "high" };
type CoherenceReview = {
  passed: boolean;
  difficultyProgressionScore: number;
  vocabularyRepetitionScore: number;
  grammarSequencingScore: number;
  thematicConsistencyScore: number;
  issues: CoherenceIssue[];
};

type FeedbackEntry = { id: string; rating: number | null; comment: string | null };

// Faz F2: LLM second opinion on an already-flagged (F1 n-gram) page - see
// src/db/schema.ts's OriginalityLlmAssessment. Null when the pipeline ran
// before F2 existed, or (shouldn't happen post-F2) if the LLM call failed.
type OriginalityLlmAssessment = {
  similarityLevel: "low" | "medium" | "high";
  rationale: string;
  concerningPhrases: string[];
};

type FlaggedOriginalityCheck = {
  unitNumber: number;
  pageNumber: number;
  ngramOverlapScore: number;
  llmAssessment: OriginalityLlmAssessment | null;
};

type ProjectData = {
  project: { id: string; name: string; level: string | null };
  upload: { filename: string; bookType: string } | null;
  run: Run | null;
  outline: Outline;
  books: GeneratedBook[];
  flaggedImageCount?: number;
  flaggedOriginalityCount?: number;
  flaggedOriginalityChecks?: FlaggedOriginalityCheck[];
  coherenceReview?: CoherenceReview | null;
  feedback?: FeedbackEntry[];
  unitProgress?: UnitProgress[];
};

const TERMINAL_STATUSES = new Set(["done", "failed", "changes_requested"]);

const STEP_LABELS: Record<string, string> = {
  pageMap: "Sayfa haritalama",
  outline: "Dizelge çıkarma",
  improvementPlan: "İyileştirme planı",
  styleBible: "Stil rehberi",
  unitGeneration: "Ünite üretimi",
  review: "İnceleme (yapı + dil)",
  imageReview: "Görsel QA (Faz D)",
  bookCoherence: "Kitap tutarlılık incelemesi (Faz E)",
};

// Per-1M-token pricing (verified live via the claude-api skill, not recalled
// from training data - see ROADMAP.md Faz G5/H6). tokenUsage only stores
// input+output combined per step (see recordUsage in
// workflows/book-pipeline.tsx), so an exact dollar figure isn't derivable
// from it - showing the range bounded by "all input" and "all output"
// instead of a single falsely-precise number. Imagen/TTS spend isn't
// token-based and isn't priced here - only generated counts are shown for
// those.
//
// Faz H6: a run's modelVersion now reflects whichever text model actually
// wrote its bulk unit content (Sonnet 5 for "final", Haiku 4.5 for "draft"),
// so pricing is picked per-run instead of a single hardcoded rate. This is
// still an approximation even so: review/QA steps (reviewUnit,
// reviewLanguageAccuracy, reviewImage, reviewBookCoherence) and one-time
// extraction/scaffolding steps (pageMap, outline, improvementPlan,
// styleBible) always bill at Sonnet 5 rates regardless of quality mode (see
// src/lib/ai/model.ts), so a "draft" run's true cost sits somewhere between
// the two models' rates, not purely at the cheaper one.
const MODEL_PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  "anthropic/claude-sonnet-5": { input: 2, output: 10 },
  "anthropic/claude-haiku-4-5": { input: 1, output: 5 },
};
const DEFAULT_PRICING = MODEL_PRICING_PER_MILLION["anthropic/claude-sonnet-5"];

export function RunStatusView({ projectId, initial }: { projectId: string; initial: ProjectData }) {
  const [data, setData] = useState(initial);
  const [showMarkdown, setShowMarkdown] = useState<Record<string, boolean>>({});
  const [rerunUnitLimit, setRerunUnitLimit] = useState("");
  const [rerunning, setRerunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalUnitLimit, setApprovalUnitLimit] = useState("");
  const [assembleTypes, setAssembleTypes] = useState<Set<string>>(new Set());
  const [assembling, setAssembling] = useState(false);
  const [selectingVariant, setSelectingVariant] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<string>("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [approvingContent, setApprovingContent] = useState(false);
  const [unitChangeComments, setUnitChangeComments] = useState<Record<number, string>>({});
  const [imageDecisions, setImageDecisions] = useState<Record<string, "accept" | "regenerate">>({});
  const [submittingImageReview, setSubmittingImageReview] = useState(false);
  const [approvingFinal, setApprovingFinal] = useState(false);

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

  const {
    project,
    upload,
    run,
    outline,
    books,
    flaggedImageCount,
    flaggedOriginalityCount,
    flaggedOriginalityChecks,
    coherenceReview,
    feedback,
    unitProgress,
  } = data;

  const tokenBreakdown = Object.entries(run?.tokenUsage ?? {})
    .filter(([key]) => key !== "total")
    .sort((a, b) => b[1] - a[1]);
  const totalTokens = run?.tokenUsage?.total ?? 0;
  const pricing = (run?.modelVersion && MODEL_PRICING_PER_MILLION[run.modelVersion]) || DEFAULT_PRICING;
  const estimatedCostMin = (totalTokens / 1_000_000) * pricing.input;
  const estimatedCostMax = (totalTokens / 1_000_000) * pricing.output;
  const imageCount = (run?.coverImageUrl ? 1 : 0) + Object.keys(run?.pageImageUrls ?? {}).length;
  const audioCount = books.reduce((sum, b) => sum + audioTracksFor(b).length, 0);
  const outlineData = outline?.outline?.outline;
  const improvementPlan = outline?.outline?.improvementPlan;
  const unitCount = outlineData?.units?.length;
  const pendingContentApproval = run?.pendingContentApproval?.units;
  const pendingImageReview = run?.pendingImageReview;

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

  async function handleContentApproval(approved: boolean) {
    setApprovingContent(true);
    try {
      const changes = Object.entries(unitChangeComments)
        .filter(([, comment]) => comment.trim())
        .map(([unitNumber, comment]) => ({ unitNumber: Number(unitNumber), comment: comment.trim() }));
      const res = await fetch(`/api/projects/${projectId}/approve-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, changes }),
      });
      if (res.ok) {
        setUnitChangeComments({});
        await refresh();
      }
    } finally {
      setApprovingContent(false);
    }
  }

  async function handleImageReviewSubmit() {
    setSubmittingImageReview(true);
    try {
      const decisions = Object.entries(imageDecisions).map(([key, action]) => {
        const [unitNumber, pageNumber] = key.split(":").map(Number);
        return { unitNumber, pageNumber, action };
      });
      const res = await fetch(`/api/projects/${projectId}/review-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions }),
      });
      if (res.ok) {
        setImageDecisions({});
        await refresh();
      }
    } finally {
      setSubmittingImageReview(false);
    }
  }

  async function handleFinalApproval(approved: boolean) {
    setApprovingFinal(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/approve-final`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      if (res.ok) await refresh();
    } finally {
      setApprovingFinal(false);
    }
  }

  async function handleSelectVariant(unitNumber: number, selectedIndex: number) {
    setSelectingVariant(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/select-variant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitNumber, selectedIndex }),
      });
      if (res.ok) await refresh();
    } finally {
      setSelectingVariant(false);
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

  async function handleSubmitFeedback() {
    setSubmittingFeedback(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: feedbackRating ? Number(feedbackRating) : null,
          comment: feedbackComment,
        }),
      });
      if (res.ok) {
        setFeedbackRating("");
        setFeedbackComment("");
        await refresh();
      }
    } finally {
      setSubmittingFeedback(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{project.name}</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {project.level ? `${project.level} · ` : ""}
        {upload ? `Kaynak: ${upload.filename}` : ""}
      </p>

      <div className="mt-8">
        <PipelineStageTracker
          status={run?.status ?? "pending"}
          currentStage={run?.currentStage ?? null}
          errorMessage={run?.errorMessage}
          unitCount={unitCount}
          tokenUsageTotal={run?.tokenUsage?.total}
          modelVersion={run?.modelVersion}
          flaggedImageCount={flaggedImageCount}
          flaggedOriginalityCount={flaggedOriginalityCount}
          unitProgress={unitProgress}
        />
      </div>

      {coherenceReview && (
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Kitap Tutarlılık Raporu</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                coherenceReview.passed
                  ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {coherenceReview.passed ? "Sorun bulunamadı" : `${coherenceReview.issues.length} not (bilgilendirici)`}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-zinc-600 dark:text-zinc-400 sm:grid-cols-4">
            <div>
              <dt>Zorluk ilerlemesi</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">{coherenceReview.difficultyProgressionScore}/100</dd>
            </div>
            <div>
              <dt>Kelime tekrarı</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">{coherenceReview.vocabularyRepetitionScore}/100</dd>
            </div>
            <div>
              <dt>Gramer sıralaması</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">{coherenceReview.grammarSequencingScore}/100</dd>
            </div>
            <div>
              <dt>Tematik tutarlılık</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">{coherenceReview.thematicConsistencyScore}/100</dd>
            </div>
          </dl>
          {coherenceReview.issues.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 border-t border-zinc-100 pt-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              {coherenceReview.issues.map((issue, i) => (
                <li key={i}>
                  <span
                    className={`mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      issue.severity === "high"
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        : issue.severity === "medium"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    Ünite {issue.unitNumber} · {issue.category}
                  </span>
                  {issue.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!!flaggedOriginalityChecks?.length && (
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Orijinallik Raporu</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {flaggedOriginalityChecks.length} sayfa işaretlendi (bilgilendirici)
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Bu bir hukuki değerlendirme değildir — kaynak kitapla yüksek metin benzerliği tespit edilen sayfalar,
            manuel incelemeniz için burada listeleniyor.
          </p>
          <ul className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            {flaggedOriginalityChecks.map((check, i) => (
              <li key={i}>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    Ünite {check.unitNumber} · Sayfa {check.pageNumber}
                  </span>
                  <span>n-gram örtüşme: {(check.ngramOverlapScore * 100).toFixed(0)}%</span>
                  {check.llmAssessment && (
                    <span
                      className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        check.llmAssessment.similarityLevel === "high"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          : check.llmAssessment.similarityLevel === "medium"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                      }`}
                    >
                      İkinci görüş: {check.llmAssessment.similarityLevel}
                    </span>
                  )}
                </div>
                {check.llmAssessment && (
                  <div className="mt-1">
                    <p>{check.llmAssessment.rationale}</p>
                    {check.llmAssessment.concerningPhrases.length > 0 && (
                      <ul className="mt-1 list-disc pl-4">
                        {check.llmAssessment.concerningPhrases.map((phrase, j) => (
                          <li key={j} className="italic">
                            &quot;{phrase}&quot;
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!totalTokens && (
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Maliyet ve Kullanım</h2>
          <ul className="mt-3 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            {tokenBreakdown.map(([key, tokens]) => (
              <li key={key} className="flex items-center justify-between">
                <span>{STEP_LABELS[key] ?? key}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{tokens.toLocaleString("tr-TR")}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Yaklaşık metin ({run?.modelVersion ?? "Sonnet 5"}) maliyeti: ~${estimatedCostMin.toFixed(3)}–$
            {estimatedCostMax.toFixed(3)}
            <span className="block text-[10px] text-zinc-400">
              (girdi/çıktı token&apos;ları ayrı tutulmadığı için kesin değer değil, olası aralık; taslak modda
              inceleme/dizelge adımları yine de Sonnet 5 üzerinden faturalanır)
            </span>
          </p>
          {(imageCount > 0 || audioCount > 0) && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {imageCount > 0 && `${imageCount} görsel üretildi (Imagen)`}
              {imageCount > 0 && audioCount > 0 && " · "}
              {audioCount > 0 && `${audioCount} ses klibi üretildi (TTS)`}
              <span className="block text-[10px] text-zinc-400">
                bu ikisinin maliyeti token bazlı değil, buraya dahil edilmedi
              </span>
            </p>
          )}
        </div>
      )}

      {run?.status === "awaiting_outline_approval" && outlineData && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Üretime başlamadan önce dizelgeyi onayla
            <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
              ({formatElapsedTurkish(new Date(run.updatedAt))} bekliyor)
            </span>
          </h2>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            {outlineData.bookTitle} · {outlineData.subject}
          </p>
          {outlineData.declaredLevelAlignment && !outlineData.declaredLevelAlignment.matches && (
            <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              <p className="font-semibold">Seviye uyuşmazlığı: proje oluştururken belirttiğin seviye ile kaynak materyalin gerçek seviyesi eşleşmiyor olabilir.</p>
              <p className="mt-1">{outlineData.declaredLevelAlignment.note}</p>
            </div>
          )}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {outlineData.units.map((u) => (
              <div
                key={u.number}
                className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {u.number}. {u.title}
                  </span>
                  <span className="text-xs text-zinc-500">{u.level}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="border-transparent bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    İçerik
                  </Badge>
                  <Badge variant="outline" className="border-transparent bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    Görsel
                  </Badge>
                  <Badge variant="outline" className="border-transparent bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    Ses
                  </Badge>
                  <Badge variant="outline" className="border-transparent bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    İnceleme
                  </Badge>
                </div>
              </div>
            ))}
          </div>
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

      {run?.status === "awaiting_variant_selection" && run.pendingVariants && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Ünite {run.pendingVariants.unitNumber} için bir varyant seç
            <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
              ({formatElapsedTurkish(new Date(run.updatedAt))} bekliyor)
            </span>
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {run.pendingVariants.variants.map((v) => {
              const firstBlock = v.unit.studentBookPages[0]?.blocks[0];
              return (
                <div
                  key={v.index}
                  className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Varyant {v.index + 1}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        v.passed
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {v.passed ? "Kontrolden geçti" : `${v.issues.length} not`}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {v.unit.studentBookPages.length} Student Book + {v.unit.workbookPages.length} Workbook sayfası
                  </p>
                  {firstBlock && (
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      <p className="font-medium">{firstBlock.heading}</p>
                      <p className="mt-0.5 line-clamp-3">{firstBlock.body}</p>
                    </div>
                  )}
                  {v.issues.length > 0 && (
                    <ul className="list-disc pl-4 text-[11px] text-amber-800 dark:text-amber-300">
                      {v.issues.slice(0, 3).map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  )}
                  <button
                    onClick={() => handleSelectVariant(run.pendingVariants!.unitNumber, v.index)}
                    disabled={selectingVariant}
                    className="mt-1 h-8 rounded-full bg-amber-600 px-3 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Bunu seç
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {run?.status === "awaiting_content_approval" && pendingContentApproval && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Görsel üretimine geçmeden önce tüm ünitelerin içeriğini onayla
            <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
              ({formatElapsedTurkish(new Date(run.updatedAt))} bekliyor)
            </span>
          </h2>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Gerçek yayıncılıktaki &quot;copyedit bitmeden tasarım başlamaz&quot; kuralıyla aynı mantık - metin burada
            onaylanmadan hiçbir görsel üretilmiyor. Bir üniteye özel değişiklik istersen aşağıya not düş - o ünite
            geri bildiriminle yeniden üretilip tekrar onayına sunulur, diğerleri olduğu gibi onaylanmış sayılır.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {pendingContentApproval.map((unit) => {
              const firstBlock = unit.studentBookPages[0]?.blocks[0];
              return (
                <div
                  key={unit.unitNumber}
                  className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Ünite {unit.unitNumber}: {unit.title}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {unit.studentBookPages.length} Student Book + {unit.workbookPages.length} Workbook sayfası
                  </p>
                  {firstBlock && (
                    <div className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                      <p className="font-medium">{firstBlock.heading}</p>
                      <p className="mt-0.5 line-clamp-3">{firstBlock.body}</p>
                    </div>
                  )}
                  <textarea
                    value={unitChangeComments[unit.unitNumber] ?? ""}
                    onChange={(e) =>
                      setUnitChangeComments((prev) => ({ ...prev, [unit.unitNumber]: e.target.value }))
                    }
                    rows={2}
                    placeholder="Bu üniteye değişiklik iste (opsiyonel)"
                    className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => handleContentApproval(true)}
              disabled={approvingContent}
              className="h-9 rounded-full bg-amber-600 px-4 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {approvingContent
                ? "Gönderiliyor…"
                : Object.values(unitChangeComments).some((c) => c.trim())
                  ? "Değişiklik isteklerini gönder"
                  : "Onayla, görsellere geç"}
            </button>
            <button
              onClick={() => handleContentApproval(false)}
              disabled={approvingContent}
              className="h-9 rounded-full border border-zinc-300 px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Tümünü reddet (üretimi iptal et)
            </button>
          </div>
        </div>
      )}

      {run?.status === "awaiting_image_review" && pendingImageReview && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Otomatik kalite kontrolünden geçemeyen görseller
            <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
              ({formatElapsedTurkish(new Date(run.updatedAt))} bekliyor)
            </span>
          </h2>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Bu görseller birden fazla otomatik denemeden sonra hâlâ işaretli. Her biri için kabul et ya da yeniden
            üret seç (belirtmezsen kabul edilmiş sayılır).
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pendingImageReview.map((img) => {
              const key = `${img.unitNumber}:${img.pageNumber}`;
              const decision = imageDecisions[key] ?? "accept";
              return (
                <div
                  key={key}
                  className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image */}
                  <img src={img.imageUrl} alt="" className="max-h-40 w-full rounded-md object-cover" />
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Ünite {img.unitNumber} · Sayfa {img.pageNumber}
                  </p>
                  {img.issues.length > 0 && (
                    <ul className="list-disc pl-4 text-[11px] text-amber-800 dark:text-amber-300">
                      {img.issues.slice(0, 3).map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setImageDecisions((prev) => ({ ...prev, [key]: "accept" }))}
                      className={`h-8 flex-1 rounded-full px-3 text-xs font-medium ${
                        decision === "accept"
                          ? "bg-green-600 text-white"
                          : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Kabul et
                    </button>
                    <button
                      onClick={() => setImageDecisions((prev) => ({ ...prev, [key]: "regenerate" }))}
                      className={`h-8 flex-1 rounded-full px-3 text-xs font-medium ${
                        decision === "regenerate"
                          ? "bg-amber-600 text-white"
                          : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Yeniden üret
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={handleImageReviewSubmit}
            disabled={submittingImageReview}
            className="mt-4 h-9 rounded-full bg-amber-600 px-4 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {submittingImageReview ? "Gönderiliyor…" : "Kararları gönder"}
          </button>
        </div>
      )}

      {run?.status === "awaiting_final_approval" && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Nihai onay - kitaplar henüz derlenmedi
            <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
              ({formatElapsedTurkish(new Date(run.updatedAt))} bekliyor)
            </span>
          </h2>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Tüm içerik, görsel ve tutarlılık kontrolleri tamamlandı. Onaylarsan kitaplar (PDF/EPUB/LMS) derlenip
            &quot;tamamlandı&quot; olarak işaretlenecek - reddedersen üretim durur, hiçbir dosya oluşmaz.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => handleFinalApproval(true)}
              disabled={approvingFinal}
              className="h-9 rounded-full bg-amber-600 px-4 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {approvingFinal ? "Gönderiliyor…" : "Onayla ve derle"}
            </button>
            <button
              onClick={() => handleFinalApproval(false)}
              disabled={approvingFinal}
              className="h-9 rounded-full border border-zinc-300 px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Değişiklik iste
            </button>
          </div>
        </div>
      )}

      {run?.status === "changes_requested" && (
        <div className="mt-4 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Değişiklik istendi, kitaplar derlenmedi.</p>
          <p className="mt-1 text-xs text-zinc-500">
            Bu run&apos;ın tüm içerik/görsel verisi hâlâ duruyor - yeniden üretmek için aşağıdaki &quot;Yeniden
            çalıştır&quot; seçeneğini kullanabilirsin.
          </p>
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

      {run?.status === "done" && (
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Öğretmen geri bildirimi</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Bu geri bildirim şu an sadece kaydediliyor; gelecekte üretim kalitesini iyileştirmek için kullanılacak.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <select
              value={feedbackRating}
              onChange={(e) => setFeedbackRating(e.target.value)}
              className="h-9 w-40 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Puan (opsiyonel)</option>
              <option value="1">1 - Çok zayıf</option>
              <option value="2">2 - Zayıf</option>
              <option value="3">3 - Orta</option>
              <option value="4">4 - İyi</option>
              <option value="5">5 - Mükemmel</option>
            </select>
            <textarea
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              rows={3}
              placeholder="Sınıfta nasıl gitti, neyi değiştirmek isterdin?"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              onClick={handleSubmitFeedback}
              disabled={submittingFeedback || (!feedbackRating && !feedbackComment.trim())}
              className="h-9 w-fit rounded-full bg-zinc-950 px-4 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {submittingFeedback ? "Gönderiliyor…" : "Gönder"}
            </button>
          </div>
          {!!feedback?.length && (
            <ul className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              {feedback.map((f) => (
                <li key={f.id} className="text-xs text-zinc-600 dark:text-zinc-400">
                  {f.rating != null && <span className="font-medium text-zinc-900 dark:text-zinc-100">{f.rating}/5 · </span>}
                  {f.comment}
                </li>
              ))}
            </ul>
          )}
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
          {books.map((book) => {
            const audioTracks = audioTracksFor(book);
            return (
            <div key={book.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {BOOK_TYPE_LABELS[book.bookType] ?? book.bookType}
                </span>
                <div className="flex gap-2">
                  <Link
                    href={`/projects/${projectId}/read/${book.bookType}`}
                    className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Etkileşimli oku
                  </Link>
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
                  {book.epubBlobUrl && (
                    <a
                      href={book.epubBlobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      EPUB indir
                    </a>
                  )}
                  <a
                    href={`/api/projects/${projectId}/export/common-cartridge?bookType=${book.bookType}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Moodle/Canvas'a yüklenebilir IMS Common Cartridge paketi"
                    className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    LMS paketi indir
                  </a>
                  <a
                    href={`/api/projects/${projectId}/export/docx?bookType=${book.bookType}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Word/Google Docs'ta düzenlenebilir .docx"
                    className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    DOCX indir
                  </a>
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
              {audioTracks.length > 0 && (
                <div className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Dinleme sesleri</p>
                  {audioTracks.map((track, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <span className="text-xs text-zinc-500">
                        Ünite {track.unitNumber} · {track.blockRef}
                      </span>
                      <audio controls src={track.audioUrl} className="h-8 w-full" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
