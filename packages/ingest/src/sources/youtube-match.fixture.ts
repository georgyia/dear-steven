/**
 * Recorded from the public YouTube Data API (DOAC uploads) and the official RSS feed on 2026-10-10,
 * for the matcher tests. Metadata only: titles, dates, running times and the chapter lists from the
 * descriptions (trimmed to their first eight chapters; the prose is dropped). No transcript text.
 * Episode ids are renamed; video ids are real so the expectations can be checked by hand.
 */
export const RECORDED_EPISODES = [
  {
    id: 'ep_vance',
    title: 'Vice President JD Vance: No One Saw This Coming, The Ceasefire Is Real!',
    publishedAt: '2026-06-18T05:00:00.000Z',
    durationMs: 6433000,
    guestNames: ['Vice President JD Vance'],
    description:
      "00:00 Intro\n02:38 How Childhood Shaped Who You Became\n05:34 You Were Put Up For Adoption\n06:40 Watching Your Mother's Relationships Up Close\n07:42 How Childhood Trauma Shapes Adults\n10:13 How Addiction Tore The Family Apart\n15:58 Why Empathy Is Missing In Politics\n17:48 Why Politics Turns Opponents Into Villains",
  },
  {
    id: 'ep_hormozi',
    title:
      'The Man Who Made $100M Before 32: The Secret Was To Stop Letting Them Control Me | Alex Hormozi',
    publishedAt: '2026-07-20T05:00:00.000Z',
    durationMs: 8525000,
    guestNames: ['Alex Hormozi'],
    description:
      '00:00:00 Intro00:02:12 How To Use AI As An Entrepreneur00:04:40 Where Will Value Come From In An AI World?00:06:52 How To Generate Great Ideas In The Age Of AI00:08:16 Why Long-Term Thinking Wins In Business00:13:18 Why Most Businesses Never Reach  Million00:18:10 How To Price Your Product Or Service00:19:27 The Biggest Hiring Mistakes Founders Make',
  },
  {
    id: 'ep_ferriss',
    title:
      'Tim Ferriss: 4 Science-Backed Tools That Rewired Decades of Childhood Trauma & Depression',
    publishedAt: '2025-11-13T06:00:00.000Z',
    durationMs: 4158000,
    guestNames: ['Tim Ferriss'],
    description:
      '[00:00] Intro  \n[02:45] My Mission: Simplify Complex Ideas  \n[03:36] Framework for Fast Learning  \n[08:00] Choosing the Right Projects  \n[10:21] Importance of Small Steps for Big Results\n[12:46] Why Humans Need Purpose \n[15:45] Tim’s Sexual Abuse Story\n[25:48] How People Deal With Trauma',
  },
  {
    id: 'ep_retitled',
    title:
      'Financial Crash Expert: He Predicted The 2008 Crash, Now He Says Capitalism Failed, It’s Too Late!',
    publishedAt: '2026-08-20T05:00:00.000Z',
    durationMs: 5626000,
    guestNames: [],
    description:
      '00:00:00 Intro00:02:05 We\'re on the Road to Civil Unrest00:08:04 Where This Leads: Unrest and Violence00:11:11 I Grew Up in the Soviet Union00:12:12 Steve Keen: Capitalism Is About to Fail00:20:49 "We\'re Not Spending Enough"00:23:58 Should Britain Drill in the North Sea?00:28:39 "You Can\'t Defend Yourself Against This"',
  },
  {
    id: 'ep_bellew',
    title: 'Tony Bellew: Nothing Made Me Happy Until I Found This',
    publishedAt: '2022-06-30T05:00:00.000Z',
    durationMs: 5029000,
    guestNames: ['Tony Bellew'],
    description: '',
  },
  {
    id: 'ep_grylls',
    title: 'Bear Grylls: Man VS Failure, Anxiety & Imposter Syndrome',
    publishedAt: '2022-06-27T05:00:00.000Z',
    durationMs: 4319000,
    guestNames: ['Bear Grylls'],
    description: '',
  },
  {
    id: 'ep_moment',
    title: 'Most Replayed Moment: This Is The Best Exercise Protocol For Women!',
    publishedAt: '2026-05-08T05:00:00.000Z',
    durationMs: 1797000,
    guestNames: [],
    description: '',
  },
] as const;

export const RECORDED_VIDEOS = [
  {
    videoId: '5cKDs7bIGPE',
    title: 'Vice President JD Vance: They Tricked Me About Trump, I Was Wrong!',
    publishedAt: '2026-06-18T07:00:08Z',
    durationMs: 6465000,
    description:
      "00:00:00 Intro\n00:02:58 How Childhood Shaped Who You Became\n00:05:54 You Were Put Up For Adoption\n00:07:00 Watching Your Mother's Relationships Up Close\n00:08:02 How Childhood Trauma Shapes Adults\n00:10:33 How Addiction Tore The Family Apart\n00:16:18 Why Empathy Is Missing In Politics\n00:18:07 Why Politics Turns Opponents Into Villains",
  },
  {
    videoId: 'maUz94PYgRI',
    title: "'THEY LIED ABOUT TRUMP'",
    publishedAt: '2026-06-19T16:20:17Z',
    durationMs: 127000,
    description: '',
  },
  {
    videoId: 'HwmwyBgzj8c',
    title: 'Alex Hormozi’s Warning: Stop Chasing AI, Build This Instead!',
    publishedAt: '2026-07-20T07:00:15Z',
    durationMs: 8558000,
    description:
      '00:00:00 Intro\n00:02:33 How To Use AI As An Entrepreneur\n00:05:00 Where Will Value Come From In An AI World?\n00:07:12 How To Generate Great Ideas In The Age Of AI\n00:08:36 Why Long-Term Thinking Wins In Business\n00:13:38 Why Most Businesses Never Reach $10 Million\n00:18:30 How To Price Your Product Or Service\n00:19:47 The Biggest Hiring Mistakes Founders Make',
  },
  {
    videoId: 'xurHeoN3V5E',
    title: 'NO MORE AI BUSINESSES!',
    publishedAt: '2026-07-20T19:00:01Z',
    durationMs: 97000,
    description: '',
  },
  {
    videoId: 'GFyijjy1KdU',
    title: 'Tim Ferriss: The Hidden Nerve That Controls Trauma, Mood & Emotional Pain!',
    publishedAt: '2025-11-13T08:00:28Z',
    durationMs: 4146000,
    description:
      '00:00 Intro  \n02:33 My Mission: Simplify Complex Ideas  \n03:23 Framework for Fast Learning  \n07:47 Choosing the Right Projects  \n10:09 Importance of Small Steps for Big Results  \n12:34 Why Humans Need Purpose  \n15:32 Tim’s Sexual Abuse Story  \n25:35 How People Deal With Trauma',
  },
  {
    videoId: '6elyIOzFD0I',
    title: 'HOW TO HAVE MEANINGFUL CONVERSATIONS',
    publishedAt: '2025-11-14T21:00:14Z',
    durationMs: 46000,
    description: '',
  },
  {
    videoId: 'Y43T7VQGtOs',
    title:
      'Konstantin Kisin’s WARNING: Our Leaders Have Lost Control, We’re Headed For Conflict And Violence!',
    publishedAt: '2026-08-20T07:00:57Z',
    durationMs: 5640000,
    description:
      '00:00:00 Intro\n00:02:25 We\'re on the Road to Civil Unrest\n00:08:24 Where This Leads: Unrest and Violence\n00:11:31 I Grew Up in the Soviet Union\n00:12:32 Steve Keen: Capitalism Is About to Fail\n00:21:09 "We\'re Not Spending Enough"\n00:24:18 Should Britain Drill in the North Sea?\n00:28:59 "You Can\'t Defend Yourself Against This"',
  },
  {
    videoId: 'RXKGidkP0ho',
    title: 'HEATED DEBATE BETWEEN CAPITALIST & SOCIALIST',
    publishedAt: '2026-08-20T19:00:27Z',
    durationMs: 90000,
    description: '',
  },
  {
    videoId: 'Kj5yp0PrfqA',
    title: 'Tony Bellew: Nothing Made Me Happy Until I Found This | E156',
    publishedAt: '2022-06-30T05:00:12Z',
    durationMs: 5115000,
    description:
      '00:00 Intro\n01:22 What are the most pivotal moments of your childhood?\n09:05 Racism & its impact on you\n13:48 Your relationship with your father & his prison years\n23:06 Street life & lack of role models\n30:36 The death of your first trainer & his prediction of your success\n37:49 Becoming a world champion\n50:49 How much boxers actually make\n56:24: Chimp Paradox',
  },
  {
    videoId: 'V6mZJRb9MZY',
    title: 'Bear Grylls: Man VS Failure, Anxiety & Imposter Syndrome | E155',
    publishedAt: '2022-06-27T05:00:10Z',
    durationMs: 4467000,
    description:
      '00:00 Intro\n01:28 Confidence \n08:08 Imposter syndrome\n14:27 Resilience\n20:01 When to quit\n23:26 Are we always chasing a bigger challenge?\n27:22 Finding your faith\n32:37 Climbing Everest was humbling',
  },
  {
    videoId: 'XmTywJQA2fs',
    title: 'COMFORT IS COSTING YOU EVERYTHING',
    publishedAt: '2026-05-08T19:35:00Z',
    durationMs: 114000,
    description: '',
  },
] as const;
