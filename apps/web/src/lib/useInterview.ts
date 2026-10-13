'use client';

import type { InterviewRequest } from '@dear-steven/core/schema';
import { useEffect, useMemo, useReducer } from 'react';
import { interviewStep } from './api';
import { initialInterview, interviewReducer, interviewRequest } from './interview';

/**
 * The interview's state, and its steps run against `/api/interview` (P7-06): whenever the state is
 * waiting, the step it describes is sent; leaving the interview, or resetting it, cancels it.
 */
export function useInterview(uiLocale: InterviewRequest['uiLocale']) {
  const [state, dispatch] = useReducer(interviewReducer, initialInterview);
  const pending = useMemo(
    () => (state.phase === 'waiting' ? interviewRequest(state, uiLocale) : null),
    [state, uiLocale],
  );
  useEffect(() => {
    if (!pending) return;
    const ctrl = new AbortController();
    interviewStep(pending, ctrl.signal)
      .then((reply) => dispatch({ type: 'reply', reply }))
      .catch((error: unknown) => {
        if (!ctrl.signal.aborted) {
          dispatch({
            type: 'failed',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => ctrl.abort();
  }, [pending]);
  return { state, dispatch };
}
