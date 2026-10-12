# 00 — Vision and exit criteria

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | human | 2026-10-10 | every issue |

## 1. What we are building

**Dear Steven** is a personal, open-source AI persona inspired by Steven Bartlett's interview
style on *The Diary Of A CEO*. You ask it a real question, by text or voice; it answers in the first
person, drawing on a local, incrementally-built index of real episode transcripts, and every claim
it attributes to anyone links to the exact passage and moment it came from. The persona is the
interface; the interviews are the evidence base; a deterministic validator stands between them.

## 2. North star

> **Ask Steven a real question and get a thoughtful first-person answer whose every claim you can click through to the exact moment it was said.**

## 3. Exit criteria

### M1 — complete text Q&A with real citations (Phases 0–3)

1. `pnpm install && pnpm dev` on a fresh clone shows the full experience in labelled demo mode,
   with no keys. ✅
2. `pnpm ingest all --limit 20` builds a knowledge base from the official RSS feed in one command. ✅
3. Retrieval recall@10 ≥ 0.8 on the seed set (`pnpm eval`). ✅ (100% on 20 questions, keyword-only)
4. On the eval set with a real key (`pnpm eval --answers`): 100% of rendered citations resolve to
   stored passages; 0 speaker-attribution violations; quotes byte-match stored spans; persona lint
   clean; every unanswerable question comes back `insufficient` with no citations; time to first
   block p50 < 3 s. ⏳ **needs H-07** (pipeline verified with scripted models; not yet with OpenAI)
5. Lighthouse accessibility ≥ 95 at 375 and 1280; works at 375 / 768 / 1280; reduced motion
   verified. ✅ Lighthouse 100 / 100 on home; axe WCAG 2.1 A/AA clean on every interactive state at
   375 and 1280 (P1-08).
6. `pnpm check` and CI green; architecture rules enforced.

### M2 — voice (Phase 4)

7. Speak a question (push-to-talk or toggle); hear a spoken reply in the same persona; citations
   stay on screen. ✅
8. Firefox uses server transcription; a denied microphone is explained and recoverable; nothing
   plays without a user gesture; typing always works. ✅ (e2e with a fake microphone)

### M3 — depth (Phase 5, each item evaluated on its own)

9. Each shipped Phase 5 item has an eval or e2e test proving it helps, not just that it runs.

## 4. Non-goals

- Impersonating Steven Bartlett (name, voice, likeness) or implying affiliation with the show.
- Generating content the sources don't support and presenting it as said on the show.
- Hosting or redistributing transcripts; scraping YouTube captions.
- Accounts, multi-tenant hosting, payments, analytics, ads.
- Always-on listening by default.

## 5. Personas

| Persona | Cares about |
|---------|-------------|
| The listener with a problem | A useful, warm answer; trust that it isn't made up |
| The checker | Who said it, where, when; verbatim text; one click to the video |
| The maintainer (one developer) | One command to ingest; cheap to run; easy to understand |

## 6. Constraints

- One developer; local-first; one SQLite file; one Node process; Docker for deploy.
- OpenAI is the only paid provider; paid steps are human-approved and budget-capped.
- TypeScript only (no Python toolchain).
- Dear Steven is PolyForm Noncommercial 1.0.0 (P6-13): never sold or commercialised. React Bits
  components are MIT + Commons Clause: used inside the app only.
