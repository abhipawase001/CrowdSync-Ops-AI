import type { GateTelemetry } from "@/lib/types";
import { clamp } from "@/lib/utils";

export function TelemetryPanel({ gates }: { gates: GateTelemetry[] }) {
  const safeGates = Array.isArray(gates) ? gates : [];
  return (
    <section aria-labelledby="telemetry-heading" className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 id="telemetry-heading" className="text-sm font-semibold uppercase tracking-widest text-cyan-300">
          Live Gate Telemetry
        </h2>
        <span className="flex items-center gap-2 text-xs text-slate-400" aria-live="polite">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Streaming
        </span>
      </div>
      {safeGates.length === 0 ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
          No gate telemetry available. Awaiting sensor stream…
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {safeGates.map((g) => {
            const cap = clamp(g?.current_capacity_pct, 0, 100);
            const inflow = clamp(g?.inflow_rate_per_min, 0, 1000);
            const critical = cap >= 80 || !!g?.incident_reported;
            const warn = !critical && cap >= 60;
            const barColor = critical ? "bg-red-500" : warn ? "bg-amber-400" : "bg-emerald-400";
            const borderColor = critical
              ? "border-red-500/50 shadow-red-500/20 shadow-lg"
              : warn
                ? "border-amber-400/40"
                : "border-slate-800";
            return (
              <li
                key={g?.gate_id ?? Math.random().toString(36)}
                className={`rounded-xl border ${borderColor} bg-slate-900/70 p-4 transition-all`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-slate-100">{g?.gate_id ?? "Unknown"}</span>
                  <span
                    className={`text-2xl font-bold tabular-nums ${critical ? "text-red-400" : warn ? "text-amber-300" : "text-emerald-300"}`}
                    aria-label={`${cap} percent capacity`}
                  >
                    {cap}%
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
                  role="progressbar"
                  aria-valuenow={cap}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full ${barColor} transition-all duration-500`}
                    style={{ width: `${cap}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Inflow <span className="text-slate-200 tabular-nums">{inflow}</span>/min
                </p>
                {g?.incident_reported ? (
                  <p className="mt-2 inline-block rounded-md bg-red-950/60 px-2 py-0.5 text-xs font-medium text-red-300 ring-1 ring-red-500/40">
                    ⚠ {g.incident_reported}
                  </p>
                ) : (
                  <p className="mt-2 inline-block rounded-md bg-emerald-950/40 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-500/20">
                    Nominal
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

