# H-04 — A clip of the host's voice (for diarization)

**Unblocks:** P2-05 real run (H-05)
**Start when:** you have decided to pay for diarized transcripts

OpenAI's diarization labels a known speaker when given a 2–10 second reference clip. The clip is
used only as a speaker reference on your own machine and is sent only to OpenAI with each
transcription request. It is gitignored and must never be committed or redistributed.

## Steps

1. Pick a recent full episode and a stretch of 4–8 seconds where **only Steven** speaks, with no
   music and no overlap (the first question after the intro is usually good).
2. Cut it from the cached or downloaded episode audio:
   ```bash
   mkdir -p data/voiceprints
   ffmpeg -ss 00:05:12 -t 6 -i <episode.mp3> -ac 1 -ar 16000 data/voiceprints/steven.wav
   ```
3. Listen to it. Re-cut if anyone else is audible.

## Verify

`ffprobe -v error -show_entries format=duration -of csv=p=0 data/voiceprints/steven.wav` prints a
value between 2 and 10.

## Tell the agent

> H-04 done. Host clip at `data/voiceprints/steven.wav`, __ s, cut from "<episode title>".
