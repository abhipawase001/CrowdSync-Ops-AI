import type { GateTelemetry } from "./types";

export const INITIAL_GATES: GateTelemetry[] = [
  { gate_id: "Gate C", current_capacity_pct: 87, inflow_rate_per_min: 165, incident_reported: "Turnstile 4 jam" },
  { gate_id: "Gate D", current_capacity_pct: 38, inflow_rate_per_min: 52, incident_reported: null },
  { gate_id: "Gate E", current_capacity_pct: 61, inflow_rate_per_min: 94, incident_reported: null },
  { gate_id: "Accessible Ramp A104", current_capacity_pct: 22, inflow_rate_per_min: 18, incident_reported: null },
];

const INCIDENTS = [
  null,
  null,
  null,
  "Turnstile 4 jam",
  "Bag check backlog",
  "Medical response in progress",
  "Ticket scanner offline",
];

export function tickTelemetry(gates: GateTelemetry[]): GateTelemetry[] {
  return gates.map((g) => {
    const delta = Math.round((Math.random() - 0.45) * 8);
    const nextCap = Math.max(5, Math.min(99, g.current_capacity_pct + delta));
    const inflow = Math.max(0, g.inflow_rate_per_min + Math.round((Math.random() - 0.5) * 30));
    // Occasionally rotate the incident field to prove edge-case handling.
    const roll = Math.random();
    let incident = g.incident_reported;
    if (roll < 0.08) incident = INCIDENTS[Math.floor(Math.random() * INCIDENTS.length)];
    return {
      ...g,
      current_capacity_pct: nextCap,
      inflow_rate_per_min: inflow,
      incident_reported: incident,
    };
  });
}
