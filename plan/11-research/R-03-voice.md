# R-03 — What voice interaction is feasible in a browser?

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | P4-*, P5-08 |

## Question

Can "Hey Steven" work in a browser, and what is a reliable, privacy-conscious default?

## Findings

- Web Speech `SpeechRecognition`: Chrome / Edge (server-based; on-device via `processLocally`
  where available), Safari (`webkitSpeechRecognition`, gesture-bound, can hang after audio
  playback). **Firefox has none.** Chrome Android behaves poorly with `continuous`.
- `MediaRecorder` is universal (webm/opus; Safari mp4) → server STT (`gpt-4o-mini-transcribe`).
- Autoplay: audio must start from a user gesture; iOS needs an `AudioContext` resumed in that
  gesture — playing decoded audio through Web Audio is the reliable path.
- **On-device recognition crashes some Chromium builds** (found in P5-07): in headless Chromium
  156, `SpeechRecognition.available({ langs, processLocally: true })` kills the tab. Google
  Chrome ships the speech component; other Chromium builds may not. So it is probed only in
  Google Chrome (`userAgentData` brands) and only on demand.
- Wake words: Picovoice's free tier ended (June 2026); openWakeWord runs in the browser via ONNX
  but needs a custom "Hey Steven" model, an always-open mic, and a visible indicator. Background
  listening is unreliable across tabs and mobile.
- OpenAI `gpt-4o-mini-tts` offers stock voices with style instructions; announced retirement in
  Jan 2027 — keep the TTS behind an interface.

## Decision

- Default: **push-to-talk / tap-to-toggle** on the VoicePill, `M` from anywhere.
- Input: Web Speech when present → MediaRecorder + `/api/transcribe` when not, or after a Web
  Speech network failure (`voice/capabilities.ts`, unit-tested decision table).
- Output: `/api/speech` (stock voice, never an imitation) → `speechSynthesis` fallback; replies
  are spoken only after a spoken question or a Listen click.
- Wake word: deferred to P5-08 as an opt-in desktop spike.

## Sources

- MDN Web Speech API, MediaRecorder, Autoplay guide; Chrome on-device speech recognition notes;
  openWakeWord; OpenAI audio docs — as summarised in the approved plan (`01-architecture.md`), 2026-10.
