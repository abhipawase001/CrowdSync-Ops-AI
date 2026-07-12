// Pure, framework-free diversion + intent logic.
// Extracted from volunteer.functions.ts so it can be unit-tested without
// pulling in the server-function runtime.

import type { AssistRequest, AssistResponse, GateTelemetry } from "./types";
import { fallbackScript } from "./fallback-translations";

export function detectSafeGate(gates: GateTelemetry[]): GateTelemetry {
  if (gates.length === 0) throw new Error("telemetry_context is empty");
  return [...gates].sort(
    (a, b) => a.current_capacity_pct - b.current_capacity_pct,
  )[0];
}

export function detectCriticalGate(
  gates: GateTelemetry[],
): GateTelemetry | undefined {
  return gates.find(
    (g) => g.current_capacity_pct >= 80 || g.incident_reported,
  );
}

export function classifyIntent(query: string): AssistResponse["action_type"] {
  const q = query.toLowerCase();
  if (/faint|dizzy|medical|blood|chest|heart|breath|injur|hurt|sick/.test(q))
    return "MEDICAL_PRIORITY";
  if (/wheelchair|accessible|ramp|mobility|deaf|blind/.test(q))
    return "ACCESSIBILITY_ROUTING";
  return "STANDARD_ASSISTANCE";
}

export function buildFallback(input: AssistRequest): AssistResponse {
  const critical = detectCriticalGate(input.telemetry_context);
  const safe = detectSafeGate(input.telemetry_context);
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
