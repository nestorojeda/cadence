---
name: tech-debt-audit
description: Audit the Cadence cycling coach app for technical debt and technically important improvements — broken project invariants (provider-agnostic LLM, compacted tool output, thought signatures, tokens-only colors), security and data-safety gaps, reliability, performance/token economy, dependency health, type safety, dead code, missing tests and doc drift. Produces a prioritized, evidence-backed report. Use when asked for a tech-debt review, health check, refactoring candidates, or "what should we clean up / improve technically".
---

# Technical debt audit

Goal: a short, **prioritized** list of issues that matter technically, each backed by evidence (`file:line`, command
output). Not a style nitpick list and not a feature wishlist. **Read-only** — don't change code unless the user asks;
offer to fix the top items at the end.

Scope: the whole repo by default; if the user names an area (e.g. "the chat route", "storage"), audit only that
and its direct dependencies.

## 1. Baseline (mechanical)

Run the scan script from the repo root — it collects signals, it does not judge them:

```bash
bash .claude/skills/tech-debt-audit/scan.sh
```

Also run `pnpm exec tsc --noEmit` and note any errors (a failing typecheck is always P0). Do **not** run `pnpm build`
if a dev server is listening (`lsof -iTCP:3000-3010 -sTCP:LISTEN`); it shares `.next/`.

Treat every scan hit as a lead to verify by reading the code, never as a finding by itself.

## 2. Project invariants (from CLAUDE.md — violations are high priority)

Check each; these are the rules that are easy to break silently:

| Invariant | How to check |
|---|---|
| Provider-agnostic LLM: `@ai-sdk/*` provider packages and provider-specific branches only in the provider-resolution code of `app/api/chat/route.ts` | scan section "provider imports"; grep for `"google"`/`"anthropic"`/`"openai"` string branches elsewhere |
| Ollama/OpenAI-compatible base URL only from env, never from the request body | read the provider resolution in `app/api/chat/route.ts` |
| `providerMetadata` / `callProviderMetadata` never stripped when storing or transforming messages | read `lib/chat/context.ts`, `lib/chat/approvals.ts`, `lib/storage/chat-store.ts` for object rebuilding / field picking of parts |
| Model sees `buildModelMessages` output, not full history; client sends only the new message | `app/api/chat/route.ts`, `components/chat/ChatInterface.tsx` transport body |
| Every read tool returns compacted, date-bounded data | each `execute` in `lib/intervals/tools.ts`, `lib/hevy/tools.ts` goes through `lib/intervals/compact.ts` (or an equivalent trim) |
| Tools return `{ error }`, never throw | each `execute` has try/catch |
| Every write tool is in `WRITE_TOOL_NAMES` (approval + kept by pruning) | compare tool names that create/update/delete with `lib/intervals/tool-names.ts` |
| Default model IDs only in `lib/llm/models.ts` | scan section "model ids" |
| No hardcoded hex colors in components (training-zone colors excepted), no gradients, no pulsing dots | scan section "hex colors / gradients / pulse" |
| API keys never logged, never in URLs, never committed | scan section "logging" + "secrets"; check `console.*` calls don't print request bodies/headers |
| Self-hosted: no Vercel-only services (KV, Edge Config, Blob) | scan section "vercel" |
| AI SDK v7 APIs only (`inputSchema`, `instructions`, `stopWhen`) | scan section "legacy AI SDK" |

## 3. Technical review areas

Read the code for these. Prefer depth on the risky paths (chat route, storage, tools) over breadth.

- **Security / data safety** — path traversal via `athleteId` / `chatId` in `lib/storage/*` (sanitization applied
  consistently, empty-after-sanitize case); request-body validation on every `app/api/**/route.ts` (zod or manual);
  keys from the request overriding env keys (acceptable by design, but must not be persisted or echoed); SSRF via any
  user-controlled URL; hardcoded fallback athlete IDs; error messages leaking upstream responses to the client.
- **Reliability** — non-atomic file writes (write-then-rename?), locking coverage for every writer of the same file,
  unbounded in-memory caches/maps (per-athlete caches, Hevy template cache, lock map), missing fetch timeouts /
  `AbortSignal` on Intervals.icu and Hevy calls, background work (`foldSummary`) that can race with the next request,
  swallowed errors that hide data loss.
- **Performance / token economy** — tool outputs or system-prompt sections that grow without bound, repeated
  identical upstream calls per request (cache opportunities), large client components re-rendering on every stream
  chunk, heavy imports pulled into client bundles (check `"use client"` files importing server-only modules).
- **Type safety** — `any`, `as` casts on external data, non-null assertions, untyped upstream JSON used without
  validation, duplicated types that should be shared.
- **Structure / maintainability** — oversized files (scan "largest files"; `components/Sidebar.tsx`,
  `CoachPreferencesModal.tsx`, `ChatInterface.tsx` are candidates), duplicated logic (date math, fetch wrappers,
  formatting), dead or unwired code, unused exports and dependencies, leftover TODO/FIXME.
- **Tooling & tests** — no test suite: identify the highest-value pure functions to cover first (e.g.
  `lib/intervals/workout.ts` parsing, `lib/chat/context.ts` pruning/summary cutoff, `lib/chat/approvals.ts` merging,
  `lib/intervals/compact.ts`); deprecated `next lint` with no ESLint config; missing CI; missing Docker/self-host
  story promised in CLAUDE.md.
- **Dependencies** — `pnpm outdated` and `pnpm audit --prod` (scan runs both); flag majors behind, known
  vulnerabilities, and packages pinned with `^` on fast-moving pre-1.0 or AI SDK packages where a minor could break.
- **Docs drift** — CLAUDE.md architecture table vs. actual files (scan lists files not mentioned in CLAUDE.md, e.g.
  `app/api/terrain`, `lib/intervals/terrain.ts`); `.env.example` vs. env vars actually read (scan "env vars");
  README accuracy.

## 4. Prioritize

Rate each verified finding:

- **P0** — broken now or a security/data-loss risk (typecheck failure, path traversal, key leakage, lost thought
  signatures, unbounded tool output).
- **P1** — invariant violation or reliability risk likely to bite soon (missing timeouts, non-atomic writes,
  unapproved write tool, provider logic leaking out of the route).
- **P2** — maintainability debt that slows future work (big components, duplication, no tests, dead code, doc drift).
- **P3** — nice to have.

Also estimate effort (S < 1h, M < 1 day, L > 1 day). Drop anything you could not confirm by reading the code, and
anything purely stylistic. Merge duplicates. Cap the report at ~15 items; mention how many lower-priority items were
omitted.

## 5. Report

Reply in chat (no files unless asked), in this shape:

```
## Tech debt audit — <scope>, <date>

Baseline: tsc ✅/❌ · build <ran/skipped: why> · outdated: N (M major) · audit: N vulns

| # | P | Area | Issue | Evidence | Fix | Effort |
|---|---|------|-------|----------|-----|--------|
| 1 | P0 | Storage | … | [chat-store.ts:31](lib/storage/chat-store.ts:31) | … | S |

### Notes
- Top 3 to do first and why (dependencies between fixes, quick wins).
- Things checked and found healthy (one line) so the next audit doesn't redo them.
```

End by offering to fix the top items (each fix then goes through the `verify` skill).
