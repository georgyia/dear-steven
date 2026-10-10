# H-09 — Inputs for the "Hey Steven" wake-word spike

**Unblocks:** P5-08 (spike: wake word in the browser)
**Start when:** you want "Hey Steven" evaluated, and you are happy to record your own voice

The spike has to report real false-accept and false-reject numbers. Two of its inputs can't be
produced by an agent without making the result meaningless:

- **A trained model.** openWakeWord trains a custom phrase from synthetic speech (its "Training
  New Models" notebook, linked from the openWakeWord README). It needs a GPU — a local one, or
  Google Colab, which means signing in with a Google account.
- **Evaluation audio from real people.** Synthetic positives are fine for training. For testing
  they would grade the model on its own training distribution.

Everything below stays in `data/` (gitignored). Never commit recordings.

## Steps

1. **Train the model.** Open the openWakeWord training notebook, set the target phrase to
   `hey steven`, keep the defaults, and run it. Download the exported ONNX model to
   `data/wakeword/hey_steven.onnx`.
2. **Record positives** (about 5 minutes, mono, 16 kHz WAV) in
   `data/wakeword/eval/positives-<name>.wav`:
   - at least 2 people, 25+ "Hey Steven"s each, 3–4 seconds apart;
   - mix normal voice, quiet voice, an arm's length from the laptop, and a few across the room;
   - write down the exact count per file.
3. **Record negatives** (15 minutes or more) in `data/wakeword/eval/negatives.wav`: ordinary
   conversation, a TV or radio in the background, and at least 5 minutes of the podcast itself,
   which says "Steven" constantly. That is the hardest case for false accepts.
4. Note the microphone and the room (e.g. "MacBook built-in mic, kitchen, extractor fan on").

## Verify

```bash
ls -la data/wakeword/hey_steven.onnx
for f in data/wakeword/eval/*.wav; do
  printf '%s ' "$f"; ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"
done
```

The model exists, the positive files total about 5 minutes, and the negatives total 15 minutes or
more.

## Fallback

Skip it. P5-08 stays parked and push-to-talk (`M`, or hold the mic) remains the only way to
start listening. Nothing else depends on the wake word.

## Tell the agent

> H-09 done. Model at `data/wakeword/hey_steven.onnx`. Positives: __ utterances from __ people
> (__ min). Negatives: __ min (sources: …). Mic and room: ….
