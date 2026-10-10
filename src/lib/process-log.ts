import { PERSONA_LABELS, REVIEW_TYPE_PERSONA, type PersonaKey, type ReviewType } from "@/lib/personas";
import { STATUS_LABELS } from "@/lib/run-status";
import { agentForStatus, officeAgents, type OfficeAgentState } from "@/lib/agent-office";

// Süreç Günlüğü: one readable story of a run, built from what is already
// recorded - the status/decision history (run_events) and every agent's
// own records (unit, image and page-design reviews). Answers "where are
// we, who did what, what did they find, how long did it take, and what is
// waiting for me". Pure, so it's unit-testable and runs server-side.

export type LogActor = PersonaKey | "sen";
export type LogTone = "info" | "ok" | "warn" | "fail" | "human";

export type ProcessEntry = {
  at: string;
  actor: LogActor;
  actorLabel: string;
  tone: LogTone;
  title: string;
  details?: string[];
};

export type StageTiming = { status: string; label: string; actor: LogActor | null; actorLabel: string; ms: number; human: boolean };

export type AgentCard = {
  key: PersonaKey;
  label: string;
  state: OfficeAgentState;
  headline: string;
};

export type ProcessLog = {
  now: { actor: LogActor | null; state: OfficeAgentState | null; actorLabel: string; text: string; waitingForYou: boolean; since: string | null };
  agents: AgentCard[];
  timeline: ProcessEntry[];
  timings: StageTiming[];
  machineMs: number;
  humanMs: number;
};

type EventIn = { kind: string; status: string; message: string | null; createdAt: Date | string };
type UnitReviewIn = { unitNumber: number; reviewType: string; passed: boolean; issues: string[]; createdAt: Date | string };
type ImageReviewIn = { unitNumber: number | null; pageNumber: number | null; passed: boolean; issues: string[]; attempt: number; createdAt: Date | string };
type DesignReviewIn = { round: number; bookType: string; score: number; pageCount: number; appliedFix: string | null; createdAt: Date | string };

const BOOK_LABEL: Record<string, string> = {
  student_book: "Student Book",
  workbook: "Workbook",
  teacher_book: "Teacher's Book",
  test_booklet: "Test Booklet",
};

const iso = (d: Date | string) => (typeof d === "string" ? new Date(d) : d).toISOString();
const ms = (d: Date | string) => (typeof d === "string" ? new Date(d) : d).getTime();
const label = (actor: LogActor) => (actor === "sen" ? "Sen" : PERSONA_LABELS[actor]);
const unitName = (n: number) => (n >= 90000 ? (n === 90001 ? "Ara sınav" : "Final sınavı") : `Ünite ${n}`);

export function formatDuration(totalMs: number): string {
  const s = Math.round(totalMs / 1000);
  if (s < 60) return `${s} sn`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk ${s % 60} sn`;
  const h = Math.floor(m / 60);
  return `${h} sa ${m % 60} dk`;
}

export function buildProcessLog(input: {
  status: string;
  currentStage: string | null;
  updatedAt: Date | string;
  now?: Date;
  events: EventIn[];
  unitReviews: UnitReviewIn[];
  imageReviews: ImageReviewIn[];
  designReviews: DesignReviewIn[];
  /** Pictures the run has (incl. ones reused from a previous run). */
  pageImageCount?: number;
}): ProcessLog {
  const now = input.now ?? new Date();
  const timeline: ProcessEntry[] = [];
  const events = [...input.events].sort((a, b) => ms(a.createdAt) - ms(b.createdAt));

  // -- status history + human decisions --
  let lastLine = "";
  for (const e of events) {
    if (e.kind === "human") {
      timeline.push({ at: iso(e.createdAt), actor: "sen", actorLabel: "Sen", tone: "human", title: e.message ?? "Karar verildi" });
      continue;
    }
    const line = `${e.status}|${e.message ?? ""}`;
    if (line === lastLine) continue;
    lastLine = line;
    const actor = agentForStatus(e.status, e.message);
    const waiting = e.status.startsWith("awaiting_");
    timeline.push({
      at: iso(e.createdAt),
      actor: actor ?? "bas_editor",
      actorLabel: actor ? label(actor) : "Sistem",
      tone: e.status === "failed" ? "fail" : waiting ? "warn" : e.status === "done" ? "ok" : "info",
      title: waiting ? `Onayını bekliyor: ${e.message ?? STATUS_LABELS[e.status] ?? e.status}` : (e.message ?? STATUS_LABELS[e.status] ?? e.status),
    });
  }

  // -- reviewers: one entry per review --
  for (const r of input.unitReviews) {
    const actor = REVIEW_TYPE_PERSONA[r.reviewType as ReviewType] ?? "bas_editor";
    timeline.push({
      at: iso(r.createdAt),
      actor,
      actorLabel: label(actor),
      tone: r.passed ? "ok" : "warn",
      title: r.passed
        ? `${unitName(r.unitNumber)}: sorunsuz geçti${r.issues.length ? ` (${r.issues.length} küçük not)` : ""}`
        : `${unitName(r.unitNumber)}: ${r.issues.length} sorun buldu - yeniden yazıma gönderildi`,
      details: r.issues.length ? r.issues.slice(0, 4) : undefined,
    });
  }

  // -- illustrator: one entry per unit (latest attempt per picture) --
  const byUnit = new Map<string, ImageReviewIn[]>();
  for (const r of input.imageReviews) {
    const key = r.unitNumber === null ? "cover" : String(r.unitNumber);
    byUnit.set(key, [...(byUnit.get(key) ?? []), r]);
  }
  for (const [key, rows] of byUnit) {
    const latest = new Map<string, ImageReviewIn>();
    for (const r of rows) {
      const k = `${r.pageNumber ?? "x"}`;
      const prev = latest.get(k);
      if (!prev || r.attempt > prev.attempt || ms(r.createdAt) > ms(prev.createdAt)) latest.set(k, r);
    }
    const finals = [...latest.values()];
    const failed = finals.filter((r) => !r.passed);
    const retries = rows.length - finals.length;
    const at = iso(rows.reduce((m, r) => (ms(r.createdAt) > ms(m.createdAt) ? r : m)).createdAt);
    timeline.push({
      at,
      actor: "gorsel_tasarimci",
      actorLabel: label("gorsel_tasarimci"),
      tone: failed.length ? "warn" : "ok",
      title:
        key === "cover"
          ? `Kapak ve karakter çizimleri: ${finals.length} görsel${failed.length ? `, ${failed.length}'i denetimden geçemedi` : ""}`
          : `${unitName(Number(key))}: ${finals.length} görsel${retries ? `, ${retries} yeniden deneme` : ""}${failed.length ? `, ${failed.length}'i denetimden geçemedi` : ", hepsi denetimden geçti"}`,
      details: failed.flatMap((r) => r.issues.slice(0, 1)).slice(0, 4),
    });
  }

  // -- art director: one entry per review round and book type --
  const rounds = new Map<string, DesignReviewIn[]>();
  for (const r of input.designReviews) {
    const key = `${r.round}|${r.bookType}`;
    rounds.set(key, [...(rounds.get(key) ?? []), r]);
  }
  for (const [key, rows] of rounds) {
    const [round, bookType] = key.split("|");
    const avg = Math.round(rows.reduce((n, r) => n + r.score, 0) / rows.length);
    const weak = rows.filter((r) => r.score < 70).length;
    const spilled = rows.filter((r) => r.pageCount > 1).length;
    const fixed = rows.filter((r) => r.appliedFix && r.appliedFix !== "none").length;
    timeline.push({
      at: iso(rows.reduce((m, r) => (ms(r.createdAt) > ms(m.createdAt) ? r : m)).createdAt),
      actor: "sanat_yonetmeni",
      actorLabel: label("sanat_yonetmeni"),
      tone: weak || spilled ? "warn" : "ok",
      title: `${BOOK_LABEL[bookType] ?? bookType}, ${round}. tur: ${rows.length} sayfa puanlandı, ortalama ${avg}/100${weak ? `, ${weak} zayıf` : ""}${spilled ? `, ${spilled} taşan` : ""}${fixed ? ` - ${fixed} sayfa düzeltildi` : ""}`,
    });
  }

  timeline.sort((a, b) => ms(b.at) - ms(a.at));

  // -- stage timings from the status history --
  const statusEvents = events.filter((e) => e.kind === "status");
  const end = ["done", "failed", "changes_requested"].includes(input.status) ? ms(input.updatedAt) : now.getTime();
  const totals = new Map<string, number>();
  statusEvents.forEach((e, i) => {
    const next = statusEvents[i + 1] ? ms(statusEvents[i + 1].createdAt) : end;
    totals.set(e.status, (totals.get(e.status) ?? 0) + Math.max(0, next - ms(e.createdAt)));
  });
  const timings: StageTiming[] = [...totals.entries()]
    .filter(([status]) => !["done", "failed", "changes_requested"].includes(status))
    .map(([status, t]) => {
      const actor = agentForStatus(status, null);
      return { status, label: STATUS_LABELS[status] ?? status, actor, actorLabel: actor ? label(actor) : "Sistem", ms: t, human: status.startsWith("awaiting_") };
    })
    .sort((a, b) => b.ms - a.ms);
  const humanMs = timings.filter((t) => t.human).reduce((n, t) => n + t.ms, 0);
  const machineMs = timings.filter((t) => !t.human).reduce((n, t) => n + t.ms, 0);

  // -- per-agent headline --
  const reviewsBy = (type: string) => input.unitReviews.filter((r) => r.reviewType === type);
  const finalImages = new Map<string, ImageReviewIn>();
  for (const r of input.imageReviews) {
    const k = `${r.unitNumber}|${r.pageNumber}`;
    const prev = finalImages.get(k);
    if (!prev || r.attempt >= prev.attempt) finalImages.set(k, r);
  }
  const lastRound = input.designReviews.length ? Math.max(...input.designReviews.map((r) => r.round)) : 0;
  const lastDesign = input.designReviews.filter((r) => r.round === lastRound);
  const rewrites = statusEvents.filter((e) => /yeniden üretiliyor/i.test(e.message ?? "")).length;
  const decisions = events.filter((e) => e.kind === "human").length;

  const headlineFor = (key: PersonaKey): string => {
    switch (key) {
      case "kaynak_analisti":
        return totals.has("mapping_pages") || totals.has("extracting") ? `Kaynak analizi ${formatDuration((totals.get("mapping_pages") ?? 0) + (totals.get("extracting") ?? 0) + (totals.get("analyzing") ?? 0))}` : "Kaynak analizi";
      case "icerik_uretici":
        return rewrites ? `${rewrites} kez geri bildirimle yeniden yazdı` : "Üniteleri yazar";
      case "dil_denetcisi":
      case "seviye_uzmani": {
        const rows = reviewsBy(key === "dil_denetcisi" ? "language" : "level");
        const failed = rows.filter((r) => !r.passed).length;
        return rows.length ? `${rows.length} denetim, ${failed} kez düzeltme istedi` : "Henüz denetim yok";
      }
      case "gorsel_tasarimci": {
        const all = [...finalImages.values()];
        const failed = all.filter((r) => !r.passed).length;
        if (all.length) return `${all.length} görsel, ${failed} tanesi denetimden geçemedi`;
        return input.pageImageCount ? `${input.pageImageCount} görsel (önceki üretimden yeniden kullanıldı)` : "Henüz görsel yok";
      }
      case "sanat_yonetmeni":
        return lastDesign.length
          ? `${lastDesign.length} sayfa, ortalama ${Math.round(lastDesign.reduce((n, r) => n + r.score, 0) / lastDesign.length)}/100`
          : "Karakterler ve sayfa denetimi";
      case "bas_editor":
        return decisions ? `${decisions} kez onayına başvurdu` : "Onay kapılarını yönetir";
      case "yayin_muduru":
        return "Marka ve logo";
      case "produksiyon":
        return input.status === "done" ? "Kitaplar dizildi" : "Derlemeyi bekliyor";
      default:
        return "";
    }
  };

  const office = officeAgents(input.status, input.currentStage);
  const agents: AgentCard[] = office.map((a) => ({ key: a.key, label: a.label, state: a.state, headline: headlineFor(a.key) }));

  const active = office.find((a) => a.state === "waiting_human") ?? office.find((a) => a.state === "working");
  const lastStatusEvent = statusEvents[statusEvents.length - 1];
  const nowBlock =
    input.status === "done"
      ? { actor: null, state: null, actorLabel: "Ekip", text: "Kitap tamamlandı.", waitingForYou: false, since: lastStatusEvent ? iso(lastStatusEvent.createdAt) : null }
      : input.status === "failed"
        ? { actor: null, state: null, actorLabel: "Sistem", text: "Üretim bir hatayla durdu.", waitingForYou: false, since: lastStatusEvent ? iso(lastStatusEvent.createdAt) : null }
        : {
            actor: active?.key ?? null,
            state: active?.state ?? null,
            actorLabel: active?.label ?? "Sistem",
            text: active?.speech ?? input.currentStage ?? STATUS_LABELS[input.status] ?? input.status,
            waitingForYou: input.status.startsWith("awaiting_"),
            since: iso(input.updatedAt),
          };

  return { now: nowBlock, agents, timeline, timings, machineMs, humanMs };
}
