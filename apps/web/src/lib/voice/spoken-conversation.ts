/**
 * A spoken conversation's state (P9-02). Pure: (state, event) → state, and an event that makes no
 * sense in the current state is ignored, as in the stage machine.
 *
 *   off ─start▶ yours ─sent▶ his ─replied▶ yours …            (the interview starts with his)
 *   yours | his ─pause▶ paused ─resume▶ yours (or his)           any ─end▶ off
 *
 * `yours`: the mic is open and listening. `his`: Dear Steven is thinking or speaking; the mic is
 * closed. `paused`: the mic is closed until you carry on.
 */

export type PauseReason = 'idle' | 'hidden' | 'failed';

export type ConversationState =
  | { phase: 'off' }
  | { phase: 'yours'; words: string }
  | { phase: 'his' }
  | { phase: 'paused'; reason: PauseReason };

export type ConversationEvent =
  | { type: 'start'; first: 'yours' | 'his' }
  | { type: 'words'; text: string }
  | { type: 'sent' }
  | { type: 'replied' }
  | { type: 'pause'; reason: PauseReason }
  | { type: 'resume'; first?: 'yours' | 'his' }
  | { type: 'end' };

export const conversationOff: ConversationState = { phase: 'off' };

export function conversationReducer(
  state: ConversationState,
  event: ConversationEvent,
): ConversationState {
  switch (event.type) {
    case 'start':
      if (state.phase !== 'off') return state;
      return event.first === 'his' ? { phase: 'his' } : { phase: 'yours', words: '' };
    case 'words':
      return state.phase === 'yours' ? { phase: 'yours', words: event.text } : state;
    case 'sent':
      return state.phase === 'yours' ? { phase: 'his' } : state;
    case 'replied':
      return state.phase === 'his' ? { phase: 'yours', words: '' } : state;
    case 'pause':
      return state.phase === 'yours' || state.phase === 'his'
        ? { phase: 'paused', reason: event.reason }
        : state;
    case 'resume':
      if (state.phase !== 'paused') return state;
      return event.first === 'his' ? { phase: 'his' } : { phase: 'yours', words: '' };
    case 'end':
      return conversationOff;
  }
}

/** The mic may be open only on your turn: everywhere else it is closed. */
export const micMayBeOpen = (state: ConversationState) => state.phase === 'yours';
