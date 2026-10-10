"use client";

import { useMemo, useState } from "react";
import { formatDuration, type ProcessLog, type LogTone } from "@/lib/process-log";
import { formatElapsedTurkish } from "@/lib/run-status";
import type { OfficeAgentState } from "@/lib/agent-office";

// Süreç Günlüğü: who in the agent team is doing what, what each of them
// found and fixed, how long every stage took and what is waiting for you.

const STATE_STYLE: Record<OfficeAgentState, { dot: string; text: string }> = {
  working: { dot: "bg-primary animate-pulse", text: "Çalışıyor" },
  waiting_human: { dot: "bg-warning animate-pulse", text: "Onayını bekliyor" },
  done: { dot: "bg-success", text: "Bitti" },
  idle: { dot: "bg-muted-foreground/30", text: "Sırada" },
};

const TONE_STYLE: Record<LogTone, string> = {
  info: "border-border",
  ok: "border-success/50",
  warn: "border-warning/60",
  fail: "border-danger/60",
  human: "border-primary/60",
};

const TONE_ICON: Record<LogTone, string> = { info: "•", ok: "✓", warn: "!", fail: "✕", human: "➜" };

function clock(at: string): string {
  return new Date(at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function ProcessLogPanel({ log }: { log: ProcessLog }) {
  const [filter, setFilter] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);
  const actors = useMemo(() => [...new Map(log.timeline.map((e) => [e.actor, e.actorLabel])).entries()], [log.timeline]);
  const entries = log.timeline.filter((e) =>
    filter === "all" ? true : filter === "problems" ? e.tone === "warn" || e.tone === "fail" : e.actor === filter,
  );
  const visible = showAll ? entries : entries.slice(0, 25);
  const maxStage = Math.max(1, ...log.timings.map((t) => t.ms));

  return (
    <div className="mt-5 rounded-2xl border bg-card p-5 text-card-foreground shadow-xs">
      <h2 className="font-heading text-lg font-medium text-foreground">Süreç günlüğü</h2>

      <div
        className={`mt-3 rounded-xl px-4 py-3 text-sm ${
          log.now.waitingForYou ? "bg-warning-soft text-warning-soft-foreground ring-1 ring-warning/40" : "bg-muted/60 text-foreground"
        }`}
      >
        <span className="font-semibold">{log.now.actorLabel}:</span> {log.now.text}
        {log.now.since && (
          <span className="ml-2 text-xs opacity-75">
            ({formatElapsedTurkish(new Date(log.now.since))}
            {log.now.waitingForYou ? " bekliyor - onay ekranı aşağıda" : ""})
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {log.agents.map((a) => {
          const st = STATE_STYLE[a.state];
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => setFilter((f) => (f === a.key ? "all" : a.key))}
              className={`flex items-start gap-2 rounded-xl border p-2.5 text-left transition-colors hover:bg-accent ${filter === a.key ? "ring-2 ring-primary/40" : ""}`}
            >
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{a.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {st.text} · {a.headline}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {log.timings.length > 0 && (
        <div className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium text-foreground">Süreler</h3>
            <span className="text-xs text-muted-foreground">
              Ajanların çalışması {formatDuration(log.machineMs)} · Senin onayını bekleme {formatDuration(log.humanMs)}
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {log.timings.slice(0, 8).map((t) => (
              <div key={t.status} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-2 text-xs">
                <span className="truncate text-muted-foreground" title={`${t.label} · ${t.actorLabel}`}>
                  {t.label}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span
                    className={`block h-full rounded-full ${t.human ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${Math.max(3, (t.ms / maxStage) * 100)}%` }}
                  />
                </span>
                <span className="tabular-nums text-foreground">{formatDuration(t.ms)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        <h3 className="mr-2 text-sm font-medium text-foreground">Olaylar</h3>
        {[["all", "Hepsi"], ["problems", "Sadece sorunlar"], ...actors].map(([key, name]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}
          >
            {name}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Bu filtre için kayıt yok. (Süreç günlüğünden önce başlamış üretimlerde sadece denetim kayıtları görünür.)
        </p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {visible.map((e, i) => (
            <li key={`${e.at}-${i}`} className={`rounded-lg border-l-4 bg-muted/30 px-3 py-2 ${TONE_STYLE[e.tone]}`}>
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="w-4 text-center text-xs font-bold text-muted-foreground" aria-hidden>
                  {TONE_ICON[e.tone]}
                </span>
                <span className="tabular-nums text-xs text-muted-foreground">{clock(e.at)}</span>
                <span className="font-medium text-foreground">{e.actorLabel}</span>
                <span className="text-foreground/90">{e.title}</span>
              </div>
              {e.details?.length ? (
                <ul className="mt-1 list-disc pl-10 text-xs text-muted-foreground">
                  {e.details.map((d, k) => (
                    <li key={k}>{d}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {entries.length > visible.length && (
        <button type="button" onClick={() => setShowAll(true)} className="mt-2 text-xs font-medium text-primary underline">
          {entries.length - visible.length} olay daha göster
        </button>
      )}
    </div>
  );
}
