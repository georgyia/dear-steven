# H-03 — API keys

**Unblocks:** live answers, embeddings (semantic search), video deep links, P3-08 / H-07
**Start when:** you want real answers instead of demo fixtures

## Steps

1. OpenAI: create a **project** at platform.openai.com dedicated to Dear Steven, create a project
   API key, and set a **monthly budget limit** on the project (e.g. $10). Make sure the project has
   access to: `gpt-6-luna`, `text-embedding-3-small`, `gpt-4o-mini-transcribe`, `gpt-4o-mini-tts`
   (and `gpt-4o-transcribe-diarize` only if you will do H-05).
2. YouTube (optional): in Google Cloud Console create a project, enable **YouTube Data API v3**,
   create an API key, and restrict it to that API.
3. `cp .env.example .env` at the repository root and fill in `OPENAI_API_KEY` (and
   `YOUTUBE_API_KEY`). `.env` is gitignored — never commit it or paste it anywhere.
4. Run:
   ```bash
   pnpm ingest doctor           # both keys should show ✓
   pnpm ingest index --dry-run  # prints the embedding cost first (≈ $0.015 per 20 episodes)
   pnpm ingest index
   pnpm ingest match-youtube    # if you added the YouTube key
   pnpm dev                     # the status pill should read "20 conversations · ready"
   ```

## Verify

- Ask "Is overnight success a myth?" — the answer cites the Druski episode with dashed
  (speaker-unverified) chips, and the inspector's Video tab opens YouTube (`≈` if estimated).

## Fallback

Without a key the app stays in labelled demo mode and keyword search still works for the CLI.

## Tell the agent

> H-03 done. OpenAI key: set (project budget $__). YouTube key: set/not set. `pnpm ingest status` shows __ passages, __ embedded, __ episodes linked.
