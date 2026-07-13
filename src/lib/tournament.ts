import type { GateTelemetry } from "./types";
import { clamp } from "./utils";

export type MatchStage =
  | "Group Stage"
  | "Round of 16"
  | "Quarter-final"
  | "Semi-final"
  | "Final";

export interface Match {
  id: string;
  stage: MatchStage;
  group?: string;
  kickoff: string; // ISO-ish, e.g. "2026-06-12T20:00"
  venue: string;
  home: { code: string; name: string; flag: string };
  away: { code: string; name: string; flag: string };
  // Which gate ids feed this venue's readiness assessment.
  linkedGates: string[];
}

export const FIXTURES: Match[] = [
  {
    id: "M-01",
    stage: "Group Stage",
    group: "A",
    kickoff: "2026-06-12T20:00",
    venue: "Estadio Azteca",
    home: { code: "MEX", name: "Mexico", flag: "🇲🇽" },
    away: { code: "CAN", name: "Canada", flag: "🇨🇦" },
    linkedGates: ["Gate C", "Gate D"],
  },
  {
    id: "M-02",
    stage: "Group Stage",
    group: "B",
    kickoff: "2026-06-12T23:00",
    venue: "SoFi Stadium",
    home: { code: "BRA", name: "Brazil", flag: "🇧🇷" },
    away: { code: "GER", name: "Germany", flag: "🇩🇪" },
    linkedGates: ["Gate C", "Gate D", "Gate E", "Accessible Ramp A104"],
  },
  {
    id: "M-03",
    stage: "Group Stage",
    group: "C",
    kickoff: "2026-06-13T18:00",
    venue: "MetLife Stadium",
    home: { code: "ARG", name: "Argentina", flag: "🇦🇷" },
    away: { code: "FRA", name: "France", flag: "🇫🇷" },
    linkedGates: ["Gate E", "Accessible Ramp A104"],
  },
  {
    id: "M-04",
    stage: "Round of 16",
    kickoff: "2026-06-29T21:00",
    venue: "AT&T Stadium",
    home: { code: "ESP", name: "Spain", flag: "🇪🇸" },
    away: { code: "POR", name: "Portugal", flag: "🇵🇹" },
    linkedGates: ["Gate C", "Gate E"],
  },
  {
    id: "M-05",
    stage: "Quarter-final",
    kickoff: "2026-07-04T22:00",
    venue: "Mercedes-Benz Stadium",
    home: { code: "ENG", name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    away: { code: "NED", name: "Netherlands", flag: "🇳🇱" },
    linkedGates: ["Gate D", "Gate E"],
  },
  {
    id: "M-06",
    stage: "Semi-final",
    kickoff: "2026-07-14T21:00",
    venue: "Arrowhead Stadium",
    home: { code: "JPN", name: "Japan", flag: "🇯🇵" },
    away: { code: "URU", name: "Uruguay", flag: "🇺🇾" },
    linkedGates: ["Gate C", "Gate D", "Accessible Ramp A104"],
  },
  {
    id: "M-07",
    stage: "Final",
    kickoff: "2026-07-19T20:00",
    venue: "MetLife Stadium",
    home: { code: "BRA", name: "Brazil", flag: "🇧🇷" },
    away: { code: "ARG", name: "Argentina", flag: "🇦🇷" },
    linkedGates: ["Gate C", "Gate D", "Gate E", "Accessible Ramp A104"],
  },
];

export type ReadinessStatus =
  | "READY"
  | "HOLD"
  | "DELAY_RISK"
  | "AT_CAPACITY";

export interface MatchReadiness {
  matchId: string;
  status: ReadinessStatus;
  avgCapacityPct: number;
  totalInflow: number;
  activeIncidents: number;
  linkedGateIds: string[];
  reason: string;
}

/**
 * Deterministic kickoff-readiness derivation from live gate telemetry.
 * O(n + m) — one pass to index gates by id, one pass per match's linked gates.
 */
export function computeReadiness(
  matches: Match[],
  gates: GateTelemetry[],
): MatchReadiness[] {
  const safeGates = Array.isArray(gates) ? gates : [];
  const byId = new Map<string, GateTelemetry>();
  for (const g of safeGates) {
    if (g && typeof g.gate_id === "string") byId.set(g.gate_id, g);
  }

  return matches.map((m) => {
    const linked = m.linkedGates
      .map((id) => byId.get(id))
      .filter((g): g is GateTelemetry => Boolean(g));

    if (linked.length === 0) {
      return {
        matchId: m.id,
        status: "HOLD",
        avgCapacityPct: 0,
        totalInflow: 0,
        activeIncidents: 0,
        linkedGateIds: m.linkedGates,
        reason: "No telemetry available for linked gates.",
      };
    }

    const totalInflow = linked.reduce(
      (s, g) => s + clamp(g.inflow_rate_per_min, 0, 1000),
      0,
    );
    const avgCapacityPct = Math.round(
      linked.reduce(
        (s, g) => s + clamp(g.current_capacity_pct, 0, 100),
        0,
      ) / linked.length,
    );
    const activeIncidents = linked.filter((g) => g.incident_reported).length;

    let status: ReadinessStatus;
    let reason: string;
    if (avgCapacityPct >= 95) {
      status = "AT_CAPACITY";
      reason = `Average gate load ${avgCapacityPct}% — hold entry, open overflow.`;
    } else if (activeIncidents > 0) {
      status = "DELAY_RISK";
      reason = `${activeIncidents} active incident${activeIncidents > 1 ? "s" : ""} on linked gates.`;
    } else if (avgCapacityPct >= 70 && totalInflow > 250) {
      status = "READY";
      reason = `Ingress on target (${avgCapacityPct}% avg, ${totalInflow}/min).`;
    } else if (avgCapacityPct < 40) {
      status = "HOLD";
      reason = `Low ingress (${avgCapacityPct}%) — kickoff not cleared yet.`;
    } else {
      status = "READY";
      reason = `Nominal ingress (${avgCapacityPct}% avg, ${totalInflow}/min).`;
    }

    return {
      matchId: m.id,
      status,
      avgCapacityPct,
      totalInflow,
      activeIncidents,
      linkedGateIds: m.linkedGates,
      reason,
    };
  });
}

export const STATUS_META: Record<
  ReadinessStatus,
  { label: string; tone: string; dot: string }
> = {
  READY: {
    label: "Kickoff Ready",
    tone: "border-emerald-300/50 bg-emerald-500/15 text-emerald-100",
    dot: "bg-emerald-400",
  },
  HOLD: {
    label: "Hold",
    tone: "border-slate-400/40 bg-slate-500/15 text-slate-100",
    dot: "bg-slate-300",
  },
  DELAY_RISK: {
    label: "Delay Risk",
    tone: "border-amber-300/50 bg-amber-500/15 text-amber-100",
    dot: "bg-amber-300",
  },
  AT_CAPACITY: {
    label: "At Capacity",
    tone: "border-rose-300/50 bg-rose-500/15 text-rose-100",
    dot: "bg-rose-400",
  },
};
