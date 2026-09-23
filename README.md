<p align="center">
  <img src="docs/banner.svg" alt="Cadence — a self-hosted AI cycling coach for Intervals.icu" width="100%">
</p>

# Cadence — AI Cycling Coach

A self-hosted AI cycling coach. Chat with an LLM coach that has live access to your
[Intervals.icu](https://intervals.icu) data (fitness, fatigue, form, wellness, activities, and calendar) and that
follows your own schedule and training rules.

Built with **Next.js 15**, **React 19**, **Tailwind CSS**, and the **[AI SDK](https://ai-sdk.dev) v7**, so the coach
isn't tied to one LLM provider.

---

## Features

- **Chat with an AI coach**: assess readiness, plan your week, analyse rides, and get periodised advice. Replies
  stream in with a live status line ("reading ride details…") while the coach works.
- **Live Intervals.icu tools**: the coach calls tools on its own to fetch fitness (CTL/ATL/TSB), wellness
  (HRV, resting HR, sleep), recent activities, activity details, and calendar events. The data it read collapses
  into one expandable line under its reply, and workouts it schedules appear as cards with duration, TSS and IF.
- **Form at a glance**: a sidebar with today's form (TSB), a six-week form trend, fitness and fatigue, and this
  week's planned sessions from your calendar. On phones it becomes a compact top bar.
- **Persistent coach rules**: a week grid of preferred interval, long-ride, gym and rest days, weekly volume, terrain
  and temporary constraints, stored on the server per athlete ID so every browser and device sees the same rules.
- **Bring your own LLM**: Google Gemini, OpenAI, Anthropic, or a local model through Ollama, chosen in the in-app
  Settings. Keys come from the server environment or are entered in the UI.

## Design

The interface is a calm, dark "cockpit": a warm near-black ground, one lime signal colour for what matters now (and
orange for warnings), IBM Plex Sans for text, JetBrains Mono for numbers and data, and Barlow Condensed for big
figures. No gradients or chat bubbles for the coach; its answers read like a document.

The logo is a chainring with a lit lead pedal. It stays still as the logo and turns at 90 rpm, one revolution per
pedal stroke, whenever the coach is working (it stays still if the OS asks for reduced motion). The palette is
defined as Tailwind tokens (`ink-*`, `fg-*`, `signal`) in `tailwind.config.ts`, and the product name lives in
`lib/brand.ts`.

## Quick start

Requirements: Node.js 22+ (24 LTS recommended) and [pnpm](https://pnpm.io).

```bash
pnpm install
cp .env.example .env.local   # then fill in your keys
pnpm dev                     # http://localhost:3000
```

### Configuration (`.env.local`)

| Variable | Required | Description |
|---|---|---|
| `INTERVALS_ICU_API_KEY` | yes | From intervals.icu → Settings → Developer Settings. |
| `INTERVALS_ICU_ATHLETE_ID` | yes | Your athlete ID (e.g. `i123456`). |
| `GEMINI_API_KEY` | one LLM key | Google AI Studio key (default provider). |
| `OPENAI_API_KEY` | one LLM key | OpenAI key. |
| `ANTHROPIC_API_KEY` | one LLM key | Anthropic key. |
| `OLLAMA_BASE_URL` | no | Ollama's OpenAI-compatible endpoint (default `http://localhost:11434/v1`). No key needed. |
| `USE_LOCAL_MCP`, `MCP_SERVER_PATH` | no | Experimental bridge to the Python `intervals-icu-mcp` server (not yet wired into chat). |

Keys entered in the **Settings** dialog (LLM provider keys and the Intervals.icu API key) are stored in your browser
and override the server values for your own requests. Never commit `.env.local`.

### Supported models

| Provider | Default model | Notes |
|---|---|---|
| Google | `gemini-3.6-flash` | Thinking models are fully supported, including thought-signature round-tripping for tool calls. |
| OpenAI | `gpt-4o` | Any chat model with tool calling. |
| Anthropic | `claude-sonnet-5` | Any Claude model. |
| Ollama | `qwen3:1.7b` | Local and free; needs a tool-capable model. Small models are fine for testing but give weak coaching. |

You can type any model ID into Settings. The defaults live in `lib/llm/models.ts`.

## Self-hosting

```bash
pnpm build
pnpm start          # serves on port 3000 (set PORT to change it)
```

Coach rules are saved as JSON under `data/athletes/`, so keep that directory on persistent storage (it's gitignored).
The app has **no authentication** yet: run it on a trusted network or behind a reverse proxy with auth.

## Architecture

```
app/api/chat         → resolves provider/model, builds the coach prompt, runs streamText with Intervals tools
app/api/metrics      → sidebar data: form, six-week form history, this week's planned sessions
app/api/preferences  → GET/POST coach rules per athlete
lib/intervals/       → typed Intervals.icu REST client + AI SDK tool definitions
lib/coach/prompt.ts  → coaching methodology + the athlete's saved rules → system prompt
lib/llm/models.ts    → provider IDs and default models
lib/storage/         → JSON-file preference store (data/athletes/{athleteId}.json)
components/          → sidebar, chat UI (useChat), workout cards, the Cadence mark, settings and coach-rules dialogs
```

## Roadmap

- More OpenAI-compatible providers (LM Studio, OpenRouter) alongside Ollama
- Docker image for self-hosting
- More Intervals.icu tools (power curves, activity intervals, wellness updates)
- Optional authentication
- Vercel / serverless deployment (future, not a current goal)

## Developing with Claude Code

The repo is set up for agentic development: [`CLAUDE.md`](CLAUDE.md) documents the architecture, conventions, and
AI SDK v7 pitfalls, and `.claude/` holds shared permissions plus two project skills: `verify` (typecheck, build, and
a live chat smoke test) and `add-intervals-tool`.
