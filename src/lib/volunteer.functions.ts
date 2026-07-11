import { createServerFn } from "@tanstack/react-start";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import {
  AssistRequestSchema,
  type AssistRequest,
  type AssistResponse,
} from "./types";
import { fallbackScript } from "./fallback-translations";

// Small, strict schema for structured output.
const LlmSchema = z.object({
  action_type: z.enum([
    "STANDARD_ASSISTANCE",
    "CRITICAL_DIVERSION_AND_ASSISTANCE",
    "MEDICAL_PRIORITY",
    "ACCESSIBILITY_ROUTING",
  ]),
  explainable_reasoning: z.string(),
  volunteer_script_english: z.string(),
  volunteer_script_translated: z.string(),
  recommended_gate_redirect: z.string().nullable(),
});

function detectSafeGate(input: AssistRequest) {
  const sorted = [...input.telemetry_context].sort(
    (a, b) => a.current_capacity_pct - b.current_capacity_pct,
  );
  return sorted[0];
}

function detectCriticalGate(input: AssistRequest) {
  return input.telemetry_context.find(
    (g) => g.current_capacity_pct >= 80 || g.incident_reported,
  );
}

function classifyIntent(query: string): AssistResponse["action_type"] {
  const q = query.toLowerCase();
  if (/faint|dizzy|medical|blood|chest|heart|breath|injur|hurt|sick/.test(q))
    return "MEDICAL_PRIORITY";
  if (/wheelchair|accessible|ramp|mobility|deaf|blind/.test(q))
    return "ACCESSIBILITY_ROUTING";
  return "STANDARD_ASSISTANCE";
}

function buildFallback(input: AssistRequest): AssistResponse {
  const critical = detectCriticalGate(input);
  const safe = detectSafeGate(input);
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

export const assistVolunteer = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => AssistRequestSchema.parse(raw))
  .handler(async ({ data }): Promise<AssistResponse> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return buildFallback(data);

    const critical = detectCriticalGate(data);
    const safe = detectSafeGate(data);
    const intent = classifyIntent(data.query_text);

    const provider = createOpenAICompatible({
      name: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey,
    });
    const model = provider("gemini-2.5-flash");

    const prompt = `You are CrowdSync AI, a real-time Operations Co-Pilot advising a volunteer at the FIFA World Cup 2026.

VOLUNTEER CONTEXT
- Zone: ${data.zone}
- Fan situation / query: "${data.query_text}"
- Detected intent (heuristic): ${intent}
- Target translation language: ${data.target_language}

LIVE GATE TELEMETRY
${JSON.stringify(data.telemetry_context, null, 2)}

PRE-FLIGHT ANALYSIS
- Critical gate detected: ${critical ? `${critical.gate_id} at ${critical.current_capacity_pct}% (incident: ${critical.incident_reported ?? "none"})` : "none"}
- Lowest-load gate: ${safe.gate_id} at ${safe.current_capacity_pct}% with inflow ${safe.inflow_rate_per_min}/min

INSTRUCTIONS
1. If a gate is >=80% or has an incident, choose 'CRITICAL_DIVERSION_AND_ASSISTANCE' and set recommended_gate_redirect to a safer gate id from the telemetry.
2. If the fan situation involves medical distress, prefer 'MEDICAL_PRIORITY'. If it involves accessibility needs, prefer 'ACCESSIBILITY_ROUTING'. Otherwise 'STANDARD_ASSISTANCE'.
3. 'explainable_reasoning': one crisp sentence for the ops-room log — cite the numbers you used.
4. 'volunteer_script_english': short, warm, reassuring, second-person. <= 45 words.
5. 'volunteer_script_translated': the SAME script translated into ${data.target_language}. Natural, culturally appropriate, reassuring register — not a literal word-for-word translation.
6. Only reference gate ids that appear in the telemetry. Set recommended_gate_redirect to null when no diversion is needed.`;

    try {
      const { output } = await generateText({
        model,
        prompt,
        output: Output.object({ schema: LlmSchema }),
      });
      return { ...output, source: "gemini" };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try {
          const parsed = LlmSchema.parse(JSON.parse(error.text ?? "{}"));
          return { ...parsed, source: "gemini" };
        } catch {
          /* fall through */
        }
      }
      console.error("[assistVolunteer] Gemini error:", error);
      return buildFallback(data);
    }
  });
