# H-08 — Hosting

**Unblocks:** P5-10
**Start when:** you want it reachable beyond localhost

## Steps (Fly.io)

1. Create a Fly.io account and install `flyctl`; `fly auth login`.
2. In the repository: `fly launch --no-deploy` (one machine, a region near you).
3. `fly volumes create kb --size 1`.
4. `fly secrets set OPENAI_API_KEY=…` (never commit it). Consider a separate OpenAI project with
   its own budget for the public deployment.
5. Add to `fly.toml`: `[mounts] source = "kb" destination = "/data"` and under `[env]`
   `DEAR_STEVEN_DB_PATH = "/data/dear-steven.db"`.
6. Build the knowledge base locally (`pnpm ingest all`), then upload it:
   `fly deploy` → `fly ssh sftp shell` → `put data/dear-steven.db /data/dear-steven.db`.
7. Decide who may use it. The app has no accounts; if it is public, anyone can spend your OpenAI
   budget up to the rate limits. Put it behind Fly's private networking, a password proxy, or
   keep the budget low.

## Verify

`https://<app>.fly.dev/api/status` shows `"mode":"live"` and your passage count.

## Tell the agent

> H-08 done. App: `<name>.fly.dev`. Access: public / private (how). Budget: $__/month.
