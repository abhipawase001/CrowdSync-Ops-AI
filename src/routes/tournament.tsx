import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { INITIAL_GATES, tickTelemetry } from "@/lib/telemetry";
import {
  FIXTURES,
  STATUS_META,
  computeReadiness,
  type Match,
  type MatchReadiness,
  type MatchStage,
} from "@/lib/tournament";
import type { GateTelemetry } from "@/lib/types";

export const Route = createFileRoute("/tournament")({
  head: () => ({
    meta: [
      { title: "Tournament Operations — FIFA 2026 Match Readiness" },
      {
        name: "description",
        content:
          "Live match and bracket readiness derived from real-time gate telemetry across FIFA 2026 stadiums.",
      },
      {
        property: "og:title",
        content: "Tournament Operations — FIFA 2026 Match Readiness",
      },
      {
        property: "og:description",
        content:
          "Group stage through final: kickoff-ready status, gate load, and incident flags synced to live telemetry.",
      },
    ],
  }),
  component: TournamentPage,
});

const STAGES: MatchStage[] = [
  "Group Stage",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Final",
];

function TournamentPage() {
  const [gates, setGates] = useState<GateTelemetry[]>(INITIAL_GATES);
  const [lastTick, setLastTick] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setGates((g) => tickTelemetry(g));
      setLastTick(Date.now());
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const readinessById = useMemo(() => {
    const map = new Map<string, MatchReadiness>();
    for (const r of computeReadiness(FIXTURES, gates)) map.set(r.matchId, r);
    return map;
  }, [gates]);

  const summary = useMemo(() => {
    const totals = { READY: 0, HOLD: 0, DELAY_RISK: 0, AT_CAPACITY: 0 };
    for (const r of readinessById.values()) totals[r.status] += 1;
    return totals;
  }, [readinessById]);

  const grouped = useMemo(() => {
    const m = new Map<MatchStage, Match[]>();
    for (const stage of STAGES) m.set(stage, []);
    for (const f of FIXTURES) m.get(f.stage)!.push(f);
    return m;
  }, []);

  return (
    <div className="min-h-dvh bg-[#050b18] text-slate-50 selection:bg-cyan-400/30">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.10),transparent_55%),radial-gradient(circle_at_90%_90%,rgba(20,184,166,0.08),transparent_50%)]"
      />
      <header className="relative border-b border-cyan-500/20 bg-[#050d1c]/80 px-4 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-100">
              Tournament Operations
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-cyan-50 sm:text-2xl">
              FIFA 2026 · Match Readiness Console
            </h1>
          </div>
          <nav className="flex items-center gap-2 text-xs">
            <Link
              to="/"
              className="rounded-md border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 font-semibold uppercase tracking-widest text-cyan-100 hover:bg-cyan-900/50"
            >
              ← Ops Center
            </Link>
            <span className="rounded-md border border-emerald-300/40 bg-emerald-500/10 px-3 py-1.5 font-mono uppercase tracking-widest text-emerald-100">
              Live · {new Date(lastTick).toLocaleTimeString([], { hour12: false })}
            </span>
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="relative mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8">
        <section aria-label="Readiness summary" className="grid gap-3 sm:grid-cols-4">
          <SummaryTile label="Kickoff Ready" value={summary.READY} tone="emerald" />
          <SummaryTile label="Hold" value={summary.HOLD} tone="slate" />
          <SummaryTile label="Delay Risk" value={summary.DELAY_RISK} tone="amber" />
          <SummaryTile label="At Capacity" value={summary.AT_CAPACITY} tone="rose" />
        </section>

        {STAGES.map((stage) => {
          const list = grouped.get(stage)!;
          if (list.length === 0) return null;
          return (
            <section
              key={stage}
              aria-labelledby={`stage-${stage.replace(/\s+/g, "-")}`}
              className="rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-[#08172b]/90 to-[#050d1c]/90"
            >
              <header className="flex items-center justify-between border-b border-cyan-500/20 px-4 py-2.5">
                <h2
                  id={`stage-${stage.replace(/\s+/g, "-")}`}
                  className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100"
                >
                  {stage}
                </h2>
                <span className="text-[10px] uppercase tracking-widest text-slate-300">
                  {list.length} {list.length === 1 ? "match" : "matches"}
                </span>
              </header>
              <ul className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                {list.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    readiness={readinessById.get(m.id)!}
                  />
                ))}
              </ul>
            </section>
          );
        })}

        <footer className="border-t border-cyan-500/20 pt-4 text-[11px] uppercase tracking-widest text-slate-300">
          Readiness derived from live gate telemetry · Kickoff Ready when avg
          capacity ≥ 70% and no active incidents.
        </footer>
      </main>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "slate" | "amber" | "rose";
}) {
  const toneMap: Record<typeof tone, string> = {
    emerald: "border-emerald-300/40 bg-emerald-500/10 text-emerald-100",
    slate: "border-slate-400/40 bg-slate-500/10 text-slate-100",
    amber: "border-amber-300/40 bg-amber-500/10 text-amber-100",
    rose: "border-rose-300/40 bg-rose-500/10 text-rose-100",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneMap[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
        {label}
      </p>
      <p className="mt-1 font-mono text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function MatchCard({
  match,
  readiness,
}: {
  match: Match;
  readiness: MatchReadiness;
}) {
  const meta = STATUS_META[readiness.status];
  const ko = new Date(match.kickoff);
  const kickoffLabel = isNaN(ko.getTime())
    ? match.kickoff
    : ko.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

  return (
    <li
      className="flex flex-col gap-3 rounded-xl border border-cyan-500/20 bg-[#04101f]/80 p-3"
      aria-label={`${match.home.name} vs ${match.away.name}, ${meta.label}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-200">
          {match.id} {match.group ? `· Group ${match.group}` : ""}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${meta.tone}`}
        >
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Team side={match.home} />
        <span className="font-mono text-xs text-slate-300">vs</span>
        <Team side={match.away} align="right" />
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-lg border border-cyan-500/10 bg-[#050d1c]/70 p-2 text-center text-[11px]">
        <Stat label="Avg Cap" value={`${readiness.avgCapacityPct}%`} />
        <Stat label="Inflow/min" value={readiness.totalInflow.toLocaleString()} />
        <Stat
          label="Incidents"
          value={String(readiness.activeIncidents)}
          tone={readiness.activeIncidents ? "text-rose-200" : "text-emerald-200"}
        />
      </dl>

      <div className="grid gap-1 text-[11px] text-slate-200">
        <p>
          <span className="text-cyan-200">Venue:</span> {match.venue}
        </p>
        <p>
          <span className="text-cyan-200">Kickoff:</span>{" "}
          <span className="font-mono tabular-nums">{kickoffLabel}</span>
        </p>
        <p className="truncate">
          <span className="text-cyan-200">Gates:</span>{" "}
          {match.linkedGates.join(", ")}
        </p>
      </div>

      <p className="rounded-md bg-white/5 px-2 py-1.5 text-[11px] text-slate-100">
        {readiness.reason}
      </p>
    </li>
  );
}

function Team({
  side,
  align = "left",
}: {
  side: Match["home"];
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        align === "right" ? "justify-end text-right" : ""
      }`}
    >
      {align === "left" && <span aria-hidden className="text-lg">{side.flag}</span>}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-50">{side.name}</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-300">
          {side.code}
        </p>
      </div>
      {align === "right" && <span aria-hidden className="text-lg">{side.flag}</span>}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-cyan-100",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-widest text-slate-300">
        {label}
      </dt>
      <dd className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${tone}`}>
        {value}
      </dd>
    </div>
  );
}
