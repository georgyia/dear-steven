# Phase 4 — Voice (M2)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | milestone M2 |

**Exit:** speak to Steven; hear him back; nothing breaks without a mic. Playwright with a fake
microphone; Firefox path uses server STT; permission denial recoverable; TTS never auto-plays
without a user gesture; spoken summaries in the same persona.

---

### P4-01 — feat(voice): microphone — Web Speech, recorder fallback and /api/transcribe

<!-- issue {"id":"P4-01","title":"feat(voice): microphone — Web Speech, recorder fallback and /api/transcribe","labels":["type:ui","stage:m2","track:voice","owner:ai","risk:medium","P0","size:L"],"milestone":"M2 Voice","depends":["P3-05"],"github":null} -->

**Result:** `lib/voice/{capabilities,recognition,recorder,useVoice}.ts`, `components/voice/VoiceControl.tsx`
(VoicePill with live level meter, tap / hold / slide-to-cancel, Magnet on desktop), `M` and `Esc`,
interim transcript in the composer, `/api/transcribe` (≤ 8 MB, MIME allow-list, never stored),
`core/openai/voice.ts`. Stage machine: requestingMic → listening → transcribing. Unit tests for
the voice-path decision table. **State:** done.

---

### P4-02 — feat(voice): spoken replies — TextToSpeech, Listen, Written / Spoken

<!-- issue {"id":"P4-02","title":"feat(voice): spoken replies — TextToSpeech, Listen, Written / Spoken","labels":["type:ui","stage:m2","track:voice","owner:ai","risk:medium","P0","size:M"],"milestone":"M2 Voice","depends":["P4-01"],"github":null} -->

**Result:** `lib/voice/speaker.ts` (`/api/speech` → Web Audio, unlocked in the gesture;
`speechSynthesis` fallback), `/api/speech` (stock voice), `SpokenControls` (Listen with a
breathing ember ring; RubberSegment Written / Spoken view), `speaking` state in the machine.
Auto-speak only after a spoken question. **State:** done.

---

### P4-03 — test(voice): voice end-to-end with a fake microphone

<!-- issue {"id":"P4-03","title":"test(voice): voice end-to-end with a fake microphone","labels":["type:test","stage:m2","track:voice","owner:ai","risk:low","P0","size:S"],"milestone":"M2 Voice","depends":["P4-02"],"github":null} -->

**Result:** `e2e/voice.spec.ts` (desktop + mobile): ask by voice and hear the reply; typed questions
are never read aloud (and no `/api/speech` request); Listen works on request; Firefox path records
and uploads to `/api/transcribe`; a blocked mic is explained and typing still works.
**State:** done.
