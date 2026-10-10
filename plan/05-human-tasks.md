# 05 — Human tasks

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | human | 2026-10-10 | H-* |

Every step only a person can take. Each has a runbook in `plan/human/`. Agents never do these on
your behalf; they ask on the blocking issue and move on.

| Id | Task | Blocks | Runbook | Lead time |
|----|------|--------|---------|-----------|
| H-01 | Create the GitHub repository, push, enable branch protection | CI enforcement, issue sync | `human/github-setup.md` | 15 min |
| H-02 | Harness decisions (third-party skills, MCP servers) | P0-05 | `human/harness-decisions.md` | 10 min |
| H-03 | Add `OPENAI_API_KEY` (and optionally `YOUTUBE_API_KEY`) to `.env` | live answers, embeddings, video links, P3-08 | `human/api-keys.md` | 10 min |
| H-04 | Record a 2–10 s clip of the host's voice for diarization | P2-05 real run | `human/host-voice-clip.md` | 15 min |
| H-05 | Approve a diarization budget and run it | verified host/guest statements | `human/transcription-budget.md` | minutes + spend |
| H-06 | Separate GitHub identity for agents + human-reviewer list | `risk:high` merge gate | `human/agent-identity.md` | 30 min |
| H-07 | First live evaluation: run `pnpm eval --answers` and judge usefulness | M1 exit (P3-08), P5-01 | `human/first-live-eval.md` | 30 min + ~$0.10 |
| H-08 | Hosting account, volume and secrets (Fly.io or a VPS) | P5-10 | `human/deploy.md` | 30 min |
