# Security review checklist

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every `risk:medium` / `risk:high` PR |

Post as a PR comment (author and reviewer).

## Inputs and trust
- [ ] New inputs validated at the boundary (schema, size, type)
- [ ] Model output still passes through `validateBlock` before reaching the browser
- [ ] Transcript text still treated as untrusted data (SR-03)

## Secrets and data
- [ ] No secrets in code, logs, URLs, fixtures, tests or client bundles (SR-05, SR-06)
- [ ] No new data egress destination (or it is listed in `docs/ARCHITECTURE.md` §5)
- [ ] Nothing new stored about users' questions or voice

## Money
- [ ] Every new paid call is rate-limited or budget-capped (SR-02, SR-13)

## Integrity
- [ ] Attribution can only be downgraded, never upgraded, without speaker evidence (SR-04)
- [ ] Quotes are still stored spans

## Dependencies and CI
- [ ] New deps justified; install scripts reviewed
- [ ] Workflow changes keep least privilege and SHA pinning

## Threat model
- [ ] Delta recorded in `THREAT-MODEL.md` (entry point, threat, requirement, test) or "none" with reason

## Verdict
- [ ] `approve` / `changes requested` — evidence linked above
