import { describe, it, expect } from "vitest";
import testData from "./test_data.json";
import {
  buildFallback,
  classifyIntent,
  detectCriticalGate,
  detectSafeGate,
} from "../diversion";
import { AssistRequestSchema, AssistResponseSchema } from "../types";

type Case = {
  name: string;
  input: unknown;
  expect: {
    action_type: string;
    recommended_gate_redirect: string | null;
    reasoning_includes: string[];
  };
};

describe("two-stage diversion logic (data-driven)", () => {
  for (const c of testData.cases as Case[]) {
    it(c.name, () => {
      const input = AssistRequestSchema.parse(c.input);
      const res = buildFallback(input);

      // Response conforms to the wire schema.
      expect(() => AssistResponseSchema.parse(res)).not.toThrow();

      expect(res.action_type).toBe(c.expect.action_type);
      expect(res.recommended_gate_redirect).toBe(
        c.expect.recommended_gate_redirect,
      );
      expect(res.source).toBe("fallback");
      for (const snippet of c.expect.reasoning_includes) {
        expect(res.explainable_reasoning.toLowerCase()).toContain(
          snippet.toLowerCase(),
        );
      }

      // A diversion must always target a real gate that exists in telemetry.
      if (res.recommended_gate_redirect) {
        const ids = input.telemetry_context.map((g) => g.gate_id);
        expect(ids).toContain(res.recommended_gate_redirect);
      }
    });
  }
});

describe("stage 1 — pre-flight rule engine", () => {
  const base = [
    { gate_id: "A", current_capacity_pct: 50, inflow_rate_per_min: 40, incident_reported: null },
    { gate_id: "B", current_capacity_pct: 30, inflow_rate_per_min: 20, incident_reported: null },
    { gate_id: "C", current_capacity_pct: 70, inflow_rate_per_min: 60, incident_reported: null },
  ];

  it("detectSafeGate returns the lowest-capacity gate", () => {
    expect(detectSafeGate(base).gate_id).toBe("B");
  });

  it("detectCriticalGate returns undefined when all gates are healthy", () => {
    expect(detectCriticalGate(base)).toBeUndefined();
  });

  it("detectCriticalGate flags gate at 80% (inclusive boundary)", () => {
    const withCritical = [...base, { gate_id: "D", current_capacity_pct: 80, inflow_rate_per_min: 90, incident_reported: null }];
    expect(detectCriticalGate(withCritical)?.gate_id).toBe("D");
  });

  it("detectCriticalGate flags an incident regardless of capacity", () => {
    const withIncident = [{ ...base[0], incident_reported: "Bag check backlog" }, ...base.slice(1)];
    expect(detectCriticalGate(withIncident)?.gate_id).toBe("A");
  });

  it("detectSafeGate throws on empty telemetry", () => {
    expect(() => detectSafeGate([])).toThrow();
  });
});

describe("stage 1 — intent classification", () => {
  it.each([
    ["fan feels faint", "MEDICAL_PRIORITY"],
    ["blood on the floor near section 12", "MEDICAL_PRIORITY"],
    ["chest pain reported", "MEDICAL_PRIORITY"],
    ["wheelchair user needs help", "ACCESSIBILITY_ROUTING"],
    ["blind visitor seeking guidance", "ACCESSIBILITY_ROUTING"],
    ["deaf fan asking about signage", "ACCESSIBILITY_ROUTING"],
    ["where is the merch tent", "STANDARD_ASSISTANCE"],
    ["", "STANDARD_ASSISTANCE"],
  ])("classifies %j → %s", (q, expected) => {
    expect(classifyIntent(q)).toBe(expected);
  });
});
