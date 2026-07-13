import { useState, type FormEvent } from "react";
import { LANGUAGES } from "@/lib/types";

const ZONES = [
  "North Plaza — Gate C",
  "East Concourse — Gate D",
  "South Concourse — Gate E",
  "Accessible Ramp A104",
];

const SAMPLE_QUERIES = [
  "Fan is dizzy and needs the nearest bathroom.",
  "Wheelchair user needs the accessible entrance.",
  "Family with two kids can't find their seats in section 210.",
  "Someone reports a suspicious unattended bag near turnstile 3.",
];

export type AssistFormValues = {
  zone: string;
  query_text: string;
  target_language: (typeof LANGUAGES)[number];
};

export function AssistForm({
  onSubmit,
  loading,
}: {
  onSubmit: (v: AssistFormValues) => void;
  loading: boolean;
}) {
  const [zone, setZone] = useState(ZONES[0]);
  const [query, setQuery] = useState(SAMPLE_QUERIES[0]);
  const [lang, setLang] = useState<(typeof LANGUAGES)[number]>("Spanish");
  const [error, setError] = useState<string | null>(null);
  const MAX_QUERY = 500;

  const handle = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setError("Please describe the situation in at least 3 characters.");
      return;
    }
    if (trimmed.length > MAX_QUERY) {
      setError(
        `Query is too long (${trimmed.length} chars). Please keep it under ${MAX_QUERY} characters.`,
      );
      return;
    }
    setError(null);
    onSubmit({ zone, query_text: trimmed, target_language: lang });
  };


  return (
    <form onSubmit={handle} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-cyan-300">
        Dispatch Console
      </h3>

      <div>
        <label htmlFor="zone" className="block text-sm font-medium text-slate-200 mb-1.5">
          Volunteer zone
        </label>
        <select
          id="zone"
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
        >
          {ZONES.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="query" className="block text-sm font-medium text-slate-200 mb-1.5">
          Fan situation / inquiry
        </label>
        <textarea
          id="query"
          value={query}
          onChange={(e) => {
            // Hard cap at MAX_QUERY chars — silently truncate any oversized
            // paste (e.g. a 10k-char prompt injection attempt) instead of
            // letting it reach the reasoning pipeline.
            const next = e.target.value.slice(0, MAX_QUERY);
            setQuery(next);
            if (error) setError(null);
          }}
          rows={3}
          required
          maxLength={MAX_QUERY}
          aria-invalid={error ? true : undefined}
          aria-describedby="query-help"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          placeholder="Describe what the fan needs…"
        />
        <p id="query-help" className="mt-1 text-xs text-slate-400 tabular-nums">
          {query.length}/{MAX_QUERY} characters
        </p>
        {error && (
          <p role="alert" className="mt-2 rounded-md border border-red-500/40 bg-red-950/40 px-2 py-1 text-xs text-red-200">
            {error}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuery(q)}
              className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:border-cyan-400 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            >
              {q.length > 42 ? q.slice(0, 40) + "…" : q}
            </button>
          ))}
        </div>

      </div>

      <div>
        <label htmlFor="lang" className="block text-sm font-medium text-slate-200 mb-1.5">
          Fan's language
        </label>
        <select
          id="lang"
          value={lang}
          onChange={(e) => setLang(e.target.value as (typeof LANGUAGES)[number])}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
        >
          {LANGUAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="w-full rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Reasoning…" : "⚡ Request AI Co-Pilot Guidance"}
      </button>
    </form>
  );
}
