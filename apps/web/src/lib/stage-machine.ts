/**
 * The stage's interaction state machine (docs/DESIGN.md §5). Pure: (state, event) → state.
 * Every state has a visual — ambient brightness, thought-line steps, the composer's send/stop
 * morph, the microphone pill — and components read it rather than inventing their own flags.
 *
 *   idle ─▶ requestingMic ─▶ listening ─▶ transcribing ─┐
 *     │                                                  ▼
 *     └──────────── ASK ──────────────▶ composing(searching ▶ found ▶ writing)
 *                                              │
 *                          answered | insufficient | error ◀┘   (any of these ─ASK▶ composing)
 *   answered ─SPEAK_STARTED▶ speaking ─SPEAK_ENDED▶ answered       (asking or the mic interrupts it)
 *
 * Events that make no sense in the current state are ignored (the state is returned unchanged).
 */

export type ComposeStep = 'searching' | 'found' | 'writing';

export type StageErrorKind =
  | 'network'
  | 'rateLimited'
  | 'upstream'
  | 'generic'
  | 'micDenied'
  | 'micUnsupported';

export type StageState =
  | { kind: 'idle' }
  | { kind: 'requestingMic' }
  | { kind: 'listening' }
  | { kind: 'transcribing' }
  | { kind: 'composing'; step: ComposeStep }
  | { kind: 'answered' }
  | { kind: 'insufficient' }
  | { kind: 'speaking' }
  | { kind: 'error'; error: StageErrorKind };

export type StageEvent =
  | { type: 'MIC_REQUESTED' }
  | { type: 'MIC_GRANTED' }
  | { type: 'MIC_FAILED'; error: 'micDenied' | 'micUnsupported' }
  | { type: 'LISTEN_STOPPED' }
  | { type: 'LISTEN_CANCELLED' }
  | { type: 'TRANSCRIBED' }
  | { type: 'TRANSCRIBE_FAILED' }
  | { type: 'ASK' }
  | { type: 'FOUND' }
  | { type: 'WRITING' }
  | { type: 'ANSWERED'; insufficient: boolean }
  | { type: 'FAILED'; error: StageErrorKind }
  | { type: 'STOPPED' }
  | { type: 'SPEAK_STARTED' }
  | { type: 'SPEAK_ENDED' }
  | { type: 'RESET' };

export const initialStage: StageState = { kind: 'idle' };

const settled = (s: StageState) =>
  s.kind === 'idle' ||
  s.kind === 'answered' ||
  s.kind === 'insufficient' ||
  s.kind === 'speaking' ||
  s.kind === 'error';

export function transition(state: StageState, event: StageEvent): StageState {
  switch (event.type) {
    case 'RESET':
      return initialStage;

    case 'MIC_REQUESTED':
      return settled(state) ? { kind: 'requestingMic' } : state;
    case 'MIC_GRANTED':
      return state.kind === 'requestingMic' ? { kind: 'listening' } : state;
    case 'MIC_FAILED':
      return state.kind === 'requestingMic' || state.kind === 'listening'
        ? { kind: 'error', error: event.error }
        : state;
    case 'LISTEN_STOPPED':
      return state.kind === 'listening' ? { kind: 'transcribing' } : state;
    case 'LISTEN_CANCELLED':
      return state.kind === 'listening' || state.kind === 'requestingMic' ? initialStage : state;
    case 'TRANSCRIBED':
      // An empty or kept-for-editing transcript returns to idle; ASK follows when it is sent.
      return state.kind === 'transcribing' || state.kind === 'listening' ? initialStage : state;
    case 'TRANSCRIBE_FAILED':
      return state.kind === 'transcribing' || state.kind === 'listening'
        ? { kind: 'error', error: 'generic' }
        : state;

    case 'ASK':
      return settled(state) ? { kind: 'composing', step: 'searching' } : state;
    case 'FOUND':
      return state.kind === 'composing' && state.step === 'searching'
        ? { kind: 'composing', step: 'found' }
        : state;
    case 'WRITING':
      return state.kind === 'composing' && state.step !== 'writing'
        ? { kind: 'composing', step: 'writing' }
        : state;
    case 'ANSWERED':
      return state.kind === 'composing'
        ? { kind: event.insufficient ? 'insufficient' : 'answered' }
        : state;
    case 'FAILED':
      return state.kind === 'composing' || state.kind === 'transcribing'
        ? { kind: 'error', error: event.error }
        : state;
    case 'STOPPED':
      return state.kind === 'composing' ? { kind: 'answered' } : state;
    case 'SPEAK_STARTED':
      return state.kind === 'answered' || state.kind === 'insufficient' || state.kind === 'idle'
        ? { kind: 'speaking' }
        : state;
    case 'SPEAK_ENDED':
      return state.kind === 'speaking' ? { kind: 'answered' } : state;
  }
}

/** True while the composer should show the stop glyph. */
export const isBusy = (s: StageState) => s.kind === 'composing' || s.kind === 'transcribing';

/** True while the microphone owns the interaction. */
export const isVoiceActive = (s: StageState) =>
  s.kind === 'requestingMic' || s.kind === 'listening' || s.kind === 'transcribing';

/** Ambient intensity per state, 0–1; the background breathes with the conversation. */
export function ambientLevel(s: StageState, inConversation: boolean): number {
  const base = inConversation ? 0.24 : 0.62;
  switch (s.kind) {
    case 'listening':
      return Math.min(1, base + 0.3);
    case 'speaking':
      return Math.min(1, base + 0.18);
    case 'composing':
      return Math.min(1, base + (s.step === 'writing' ? 0.12 : 0.2));
    case 'error':
      return base * 0.6;
    default:
      return base;
  }
}
