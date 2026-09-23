# Cadence (AI cycling coach)

Working product name, defined once in `lib/brand.ts` (formerly "Apex"; `apex_*` localStorage keys are kept so saved settings survive).

Self-hosted AI cycling coach web app. The athlete chats with an LLM "coach" that has live tool access to their
[Intervals.icu](https://intervals.icu) data (fitness/fatigue/form, wellness, activities, calendar) and follows
persistent, per-athlete schedule rules.

## Product direction (read before making design decisions)

- **Self-hosted first.** The app must run on the user's own machine/server (`pnpm build && pnpm start`, later Docker).
  Vercel/serverless deployment is a *possible future target only* — don't add Vercel-specific services
  (Vercel KV, Edge Config, etc.) or design around serverless constraints. Local disk persistence is fine.
- **Provider-agnostic LLM.** Any LLM provider must be usable. All model access goes through the Vercel AI SDK
  (`ai` + `@ai-sdk/*` provider packages); never call a provider's native SDK directly, and never write
  provider-specific logic outside the provider-resolution code in `app/api/chat/route.ts`.
  Ollama is supported through `@ai-sdk/openai-compatible` (its `/v1` endpoint, base URL from `OLLAMA_BASE_URL`, never
  from the request). Other OpenAI-compatible endpoints (LM Studio, OpenRouter) should follow the same pattern.
  Use `qwen3:1.7b` on Ollama for local dev testing.
- The original Gemini-authored plan is in `cycling_coach_web_app_plan.md`. Treat it as historical context,
  not a spec — its Vercel/cloud-storage parts are superseded by the direction above.

## Commands

```bash
pnpm install          # package manager is pnpm (see pnpm-lock.yaml) — don't use npm/yarn
pnpm dev              # http://localhost:3000
pnpm exec tsc --noEmit  # typecheck — run after every change
pnpm build            # full production build — run before declaring a feature done
```

**Only one Next.js process may use `.next/` at a time.** Never run `pnpm build` while a dev server is up, and never
start a second `pnpm dev` (e.g. on port 3001) next to an existing one. Symptoms: ENOENT vendor-chunk errors, or the
page rendering as unstyled HTML because the CSS URL 404s. Before starting a server, check `lsof -iTCP:3000-3010
-sTCP:LISTEN` and reuse the user's running server. Fix: stop the extra process, `rm -rf .next`, restart one server. `.claude/launch.json` defines the `dev`
preview server. The `verify` skill (`.claude/skills/verify`) has the full check sequence, including a curl smoke test
of the chat route.

There is no test suite yet. `pnpm lint` (`next lint`) is deprecated in Next 15.5 and has no ESLint config; prefer `tsc`.

## Architecture

Next.js 15 App Router, React 19, Tailwind 3, TypeScript strict, path alias `@/*` → repo root.

| Path | Role |
|---|---|
| `app/api/chat/route.ts` | Chat endpoint. Resolves the LLM provider/model + API key, builds the system prompt, runs `streamText` with Intervals tools, streams a UI message stream. |
| `app/api/metrics/route.ts` | Sidebar/briefing data: CTL/ATL/TSB, 42-day form history, this week's planned events (`MetricsResponse` in `lib/intervals/metrics.ts`). |
| `app/api/preferences/route.ts` | GET/POST coach rules for an athlete. |
| `lib/llm/models.ts` | Provider IDs and default model per provider — the single source for defaults (server and UI). |
| `lib/intervals/client.ts` | Typed REST client for `https://intervals.icu/api/v1` (Basic auth `API_KEY:<key>`). |
| `lib/intervals/tools.ts` | AI SDK tool definitions (`tool({ description, inputSchema, execute })`) wrapping the client. Tools return `{ error }` instead of throwing so the model can recover. |
| `lib/coach/prompt.ts` | Builds the coach system prompt from methodology + the athlete's saved preferences. |
| `lib/storage/preferences-store.ts` | Preferences persisted as JSON at `data/athletes/{athleteId}.json`, with in-memory cache. |
| `lib/mcp/bridge.ts` | Optional stdio bridge to the Python `intervals-icu-mcp` server (`USE_LOCAL_MCP=true`). Currently not wired into the chat route. |
| `components/Sidebar.tsx` | Desktop rail (form, sparkline, week, rules/settings) with a 68px compact mode (`apex_sidebar_compact` in localStorage), and the mobile top bar. |
| `components/chat/*` | `useChat` UI (from `@ai-sdk/react`), message rendering via `message.parts` (read tools collapse into one trace pill; `icu_create_calendar_event` renders as `WorkoutCard`), quick prompts. |
| `components/SettingsModal.tsx` | Provider/model/API-key selection, stored in browser `localStorage` (`apex_*` keys) and sent with each chat request. |

Configuration: server-side env vars in `.env.local` (see `.env.example`); keys entered in the UI override env vars per request.

## AI SDK conventions (v7 — easy to get wrong)

The project uses **AI SDK 7** (`ai@7`, `@ai-sdk/react@4`, `@ai-sdk/{google,openai,anthropic}@4`). Most examples
online and in model training data are v3/v4 and will not compile. Authoritative docs ship in
`node_modules/ai/docs/` (migration guides in `08-migration-guides/`) — grep them before guessing an API.

- Tools: `inputSchema` (not `parameters`); tool parts in the UI are `part.type === "tool-<name>"` with
  `part.state` in `input-streaming | input-available | output-available | output-error | …`, and `part.input` / `part.output`.
- `streamText`: `instructions` (not `system`), `stopWhen: isStepCount(n)` (not `maxSteps`), messages from
  `await convertToModelMessages(uiMessages)`; respond with
  `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`.
- Client: `useChat` from `@ai-sdk/react`, `DefaultChatTransport` with a `body: () => ({...})` function for
  per-request settings; `sendMessage({ text })`; no `input`/`handleSubmit` — manage input state yourself.
- **Never strip `providerMetadata` / `callProviderMetadata` from messages** when persisting or transforming chat
  history. Gemini thinking models require the `thoughtSignature` on function-call parts to be sent back; losing it
  produces "Function call is missing a thought_signature". Keep the full `UIMessage` round-trip intact.

## Conventions

- Keep API keys server-side where possible; never log them, never put them in URLs, never commit them.
  `.env*` and `.env.local` are gitignored.
- `data/` holds real athlete preferences written at runtime; it's gitignored. Never commit it.
- Match the "calm cockpit" UI style: Tailwind tokens `ink-*` (warm near-black surfaces), `fg-*` (text), one accent
  `signal` (lime, `signal-warn` orange for warnings); IBM Plex Sans body, JetBrains Mono for numbers/data, Barlow
  Condensed (`font-display`) for big figures. No gradients, no avatars/bubbles for the coach, `lucide-react` icons.
  Dialogs use the shared shell in `components/ui/Modal.tsx` (`Modal`, `ModalSection`, `inputClass`, buttons).
  The logo and every "working" indicator is `components/CadenceMark.tsx` (spins via `animate-pedal`, still under
  reduced motion); the favicon is `app/icon.svg`. Don't reintroduce pulsing dots.
- Default model IDs live only in `lib/llm/models.ts`. Providers retire models often (e.g. `gemini-2.5-flash` is closed
  to new users) — if a request fails with "model not available", update the default there.
