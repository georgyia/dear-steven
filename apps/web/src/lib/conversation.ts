import { LIMITS } from '@dear-steven/core/limits';
import type {
  AskErrorCode,
  AskEvent,
  AskStep,
  Citation,
  FinalAnswer,
  HistoryTurn,
  ResolvedBlock,
} from '@dear-steven/core/schema';

export type TurnStatus = 'streaming' | 'done' | 'stopped' | 'error';

export interface Turn {
  id: string;
  question: string;
  status: TurnStatus;
  steps: { step: AskStep; message: string }[];
  sources: { passages: number; episodes: number } | null;
  /** Index of the block being written right now, for the placeholder shimmer. */
  writingIndex: number | null;
  blocks: ResolvedBlock[];
  citations: Record<string, Citation>;
  final: FinalAnswer | null;
  error: { code: AskErrorCode | 'network'; message: string } | null;
  startedAt: number;
  elapsedMs: number | null;
  /** Opened from a share link (P6-17) rather than asked here. */
  shared?: true;
}

export interface ConversationState {
  turns: Turn[];
}

export type ConversationAction =
  | { type: 'turn.start'; id: string; question: string; at: number }
  | { type: 'turn.event'; id: string; event: AskEvent; at: number }
  | { type: 'turn.stopped'; id: string; at: number }
  | { type: 'turn.failed'; id: string; code: AskErrorCode | 'network'; message: string; at: number }
  | { type: 'reset' }
  /** A remembered conversation (P5-11). Ignored once the user has started a new one. */
  | { type: 'restore'; turns: Turn[] }
  /** A finished turn from outside the conversation: a share link (P6-17). */
  | { type: 'append'; turn: Turn };

export const initialConversation: ConversationState = { turns: [] };

const update = (
  state: ConversationState,
  id: string,
  fn: (t: Turn) => Turn,
): ConversationState => ({
  turns: state.turns.map((t) => (t.id === id ? fn(t) : t)),
});

function applyEvent(turn: Turn, event: AskEvent, at: number): Turn {
  if (turn.status !== 'streaming') return turn;
  switch (event.type) {
    case 'status': {
      const last = turn.steps[turn.steps.length - 1];
      const steps =
        last?.step === event.step
          ? [...turn.steps.slice(0, -1), { step: event.step, message: event.message }]
          : [...turn.steps, { step: event.step, message: event.message }];
      return { ...turn, steps };
    }
    case 'sources':
      return { ...turn, sources: { passages: event.passages, episodes: event.episodes } };
    case 'block.start':
      return { ...turn, writingIndex: event.index };
    case 'block.done': {
      const blocks = [...turn.blocks];
      blocks[event.index] = event.block;
      const citations = { ...turn.citations };
      for (const c of event.citations) citations[c.id] = c;
      return { ...turn, blocks, citations, writingIndex: null };
    }
    case 'final': {
      const citations: Record<string, Citation> = {};
      for (const c of event.answer.citations) citations[c.id] = c;
      return {
        ...turn,
        status: 'done',
        blocks: event.answer.blocks,
        citations,
        final: event.answer,
        writingIndex: null,
        elapsedMs: event.answer.elapsedMs || Math.round(at - turn.startedAt),
      };
    }
    case 'error':
      return {
        ...turn,
        status: 'error',
        error: { code: event.code, message: event.message },
        writingIndex: null,
        elapsedMs: Math.round(at - turn.startedAt),
      };
  }
}

export function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  switch (action.type) {
    case 'reset':
      return initialConversation;
    case 'restore':
      return state.turns.length === 0 ? { turns: action.turns } : state;
    case 'append':
      return { turns: [...state.turns, action.turn] };
    case 'turn.start':
      return {
        turns: [
          ...state.turns,
          {
            id: action.id,
            question: action.question,
            status: 'streaming',
            steps: [],
            sources: null,
            writingIndex: null,
            blocks: [],
            citations: {},
            final: null,
            error: null,
            startedAt: action.at,
            elapsedMs: null,
          },
        ],
      };
    case 'turn.event':
      return update(state, action.id, (t) => applyEvent(t, action.event, action.at));
    case 'turn.stopped':
      return update(state, action.id, (t) =>
        t.status === 'streaming'
          ? {
              ...t,
              status: 'stopped',
              writingIndex: null,
              elapsedMs: Math.round(action.at - t.startedAt),
            }
          : t,
      );
    case 'turn.failed':
      return update(state, action.id, (t) =>
        t.status === 'streaming'
          ? {
              ...t,
              status: 'error',
              writingIndex: null,
              error: { code: action.code, message: action.message },
              elapsedMs: Math.round(action.at - t.startedAt),
            }
          : t,
      );
  }
}

/** Citation ids in reading order (first appearance in the blocks). */
export function citationOrder(turn: Pick<Turn, 'blocks' | 'citations'>): string[] {
  const seen = new Set<string>();
  const add = (id: string) => {
    if (turn.citations[id] && !seen.has(id)) seen.add(id);
  };
  for (const block of turn.blocks) {
    if (!block) continue;
    if (block.kind === 'quote') add(block.citationId);
    else for (const s of block.segments) for (const id of s.citationIds) add(id);
  }
  return [...seen];
}

/** Plain text of an answer, for follow-up context. */
export function answerText(blocks: ResolvedBlock[]): string {
  return blocks
    .filter(Boolean)
    .map((b) => (b.kind === 'quote' ? `“${b.text}”` : b.segments.map((s) => s.text).join(' ')))
    .join('\n\n');
}

/** The history the server needs for a follow-up: finished turns only, newest last, bounded. */
export function historyFor(turns: Turn[]): HistoryTurn[] {
  return turns
    .filter((t) => t.status === 'done' || t.status === 'stopped')
    .slice(-LIMITS.historyTurns)
    .map((t) => ({
      question: t.question.slice(0, LIMITS.questionChars),
      answer: answerText(t.blocks).slice(0, LIMITS.answerContextChars),
    }));
}
