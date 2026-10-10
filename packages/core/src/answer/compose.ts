import type { Embedder } from '../openai/embedder.ts';
import { EMPTY_KNOWLEDGE_REPLY, RESTING_REPLY, THINKING_COPY } from '../persona/copy.ts';
import { hybridSearch } from '../retrieval/index.ts';
import type {
  AskEvent,
  AskRequest,
  Citation,
  FinalAnswer,
  ModelAnswer,
  ModelBlock,
  ResolvedBlock,
} from '../schema/index.ts';
import type { KnowledgeStore } from '../store/index.ts';
import { condenseQuery } from './condense.ts';
import { buildContext } from './context.ts';
import type { AnswerModel } from './model.ts';
import {
  ANSWER_CACHE_KEY,
  ANSWER_FORMAT,
  answerInput,
  PERSONA_INSTRUCTIONS,
  REPAIR_FORMAT,
  RepairSchema,
  repairInput,
} from './prompt.ts';
import { CitationRegistry, episodesOf, finalMode, resolveBlock } from './resolve.ts';
import { BlockStream } from './stream.ts';
import { DOWNGRADE_CAVEATS, downgradeBlock, type Violation, validateBlock } from './validate.ts';

export interface AnswerRecord {
  question: string;
  query: string;
  retrieved: string[];
  modes: string[];
  violations: Violation[];
  repaired: boolean;
  final: FinalAnswer;
}

export interface ComposeDeps {
  store: KnowledgeStore;
  model: AnswerModel;
  embedder: Embedder | null;
  now?: () => number;
  /** Called once with everything that happened, for the eval harness and optional logging. */
  onComplete?: (record: AnswerRecord) => void;
}

const MALFORMED: Omit<Violation, 'blockIndex'> = {
  segmentIndex: null,
  kind: 'quote_not_found',
  message: 'This block did not match the answer schema. Rewrite it as a valid block.',
};

/**
 * The defining pipeline (plan §E): retrieve → compose in persona → validate every block → repair
 * once → downgrade what's still wrong → stream. A block is sent to the browser only after it has
 * passed validation; once one block needs repair, later blocks wait so the order never changes.
 */
export async function* composeAnswer(
  deps: ComposeDeps,
  request: AskRequest,
  signal: AbortSignal,
): AsyncGenerator<AskEvent> {
  const now = deps.now ?? Date.now;
  const started = now();
  const stats = deps.store.stats();

  if (stats.passages === 0) {
    yield* emptyKnowledgeAnswer(started, now);
    return;
  }

  yield { type: 'status', step: 'searching', message: THINKING_COPY.searching(stats.episodes) };
  const query = await condenseQuery(deps.model, request.question, request.history, signal);
  const retrieval = await hybridSearch(deps.store, query, deps.embedder, {}, signal);
  const ctx = buildContext(deps.store, retrieval.passages);
  const episodeCount = new Set(retrieval.passages.map((p) => p.episodeId)).size;
  yield { type: 'sources', passages: retrieval.passages.length, episodes: episodeCount };
  yield {
    type: 'status',
    step: 'found',
    message: THINKING_COPY.found(retrieval.passages.length, episodeCount),
  };
  yield { type: 'status', step: 'writing', message: THINKING_COPY.writing };

  const registry = new CitationRegistry(ctx);
  const stream = new BlockStream();
  const checks = new Map<number, { block: ModelBlock | null; violations: Violation[] }>();
  const emittedModelIdx = new Set<number>();
  const emitted: ResolvedBlock[] = [];
  let holding = false;

  const emit = function* (modelIndex: number, block: ModelBlock): Generator<AskEvent> {
    const r = resolveBlock(block, registry);
    emittedModelIdx.add(modelIndex);
    if (!r) return;
    yield { type: 'block.done', index: emitted.length, block: r.block, citations: r.citations };
    emitted.push(r.block);
  };

  for await (const delta of deps.model.streamJson({
    instructions: PERSONA_INSTRUCTIONS,
    input: answerInput(request.question, request.history, ctx),
    format: ANSWER_FORMAT,
    cacheKey: ANSWER_CACHE_KEY,
    signal,
  })) {
    const { started: begun, completed } = stream.push(delta);
    // Release finished blocks first, so "block.start" always names the next display slot.
    for (const { index, block } of completed) {
      const check = block
        ? validateBlock(block, index, ctx)
        : { block: null, violations: [{ ...MALFORMED, blockIndex: index }] };
      checks.set(index, check);
      if (!holding && check.block && check.violations.length === 0) yield* emit(index, check.block);
      else holding = true;
    }
    if (!holding && begun.length && begun.some((i) => !emittedModelIdx.has(i))) {
      yield { type: 'block.start', index: emitted.length };
    }
  }

  let answer: ModelAnswer;
  try {
    answer = stream.finish();
  } catch {
    yield {
      type: 'error',
      code: 'upstream',
      message: 'The answer came back malformed. Nothing was shown that wasn’t checked.',
    };
    return;
  }

  // Everything not yet emitted, in order; validate any block the stream never reported.
  const pending = answer.blocks.map((_, i) => i).filter((i) => !emittedModelIdx.has(i));
  for (const i of pending) {
    if (!checks.has(i)) checks.set(i, validateBlock(answer.blocks[i] as ModelBlock, i, ctx));
  }
  const failing = pending.filter((i) => (checks.get(i)?.violations.length ?? 0) > 0);
  const allViolations = failing.flatMap((i) => checks.get(i)?.violations ?? []);
  let repaired = false;

  if (failing.length > 0) {
    yield { type: 'status', step: 'checking', message: THINKING_COPY.checking };
    try {
      const raw = await deps.model.completeJson({
        instructions: PERSONA_INSTRUCTIONS,
        input: repairInput(
          request.question,
          ctx,
          failing.map((i) => ({
            index: i,
            block: answer.blocks[i],
            violations: checks.get(i)?.violations ?? [],
          })),
        ),
        format: REPAIR_FORMAT,
        cacheKey: ANSWER_CACHE_KEY,
        signal,
      });
      for (const { index, block } of RepairSchema.parse(JSON.parse(raw)).blocks) {
        if (!failing.includes(index)) continue;
        const recheck = validateBlock(block, index, ctx);
        if (recheck.violations.length === 0) {
          checks.set(index, recheck);
          repaired = true;
        }
      }
    } catch (error) {
      if (signal.aborted) throw error;
      // The repair pass is best-effort; the deterministic downgrade below still applies.
    }
  }

  const notes = new Set<keyof typeof DOWNGRADE_CAVEATS>();
  for (const i of pending) {
    const check = checks.get(i);
    const original = check?.block ?? null;
    if (!original) {
      notes.add('removed');
      emittedModelIdx.add(i);
      continue;
    }
    const { block, notes: n } = downgradeBlock(original, check?.violations ?? []);
    for (const note of n) notes.add(note);
    if (block) yield* emit(i, block);
    else emittedModelIdx.add(i);
  }

  const citations: Citation[] = registry.all(answer.evidence);
  const final: FinalAnswer = {
    mode: finalMode(answer.mode, emitted, notes.size > 0),
    blocks: emitted,
    citations,
    episodes: episodesOf(citations),
    spoken: answer.spoken.trim().split(/\s+/).slice(0, 120).join(' '),
    caveats: [
      ...answer.caveats.map((c) => c.trim()).filter(Boolean),
      ...[...notes].map((n) => DOWNGRADE_CAVEATS[n]),
    ],
    demo: false,
    elapsedMs: Math.max(0, Math.round(now() - started)),
  };
  yield { type: 'final', answer: final };

  deps.onComplete?.({
    question: request.question,
    query,
    retrieved: retrieval.passages.map((p) => p.id),
    modes: retrieval.modes,
    violations: allViolations,
    repaired,
    final,
  });
}

/** The reply once the daily spend cap is reached (P6-08). No model call, no sources. */
export function* restingAnswer(
  started: number = Date.now(),
  now: () => number = Date.now,
): Generator<AskEvent> {
  const block: ResolvedBlock = {
    kind: 'paragraph',
    segments: [{ text: RESTING_REPLY.text, attribution: 'synthesis', citationIds: [] }],
  };
  yield { type: 'block.done', index: 0, block, citations: [] };
  yield {
    type: 'final',
    answer: {
      mode: 'conversational',
      blocks: [block],
      citations: [],
      episodes: [],
      spoken: RESTING_REPLY.spoken,
      caveats: [],
      demo: false,
      elapsedMs: Math.max(0, Math.round(now() - started)),
    },
  };
}

/** The honest reply when nothing has been ingested yet. No model call. */
export function* emptyKnowledgeAnswer(
  started: number = Date.now(),
  now: () => number = Date.now,
): Generator<AskEvent> {
  yield { type: 'status', step: 'searching', message: THINKING_COPY.searching(0) };
  yield { type: 'status', step: 'found', message: THINKING_COPY.found(0, 0) };
  const block: ResolvedBlock = {
    kind: 'paragraph',
    segments: [
      { text: EMPTY_KNOWLEDGE_REPLY.text, attribution: 'synthesis', citationIds: [] },
      { text: EMPTY_KNOWLEDGE_REPLY.hint, attribution: 'synthesis', citationIds: [] },
    ],
  };
  yield { type: 'block.done', index: 0, block, citations: [] };
  yield {
    type: 'final',
    answer: {
      mode: 'insufficient',
      blocks: [block],
      citations: [],
      episodes: [],
      spoken: EMPTY_KNOWLEDGE_REPLY.spoken,
      caveats: [],
      demo: false,
      elapsedMs: Math.max(0, Math.round(now() - started)),
    },
  };
}
