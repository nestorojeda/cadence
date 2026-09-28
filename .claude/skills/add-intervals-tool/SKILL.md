---
name: add-intervals-tool
description: Add a new Intervals.icu capability for the coach (e.g. power curves, activity intervals, wellness updates) — client method, AI SDK tool, and prompt guidance. Use when the coach needs access to Intervals.icu data or actions it can't reach yet.
---

# Add an Intervals.icu tool

1. **Find the endpoint.** Intervals.icu API docs: https://intervals.icu/api-docs.html. The sibling Python MCP server
   (`MCP_SERVER_PATH`, default `../intervals-icu-mcp`) already implements many endpoints — read its implementation
   for the exact path, params, and response shape instead of guessing.
2. **Client method** in `lib/intervals/client.ts`: add a typed method following the existing ones
   (`fetch` with `this.getHeaders()`, athlete scoping via `athleteId || this.defaultAthleteId`, throw on `!res.ok`). Add a response interface if the shape is used by the UI;
   otherwise return a trimmed object — large raw payloads (streams, full activities) waste context, so pick the fields
   the coach actually needs.
3. **Tool** in `lib/intervals/tools.ts`, following the existing pattern:
   - Name prefixed `icu_`, snake_case, matching the MCP server's name where one exists.
   - `inputSchema: z.object({...})` with `.describe()` on every field (dates as `YYYY-MM-DD`).
     Keep schemas simple (no unions/recursive types) — Gemini and OpenAI strict mode reject complex JSON Schema.
   - `execute` wraps the call in try/catch and returns `{ error: message }` on failure — never throw.
   - Write tools (create/update/delete on the athlete's calendar or data) must say so in the description, and
     the coach prompt should require confirming with the athlete first.
4. **Prompt**: if the coach needs to know _when_ to use it, add a line to `lib/coach/prompt.ts`.
5. **UI**: tool calls render generically in `components/chat/ChatMessage.tsx`; only add custom rendering if asked.
6. Run the `verify` skill, using a prompt that should trigger the new tool.
