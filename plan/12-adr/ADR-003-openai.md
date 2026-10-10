# ADR-003 — OpenAI Responses API with strict structured output, behind small interfaces

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | human | 2026-10-10 | P3-*, P4-* |

**Decision owner:** human · **Supersedes:** —

## Context

The answer must be a structured object (blocks, segments, attributions, citations), validated
before display, streamed block by block. The brief asks for no additional paid APIs without
strong reason.

## Options

1. **OpenAI SDK v6, Responses API**, `text.format: json_schema` (strict) from zod via
   `zodTextFormat`, streamed `response.output_text.delta` parsed with `partial-json`.
2. Vercel AI SDK (`streamObject`, `useChat`).
3. Free-text with inline citation markup parsed afterwards.

## Decision

Option 1. Models (all in `packages/core/src/config/models.ts`): `gpt-6-luna` for answers
(reasoning effort low), condensation (`none`) and guest-name fallback; `text-embedding-3-small`
(1,536); `gpt-4o-mini-transcribe` (browser fallback STT); `gpt-4o-transcribe-diarize` (ingest);
`gpt-4o-mini-tts` with a stock voice. `prompt_cache_key` = persona version; `store: false`.
Interfaces: `AnswerModel` (stream/complete JSON, complete text), `Embedder`, and the voice
functions in `openai/voice.ts`. SDK v6 rather than v7: the plan and its research targeted v6,
which has every API used here; upgrading is a one-file change.

## Consequences

- The model never writes citation markup; the validator is independent of model obedience.
- Tests script the model through `AnswerModel`; no network in CI.
- Option 3 rejected: trusting free-text markup is exactly what the product must not do.

## Revisit when

Model ids are retired (TTS: Jan 2027), or a cheaper model passes `pnpm eval --answers`.
