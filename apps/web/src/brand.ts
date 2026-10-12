import { THINKING_COPY } from '@dear-steven/core/copy';

/**
 * Everything that names the product or speaks in its voice lives here, so the provisional name
 * (and the copy) can change in one place. Copy rules: docs/PERSONA.md §Copy and docs/DESIGN.md §8.
 */
export const brand = {
  name: 'Dear Steven',
  host: { fullName: 'Steven Bartlett', firstName: 'Steven' },
  show: 'The Diary Of A CEO',
  description:
    'An AI persona of Steven Bartlett that answers from real Diary Of A CEO conversations — and shows you exactly where each idea was said.',
  intro:
    'Pull up a chair. Ask me anything — I’ll answer from the conversations I’ve had, and show you exactly where each idea came from.',
  placeholder: 'Dear Steven…',
  followUpPlaceholder: 'Ask a follow-up…',
  disclosure:
    'Dear Steven is an AI persona — not Steven Bartlett, and not affiliated with the show.',
  examples: [
    'I’ve been procrastinating on an important project for weeks. How would you approach it?',
    'How do I stay disciplined when the motivation runs out?',
    'What should I think hard about before starting a business?',
  ],
  copy: {
    status: {
      ready: (n: number) =>
        `${n.toLocaleString('en-GB')} conversation${n === 1 ? '' : 's'} · ready`,
      demo: 'Demo mode · fixture answers',
      empty: 'No conversations indexed yet',
      partial: (n: number) => `${n.toLocaleString('en-GB')} indexed · embeddings pending`,
      broken: 'Knowledge base unavailable',
    },
    thinking: THINKING_COPY,
    demoNotice: {
      title: 'Demo — not AI-generated or source-verified',
      description:
        'These answers are fixtures so you can try the experience. Add an OpenAI key to talk for real.',
      action: 'Set up',
    },
    errors: {
      network: 'I lost the line for a second there. Try that again?',
      rateLimited: 'You’re asking faster than I can think. Give it a moment and try again.',
      upstream:
        'My side of the conversation dropped out. Nothing was made up — try again in a moment.',
      generic: 'Something went wrong on my end. Try again?',
      notConfigured: 'I’m not set up to answer properly yet.',
      locked: 'This copy of me is private. Reload the page and enter the passcode again.',
      passage: 'I couldn’t load that passage just now.',
      micDenied:
        'I can’t hear you — microphone access is blocked. You can type instead, or allow the mic in your browser settings.',
      micUnsupported: 'This browser can’t do voice here. Typing works just as well.',
    },
    empty: {
      noKnowledge:
        'Nothing’s loaded yet. Run the ingest command and I’ll have something to say — see “Set up”.',
    },
    toast: {
      quoteCopied: 'Quote copied with attribution',
    },
    /** The terms, the disclaimer and the first-visit notice (P6-12). */
    terms: {
      link: 'Terms & disclaimer',
      noticeLabel: 'Before you start',
      notice:
        'I’m an AI persona — not Steven Bartlett, and not affiliated with the show. I answer from public interviews, I can be wrong, and nothing I say is medical, legal or financial advice.',
      dismiss: 'Got it',
    },
    /** Sending people to the original conversations (P6-14). One wording everywhere. */
    youtube: {
      watch: 'Watch on YouTube',
      // The moment never breaks across lines: "≈ 40:10" stays together on a narrow card.
      watchFrom: (moment: string) => `Watch on YouTube · ${moment.replace(' ', '\u00a0')}`,
      newTab: ' — opens YouTube in a new tab',
      unmatched: 'No video matched yet',
      fixture: 'Fixture · no video',
      invitation:
        'These conversations are worth watching in full — they go further than any answer I can give.',
      channel: 'The Diary Of A CEO on YouTube',
    },
  },
} as const;

export type Brand = typeof brand;
