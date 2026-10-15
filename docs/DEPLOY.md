# DEPLOY.md — running Dear Steven on a server

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| reviewed | ai | 2026-10-16 | P5-10, P10-01, P10-02 |

Dear Steven is one Node process and one SQLite file (ADR-001, ADR-002). Any host that runs a
container with a persistent volume works; serverless platforms do not, while the knowledge base
is a local file.

## Docker

```bash
docker build -t dear-steven .
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=… \
  -e DEAR_STEVEN_DAILY_BUDGET_USD=2 \
  -e DEAR_STEVEN_DB_PATH=/data/dear-steven.db \
  -v "$PWD/data:/data" \
  dear-steven
```

The image is a Next.js `standalone` build on `node:22-slim`. It runs as the non-root `node` user and
contains no data and no secrets. Build the knowledge base where you like (locally is easiest:
`pnpm ingest all`), then copy or mount `data/dear-steven.db` into the volume.

**A production server spends your key only under a daily cap** (P10-01). The image, like any
`next start`, runs visitors on `OPENAI_API_KEY` only when `DEAR_STEVEN_DAILY_BUDGET_USD` is set as
well. Without a cap it answers as if no key was given: demo answers, `/api/status` reports
`"demoReason":"no_daily_cap"`, and the log says once which variable to set. Visitors who bring
their own key still get live answers. `pnpm dev` and the ingest CLI are not held back.

## Health check

`GET /api/health` (P10-02) answers `200 {"ok":true}` only when the deployment can do what it was
configured to do, and `503 {"ok":false,"reason":"…"}` otherwise. The image's `HEALTHCHECK` and the
Fly.io check poll it. It answers without the access code and says nothing else: no paths,
messages, counts or spend. It never calls OpenAI.

- **Healthy:** forced demo (`DEAR_STEVEN_DEMO=1`); or, live or keyless on purpose (visitors bring
  their own key), a knowledge base that is ready: the database opens, it has passages, and the
  folder it lives in can be written.
- **Reasons:** `no_database` (no file at `DEAR_STEVEN_DB_PATH`), `empty` (no passages yet),
  `store_error` (the file doesn't open as a knowledge base; `/api/status` and the log say why),
  `data_dir_read_only` (the folder can't be written, so the spend ledger, the free-question counts
  and the share-link secret can't be saved: a volume owned by root is the usual cause), and
  `no_daily_cap` (your key is held back, above).

## Variables

Set secrets through the platform's secret store, never in a committed file.

| Variable | What it does | In production |
|----------|--------------|---------------|
| `OPENAI_API_KEY` | Your key: answers, embeddings, voice. Unset: demo, unless visitors bring their own. | Secret. Used for visitors only with a daily cap. |
| `DEAR_STEVEN_DAILY_BUDGET_USD` | The most the server may spend a UTC day, estimated (below). | **Required** for `OPENAI_API_KEY` to be used. |
| `DEAR_STEVEN_ALLOW_OPERATOR_KEY` | `0`: visitors must bring their own key; yours serves no one. | Optional. |
| `DEAR_STEVEN_FREE_QUESTIONS` | Questions each visitor gets on your key before they need their own (below). | Recommended: `3`. Needs the cap. |
| `DEAR_STEVEN_ACCESS_CODE` | A passcode for a private deployment (below). | Optional. Secret. |
| `DEAR_STEVEN_DB_PATH` | Where the knowledge base is. | `/data/dear-steven.db` |
| `DEAR_STEVEN_CLIENT_IP_HEADER`, `DEAR_STEVEN_TRUSTED_PROXIES` | Where rate limits find the client's address (below). | Fly.io: `fly-client-ip`. |

## Fly.io (one machine + one volume)

```bash
fly launch --no-deploy            # pick a name and region; keep one machine
fly volumes create kb --size 1
fly secrets set OPENAI_API_KEY=…  # never commit it
fly secrets set DEAR_STEVEN_DAILY_BUDGET_USD=2      # the most it may spend a day
fly secrets set DEAR_STEVEN_ACCESS_CODE="four words or more"   # optional: private deployment
fly deploy
fly ssh sftp shell                # put /data/dear-steven.db
```

`fly.toml` needs a `[mounts]` entry (`source = "kb"`, `destination = "/data"`) and
`DEAR_STEVEN_DB_PATH = "/data/dear-steven.db"` under `[env]`. Creating the account and setting
secrets is a human step (`plan/human/api-keys.md`).

## Operational notes

- **Daily spend cap** (`DEAR_STEVEN_DAILY_BUDGET_USD`): every paid call adds its estimated cost
  (from `PRICES` in `packages/core/src/config/models.ts` — keep those current) to
  `/data/spend.json`; at the cap, answers become an in-persona "come back tomorrow" and no OpenAI
  call is made until midnight UTC. Requests already running when it is reached still finish. The
  setup panel and `/api/status` show today's spend. Also set a hard limit in the OpenAI dashboard:
  this cap is an estimate. A production server doesn't use your key at all without it (above);
  `0` is a cap that spends nothing, and an unreadable value counts as `0`.
- **Share links** (P6-17): the server signs every answer it writes with a secret it creates on
  first use at `/data/share-secret` (owner-only). Keep it on the volume: deleting it, or running
  without a writable `/data`, makes every link shared so far stop opening. Several instances behind
  one address need the same file.
- **Visitors' own keys** (P6-03): anyone can paste their own OpenAI key in the setup panel; their
  requests then run on it and are neither counted against nor stopped by the daily cap (rate
  limits still apply). The key arrives in the `x-openai-key` header, over HTTPS only, and is
  never logged or stored — keep it that way: don't turn on request-header logging in a proxy in
  front of the app. In the browser it is kept encrypted (P8-01), and for 30 days at most when the
  visitor asks to be remembered. `OPENAI_BASE_URL`, if you set it, sends every OpenAI call there, visitors' keys
  included: point it only at an endpoint you would trust with them. To stop visitors spending your key, set
  `DEAR_STEVEN_ALLOW_OPERATOR_KEY=0`: without a key of their own they get demo mode.
- **Free questions** (P8-02): set `DEAR_STEVEN_FREE_QUESTIONS=3` and each visitor without a key of
  their own gets three questions on yours (an interview counts once), then is asked for their own.
  Counted per browser (an anonymous cookie) and per network (three times as many), kept 30 days as
  hashes in `/data/free-questions.json`, under a secret in `/data/free-secret`. Server voice is
  not offered on free questions; the browser's own voice is. Someone with many addresses can get
  more than three, and only `DEAR_STEVEN_DAILY_BUDGET_USD` bounds what that costs, so free
  questions need it (P8-09): without a cap none are given, and the server log says why.
  Set the client address up correctly (below), or every visitor shares one network's allowance.
- **Guided setup** (P6-04) is for a local clone only: never set `DEAR_STEVEN_SETUP_TOKEN` or
  `DEAR_STEVEN_SETUP_HOST` on a deployment. Without them every `/api/setup` route answers 404, as
  it also does for any request whose Host isn't loopback.
- **Access code** (`DEAR_STEVEN_ACCESS_CODE`): the page asks for it, and every API route but the
  health check answers 401 without the signed cookie it sets. Guesses are limited to five a minute
  per client and thirty in all.

- **Rate limits** are in memory, per process (`apps/web/src/server/rate-limit.ts`). With more than
  one instance, put a shared limiter in front or keep to one machine.
- **Client addresses** (P8-01) key the rate limits. Each proxy appends the address it saw to
  `X-Forwarded-For`, so only its last entries can be trusted; the first is whatever the client
  sent. By default the app takes the last entry (one proxy in front, or none: Next.js fills it in
  from the connection). With more proxies in front (a CDN, then the platform), set
  `DEAR_STEVEN_TRUSTED_PROXIES` to how many. On a platform that sets a client-address header the
  client can't (`fly-client-ip` on Fly.io, `cf-connecting-ip` behind Cloudflare), set
  `DEAR_STEVEN_CLIENT_IP_HEADER` to it instead: it is then the only source. Never name a header
  your platform doesn't overwrite. IPv6 clients count by their /64.
- **Requests from other sites** (P8-08): the API refuses anything but a read when the browser says
  it comes from another site's page (Fetch Metadata, or an `Origin` that isn't this host), so no
  other page can make its visitors ask on your key. A proxy in front must pass on the `Host` the
  browser asked for, or set `X-Forwarded-Host`; most do.
- **Costs** scale with questions: each live answer is one answer call, one embedding, plus one
  condensation call for follow-ups, and occasionally one repair call.
- **Logs** contain no questions, keys or provider error text. Answer logging is opt-in
  (`DEAR_STEVEN_LOG_ANSWERS=1`).
