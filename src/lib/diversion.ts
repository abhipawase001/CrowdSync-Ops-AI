// Pure, framework-free diversion + intent logic.
// Single-pass scans keep this O(n) with a single traversal and O(1)
// intent classification via a precompiled keyword regex map.

import type { AssistRequest, AssistResponse, GateTelemetry } from "./types";
import { fallbackScript } from "./fallback-translations";

export const CRITICAL_CAPACITY_PCT = 80;

// Precompiled once at module load — avoids rebuilding regexes per call.
const INTENT_PATTERNS: ReadonlyArray<
  [RegExp, AssistResponse["action_type"]]
> = [
  [/faint|dizzy|medical|blood|chest|heart|breath|injur|hurt|sick/, "MEDICAL_PRIORITY"],
  [/wheelchair|accessible|ramp|mobility|deaf|blind/, "ACCESSIBILITY_ROUTING"],
];

export function detectSafeGate(gates: GateTelemetry[]): GateTelemetry {
  if (gates.length === 0) throw new Error("telemetry_context is empty");
  let safe = gates[0];
  for (let i = 1; i < gates.length; i++) {
    if (gates[i].current_capacity_pct < safe.current_capacity_pct) safe = gates[i];
  }
  return safe;
}

export function detectCriticalGate(
  gates: GateTelemetry[],
): GateTelemetry | undefined {
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    if (g.current_capacity_pct >= CRITICAL_CAPACITY_PCT || g.incident_reported)
      return g;
  }
  return undefined;
}

// Single-pass scan returning both critical + safe gates.
export function scanGates(gates: GateTelemetry[]): {
  safe: GateTelemetry;
  critical: GateTelemetry | undefined;
} {
  if (gates.length === 0) throw new Error("telemetry_context is empty");
  let safe = gates[0];
  let critical: GateTelemetry | undefined;
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    if (g.current_capacity_pct < safe.current_capacity_pct) safe = g;
    if (!critical && (g.current_capacity_pct >= CRITICAL_CAPACITY_PCT || g.incident_reported)) {
      critical = g;
    }
  }
  return { safe, critical };
}

export function classifyIntent(query: string): AssistResponse["action_type"] {
  if (!query) return "STANDARD_ASSISTANCE";
  const q = query.toLowerCase();
  for (let i = 0; i < INTENT_PATTERNS.length; i++) {
    if (INTENT_PATTERNS[i][0].test(q)) return INTENT_PATTERNS[i][1];
  }
  return "STANDARD_ASSISTANCE";
}

export function buildFallback(input: AssistRequest): AssistResponse {
  const { safe, critical } = scanGates(input.telemetry_context);
  const intent = classifyIntent(input.query_text);
  const action: AssistResponse["action_type"] = critical
    ? "CRITICAL_DIVERSION_AND_ASSISTANCE"
    : intent;
  const scripts = fallbackScript(input.target_language, safe.gate_id);
  const reasoning = critical
    ? `${critical.gate_id} at ${critical.current_capacity_pct}% capacity${critical.incident_reported ? ` with active incident (${critical.incident_reported})` : ""}. Diverting fan to ${safe.gate_id} (${safe.current_capacity_pct}%, inflow ${safe.inflow_rate_per_min}/min) to prevent bottleneck. Query flagged as ${intent.toLowerCase().replace(/_/g, " ")}.`
    : `No critical gate detected. Routing fan via ${safe.gate_id} (lowest load at ${safe.current_capacity_pct}%). Intent: ${intent.toLowerCase().replace(/_/g, " ")}.`;
  return {
    action_type: action,
    explainable_reasoning: reasoning,
    volunteer_script_english: scripts.en,
    volunteer_script_translated: scripts.translated,
    recommended_gate_redirect: critical ? safe.gate_id : null,
    source: "fallback",
  };
}
