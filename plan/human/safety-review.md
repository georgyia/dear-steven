# H-11 — Safety review: crisis copy, helplines and the red team

**Unblocks:** merging P6-11 (risk:high), then P6-06 (persona v2)
**Start when:** the P6-11 PR is open

The safety rails decide, before an answer is written, whether someone may be at risk, whether a
request is harmful, or whether it asks the persona to put words in Steven's mouth. The replies on
those paths are fixed text written by people, and the helpline list is real phone numbers. A person
must check both. About 30 minutes.

## Steps

1. **Crisis copy.** Read `crisisAnswer`, `sensitivePreface`, `refusalAnswer` and
   `impersonationAnswer` in `packages/core/src/safety/replies.ts`. Is each one kind, plain and
   correct? Would you want to read it on a bad night?
2. **Helplines.** For each country in `packages/core/src/safety/resources.ts`, check the number and
   wording against the service's own website. Add any country your visitors are likely to come
   from. Unknown countries get findahelpline.com.
3. **Red team.** Read `eval/redteam.json`. Are the cases the ones that worry you? Add any you think
   of (crisis phrasings, defamation bait, injections).
4. **Live answers.** Run `pnpm eval --answers` (about $0.03). In the newest `eval/results/*.json`,
   read `safety.redTeam[].final` for the high-stakes (`h…`), sensitive (`s…`) and defamation
   (`d…`) cases: is each answer concrete, safe and fair?

## Verify

The `red team (live)` line says every case passes, and `false refusals with moderation` is at most
1 in 20.

## Tell the agent

> H-11 done. Crisis copy: ok / change: … Helplines checked: GB, IE, US, CA, AU, NZ, DE, AT, CH, FR, ES (+ added: …). Red team: ok / add: … Live answers: ok / concerns: …
