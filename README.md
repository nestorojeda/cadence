# Apex Cycling Coach 🚴⚡

A self-hosted AI cycling coach. Chat with an LLM coach that has live access to your
[Intervals.icu](https://intervals.icu) data (fitness, fatigue, form, wellness, activities, and calendar) and that
follows your own schedule and training rules.

Built with **Next.js 15**, **React 19**, **Tailwind CSS**, and the **[AI SDK](https://ai-sdk.dev) v7**, so the coach
isn't tied to one LLM provider.

---

## Features

- 💬 **Chat with an AI coach**: assess readiness, plan your week, analyse rides, and get periodised advice.
- 🛠️ **Live Intervals.icu tools**: the coach calls tools on its own to fetch fitness (CTL/ATL/TSB), wellness
  (HRV, resting HR, sleep), recent activities, activity details, and calendar events, and can schedule workouts.
- 📊 **Readiness header**: fitness, fatigue, and form, with a colour-coded status.
- ⚙️ **Persistent coach rules**: long-ride, interval, gym, and rest days, weekly volume, and custom notes, stored on
  the server per athlete ID so every browser and device sees the same rules.
- 🔌 **Bring your own LLM**: Google Gemini, OpenAI, or Anthropic, chosen in the in-app Settings. Keys come from the
  server environment or are entered in the UI.

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
| `USE_LOCAL_MCP`, `MCP_SERVER_PATH` | no | Experimental bridge to the Python `intervals-icu-mcp` server (not yet wired into chat). |

Keys entered in the **Settings** dialog are stored in your browser and override the server values for your own
requests. Never commit `.env.local`.

### Supported models

| Provider | Default model | Notes |
|---|---|---|
| Google | `gemini-3.6-flash` | Thinking models are fully supported, including thought-signature round-tripping for tool calls. |
| OpenAI | `gpt-4o` | Any chat model with tool calling. |
| Anthropic | `claude-sonnet-5` | Any Claude model. |

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
app/api/metrics      → readiness data for the header
app/api/preferences  → GET/POST coach rules per athlete
lib/intervals/       → typed Intervals.icu REST client + AI SDK tool definitions
lib/coach/prompt.ts  → coaching methodology + the athlete's saved rules → system prompt
lib/llm/models.ts    → provider IDs and default models
lib/storage/         → JSON-file preference store (data/athletes/{athleteId}.json)
components/          → chat UI (useChat), settings, and coach-rules modals
```

## Roadmap

- OpenAI-compatible providers (Ollama, LM Studio, OpenRouter) with a configurable base URL
- Docker image for self-hosting
- More Intervals.icu tools (power curves, activity intervals, wellness updates)
- Optional authentication
- Vercel / serverless deployment (future, not a current goal)

## Developing with Claude Code

The repo is set up for agentic development: [`CLAUDE.md`](CLAUDE.md) documents the architecture, conventions, and
AI SDK v7 pitfalls, and `.claude/` holds shared permissions plus two project skills: `verify` (typecheck, build, and
a live chat smoke test) and `add-intervals-tool`.
