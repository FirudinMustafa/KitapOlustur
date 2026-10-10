"use client";

import { useMemo, useState } from "react";
import { AlertTriangleIcon, ArrowDownIcon, CheckCircle2Icon, ClockIcon, CpuIcon, HourglassIcon, PartyPopperIcon, XCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, type LogActor, type LogTone, type ProcessEntry, type ProcessLog } from "@/lib/process-log";
import { formatElapsedTurkish } from "@/lib/run-status";
import type { OfficeAgentState } from "@/lib/agent-office";
import { AgentAvatar, actorColor } from "@/components/app/agent-avatar";

// Süreç Günlüğü: who in the agent team is doing what, what each of them
// found and fixed, how long every stage took and what is waiting for you.

const STATE_LABEL: Record<OfficeAgentState, string> = {
  working: "Çalışıyor",
  waiting_human: "Seni bekliyor",
  done: "Bitti",
  idle: "Sırada",
};

const STATE_CHIP: Record<OfficeAgentState, string> = {
  working: "bg-primary/10 text-primary",
  waiting_human: "bg-warning-soft text-warning-soft-foreground",
  done: "bg-success-soft text-success-soft-foreground",
  idle: "bg-muted text-muted-foreground",
};

const TONE: Record<LogTone, { ring: string; chip: string; label: string }> = {
  info: { ring: "border-border", chip: "bg-muted text-muted-foreground", label: "Bilgi" },
  ok: { ring: "border-success/40", chip: "bg-success-soft text-success-soft-foreground", label: "Tamam" },
  warn: { ring: "border-warning/50", chip: "bg-warning-soft text-warning-soft-foreground", label: "Düzeltme" },
  fail: { ring: "border-danger/50", chip: "bg-danger-soft text-danger-soft-foreground", label: "Hata" },
  human: { ring: "border-primary/40", chip: "bg-accent text-accent-foreground", label: "Senin kararın" },
};

function clock(at: string): string {
  return new Date(at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function scrollToGate() {
  document.querySelector("[data-approval-gate]")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---- Now ----------------------------------------------------------------

function NowHero({ log, done, failed }: { log: ProcessLog; done: boolean; failed: boolean }) {
  const { now } = log;
  const color = now.actor ? actorColor(now.actor) : done ? "#16a34a" : failed ? "#dc2626" : "#6366f1";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 sm:p-5",
        now.waitingForYou ? "border-warning/50" : "border-border",
      )}
      style={{ background: `linear-gradient(120deg, color-mix(in oklch, ${color} 14%, var(--card)) 0%, var(--card) 70%)` }}
    >
      {/* soft decorative orbs */}
      <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full opacity-20 blur-2xl" style={{ background: color }} />
      <div className="relative flex items-center gap-4">
        {now.actor ? (
          <AgentAvatar actor={now.actor} state={now.state ?? "neutral"} size={64} />
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full text-white shadow-lg" style={{ background: color }}>
            {done ? <PartyPopperIcon className="size-7" /> : failed ? <XCircleIcon className="size-7" /> : <CpuIcon className="size-7" />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Şu an</span>
            {!done && !failed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
                <span className="size-1.5 animate-pulse rounded-full bg-success" /> canlı
              </span>
            )}
          </div>
          {/* speech bubble */}
          <div className="relative mt-1.5 inline-block max-w-full rounded-2xl rounded-tl-sm bg-card px-3.5 py-2 shadow-sm ring-1 ring-border">
            <span className="font-semibold text-foreground">{now.actorLabel}</span>
            <span className="text-foreground/85"> · {now.text}</span>
          </div>
          {now.since && (
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="size-3.5" /> {formatElapsedTurkish(new Date(now.since))}
              </span>
              {now.waitingForYou && (
                <button
                  type="button"
                  onClick={scrollToGate}
                  className="inline-flex items-center gap-1 rounded-full bg-warning px-3 py-1 text-xs font-semibold text-warning-foreground shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  Onay ekranına git <ArrowDownIcon className="size-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Team ---------------------------------------------------------------

function Team({ log, filter, onFilter }: { log: ProcessLog; filter: string; onFilter: (key: string) => void }) {
  const doneCount = log.agents.filter((a) => a.state === "done").length;
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Ekip</h3>
        <span className="text-xs text-muted-foreground">
          {doneCount}/{log.agents.length} ajan işini bitirdi
        </span>
      </div>
      {/* overall progress through the desks */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-success transition-[width] duration-700"
          style={{ width: `${(doneCount / Math.max(1, log.agents.length)) * 100}%` }}
        />
      </div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {log.agents.map((a) => {
          const active = filter === a.key;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => onFilter(active ? "all" : a.key)}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border bg-card p-3 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
                active && "ring-2 ring-primary/50",
                a.state === "waiting_human" && "border-warning/50",
              )}
            >
              <AgentAvatar actor={a.key} state={a.state} size={42} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-foreground">{a.label}</span>
                </span>
                <span className={cn("mt-0.5 inline-block rounded-full px-1.5 py-px text-[10px] font-medium", STATE_CHIP[a.state])}>
                  {STATE_LABEL[a.state]}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={a.headline}>
                  {a.headline}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---- Time ---------------------------------------------------------------

function Time({ log }: { log: ProcessLog }) {
  if (!log.timings.length) return null;
  const total = log.machineMs + log.humanMs || 1;
  const max = Math.max(1, ...log.timings.map((t) => t.ms));
  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold text-foreground">Zaman</h3>
      <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-xs">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CpuIcon className="size-5" />
          </span>
          <span>
            <span className="block text-lg font-semibold tabular-nums text-foreground">{formatDuration(log.machineMs)}</span>
            <span className="block text-xs text-muted-foreground">ajanların çalışması</span>
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-xs">
          <span className="flex size-10 items-center justify-center rounded-xl bg-warning-soft text-warning-soft-foreground">
            <HourglassIcon className="size-5" />
          </span>
          <span>
            <span className="block text-lg font-semibold tabular-nums text-foreground">{formatDuration(log.humanMs)}</span>
            <span className="block text-xs text-muted-foreground">senin onayını bekleme</span>
          </span>
        </div>
      </div>
      {/* share of the whole run */}
      <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-muted" title="Ajan çalışması / onay bekleme">
        <div className="h-full bg-primary" style={{ width: `${(log.machineMs / total) * 100}%` }} />
        <div className="h-full bg-warning" style={{ width: `${(log.humanMs / total) * 100}%` }} />
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {log.timings.slice(0, 8).map((t) => (
          <li key={t.status} className="flex items-center gap-2.5 text-xs">
            {t.actor ? <AgentAvatar actor={t.actor} size={22} /> : <span className="size-[22px] rounded-full bg-muted" />}
            <span className="w-40 shrink-0 truncate text-muted-foreground" title={`${t.label} · ${t.actorLabel}`}>
              {t.label}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className={cn("block h-full rounded-full", t.human ? "bg-warning" : "bg-primary")}
                style={{ width: `${Math.max(3, (t.ms / max) * 100)}%` }}
              />
            </span>
            <span className="w-16 text-right tabular-nums text-foreground">{formatDuration(t.ms)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- Timeline -----------------------------------------------------------

function EntryCard({ e }: { e: ProcessEntry }) {
  const [open, setOpen] = useState(e.tone === "warn" || e.tone === "fail");
  const tone = TONE[e.tone];
  return (
    <li className="relative pl-12">
      <span className="absolute top-1.5 left-0">
        <AgentAvatar actor={e.actor as LogActor} size={34} />
      </span>
      <div className={cn("rounded-2xl border bg-card px-3.5 py-2.5 shadow-xs", tone.ring)}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-foreground">{e.actorLabel}</span>
          <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", tone.chip)}>{tone.label}</span>
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{clock(e.at)}</span>
        </div>
        <p className="mt-0.5 text-sm text-foreground/90">{e.title}</p>
        {!!e.details?.length && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              {open ? "Ayrıntıyı gizle" : `${e.details.length} ayrıntıyı göster`}
            </button>
            {open && (
              <ul className="mt-1.5 flex flex-col gap-1 rounded-xl bg-muted/50 p-2.5 text-xs text-muted-foreground">
                {e.details.map((d, k) => (
                  <li key={k} className="flex gap-1.5">
                    <AlertTriangleIcon className="mt-0.5 size-3 shrink-0 text-warning" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export function ProcessLogPanel({ log, status }: { log: ProcessLog; status?: string }) {
  const [filter, setFilter] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);
  const done = status === "done";
  const failed = status === "failed";
  const actors = useMemo(() => [...new Map(log.timeline.map((e) => [e.actor, e.actorLabel])).entries()], [log.timeline]);
  const problems = log.timeline.filter((e) => e.tone === "warn" || e.tone === "fail").length;
  const entries = log.timeline.filter((e) =>
    filter === "all" ? true : filter === "problems" ? e.tone === "warn" || e.tone === "fail" : e.actor === filter,
  );
  const visible = showAll ? entries : entries.slice(0, 20);

  return (
    <section className="mt-5 rounded-3xl border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-heading text-xl font-medium text-foreground">Süreç günlüğü</h2>
          <p className="text-xs text-muted-foreground">Kitabı yazan ajan ekibinin ne yaptığı, ne bulduğu ve neyi düzelttiği.</p>
        </div>
        <div className="flex gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            <CheckCircle2Icon className="size-3" /> {log.timeline.length} olay
          </span>
          {problems > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-warning-soft-foreground">
              <AlertTriangleIcon className="size-3" /> {problems} düzeltme
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <NowHero log={log} done={done} failed={failed} />
      </div>

      {log.warnings.length > 0 && (
        <div className="mt-3 rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangleIcon className="size-4" /> Bu üretimde eksik kalanlar
          </div>
          <ul className="mt-1.5 list-disc space-y-1 pl-6 text-xs">
            {log.warnings.slice(0, 6).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <Team log={log} filter={filter} onFilter={setFilter} />
      <Time log={log} />

      <section className="mt-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="mr-1 text-sm font-semibold text-foreground">Olaylar</h3>
          {[["all", "Hepsi"], ["problems", `Sadece düzeltmeler (${problems})`]].map(([key, name]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              {name}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          {actors.map(([key, name]) => (
            <button
              key={key}
              type="button"
              title={name}
              onClick={() => setFilter(filter === key ? "all" : key)}
              className={cn("rounded-full p-0.5 transition-transform hover:-translate-y-0.5", filter === key && "ring-2 ring-primary")}
            >
              <AgentAvatar actor={key as LogActor} size={26} />
            </button>
          ))}
        </div>

        {entries.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            Bu filtre için kayıt yok. Süreç günlüğünden önce başlamış üretimlerde yalnızca denetim kayıtları görünür.
          </p>
        ) : (
          <ol className="relative mt-4 flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[16px] before:w-px before:bg-border">
            {visible.map((e, i) => (
              <EntryCard key={`${e.at}-${i}`} e={e} />
            ))}
          </ol>
        )}
        {entries.length > visible.length && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-3 w-full rounded-xl border border-dashed py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            {entries.length - visible.length} olay daha göster
          </button>
        )}
      </section>
    </section>
  );
}
