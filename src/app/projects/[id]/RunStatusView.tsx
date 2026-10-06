"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { upload as uploadToBlob } from "@vercel/blob/client";
import { toast } from "sonner";
import { networkErrorMessage, responseErrorMessage } from "@/lib/api-error";
import { BOOK_TYPE_LABELS, formatElapsedTurkish } from "@/lib/run-status";
import type { UnitProgress } from "@/lib/unit-progress";
import { PipelineStageTracker } from "./PipelineStageTracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkPrintReadiness } from "@/lib/print-readiness";
import { PERSONA_LABELS, type PersonaReviewSummary } from "@/lib/personas";

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
// Faz "Versiyonlama/diff": previousVersions holds the pre-regeneration
// version of any unit that was just rewritten from editorial feedback,
// keyed by unit number - only present for units touched since the last
// round, so a reviewer can see exactly what changed instead of re-reading
// the whole unit.
export type PendingContentApproval = {
  round: number;
  units: PendingContentUnit[];
  previousVersions?: Record<number, PendingContentUnit>;
} | null;

export type PendingImageReview = { unitNumber: number; pageNumber: number; imageUrl: string; issues: string[] };

type Run = {
  id: string;
  status: string;
  currentStage: string | null;
  errorMessage: string | null;
  updatedAt: string;
  modelVersion?: string | null;
  tokenUsage?: Record<string, number> | null;
  costUsage?: Record<string, number> | null;
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
  project: { id: string; name: string; level: string | null; isbn: string | null };
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
  // Faz "ISBN/baskıya hazırlık": server-fetched (see page.tsx) so there's no
  // client-side cross-origin fetch to the Blob host.
  coverDimensions?: { width: number; height: number } | null;
  // Faz "Onay Zinciri Görünürlüğü": zaten kalıcı olan unitReviews'dan türetilen
  // persona rozetleri (bkz. src/lib/personas.ts) - içerik onayı ekranında
  // her ünitenin altında "✓ Dil Denetçisi" gibi sign-off'lar göstermek için.
  unitReviewSummary?: PersonaReviewSummary[];
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
  // "Gateway kredisini idareli kullanma" (2026-09-23): draft mode's backing
  // model (model.ts's BOOK_PIPELINE_MODEL_DRAFT) - confirmed live against
  // the Vercel AI Gateway catalog. Without an entry here, a draft run's
  // cost estimate would silently fall back to Sonnet 5's much higher rate
  // (DEFAULT_PRICING below) and wildly overstate its actual cost.
  // gpt-5-nano was tried first and replaced with gemini-2.5-flash-lite
  // after a live run found gpt-5-nano structurally incompatible with this
  // app's discriminated-union schemas (see model.ts's comment) - kept here
  // too in case a future schema change makes it usable again.
  "openai/gpt-5-nano": { input: 0.05, output: 0.4 },
  "google/gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
};
const DEFAULT_PRICING = MODEL_PRICING_PER_MILLION["anthropic/claude-sonnet-5"];

// Faz "Bütçe kontrolü - ön tahmin" (2026-09-20, ROADMAP.md): a rough,
// honestly-labeled estimate for the outline-approval screen, computed from
// typical observed unit sizes in this pipeline (mirrored + complementary +
// optional teacher/test sides + 4 review calls per unit) - not measured
// live per-run, so it's presented as a wide range, same spirit as the
// existing post-hoc cost estimate's "yaklaşık, kesin değer değil" framing.
const ESTIMATED_TOKENS_PER_UNIT = 30_000;

export function RunStatusView({ projectId, initial }: { projectId: string; initial: ProjectData }) {
  const [data, setData] = useState(initial);
  const [showMarkdown, setShowMarkdown] = useState<Record<string, boolean>>({});
  const [rerunUnitLimit, setRerunUnitLimit] = useState("");
  const [rerunning, setRerunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalUnitLimit, setApprovalUnitLimit] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [submittingLogo, setSubmittingLogo] = useState(false);
  const [assembleTypes, setAssembleTypes] = useState<Set<string>>(new Set());
  const [assembling, setAssembling] = useState(false);
  const [selectingVariant, setSelectingVariant] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<string>("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [approvingContent, setApprovingContent] = useState(false);
  const [unitChangeComments, setUnitChangeComments] = useState<Record<number, string>>({});
  const [diffOpenFor, setDiffOpenFor] = useState<Record<number, boolean>>({});
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
    coverDimensions,
  } = data;

  const printReadiness = checkPrintReadiness({
    isbn: project.isbn,
    coverWidthPx: coverDimensions?.width,
    coverHeightPx: coverDimensions?.height,
  });

  const tokenBreakdown = Object.entries(run?.tokenUsage ?? {})
    .filter(([key]) => key !== "total")
    .sort((a, b) => b[1] - a[1]);
  const totalTokens = run?.tokenUsage?.total ?? 0;
  const pricing = (run?.modelVersion && MODEL_PRICING_PER_MILLION[run.modelVersion]) || DEFAULT_PRICING;
  // QA fix (2026-10-06): free-mode runs (AI_PROVIDER_MODE=free) store a bare
  // provider model id like "gemini-3.1-flash-lite" (no "vendor/" Gateway
  // prefix) and are billed nothing, but the card priced them at Sonnet 5
  // rates and labelled their Cloudflare images "GPT Image".
  const isFreeTierRun = !!run?.modelVersion && !run.modelVersion.includes("/");
  const estimatedCostMin = (totalTokens / 1_000_000) * pricing.input;
  const estimatedCostMax = (totalTokens / 1_000_000) * pricing.output;
  const imageCostUsd = run?.costUsage?.image ?? 0;
  const audioCostUsd = run?.costUsage?.audio ?? 0;
  const hasRealCost = imageCostUsd > 0 || audioCostUsd > 0;
  const imageCount = (run?.coverImageUrl ? 1 : 0) + Object.keys(run?.pageImageUrls ?? {}).length;
  const audioCount = books.reduce((sum, b) => sum + audioTracksFor(b).length, 0);
  const outlineData = outline?.outline?.outline;
  const improvementPlan = outline?.outline?.improvementPlan;
  const unitCount = outlineData?.units?.length;
  const estimatedPreRunCostMin = unitCount ? ((unitCount * ESTIMATED_TOKENS_PER_UNIT) / 1_000_000) * pricing.input : 0;
  const estimatedPreRunCostMax = unitCount ? ((unitCount * ESTIMATED_TOKENS_PER_UNIT) / 1_000_000) * pricing.output : 0;
  const pendingContentApproval = run?.pendingContentApproval?.units;
  const previousUnitVersions = run?.pendingContentApproval?.previousVersions;
  const pendingImageReview = run?.pendingImageReview;
  const unitReviewSummary = data.unitReviewSummary ?? [];

  // Faz "Onay butonu geri bildirimi": tüm onay/gönder aksiyonları zaten
  // buton metnini "Gönderiliyor…" yapıp kendini disable ediyordu, ama bu
  // görsel olarak yeterince belirgin değildi - kullanıcı isteğin gidip
  // gitmediğinden emin olamayıp butona tekrar tekrar basıyordu. Bu genel,
  // göz ardı edilemeyecek bir üst-bant gösterge ekliyor; her ayrı "…ing"
  // state'ini tek bir yerde toplar, böylece yeni bir onay adımı eklenince
  // unutulmaz.
  const anyActionPending =
    rerunning ||
    approving ||
    assembling ||
    selectingVariant ||
    submittingFeedback ||
    approvingContent ||
    submittingImageReview ||
    approvingFinal ||
    submittingLogo;

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
      else toast.error(await responseErrorMessage(res));
    } catch (err) {
      toast.error(networkErrorMessage(err));
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
      else toast.error(await responseErrorMessage(res));
    } catch (err) {
      toast.error(networkErrorMessage(err));
    } finally {
      setApproving(false);
    }
  }

  async function handleLogoUpload() {
    if (!logoFile) return;
    setSubmittingLogo(true);
    try {
      const blob = await uploadToBlob(logoFile.name, logoFile, {
        access: "public",
        handleUploadUrl: "/api/blob/upload-logo",
        contentType: logoFile.type,
      });
      const res = await fetch(`/api/projects/${projectId}/approve-logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: blob.url, skip: false }),
      });
      if (res.ok) {
        setLogoFile(null);
        setLogoPreviewUrl(null);
        await refresh();
      } else {
        toast.error(await responseErrorMessage(res));
      }
    } catch (err) {
      toast.error(networkErrorMessage(err));
    } finally {
      setSubmittingLogo(false);
    }
  }

  async function handleLogoSkip() {
    setSubmittingLogo(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/approve-logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: null, skip: true }),
      });
      if (res.ok) await refresh();
      else toast.error(await responseErrorMessage(res));
    } catch (err) {
      toast.error(networkErrorMessage(err));
    } finally {
      setSubmittingLogo(false);
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
      } else {
        toast.error(await responseErrorMessage(res));
      }
    } catch (err) {
      toast.error(networkErrorMessage(err));
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
      } else {
        toast.error(await responseErrorMessage(res));
      }
    } catch (err) {
      toast.error(networkErrorMessage(err));
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
      else toast.error(await responseErrorMessage(res));
    } catch (err) {
      toast.error(networkErrorMessage(err));
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
      else toast.error(await responseErrorMessage(res));
    } catch (err) {
      toast.error(networkErrorMessage(err));
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
      } else {
        toast.error(await responseErrorMessage(res));
      }
    } catch (err) {
      toast.error(networkErrorMessage(err));
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
      } else {
        toast.error(await responseErrorMessage(res));
      }
    } catch (err) {
      toast.error(networkErrorMessage(err));
    } finally {
      setSubmittingFeedback(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      {anyActionPending && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-card-foreground shadow-lg">
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
              aria-hidden="true"
            />
            İsteğin gönderiliyor, lütfen tekrar tıklamadan bekle…
          </div>
        </div>
      )}
      <h1 className="text-2xl font-semibold text-foreground">{project.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
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
        <div className="mt-4 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Kitap Tutarlılık Raporu <span className="font-normal text-muted-foreground">(Baş Editör)</span>
            </h2>
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
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-4">
            <div>
              <dt>Zorluk ilerlemesi</dt>
              <dd className="font-medium text-foreground">{coherenceReview.difficultyProgressionScore}/100</dd>
            </div>
            <div>
              <dt>Kelime tekrarı</dt>
              <dd className="font-medium text-foreground">{coherenceReview.vocabularyRepetitionScore}/100</dd>
            </div>
            <div>
              <dt>Gramer sıralaması</dt>
              <dd className="font-medium text-foreground">{coherenceReview.grammarSequencingScore}/100</dd>
            </div>
            <div>
              <dt>Tematik tutarlılık</dt>
              <dd className="font-medium text-foreground">{coherenceReview.thematicConsistencyScore}/100</dd>
            </div>
          </dl>
          {coherenceReview.issues.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {coherenceReview.issues.map((issue, i) => (
                <li key={i}>
                  <span
                    className={`mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      issue.severity === "high"
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        : issue.severity === "medium"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-secondary text-secondary-foreground"
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
        <div className="mt-4 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Orijinallik Raporu <span className="font-normal text-muted-foreground">(Özgünlük Denetçisi)</span>
            </h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {flaggedOriginalityChecks.length} sayfa işaretlendi (bilgilendirici)
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Bu bir hukuki değerlendirme değildir — kaynak kitapla yüksek metin benzerliği tespit edilen sayfalar,
            manuel incelemeniz için burada listeleniyor.
          </p>
          <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            {flaggedOriginalityChecks.map((check, i) => (
              <li key={i}>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
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
        <div className="mt-4 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <h2 className="text-sm font-semibold text-foreground">Maliyet ve Kullanım</h2>
          <ul className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
            {tokenBreakdown.map(([key, tokens]) => (
              <li key={key} className="flex items-center justify-between">
                <span>{STEP_LABELS[key] ?? key}</span>
                <span className="font-medium text-foreground">{tokens.toLocaleString("tr-TR")}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            {isFreeTierRun ? (
              <>Metin modeli: {run?.modelVersion} - ücretsiz katman, faturalanmadı.</>
            ) : (
              <>
                Yaklaşık metin ({run?.modelVersion ?? "Sonnet 5"}) maliyeti: ~${estimatedCostMin.toFixed(3)}–$
                {estimatedCostMax.toFixed(3)}
                <span className="block text-[10px] text-muted-foreground/70">
                  (girdi/çıktı token&apos;ları ayrı tutulmadığı için kesin değer değil, olası aralık; taslak modda
                  inceleme/dizelge adımları yine de Sonnet 5 üzerinden faturalanır)
                </span>
              </>
            )}
          </p>
          {(imageCount > 0 || audioCount > 0) && (
            <div className="mt-3 border-t border-border pt-3">
              {imageCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {imageCount} görsel üretildi{isFreeTierRun ? " (ücretsiz katman)" : " (GPT Image)"}{" "}
                  {imageCostUsd > 0 ? (
                    <span className="font-medium text-foreground">~${imageCostUsd.toFixed(3)}</span>
                  ) : (
                    <span className="text-muted-foreground/70">(maliyet bu run için ölçülmedi)</span>
                  )}
                </p>
              )}
              {audioCount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {audioCount} ses klibi üretildi (TTS){" "}
                  {audioCostUsd > 0 ? (
                    <span className="font-medium text-foreground">${audioCostUsd.toFixed(3)}</span>
                  ) : (
                    <span className="text-muted-foreground/70">(maliyet bu run için ölçülmedi)</span>
                  )}
                </p>
              )}
              {hasRealCost && (
                <span className="mt-1 block text-[10px] text-muted-foreground/70">
                  Görsel maliyeti orta-kalite, 1024×1024 için yayınlanmış bir tahmin (gerçek boyut/kaliteye göre
                  değişebilir); ses maliyeti gerçek karakter sayısına göre kesin (tts-1-hd: $30/1M karakter).
                </span>
              )}
            </div>
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
          {!!unitCount && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Tahmini metin üretim maliyeti ({unitCount} ünite): ~${estimatedPreRunCostMin.toFixed(2)}–$
              {estimatedPreRunCostMax.toFixed(2)}
              <span className="block text-[10px] text-amber-600 dark:text-amber-500">
                kaba bir tahmin - gerçek maliyet üretim bitince &quot;Maliyet ve Kullanım&quot; bölümünde görünür; görsel/ses
                dahil değil
              </span>
            </p>
          )}
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
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {u.number}. {u.title}
                  </span>
                  <span className="text-xs text-muted-foreground">{u.level}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">İçerik</Badge>
                  <Badge variant="secondary">Görsel</Badge>
                  <Badge variant="secondary">Ses</Badge>
                  <Badge variant="secondary">İnceleme</Badge>
                </div>
              </div>
            ))}
          </div>
          {improvementPlan?.overallNotes && (
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium">İyileştirme planı: </span>
              {improvementPlan.overallNotes}
            </p>
          )}
          <div className="mt-4 flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-amber-800 dark:text-amber-300">
                Ünite sınırı (opsiyonel, değiştirmek için)
              </label>
              <Input
                type="number"
                min={1}
                value={approvalUnitLimit}
                onChange={(e) => setApprovalUnitLimit(e.target.value)}
                placeholder="Örn. 4"
                className="h-9 w-32"
              />
            </div>
            <Button
              onClick={() => handleApproval(true)}
              disabled={approving}
              size="sm"
              className="h-9 rounded-full bg-amber-600 px-4 text-xs text-white hover:bg-amber-700"
            >
              {approving ? "Gönderiliyor…" : "Onayla ve üret"}
            </Button>
            <Button
              onClick={() => handleApproval(false)}
              disabled={approving}
              variant="outline"
              size="sm"
              className="h-9 rounded-full px-4 text-xs"
            >
              Reddet
            </Button>
          </div>
        </div>
      )}

      {run?.status === "awaiting_logo_upload" && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Kaynak PDF&apos;te bir logo tespit edildi
            <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
              ({formatElapsedTurkish(new Date(run.updatedAt))} bekliyor)
            </span>
          </h2>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Kendi logonuzu yüklerseniz üretilen kitaba yerleştirilir. Yüklemezseniz logo alanı boş bırakılır.
          </p>
          <div className="mt-3 flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-amber-800 dark:text-amber-300">Logo dosyası (opsiyonel)</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setLogoFile(f);
                  setLogoPreviewUrl(f ? URL.createObjectURL(f) : null);
                }}
                className="text-xs"
              />
            </div>
            {logoPreviewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreviewUrl} alt="Logo önizleme" className="h-9 w-9 rounded border border-border object-contain" />
            )}
            <Button
              onClick={handleLogoUpload}
              disabled={submittingLogo || !logoFile}
              size="sm"
              className="h-9 rounded-full bg-amber-600 px-4 text-xs text-white hover:bg-amber-700"
            >
              {submittingLogo ? "Gönderiliyor…" : "Yükle ve devam et"}
            </Button>
            <Button
              onClick={handleLogoSkip}
              disabled={submittingLogo}
              variant="outline"
              size="sm"
              className="h-9 rounded-full px-4 text-xs"
            >
              Logo yok / atla
            </Button>
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
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
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
                  <p className="text-xs text-muted-foreground">
                    {v.unit.studentBookPages.length} Student Book + {v.unit.workbookPages.length} Workbook sayfası
                  </p>
                  {firstBlock && (
                    <div className="text-xs text-muted-foreground">
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
                  <Button
                    onClick={() => handleSelectVariant(run.pendingVariants!.unitNumber, v.index)}
                    disabled={selectingVariant}
                    size="sm"
                    className="mt-1 h-8 rounded-full bg-amber-600 px-3 text-xs text-white hover:bg-amber-700"
                  >
                    Bunu seç
                  </Button>
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
                  className="rounded-lg border border-border bg-card p-3 text-card-foreground"
                >
                  <p className="text-sm font-medium text-foreground">
                    Ünite {unit.unitNumber}: {unit.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {unit.studentBookPages.length} Student Book + {unit.workbookPages.length} Workbook sayfası
                  </p>
                  {firstBlock && (
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      <p className="font-medium">{firstBlock.heading}</p>
                      <p className="mt-0.5 line-clamp-3">{firstBlock.body}</p>
                    </div>
                  )}
                  {/* Faz "Onay Zinciri Görünürlüğü": zaten arka planda çalışan
                      Dil Denetçisi/Seviye Uzmanı/Güvenlik/Baş Editör
                      denetimlerini görünür bir editöryel sign-off olarak
                      gösterir - bkz. src/lib/personas.ts. */}
                  {unitReviewSummary.some((r) => r.unitNumber === unit.unitNumber) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {unitReviewSummary
                        .filter((r) => r.unitNumber === unit.unitNumber)
                        .map((r) => (
                          <span
                            key={r.reviewType}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              r.passed
                                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {r.passed ? "✓" : "⚠"} {PERSONA_LABELS[r.persona]}
                            {!r.passed && r.issueCount > 0 ? ` (${r.issueCount} not)` : ""}
                          </span>
                        ))}
                    </div>
                  )}
                  {previousUnitVersions?.[unit.unitNumber] && (
                    <div className="mt-2">
                      <p className="text-[10px] text-muted-foreground">
                        Bu ünite geri bildirimle yeniden üretildi ve Dil Denetçisi/Seviye Uzmanı/Güvenlik tarafından
                        tekrar kontrol edildi.
                      </p>
                      <button
                        onClick={() =>
                          setDiffOpenFor((prev) => ({ ...prev, [unit.unitNumber]: !prev[unit.unitNumber] }))
                        }
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {diffOpenFor[unit.unitNumber] ? "Önceki sürümü gizle" : "Geri bildirim öncesi sürümle karşılaştır"}
                      </button>
                      {diffOpenFor[unit.unitNumber] &&
                        (() => {
                          const prevBlock = previousUnitVersions[unit.unitNumber].studentBookPages[0]?.blocks[0];
                          return (
                            <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                                <p className="font-semibold">Önceki (değişiklik istenmeden önce)</p>
                                {prevBlock ? (
                                  <>
                                    <p className="mt-0.5 font-medium">{prevBlock.heading}</p>
                                    <p className="mt-0.5 line-clamp-4">{prevBlock.body}</p>
                                  </>
                                ) : (
                                  <p className="mt-0.5 italic">İçerik yok</p>
                                )}
                              </div>
                              <div className="rounded border border-green-200 bg-green-50 p-2 text-xs text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
                                <p className="font-semibold">Şimdiki (yeniden üretildi)</p>
                                {firstBlock ? (
                                  <>
                                    <p className="mt-0.5 font-medium">{firstBlock.heading}</p>
                                    <p className="mt-0.5 line-clamp-4">{firstBlock.body}</p>
                                  </>
                                ) : (
                                  <p className="mt-0.5 italic">İçerik yok</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                    </div>
                  )}
                  <textarea
                    value={unitChangeComments[unit.unitNumber] ?? ""}
                    onChange={(e) =>
                      setUnitChangeComments((prev) => ({ ...prev, [unit.unitNumber]: e.target.value }))
                    }
                    rows={2}
                    placeholder="Bu üniteye değişiklik iste (opsiyonel)"
                    className="mt-2 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex gap-3">
            <Button
              onClick={() => handleContentApproval(true)}
              disabled={approvingContent}
              size="sm"
              className="h-9 rounded-full bg-amber-600 px-4 text-xs text-white hover:bg-amber-700"
            >
              {approvingContent
                ? "Gönderiliyor…"
                : Object.values(unitChangeComments).some((c) => c.trim())
                  ? "Değişiklik isteklerini gönder"
                  : "Onayla, görsellere geç"}
            </Button>
            <Button
              onClick={() => handleContentApproval(false)}
              disabled={approvingContent}
              variant="outline"
              size="sm"
              className="h-9 rounded-full px-4 text-xs"
            >
              Tümünü reddet (üretimi iptal et)
            </Button>
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
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Vercel Blob) generated image */}
                  <img src={img.imageUrl} alt="" className="max-h-40 w-full rounded-md object-cover" />
                  <p className="text-xs font-medium text-foreground">
                    Ünite {img.unitNumber} · Sayfa {img.pageNumber}
                  </p>
                  {img.issues.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Sanat Yönetmeni tarafından işaretlendi (otomatik 3 deneme sonrası)
                      </p>
                      <ul className="list-disc pl-4 text-[11px] text-amber-800 dark:text-amber-300">
                        {img.issues.slice(0, 3).map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setImageDecisions((prev) => ({ ...prev, [key]: "accept" }))}
                      className={`h-8 flex-1 rounded-full px-3 text-xs font-medium ${
                        decision === "accept"
                          ? "bg-green-600 text-white"
                          : "border border-border text-foreground hover:bg-accent"
                      }`}
                    >
                      Kabul et
                    </button>
                    <button
                      onClick={() => setImageDecisions((prev) => ({ ...prev, [key]: "regenerate" }))}
                      className={`h-8 flex-1 rounded-full px-3 text-xs font-medium ${
                        decision === "regenerate"
                          ? "bg-amber-600 text-white"
                          : "border border-border text-foreground hover:bg-accent"
                      }`}
                    >
                      Yeniden üret
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            onClick={handleImageReviewSubmit}
            disabled={submittingImageReview}
            size="sm"
            className="mt-4 h-9 rounded-full bg-amber-600 px-4 text-xs text-white hover:bg-amber-700"
          >
            {submittingImageReview ? "Gönderiliyor…" : "Kararları gönder"}
          </Button>
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
          <p className="mt-1 text-[10px] text-muted-foreground">Yayın Müdürü sıfatıyla nihai onay</p>
          <div className="mt-4 flex gap-3">
            <Button
              onClick={() => handleFinalApproval(true)}
              disabled={approvingFinal}
              size="sm"
              className="h-9 rounded-full bg-amber-600 px-4 text-xs text-white hover:bg-amber-700"
            >
              {approvingFinal ? "Gönderiliyor…" : "Onayla ve derle"}
            </Button>
            <Button
              onClick={() => handleFinalApproval(false)}
              disabled={approvingFinal}
              variant="outline"
              size="sm"
              className="h-9 rounded-full px-4 text-xs"
            >
              Değişiklik iste
            </Button>
          </div>
        </div>
      )}

      {run?.status === "changes_requested" && (
        <div className="mt-4 rounded-lg border border-dashed border-border p-4">
          <p className="text-sm font-medium text-foreground">Değişiklik istendi, kitaplar derlenmedi.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Bu run&apos;ın tüm içerik/görsel verisi hâlâ duruyor - yeniden üretmek için aşağıdaki &quot;Yeniden
            çalıştır&quot; seçeneğini kullanabilirsin.
          </p>
        </div>
      )}

      {(run?.status === "done" || run?.status === "failed") && (
        <div className="mt-4 rounded-lg border border-dashed border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            AI çağrısı yapmadan, mevcut içerikten ek kitap tipi derle
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {Object.entries(BOOK_TYPE_LABELS).map(([type, label]) => (
              <label key={type} className="flex items-center gap-1.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={assembleTypes.has(type)}
                  onChange={() => toggleAssembleType(type)}
                  className="accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
          <Button
            onClick={handleAssembleOnly}
            disabled={assembling || !assembleTypes.size}
            size="sm"
            className="mt-3 h-9 rounded-full px-4 text-xs"
          >
            {assembling ? "Başlatılıyor…" : "Seçilenleri derle"}
          </Button>
        </div>
      )}

      {run?.status === "done" && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <h2 className="text-sm font-semibold text-foreground">Öğretmen geri bildirimi</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Bu geri bildirim şu an sadece kaydediliyor; gelecekte üretim kalitesini iyileştirmek için kullanılacak.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <select
              value={feedbackRating}
              onChange={(e) => setFeedbackRating(e.target.value)}
              className="h-9 w-40 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
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
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <Button
              onClick={handleSubmitFeedback}
              disabled={submittingFeedback || (!feedbackRating && !feedbackComment.trim())}
              size="sm"
              className="h-9 w-fit rounded-full px-4 text-xs"
            >
              {submittingFeedback ? "Gönderiliyor…" : "Gönder"}
            </Button>
          </div>
          {!!feedback?.length && (
            <ul className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
              {feedback.map((f) => (
                <li key={f.id} className="text-xs text-muted-foreground">
                  {f.rating != null && <span className="font-medium text-foreground">{f.rating}/5 · </span>}
                  {f.comment}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {upload && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Ünite sınırıyla yeniden çalıştır (opsiyonel)
              </label>
              <Input
                type="number"
                min={1}
                value={rerunUnitLimit}
                onChange={(e) => setRerunUnitLimit(e.target.value)}
                placeholder="Örn. 4"
                className="h-9 w-32"
              />
            </div>
            <Button onClick={handleRerun} disabled={rerunning} size="sm" className="h-9 rounded-full px-4 text-xs">
              {rerunning ? "Başlatılıyor…" : "Yeniden çalıştır"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Önceki analiz (sayfa haritalama + dizelge) ve daha önce başarıyla üretilmiş üniteler otomatik olarak
            yeniden kullanılır - bu adımlar için ek ücret alınmaz, sadece kalan/başarısız kısımlar yeniden çalışır.
          </p>
        </div>
      )}

      {books.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Baskıya Hazırlık</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                printReadiness.issues.length === 0
                  ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {printReadiness.issues.length === 0 ? "Hazır" : `${printReadiness.issues.length} sorun`}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <dt>ISBN</dt>
              <dd className="font-medium text-foreground">
                {printReadiness.isbn.provided
                  ? printReadiness.isbn.valid
                    ? project.isbn
                    : `${project.isbn} (geçersiz)`
                  : "Girilmemiş"}
              </dd>
            </div>
            <div>
              <dt>Kapak çözünürlüğü/oranı</dt>
              <dd className="font-medium text-foreground">
                {printReadiness.cover
                  ? `${printReadiness.cover.widthPx}×${printReadiness.cover.heightPx}px (${
                      { portrait: "dikey", landscape: "yatay", square: "kare" }[printReadiness.cover.orientation]
                    })`
                  : "Kapak henüz yok"}
              </dd>
            </div>
          </dl>
          {printReadiness.issues.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {printReadiness.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {books.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {/* Dizilim/Sayfa Düzeni'ne giriş artık kalıcı proje sidebar'ından
              (AppSidebar.tsx'in "Bu proje" grubu) yapılıyor - eski iki
              bağlamsal buton kaldırıldı. Sayfa Düzeni ayrıca Dizilim'e
              taşındı (bkz. ArrangementEditor.tsx'in sayfa konumlandırma
              modu), ayrı bir editör olarak kalmadı. */}
          <h2 className="text-lg font-medium text-foreground">Üretilen kitaplar</h2>
          {books.map((book) => {
            const audioTracks = audioTracksFor(book);
            return (
            <div key={book.id} className="rounded-xl border border-border bg-card p-4 text-card-foreground">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {BOOK_TYPE_LABELS[book.bookType] ?? book.bookType}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="rounded-full px-3 text-xs" render={<Link href={`/projects/${projectId}/read/${book.bookType}`} />}>
                    Etkileşimli oku
                  </Button>
                  {book.pdfBlobUrl && (
                    <Button size="sm" className="rounded-full px-3 text-xs" render={<a href={book.pdfBlobUrl} target="_blank" rel="noopener noreferrer" />}>
                      PDF indir
                    </Button>
                  )}
                  {book.epubBlobUrl && (
                    <Button variant="outline" size="sm" className="rounded-full px-3 text-xs" render={<a href={book.epubBlobUrl} target="_blank" rel="noopener noreferrer" />}>
                      EPUB indir
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full px-3 text-xs"
                    render={
                      <a
                        href={`/api/projects/${projectId}/export/common-cartridge?bookType=${book.bookType}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Moodle/Canvas'a yüklenebilir IMS Common Cartridge paketi"
                      />
                    }
                  >
                    LMS paketi indir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full px-3 text-xs"
                    render={
                      <a
                        href={`/api/projects/${projectId}/export/docx?bookType=${book.bookType}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Word/Google Docs'ta düzenlenebilir .docx"
                      />
                    }
                  >
                    DOCX indir
                  </Button>
                  {book.markdown && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full px-3 text-xs"
                      onClick={() =>
                        setShowMarkdown((prev) => ({ ...prev, [book.id]: !prev[book.id] }))
                      }
                    >
                      {showMarkdown[book.id] ? "Önizlemeyi gizle" : "Önizle"}
                    </Button>
                  )}
                </div>
              </div>
              {showMarkdown[book.id] && book.markdown && (
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs text-foreground">
                  {book.markdown}
                </pre>
              )}
              {audioTracks.length > 0 && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Dinleme sesleri</p>
                  {audioTracks.map((track, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
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
