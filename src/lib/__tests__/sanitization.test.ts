import { describe, it, expect } from "vitest";
import { AssistRequestSchema, AssistResponseSchema } from "../types";
import { buildFallback, classifyIntent } from "../diversion";

const baseGate = {
  gate_id: "Gate A",
  current_capacity_pct: 40,
  inflow_rate_per_min: 50,
  incident_reported: null,
};

const req = (query_text: string) => ({
  zone: "North",
  query_text,
  target_language: "Spanish" as const,
  telemetry_context: [baseGate],
});

describe("query_text sanitization — prompt-injection hardening", () => {
  it("strips ASCII control characters", () => {
    const parsed = AssistRequestSchema.parse(req("help\u0007 fan\u001B needs water"));
    expect(parsed.query_text).toBe("help fan needs water");
  });

  it("strips zero-width and bidi-override characters", () => {
    const parsed = AssistRequestSchema.parse(
      req("wheel\u200Bchair\u202E user\u2066 needs ramp"),
    );
    expect(parsed.query_text).toBe("wheelchair user needs ramp");
  });

  it("trims surrounding whitespace", () => {
    const parsed = AssistRequestSchema.parse(req("   medical emergency   "));
    expect(parsed.query_text).toBe("medical emergency");
  });

  it("rejects a string that becomes < 3 visible chars after stripping", () => {
    const bad = "\u200B\u200B\u200B";
    const result = AssistRequestSchema.safeParse(req(`ab${bad}`));
    expect(result.success).toBe(false);
  });

  it("keeps sanitized query semantically intact for the intent classifier", () => {
    const parsed = AssistRequestSchema.parse(req("fan feels\u200B dizzy"));
    expect(classifyIntent(parsed.query_text)).toBe("MEDICAL_PRIORITY");
  });
});

describe("response contract — round-trip integrity", () => {
  it("buildFallback output always parses via AssistResponseSchema", () => {
    const parsed = AssistRequestSchema.parse(req("wheelchair user"));
    const res = buildFallback(parsed);
    expect(() => AssistResponseSchema.parse(res)).not.toThrow();
    expect(res.action_type).toBe("ACCESSIBILITY_ROUTING");
  });

  it("critical diversion never redirects to a gate not in telemetry", () => {
    const parsed = AssistRequestSchema.parse({
      zone: "North",
      query_text: "surge at gate A",
      target_language: "French",
      telemetry_context: [
        { ...baseGate, gate_id: "A", current_capacity_pct: 95 },
        { ...baseGate, gate_id: "B", current_capacity_pct: 20 },
      ],
    });
    const res = buildFallback(parsed);
    expect(res.action_type).toBe("CRITICAL_DIVERSION_AND_ASSISTANCE");
    expect(["A", "B"]).toContain(res.recommended_gate_redirect);
  });
});
