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
      'An unofficial AI persona of Steven Bartlett that answers from real Diary Of A CEO conversations — and shows you exactly where each idea was said.',
    /** The title a link preview shows (P10-10): what this is, before anything else. */
    previewTitle: `${brand.name}: an unofficial AI persona`,
    termsTitle: `${brand.name}: terms, disclaimer and privacy`,
    termsDescription:
      'What Dear Steven is and isn’t, the terms for using it, and what happens to your data.',
    legalTitle: `${brand.name}: legal notice`,
    legalDescription: `Who runs this copy of ${brand.name}, and how to reach them.`,
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
    shortcutsLabel: 'Keyboard shortcuts',
    shortcuts: [
      { keys: '↵', action: 'ask' },
      { keys: '⇧↵', action: 'new line' },
      { keys: '/', action: 'to type' },
      { keys: '[ ]', action: 'sources' },
    ],
  },
  composer: {
    label: 'Ask Steven',
    placeholder: 'Dear Steven…',
    followUp: 'Ask a follow-up…',
    talkPlaceholder: 'Say something…',
    talkFollowUp: 'Say something back…',
    listening: 'Listening…',
    send: 'Send',
    stop: 'Stop',
  },
  modes: {
    label: 'How Dear Steven replies',
    ask: 'Ask',
    talk: 'Talk',
    interview: 'Interview me',
    hint: {
      ask: 'A considered answer, with every source.',
      talk: 'A quick back-and-forth, out loud if you like.',
      interview: 'I ask, you answer: one question at a time.',
    },
  },
  aboutYou: {
    label: 'About you',
    title: 'What I keep about you',
    note: 'Kept on this device only, and sent with your questions exactly as written here. I use it to make answers fit you; it’s never treated as anything a guest said.',
    demoNote: 'Demo answers are fixtures, so they won’t change with it.',
    counter: (n: number, max: number) => `${n} of ${max} characters`,
    save: 'Save changes',
    saved: 'Saved.',
    forget: 'Forget it',
    undo: 'Undo',
    done: 'Forgotten',
    forgotten: 'Forgotten. Nothing about you is kept now.',
    failed: 'I couldn’t keep it: this browser isn’t letting the page store anything.',
    keep: 'Keep this on this device',
    keepNote:
      'So my answers can take it into account. It stays on this device; you can see, edit or forget it at the end of any conversation.',
    kept: 'Kept on this device. My answers will take it into account.',
  },
  interview: {
    label: 'Interview',
    eyebrow: 'Interview',
    title: 'Let me interview you.',
    intro:
      'One question at a time, the way the show asks them: who you are, where it started, what changed and what it cost. Seven questions. Skip any, or stop whenever you like.',
    privacy: 'Your answers go to OpenAI to write the next question, and aren’t stored anywhere.',
    privacyDemo: 'Demo mode: the questions are fixed, and your answers aren’t stored anywhere.',
    name: 'What should I call you?',
    about: 'What do you do, in a line?',
    optional: 'optional',
    start: 'Start the interview',
    progress: (n: number, total: number) => `Question ${n} of ${total}`,
    starting: 'Getting my first question ready…',
    answerLabel: 'Your answer',
    placeholder: 'Your answer…',
    skip: 'Skip',
    end: 'End the interview',
    lastAnswer: 'You said',
    learnedEyebrow: 'What I learned about you',
    learnedTitle: (name: string | null) => (name ? `Thank you, ${name}.` : 'Thank you.'),
    learnedNote: 'Each line rests on your own words, quoted exactly.',
    learnedEmpty:
      'You skipped every question, so there’s nothing I can honestly say I learned. Fair enough.',
    evidence: (n: number) => `You, answer ${n}`,
    again: 'Interview me again',
    back: 'Back to Ask',
    retry: 'Try again',
    flavourLabel: 'What kind of interview',
    flavourInterview: 'Get to know me',
    flavourPractice: 'Practise presenting my expertise',
    practiceTitle: 'Practise presenting your expertise.',
    practiceIntro:
      'Six tougher questions about what you know: where it comes from, what you believe that others don’t, your proof, a mistake, and the one thing to remember. Then a debrief: what came across, where you were vague, and one answer said the way it could land.',
    expertise: 'What are you expert in?',
    audience: 'Who are you presenting it to?',
    practiceStart: 'Start the practice',
    debriefEyebrow: 'Debrief',
    scoresLabel: 'How it came across',
    scores: { clarity: 'Clarity', specificity: 'Specificity', story: 'Story', brevity: 'Brevity' },
    scoreValue: (n: number) => `${n} of 5`,
    strengths: 'What worked',
    improvements: 'What to work on',
    rewriteTitle: 'One answer, the way it could land',
    rewriteYouSaid: 'You said',
    noRewrite: 'No rewrite this time: none kept closely enough to your own facts to show.',
    noRewriteDemo: 'In demo mode there’s no rewrite: only a live model could write one.',
    retake: 'Practise the weakest answer again',
    newPractice: 'Start a new practice',
  },
  talk: {
    label: 'Talking with Dear Steven',
    eyebrow: 'Talk',
    you: 'You',
    steven: 'Dear Steven',
    thinking: 'Dear Steven is thinking…',
  },
  conversation: {
    label: 'Spoken conversation',
    start: 'Talk out loud with Steven (M)',
    yours: 'Listening',
    thinking: 'Thinking',
    speaking: 'Dear Steven',
    paused: 'Paused',
    listeningHint: 'I’m listening. Just pause when you’re done.',
    thinkingHint: 'Thinking about what you said…',
    speakingHint: 'Interrupt, or press Space, to cut in.',
    pausedIdle: (seconds: number) => `I stopped listening after ${seconds} seconds of quiet.`,
    pausedHidden: 'I stopped listening while this tab was in the background.',
    pausedFailed: 'Something went wrong there. Keep talking when you’re ready.',
    send: 'Send',
    interrupt: 'Interrupt',
    resume: 'Keep talking',
    end: 'End',
    announce: {
      yours: 'Your turn. I’m listening.',
      thinking: 'Thinking.',
      speaking: 'Dear Steven is speaking.',
      paused: 'Paused. The microphone is off.',
      ended: 'Conversation ended. The microphone is off.',
    },
  },
  /**
   * Under every composer, the interview's too (P6-12, P10-11): unofficial, an AI persona, not him,
   * not advice. Two lines at most at 375 px, and three on a share card.
   */
  disclosure:
    'Dear Steven is an unofficial AI persona, not Steven Bartlett, and not medical, legal or financial advice.',
  terms: {
    link: 'Terms & disclaimer',
    legalLink: 'Legal notice',
    noticeLabel: 'Before you start',
    notice:
      'I’m an AI persona — not Steven Bartlett, and not affiliated with the show. I answer from public interviews, I can be wrong, and nothing I say is medical, legal or financial advice.',
    dismiss: 'Got it',
  },
  status: {
    ready: (x: number) => `${s(x, 'conversation', 'conversations')} ready`,
    demo: 'Demo mode with fixture answers',
    empty: 'No conversations indexed yet',
    partial: (x: number) => `${n(x)} indexed, embeddings pending`,
    broken: 'Knowledge base unavailable',
    short: {
      ready: (x: number) => `${n(x)} ready`,
      demo: 'Demo mode',
      empty: 'Not indexed',
      partial: 'Indexing',
      broken: 'Offline',
      yourKey: (x: number) => `${n(x)} on your key`,
    },
    onYourKey: (text: string) => `${text}, running on your key`,
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
    needsKey: 'No free questions left here.',
    crossSite: `I only answer questions asked on ${brand.name} itself, and this one came from another site. Open ${brand.name} at its own address and ask there.`,
  },
  /** Details under the error sentence; written on the server, in the visitor's language. */
  serverErrors: {
    keyRejected:
      'OpenAI didn’t accept the key this copy answers with, so I can’t answer just now. Try again later, or use your own key in Setup.',
    rateLimited:
      'OpenAI is holding back the key this copy answers with: too many questions at once, or no credit left. Try again later, or use your own key in Setup.',
    providerDown: 'OpenAI had a problem answering just now.',
    refused: 'OpenAI turned the request down.',
    unreachable: 'I couldn’t reach OpenAI just now.',
    internal: 'Something went wrong on my end.',
    noKey:
      'This copy isn’t connected to OpenAI yet, so I can’t answer. Try again later, or use your own key in Setup.',
    noKnowledgeBase:
      'The conversations I answer from can’t be opened just now. Try again in a little while.',
    yourKeyRejected: 'OpenAI rejected your key. Check it in Setup, or forget it there.',
    yourKeyRateLimited: 'OpenAI is rate-limiting your key, or it has run out of credit.',
    keyMalformed: 'That doesn’t look like an OpenAI secret key — they start with “sk-”.',
    keyNeedsHttps: 'Your own key can only be sent over HTTPS.',
    keyNoModel: (model: string) =>
      `Your key works, but it can’t use ${model}, which I answer with.`,
    keyChecks: 'That’s a lot of key checks. Wait a minute, then try again.',
    keyForced: 'This copy runs in demo mode on purpose, so it doesn’t use a key.',
    setupKeysInvalid:
      'One of those doesn’t look like a key: OpenAI keys start with “sk-”, and a cap is a number of dollars.',
    setupWriteFailed: 'I couldn’t write the env file. Check it isn’t read-only, then try again.',
    setupBadStage: 'That isn’t a step I can run from here.',
    setupBusy: 'Another step is still running. Wait for it to finish.',
    setupNeedsOpenAI: 'Save an OpenAI key first: embedding runs on it.',
    setupNeedsYouTube: 'Save a YouTube key first: linking videos runs on it.',
    setupOverBudget: (estimate: string, cap: string) =>
      `Embedding would cost about ${estimate}, over your ${cap} limit. Nothing was spent.`,
    interviewBroken: 'That interview couldn’t be read. Start it again?',
    interviewSlow: 'That’s a lot of answers at once. Take a breath, then send that again.',
    needsKey: (limit: number) =>
      limit === 0
        ? 'This copy’s key doesn’t answer free questions. To ask, add your own OpenAI key: it stays in your browser, encrypted, and goes only to this site.'
        : `You had ${limit === 1 ? 'one free question' : `${limit} free questions`} on this copy’s key. To keep going, add your own OpenAI key: it stays in your browser, encrypted, and goes only to this site.`,
    shareSlow: 'That’s a lot of shared links at once. Wait a moment, then open it again.',
    shareGone:
      'The conversation that answer quoted is no longer in my knowledge base, so I won’t show it.',
    shareBroken: `That link was changed, cut short or made by another copy of ${brand.name}, so I won’t open it.`,
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
    noKnowledge: 'No conversations are loaded here yet, so there’s nothing to browse for now.',
  },
  /** Free questions on the operator's key (P8-02). */
  free: {
    left: (n: number) => (n === 1 ? '1 free question left' : `${n} free questions left`),
    useOwnKey: 'Use your own key',
  },
  turn: {
    demoTag: 'Demo fixture: not AI-generated or source-verified',
    spokenHeading: 'What I’d say out loud',
    spokenNote: 'The written answer carries the sources.',
    stopped: 'You stopped me there. Ask again any time.',
    retry: 'Try again',
    complete: 'Answer complete.',
  },
  share: {
    tag: 'Shared with you',
    copyLink: 'Copy link',
    copied: 'Link copied',
    copiedBody: 'It opens this answer with every source, word for word.',
    saveImage: 'Save image',
    saving: 'Drawing…',
    imageFailed: 'Couldn’t draw the image. Copy the link instead.',
    note: 'The link carries your question and this answer. Nothing is stored on a server.',
    openedTitle: 'An answer someone shared with you',
    openedBody: `${brand.name} wrote it, word for word — a shared link can’t be edited. Ask your own question below.`,
    failedTitle: 'That shared link didn’t open',
    cardSources: 'Sources',
    cardFooter: (host: string) => `${host}: every claim links to the moment it was said`,
    fileName: 'dear-steven-answer.png',
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
    previewVerified: 'Verified speaker',
    previewOpen: 'Click to open the source',
    label: (who: string, time: string, note: string, spoken: string) =>
      `${who}, ${time}. ${note}, at ${spoken}. Open source.`,
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
    watchFrom: (moment: string) => `Watch on YouTube at ${moment.replace(' ', '\u00a0')}`,
    newTab: ' — opens YouTube in a new tab',
    unmatched: 'No video matched yet',
    fixture: 'No video in demo mode',
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
    asr: 'Automatic transcription, so it may contain errors.',
    unverifiedNote: 'The passage is real, but the transcript doesn’t say who was speaking.',
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
    notLinked: 'This episode isn’t linked to its YouTube video yet.',
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
      'Streams once you press play, from the podcast’s host by way of the publisher’s ad-measurement services. Ads the host inserts can shift the moment by a few seconds.',
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
      forced: 'Not used: `DEAR_STEVEN_DEMO=1` is forcing demo mode.',
      noCap:
        'Not used: a production server spends it only under a daily cap, so answers are demo fixtures. Set `DEAR_STEVEN_DAILY_BUDGET_USD` and restart, or paste your own key below.',
      found: 'Found on the server. It never reaches the browser. You can use your own key instead.',
      missing:
        'Missing — answers are demo fixtures. Paste your own key below, or add `OPENAI_API_KEY` to `.env` at the repository root and restart.',
    },
    ownKey: {
      label: 'Your OpenAI key',
      using: (remembered: boolean): string =>
        remembered
          ? 'Using your key, kept encrypted on this device for 30 days, or until you forget it.'
          : 'Using your key, kept encrypted in this tab until you close it.',
      remember: 'Remember on this device for 30 days',
      use: 'Test and use',
      testing: 'Testing…',
      forget: 'Forget my key',
      privacy:
        'It stays in this browser, encrypted, and goes only to this site, with your requests. The server uses it for that request and never stores or logs it. Safest: a project key with a monthly budget.',
      insecure: 'Your own key can only be used over HTTPS.',
      failed: 'I couldn’t check that key just now. Try again?',
      noStorage: 'Your key works, but this browser isn’t letting me keep it, so I can’t use it.',
    },
    kb: {
      title: 'Knowledge base',
      error: (detail: string) => `The database could not be opened: ${detail}`,
      none: 'No database yet. Start with `pnpm ingest discover`, then `pnpm ingest transcribe --from vtt --limit 20`.',
      ready: (episodes: number, passages: number, lastRun: string | null) =>
        `${s(episodes, 'episode', 'episodes')} and ${s(passages, 'passage', 'passages')} indexed${lastRun ? `; last run ${lastRun}` : ''}.`,
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
    guided: {
      title: 'Set up this machine',
      intro:
        'Started with `pnpm dev:setup`, so this panel can save your keys and build the knowledge base. It works only on this machine, and only until the server stops.',
      keysHeading: 'Keys',
      openai: 'OpenAI API key',
      youtube: 'YouTube Data API key',
      budget: 'Daily cap on answer spend, in dollars',
      saved: 'Saved — leave empty to keep',
      notSaved: 'Not saved yet',
      save: (file: string) => `Save to ${file}`,
      saving: 'Saving…',
      savedNote: (file: string) =>
        `Saved to ${file}. Keys are never shown again, here or anywhere.`,
      buildHeading: 'Knowledge base',
      newest: 'Newest episodes to add',
      build: 'Fetch transcripts',
      buildNote: 'Free: the podcast’s own transcripts from its RSS feed, split into passages.',
      latestHeading: 'New episodes',
      latest: 'Bring in new episodes',
      latestNote: (cap: string) =>
        `Only what was published since your last run: transcripts, passages, embeddings for at most ${cap}, and video links. To keep up on a schedule, run \`pnpm ingest latest\` (see \`docs/INGESTION.md\`).`,
      latestNoteFree:
        'Only what was published since your last run, free: transcripts and passages, found by keyword until an OpenAI key embeds them. To keep up on a schedule, run `pnpm ingest latest` (see `docs/INGESTION.md`).',
      embedHeading: 'Semantic search',
      estimate: (passages: number, cost: string) =>
        `${s(passages, 'passage', 'passages')} waiting, about ${cost} with OpenAI.`,
      nothingToEmbed: 'Nothing waiting to be embedded.',
      cap: 'Spend at most, in dollars',
      embed: (cost: string) => `Embed for about ${cost}`,
      needsOpenAI: 'Save an OpenAI key first.',
      youtubeHeading: 'YouTube moments',
      link: 'Link videos',
      linkNote: 'Free within YouTube’s daily quota.',
      needsYouTube: 'Save a YouTube key first.',
      stages: {
        discover: 'Reading the feed',
        transcribe: 'Fetching transcripts',
        chunk: 'Splitting into passages',
        index: 'Embedding',
        'match-youtube': 'Linking videos',
        latest: 'Bringing in new episodes',
      },
      progress: 'Progress',
      running: (stage: string) => `${stage}…`,
      failed: (stage: string) =>
        `${stage} stopped with an error (see the progress). Every step can be run again.`,
      finished: 'Done.',
      spent: (cost: string) => `${cost} recorded by paid steps so far.`,
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
    isNew: 'New',
    /** A conversation's summary (P8-04). */
    summary: {
      open: 'Summary',
      openLabel: (title: string) => `Summary of “${title}”`,
      back: 'All conversations',
      loading: 'Loading the summary…',
      loadError: 'I couldn’t load that summary just now.',
      none: 'There’s no summary of this conversation yet.',
      about: 'About this conversation',
      machine: 'Machine-written',
      topics: 'Topics',
      moments: 'Most interesting moments',
      exchanges: 'Questions and answers',
      question: 'Question',
      answer: 'Answer',
      unverified: 'Speakers not verified',
      at: (time: string) => `Open the moment at ${time}`,
      original:
        'The overview, topics and labels are machine-written. Every quote is the conversation’s own words, in the original English.',
    },
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
    data: 'Questions, with the conversation so far, are sent to the server and to OpenAI to compose an answer. This server doesn’t store them unless whoever runs this copy switches on answer logging for evaluation; OpenAI may keep what it receives for a while under its own terms. The microphone is only used while you hold or toggle it, or, in a spoken conversation you start, while it’s your turn to speak. Short, attributed quotations link back to the original episodes; full transcripts are never published. The video player and the podcast audio load only when you press play: the video from YouTube, the audio from the podcast’s host by way of the publisher’s ad-measurement services. If you pick a language, a small cookie remembers it so the page opens in that language. If you paste your own OpenAI key, it stays in this tab (or on this device, if you ask) and goes only to this site with your requests; the server never stores or logs it. A share link carries the question and the answer inside the link itself; nothing about it is stored on the server, and opening one only asks the server to check that it wrote that answer. Voice settings — and, only if you switch it on, the conversation itself — are kept in this browser only, until you forget them.',
    fullVersion: 'The full version, with what is and isn’t promised:',
    legal: 'Who runs this copy, and how to reach them:',
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
    talkAloud: 'Read talk replies aloud',
    talkAloudNote:
      'In Talk, Dear Steven answers out loud, after your first click or key press. Turn this off to read the replies instead.',
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
  /** The pages for an unknown address and for a crash (P10-09). */
  fallback: {
    notFound: {
      eyebrow: 'Page not found',
      title: 'There’s nothing here.',
      body: 'This address doesn’t lead anywhere I know. Head back and ask me something instead.',
      home: 'Ask me something',
    },
    crash: {
      eyebrow: 'Error',
      title: 'Something broke on my end.',
      body: 'It wasn’t anything you did. Try again, or start a new conversation.',
    },
  },
  legalPage: {
    title: 'Legal notice',
    operatorHeading: 'Who runs this copy',
    email: 'Email',
    contactHeading: 'Takedown and privacy requests',
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
