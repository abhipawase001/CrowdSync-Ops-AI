# CrowdSync AI — Volunteer Co-Pilot

**PromptWars Challenge 4 · Smart Stadiums & Tournament Operations**

A real-time, explainable AI co-pilot for FIFA World Cup 2026 stadium volunteers. Given a live snapshot of gate telemetry and a fan situation typed in plain English, the app returns — in ~2 seconds — an ops-log reasoning line, a warm English script, a translated script (Spanish / French / Arabic / Portuguese / Hindi / German), a recommended gate diversion, and an action-type badge.

Built on **TanStack Start + React 19 + TypeScript + Tailwind v4**, with reasoning served by **Google Gemini 2.5 Flash** via a server function, and a deterministic rules-based fallback so the demo never breaks.

---

## Evaluation metric → feature map

Direct pointer from each Challenge 4 scoring criterion to the exact UI element and code path that implements it.

| # | Metric | Impact | Where it lives in the UI | Where it lives in the repo |
|---|---|---|---|---|
| 1 | **Real-time dynamic AI reasoning (no hardcoding)** | High | *Guidance card* → `Explainable reasoning` block; `source: gemini` tag proves LLM path | `src/lib/volunteer.functions.ts` — `assistVolunteer` server fn, `generateText` + `Output.object({ schema: LlmSchema })` against Gemini 2.5 Flash |
| 2 | **Explainable AI (XAI ops log)** | High | `explainable_reasoning` sentence on the guidance card, cites the exact capacity / inflow / incident it used | `LlmSchema.explainable_reasoning` (Zod) + prompt rule #3 in `volunteer.functions.ts`; deterministic mirror in `buildFallback()` |
| 3 | **Crowd-aware gate diversion** | High | *Recommended gate redirect* badge on guidance card; `CRITICAL_DIVERSION_AND_ASSISTANCE` action badge | `detectCriticalGate` (≥80% or incident) + `detectSafeGate` (lowest load) in `volunteer.functions.ts` |
| 4 | **Live telemetry / situational awareness** | High | *Live Gate Telemetry* cards (capacity bar, inflow, incident chip) + *Real-Time Gate Dashboard* rolling line charts | `src/lib/telemetry.ts` (`tickTelemetry` 4s interval), `src/components/TelemetryPanel.tsx`, `src/components/TelemetryCharts.tsx` |
| 5 | **Multilingual fan support** | High | *Translated script* block on guidance card; language dropdown (ES / FR / AR / PT / HI / DE); Arabic renders RTL | `LANGUAGES` in `src/lib/types.ts`; prompt rule #5 in `volunteer.functions.ts`; `src/lib/fallback-translations.ts`; `dir="rtl"` in `src/components/GuidanceCard.tsx` |
| 6 | **Edge-case resilience (never breaks)** | High | App works with **no** API key; guidance card shows `source: fallback` tag | `buildFallback()` in `volunteer.functions.ts` — triggers on missing key, network error, or `NoObjectGeneratedError` |
| 7 | **Intent classification (medical / accessibility / standard)** | High | *Action type* badge: `MEDICAL_PRIORITY` / `ACCESSIBILITY_ROUTING` / `STANDARD_ASSISTANCE` / `CRITICAL_DIVERSION_AND_ASSISTANCE` | `classifyIntent()` regex in `volunteer.functions.ts` + `LlmSchema.action_type` enum |
| 8 | **Security** | Medium | No secrets in DevTools → Sources; server-only `.env` | `process.env.GEMINI_API_KEY` read **inside** `.handler()`; all input Zod-validated at server boundary via `AssistRequestSchema` |
| 9 | **Performance / efficiency** | Medium | Charts stay smooth as telemetry ticks; ~1–2s AI response | Throttled sampler + `memo` + memoized recharts lines in `TelemetryCharts.tsx`; `gemini-2.5-flash` model; SSR bundle via Vite 7 |
| 10 | **Accessibility (WCAG AA+)** | Medium | Keyboard-first, visible focus rings, screen-reader-friendly | Semantic `<header>/<main>/<section>`, `aria-live="polite"` on guidance card, `aria-busy` while loading, `role="progressbar"` on capacity bars, `dir="rtl"` for Arabic, ≥4.5:1 contrast |
| 11 | **Clean README / documentation** | Low | — | This file: judge walkthrough, XAI generation, diversion logic, end-to-end local run, metric map |
| 12 | **Repo hygiene (single branch, <10 MB)** | Low | — | Pure TS/React, no committed `node_modules`, no data assets, `.gitignore` clean |

---



## Judge walkthrough (2 minutes)

Open `/` in the preview. You will see:

1. **Live Gate Telemetry cards** — 4 gates auto-ticking every 4s. Capacity turns amber ≥60%, red ≥80% or when an incident chip appears.
2. **Real-Time Gate Dashboard** — rolling line charts for capacity % and inflow/min per gate, plus an incident-status strip.
3. **Assist form** — pick a zone, describe the fan situation (e.g. *"fan feels faint, needs bathroom"*), pick a target language, submit.
4. **Guidance card** — appears with:
   - `action_type` badge (STANDARD / CRITICAL_DIVERSION / MEDICAL_PRIORITY / ACCESSIBILITY_ROUTING)
   - **Explainable reasoning** (the XAI ops-log line, citing the exact numbers used)
   - **English script** and **translated script** (Arabic renders RTL)
   - **Recommended gate redirect** when a diversion is warranted
   - **Source** tag: `gemini` (LLM) or `fallback` (deterministic)

To force the critical-diversion path deterministically, submit while **Gate C** is red (≥80%) or shows an incident chip — telemetry starts with Gate C at 87% + "Turnstile 4 jam".

---

## How XAI ops logs are generated

Every response includes `explainable_reasoning` — a single crisp sentence written for the ops-room log that **must cite the numbers the decision used** (capacity %, inflow, incident text, chosen safer gate). Two paths produce it:

**LLM path (`source: "gemini"`)** — `src/lib/volunteer.functions.ts`:
- The server function builds a pre-flight analysis (critical gate, lowest-load gate, heuristic intent) and injects it into the prompt alongside the raw telemetry JSON.
- Gemini is called with `generateText` + `Output.object({ schema: LlmSchema })`, giving Zod-validated structured output.
- The prompt explicitly instructs: *"'explainable_reasoning': one crisp sentence for the ops-room log — cite the numbers you used."*
- If the model returns malformed JSON, we try `NoObjectGeneratedError.text` once, then fall through.

**Fallback path (`source: "fallback"`)** — same file, `buildFallback()`:
- Runs when `GEMINI_API_KEY` is missing or the Gemini call throws.
- Composes reasoning from the same pre-flight facts: e.g. *"Gate C at 87% capacity with active incident (Turnstile 4 jam). Diverting fan to Accessible Ramp A104 (22%, inflow 18/min) to prevent bottleneck. Query flagged as medical priority."*

Because both paths cite the exact telemetry values used, every log line is auditable end-to-end.

---

## How diversion logic works

Diversion is a two-stage decision — a deterministic pre-flight rule engine, then LLM refinement.

**Pre-flight (always runs, `src/lib/volunteer.functions.ts`):**
- `detectCriticalGate` — flags the first gate with `current_capacity_pct >= 80` **or** any non-null `incident_reported`.
- `detectSafeGate` — sorts telemetry ascending by capacity and returns the lowest-loaded gate.
- `classifyIntent` — regex over the query text: `medical|faint|dizzy|…` → `MEDICAL_PRIORITY`; `wheelchair|accessible|…` → `ACCESSIBILITY_ROUTING`; else `STANDARD_ASSISTANCE`.

**Decision:**
- If a critical gate exists → `action_type = CRITICAL_DIVERSION_AND_ASSISTANCE`, `recommended_gate_redirect = <safe gate id>`.
- Otherwise → the intent classification wins, `recommended_gate_redirect = null`.

The LLM receives both the raw telemetry and this pre-flight summary. It is instructed to only reference gate ids that appear in telemetry and to set `recommended_gate_redirect` to `null` when no diversion is needed. This grounds the model and prevents hallucinated gate names.

---

## Run locally end-to-end

**Prereqs:** [Bun](https://bun.sh) ≥ 1.1 (or Node ≥ 20 + `npm`). No Python, no database.

```bash
# 1. Install
bun install                       # or: npm install

# 2. (Optional) enable live Gemini reasoning
echo 'GEMINI_API_KEY=your_key_here' > .env
# Get a key: https://aistudio.google.com/app/apikey
# Without a key the app runs the deterministic fallback — every feature still works.

# 3. Dev server
bun run dev                       # or: npm run dev
# → http://localhost:8080

# 4. Production build (verifies the full SSR + client bundle)
bun run build
bun run preview
```

**Smoke test the AI path:**
1. Open `http://localhost:8080`.
2. Zone: `Sector North · Gate C`.
3. Query: `fan feels faint, needs bathroom`.
4. Language: `Spanish`.
5. Submit → guidance appears in ~1–2s.
6. Check the `source` tag on the guidance card: `gemini` confirms the LLM path; `fallback` means the key is missing or Gemini errored (see terminal).

---

## Project structure

```text
src/
├── routes/
│   ├── __root.tsx              SEO metadata (title/description/OG/Twitter)
│   └── index.tsx               Volunteer Co-Pilot page
├── lib/
│   ├── volunteer.functions.ts  createServerFn: assistVolunteer (Gemini + fallback)
│   ├── telemetry.ts            Mock gate state + tickTelemetry()
│   ├── types.ts                Zod schemas: AssistRequest / AssistResponse
│   └── fallback-translations.ts Pre-translated safety phrases per language
└── components/
    ├── TelemetryPanel.tsx      Gate cards (capacity bar, inflow, incident chip)
    ├── TelemetryCharts.tsx     Rolling line charts + incident strip
    ├── AssistForm.tsx          Zone / query / language form
    └── GuidanceCard.tsx        XAI reasoning + scripts + redirect badge (RTL-aware)
```

---

## Design & compliance notes

- **Explainability**: every response surfaces `explainable_reasoning` in the UI *and* returns it in the JSON contract.
- **Security**: `GEMINI_API_KEY` is server-only (`process.env` inside `.handler()`), never shipped to the client. All input is Zod-validated at the server-function boundary.
- **Resilience**: rules-based fallback triggers on missing key, network error, or malformed LLM output.
- **Accessibility (WCAG AA+)**: semantic landmarks, visible focus rings, `aria-live="polite"` on the guidance card, `aria-busy` while loading, labeled controls, ≥4.5:1 contrast, `dir="rtl"` for Arabic scripts.
- **No hardcoding of reasoning**: the LLM produces the response at request time from live telemetry; only the safety-net phrases are pre-authored.
- **Repo size**: pure TS/React — no committed `node_modules`, no data assets, well under 10 MB.

---

## Tech stack

TanStack Start v1 · React 19 · TypeScript (strict) · Vite 7 · Tailwind v4 · shadcn/ui · Recharts · Zod · Vercel AI SDK (`ai` + `@ai-sdk/openai-compatible`) · Google Gemini 2.5 Flash.
