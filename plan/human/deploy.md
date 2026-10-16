# H-08 — Hosting

**Unblocks:** P5-10
**Start when:** you want it reachable beyond localhost
**Runbook:** `docs/DEPLOY.md` § "Fly.io, from an empty account to a live site" (P10-03). Every
command is there; this page is the decisions only you can make.

## Decide first

1. **Who may use it.** Private: set `DEAR_STEVEN_ACCESS_CODE` (four words or more) and give the
   code to the people you choose. Public: the terms, privacy notice and legal notice must be
   ready (P6-12), and anyone can reach it.
2. **What it may spend.** `DEAR_STEVEN_DAILY_BUDGET_USD` is required: without it the deployment
   doesn't use your key at all (P10-01). Also give the key a monthly budget in the OpenAI
   dashboard; a separate OpenAI project for the deployment keeps its bill apart.
3. **Who pays for answers.** Free questions on your key (`DEAR_STEVEN_FREE_QUESTIONS=3`, then
   visitors add their own key), no limit per visitor (unset: only the cap and the rate limits),
   or none at all (`DEAR_STEVEN_ALLOW_OPERATOR_KEY=0`: every visitor brings their own key).
4. **Name and region.** The app name (`<name>.fly.dev`) and the region nearest your visitors.

## Steps

1. Create a Fly.io account (it needs a card) and install `flyctl`.
2. Follow the runbook, steps 1 to 7. It creates the app and a 3 GB volume, sets your secrets,
   deploys one machine, uploads a consistent copy of your local knowledge base, and verifies.
   The client address for rate limits and free questions (`fly-client-ip`) is already set in
   `fly.toml`.
3. Keep the values of your secrets (key, cap, access code) in a password manager, and read the
   runbook's "Backups" once.

## Verify

- `https://<name>.fly.dev/api/health` answers `{"ok":true}`; `fly status` shows one machine with
  its check passing.
- `https://<name>.fly.dev/api/status` shows `"mode":"live"`, the passage count `pnpm ingest status`
  gave for your copy, and your cap (behind an access code: the setup panel shows the same).
- One question answered live, and one citation opened at its moment.

## Tell the agent

> H-08 done. App: `<name>.fly.dev`. Access: public / private. Daily cap: $__. Free questions: __
> (or off / visitors' own keys only). Passages live: __.
