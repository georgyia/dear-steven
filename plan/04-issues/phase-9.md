# Phase 9 — Spoken conversations (M7)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-14 | milestone M7 |

**Exit:** in Talk and in an interview you can simply talk. One tap starts a spoken conversation.
You speak, and when you pause your words go. Steven answers aloud as soon as his reply has passed
its checks, then he's listening again, until you end it. What you hear is exactly what you can
read, with its sources, in the transcript above.

The owner's request (2026-10-14): *"the talk and the interview should be conversational, like
speech to speech, it should answer directly in audio, like i am talking."*

Issues are grouped by category; each category is a label on GitHub.

| Category | Label | Issues |
|----------|-------|--------|
| Voice | `track:voice` | P9-01, P9-02, P9-03 |

**Why not a speech-to-speech model.** OpenAI's Realtime models listen and speak in one step, and
answer fastest. But what they say reaches the listener before anything can check it. A spoken
claim couldn't be validated, cited or downgraded, and attributions couldn't be held to the four
kinds of statement. That breaks the product's one rule (AGENTS.md §2 and §5, `docs/PERSONA.md`).
Here, speech recognition hears you, the same answer pipeline writes and checks each part of the
reply, and a stock voice reads exactly the part that passed. Then the browser takes turns for
you. Latency is spent only where the checks need it.

---

## Voice

### P9-01 — feat(voice): Steven starts answering out loud as soon as his reply is checked

<!-- issue {"id":"P9-01","title":"feat(voice): Steven starts answering out loud as soon as his reply is checked","labels":["type:ui","stage:m7","track:voice","track:web","track:core","owner:ai","risk:medium","P1","size:M"],"milestone":"M7 Spoken conversations","depends":[],"github":86} -->

#### Context
In Talk, a spoken reply plays only once the whole answer is finished. The model writes the
blocks, then the evidence list, then a separate `spoken` version and the caveats. Only then does
the browser ask `/api/speech` for an MP3, download all of it and decode it. Two things follow:

- **It's slow.** The reply is on screen long before it is heard. The first block arrives in
  about 3.5 s at the median (STATUS, P6-06); the voice starts seconds after that.
- **What you hear isn't what you read.** `spoken` is written by the model and never validated.
  It can say more or less than the checked text on screen, or attribute differently.

#### Goal
In Talk, Steven's voice starts as soon as the first part of his reply has passed validation. What
it says is exactly that part's text.

#### Scope
**In**
- What is said aloud for a block, decided in one place in core (`speakable`, client-safe):
  a paragraph or takeaway is its segments' text; a quote is its lead and the stored words.
- In Talk, every validated block is read aloud as it arrives (`block.done`), in order. The Listen
  button on a talk reply reads the same text. `spoken` is no longer read in Talk.
- `/api/speech` streams raw 24 kHz PCM, and the browser plays it as it arrives (Web Audio, so it
  works on iOS). The next part is fetched while the current one plays. Any failure falls back to
  the browser's own voice, as today.
- Stopping (Esc, Stop, a new question, the mic) silences everything queued.
- Measured: time from sending a talk question to the first sound, before and after, on the real
  model (a few cents), recorded on the board.

**Out:** hands-free turn-taking (P9-02), the interview (P9-03). Ask mode keeps reading `spoken` at
the end.

#### Acceptance criteria
- [ ] In Talk, the first speech request is made before the answer's `final` event (e2e, against
  the fake OpenAI).
- [ ] The words read aloud are the reply's text on screen, block by block (e2e, both voices).
- [ ] PCM split at any byte, including mid-sample, plays the same samples (unit).
- [ ] Parts play in the order they were queued, even when a later one arrives first; Stop silences
  them all and nothing queued plays afterwards (unit).
- [ ] A failed or refused speech request (free questions, the spend cap, 429) is read by the
  browser's voice instead, with no gap in the conversation.
- [ ] Time to first sound is lower, measured as above.

#### Tests required
Unit: `speakable` for each block kind; PCM decoding across chunk boundaries; the playback queue
(order, stop, fallback). Route: `/api/speech` returns `audio/pcm` and is still refused on free
questions and over the cap. E2E: speech starts before `final`; spoken text equals the shown text.

#### Security notes
`/api/speech` keeps its limits (SR-07, 10 a minute), the free-question refusal (SR-02) and the
spend cap. One talk reply is usually one block, so one request. The stock voice rule is unchanged:
never an imitation of Steven Bartlett's voice.

#### Skills to consult
`dear-steven-architecture`, `dear-steven-persona` (spoken replies), `dear-steven-security`,
frontend design skills.

#### Dependencies
None. **Size:** M.

---

### P9-02 — feat(voice): talk hands-free — Steven listens, answers out loud, and listens again

<!-- issue {"id":"P9-02","title":"feat(voice): talk hands-free — Steven listens, answers out loud, and listens again","labels":["type:ui","stage:m7","track:voice","track:web","track:design","owner:ai","risk:medium","P1","size:L"],"milestone":"M7 Spoken conversations","depends":["P9-01"],"github":87} -->

#### Context
Talk is push-to-talk today: tap the mic, speak, tap again, wait, and tap again for the next
thing you want to say. That's a walkie-talkie, not a conversation.

#### Goal
One tap starts a spoken conversation. You talk, and when you pause your words are sent. Steven
answers aloud, then he's listening again, with no tap in between, until you end it.

#### Scope
**In**
- In Talk, the mic starts a conversation. While it runs, a conversation bar takes the
  composer's place. It shows the state (Listening, Thinking, Steven speaking) and your words as
  you say them, with Interrupt and End. The transcript keeps building above, with its chips.
- Turn-taking in the browser, pure and unit-tested:
  - Your turn ends after a pause, about 0.9 s after your last word.
  - Silence before you've said anything sends nothing.
  - With the browser's speech recognition, its interim results drive the pause.
  - Without it (Firefox, so server transcription), a level detector on the microphone finds
    speech and the pause. Nothing is uploaded unless you spoke.
- Half duplex. The mic is closed while Steven speaks, so his voice is never taken for yours.
  Tapping (or Space) interrupts him, and it's your turn.
- The microphone (SR-10, updated):
  - It opens only inside a conversation you started, and only while it's your turn.
  - It closes when you end it, when the tab is hidden, and after 30 s in which you say nothing.
    The conversation then pauses: "Tap to keep talking".
- Errors pause the conversation with their message; they never loop. When the free questions
  run out, the conversation ends with "Use your own key".
- Keyboard: M starts and ends, Space interrupts, Esc ends. Focus moves into the bar and back.

**Out**
- Interrupting him by voice while he speaks. Browsers don't promise to cancel the page's own
  audio from the microphone, so his voice through the speakers could interrupt him. With
  headphones it would work; a follow-up if wanted.
- The interview (P9-03). Ask keeps push-to-talk.

#### Acceptance criteria
- [ ] One tap, then two spoken exchanges, with no further tap: each question is sent after the
  pause, each reply is read aloud, and listening resumes after each reply (e2e, scripted
  recognition).
- [ ] A pause shorter than the threshold doesn't cut you off; silence alone never sends anything
  (unit, and e2e on the recorder path with a fake microphone).
- [ ] The microphone is released on End, on a hidden tab, and after 30 s of silence, and is never
  open while Steven speaks (e2e: track state and recognition calls).
- [ ] Interrupt stops his voice at once and starts listening (e2e).
- [ ] Out of free questions, the conversation ends with "Use your own key" (e2e, free server).
- [ ] 375 px and 1280 px, keyboard only, reduced motion (no pulsing), axe clean in each state, in
  English and German, no "·".

#### Tests required
Unit: turn-taking decisions (pause, nothing on silence, idle pause, interrupt); the level
detector on synthetic levels; the conversation loop's state machine. E2E: the loop with scripted
recognition; the recorder path with a generated fake-microphone file; mic release; free
questions; axe.

#### Security notes
SR-10 changes from "opened only on press or toggle" to "opened only inside a conversation the
visitor started, only while it's their turn". The closing rules above are its negative tests.
Each spoken question is a question: rate limits, free-question counting and the spend cap apply
as for typed ones.

#### Skills to consult
`dear-steven-security` (mandatory), differential review, `dear-steven-architecture`, frontend
design skills, `docs/DESIGN.md`.

#### Dependencies
P9-01. **Size:** L.

---

### P9-03 — feat(voice): the interview, spoken — Steven asks aloud, you answer aloud, and he moves on when you've finished

<!-- issue {"id":"P9-03","title":"feat(voice): the interview, spoken — Steven asks aloud, you answer aloud, and he moves on when you've finished","labels":["type:ui","stage:m7","track:voice","track:web","track:conversation","owner:ai","risk:medium","P1","size:M"],"milestone":"M7 Spoken conversations","depends":["P9-02"],"github":88} -->

#### Context
An interview reads its next question aloud only after an answer given by voice, and every answer
still needs two taps. A real interview is spoken from start to finish.

#### Goal
Start the interview's mic once. Steven reads the question, listens to your answer, and when
you've finished he asks the next one, until the interview ends.

#### Scope
**In**
- The interview's mic starts the same conversation as Talk (P9-02). Steven reads the question on
  screen, then listens.
- An answer ends after a longer pause than in Talk (about 2 s), since people stop to think in
  the middle of an answer. The pause is set per mode, in one place.
- Skip, Finish and End stay as buttons. Skip asks the next question aloud.
- When the interview ends (What I learned, the debrief, or a closing reply), the conversation
  ends and the mic closes. Those stay on screen to read.
- Free questions: a whole interview still counts as one.

**Out:** reading What I learned or the debrief aloud.

#### Acceptance criteria
- [ ] Each question is read aloud and its answer heard with no tap in between, for two questions
  (e2e).
- [ ] A 1.2 s pause in the middle of an answer doesn't end it (unit and e2e).
- [ ] The mic closes when the interview ends, and on End (e2e).
- [ ] Axe clean, 375 px and 1280 px, English and German.

#### Tests required
Unit: the interview's pause settings in the turn-taking tests. E2E: a spoken interview against
the demo interviewer.

#### Security notes
As P9-02 (SR-10). No new route or paid call.

#### Skills to consult
`dear-steven-security`, `dear-steven-architecture`, frontend design skills.

#### Dependencies
P9-02. **Size:** M.
