import { detectLanguage } from '../language/detect.ts';
import type { Embedder } from '../openai/embedder.ts';
import {
  DEFAULT_UI_LOCALE,
  EMPTY_KNOWLEDGE_REPLY,
  MALFORMED_ANSWER,
  MODERATION_UNAVAILABLE,
  RESTING_REPLY,
  THINKING_COPY,
  type UiLocale,
} from '../persona/copy.ts';
import { hybridSearch } from '../retrieval/index.ts';
import {
  KeyRefused,
  type Moderator,
  moderationVerdict,
  routeQuestion,
  type SafetyRoute,
  safetyReply,
  sensitivePreface,
  stakesGuidance,
  UNAVAILABLE,
} from '../safety/index.ts';
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
import { searchQuery } from './condense.ts';
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
  /** How the safety rails routed the question (P6-11). */
  safety: SafetyRoute;
}

export interface ComposeDeps {
  store: KnowledgeStore;
  model: AnswerModel;
  embedder: Embedder | null;
  now?: () => number;
  /** Called once with everything that happened, for the eval harness and optional logging. */
  onComplete?: (record: AnswerRecord) => void;
  /**
   * Moderation of the question (P6-11). Without it (demo mode), the phrase rules decide alone; with
   * it, a question it gives no verdict on is not answered (P10-06).
   */
  moderate?: Moderator;
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
    yield* emptyKnowledgeAnswer(request.uiLocale, started, now);
    return;
  }

  // Safety rails (P6-11): the phrase rules decide at once; moderation runs alongside retrieval,
  // and its verdict is in before the model is asked to write. No verdict, no answer (P10-06).
  const early = routeQuestion(request.question, null);
  if (early.kind !== 'answer') {
    yield* safetyAnswer(deps, request, early, started, now);
    return;
  }
  const moderation = moderationVerdict(deps.moderate, request.question, signal);

  const thinking = THINKING_COPY[request.uiLocale ?? DEFAULT_UI_LOCALE];
  yield { type: 'status', step: 'searching', message: thinking.searching(stats.episodes) };
  // The transcripts are English: search in English, and by meaning in the question's own language
  // too (P6-01). The answer comes back in the question's language.
  const language = detectLanguage(request.question);
  const query = await searchQuery(deps.model, request.question, request.history, language, signal);
  const retrieval = await hybridSearch(
    deps.store,
    query,
    deps.embedder,
    language === 'en' ? {} : { alsoSemantic: [request.question] },
    signal,
  );
  const verdict = await moderation;
  // A refused or held-back key fails as the answer call would, worded for its owner (P10-13).
  if (verdict instanceof KeyRefused) throw verdict.error;
  if (verdict === UNAVAILABLE) {
    yield {
      type: 'error',
      code: 'upstream',
      message: MODERATION_UNAVAILABLE[request.uiLocale ?? DEFAULT_UI_LOCALE],
    };
    return;
  }
  const route = routeQuestion(request.question, verdict);
  if (route.kind !== 'answer') {
    yield* safetyAnswer(deps, request, route, started, now);
    return;
  }
  const ctx = buildContext(deps.store, retrieval.passages);
  const episodeCount = new Set(retrieval.passages.map((p) => p.episodeId)).size;
  yield { type: 'sources', passages: retrieval.passages.length, episodes: episodeCount };
  yield {
    type: 'status',
    step: 'found',
    message: thinking.found(retrieval.passages.length, episodeCount),
  };
  yield { type: 'status', step: 'writing', message: thinking.writing };

  const registry = new CitationRegistry(ctx);
  const stream = new BlockStream();
  const checks = new Map<number, { block: ModelBlock | null; violations: Violation[] }>();
  const emittedModelIdx = new Set<number>();
  const emitted: ResolvedBlock[] = [];
  let holding = false;
  if (route.sensitive) {
    const preface = sensitivePreface(request.locale);
    yield { type: 'block.done', index: 0, block: preface, citations: [] };
    emitted.push(preface);
  }

  const emit = function* (modelIndex: number, block: ModelBlock): Generator<AskEvent> {
    const r = resolveBlock(block, registry);
    emittedModelIdx.add(modelIndex);
    if (!r) return;
    yield { type: 'block.done', index: emitted.length, block: r.block, citations: r.citations };
    emitted.push(r.block);
  };

  for await (const delta of deps.model.streamJson({
    instructions: PERSONA_INSTRUCTIONS,
    input: answerInput(
      request.question,
      request.history,
      ctx,
      stakesGuidance(route.stakes, route.sensitive),
      request.mode,
      request.about,
    ),
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
      message: MALFORMED_ANSWER[request.uiLocale ?? DEFAULT_UI_LOCALE],
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
    yield { type: 'status', step: 'checking', message: thinking.checking };
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
    language: /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(answer.language) ? answer.language : language,
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
    safety: route,
  });
}

/** A fixed safety reply in place of an answer: no sources, and no model writes it. */
function* safetyAnswer(
  deps: ComposeDeps,
  request: AskRequest,
  route: Exclude<SafetyRoute, { kind: 'answer' }>,
  started: number,
  now: () => number,
): Generator<AskEvent> {
  for (const event of safetyReply(route, request.locale, started, now) ?? []) {
    yield event;
    if (event.type === 'final') {
      deps.onComplete?.({
        question: request.question,
        query: '',
        retrieved: [],
        modes: [],
        violations: [],
        repaired: false,
        final: event.answer,
        safety: route,
      });
    }
  }
}

/** The reply once the daily spend cap is reached (P6-08). No model call, no sources. */
export function* restingAnswer(
  locale: UiLocale = DEFAULT_UI_LOCALE,
  started: number = Date.now(),
  now: () => number = Date.now,
): Generator<AskEvent> {
  const block: ResolvedBlock = {
    kind: 'paragraph',
    segments: [{ text: RESTING_REPLY[locale].text, attribution: 'synthesis', citationIds: [] }],
  };
  yield { type: 'block.done', index: 0, block, citations: [] };
  yield {
    type: 'final',
    answer: {
      language: locale,
      mode: 'conversational',
      blocks: [block],
      citations: [],
      episodes: [],
      spoken: RESTING_REPLY[locale].spoken,
      caveats: [],
      demo: false,
      elapsedMs: Math.max(0, Math.round(now() - started)),
    },
  };
}

/** The honest reply when nothing has been ingested yet. No model call. */
export function* emptyKnowledgeAnswer(
  locale: UiLocale = DEFAULT_UI_LOCALE,
  started: number = Date.now(),
  now: () => number = Date.now,
): Generator<AskEvent> {
  const thinking = THINKING_COPY[locale];
  const reply = EMPTY_KNOWLEDGE_REPLY[locale];
  yield { type: 'status', step: 'searching', message: thinking.searching(0) };
  yield { type: 'status', step: 'found', message: thinking.found(0, 0) };
  const block: ResolvedBlock = {
    kind: 'paragraph',
    segments: [
      { text: reply.text, attribution: 'synthesis', citationIds: [] },
      { text: reply.hint, attribution: 'synthesis', citationIds: [] },
    ],
  };
  yield { type: 'block.done', index: 0, block, citations: [] };
  yield {
    type: 'final',
    answer: {
      language: locale,
      mode: 'insufficient',
      blocks: [block],
      citations: [],
      episodes: [],
      spoken: reply.spoken,
      caveats: [],
      demo: false,
      elapsedMs: Math.max(0, Math.round(now() - started)),
    },
  };
}
