# DESIGN.md — the visual system

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | human | 2026-10-10 | every `type:ui` / `type:design` issue |

Binding for UI work. Tokens are defined once in `apps/web/src/styles/tokens.css` and exposed as
Tailwind utilities in `globals.css` (`bg-ink-1`, `text-ivory-0`, `text-ember-0`, `font-display`…).

## 1. Principles

- **A lamp-lit late-night studio**: intimate, editorial, slightly mysterious. Warmer and quieter
  than the show's own cold, silver identity — deep warm blacks, ivory, a single ember accent.
- **The answer is the main event.** Questions are set as serif headings, not chat bubbles. No
  sidebar. Chrome recedes.
- **Colour carries meaning**, never decoration: ember = verified host / focus / the quote
  hairline; ivory chip = verified guest; dashed steel = unverified speaker; softer ivory =
  synthesis; oxblood = error. Related-but-not-cited material (the inspector's "Related moments")
  has a dashed ink edge and no ember, so it never reads as support.
- **Tokens only.** No raw hex in components. Two documented exceptions: canvas APIs that cannot
  read CSS variables (Threads colours, the VoicePill waveform) use the literal token value with a
  comment.
- **Motion explains state changes**, ≤ 3 animated components live per view, everything behind
  reduced-motion gates.
- No purple/blue AI gradients. Glass only on the evidence drawer header. No emoji in UI.

## 2. Tokens

| Token | Value | Role |
|-------|-------|------|
| `--ink-0` | `#0a0908` | page |
| `--ink-1` | `#12100e` | stage, drawer |
| `--ink-2` | `#1a1714` | raised: composer, cards |
| `--ink-3` | `#241f1b` | hairlines, hover, guest chip |
| `--ink-4` | `#2f2924` | pressed, strong hairlines |
| `--ivory-0` | `#f4eee4` | primary text, sourced prose |
| `--ivory-1` | `#cfc6b8` | secondary text, **synthesis prose** |
| `--ivory-2` | `#a39a8d` | muted (lightened from the plan's `#8e867a` to keep ≥ 4.5:1 on every ink) |
| `--ember-0` | `#e3a857` | the accent |
| `--ember-1` | `#f3c47a` | hover |
| `--ember-tint` | 14% ember | host chip, highlights |
| `--steel` | `#8b949e` | machine metadata, unverified speaker |
| `--oxblood` / `--oxblood-1` | `#b3473b` / `#e38b7d` | error borders / error text |

Shape: chips 999px, composer 22px, cards 18px, panels 24px. Layout: column `44rem`, drawer
`420px`. Motion: `--ease-out cubic-bezier(.23,1,.32,1)`, `--ease-in-out cubic-bezier(.77,0,.175,1)`.

## 3. Typography

- **Fraunces** (variable, `opsz` + `SOFT`): the wordmark (64–96px, opsz 144), questions
  (27–34px), pull quotes (24–28px italic), card titles.
- **Geist Sans**: answer prose 17–18px / 1.7, UI 12.5–15px.
- **Geist Mono**: timestamps, ids, status pill, eyebrows (10.5–12.5px, steel, tracked uppercase
  for labels).
- All via `next/font/google` (self-hosted at build), OFL.

## 4. Layout

- **Home**: wordmark → one-line intro → composer with mic → three example questions →
  disclosure. Status pill bottom-left, "How this works" bottom-right.
- **Conversation**: fixed top bar (compact wordmark = new conversation; About; status pill), a
  44rem column of turns, the composer docked at the bottom under a scroll-edge blur, disclosure
  under it. The composer glides from home to dock (shared layout animation).
- **Ask / Talk** (P7-05): a RubberSegment above the composer, with a one-line hint from `sm`. Talk
  turns read as a **transcript, not chat bubbles**: a mono speaker label ("You", "Dear Steven")
  beside each line (stacked under 640px), the reply in the display serif with its chips, a Listen
  button, and nothing else: no pull quote panel, takeaway or conversation cards. Consecutive talk
  turns sit together under a "Talk" eyebrow; Ask turns keep the editorial layout.
- **Interview me** (P7-06): its own view, same frame (top bar, docked composer). Setup: eyebrow,
  a display-serif title, two optional fields. Then one question at a time in the display serif,
  a hairline progress bar in ember, the last answer quoted in a quiet left-ruled line for context,
  Listen / Skip / End. "What I learned about you": each line in the display serif with the
  visitor's own words beneath it behind the ember hairline, as quotes are.
- **Practice debrief** (P7-07): the headline in the display serif; four scores as five ember pips
  each (labelled, with the number for screen readers; they grade the visitor's delivery, not
  confidence in a source); what worked and what to work on, each over the visitor's own words; the
  rewrite in the display serif behind the ember hairline under the original; "Practise the weakest
  answer again" as the primary action.
- **About you** (P7-08): "Keep this on this device" under "What I learned"; afterwards, an "About
  you" block after the conversation-memory switch, with the same rules: the exact text in an
  editable field, a character count, Save, and Forget with undo.
- **Evidence inspector** (tabs Quote · Context · Video; Video holds the click-to-load player and
  the podcast audio): ≥ 1024px a 420px right panel; the column and composer shift left, never
  covered. < 1024px a bottom sheet (85dvh, drag handle, native modal dialog).
- Breakpoints verified at 375 / 768 / 1280. No horizontal scroll (tested).

## 5. Interaction states (`lib/stage-machine.ts`)

`idle → requestingMic → listening → transcribing → composing(searching → found → writing) →
answered | insufficient | error`, and `answered → speaking → answered`. Visuals per state:
ambient level (`ambientLevel`), thought-line steps, composer send↔stop morph, VoicePill
waveform/timer, Listen button ring.

## 6. React Bits in use

Threads (ambient), Noise (film grain), BlurText (wordmark), PromptBar (composer, adapted),
VoicePill (mic, adapted), ThoughtLine (thinking trace), StatusMark (setup checklist),
LatticeLoader (indexing pill), WarmTooltip (chip previews, adapted), SwipeToast (notices),
SpotlightCard (episode cards), RubberSegment (drawer tabs, Written/Spoken), Magnet (mic pull),
GradualBlur (scroll edge), SquishSwitch (voice settings, conversation memory), FuseButton (Forget, with undo). Local changes are listed in each file's header. MIT + Commons Clause:
use inside the app only.

## 7. Motion and accessibility

- Reduced motion: Threads renders one still frame, Noise stops, BlurText's words are drawn statically by CSS
  (`motion-reduce:`, identical server and client markup, so no hydration mismatch),
  reveals fade only, layout springs are disabled via `MotionConfig reducedMotion="user"`.
- Mobile (< 1024px): Threads is a still frame.
- Focus rings: 2px ember, 2px offset. Chips are buttons with full accessible names
  ("Dana White · 32:14. Real passage, speaker not verified…"). Dialogs use native `<dialog>`.
  "Answer complete." is announced in a live region. Thought line announces its steps.
- Not colour-only: speaker states also differ in shape (initial disc, dashed border) and text.
- Audited: Lighthouse 100 on home; axe-core WCAG 2.1 A/AA in every interactive state, in the e2e
  suite (`e2e/a11y.spec.ts`). Scrollable regions without focusable content are themselves focusable.

## 8. Copy

In-product, in the persona's voice, short. Never framework defaults. Every interface string is in
the message catalogues `src/i18n/{en,de}.ts` (German is typed against English, so a missing key
fails `tsc`); thinking steps and fixed replies per locale are in `@dear-steven/core/copy`; names
in `src/brand.ts`.

- The interface language is English or German: the `dear-steven-locale` cookie (set by the
  Language picker in Voice settings), else `Accept-Language`, else English. The server renders in
  it, so `<html lang>` is right on first paint.
- Answers follow the language of the question, not the interface: answer prose and the spoken
  reply carry `lang` = the answer's language.
- Original words stay as they were said and are marked `lang="en"`: quotes, transcript excerpts
  and context, episode titles, and the policy text (English only for now). `e2e/i18n.spec.ts`
  fails on English outside those.
- German runs ~30% longer: check the pill, composer, chips and dialogs at 375 px.
- Dates use the month names in `@dear-steven/core/format` (not `Intl`, whose output differs between
  Node and browsers and breaks hydration); numbers use `toLocaleString(LOCALE_TAG[locale])`.

## 9. Anti-goals

Chat bubbles, a conversation sidebar, glass cards everywhere, particles, typewriter streaming,
neon gradients, numeric confidence scores, stock "AI sparkle" icons as decoration, emoji.
