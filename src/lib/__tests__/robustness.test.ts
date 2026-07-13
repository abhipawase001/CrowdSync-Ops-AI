import { describe, it, expect } from "vitest";
import { clamp } from "../utils";
import { tickTelemetry } from "../telemetry";
import { buildFallback, scanGates } from "../diversion";
import { AssistRequestSchema } from "../types";

describe("clamp — out-of-bounds payload guard", () => {
  it("clamps -50 to 0", () => expect(clamp(-50, 0, 100)).toBe(0));
  it("clamps 999 to 100", () => expect(clamp(999, 0, 100)).toBe(100));
  it("returns min for NaN", () => expect(clamp(NaN, 0, 100)).toBe(0));
  it("returns min for null", () => expect(clamp(null, 0, 100)).toBe(0));
  it("returns min for undefined", () => expect(clamp(undefined, 0, 100)).toBe(0));
  it("returns min for Infinity", () => expect(clamp(Infinity, 0, 100)).toBe(0));
  it("returns min for -Infinity", () => expect(clamp(-Infinity, 0, 100)).toBe(0));
  it("returns min for non-numeric string", () => expect(clamp("abc", 0, 100)).toBe(0));
  it("coerces numeric string", () => expect(clamp("42", 0, 100)).toBe(42));
  it("passes through in-range value", () => expect(clamp(55, 0, 100)).toBe(55));
});

describe("tickTelemetry — empty / malformed input", () => {
  it("returns [] for empty array", () => expect(tickTelemetry([])).toEqual([]));
  it("returns [] for null (defensive)", () =>
    // deliberately testing runtime hardening beyond the type signature
    expect(tickTelemetry(null as unknown as [])).toEqual([]));
  it("returns [] for undefined (defensive)", () =>
    expect(tickTelemetry(undefined as unknown as [])).toEqual([]));
  it("clamps spoofed -50% and 9999999 inflow into legal range", () => {
    const out = tickTelemetry([
      { gate_id: "Spoofed", current_capacity_pct: -50, inflow_rate_per_min: 9_999_999, incident_reported: null },
    ]);
    expect(out[0].current_capacity_pct).toBeGreaterThanOrEqual(0);
    expect(out[0].current_capacity_pct).toBeLessThanOrEqual(100);
    expect(out[0].inflow_rate_per_min).toBeGreaterThanOrEqual(0);
    expect(out[0].inflow_rate_per_min).toBeLessThanOrEqual(1000);
  });
});

describe("prompt injection safeguard — 500 char cap", () => {
  it("rejects a 10,000-char query with a validation error", () => {
    const result = AssistRequestSchema.safeParse({
      zone: "North",
      query_text: "x".repeat(10_000),
      target_language: "Spanish",
      telemetry_context: [
        { gate_id: "Gate A", current_capacity_pct: 40, inflow_rate_per_min: 50, incident_reported: null },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Message should be user-friendly-mappable (mentions length limit).
      const msgs = result.error.issues.map((i) => i.message).join(" ");
      expect(msgs.length).toBeGreaterThan(0);
    }
  });
});

describe("scanGates + buildFallback under stress", () => {
  it("scanGates surfaces a critical gate at exactly 80%", () => {
    const { critical } = scanGates([
      { gate_id: "A", current_capacity_pct: 80, inflow_rate_per_min: 100, incident_reported: null },
      { gate_id: "B", current_capacity_pct: 20, inflow_rate_per_min: 20, incident_reported: null },
    ]);
    expect(critical?.gate_id).toBe("A");
  });

  it("buildFallback never throws on a single-gate array", () => {
    const req = AssistRequestSchema.parse({
      zone: "North",
      query_text: "hi",
      target_language: "Spanish",
      telemetry_context: [
        { gate_id: "Only", current_capacity_pct: 55, inflow_rate_per_min: 100, incident_reported: null },
      ],
    });
    expect(() => buildFallback(req)).not.toThrow();
  });
});
