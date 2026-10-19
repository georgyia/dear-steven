# Seedance 2.0 prompts (optional B-roll, via Higgsfield)

Written for: the owner, to paste into Higgsfield if they want AI-generated cinematic shots to cut
into the demo. Produced with the `seedance-saas-launch` and `seedance-podcast-visual` skills from
rediumvex/ai-video-generator-claude. The demo video itself does not depend on these.

Rules carried over from the repository: never depict Steven Bartlett, his voice, or the show's
branding; never put words in his mouth; the UI shown is the real app in demo mode. Upload
`docs/assets/home.jpg` as @image1 and `docs/assets/answer-and-evidence.jpg` as @image2, and the mark
`apps/web/src/app/icon.svg` (exported to PNG) as @image3.

---

## Prompt 1 — The hook: a lamp-lit late-night studio (6 s, 16:9)

```
SEEDANCE 2.0 PROMPT:

A small late-night studio, almost dark. One warm practical lamp at frame-right,
2700K, a soft pool of amber light on a wooden desk. A broadcast microphone on a
boom arm, slightly out of focus in the foreground. An empty chair behind the desk.
Deep warm blacks, no blue. Fine film grain. No people, no logos, no text.

0–2s: Camera holds completely static. Dust drifts through the lamp light. Sound:
room tone, a faint electrical hum, nothing else.

2–4.5s: A slow dolly push-in toward the microphone, shallow depth of field racks
from the chair to the microphone's grille. The lamp's warmth intensifies 10%.
Sound: a single low pad note fades in, warm, no melody.

4.5–6s: The push settles on an extreme close-up of the microphone. A tiny ember-
orange indicator light on its base blinks on, once. Sound: a soft click, then hold.

Color grade: warm chiaroscuro, ivory highlights, amber midtones, ink shadows.
Nothing in frame is branded. Platform: 16:9, 1080p.
```

---

## Prompt 2 — The floating stage: the app on a device in the dark (10 s, 16:9)

```
SEEDANCE 2.0 PROMPT:

A MacBook floating in a dark void at a 15-degree angle, screen facing camera,
showing @image1 (the home stage: the wordmark "Dear Steven", a composer with a
microphone, three example questions). Dark-mode showcase: the screen is the only
light source; its warm ivory-and-amber glow spills onto an invisible surface
below, with a soft reflection. A thin rim light from behind separates the device
from black. Subtle volumetric haze. Fine film grain.

0–3s: Camera slowly orbits 20 degrees right. On screen, a cursor moves into the
composer and a question types itself in: "I've been procrastinating on an
important project for weeks. How would you approach it?" Sound: minimal warm
ambient, soft key ticks synced to the typing.

3–6s: The composer glides down the screen; the question becomes a large serif
heading and paragraphs of an answer arrive one by one, with small rounded
citation chips (amber-outlined, ivory, and dashed grey) appearing inside the
text. Sound: a soft swell as the composer glides, a muted tick as each block lands.

6–8.5s: The cursor clicks an amber citation chip. A right-hand panel slides in,
matching @image2 (the evidence inspector: an episode title in serif, "Said by",
a timestamp in monospace, a highlighted transcript span). The screen's glow warms
by 15% as the panel opens. Sound: a soft, deep "drop", no reverb.

8.5–10s: Camera completes a slow push-in until the panel fills 60% of the frame;
the highlighted span is legible. Hold. Sound: the ambient resolves on one chord.

Material references: @image1 for the home stage, @image2 for the answer with the
inspector open, @image3 for the mark. No other text, no other logos, no people.
Platform: 16:9, 1080p.
```

---

## Prompt 3 — Kinetic typography of the one sentence (8 s, 16:9)

```
SEEDANCE 2.0 PROMPT:

Black background, deep warm (#0a0908), fine film grain, a faint amber vignette
at the edges. The type is a soft, high-contrast serif (Fraunces-like), ivory.
No people, no imagery: the words are the visual.

0–1.5s: A single hairline in amber (#e3a857) draws itself across the centre,
left to right. Sound: a quiet pad, one low note.

1.5–3s: "Ask Steven a real question." blurs in word by word, each word
sharpening as it settles, centred above the hairline. Holds 1 s.

3–4.8s: The line dissolves; "Get a thoughtful first-person answer" arrives the
same way. Holds 1 s. Sound: a soft pluck note on the first word.

4.8–7.2s: "whose every claim you can click through" then, on the next line,
"to the exact moment it was said." The words "exact moment" turn amber as they
settle and the hairline thickens under them. Sound: a low bell, warm, with a
long tail.

7.2–8s: Everything but the hairline fades; a small amber "D" mark (@image3)
scales in at the centre with a slight overshoot and settles. Hold.

Pacing: slow, deliberate, every line fully readable before it leaves.
Platform: 16:9, 1080p.
```

---

## How these fit the demo

- Prompt 1 can replace the black opening of Scene 1 (the sentence then plays over it).
- Prompt 2 is an alternative to Scene 3, if the owner prefers a device shot to a flat capture.
- Prompt 3 is a stylised variant of Scene 1 for a vertical cut (change "16:9" to "9:16").

Cost and accounts are the owner's call: Higgsfield is a paid service and nothing in this folder
calls it.
