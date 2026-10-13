import {
  INTERVIEW_LIMITS,
  type InterviewReply,
  type InterviewRequest,
  type InterviewSetup,
  type InterviewTurn,
  type LearnedLine,
  type ResolvedBlock,
} from '@dear-steven/core/schema';

/**
 * Interview mode on the page (P7-06). The interview lives here and only here: every step sends it
 * to the server, which keeps nothing.
 */

export type InterviewQuestion = Extract<InterviewReply, { type: 'question' }>;

export type InterviewPhase = 'setup' | 'waiting' | 'asking' | 'learned' | 'ended' | 'error';

export interface InterviewState {
  phase: InterviewPhase;
  setup: InterviewSetup;
  turns: InterviewTurn[];
  /** The question on screen, or the one being answered while the next is fetched. */
  current: InterviewQuestion | null;
  learned: { lines: LearnedLine[]; language: string; demo: boolean } | null;
  ended: { reason: 'crisis' | 'refuse' | 'resting'; blocks: ResolvedBlock[] } | null;
  error: string | null;
  /** What the step in flight (or the failed one, for a retry) asks for. */
  action: InterviewRequest['action'];
}

export type InterviewAction =
  | { type: 'start'; setup: InterviewSetup }
  | { type: 'answer'; text: string }
  | { type: 'skip' }
  | { type: 'finish' }
  | { type: 'reply'; reply: InterviewReply }
  | { type: 'failed'; message: string }
  | { type: 'retry' }
  | { type: 'reset' };

export const initialInterview: InterviewState = {
  phase: 'setup',
  setup: {},
  turns: [],
  current: null,
  learned: null,
  ended: null,
  error: null,
  action: 'next',
};

const clean = (text: string, max: number) => text.trim().slice(0, max);

export function interviewReducer(state: InterviewState, action: InterviewAction): InterviewState {
  switch (action.type) {
    case 'reset':
      return initialInterview;
    case 'start': {
      if (state.phase !== 'setup') return state;
      const name = clean(action.setup.name ?? '', INTERVIEW_LIMITS.nameChars);
      const about = clean(action.setup.about ?? '', INTERVIEW_LIMITS.aboutChars);
      return {
        ...initialInterview,
        phase: 'waiting',
        setup: { ...(name ? { name } : {}), ...(about ? { about } : {}) },
      };
    }
    case 'answer':
    case 'skip': {
      if (state.phase !== 'asking' || !state.current) return state;
      const answer =
        action.type === 'answer' ? clean(action.text, INTERVIEW_LIMITS.answerChars) : '';
      if (action.type === 'answer' && !answer) return state;
      const turn = { question: state.current.question, stage: state.current.stage, answer };
      return { ...state, phase: 'waiting', turns: [...state.turns, turn], action: 'next' };
    }
    case 'finish':
      if (state.phase !== 'asking') return state;
      return { ...state, phase: 'waiting', action: 'finish' };
    case 'reply': {
      if (state.phase !== 'waiting') return state;
      const { reply } = action;
      if (reply.type === 'question')
        return { ...state, phase: 'asking', current: reply, error: null };
      if (reply.type === 'learned') {
        const { lines, language, demo } = reply;
        return { ...state, phase: 'learned', learned: { lines, language, demo }, error: null };
      }
      return { ...state, phase: 'ended', ended: { reason: reply.reason, blocks: reply.blocks } };
    }
    case 'failed':
      if (state.phase !== 'waiting') return state;
      return { ...state, phase: 'error', error: action.message };
    case 'retry':
      if (state.phase !== 'error') return state;
      return { ...state, phase: 'waiting', error: null };
  }
}

/** The request for the step the state is waiting on. */
export function interviewRequest(
  state: InterviewState,
  uiLocale: InterviewRequest['uiLocale'],
): InterviewRequest {
  return {
    setup: state.setup,
    turns: state.turns.slice(-INTERVIEW_LIMITS.maxQuestions),
    action: state.action,
    ...(uiLocale ? { uiLocale } : {}),
  };
}
