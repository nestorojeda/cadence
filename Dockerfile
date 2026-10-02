# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm && corepack prepare pnpm@10.12.1 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# `make dev`: next dev with the source bind-mounted over /app (see compose.yaml).
FROM deps AS dev
ENV NODE_ENV=development HOSTNAME=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["pnpm", "dev", "-H", "0.0.0.0"]

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN NEXT_OUTPUT=standalone pnpm build

FROM node:24-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["node", "server.js"]
