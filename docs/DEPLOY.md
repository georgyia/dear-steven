# DEPLOY.md — running Dear Steven on a server

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| reviewed | ai | 2026-10-10 | P5-10 |

Dear Steven is one Node process and one SQLite file (ADR-001, ADR-002). Any host that runs a
container with a persistent volume works; serverless platforms do not, while the knowledge base
is a local file.

## Docker

```bash
docker build -t dear-steven .
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=… \
  -e DEAR_STEVEN_DB_PATH=/data/dear-steven.db \
  -v "$PWD/data:/data" \
  dear-steven
```

The image is a Next.js `standalone` build on `node:22-slim`. It runs as the non-root `node` user and
contains no data and no secrets. Build the knowledge base where you like (locally is easiest:
`pnpm ingest all`), then copy or mount `data/dear-steven.db` into the volume.

## Fly.io (one machine + one volume)

```bash
fly launch --no-deploy            # pick a name and region; keep one machine
fly volumes create kb --size 1
fly secrets set OPENAI_API_KEY=…  # never commit it
fly deploy
fly ssh sftp shell                # put /data/dear-steven.db
```

`fly.toml` needs a `[mounts]` entry (`source = "kb"`, `destination = "/data"`) and
`DEAR_STEVEN_DB_PATH = "/data/dear-steven.db"` under `[env]`. Creating the account and setting
secrets is a human step (`plan/human/api-keys.md`).

## Operational notes

- **Rate limits** are in memory, per process (`apps/web/src/server/rate-limit.ts`). With more than
  one instance, put a shared limiter in front or keep to one machine.
- **Behind a proxy**, the first `X-Forwarded-For` hop is treated as the client; only deploy behind
  a proxy that sets it.
- **Costs** scale with questions: each live answer is one answer call, one embedding, plus one
  condensation call for follow-ups, and occasionally one repair call.
- **Logs** contain no questions, keys or provider error text. Answer logging is opt-in
  (`DEAR_STEVEN_LOG_ANSWERS=1`).
