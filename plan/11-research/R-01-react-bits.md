# R-01 — Which React Bits components fit, and how do we integrate them?

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | P1-02, docs/DESIGN.md §6 |

## Question

Which React Bits components exist today, what do they need, and which genuinely improve this
product (vs. decoration)?

## Findings (checked 2026-10-10 against the `@react-bits` registry, `https://reactbits.dev/r/<Name>-TS-TW.json`)

- All 14 candidates exist as TS + Tailwind registry items: Threads, Noise, BlurText, PromptBar,
  VoicePill, ThoughtLine, StatusMark, LatticeLoader, WarmTooltip, SwipeToast, SpotlightCard,
  RubberSegment, Magnet, GradualBlur.
- Dependencies: `motion@^12.23` (BlurText, PromptBar, ThoughtLine, StatusMark, WarmTooltip,
  SwipeToast, RubberSegment), `@hugeicons/react` + `@hugeicons/core-free-icons` (PromptBar,
  VoicePill, ThoughtLine, SwipeToast), `react-dom@^19` (WarmTooltip). Threads, Noise,
  SpotlightCard, Magnet, GradualBlur, LatticeLoader have no dependencies.
- **Threads is WebGL2** (not canvas 2D as first assumed). It respects reduced motion (no time
  advance) and renders a single frame when `paused`.
- Licence: MIT + Commons Clause — use inside an application is allowed; selling or redistributing
  the components themselves is not. The registry files carry no header, so we add one.
- Quirks found while integrating: VoicePill leaves `--vp-cancel` unset (its "‹ Cancel" hint is
  visible at rest); VoicePill's waveform and Threads draw on canvas/WebGL, which can't read CSS
  variables; WarmTooltip is single-line only; PromptBar's menus are demo content; BlurText always
  renders a `<p>` and ignores reduced motion; SpotlightCard sets its CSS variables inline.

## Options

1. Install via `npx shadcn add @react-bits/…` and keep files pristine, wrapping everything.
2. Vendor the registry source into `components/vendor/react-bits/` as owned code, adapting where
   the product needs it, with a header listing every local change.

## Decision

Option 2. Local changes (each recorded in the file header): PromptBar (menus/attachments/sparks
removed; controlled value; trailing slot), BlurText (`as`, reduced-motion gate, single accessible
label), WarmTooltip (opt-in wrapping), VoicePill (imperative handle; CSS variables initialised).
Deliberately not used: CometDial, DodgeField, JellyRadio, ScrubField, SlingButton, FolderFloat,
SpringCheck, GlassSurface, and the WebGL-heavy Orb / LightRays / Aurora / Silk. Later candidates:
RefineFrame, GlideSelect, SquishSwitch, FuseButton, AnimatedList, PulseHeart (P5).

## Sources

- https://reactbits.dev and https://github.com/DavidHDev/react-bits (LICENSE.md) — 2026-10-10
