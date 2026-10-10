# Secure coding (project baseline)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every `risk:*` issue; `.agents/skills/dear-steven-security` |

1. **Secrets live in `.env` (local) or platform secrets (production)**, are read only by
   `readConfig()` on the server, and never appear in logs, URLs, error messages, fixtures or tests.
2. **Validate every external input at the boundary** with zod (`strictObject` where feasible):
   request bodies, uploads (size + MIME), path params (regex), CLI numbers.
3. **Never trust the model.** Model output is data until `validateBlock` passes. Never render model
   text that claims a quote — render the stored span. Never let a citation id through that wasn't
   retrieved for this question.
4. **Transcript text is untrusted.** Keep it inside `<sources>`, neutralise angle brackets, never
   interpolate it into anything executable (SQL is parameterised; FTS goes through `toFtsQuery`).
5. **Fail closed on attribution**: when in doubt, downgrade (`episode`, then `synthesis`), never
   upgrade.
6. **Do not log provider error text, questions or answers.** Log status codes and error names
   (`describeFailure`). Answer logging is opt-in and local.
7. **Every paid call is bounded**: rate limits on routes, `--budget` on CLI stages, dry-runs for
   bulk embedding.
8. **Pin third-party Actions by commit SHA**; least-privilege `permissions:`; no
   `pull_request_target`; untrusted strings via `env:`.
9. **New dependencies require justification** and a supply-chain check (maintainer, downloads,
   install scripts — pnpm blocks install scripts except `onlyBuiltDependencies`).
10. **Containers** run as non-root with no data or secrets baked in.
11. Every `risk:*` PR fills **Security impact** in the PR template with the SR ids it touches and
    the test that proves each.

## On `risk:high`

- Human approval required before merge.
- Post `SECURITY-REVIEW-CHECKLIST.md` as a PR comment, answered.
