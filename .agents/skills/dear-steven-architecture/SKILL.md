---
name: dear-steven-architecture
description: Where things live in Dear Steven and how to add a feature end to end without breaking the boundaries. Use for any type:core, type:ui or type:service issue, or whenever you are unsure which package a change belongs in.
---

# dear-steven-architecture

Source of truth: `docs/ARCHITECTURE.md` (current) and `plan/12-adr/` (why).

## Boundaries (enforced by `pnpm arch`)

- `packages/core` decides; it imports no `next`/`react`/`motion`/`apps/*`/`packages/ingest`.
- `apps/web` renders and transports; route handlers call core; client components import only
  client-safe core entry points: `schema` (types), `limits`, `copy`, `format`, `youtube`.
- `packages/ingest` orchestrates I/O around core's pure ingest logic; never imported by the web.

## Adding a feature end to end

1. Types first: extend a zod schema in `packages/core/src/schema/` (SSE events in `ask.ts`).
2. Logic in core with unit tests next to it (`*.test.ts`); use `src/test/fixtures.ts` for a temp
   store and the fake embedder; script the model with an `AnswerModel` fake (see `compose.test.ts`).
3. A route in `apps/web/src/app/api/*` that validates input, applies `takeToken`, and calls core.
4. UI: client components under `components/`, state through `lib/stage-machine.ts` /
   `lib/conversation.ts`, tokens from `docs/DESIGN.md`, copy in `src/brand.ts`.
5. E2E in `apps/web/e2e/` against demo mode; extend `lib/demo-fixtures.ts` if the UI needs data
   (fixtures stay fictional and labelled).
6. Docs: update `docs/*` for behaviour, `plan/STATUS.md` for progress — in the same PR.

## Conventions

- Relative imports inside `packages/*` carry `.ts` extensions (Node runs TypeScript natively).
- Model ids and prices only in `packages/core/src/config/models.ts`.
- New env vars only with a justification in `.env.example` and `readConfig()`.
