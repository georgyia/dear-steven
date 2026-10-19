# Brag Plan: Dear Steven — demo video

Written for: anyone the owner wants to show the product to (friends, collaborators, the show's team,
potential contributors). They have never seen it. After one viewing they should know what it does,
what makes it different, and that it is an unofficial fan project.

## What is this app?

An AI persona that answers a real question in the first person, from a local index of real episode
transcripts, and links every claim to the exact passage and moment it came from.

## The angle

*Receipts.* Every AI product talks. This one shows its sources: the verbatim passage, who said it,
the surrounding transcript, the minute in the episode. The video is built around one click: a
citation chip opening the evidence inspector.

## Hook (first 4 seconds)

The one sentence the whole repository serves, in three beats of display serif on black:
"Ask Steven a real question." / "Get a thoughtful first-person answer" / "whose every claim you can
click through to the exact moment it was said."

## Key moments (the middle)

1. The stage: typing a real question into the composer, Enter, the composer glides to the dock.
2. The answer streams block by block, with citation chips.
3. Four kinds of statement, kept apart (the README's own list, drawn as the real chip styles).
4. The click: hover preview, chip, inspector: Quote (highlighted span), Context (surrounding
   transcript with timestamps), next source.
5. How it is checked: "The model never writes citations." The server validates every block.
6. Talk and Interview me, briefly.

## Outro / punchline

"An AI persona with receipts." Then how to run it: `pnpm install · pnpm dev`, and the disclosure.

## User flow worth showing

Entry (home stage) → key action (ask) → result (answer) → the differentiator (click a chip → the
inspector). Plus Talk and Interview me as the two other ways in.

## Tone

`cinematic` with `polished` restraint: a lamp-lit late-night studio. Deep warm black, ivory, one
ember accent, Fraunces for anything that speaks, Geist Mono for machine labels. Film grain. No
purple/blue gradients, no particles, no sparkle icons, no emoji. Captions over the UI are set like
the app's own eyebrows and pull quotes.

Note on length: `/brag`'s law is 15–25 s for a launch clip. The owner asked for a demo that shows
how it works, so this is a ~80 s demo. A 20 s cut can be made from scenes 1, 2, 6 and 10.

## Format: landscape — 1920x1080, 30 fps
## Duration: ~80 seconds

## Visual identity (from the project)

- Background `#0a0908` (ink-0), stage `#12100e`, raised `#1a1714`, hairlines `#241f1b`
- Text `#f4eee4` (ivory-0), secondary `#cfc6b8`, muted `#a39a8d`
- Accent `#e3a857` (ember-0), hover `#f3c47a`; steel `#8b949e` for machine metadata
- Display: Fraunces (opsz, SOFT) · Body: Geist Sans · Mono: Geist Mono
- Shapes: chips 999px, composer 22px, cards 18px
- Easing `cubic-bezier(.23,1,.32,1)`
- The mark: the wordmark's "D" in ember on ink (`apps/web/src/app/icon.svg`)

## Share copy (draft)

Dear Steven. Ask a real question, get a first-person answer, click any claim through to the moment
it was said. An unofficial AI persona with receipts.

## Audio direction

Music: an original, synthesised bed (no licensed track available offline): warm, slow, cinematic,
~84 BPM, A minor. Soft detuned pad, a sub pulse that enters with the stage, a sparse pluck motif,
a heartbeat kick under the middle, a breakdown under "the model never writes citations", a lift
into Talk/Interview, a held resolution under the outro. Sound effects are written into the same
piece: a low bell on the reveal, filtered-noise swells at scene changes, soft key ticks under
typing, a muted click on the chip, a soft "drop" when the inspector opens. Music 0.35, SFX under it.

Music cue guidance: unavailable as a preset; the synthesiser writes the beat grid itself, so scene
changes sit on bars by construction.

## Storyboard

### Scene 1 — Hook — 5.0s
Black. A hairline in ember draws across the centre (0.0–0.8s). Three beats of Fraunces, each
replacing the last with a soft blur-in: "Ask Steven a real question." (0.8–2.2s) / "Get a thoughtful
first-person answer" (2.2–3.6s) / "whose every claim you can click through to the exact moment it
was said." (3.6–5.0s, held into the reveal).
Sequential/interaction: three lines, one by one.
Audio intent: hush, then intention. Pad only; a low pulse under the third line.
Transition mood: dramatic → Scene 2

### Scene 2 — Reveal — 5.0s (5.0–10.0)
The ember "D" mark scales in with a soft bell. "Dear Steven" in Fraunces (opsz 144) blurs in word
by word, as the real wordmark does. Under it, mono eyebrow: "AN UNOFFICIAL AI PERSONA · NOT STEVEN
BARTLETT · NOT AFFILIATED WITH THE SHOW". Then the line: "An AI persona with receipts."
Sequential/interaction: mark → wordmark → eyebrow → line.
Audio intent: the bell lands with the mark; the pulse begins.
Transition mood: soft dip to black → Scene 3

### Scene 3 — The stage — ~11s (10.0–21.0)
Real UI, recorded: the home stage (wordmark, intro, composer with mic, three example questions,
the honest status pill "Demo mode · fixture answers"). The cursor glides to the composer. The
question is typed: "I've been procrastinating on an important project for weeks. How would you
approach it?" Enter. The composer glides to the dock; the question becomes a serif heading; the
thought line steps through "Searching 3 conversations…".
Caption (bottom-left, eyebrow + line): "01 — ASK" / "Pull up a chair."
Sequential/interaction: typing, Enter, the glide.
Audio intent: soft key ticks under the typing, a swell as the composer glides.
Transition mood: clean cut (the UI keeps running) → Scene 4

### Scene 4 — The answer streams — ~10s (21.0–31.0)
Same recording: blocks arrive one by one: paragraphs, chips, the pull quote behind the ember
hairline, "If I were you" takeaway, the conversation cards. A slow scroll down the answer.
Captions: "It answers in the first person…" / "…from real episode transcripts." / "Every chip is a
citation."
Audio intent: the heartbeat kick enters as the first block lands.
Transition mood: dip through ink → Scene 5

### Scene 5 — Four kinds of statement — 8.0s (31.0–39.0)
Typographic, built from the real chip styles. Title: "Four kinds of statement, kept apart."
Four rows arrive on consecutive bars: [ember chip] "Something the host verifiably said." ·
[ivory chip with the guest's initial] "Something a guest verifiably said." · [dashed steel chip]
"A real passage where the speaker isn't verified." · [softer text, no chip] "The persona's own
reasoning."
Sequential/interaction: four rows, one per bar; each row holds ≥ 1.2 s after landing.
Audio intent: a soft pluck note on each row.
Transition mood: soft → Scene 6

### Scene 6 — The click — ~16s (39.0–55.0)
Real UI: the cursor hovers the first chip (the quote preview tooltip: the words, who, when,
"Click to open the source"). Then it clicks the verified-guest chip. The evidence inspector slides
in: "Verified guest", the episode title, "Said by Demo Guest · Behavioural Scientist", "32:14 in
the podcast", the Quote tab with the highlighted span. Click Context: the surrounding transcript,
timestamps in mono, the span highlighted. Next source (3 of 3). Esc.
Captions: "02 — CLICK ANY CHIP" / "The verbatim passage. Who said it." / "The surrounding
transcript, to the minute." / "And the moment on YouTube, when a video is linked."
Audio intent: muted click, a soft drop when the drawer opens, the music opening up.
Transition mood: dip → Scene 7

### Scene 7 — How it is checked — 8.0s (55.0–63.0)
Typographic. "The model never writes citations." holds. Beneath it, the README's pipeline draws
itself as five mono nodes on a hairline, lighting up in order: Question → Hybrid search (SQLite
FTS5 + sqlite-vec) → Persona prompt, strict JSON → Validate every block → Stream. Line: "The server
checks every citation against the passages it actually retrieved, before the browser sees a word."
Audio intent: breakdown: pad and sub only, then the pulse returns on the last node.
Transition mood: hard cut on the beat → Scene 8

### Scene 8 — Talk, and Interview me — ~12s (63.0–75.0)
Real UI, two recordings. Talk: the RubberSegment flips to Talk; a question; the transcript-style
reply with a chip and Listen. Interview me: "Let me interview you.", one question at a time, the
ember progress hairline, then "Thank you, Alex." and "What I learned about you", each line resting
on the visitor's own words.
Captions: "03 — TALK" / "A quick back-and-forth, out loud if you like." then "04 — INTERVIEW ME" /
"One question at a time. Then what I learned about you, in your own words."
Audio intent: lift; the motif returns.
Transition mood: soft → Scene 9

### Scene 9 — Honest by design — 6.0s (75.0–81.0)
Three short lines, one at a time, mono eyebrow "HONEST BY DESIGN": "It says when it doesn't know."
/ "Demo answers are labelled demo." / "Questions aren't stored. No transcripts ship in the repo."
Audio intent: the resolution chord lands under the first line.
Transition mood: soft → Scene 10

### Scene 10 — Outro — 6.0s (81.0–87.0)
The mark and wordmark. "An AI persona with receipts." Mono: "pnpm install · pnpm dev" and
"PolyForm Noncommercial · built for people and coding agents alike". The disclosure line in small
ivory-2: "Dear Steven is an AI persona — not Steven Bartlett, and not affiliated with the show."
Audio intent: held chord, slow fade.

**Music mood for this video:** cinematic, warm, restrained.
**Audio summary:** a pad under the hook, a bell on the reveal, the pulse with the stage, a
heartbeat through the answer and the click, a breakdown under the check, a lift for Talk/Interview,
a resolution under the outro.

## Grounding

Every claim on screen is the project's own copy: the one sentence (`AGENTS.md`, `docs/PRODUCT.md`),
the four kinds of statement and the validation claim (`README.md`), the mode hints and the
disclosure (`apps/web/src/i18n/en.ts`), the pipeline (`README.md` flowchart), the licence
(`LICENSE`). The UI is the real app in demo mode; the fixtures on screen are labelled demo and put
no words in Steven Bartlett's mouth. The interview answers typed on screen are the visitor's
(fictional "Alex"), never the persona's.

## Final schedule (as rendered, 2026-10-17)

Total 95.4 s. Scene times come from the recordings' marks, so they differ a little from the storyboard's estimates.

| Scene | Start | End | Length |
|---|---|---|---|
| Hook | 0.0 s | 5.2 s | 5.2 s |
| Reveal | 5.2 s | 10.2 s | 5.0 s |
| The stage | 10.2 s | 18.9 s | 8.7 s |
| The answer streams | 18.9 s | 26.4 s | 7.5 s |
| Four kinds of statement | 26.4 s | 35.0 s | 8.6 s |
| The click | 35.0 s | 50.9 s | 15.9 s |
| How it is checked | 50.9 s | 59.3 s | 8.4 s |
| Talk | 59.3 s | 68.6 s | 9.3 s |
| Interview me | 68.6 s | 81.8 s | 13.2 s |
| Honest by design | 81.8 s | 88.6 s | 6.8 s |
| Outro | 88.6 s | 95.4 s | 6.8 s |

Poster: the reveal at 9.2 s (mark, wordmark, disclosure line and "An AI persona with receipts." all settled).
