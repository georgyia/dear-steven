# syntax=docker/dockerfile:1.7
# Dear Steven: one container running the Next.js standalone server. The knowledge base lives on a
# mounted volume (DEAR_STEVEN_DB_PATH); the image contains no data and no secrets. See docs/DEPLOY.md.

FROM node:22.23.1-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Toolchain for better-sqlite3 in case no prebuilt binary matches the platform.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/ingest/package.json packages/ingest/
COPY eval/package.json eval/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @dear-steven/web build \
  && mkdir -p /out/apps/web/.next \
  && cp -R apps/web/.next/standalone/. /out/ \
  && cp -R apps/web/.next/static /out/apps/web/.next/static

FROM node:22.23.1-slim AS run
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DEAR_STEVEN_DB_PATH=/data/dear-steven.db
WORKDIR /app
COPY --from=build --chown=node:node /out ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
