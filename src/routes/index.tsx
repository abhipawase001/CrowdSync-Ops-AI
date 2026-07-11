import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TelemetryPanel } from "@/components/TelemetryPanel";
import { AssistForm, type AssistFormValues } from "@/components/AssistForm";
import { GuidanceCard } from "@/components/GuidanceCard";
import { INITIAL_GATES, tickTelemetry } from "@/lib/telemetry";
import { assistVolunteer } from "@/lib/volunteer.functions";
import type { AssistResponse, GateTelemetry } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CrowdSync AI — Volunteer Co-Pilot for Smart Stadium Ops" },
      {
        name: "description",
        content:
          "Real-time explainable AI routing and multilingual scripts for stadium volunteers at the FIFA World Cup 2026.",
      },
      { property: "og:title", content: "CrowdSync AI — Volunteer Co-Pilot" },
      {
        property: "og:description",
        content:
          "Explainable AI dispatch, crowd-aware gate diversion, and reassuring multilingual scripts for stadium ops.",
      },
    ],
  }),
  component: Index,
});

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
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-400/30">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_50%)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              <span aria-hidden>⚡</span> CrowdSync AI
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Volunteer Co-Pilot & Operations Engine
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Real-time explainable AI orchestration for FIFA World Cup 2026 stadium operations.
              Live telemetry, crowd-aware diversion, and reassuring multilingual scripts — in under two seconds.
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-right text-xs">
            <p className="text-slate-400">Operator</p>
            <p className="font-mono text-slate-200">VOL-1042 · Sector North</p>
          </div>
        </header>

        <main className="space-y-6">
          <TelemetryPanel gates={gates} />
          <div className="grid gap-6 lg:grid-cols-2">
            <AssistForm onSubmit={handleSubmit} loading={loading} />
            <GuidanceCard data={data} language={lang} loading={loading} error={error} />
          </div>
        </main>

        <footer className="mt-10 border-t border-slate-900 pt-6 text-xs text-slate-500">
          <p>
            Built for PromptWars Challenge 4 · Smart Stadiums & Tournament Operations · Explainable AI · WCAG-conscious UI · Server-side reasoning via Gemini with deterministic fallback.
          </p>
        </footer>
      </div>
    </div>
  );
}
