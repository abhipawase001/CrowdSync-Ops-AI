import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { TelemetryPanel } from "@/components/TelemetryPanel";
import { TelemetryCharts } from "@/components/TelemetryCharts";
import { AssistForm, type AssistFormValues } from "@/components/AssistForm";
import { GuidanceCard } from "@/components/GuidanceCard";
import {
  TelemetrySkeleton,
  ChartsSkeleton,
  ErrorBanner,
} from "@/components/Skeletons";
import { StadiumHeatmap } from "@/components/StadiumHeatmap";
import { INITIAL_GATES, tickTelemetry } from "@/lib/telemetry";
import { assistVolunteer } from "@/lib/volunteer.functions";
import { LANGUAGES } from "@/lib/types";
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

type SectionId =
  | "overview"
  | "telemetry"
  | "ai-insights"
  | "resource-division"
  | "scripts-comms"
  | "settings";

const NAV: { icon: string; label: string; id: SectionId }[] = [
  { icon: "◉", label: "Overview", id: "overview" },
  { icon: "▤", label: "Telemetry", id: "telemetry" },
  { icon: "✦", label: "AI Insights", id: "ai-insights" },
  { icon: "◇", label: "Resource Division", id: "resource-division" },
  { icon: "❯_", label: "Scripts & Comms", id: "scripts-comms" },
  { icon: "⚙", label: "Settings", id: "settings" },
];

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className="font-mono text-lg tabular-nums text-cyan-50"
      aria-label={`Current time ${now.toLocaleTimeString([], { hour12: false })}`}
    >
      {now.toLocaleTimeString([], { hour12: false })}
    </span>
  );
}

function Index() {
  const [gates, setGates] = useState<GateTelemetry[]>(INITIAL_GATES);
  const [telemetryBooted, setTelemetryBooted] = useState(false);
  const [chartsBooted, setChartsBooted] = useState(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [lastTickAt, setLastTickAt] = useState<number>(Date.now());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AssistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<(typeof LANGUAGES)[number]>("Spanish");
  const [active, setActive] = useState<SectionId>("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const gatesRef = useRef(gates);
  gatesRef.current = gates;

  // Telemetry ticker + boot delay so skeletons briefly appear on cold load.
  useEffect(() => {
    const bootT = setTimeout(() => setTelemetryBooted(true), 700);
    const bootC = setTimeout(() => setChartsBooted(true), 1200);
    const id = setInterval(() => {
      setGates((g) => tickTelemetry(g));
      setLastTickAt(Date.now());
    }, 4000);
    return () => {
      clearTimeout(bootT);
      clearTimeout(bootC);
      clearInterval(id);
    };
  }, []);

  // Staleness watchdog — flags an error if telemetry stops updating.
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastTickAt > 15000) {
        setTelemetryError(
          "Sensor stream stalled — showing last known values. Retrying automatically.",
        );
      } else {
        setTelemetryError(null);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [lastTickAt]);

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

  const scrollTo = (id: SectionId) => {
    setActive(id);
    if (id === "settings") {
      setSettingsOpen(true);
      requestAnimationFrame(() =>
        document.getElementById("section-settings")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
      return;
    }
    document.getElementById(`section-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const retryTelemetry = () => {
    setGates((g) => tickTelemetry(g));
    setLastTickAt(Date.now());
    setTelemetryError(null);
  };

  return (
    <div className="min-h-dvh bg-[#050b18] text-slate-50 selection:bg-cyan-400/30">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.10),transparent_55%),radial-gradient(circle_at_90%_90%,rgba(20,184,166,0.08),transparent_50%)]"
      />

      <div className="relative flex min-h-dvh">
        {/* Sidebar */}
        <aside
          aria-label="Primary navigation"
          className="hidden w-56 shrink-0 flex-col justify-between border-r border-cyan-500/20 bg-[#040914]/90 px-4 py-6 backdrop-blur lg:flex"
        >
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400/30 to-teal-500/20 ring-1 ring-cyan-400/50">
                <span aria-hidden className="text-lg">🏟</span>
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100">
                  Stadium Ops
                </p>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100">
                  Center
                </p>
              </div>
            </div>
            <nav aria-label="Sections">
              <ul className="space-y-1">
                {NAV.map((n) => {
                  const isActive = active === n.id;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => scrollTo(n.id)}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-cyan-400/15 text-cyan-50 ring-1 ring-cyan-300/50"
                            : "text-slate-200 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span aria-hidden className="w-5 text-center text-cyan-200">
                          {n.icon}
                        </span>
                        <span className="truncate">{n.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/30 p-3 text-center">
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-cyan-400/40 to-emerald-400/30 ring-1 ring-cyan-400/50">
              <span aria-hidden>🏟</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-100">
              Stadium Ops Center
            </p>
            <p className="text-[10px] uppercase tracking-widest text-cyan-200">
              FIFA 2026
            </p>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-cyan-500/20 bg-[#050d1c]/80 px-4 py-3 backdrop-blur sm:px-6 md:grid-cols-[auto_1fr_auto]">
            <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.28em] text-slate-100">
              Operational View
            </p>
            <p className="hidden text-center text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-100 md:block">
              World Cup 2026 · Operational View
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <div className="hidden items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white sm:flex">
                <span aria-hidden>🇧🇷</span>
                <span className="font-semibold">BRA</span>
                <span className="font-mono tabular-nums text-cyan-100">1 – 0</span>
                <span className="font-semibold">GER</span>
                <span aria-hidden>🇩🇪</span>
              </div>
              <Clock />
            </div>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className="space-y-5 px-4 py-6 sm:px-6 lg:px-8"
          >
            {/* Mobile section jump-nav */}
            <nav
              aria-label="Section jump"
              className="flex gap-2 overflow-x-auto pb-1 lg:hidden"
            >
              {NAV.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => scrollTo(n.id)}
                  aria-current={active === n.id ? "page" : undefined}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    active === n.id
                      ? "border-cyan-300 bg-cyan-400/20 text-cyan-50"
                      : "border-slate-700 bg-slate-900 text-slate-100 hover:border-cyan-300"
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </nav>

            <div
              id="section-overview"
              className="flex flex-wrap items-end justify-between gap-3 scroll-mt-24"
            >
              <div className="min-w-0">
                <h1 className="text-xl font-bold uppercase tracking-[0.14em] text-cyan-50 sm:text-2xl">
                  FIFA 2026 Stadium Operations
                  <span className="ml-2 block text-sm font-semibold text-cyan-200 sm:inline">
                    — Live Crowd Awareness
                  </span>
                </h1>
              </div>
              <div className="rounded-md border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 text-right text-xs font-mono text-cyan-50">
                <p className="text-cyan-200">Operator</p>
                <p>VOL-1042 · Sector North</p>
              </div>
            </div>

            <section
              id="section-telemetry"
              aria-labelledby="telemetry-panel-heading"
              className="scroll-mt-24"
            >
              {telemetryError && (
                <ErrorBanner
                  title="Telemetry stream degraded"
                  message={telemetryError}
                  onRetry={retryTelemetry}
                />
              )}
              <div className="grid gap-5 xl:grid-cols-3">
                <div className="xl:col-span-2">
                  <Panel
                    id="telemetry-panel-heading"
                    title="Real-Time Gate Telemetry"
                    tag={telemetryError ? undefined : "Sensor status: 98% OK"}
                  >
                    {telemetryBooted ? (
                      <TelemetryPanel gates={gates} />
                    ) : (
                      <TelemetrySkeleton />
                    )}
                  </Panel>
                </div>
                <Panel title="Live Telemetric Data">
                  {telemetryBooted ? (
                    <LiveTelemetric gates={gates} />
                  ) : (
                    <LiveTelemetricSkeleton />
                  )}
                </Panel>
              </div>
            </section>

            <section id="section-ai-insights" className="scroll-mt-24 space-y-5">
              <Panel title="Rolling Gate Metrics">
                {chartsBooted ? (
                  <TelemetryCharts gates={gates} />
                ) : (
                  <ChartsSkeleton />
                )}
              </Panel>
            </section>

            <section
              id="section-resource-division"
              className="grid gap-5 scroll-mt-24 xl:grid-cols-3"
            >
              <Panel title="Explainable AI Dispatch">
                <AssistForm onSubmit={handleSubmit} loading={loading} />
              </Panel>
              <Panel title="AI Operational Guidance">
                <GuidanceCard
                  data={data}
                  language={lang}
                  loading={loading}
                  error={error}
                />
              </Panel>
              <div id="section-scripts-comms" className="scroll-mt-24">
                <Panel title="Multilingual Scripts Assurance">
                  <MultilingualPanel
                    data={data}
                    activeLang={lang}
                    onSelect={setLang}
                  />
                </Panel>
              </div>
            </section>

            <section id="section-settings" className="scroll-mt-24">
              <Panel title="Settings">
                <SettingsPanel
                  open={settingsOpen}
                  onOpenChange={setSettingsOpen}
                />
              </Panel>
            </section>

            <footer className="border-t border-cyan-500/20 pt-4 text-[11px] uppercase tracking-widest text-slate-300">
              CrowdSync AI · Explainable server-side reasoning via Gemini with deterministic fallback · WCAG AAA-conscious UI
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}

function Panel({
  id,
  title,
  tag,
  children,
}: {
  id?: string;
  title: string;
  tag?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-[#08172b]/90 to-[#050d1c]/90 shadow-[0_0_0_1px_rgba(34,211,238,0.05),0_20px_40px_-20px_rgba(0,0,0,0.6)]">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-cyan-500/20 px-4 py-2.5">
        <h3
          id={id}
          className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100"
        >
          {title}
        </h3>
        {tag && (
          <span className="shrink-0 rounded-full border border-emerald-300/50 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-100">
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
    gates.reduce((s, g) => s + g.current_capacity_pct, 0) /
      Math.max(1, gates.length),
  );
  const incidents = gates.filter((g) => g.incident_reported).length;

  const rows = [
    {
      label: "Total Inflow / min",
      value: totalInflow.toLocaleString(),
      accent: "text-cyan-100",
    },
    { label: "Avg Gate Capacity", value: `${avgCap}%`, accent: "text-amber-200" },
    {
      label: "Active Incidents",
      value: String(incidents),
      accent: incidents ? "text-red-200" : "text-emerald-200",
    },
    { label: "Movement Velocity", value: "0.8 m/s", accent: "text-cyan-100" },
  ];

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.label}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-cyan-500/20 bg-[#04101f]/80 px-3 py-3"
        >
          <span className="min-w-0 truncate text-xs uppercase tracking-wider text-slate-200">
            {r.label}
          </span>
          <span
            className={`shrink-0 font-mono text-2xl font-bold tabular-nums ${r.accent}`}
          >
            {r.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

function LiveTelemetricSkeleton() {
  return (
    <ul className="space-y-3" aria-busy="true" aria-label="Loading summary">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center justify-between rounded-lg border border-cyan-500/10 bg-[#04101f]/60 px-3 py-3"
        >
          <span className="h-3 w-28 animate-pulse rounded bg-slate-700/70" />
          <span className="h-6 w-16 animate-pulse rounded bg-slate-700/70" />
        </li>
      ))}
    </ul>
  );
}

function MultilingualPanel({
  data,
  activeLang,
  onSelect,
}: {
  data: AssistResponse | null;
  activeLang: string;
  onSelect: (lang: (typeof LANGUAGES)[number]) => void;
}) {
  const rows = useMemo(() => LANGUAGES, []);
  return (
    <div>
      <div
        role="row"
        className="grid grid-cols-[92px_1fr_28px] gap-2 border-b border-cyan-500/20 pb-2 text-[10px] font-bold uppercase tracking-widest text-cyan-100 sm:grid-cols-[110px_1fr_28px]"
      >
        <span>Language</span>
        <span>Script</span>
        <span className="text-right" aria-label="Ready state">
          ✓
        </span>
      </div>
      <ul className="mt-2 space-y-1.5" role="list">
        {rows.map((l) => {
          const isActive = l === activeLang;
          const hasData = data && isActive;
          const text = hasData
            ? data!.volunteer_script_translated
            : isActive
              ? "Selected — awaiting dispatch."
              : "Standby — submit a dispatch.";
          const rtl = l === "Arabic";
          return (
            <li key={l}>
              <button
                type="button"
                onClick={() => onSelect(l)}
                aria-pressed={isActive}
                aria-label={`Preview script in ${l}${hasData ? "" : " (pending dispatch)"}`}
                className={`grid w-full grid-cols-[92px_1fr_28px] items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors sm:grid-cols-[110px_1fr_28px] ${
                  isActive
                    ? "bg-cyan-400/15 ring-1 ring-cyan-300/50"
                    : "hover:bg-white/10"
                }`}
              >
                <span className="min-w-0 truncate font-semibold text-cyan-50">
                  {l}
                </span>
                <span
                  lang={rtl ? "ar" : undefined}
                  dir={rtl ? "rtl" : undefined}
                  className={`min-w-0 break-words sm:truncate ${
                    hasData
                      ? "text-slate-50"
                      : isActive
                        ? "text-cyan-100"
                        : "text-slate-300"
                  }`}
                  title={text}
                >
                  {text}
                </span>
                <span
                  aria-hidden
                  className={`text-right text-sm ${
                    hasData ? "text-emerald-300" : "text-slate-400"
                  }`}
                >
                  {hasData ? "✓" : "○"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SettingsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(true);
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls="settings-body"
        className="flex w-full items-center justify-between rounded-lg border border-cyan-500/25 bg-cyan-950/30 px-3 py-2 text-sm font-medium text-cyan-50 hover:bg-cyan-950/50"
      >
        <span>Operator preferences</span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <fieldset
          id="settings-body"
          className="space-y-3 rounded-lg border border-cyan-500/20 bg-[#04101f]/70 p-3 text-sm text-slate-100"
        >
          <legend className="sr-only">Operator preferences</legend>
          <Toggle
            label="Reduced motion"
            checked={reducedMotion}
            onChange={setReducedMotion}
          />
          <Toggle
            label="High contrast (AAA)"
            checked={highContrast}
            onChange={setHighContrast}
          />
          <Toggle
            label="Incident notifications"
            checked={notifications}
            onChange={setNotifications}
          />
        </fieldset>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-white/5">
      <span className="text-slate-100">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full border transition-colors ${
          checked
            ? "border-cyan-300 bg-cyan-400/70"
            : "border-slate-600 bg-slate-800"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
