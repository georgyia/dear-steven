import { THINKING_COPY } from '@dear-steven/core/copy';
import { brand } from '../brand';

/**
 * Every word the interface shows, in English — the reference catalogue (P6-02). Other languages
 * implement the same `Messages` type, so a missing key is a type error. `code` in backticks is
 * rendered as code (`<Rich>`). Copy rules: docs/PERSONA.md §Copy and docs/DESIGN.md §8.
 */
const n = (x: number) => x.toLocaleString('en-GB');
const s = (x: number, one: string, other: string) => `${n(x)} ${x === 1 ? one : other}`;

export const en = {
  meta: {
    description:
      'An AI persona of Steven Bartlett that answers from real Diary Of A CEO conversations — and shows you exactly where each idea was said.',
    termsTitle: `Terms, disclaimer and privacy · ${brand.name}`,
    termsDescription:
      'What Dear Steven is and isn’t, the terms for using it, and what happens to your data.',
  },
  home: {
    intro:
      'Pull up a chair. Ask me anything — I’ll answer from the conversations I’ve had, and show you exactly where each idea came from.',
    examplesLabel: 'Example questions',
    examples: [
      'I’ve been procrastinating on an important project for weeks. How would you approach it?',
      'How do I stay disciplined when the motivation runs out?',
      'What should I think hard about before starting a business?',
    ],
    shortcuts: '↵ ask · ⇧↵ new line · / to type · [ ] sources',
  },
  composer: {
    label: 'Ask Steven',
    placeholder: 'Dear Steven…',
    followUp: 'Ask a follow-up…',
    listening: 'Listening…',
    send: 'Send',
    stop: 'Stop',
  },
  disclosure:
    'Dear Steven is an AI persona — not Steven Bartlett, and not affiliated with the show.',
  terms: {
    link: 'Terms & disclaimer',
    noticeLabel: 'Before you start',
    notice:
      'I’m an AI persona — not Steven Bartlett, and not affiliated with the show. I answer from public interviews, I can be wrong, and nothing I say is medical, legal or financial advice.',
    dismiss: 'Got it',
  },
  status: {
    ready: (x: number) => `${s(x, 'conversation', 'conversations')} · ready`,
    demo: 'Demo mode · fixture answers',
    empty: 'No conversations indexed yet',
    partial: (x: number) => `${n(x)} indexed · embeddings pending`,
    broken: 'Knowledge base unavailable',
    short: {
      ready: (x: number) => `${n(x)} · ready`,
      demo: 'Demo mode',
      empty: 'Not indexed',
      partial: 'Indexing',
      broken: 'Offline',
    },
    open: '. Open setup and knowledge base details.',
  },
  thinking: {
    ...THINKING_COPY.en,
    stopped: 'Stopped after',
    interrupted: 'Interrupted after',
    elapsed: (seconds: number) =>
      seconds < 60
        ? `${seconds.toFixed(1)}s`
        : `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`,
    elapsedSpoken: (seconds: number) =>
      seconds < 60
        ? `${seconds.toFixed(1)} seconds`
        : `${Math.floor(seconds / 60)} minutes ${(seconds % 60).toFixed(1)} seconds`,
  },
  stage: {
    voiceSettings: 'Voice settings',
    voice: 'Voice',
    about: 'About',
    howItWorks: 'How this works',
    newConversation: 'Start a new conversation',
    newConversationSr: ' — start a new conversation',
    restoredTitle: 'Picked up where you left off',
    restoredBody:
      'This conversation is remembered on this device. Forget it at the end of the page.',
    endedEarly: 'The answer ended early.',
  },
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
    clipboard: 'Couldn’t reach the clipboard',
  },
  /** Details under the error sentence; written on the server, in the visitor's language. */
  serverErrors: {
    keyRejected: 'The OpenAI key was rejected. Check OPENAI_API_KEY in .env and restart.',
    rateLimited: 'OpenAI is rate-limiting this key, or it has run out of credit.',
    providerDown: 'OpenAI had a problem answering just now.',
    refused: 'OpenAI turned the request down.',
    unreachable: 'I couldn’t reach OpenAI just now.',
    internal: 'Something went wrong on my end.',
    noKey: 'No OpenAI key is configured.',
    noKnowledgeBase: 'The knowledge base could not be opened.',
  },
  voiceErrors: {
    noSpeech: 'I didn’t catch that.',
    noSpeechHint: 'Try again a little closer to the mic — or type instead.',
    unclear: 'I couldn’t make that out.',
    serviceDown:
      'Your browser’s speech service is unreachable, so I’ve switched to server transcription. Try once more.',
    stopped: 'Speech recognition stopped unexpectedly.',
    recording: 'The recording couldn’t be transcribed.',
  },
  empty: {
    noKnowledge:
      'Nothing’s loaded yet. Run the ingest command and I’ll have something to say — see “Set up”.',
  },
  turn: {
    demoTag: 'Demo fixture · not AI-generated or source-verified',
    spokenHeading: 'What I’d say out loud',
    spokenNote: 'The written answer carries the sources.',
    stopped: 'You stopped me there. Ask again any time.',
    retry: 'Try again',
    complete: 'Answer complete.',
  },
  answer: {
    takeaway: 'If I were you',
    translation: 'Translation',
    verbatim: 'verbatim from the transcript',
    notVerified: 'speaker not verified',
    openSource: '. Open the source.',
    fromMyConversation: (who: string) => `From my conversation with ${who}`,
    onTheShow: (who: string) => `${who}, on the show`,
    listen: 'Listen',
    stop: 'Stop',
    viewLabel: 'Answer view',
    written: 'Written',
    spoken: 'Spoken',
  },
  speaker: {
    hostLong: `${brand.host.fullName} (host) — verified speaker`,
    guestLong: (name: string) => `${name} — verified speaker`,
    unverifiedLong: (guest: string) => `From the conversation with ${guest} — speaker not verified`,
    guest: 'Guest',
    unknown: 'Unknown',
  },
  chip: {
    host: 'Verified host statement',
    guest: 'Verified guest statement',
    unverified: 'Real passage, speaker not verified',
    label: (who: string, time: string, note: string, spoken: string) =>
      `${who} · ${time}. ${note}, at ${spoken}. Open source.`,
  },
  cards: {
    label: 'Conversations cited',
    heading: (count: number) =>
      count === 1 ? 'From this conversation' : `From these ${count} conversations`,
    moments: (count: number) => s(count, 'moment', 'moments'),
  },
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
  inspector: {
    label: 'Source inspector',
    position: (index: number, total: number) => `${index} of ${total}`,
    previous: 'Previous source ( [ )',
    next: 'Next source ( ] )',
    close: 'Close (Esc)',
    fromConversation: (who: string) => `From the conversation with ${who}`,
    saidBy: (who: string) => `Said by ${who}`,
    inPodcast: (time: string) => `${time} in the podcast`,
    tabsLabel: 'Source view',
    tabs: { quote: 'Quote', context: 'Context', video: 'Video' },
    verifiedHost: 'Verified host',
    verifiedGuest: 'Verified guest',
    notVerified: 'Speaker not verified',
    verbatim: 'Verbatim from the stored transcript',
    asr: ' · automatic transcription, may contain errors',
    unverifiedNote: ' · this passage is real, but the transcript doesn’t say who was speaking',
    whyCited: 'Why I cited this',
    aiNote: 'An AI note, not part of the transcript.',
    copy: 'Copy quote with attribution',
    copied: 'Quote copied with attribution',
    copyConversation: ' (conversation)',
  },
  related: {
    heading: 'Related moments',
    note: 'From other conversations. Related, not cited — they don’t support this answer.',
  },
  video: {
    demoOff:
      'Video links are switched off in demo mode — demo episodes are fixtures, not real recordings.',
    notLinked:
      'This episode isn’t linked to its YouTube video yet. Run the match-youtube ingest step to add it.',
    notLinkedAudio:
      'This episode isn’t linked to its YouTube video yet — the podcast audio is below.',
    playFrom: (moment: string) => `Play the video here from ${moment}`,
    play: 'Play the video here',
    privacy: 'YouTube’s privacy-enhanced player. Nothing loads from Google until you press play.',
    frameTitle: (title: string) => `YouTube video: ${title}`,
    exact: 'The video and the podcast are aligned for this episode.',
    estimated: 'Approximate (≈) — the video can run slightly ahead of or behind the podcast audio.',
    unaligned: (time: string) =>
      `The exact moment isn’t aligned yet, so the video starts from the beginning. In the podcast it’s at ${time}.`,
    audioHeading: 'Podcast audio',
    playAudioFrom: (time: string) => `Play the podcast audio here from ${time}`,
    retryAudio: 'Try the podcast audio again',
    audioError: 'The podcast host didn’t send the audio just now.',
    audioNote:
      'Streams from the podcast’s own host once you press play. Ads the host inserts can shift the moment by a few seconds.',
  },
  setup: {
    eyebrow: 'Setup',
    title: 'What I have to work with',
    optional: 'optional',
    marks: {
      pending: 'Pending',
      running: 'In progress',
      done: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
    },
    openai: {
      title: 'OpenAI API key',
      forced: 'Found, but `DEAR_STEVEN_DEMO=1` is forcing demo mode.',
      found: 'Found on the server. It never reaches the browser.',
      missing:
        'Missing — answers are demo fixtures until you add `OPENAI_API_KEY` to `.env` at the repository root and restart.',
    },
    kb: {
      title: 'Knowledge base',
      error: (detail: string) => `The database could not be opened: ${detail}`,
      none: 'No database yet. Start with `pnpm ingest discover`, then `pnpm ingest transcribe --from vtt --limit 20`.',
      ready: (episodes: number, passages: number, lastRun: string | null) =>
        `${s(episodes, 'episode', 'episodes')} · ${s(passages, 'passage', 'passages')} indexed${lastRun ? ` · last run ${lastRun}` : ''}.`,
    },
    embeddings: {
      title: 'Semantic search',
      waiting: 'Waiting for passages.',
      done: 'Every passage has an embedding; search is hybrid (meaning + keywords).',
      partial: (embedded: number, total: number) =>
        `${n(embedded)} of ${n(total)} passages embedded — keyword search covers the rest. Run \`pnpm ingest index\`.`,
    },
    youtube: {
      title: 'YouTube moments',
      done: (x: number) => `${s(x, 'episode', 'episodes')} linked to their videos.`,
      missing:
        'Optional. Add `YOUTUBE_API_KEY` and run `pnpm ingest match-youtube` so citations open the video at the right moment.',
    },
    spend: {
      title: 'Daily spend cap',
      none: (today: string) =>
        `No cap: ${today} spent today (estimated). Set \`DEAR_STEVEN_DAILY_BUDGET_USD\` before anyone else can reach this.`,
      resting: (cap: string) =>
        `Resting until midnight UTC: today’s ${cap} is spent, so I answer without calling OpenAI.`,
      within: (today: string, cap: string) =>
        `${today} of ${cap} spent today (estimated from token use).`,
    },
    speakers: {
      title: 'Verified speakers',
      done: (x: number) =>
        `${s(x, 'episode has', 'episodes have')} speaker labels, so I can say who said what.`,
      missing:
        'Optional, paid. Without speaker labels I cite the conversation, never a person. See `plan/human/transcription-budget.md`.',
    },
    browse: (x: number) => `Browse the ${s(x, 'conversation', 'conversations')}`,
    footer: 'Full instructions: `README.md` and `docs/INGESTION.md`. Nothing you ask is stored.',
  },
  explorer: {
    eyebrow: 'Knowledge base',
    title: 'The conversations I know',
    search: 'Search by guest or title',
    clear: 'Clear search',
    matches: (x: number) => s(x, 'match', 'matches'),
    indexed: (x: number) => `${s(x, 'conversation', 'conversations')} indexed`,
    looking: 'Looking…',
    loadError: 'I couldn’t load the list just now.',
    noMatch: (q: string) => `No conversation matches “${q}”.`,
    more: (x: number) => `Show more (${n(x)} left)`,
    loading: 'Loading…',
    guestNotNamed: 'Guest not named',
    passages: (x: number) => s(x, 'passage', 'passages'),
    verified: 'speakers verified',
    notVerified: 'speakers not verified',
  },
  memory: {
    label: 'Conversation memory',
    remember: 'Remember this conversation on this device',
    unsupported:
      'This browser isn’t letting me store anything, so this conversation can’t be remembered.',
    saveFailed: 'I couldn’t save to this browser’s storage just now. Nothing new is kept.',
    on: 'Kept in this browser’s own storage, on this device only, until you forget it. Never sent anywhere.',
    forgotten: 'Forgotten — nothing from this conversation is stored on this device.',
    off: 'Off: nothing is kept once you close this tab.',
    forget: 'Forget',
    undo: 'Undo',
    done: 'Forgotten',
  },
  about: {
    eyebrow: 'How this works',
    title: 'An AI persona with receipts',
    intro: `${brand.name} answers in the first person, in the spirit of ${brand.host.fullName}’s public interview persona. It is an AI — not ${brand.host.firstName}, and not affiliated with ${brand.show}. Its knowledge comes from transcripts of real episodes, and every claim it attributes to anyone links to the exact passage it came from.`,
    kinds: 'Four kinds of statement',
    host: {
      title: 'Something the host actually said',
      body: 'Only when the transcript has verified speaker labels.',
    },
    guest: {
      chip: 'Guest',
      title: 'Something a guest actually said',
      body: 'Also requires verified speaker labels.',
    },
    episode: {
      chip: 'Episode',
      title: 'From a real conversation — speaker not verified',
      body: 'The passage is real; the transcript just doesn’t say who was talking.',
    },
    synthesis: {
      chip: 'Softer text, no chip',
      title: 'My own reasoning',
      body: 'Synthesis and advice. Never presented as something anyone said.',
    },
    checkedHeading: 'Checked, not trusted',
    checked:
      'The model never writes citation markup. It returns a structured answer, and the server checks every citation against the passages it actually retrieved: unknown sources are dropped, speaker claims must match the transcript, and quotes are shown from the stored transcript — never from the model’s memory. If the conversations don’t cover your question, it says so.',
    originalsHeading: 'Watch the originals',
    originals: `Everything here comes from ${brand.show}’s conversations, and they are free to watch on YouTube. This is a fan project that sends people to the show, not a replacement for it: wherever an episode is matched to its video, its sources link to the moment they come from, and watching the full episodes is the best way to support the people who made them.`,
    dataHeading: 'Your data',
    data: 'Questions are sent to the server and to OpenAI to compose an answer, and are not stored unless whoever runs this copy switches on answer logging for evaluation. The microphone is only used while you hold or toggle it. Short, attributed quotations link back to the original episodes; full transcripts are never published. The video player and the podcast audio load from YouTube and the podcast’s host only when you press play. If you pick a language, a small cookie remembers it so the page opens in that language. Voice settings — and, only if you switch it on, the conversation itself — are kept in this browser only, until you forget them.',
    fullVersion: 'The full version, with what is and isn’t promised:',
  },
  voice: {
    eyebrow: 'Settings',
    title: 'Voice & language',
    language: 'Language',
    languageNote:
      'The interface, the thinking steps and voice input. Answers follow the language you ask in.',
    alwaysSpeak: 'Always speak replies',
    alwaysSpeakNote:
      'Read every answer aloud, typed or spoken. Nothing plays until you’ve asked something during this visit.',
    onDevice: 'On-device speech recognition',
    onDeviceNotes: {
      server:
        'This browser has no built-in speech recognition, so your voice is transcribed on the server instead.',
      installing: 'Downloading the speech model…',
      failed: 'The speech model didn’t finish downloading. Try again later.',
      available: 'Recognise your voice on this device, so the audio never leaves it.',
      downloadable:
        'Chrome downloads a speech model once, then recognises your voice on this device.',
      unknown: 'Checking what this browser can do…',
      unavailable: 'Not available in this browser — it uses its own speech service.',
    },
    voice: 'Voice',
    cannotSpeak: 'This browser can’t speak replies aloud.',
    defaultVoice: ' (default)',
    automatic: 'Automatic',
    hearIt: 'Hear it',
    sample: 'This is how I’ll sound when I answer you.',
    serverNote: 'Stock OpenAI voices only — never an imitation of a real person.',
    browserNote:
      'Your device’s own voices. With an OpenAI key, stock OpenAI voices are offered instead.',
    notPersisted:
      'This browser isn’t letting me save settings, so these last until you close the tab.',
    unavailable: 'Voice isn’t available in this browser',
    blocked: 'Microphone blocked — allow it in your browser settings',
    talk: 'Talk to Steven (M)',
  },
  access: {
    prompt: `This copy of ${brand.name} is private. Enter the passcode its owner gave you.`,
    placeholder: 'Passcode',
    enter: 'Enter',
    checking: 'Checking…',
    wrong: 'That passcode isn’t right.',
    slow: 'Too many tries. Wait a minute, then try again.',
    offline: 'I couldn’t check that just now. Try again?',
  },
  ui: {
    close: 'Close',
    notifications: 'Notifications',
  },
  termsPage: {
    title: 'Terms, disclaimer and privacy',
    onThisPage: 'On this page',
    newTab: ' (opens in a new tab)',
    englishOnly: null as string | null,
    updated: (date: string) => `Last updated ${date}. Plain-language text, not legal advice.`,
  },
};

export type Messages = typeof en;
