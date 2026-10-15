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
  this cap is an estimate.
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
  more than three: keep `DEAR_STEVEN_DAILY_BUDGET_USD` set, which bounds the bill whatever happens.
  Set the client address up correctly (below), or every visitor shares one network's allowance.
- **Guided setup** (P6-04) is for a local clone only: never set `DEAR_STEVEN_SETUP_TOKEN` or
  `DEAR_STEVEN_SETUP_HOST` on a deployment. Without them every `/api/setup` route answers 404, as
  it also does for any request whose Host isn't loopback.
- **Access code** (`DEAR_STEVEN_ACCESS_CODE`): the page asks for it, and every API route answers
  401 without the signed cookie it sets. Guesses are limited to five a minute per client and
  thirty in all.

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
