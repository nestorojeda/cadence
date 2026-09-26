#!/usr/bin/env bash
# Mechanical signals for the tech-debt-audit skill. Read-only; every hit is a lead to verify, not a finding.
# Run from the repo root: bash .claude/skills/tech-debt-audit/scan.sh

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 1

SRC="app lib components"
section() { printf '\n=== %s ===\n' "$1"; }
g() { grep -rnE --include='*.ts' --include='*.tsx' "$@" $SRC 2>/dev/null; }

section "largest files (lines)"
find $SRC -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | sed -n '2,11p'

section "provider imports outside app/api/chat/route.ts"
g "from ['\"]@ai-sdk/(google|openai|anthropic|openai-compatible)['\"]" | grep -v '^app/api/chat/route.ts:' || echo "none"

section "model ids outside lib/llm/models.ts"
g "['\"](gemini|gpt|claude|qwen|llama|o[0-9])[-:.0-9a-z]*['\"]" | grep -v '^lib/llm/models.ts:' || echo "none"

section "legacy AI SDK APIs (v3/v4)"
g "\bparameters: z\.|maxSteps|convertToCoreMessages|toDataStreamResponse|handleSubmit|streamText\(\{ *system:" || echo "none"

section "provider metadata handling (check nothing strips it)"
g "providerMetadata|callProviderMetadata" || echo "none"

section "hex colors / gradients / pulse in components and app"
grep -rnE --include='*.tsx' --include='*.css' "#[0-9a-fA-F]{3,8}\b|gradient|animate-pulse|animate-ping" components app 2>/dev/null \
  | grep -v '^app/globals.css:' || echo "none"

section "logging (check no keys/bodies are printed)"
g "console\.(log|info|debug|warn|error)"

section "possible secrets in tracked files"
git grep -nE "(AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9_-]{20,}|api[_-]?key['\"]?\s*[:=]\s*['\"][A-Za-z0-9_-]{16,})" -- . ':!pnpm-lock.yaml' || echo "none"
git ls-files | grep -E '^(data/|\.env)' | grep -v '\.env\.example$' && echo "^ tracked files that should be ignored" || true

section "vercel-only services"
g "@vercel/(kv|edge-config|blob|postgres)|process\.env\.KV_" || echo "none"

section "type escape hatches"
g ":\s*any\b|as any\b|<any>|@ts-ignore|@ts-expect-error|eslint-disable" || echo "none"
printf 'non-null assertions: '; g "[a-zA-Z0-9_)\]]!\." | wc -l | tr -d ' '
printf '"as" casts: '; g "\bas [A-Z][A-Za-z<>\[\]]*" | wc -l | tr -d ' '

section "fetch calls (check timeouts / AbortSignal)"
g "\bfetch\("
printf 'AbortSignal/timeout uses: '; g "AbortSignal|signal:" | wc -l | tr -d ' '

section "module-level caches / maps (check they are bounded)"
g "^(const|let) [a-zA-Z_]+ = new (Map|Set)|^const [a-zA-Z_]*[cC]ache" || echo "none"

section "file writes (check atomicity and locking)"
g "writeFile|appendFile|rename\(|unlink|rm\(" || echo "none"

section "request body parsing in API routes (check validation)"
grep -rnE "req(uest)?\.json\(\)|searchParams\.get" app/api 2>/dev/null
printf 'zod in app/api: '; grep -rl "from \"zod\"\|from 'zod'" app/api 2>/dev/null | wc -l | tr -d ' '

section "TODO / FIXME / HACK"
g "TODO|FIXME|HACK|XXX" || echo "none"

section "files not mentioned in CLAUDE.md"
for f in $(find $SRC -name '*.ts' -o -name '*.tsx' | sort); do
  base="${f%.*}"; dir="$(dirname "$f")"
  grep -qF "$f" CLAUDE.md || grep -qF "$base" CLAUDE.md || grep -qF "$dir/*" CLAUDE.md || grep -qF "$(basename "$base")" CLAUDE.md || echo "$f"
done

section "env vars read vs .env.example"
used=$(g -o "process\.env\.[A-Z_]+" | sed 's/.*process\.env\.//' | sort -u)
if [ -f .env.example ]; then
  documented=$( (grep -oE '[A-Z][A-Z0-9_]{3,}' .env.example; echo NODE_ENV) | sort -u)
  echo "read but not in .env.example:"; comm -23 <(echo "$used") <(echo "$documented") | sed 's/^/  /'
  echo "in .env.example but never read:"; comm -13 <(echo "$used") <(echo "$documented") | grep -v NODE_ENV | sed 's/^/  /'
else
  echo ".env.example missing; vars read:"; echo "$used" | sed 's/^/  /'
fi

section "dependency usage (declared deps never imported)"
for dep in $(node -e 'const p=require("./package.json");console.log(Object.keys(p.dependencies||{}).join(" "))'); do
  grep -rqE --include='*.ts' --include='*.tsx' --include='*.mjs' "from ['\"]$dep(/[^'\"]*)?['\"]|require\(['\"]$dep" $SRC *.ts *.mjs 2>/dev/null || echo "  $dep"
done
echo "(react-dom is used implicitly by next — expected)"

section "tests / lint / CI"
printf 'test files: '; find . -path ./node_modules -prune -o \( -name '*.test.ts*' -o -name '*.spec.ts*' \) -print | wc -l | tr -d ' '
ls .eslintrc* eslint.config.* 2>/dev/null || echo "no ESLint config"
ls .github/workflows 2>/dev/null || echo "no CI workflows"
ls Dockerfile docker-compose.* compose.* 2>/dev/null || echo "no Docker setup"

section "pnpm outdated"
pnpm outdated 2>&1 | tail -n 40

section "pnpm audit --prod"
pnpm audit --prod 2>&1 | awk '/^│ (low|moderate|high|critical) /{sev=$2} /^│ Package /{print "  " sev ": " $4} /vulnerabilit|^Severity/'  | sort | uniq -c
