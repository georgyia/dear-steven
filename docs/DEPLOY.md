# DEPLOY.md — running Dear Steven on a server

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| reviewed | ai | 2026-10-16 | P5-10, H-08, P10-01, P10-02, P10-03 |

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
`pnpm ingest all`), then mount its folder, as above, or put a consistent copy of it in the volume
(Fly.io, step 4: not the bare `.db` file, which can be missing what is still in its `-wal`).

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

Every variable the web server reads. Set secrets through the platform's secret store
(`fly secrets set`), never in a committed file: `fly.toml` holds only the two plain settings
marked below.

| Variable | What it does | On a deployment |
|----------|--------------|-----------------|
| `OPENAI_API_KEY` | Your key: answers, embeddings, voice. Unset: demo, unless visitors bring their own. | Secret. Used for visitors only with a daily cap. |
| `DEAR_STEVEN_DAILY_BUDGET_USD` | The most the server may spend a UTC day, estimated (below). | **Required** for `OPENAI_API_KEY` to be used. |
| `DEAR_STEVEN_FREE_QUESTIONS` | Questions each visitor gets on your key before they need their own (below). | Recommended: `3`. Needs the cap. |
| `DEAR_STEVEN_ALLOW_OPERATOR_KEY` | `0`: visitors must bring their own key; yours serves no one. | Optional. |
| `DEAR_STEVEN_ACCESS_CODE` | A passcode for a private deployment (below). | Optional. Secret. |
| `DEAR_STEVEN_DB_PATH` | Where the knowledge base is; the spend ledger, the free-question counts and the secrets are kept beside it. | `/data/dear-steven.db` (the image's default; in `fly.toml`). |
| `DEAR_STEVEN_CLIENT_IP_HEADER` | A header the platform sets to the client's address, for rate limits (below). | Fly.io: `fly-client-ip` (in `fly.toml`). |
| `DEAR_STEVEN_TRUSTED_PROXIES` | Without that header: how many proxies append to `X-Forwarded-For` (default 1). | Unset on Fly.io. |
| `DEAR_STEVEN_DEMO` | `1`: demo answers only, even with a key. | Only until the knowledge base is uploaded (Fly.io, step 3). |
| `YOUTUBE_API_KEY` | For `pnpm ingest match-youtube` only; the server just reports whether it is set. | Not needed. |
| `OPENAI_BASE_URL` | Read by the OpenAI SDK: every OpenAI call goes there, visitors' keys included. | Unset, or an endpoint you trust with visitors' keys. |
| `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID` | Read by the OpenAI SDK and sent with every request. | **Don't set**: they would go out with visitors' own keys too, and fail their requests. |
| `DEAR_STEVEN_LOG_ANSWERS` | `1`: every question and answer into `answers.jsonl`, for the eval harness. | **Don't set**: it keeps visitors' questions. |
| `DEAR_STEVEN_SETUP_TOKEN`, `DEAR_STEVEN_SETUP_HOST` | Guided local setup (P6-04). | **Never set** (below). |
| `DEAR_STEVEN_ENV_FILE` | Another file to read keys from instead of `.env`. | Not needed: use secrets. |
| `DEAR_STEVEN_FEED_URL` | The feed `pnpm ingest discover` reads (the CLI's). | Not needed. |
| `NODE_ENV`, `PORT`, `HOSTNAME` | Set by the image: `production`, `3000`, `0.0.0.0`. | Leave them: `fly.toml`'s port is the image's. |

## Fly.io, from an empty account to a live site

One machine, one volume, configured by the committed `fly.toml`. Opening the account and paying
for it is the owner's step (H-08, `plan/human/deploy.md`); everything else is below, run from the
repository root.

1. **Name the app and create it.** Install `flyctl` and `fly auth login`. In `fly.toml`, set `app`
   (a name nobody on Fly.io has) and `primary_region` (`fly platform regions`). Then:

   ```bash
   fly apps create <app>
   fly volumes create kb --app <app> --region <region> --size 3 --snapshot-retention 14
   ```

   `fly launch` would write a new `fly.toml`; this one is committed, so create the app directly.
   Fly.io warns that one volume isn't redundant: that is intended (step 8). 3 GB: the knowledge
   base is about 110 MB at 114 episodes and will be some 300 MB at 300, and replacing it keeps the
   previous copy beside the new one until the new one is verified.

2. **Set the secrets**, staged so nothing starts yet. Typed on a command line they land in your
   shell history; `fly secrets import --stage --app <app> < file` reads the same `NAME=value`
   lines from a file kept outside the repository, which you delete afterwards.

   ```bash
   fly secrets set --stage --app <app> OPENAI_API_KEY=sk-…
   fly secrets set --stage --app <app> DEAR_STEVEN_DAILY_BUDGET_USD=2   # required for your key
   fly secrets set --stage --app <app> DEAR_STEVEN_FREE_QUESTIONS=3     # three on your key each
   fly secrets set --stage --app <app> DEAR_STEVEN_ACCESS_CODE="four words or more"   # private only
   ```

   The client address header and the database path are already in `fly.toml`. Check the table
   above for what not to set.

3. **Deploy one machine, in demo mode until the knowledge base is there.** The health check needs
   a knowledge base unless demo is forced, so the first deploy forces it:

   ```bash
   fly secrets set --stage --app <app> DEAR_STEVEN_DEMO=1
   fly deploy --app <app> --ha=false
   ```

   `--ha=false` keeps it to one machine (step 8).

4. **Make a consistent copy of the knowledge base**, locally:

   ```bash
   sqlite3 -readonly data/dear-steven.db ".backup data/upload.db"
   DEAR_STEVEN_DB_PATH=data/upload.db pnpm ingest status
   ```

   The database runs in WAL mode: recent writes can still be in `dear-steven.db-wal`, so copying
   the `.db` file alone ships a stale or broken copy. `.backup` writes one self-contained file,
   consistent even while an ingest run is writing. `pnpm ingest status` opens the copy with
   sqlite-vec, as the server will; note its passage count. Upload `upload.db` alone: when the
   command has finished, no `upload.db-wal` is left beside it.

5. **Upload it and give it to the app's user.** `fly ssh` runs as root, so the file it uploads,
   and on a new volume `/data` itself, belong to root. The app runs as `node` and writes beside
   the database (the spend ledger, the free-question counts, the share and free-question secrets);
   until it can, `/api/health` answers `503` `data_dir_read_only`.

   ```bash
   fly ssh sftp shell --app <app>
   » put data/upload.db /data/dear-steven.db
   » (Ctrl-D)
   fly ssh console --app <app> -C "chown -R node:node /data"
   ```

6. **Go live.** Unsetting the secret restarts the machine and waits for its health check:

   ```bash
   fly secrets unset --app <app> DEAR_STEVEN_DEMO
   ```

7. **Verify.**

   ```bash
   fly status --app <app>                      # one machine, its check passing
   curl -s https://<app>.fly.dev/api/health    # {"ok":true}
   curl -s https://<app>.fly.dev/api/status    # "mode":"live", step 4's passage count, "capUsd":2
   ```

   Behind an access code `/api/status` answers 401 to `curl`: open the site, enter the code, and
   read the setup panel instead. Then ask one question and open one citation at its moment.
   `fly logs --app <app>` must not show `[config]` (your key held back) or `[free]` lines.

8. **Why exactly one machine.** The daily cap is kept in one file (`/data/spend.json`) and in that
   process's memory, and so are the free-question counts, the rate limits and the interview
   tickets. Each machine would keep its own: two spend up to twice the cap and give twice the
   free questions, and an interview loses its ticket when a step lands on the other one. A volume
   also attaches to one machine only, so a second would start without a knowledge base. Deploy
   with `--ha=false`, never `fly scale count 2`. `fly.toml` keeps the machine running when idle:
   stopping it would drop the tickets and limits mid-conversation and make the next visitor wait
   for a cold start. The price: a deploy or a host failure takes the site down for a minute.

### Replacing the knowledge base

Never copy over the live file. The server keeps it open, and an old `-wal` or `-shm` file next
to a different `.db` corrupts it. Upload beside it, swap, then restart, so the server opens the new
file afresh. The web server only reads the knowledge base, so between the swap and the restart it
goes on serving the copy it has open.

```bash
# 1. Copy and check it, as in step 4.
# 2. Upload it beside the live one, swap the two, and restart:
fly ssh sftp shell --app <app>
» put data/upload.db /data/dear-steven.db.new
» (Ctrl-D)
fly ssh console --app <app> -C "sh -c 'cd /data && mv dear-steven.db dear-steven.db.prev && rm -f dear-steven.db-wal dear-steven.db-shm && mv dear-steven.db.new dear-steven.db && chown node:node dear-steven.db'"
fly apps restart <app>
# 3. Verify as in step 7: the passage count is the new one. Then drop the previous copy:
fly ssh console --app <app> -C "rm /data/dear-steven.db.prev"
```

To go back before that last step, swap `dear-steven.db.prev` in the same way.

### Backups

- **Volume snapshots.** Fly.io snapshots the volume daily and keeps them for the retention set in
  step 1 (14 days; 5 by default). They hold the knowledge base, the spend ledger, the
  free-question counts and the `share-secret` and `free-secret` files. Take one before anything
  risky: `fly volumes list --app <app>`, then `fly volumes snapshots create <volume-id>`. To
  restore, create a volume from one (`fly volumes create kb --snapshot-id <id> --region <region>`),
  destroy the machine (`fly machine destroy <machine-id> --force`), deploy again with
  `--ha=false` so the new machine takes the restored volume, then delete the old volume.
- **The local copy.** Keep the last `upload.db` (or the local `data/dear-steven.db` it came from):
  the knowledge base holds nothing about visitors, and the server can always be refilled from it.
- **The deployment's secrets.** `fly secrets list` shows only digests: keep the values (your
  OpenAI key, the access code, the cap) in a password manager. The `share-secret` and
  `free-secret` files live on the volume and in its snapshots; for a copy beyond Fly.io, fetch
  them with `fly ssh sftp get /data/share-secret` into the same password manager, never into git.
  Losing `share-secret` stops every share link made so far from opening; losing `free-secret`
  gives everyone their free questions again.

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
