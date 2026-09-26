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
| `app/api/chat/route.ts` | Chat endpoint. Takes `{ id, message }` (only the new message), loads the chat's history from disk, resolves the LLM provider/model + API key, builds the system prompt, runs `streamText` with Intervals tools, streams a UI message stream, and saves the result in `onEnd`. |
| `app/api/chats/*` | Chat history: list (index only), load, rename (`PATCH`), delete. |
| `app/api/metrics/route.ts` | Sidebar/briefing data: CTL/ATL/TSB, 42-day form history, this week's planned events (`MetricsResponse` in `lib/intervals/metrics.ts`). |
| `app/api/preferences/route.ts` | GET/POST coach rules for an athlete. |
| `lib/llm/models.ts` | Provider IDs and default model per provider — the single source for defaults (server and UI). Also the Google model dropdown list (`GOOGLE_MODELS`) with each model's supported Gemini thinking levels, and `resolveThinkingLevel`. |
| `lib/intervals/client.ts` | Typed REST client for `https://intervals.icu/api/v1` (Basic auth `API_KEY:<key>`). |
| `lib/intervals/tools.ts` | AI SDK tool definitions (`tool({ description, inputSchema, execute })`) wrapping the client. Tools return `{ error }` instead of throwing so the model can recover. |
| `lib/intervals/events.ts` | Key events: upcoming races (`RACE_A/B/C`) and time off (`HOLIDAY/SICK/INJURED`, `end_date_local` exclusive) for the next ~6 months, cached 5 min per athlete. The chat route puts them in the system prompt (they're usually beyond the calendar tool's window) and `/api/metrics` returns them for the sidebar's "Next races" and away days. |
| `lib/intervals/workout.ts` | Parses Intervals.icu workout text (event `description`) into timed %FTP steps for the `WorkoutChart` power profile in `WorkoutCard`. |
| `lib/intervals/compact.ts` | Trims Intervals.icu responses to the fields the coach uses and bounds default date ranges (wellness: 14 days, max 90). Every read tool must return compacted data — raw responses are huge (unbounded wellness was 1.4M chars). |
| `lib/coach/prompt.ts` | Builds the coach system prompt from methodology + the athlete's saved preferences. |
| `lib/storage/chat-store.ts` | Chats persisted at `data/chats/{athleteId}/{chatId}.json` plus an `index.json` of `ChatMeta`; writes are serialized per athlete. |
| `lib/chat/context.ts` | Token economy: what the model sees of a stored chat (see below). |
| `lib/storage/preferences-store.ts` | Preferences persisted as JSON at `data/athletes/{athleteId}.json`, with in-memory cache. |
| `lib/mcp/bridge.ts` | Optional stdio bridge to the Python `intervals-icu-mcp` server (`USE_LOCAL_MCP=true`). Currently not wired into the chat route. |
| `components/Sidebar.tsx` | Desktop rail (form, sparkline, week, rules/settings) with a 68px compact mode (`apex_sidebar_compact` in localStorage), and the mobile top bar. |
| `components/chat/*` | `useChat` UI (from `@ai-sdk/react`), message rendering via `message.parts` (read tools collapse into one trace pill; `icu_create_calendar_event` renders as `WorkoutCard`), quick prompts. |
| `components/SettingsModal.tsx` | Provider/model/API-key selection (Google: model dropdown plus thinking effort, `apex_thinking_level`), stored in browser `localStorage` (`apex_*` keys) and sent with each chat request. |

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
- **Chat history and token economy.** The full `UIMessage[]` is stored on disk, but the model only gets a rolling
  summary of older turns plus the messages after it, with reasoning and *read*-tool calls/results from earlier turns
  removed by `pruneMessages` (write tools, listed in `lib/intervals/tool-names.ts`, are kept). Once more than 12 messages
  follow the summary, `foldSummary` runs in the background after the reply with the same model. Don't send the whole
  history from the client or skip `buildModelMessages`. Response messages need `generateMessageId` (the summary
  cutoff refers to message IDs); per-reply token usage is attached as message metadata.
- **Write tools need the athlete's approval.** The route sets `toolApproval: 'user-approval'` for every name in
  `WRITE_TOOL_NAMES`, so the stream pauses on an `approval-requested` part (rendered as a `WorkoutCard` with Add/Skip).
  The client answers with `addToolApprovalResponse`, and `sendAutomaticallyWhen` resends the paused *assistant* message.
  The route merges only the decisions into the stored copy (`lib/chat/approvals.ts`), so tool inputs always come from
  disk. Approvals left unanswered when the athlete sends a new message become `output-denied`.
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
- **Light / dark / system color mode.** Color tokens are CSS variables (RGB channels) in `app/globals.css`: light
  values on `:root`, dark on `.dark`; `tailwind.config.ts` maps `ink-*`, `fg-*`, `signal*`, `on-signal` to them. Never
  hardcode a hex in a component (training-zone colors excepted) — add a token with both values. Text on a
  `bg-signal` fill is `text-on-signal` (lime by night, olive by day). The preference is `apex_theme` in localStorage
  (absent = system), applied before paint by `THEME_INIT_SCRIPT` (`lib/theme.ts`) in `app/layout.tsx`; the
  `useTheme` hook and toggles live in `components/ThemeToggle.tsx`. Changing `tailwind.config.ts` needs a dev-server
  restart to show up.
- Default model IDs live only in `lib/llm/models.ts`. Providers retire models often (e.g. `gemini-2.5-flash` is closed
  to new users) — if a request fails with "model not available", update the default there.
