import { describe, it, expect } from "vitest";
import { AssistRequestSchema, GateTelemetrySchema } from "../types";
import { buildFallback, detectSafeGate, scanGates } from "../diversion";

const baseGate = {
  gate_id: "Gate A",
  current_capacity_pct: 40,
  inflow_rate_per_min: 50,
  incident_reported: null,
};

describe("edge case: total telemetry outage", () => {
  it("rejects empty telemetry at the schema boundary", () => {
    const result = AssistRequestSchema.safeParse({
      zone: "North",
      query_text: "fan needs water",
      target_language: "Spanish",
      telemetry_context: [],
    });
    expect(result.success).toBe(false);
  });

  it("detectSafeGate throws on empty array (defensive)", () => {
    expect(() => detectSafeGate([])).toThrow(/empty/);
  });

  it("scanGates throws on empty array (defensive)", () => {
    expect(() => scanGates([])).toThrow(/empty/);
  });
});

describe("edge case: NaN / null telemetry values", () => {
  it("rejects NaN capacity", () => {
    expect(GateTelemetrySchema.safeParse({ ...baseGate, current_capacity_pct: Number.NaN }).success).toBe(false);
  });
  it("rejects Infinity inflow", () => {
    expect(GateTelemetrySchema.safeParse({ ...baseGate, inflow_rate_per_min: Number.POSITIVE_INFINITY }).success).toBe(false);
  });
  it("rejects null capacity", () => {
    expect(GateTelemetrySchema.safeParse({ ...baseGate, current_capacity_pct: null }).success).toBe(false);
  });
});

describe("edge case: extreme telemetry surges", () => {
  it("rejects inflow of 9,999,999", () => {
    expect(GateTelemetrySchema.safeParse({ ...baseGate, inflow_rate_per_min: 9_999_999 }).success).toBe(false);
  });
  it("rejects negative capacity (-50%)", () => {
    expect(GateTelemetrySchema.safeParse({ ...baseGate, current_capacity_pct: -50 }).success).toBe(false);
  });
  it("rejects impossible 500% capacity", () => {
    expect(GateTelemetrySchema.safeParse({ ...baseGate, current_capacity_pct: 500 }).success).toBe(false);
  });
  it("handles a valid boundary surge (100% + 1000/min) without throwing", () => {
    const req = AssistRequestSchema.parse({
      zone: "North",
      query_text: "surge test",
      target_language: "German",
      telemetry_context: [
        { gate_id: "Gate Z", current_capacity_pct: 100, inflow_rate_per_min: 1000, incident_reported: null },
        { gate_id: "Gate Y", current_capacity_pct: 10, inflow_rate_per_min: 5, incident_reported: null },
      ],
    });
    const res = buildFallback(req);
    expect(res.action_type).toBe("CRITICAL_DIVERSION_AND_ASSISTANCE");
    expect(res.recommended_gate_redirect).toBe("Gate Y");
  });
});

describe("edge case: character flooding in query_text", () => {
  it("rejects a 5,000-character query at the schema boundary (500 char cap)", () => {
    const flood = "x".repeat(5000);
    const result = AssistRequestSchema.safeParse({
      zone: "North",
      query_text: flood,
      target_language: "Spanish",
      telemetry_context: [baseGate],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a query at the exact 500 character limit", () => {
    const q = "a".repeat(500);
    const result = AssistRequestSchema.safeParse({
      zone: "North",
      query_text: q,
      target_language: "Spanish",
      telemetry_context: [baseGate],
    });
    expect(result.success).toBe(true);
  });

  it("rejects overlong gate_id (>40 chars)", () => {
    expect(GateTelemetrySchema.safeParse({ ...baseGate, gate_id: "G".repeat(41) }).success).toBe(false);
  });

  it("rejects overlong incident_reported (>200 chars)", () => {
    expect(GateTelemetrySchema.safeParse({ ...baseGate, incident_reported: "!".repeat(201) }).success).toBe(false);
  });
});

describe("edge case: telemetry_context array bounds", () => {
  it("rejects an array of 13 gates (>12 cap)", () => {
    const gates = Array.from({ length: 13 }, (_, i) => ({ ...baseGate, gate_id: `G${i}` }));
    const result = AssistRequestSchema.safeParse({
      zone: "North",
      query_text: "many gates",
      target_language: "French",
      telemetry_context: gates,
    });
    expect(result.success).toBe(false);
  });
});
