## What changed

<!-- Two or three lines, in product vocabulary (docs/PRODUCT.md). -->

Closes #

## Acceptance criteria

<!-- Copy the checklist from the issue; tick each one and say how it was verified. -->

- [ ]

## Security impact

<!-- Required on every risk:* PR. Write "None — <reason>" only on risk:low. -->

- **Data touched:**
- **Secrets:**
- **Paid calls (OpenAI / YouTube):**
- **Threat-model delta:**
- **Requirements:** <!-- SR ids (plan/09-security/THREAT-MODEL.md) + the test that proves each -->

## Risk label justification

<!-- One line: why risk:low / medium / high (plan/06-workflow.md). -->

## Screenshots

<!-- Required for type:ui / type:design: 375, 768 and 1280 px; reduced motion if motion changed. -->

## Evidence and persona

<!-- Required if this touches answers, prompts, the validator, fixtures or copy. -->

- [ ] No unvalidated model text can reach the browser
- [ ] `pnpm eval` result: <!-- recall@10 -->
- [ ] `pnpm eval --answers` (if required by the issue): <!-- paste the summary line -->

## Verification

- [ ] `pnpm check` green locally
- [ ] `pnpm e2e` green (UI changes)
- [ ] Self-review against `docs/REVIEW-CHECKLIST.md` posted as a comment
- [ ] risk:* — `plan/09-security/SECURITY-REVIEW-CHECKLIST.md` posted as a comment
- [ ] `plan/STATUS.md` updated

## Notes for the reviewer

<!-- Non-obvious decisions, new dependency justification, follow-up issues. -->
