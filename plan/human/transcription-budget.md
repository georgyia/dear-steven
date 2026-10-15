# H-05 — Diarization budget

**Unblocks:** verified host and guest statements (ember and ivory chips)
**Start when:** H-03 and H-04 are done

RSS transcripts have no speaker labels, so every citation from them is credited to the
conversation. Diarized transcripts let the persona say "Dana explained…" or "I said…" with
evidence. Cost: ~$0.36 per audio hour → ~$0.50 per average episode; ~$10 for 20 episodes;
~$325 for the whole back catalogue.

## Steps

1. Decide the budget for this run (start small, e.g. $5 ≈ 10 episodes).
2. Run, newest first:
   ```bash
   pnpm ingest transcribe --diarize --budget 5 --host-clip data/voiceprints/steven.wav --limit 10
   # or, to add conversations the publisher has no transcript for:
   pnpm ingest transcribe --diarize --missing --budget 5 --host-clip data/voiceprints/steven.wav --limit 10
   pnpm ingest attribute        # check host share and flags before trusting the labels
   pnpm ingest chunk            # a new transcript un-indexes its episode, so this takes just those
   pnpm ingest index --dry-run  # then --budget <usd> to embed the new passages
   pnpm ingest summarise --dry-run   # then --budget <usd>: a new transcript drops the old summary
   ```
   The command stops before any episode that would take the run over budget and records each
   episode's cost (`pnpm ingest status` shows the total).
3. Spot-check one episode in the app: chips on quotes should now be ivory (guest) or ember (host).

## Fallback

Skip it: the product is designed to be honest with episode-level citations.

## Tell the agent

> H-05 done. Diarized __ episodes for $__. `attribute` flags: none / <list>.
