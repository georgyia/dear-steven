'use client';

import type { InterviewRequest } from '@dear-steven/core/schema';
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { AskError, interviewStep } from './api';
import { initialInterview, interviewReducer, interviewRequest } from './interview';

/**
 * The interview's state, and its steps run against `/api/interview` (P7-06): whenever the state is
 * waiting, the step it describes is sent; leaving the interview, or resetting it, cancels it.
 */
export function useInterview(uiLocale: InterviewRequest['uiLocale']) {
  const [state, dispatch] = useReducer(interviewReducer, initialInterview);
  /** A free interview's ticket (P8-02): one interview, one free question. */
  const ticket = useRef<string | null>(null);
  const pending = useMemo(
    () => (state.phase === 'waiting' ? interviewRequest(state, uiLocale) : null),
    [state, uiLocale],
  );
  useEffect(() => {
    if (!pending) return;
    const ctrl = new AbortController();
    if (pending.turns.length === 0) ticket.current = null;
    interviewStep(pending, ctrl.signal, ticket.current)
      .then((step) => {
        ticket.current = step.ticket;
        dispatch({ type: 'reply', reply: step.reply });
      })
      .catch((error: unknown) => {
        if (!ctrl.signal.aborted) {
          dispatch({
            type: 'failed',
            message: error instanceof Error ? error.message : String(error),
            ...(error instanceof AskError ? { code: error.code } : {}),
          });
        }
      });
    return () => ctrl.abort();
  }, [pending]);
  return { state, dispatch };
}
