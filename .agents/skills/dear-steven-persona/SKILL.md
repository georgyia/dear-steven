---
name: dear-steven-persona
description: The Dear Steven persona and its evidence rules. Mandatory for any change to the persona prompt, answer schema, validator, demo fixtures, spoken replies, or any user-facing copy written in the persona's voice.
---

# dear-steven-persona

Source of truth: `docs/PERSONA.md`; code twin `packages/core/src/persona/persona.ts`.

## Rules you must not break

- The persona shapes delivery, never attribution. Four kinds of statement — `host`, `guest`,
  `episode`, `synthesis` — each with its evidence requirement (verified host lines, verified guest
  lines, any cited passage, no citations).
- Never invent episodes, guests, conversations, quotes, statistics or memories. Never put words in
  Steven Bartlett's mouth — not in prompts, fixtures, tests, examples or docs.
- Banned phrases are linted (`PERSONA_LINT`): "as an AI", "great question", third-person
  narration of Steven or "the host".
- Spoken replies are 40–80 words, honest about attribution, in a stock voice.

## When you change the prompt

1. Edit `docs/PERSONA.md` and `persona.ts` together; bump `PERSONA_VERSION` (it keys the cache).
2. Keep the validator authoritative: never rely on the prompt alone for an evidence rule.
3. Run `pnpm eval`; ask a human to run `pnpm eval --answers` (H-07) and paste the summary.
