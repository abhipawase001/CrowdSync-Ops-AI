import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TelemetryPanel } from "@/components/TelemetryPanel";
import { TelemetryCharts } from "@/components/TelemetryCharts";
import { AssistForm, type AssistFormValues } from "@/components/AssistForm";
import { GuidanceCard } from "@/components/GuidanceCard";
import { INITIAL_GATES, tickTelemetry } from "@/lib/telemetry";
import { assistVolunteer } from "@/lib/volunteer.functions";
import type { AssistResponse, GateTelemetry } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stadium Ops Center — CrowdSync AI Volunteer Co-Pilot" },
      {
        name: "description",
        content:
          "Real-time explainable AI routing, live crowd telemetry, and multilingual volunteer scripts for FIFA World Cup 2026 stadium operations.",
      },
      { property: "og:title", content: "Stadium Ops Center — CrowdSync AI" },
      {
        property: "og:description",
        content:
          "Explainable AI dispatch, crowd-aware gate diversion, and reassuring multilingual scripts for stadium ops.",
      },
    ],
  }),
  component: Index,
});

const NAV = [
  { icon: "◉", label: "Overview", active: true },
  { icon: "▤", label: "Telemetry" },
  { icon: "✦", label: "AI Insights" },
  { icon: "◇", label: "Resource Division" },
  { icon: "❯_", label: "Scripts & Comms" },
  { icon: "⚙", label: "Settings" },
];

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-lg tabular-nums text-cyan-100">
      {now.toLocaleTimeString([], { hour12: false })}
    </span>
  );
}

function Index() {
  const [gates, setGates] = useState<GateTelemetry[]>(INITIAL_GATES);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AssistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState("Spanish");
  const gatesRef = useRef(gates);
  gatesRef.current = gates;

  useEffect(() => {
    const id = setInterval(() => setGates((g) => tickTelemetry(g)), 4000);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (v: AssistFormValues) => {
    setLoading(true);
    setError(null);
    setLang(v.target_language);
    try {
      const res = await assistVolunteer({
        data: {
          volunteer_id: "VOL-1042",
          zone: v.zone,
          query_text: v.query_text,
          target_language: v.target_language,
          telemetry_context: gatesRef.current,
        },
      });
      setData(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050b18] text-slate-100 selection:bg-cyan-400/30">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.10),transparent_55%),radial-gradient(circle_at_90%_90%,rgba(20,184,166,0.08),transparent_50%)]"
      />

      <div className="relative flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col justify-between border-r border-cyan-500/10 bg-[#040914]/80 px-4 py-6 backdrop-blur lg:flex">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-cyan-400/30 to-teal-500/20 ring-1 ring-cyan-400/40">
                <span aria-hidden className="text-lg">🏟</span>
              </div>
              <div className="leading-tight">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                  Stadium Ops
                </p>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                  Center
                </p>
              </div>
            </div>
            <nav className="space-y-1">
              {NAV.map((n) => (
                <button
                  key={n.label}
                  type="button"
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    n.active
                      ? "bg-cyan-400/10 text-cyan-100 ring-1 ring-cyan-400/30"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                  }`}
                >
                  <span aria-hidden className="w-5 text-center text-cyan-300/80">
                    {n.icon}
                  </span>
                  {n.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="rounded-xl border border-cyan-500/10 bg-cyan-950/20 p-3 text-center">
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-cyan-400/40 to-emerald-400/30 ring-1 ring-cyan-400/40">
              <span aria-hidden>🏟</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-200">
              Stadium Ops Center
            </p>
            <p className="text-[10px] uppercase tracking-widest text-cyan-300/70">
              FIFA 2026
            </p>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          {/* Top bar */}
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-500/10 bg-[#050d1c]/70 px-6 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <span aria-hidden className="text-slate-400">☰</span>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
                Operational View
              </p>
            </div>
            <p className="hidden text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-200/80 md:block">
              World Cup 2026 · Operational View
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-1.5 text-sm">
                <span aria-hidden>🇧🇷</span>
                <span className="font-semibold">BRA</span>
                <span className="font-mono tabular-nums text-cyan-200">1 – 0</span>
                <span className="font-semibold">GER</span>
                <span aria-hidden>🇩🇪</span>
              </div>
              <Clock />
            </div>
          </header>

          <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
            {/* Title strip */}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold uppercase tracking-[0.16em] text-cyan-100 sm:text-2xl">
                  FIFA 2026 Stadium Operations Dashboard
                  <span className="ml-2 text-cyan-400/70">— Live Crowd Awareness</span>
                </h1>
              </div>
              <div className="rounded-md border border-cyan-500/20 bg-cyan-950/30 px-3 py-1.5 text-right text-xs font-mono">
                <p className="text-cyan-300/70">Operator</p>
                <p className="text-cyan-100">VOL-1042 · Sector North</p>
              </div>
            </div>

            {/* Top row: telemetry (wide) + live telemetric summary */}
            <div className="grid gap-5 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <Panel title="Real-Time Gate Telemetry" tag="Sensor status: 98% OK">
                  <TelemetryPanel gates={gates} />
                </Panel>
              </div>
              <Panel title="Live Telemetric Data">
                <LiveTelemetric gates={gates} />
              </Panel>
            </div>

            {/* Charts row */}
            <Panel title="Rolling Gate Metrics">
              <TelemetryCharts gates={gates} />
            </Panel>

            {/* Bottom row: dispatch + AI guidance + multilingual */}
            <div className="grid gap-5 xl:grid-cols-3">
              <Panel title="Explainable AI Dispatch">
                <AssistForm onSubmit={handleSubmit} loading={loading} />
              </Panel>
              <Panel title="AI Operational Guidance">
                <GuidanceCard data={data} language={lang} loading={loading} error={error} />
              </Panel>
              <Panel title="Multilingual Scripts Assurance">
                <MultilingualPanel data={data} activeLang={lang} />
              </Panel>
            </div>

            <footer className="border-t border-cyan-500/10 pt-4 text-[11px] uppercase tracking-widest text-slate-500">
              CrowdSync AI · Explainable server-side reasoning via Gemini with deterministic fallback · WCAG-conscious UI
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  tag,
  children,
}: {
  title: string;
  tag?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative rounded-2xl border border-cyan-500/15 bg-gradient-to-b from-[#08172b]/90 to-[#050d1c]/90 shadow-[0_0_0_1px_rgba(34,211,238,0.04),0_20px_40px_-20px_rgba(0,0,0,0.6)]">
      <header className="flex items-center justify-between border-b border-cyan-500/10 px-4 py-2.5">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200">
          {title}
        </h3>
        {tag && (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
            {tag}
          </span>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function LiveTelemetric({ gates }: { gates: GateTelemetry[] }) {
  const totalInflow = gates.reduce((s, g) => s + g.inflow_rate_per_min, 0);
  const avgCap = Math.round(
    gates.reduce((s, g) => s + g.current_capacity_pct, 0) / Math.max(1, gates.length),
  );
  const incidents = gates.filter((g) => g.incident_reported).length;

  const rows = [
    { label: "Total Inflow / min", value: totalInflow.toLocaleString(), accent: "text-cyan-300" },
    { label: "Avg Gate Capacity", value: `${avgCap}%`, accent: "text-amber-300" },
    { label: "Active Incidents", value: String(incidents), accent: incidents ? "text-red-300" : "text-emerald-300" },
    { label: "Movement Velocity", value: "0.8 m/s", accent: "text-cyan-200" },
  ];

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.label}
          className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/10 bg-[#04101f]/70 px-3 py-3"
        >
          <span className="text-xs uppercase tracking-wider text-slate-400">{r.label}</span>
          <span className={`font-mono text-2xl font-bold tabular-nums ${r.accent}`}>
            {r.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

const LANG_ROWS = ["Spanish", "French", "Arabic", "Portuguese", "Hindi", "German"];

function MultilingualPanel({
  data,
  activeLang,
}: {
  data: AssistResponse | null;
  activeLang: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-[110px_1fr_28px] gap-2 border-b border-cyan-500/10 pb-2 text-[10px] font-bold uppercase tracking-widest text-cyan-300/80">
        <span>Language</span>
        <span>Script</span>
        <span className="text-right">✓</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {LANG_ROWS.map((l) => {
          const isActive = data && l === activeLang;
          const text = isActive
            ? data!.volunteer_script_translated
            : "Standby — submit a dispatch to generate.";
          const rtl = l === "Arabic";
          return (
            <li
              key={l}
              className={`grid grid-cols-[110px_1fr_28px] items-center gap-2 rounded-md px-2 py-2 text-xs ${
                isActive ? "bg-cyan-400/10 ring-1 ring-cyan-400/30" : "hover:bg-white/5"
              }`}
            >
              <span className="font-semibold text-cyan-100">{l}</span>
              <span
                lang={rtl ? "ar" : undefined}
                dir={rtl ? "rtl" : undefined}
                className={`truncate ${isActive ? "text-slate-100" : "text-slate-500"}`}
                title={text}
              >
                {text}
              </span>
              <span
                aria-label={isActive ? "Ready" : "Pending"}
                className={`text-right text-sm ${isActive ? "text-emerald-400" : "text-slate-600"}`}
              >
                {isActive ? "✓" : "○"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
