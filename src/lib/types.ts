import { z } from "zod";

// z.number() already rejects NaN; .int() rejects non-integers and Infinity.
const boundedInt = (min: number, max: number) =>
  z.number().int().min(min).max(max);

export const GateTelemetrySchema = z.object({
  gate_id: z.string().min(1).max(40),
  current_capacity_pct: boundedInt(0, 100),
  inflow_rate_per_min: boundedInt(0, 1000),
  incident_reported: z.string().max(200).nullable(),
});



export type GateTelemetry = z.infer<typeof GateTelemetrySchema>;

export const LANGUAGES = [
  "Spanish",
  "French",
  "Arabic",
  "Portuguese",
  "Hindi",
  "German",
] as const;

export const AssistRequestSchema = z.object({
  volunteer_id: z.string().min(1).max(40).default("VOL-1042"),
  zone: z.string().min(1).max(80),
  query_text: z
    .string()
    .min(3)
    .max(500)
    // Strip ASCII control chars and zero-width / bidi-override characters —
    // common vectors used to hide prompt-injection instructions inside
    // benign-looking text before it reaches the reasoning pipeline.
    .transform((s) =>
      s
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
        .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
        .trim(),
    )
    .refine((s) => s.length >= 3, {
      message: "Query must contain at least 3 visible characters.",
    }),
  target_language: z.enum(LANGUAGES),
  telemetry_context: z.array(GateTelemetrySchema).min(1).max(12),
});
export type AssistRequest = z.infer<typeof AssistRequestSchema>;

export const AssistResponseSchema = z.object({
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
  source: z.enum(["gemini", "fallback"]),
});
export type AssistResponse = z.infer<typeof AssistResponseSchema>;
