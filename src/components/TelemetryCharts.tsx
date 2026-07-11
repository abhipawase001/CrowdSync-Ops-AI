import { useEffect, useRef } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import type { GateTelemetry } from "@/lib/types";

type HistoryPoint = { t: number; label: string } & Record<string, number | string | null>;

const COLORS = ["#22d3ee", "#f59e0b", "#a78bfa", "#34d399", "#f472b6", "#60a5fa"];
const MAX_POINTS = 30;

export function TelemetryCharts({ gates }: { gates: GateTelemetry[] }) {
  const historyRef = useRef<HistoryPoint[]>([]);

  // Append a new snapshot each time gates change.
  const now = Date.now();
  const label = new Date(now).toLocaleTimeString([], { hour12: false });
  const point: HistoryPoint = { t: now, label };
  gates.forEach((g) => {
    point[`${g.gate_id}__cap`] = g.current_capacity_pct;
    point[`${g.gate_id}__flow`] = g.inflow_rate_per_min;
  });
  historyRef.current = [...historyRef.current.slice(-(MAX_POINTS - 1)), point];
  const data = historyRef.current;

  // Force chart re-render when gates change (data derived above).
  useEffect(() => {}, [gates]);

  return (
    <section
      aria-labelledby="charts-heading"
      className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2
          id="charts-heading"
          className="text-sm font-semibold uppercase tracking-widest text-cyan-300"
        >
          Real-Time Gate Dashboard
        </h2>
        <span className="text-xs text-slate-400">Rolling {MAX_POINTS * 4}s window</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartBlock
          title="Capacity %"
          suffix="%"
          domain={[0, 100]}
          gates={gates}
          data={data}
          suffixKey="cap"
        />
        <ChartBlock
          title="Inflow rate (people / min)"
          suffix="/min"
          gates={gates}
          data={data}
          suffixKey="flow"
        />
      </div>

      <IncidentStrip gates={gates} />
    </section>
  );
}

function ChartBlock({
  title,
  suffix,
  domain,
  gates,
  data,
  suffixKey,
}: {
  title: string;
  suffix: string;
  domain?: [number, number];
  gates: GateTelemetry[];
  data: HistoryPoint[];
  suffixKey: "cap" | "flow";
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <p className="mb-2 text-xs font-medium text-slate-300">{title}</p>
      <div className="h-52 w-full" role="img" aria-label={`${title} time series per gate`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 10 }}
              stroke="#334155"
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 10 }}
              stroke="#334155"
              domain={domain ?? ["auto", "auto"]}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(v: number, name: string) => [`${v}${suffix}`, name.replace(`__${suffixKey}`, "")]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
              formatter={(v: string) => v.replace(`__${suffixKey}`, "")}
            />
            {gates.map((g, i) => (
              <Line
                key={g.gate_id}
                type="monotone"
                dataKey={`${g.gate_id}__${suffixKey}`}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function IncidentStrip({ gates }: { gates: GateTelemetry[] }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-medium text-slate-300">Incident status</p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
        {gates.map((g) => {
          const critical = g.current_capacity_pct >= 80 || !!g.incident_reported;
          return (
            <li
              key={g.gate_id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                critical
                  ? "border-red-500/50 bg-red-950/40 text-red-200"
                  : "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"
              }`}
            >
              <span className="font-semibold">{g.gate_id}</span>
              <span>{g.incident_reported ?? (critical ? "At capacity" : "Nominal")}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
