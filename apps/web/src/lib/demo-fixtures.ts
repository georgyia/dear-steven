import type {
  AnswerMode,
  Citation,
  EpisodePage,
  EpisodeRef,
  PassageCitation,
  PassageContext,
  RelatedMoments,
  ResolvedBlock,
} from '@dear-steven/core/schema';

/**
 * Demo mode fixtures (no OpenAI key). Everything here is fictional and labelled as such: the
 * guests are "Demo Guest", the episodes are marked "(fixture)", there are no video links, and no
 * words are put in Steven Bartlett's mouth — the host chip appears only in the legend.
 * The UI also shows a persistent "Demo — not AI-generated or source-verified" notice.
 */

export interface DemoAnswer {
  key: string;
  matches: RegExp | null;
  mode: AnswerMode;
  blocks: ResolvedBlock[];
  citations: Citation[];
  spoken: string;
  caveats: string[];
  searched: { passages: number; episodes: number };
}

const episodes = {
  science: {
    id: 'demo_ep_1',
    title: 'Demo Episode: The Science Of Starting (fixture)',
    guestNames: ['Demo Guest · Behavioural Scientist'],
    publishedAt: '2026-03-12T05:00:00Z',
    youtubeVideoId: null,
    audioUrl: null,
    demo: true,
  },
  founder: {
    id: 'demo_ep_2',
    title: 'Demo Episode: Building Something From Nothing (fixture)',
    guestNames: ['Demo Guest · Founder'],
    publishedAt: '2026-05-04T05:00:00Z',
    youtubeVideoId: null,
    audioUrl: null,
    demo: true,
  },
  coach: {
    id: 'demo_ep_3',
    title: 'Demo Episode: Habits That Survive Bad Days (fixture)',
    guestNames: ['Demo Guest · Performance Coach'],
    publishedAt: '2026-07-21T05:00:00Z',
    youtubeVideoId: null,
    audioUrl: null,
    demo: true,
  },
} satisfies Record<string, EpisodeRef>;

interface DemoPassage {
  id: string;
  episode: EpisodeRef;
  speaker: Citation['speaker'];
  speakerName: string | null;
  startMs: number;
  endMs: number;
  text: string;
  before: string[];
  after: string[];
}

const passages = {
  feeling: {
    id: 'demo_ps_feeling',
    episode: episodes.science,
    speaker: 'guest',
    speakerName: 'Demo Guest · Behavioural Scientist',
    startMs: 1_934_000,
    endMs: 1_991_000,
    text: 'What people miss is that you don’t procrastinate on the work. You procrastinate on the feeling the work gives you. An ambiguous task registers as a small threat, and walking away from it gives you instant relief — and relief is a very powerful teacher.',
    before: [
      'So when someone tells me they have a willpower problem, I usually ask them what the task feels like.',
      'Because it’s almost never the effort itself.',
    ],
    after: [
      'Which is why the advice to just try harder backfires.',
      'You are fighting a mood, not a schedule.',
    ],
  },
  mood: {
    id: 'demo_ps_mood',
    episode: episodes.science,
    speaker: 'unverified',
    speakerName: null,
    startMs: 2_410_000,
    endMs: 2_466_000,
    text: 'We tend to delay the things that make us feel something unpleasant — boredom, self-doubt, the fear of doing it badly — far more than the things that are simply hard. The hard-but-clear task gets done. The vague one sits there for weeks.',
    before: ['Let me give you the version of this that surprised me most.'],
    after: ['That distinction changed how I plan my own week.'],
  },
  firstStep: {
    id: 'demo_ps_first_step',
    episode: episodes.founder,
    speaker: 'guest',
    speakerName: 'Demo Guest · Founder',
    startMs: 845_000,
    endMs: 902_000,
    text: 'I shrink the first step until it’s almost embarrassing. Open the document. Write one ugly sentence. Momentum does what motivation can’t, and by the time you notice you’re working, you’re already ten minutes in.',
    before: ['People think founders are just more motivated than everyone else.'],
    after: ['The trick is that the first step has to be too small to argue with.'],
  },
  systems: {
    id: 'demo_ps_systems',
    episode: episodes.coach,
    speaker: 'guest',
    speakerName: 'Demo Guest · Performance Coach',
    startMs: 1_212_000,
    endMs: 1_270_000,
    text: 'Motivation is the weather. You can’t plan a season around the weather. What you can do is decide in advance what the minimum looks like on a bad day — and make the minimum so small that you never miss it twice.',
    before: ['Every athlete I’ve worked with has days where they don’t want to be there.'],
    after: ['Never missing twice is the whole game.'],
  },
  identity: {
    id: 'demo_ps_identity',
    episode: episodes.coach,
    speaker: 'unverified',
    speakerName: null,
    startMs: 2_052_000,
    endMs: 2_101_000,
    text: 'The people who stay consistent stop asking whether they feel like it. The question becomes: what would someone like me do today? Behaviour follows the story you tell about yourself.',
    before: ['There was a point in the conversation where we got onto identity.'],
    after: ['And the story gets stronger every time you show up.'],
  },
  problem: {
    id: 'demo_ps_problem',
    episode: episodes.founder,
    speaker: 'guest',
    speakerName: 'Demo Guest · Founder',
    startMs: 1_530_000,
    endMs: 1_588_000,
    text: 'Fall in love with a problem, not your idea. If you can’t find ten people who’ll pay for the ugly first version, you don’t have a business yet — you have a hobby with a logo.',
    before: ['The first company I started failed, and I can tell you exactly why.'],
    after: ['Everything I’ve done since starts with talking to customers first.'],
  },
} satisfies Record<string, DemoPassage>;

type PassageKey = keyof typeof passages;

const toCitation = (id: string, key: PassageKey, relevance: string): Citation => {
  const p: DemoPassage = passages[key];
  return {
    id,
    passageId: p.id,
    episode: p.episode,
    speaker: p.speaker,
    speakerName: p.speakerName,
    startMs: p.startMs,
    endMs: p.endMs,
    timestamp: { ms: p.startMs, state: 'unknown' },
    youtubeUrl: null,
    embedUrl: null,
    excerpt: p.text,
    quoteSpan: null,
    relevance,
    quality: 'reviewed',
  };
};

const quoteOf = (key: PassageKey, sentence: string) => {
  const text = passages[key].text;
  const start = text.indexOf(sentence);
  if (start < 0) throw new Error(`Demo quote not found in ${key}`);
  return { start, end: start + sentence.length };
};

const procrastination: DemoAnswer = {
  key: 'procrastination',
  matches: /procrastinat|putting (it|things) off|avoid|delay|stuck/i,
  mode: 'grounded',
  searched: { passages: 9, episodes: 3 },
  citations: [
    toCitation(
      'c1',
      'mood',
      'Separates hard tasks from unpleasant ones — the core of your situation.',
    ),
    {
      ...toCitation('c2', 'feeling', 'Explains why avoiding the task feels good in the moment.'),
      excerpt:
        'you don’t procrastinate on the work. You procrastinate on the feeling the work gives you.',
      quoteSpan: quoteOf(
        'feeling',
        'you don’t procrastinate on the work. You procrastinate on the feeling the work gives you.',
      ),
    },
    toCitation(
      'c3',
      'firstStep',
      'A concrete tactic for starting when you already know what to do.',
    ),
  ],
  blocks: [
    {
      kind: 'paragraph',
      segments: [
        {
          text: 'Yeah — I think the interesting thing about procrastination is that it’s almost never about not knowing what to do.',
          attribution: 'synthesis',
          citationIds: [],
        },
        {
          text: 'In one of my conversations, the point came up that we delay the things that make us feel something unpleasant — boredom, doubt, the fear of doing it badly — far more than things that are simply hard.',
          attribution: 'episode',
          citationIds: ['c1'],
        },
      ],
    },
    {
      kind: 'paragraph',
      segments: [
        {
          text: 'When I sat down with the behavioural scientist in this demo, they explained that an ambiguous task registers as a small threat, and walking away from it gives you instant relief — which is exactly what makes the habit stick.',
          attribution: 'guest',
          citationIds: ['c2'],
        },
        {
          text: 'So the delay isn’t laziness. It’s a mood-repair strategy that works brilliantly for ten minutes and terribly for ten weeks.',
          attribution: 'synthesis',
          citationIds: [],
        },
      ],
    },
    {
      kind: 'quote',
      citationId: 'c2',
      lead: 'The line from that conversation that stayed with me:',
      text: 'you don’t procrastinate on the work. You procrastinate on the feeling the work gives you.',
    },
    {
      kind: 'paragraph',
      segments: [
        {
          text: 'A founder I spoke to came at it from the practical side: shrink the first step until it’s almost embarrassing — open the document, write one ugly sentence — because momentum does what motivation can’t.',
          attribution: 'guest',
          citationIds: ['c3'],
        },
      ],
    },
    {
      kind: 'takeaway',
      segments: [
        {
          text: 'If I were in your shoes, I’d name the feeling this project gives you, then define a ten-minute first step and do it before lunch tomorrow. Not the project — just the step.',
          attribution: 'synthesis',
          citationIds: [],
        },
      ],
    },
  ],
  spoken:
    'Yeah — procrastination is rarely about not knowing what to do. It’s about avoiding how the work makes you feel. One guest put it perfectly: you don’t procrastinate on the work, you procrastinate on the feeling. So name that feeling, shrink the first step until it’s almost embarrassing, and do it tomorrow morning. The sources are on screen if you want to dig in.',
  caveats: [],
};

const discipline: DemoAnswer = {
  key: 'discipline',
  matches: /disciplin|motivat|habit|consisten|willpower|routine/i,
  mode: 'partial',
  searched: { passages: 6, episodes: 2 },
  citations: [
    toCitation('c1', 'systems', 'Plans for the days motivation doesn’t show up.'),
    toCitation('c2', 'identity', 'Frames consistency as identity rather than effort.'),
  ],
  blocks: [
    {
      kind: 'paragraph',
      segments: [
        {
          text: 'I’ll be honest — only a couple of my conversations go straight at this, so take this as a starting point rather than the final word.',
          attribution: 'synthesis',
          citationIds: [],
        },
      ],
    },
    {
      kind: 'paragraph',
      segments: [
        {
          text: 'A performance coach I spoke with said motivation is the weather — you can’t plan a season around it. What you can do is decide in advance what the minimum looks like on a bad day, and make it so small you never miss twice.',
          attribution: 'guest',
          citationIds: ['c1'],
        },
        {
          text: 'Later in that same conversation we got onto identity: the people who stay consistent stop asking whether they feel like it, and start asking what someone like them would do today.',
          attribution: 'episode',
          citationIds: ['c2'],
        },
      ],
    },
    {
      kind: 'quote',
      citationId: 'c1',
      lead: null,
      text: passages.systems.text,
    },
    {
      kind: 'takeaway',
      segments: [
        {
          text: 'So I wouldn’t try to feel more disciplined. I’d write down your bad-day minimum tonight, and protect one rule: never miss twice.',
          attribution: 'synthesis',
          citationIds: [],
        },
      ],
    },
  ],
  spoken:
    'Only a couple of my conversations go straight at this, so treat it as a starting point. One coach called motivation the weather — you can’t plan around it. Decide your bad-day minimum in advance, make it tiny, and never miss twice. Over time it stops being discipline and starts being who you are.',
  caveats: ['Only two conversations in this demo address discipline directly.'],
};

const business: DemoAnswer = {
  key: 'business',
  matches: /business|start-?up|founder|company|entrepreneur|side project/i,
  mode: 'grounded',
  searched: { passages: 11, episodes: 3 },
  citations: [
    toCitation('c1', 'problem', 'A test for whether an idea is a business yet.'),
    toCitation('c2', 'firstStep', 'How to start before you feel ready.'),
  ],
  blocks: [
    {
      kind: 'paragraph',
      segments: [
        {
          text: 'The founder in this demo had a line I keep coming back to: fall in love with a problem, not your idea — and if you can’t find ten people who’ll pay for the ugly first version, you don’t have a business yet.',
          attribution: 'guest',
          citationIds: ['c1'],
        },
        {
          text: 'That’s a much harsher test than “do my friends like it”, which is exactly why it’s useful.',
          attribution: 'synthesis',
          citationIds: [],
        },
      ],
    },
    {
      kind: 'paragraph',
      segments: [
        {
          text: 'The same founder was clear that you don’t wait to feel ready — the first step should be too small to argue with.',
          attribution: 'guest',
          citationIds: ['c2'],
        },
      ],
    },
    {
      kind: 'takeaway',
      segments: [
        {
          text: 'Before you build anything, I’d write down the problem in one sentence and go and find ten people who have it. Their answers will tell you more than any business plan.',
          attribution: 'synthesis',
          citationIds: [],
        },
      ],
    },
  ],
  spoken:
    'Fall in love with the problem, not the idea. If you can’t find ten people who’ll pay for the ugly first version, you don’t have a business yet. So write the problem down in one sentence, and go and talk to ten people who have it.',
  caveats: [],
};

const insufficient: DemoAnswer = {
  key: 'insufficient',
  matches: null,
  mode: 'insufficient',
  searched: { passages: 4, episodes: 2 },
  citations: [],
  blocks: [
    {
      kind: 'paragraph',
      segments: [
        {
          text: 'I looked, and none of the conversations in this demo really answer that — and I’d rather tell you that than make something up.',
          attribution: 'synthesis',
          citationIds: [],
        },
        {
          text: 'Try asking about procrastination, discipline or starting a business — those are the three topics the demo fixtures cover.',
          attribution: 'synthesis',
          citationIds: [],
        },
      ],
    },
  ],
  spoken:
    'I looked, and none of the demo conversations really answer that — I’d rather say so than make something up. Try procrastination, discipline or starting a business.',
  caveats: ['Demo mode only covers three topics.'],
};

export const DEMO_ANSWERS: DemoAnswer[] = [procrastination, discipline, business, insufficient];

export function pickDemoAnswer(question: string): DemoAnswer {
  return DEMO_ANSWERS.find((a) => a.matches?.test(question)) ?? insufficient;
}

const passageCitation = (
  p: DemoPassage,
  excerptChars = Number.POSITIVE_INFINITY,
): PassageCitation => ({
  passageId: p.id,
  episode: p.episode,
  speaker: p.speaker,
  speakerName: p.speakerName,
  startMs: p.startMs,
  endMs: p.endMs,
  timestamp: { ms: p.startMs, state: 'unknown' },
  youtubeUrl: null,
  embedUrl: null,
  excerpt:
    p.text.length > excerptChars ? `${p.text.slice(0, excerptChars - 1).trimEnd()}…` : p.text,
  quality: 'reviewed',
  text: p.text,
});

export function demoPassageContext(passageId: string): PassageContext | null {
  const p = Object.values(passages).find((x) => x.id === passageId) as DemoPassage | undefined;
  if (!p) return null;
  const step = 7_000;
  return {
    citation: passageCitation(p),
    before: p.before.map((text, i) => ({
      text,
      startMs: p.startMs - (p.before.length - i) * step,
    })),
    after: p.after.map((text, i) => ({ text, startMs: p.endMs + i * step })),
    lines: null,
  };
}

/** Hand-picked "related moments" between fixtures — always from another fixture episode. */
const related: Partial<Record<PassageKey, PassageKey[]>> = {
  feeling: ['firstStep', 'systems'],
  mood: ['firstStep', 'identity'],
  firstStep: ['feeling', 'systems'],
  systems: ['firstStep', 'mood'],
  identity: ['mood', 'firstStep'],
};

/** Related moments for a fixture passage; `null` when the id is not a fixture. */
export function demoRelatedMoments(passageId: string): RelatedMoments | null {
  const key = (Object.keys(passages) as PassageKey[]).find((k) => passages[k].id === passageId);
  if (!key) return null;
  return { passages: (related[key] ?? []).map((k) => passageCitation(passages[k], 240)) };
}

export const DEMO_EPISODE_COUNT = Object.keys(episodes).length;

/** The episode explorer in demo mode: the three fixture episodes, searchable like the real list. */
export function demoEpisodePage(query: string, offset: number): EpisodePage {
  const q = query.trim().toLowerCase();
  const all = Object.values(episodes)
    .filter(
      (e) =>
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.guestNames.some((g) => g.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((e) => ({
      id: e.id,
      title: e.title,
      guestNames: e.guestNames,
      publishedAt: e.publishedAt,
      passages: Object.values(passages).filter((p) => p.episode.id === e.id).length,
      speakers: 'unverified' as const,
      video: 'none' as const,
      youtubeUrl: null,
      demo: true,
    }));
  return { total: all.length, offset, episodes: all.slice(offset) };
}
