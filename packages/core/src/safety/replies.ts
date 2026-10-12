import type { AnswerMode, AskEvent, ResolvedBlock } from '../schema/index.ts';
import { crisisResources } from './resources.ts';
import type { SafetyRoute } from './route.ts';

/**
 * Fixed replies for the safety rails (P6-11). Written by people, never by the model, and reviewed
 * by a human before release (plan/human/safety-review.md). Plain and warm, without persona
 * flourishes: someone in crisis needs a phone number, not a podcast voice.
 */

const paragraph = (...texts: string[]): ResolvedBlock => ({
  kind: 'paragraph',
  segments: texts.map((text) => ({ text, attribution: 'synthesis', citationIds: [] })),
});

function* fixedAnswer(
  blocks: ResolvedBlock[],
  spoken: string,
  mode: AnswerMode,
  started: number,
  now: () => number,
): Generator<AskEvent> {
  for (const [index, block] of blocks.entries()) {
    yield { type: 'block.done', index, block, citations: [] };
  }
  yield {
    type: 'final',
    answer: {
      language: 'en',
      mode,
      blocks,
      citations: [],
      episodes: [],
      spoken,
      caveats: [],
      demo: false,
      elapsedMs: Math.max(0, Math.round(now() - started)),
    },
  };
}

/** Real help first and only: no sources, no model, no persona. */
export function crisisAnswer(
  locale: string | null | undefined,
  started: number = Date.now(),
  now: () => number = Date.now,
): Generator<AskEvent> {
  const r = crisisResources(locale);
  return fixedAnswer(
    [
      paragraph(
        'I’m really glad you said something. Please talk to someone who can help right now.',
        `${r.helpline} If you are in danger right now, call ${r.emergencyNumber}.`,
      ),
      paragraph(
        'You deserve a real person for this, not an AI. If calling feels like too much, telling one person you trust how you’re feeling is a good first step.',
      ),
    ],
    `I’m really glad you said something. Please talk to someone who can help right now. ${r.helpline} If you are in danger, call ${r.emergencyNumber}.`,
    'conversational',
    started,
    now,
  );
}

/** Before an answer on suicide or self-harm as a topic: where to get help, then the answer. */
export function sensitivePreface(locale: string | null | undefined): ResolvedBlock {
  const r = crisisResources(locale);
  return paragraph(
    `If this is close to home, please talk to someone now. ${r.helpline} If anyone is in danger right now, call ${r.emergencyNumber}.`,
  );
}

export function refusalAnswer(
  started: number = Date.now(),
  now: () => number = Date.now,
): Generator<AskEvent> {
  return fixedAnswer(
    [
      paragraph(
        'That’s not something I’ll help with.',
        'If there’s something underneath the question — something that’s worrying you — I’m happy to talk about that instead.',
      ),
    ],
    'That’s not something I’ll help with. If something is worrying you, I’m happy to talk about that instead.',
    'conversational',
    started,
    now,
  );
}

export function impersonationAnswer(
  started: number = Date.now(),
  now: () => number = Date.now,
): Generator<AskEvent> {
  return fixedAnswer(
    [
      paragraph(
        'I won’t put words in Steven’s mouth.',
        'Everything I attribute to him or to a guest has to be something they actually said in a conversation, and I link you to the moment they said it. Ask me what the conversations say about it, and I’ll show you exactly where.',
      ),
    ],
    'I won’t put words in Steven’s mouth. Ask me what the conversations actually say, and I’ll show you where.',
    'conversational',
    started,
    now,
  );
}

/** The fixed reply for a route that isn't answered, or `null` for one that is. */
export function safetyReply(
  route: SafetyRoute,
  locale: string | null | undefined,
  started: number = Date.now(),
  now: () => number = Date.now,
): Generator<AskEvent> | null {
  if (route.kind === 'crisis') return crisisAnswer(locale, started, now);
  if (route.kind === 'refuse') return refusalAnswer(started, now);
  if (route.kind === 'impersonation') return impersonationAnswer(started, now);
  return null;
}

/** Extra guidance for one answer, sent with the question so the cached instructions stay the same. */
export function stakesGuidance(stakes: readonly string[], sensitive: boolean): string | null {
  const notes: string[] = [];
  if (stakes.length) {
    notes.push(
      `This is a ${stakes.join(' and ')} question. Give a clear, concrete view where the sources and sound general reasoning support one, then say plainly — in one sentence, in synthesis — when this person should see a professional, and which kind (for example a GP, a pharmacist, a solicitor, a regulated financial adviser). Never give a dose, a diagnosis or a legal or investment instruction as if it were certain.`,
    );
  }
  if (sensitive) {
    notes.push(
      'The topic is suicide or self-harm. The interface already shows helpline details above your answer, so do not repeat them. Be gentle and factual; never describe methods; do not speculate about why a named person died.',
    );
  }
  return notes.length ? notes.join('\n') : null;
}
