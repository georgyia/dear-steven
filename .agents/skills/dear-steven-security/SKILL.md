---
name: dear-steven-security
description: Dear Steven's secure-coding rules. Mandatory on every issue or PR labelled risk:medium or risk:high, and whenever code touches API keys, rate limits, request validation, uploads, logging, the citation validator, the quote matcher, paid OpenAI calls, CI workflows or the Dockerfile.
---

# dear-steven-security

Read and follow `plan/09-security/SECURE-CODING.md`; on review, answer
`plan/09-security/SECURITY-REVIEW-CHECKLIST.md`; record changes in `plan/09-security/THREAT-MODEL.md`.

## The five things that matter most here

1. **Keys stay on the server.** Only `readConfig()` (`packages/core/src/config/env.ts`) reads them.
   Never log them; never put provider error text in logs or responses (`describeFailure`).
2. **Model output is untrusted until validated.** Every block goes through `validateBlock`;
   quotes are re-derived with `locateQuote`; attribution may only be downgraded.
3. **Transcript text is untrusted.** It stays inside `<sources>` with angle brackets neutralised;
   FTS queries go through `toFtsQuery`; SQL is parameterised.
4. **Every paid call is bounded** — route rate limits, CLI `--budget`, `--dry-run`.
5. **No data in git** — `data/`, `.env*`, audio, transcripts, embeddings are gitignored; gitleaks runs in CI.

## Obligations on risk:* PRs

- Fill **Security impact** in the PR (data touched, secrets, paid calls, SR ids + proving tests).
- Add or update a negative test for each SR id you touch.
- On `risk:high`, wait for a human approval.
