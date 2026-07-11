## CrowdSync AI — Volunteer Co-Pilot (TanStack Start build)

Rebuild the Challenge 4 blueprint natively in this project's stack: TanStack Start + React + TypeScript, with the AI reasoning running server-side via Gemini (your own API key). No Python, no Cloud/DB needed — a single, fast, accessible web app that runs live in preview and ships as a tiny repo.

### What you get

A single-page **Volunteer Co-Pilot** at `/` that lets a volunteer:
1. Pick their **zone** (with mocked live gate telemetry visible on-screen).
2. Type a **fan situation** (e.g. "fan feels faint, needs bathroom").
3. Pick a **target language** (Spanish / French / Arabic / Portuguese / Hindi).
4. Hit **Request AI Guidance** → gets back, in ~2s:
   - **Explainable reasoning** (XAI ops-log line)
   - **English volunteer script**
   - **Translated script** in target language
   - **Recommended gate redirect** (when telemetry shows >80% or an incident)
   - **Action type** badge (STANDARD / CRITICAL_DIVERSION)

Includes a live **Telemetry panel** with 3 mock gates that auto-tick capacity every few seconds so the demo feels real, plus a rotating **incident** field to prove edge-case handling.

### Architecture

```text
src/
├── routes/
│   ├── __root.tsx              # SEO: real title/desc/OG for CrowdSync AI
│   └── index.tsx               # Volunteer Co-Pilot UI (single page)
├── lib/
│   ├── ai-gateway.server.ts    # Gemini provider helper (server-only)
│   ├── volunteer.functions.ts  # createServerFn: assistVolunteer(...)
│   ├── telemetry.ts            # Mock gate telemetry + tick logic (client-safe)
│   └── types.ts                # Shared Zod schemas / TS types
└── components/
    ├── TelemetryPanel.tsx      # Live gate cards w/ capacity bars + incident chip
    ├── AssistForm.tsx          # Zone / query / language form
    └── GuidanceCard.tsx        # XAI reasoning + scripts + redirect badge
```

### AI layer

- Server function `assistVolunteer` (POST) — Zod-validated input (zone, query, target language, telemetry snapshot).
- Uses `@ai-sdk/openai-compatible` pointed at Google Gemini via **your own `GEMINI_API_KEY`** (stored as a secret — I'll open the secure form).
- Model: `gemini-2.5-flash` (fast, cheap, JSON-mode).
- Structured output via `generateText` + `Output.object` with a small Zod schema: `{ explainable_reasoning, volunteer_script_english, volunteer_script_translated, recommended_gate_redirect, action_type }`.
- **Resilience fallback**: if the key is missing or Gemini errors, the server function returns a deterministic rules-based response (divert to lowest-capacity gate, canned reassuring script, pre-translated phrases per language) so the demo never breaks — mirrors your blueprint's mock engine.
- Pre-flight rule engine flags critical gate (>80% capacity OR any incident) and passes that as context to the LLM so reasoning is grounded.

### Frontend / UX

- Bold, high-contrast dark theme (stadium ops control-room feel): deep navy background, electric cyan accent for actions, amber for warnings, red for critical.
- **WCAG AA+**: semantic `<header> <main> <section>`, visible focus rings, `aria-live="polite"` on the guidance card, `aria-busy` while loading, labeled form controls, ≥4.5:1 contrast, keyboard-first.
- Telemetry cards show capacity bar, inflow/min, and incident chip; auto-update every 4s via `setInterval` in an effect (SSR-safe).
- Loading skeleton + toast on error (surfaces 402/429 clearly).
- RTL-friendly rendering for Arabic (`dir="rtl"` on translated block when language === Arabic).

### SEO / metadata

`__root.tsx` gets real title/description/OG/Twitter tags for CrowdSync AI (replaces "Lovable App").

### Steps

1. Store `GEMINI_API_KEY` via secure secret form.
2. Add deps: `ai`, `@ai-sdk/openai-compatible`, `zod` (if not present).
3. Create `src/lib/ai-gateway.server.ts` (Gemini provider), `src/lib/types.ts` (schemas), `src/lib/telemetry.ts` (mock gates).
4. Create `src/lib/volunteer.functions.ts` — `assistVolunteer` server fn with rule-engine + LLM + fallback.
5. Build `TelemetryPanel`, `AssistForm`, `GuidanceCard` components.
6. Replace `src/routes/index.tsx` with the Co-Pilot page wiring everything.
7. Update `__root.tsx` head metadata.
8. Verify: run a real gateway call end-to-end, confirm structured JSON parses, confirm fallback path when key is absent.

### Notes on your evaluation criteria

- **Single branch / <10 MB**: this project is already one branch and tiny (no Python venv, no node_modules committed).
- **No hardcoding**: reasoning comes from the LLM at request time; only the safety-net fallback is deterministic.
- **Security**: `GEMINI_API_KEY` server-only, Zod validation on all inputs, no secrets in client bundle.
- **Explainability**: every response includes an `explainable_reasoning` field surfaced in the UI.

Approve and I'll build it.