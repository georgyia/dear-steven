# AGENTS.md — entry point for every agent working in this repository

You are building **Dear Steven**. Read this file completely before your first tool call, then read
the documents in the order given below.

---

## 1. Read order

| # | Document | Why |
|---|----------|-----|
| 1 | `AGENTS.md` (this file) | Rules, stack, commands, skills |
| 2 | `plan/README.md`, then `plan/STATUS.md` | How planning works; what is next |
| 3 | `docs/PRODUCT.md` | What we are building; vocabulary you must use |
| 4 | `docs/ARCHITECTURE.md` | Module boundaries, data flow, trust boundaries |
| 5 | `docs/PERSONA.md` | The persona and the four kinds of statement — binding for anything that writes answers |
| 6 | `docs/DESIGN.md` | Visual system — binding for all UI |
| 7 | `docs/WORKFLOW.md` | Issue → branch → PR → merge |
| 8 | `docs/REVIEW-CHECKLIST.md` | Self-review before requesting review |
| 9 | `plan/10-harness.md` § Skill matrix | Which skills your issue's labels require |
| 10 | `plan/09-security/SECURE-CODING.md` | **Any issue labelled `risk:medium` or `risk:high`** |
| 11 | The issue you are implementing (`plan/04-issues/` + GitHub) | The only scope you may touch |

An issue is written so that `AGENTS.md` + `plan/` + the linked docs + the issue body are
sufficient. If they are not, say so on the issue rather than inventing requirements.

---

## 2. The one sentence everything serves

> **Ask Steven a real question and get a thoughtful first-person answer whose every claim you can click through to the exact moment it was said.**

Every screen, API, test and log line must make that sentence more obvious — or get cut.

---

## 3. Stack

- Node.js ≥ 22.18 (built-in TypeScript type stripping), pnpm 10 workspaces, TypeScript 6 (not 7:
  `next build` needs the classic compiler API).
- `apps/web`: Next.js 16.4 (App Router, Turbopack), React 19.3, Tailwind CSS v4, `motion` 12,
  React Bits components vendored in `src/components/vendor/react-bits/`.
- `packages/core`: zod 4, better-sqlite3 13 + sqlite-vec 0.1.9 (vec0) + FTS5, OpenAI SDK v6
  (Responses API, strict JSON schema), partial-json.
- `packages/ingest`: Node CLI, fast-xml-parser, ffmpeg (diarization only).
- Tests: Vitest 5 (unit), Playwright 1.64 (e2e). Lint/format: Biome 2.5. Architecture rules:
  dependency-cruiser. CI: GitHub Actions.
- Next.js 16 ships its own docs at `apps/web/node_modules/next/dist/docs/` — check them before
  using a Next API you are unsure of; this version differs from older training data.

## 4. Commands

```bash
pnpm install
pnpm check          # biome + tsc (all packages) + vitest + dependency-cruiser — green before every PR
pnpm dev            # web app on :3000 (demo mode without OPENAI_API_KEY)
pnpm e2e            # Playwright, desktop + mobile, against a production build in demo mode
pnpm ingest help    # knowledge-base CLI (pnpm ingest all --limit 20 for a starter set)
pnpm eval           # retrieval recall@10; --answers runs the full pipeline (needs a key, costs cents)
pnpm format         # biome --write
```

---

## 5. Architecture rules (non-negotiable)

- Domain decisions live in **exactly one place**: `packages/core`. Retrieval, prompt building,
  answer validation, quote matching, YouTube link building and speaker attribution are decided
  there — the web app and the CLI call them, they never re-implement them.
- `packages/core` imports nothing from `next`, `react`, `react-dom`, `motion` or `apps/*`.
- Client components (`apps/web/src/components/**`) never import `@dear-steven/core/{store,
  retrieval,answer,ingest,openai,config}`. Secrets and the database are server-only.
- These three are enforced by `pnpm arch` (dependency-cruiser) in `pnpm check` and CI.
- Nothing unvalidated reaches the browser: a block is streamed only after `validateBlock` passes;
  quotes shown are always stored transcript spans.
- Every change under `packages/core` ships tests in the same PR.
- No transcripts, audio, embeddings or `data/` in git. No real credentials anywhere but `.env`.

---

## 6. Skills — mandatory per issue type

Skills live in **`.agents/skills/`** (committed) and are symlinked into `.claude/skills/` so Claude
Code picks them up. Cursor / Codex / Copilot read `.agents/skills/` directly.

See `plan/10-harness.md` for the full label → skill matrix. Minimum:

| Issue type | Skills you must consult |
|-----------|--------------------------|
| `type:ui`, `type:design` | frontend design skills, `docs/DESIGN.md`, `dear-steven-architecture` |
| `type:core` | TypeScript clean-code + testing skills, `dear-steven-architecture` |
| anything touching answers or the persona | `dear-steven-persona` |
| `type:test` | testing skills + Playwright |
| `type:infra`, `type:docs` | naming + comments skills where code is touched |
| `risk:medium`, `risk:high` | `dear-steven-security` (**mandatory**) + differential review |
| any PR review | clean-code-reviewer (+ correctness) |

---

## 7. Hard rules

1. **One issue per PR.** No drive-by refactors, no "while I was in there".
2. **Stay in scope.** Out-of-scope work → open a new issue.
3. **Conventional Commits** with an allowed scope (`commitlint.config.js`, `plan/06-workflow.md`).
4. **`pnpm check` green** before you push. CI runs the same thing plus e2e and gitleaks.
5. **Core changes ship tests** in the same PR.
6. **New dependencies must be justified** in the PR description. Default answer is no.
7. **`risk:high` waits for a human.** Never create accounts, spend money (OpenAI diarization,
   embeddings at scale), grant consent, or sign off on a person's behalf — link the runbook in
   `plan/human/` and ask on the issue.
8. **Never fabricate on the persona's behalf.** No fixture, test, prompt or doc may put invented
   words in Steven Bartlett's mouth or present fixtures as real. Demo data is labelled demo.
9. **No AI attribution** in commits, PRs or issues (no `Co-Authored-By` for an AI tool, no
   "Generated with …").
10. **Never push directly to `main`.**
11. **If acceptance criteria are wrong**, say so on the issue and get them amended — do not
    silently implement something else.

---

## 8. How to pick work

1. Open `plan/STATUS.md`.
2. Take the lowest-numbered open issue in the current phase whose dependencies are closed and
   which has no unresolved `needs:human` or `needs:decision`.
3. Comment `taking` on the GitHub issue.
4. Load skills for its labels. Follow `docs/WORKFLOW.md`.
