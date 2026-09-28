---
name: verify
description: Verify a change in the Apex Cycling Coach app — typecheck, unit tests, production build, and a live smoke test of the chat endpoint with tool calling. Use after modifying anything under app/, lib/ or components/, and before declaring a feature or fix done.
---

# Verify a change

Run these in order and stop at the first failure — fix it before continuing.

1. **Typecheck**: `pnpm exec tsc --noEmit`
2. **Unit tests**: `pnpm test` (Vitest, no network). If the change is in `lib/`, add or update the colocated
   `*.test.ts` first.
3. **Build**: `pnpm build` (catches App Router / server-client boundary errors tsc misses).
   Only when **no** dev server is running — they share `.next/` and a build breaks a live dev server.
   Check with `lsof -iTCP:3000-3010 -sTCP:LISTEN`; if one is running, skip the build and say so.
4. **Smoke test the chat route** (only if the change touches the chat, tools, prompt, or provider code):
   - Reuse the user's dev server if one is already running (check ports 3000–3010); otherwise start the `dev`
     preview server. Never run two at once.
   - POST a new message that forces a tool call, so multi-step tool loops are exercised. The route takes a chat `id`
     plus only the new `message` and persists the chat, so delete the test chat afterwards
     (`curl -X DELETE 'localhost:3000/api/chats/smoketest?athleteId=<id>'`):

     ```bash
     curl -sN localhost:3000/api/chat -H 'content-type: application/json' -d '{
       "modelProvider": "google", "modelName": "gemini-3.8-flash",
       "id": "smoketest",
       "message": {"id":"1","role":"user","parts":[{"type":"text","text":"What is my current form (TSB)? Use your tools."}]}
     }' | tail -20
     ```

   - Pass: the stream contains a `tool-input-available` / `tool-output-available` pair **and** later `text-delta` chunks.
     Fail: an `error` chunk (e.g. missing `thought_signature`, invalid schema) or a stream ending right after the tool call.
   - The request needs provider + Intervals keys in `.env.local`. If they're missing, say so rather than skipping silently.
   - If another provider changed, repeat with its `modelProvider`/`modelName`.
   - **Ollama** (no keys besides Intervals): needs `ollama serve` running and `ollama pull qwen3:1.7b`
     (check `curl -s localhost:11434/api/tags`). Use `"modelProvider": "ollama", "modelName": "qwen3:1.7b"`.
     A 1.7B model calls tools less reliably, so retry once with a more direct prompt before treating a tool-less answer as a bug.
5. **UI check** (only for component changes): open http://localhost:3000 in the browser pane, send a quick prompt,
   confirm tool-call pills and the markdown answer render, and check the console for errors.

Report what was run and what passed — don't claim a step passed if it was skipped.
