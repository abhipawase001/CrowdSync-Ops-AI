import { z } from "zod";

const finiteInt = (min: number, max: number) =>
  z
    .number()
    .refine((n) => Number.isFinite(n), { message: "must be finite" })
    .int()
    .min(min)
    .max(max);

export const GateTelemetrySchema = z.object({
  gate_id: z.string().min(1).max(40),
  current_capacity_pct: finiteInt(0, 100),
  inflow_rate_per_min: finiteInt(0, 1000),
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
  query_text: z.string().min(3).max(500),
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
