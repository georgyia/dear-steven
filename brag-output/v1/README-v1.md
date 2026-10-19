# brag-output — the demo video

Written for: whoever picks this folder up next (the owner, or a contributor asked to re-cut it).

| File | What it is |
|------|------------|
| `brag.mp4` | The demo, 1920x1080, 30 fps, ~95 s, with the soundtrack. Frame 0 is the poster. |
| `brag.jpg` | The poster frame (for `<video poster>` and platforms that take a thumbnail). |
| `brag-plan.md` | The script: angle, hook, storyboard, audio direction, grounding of every claim. |
| `share-copy.txt`, `share-copy-variants.md` | Captions to post with it (English, LinkedIn, German). |
| `seedance-prompts.md` | Optional AI B-roll prompts for Higgsfield, from the `ai-video-generator-claude` skills. Not used in the video. |
| `composition/index.html` | The video as an HTML page: every frame is a pure function of time (`window.__seek(t)`). |
| `work/` | Everything intermediate: the app recordings, the renderer, the soundtrack synthesiser, frames. |

Nothing here is committed: the folder is build output. Add `brag-output/` to `.gitignore` if it
should stay out of `git status`.

## How it was made

1. **The app, recorded.** `work/record.mjs` drives the real web app (started as
   `DEAR_STEVEN_DEMO=1 next dev -p 3100`, so no OpenAI call is ever made) with Playwright at
   1920x1080 and captures every compositor frame through the DevTools screencast, with a drawn
   cursor. Three clips: `ask` (home → question → streamed answer → quote preview → inspector:
   Quote, Context, next source → scroll), `talk`, `interview`. Each clip writes its named marks
   (`work/clips/*.json`), so the composition follows the recording wherever its moments land.
   The backdrop blur is switched off during recording: software rendering can't blur a 1080p
   backdrop faster than 13 fps.
2. **The composition.** `composition/index.html` draws the typographic scenes with the app's own
   tokens and fonts (Fraunces, Geist, Geist Mono) and plays the clips through a camera (push-ins
   and pans onto the composer, the answer column, the inspector), with captions keyed to clip marks.
3. **The render.** `work/render.mjs` seeks the page frame by frame and screenshots it; ffmpeg
   encodes the frames. The page also exports the cue sheet the music follows.
4. **The sound.** `work/music.py` synthesises the soundtrack from that cue sheet: an original pad,
   sub, heartbeat kick, pluck motif, a bell on the reveal, swells on scene changes, key ticks under
   the typing, a click on the chip, a drop when the inspector opens. No licensed audio.
5. **Finish.** `work/finish.sh` muxes, normalises loudness (EBU R128, -16 LUFS), pulls the poster
   and bakes it as frame 0.

## Re-cutting

```bash
# 1. record again (needs the app running in demo mode on :3100)
cd apps/web && DEAR_STEVEN_DEMO=1 DEAR_STEVEN_DB_PATH=data/none.db pnpm exec next dev --turbopack -p 3100 &
node ../../brag-output/work/record.mjs            # or: record.mjs ask   (one clip)
# 2. check the scenes as stills, then render
cd ../../brag-output/work
node render.mjs ../composition/index.html stills --stills
node render.mjs ../composition/index.html render
# 3. music from the cue sheet the render exported, then finish
python3 -c "import json; json.dump(json.load(open('render/schedule.json'))['cues'], open('cues.json','w'))"
python3 -I music.py cues.json soundtrack.wav
./finish.sh render/frames soundtrack.wav 9.2
```

Tone, copy and timing live in `composition/index.html` (the `S.push(...)` scene list). A 20-second
cut is scenes 1, 2, 6 and 10.

## What the two suggested tools contributed

- `latent-spaces/brag`: the workflow (inspect → plan → compose → deliver), the creative laws, the
  poster-as-frame-0 trick and the share copy. Its Hyperframes renderer could not be run on this
  machine (the agent's sandbox refuses `npx hyperframes`), so the `brag-slim` route was taken: the
  video is built with the tools already installed (Playwright, ffmpeg, numpy).
- `rediumvex/ai-video-generator-claude`: it writes prompts for Seedance 2.0, it does not render
  video. Its SaaS-launch and podcast-visual skills produced `seedance-prompts.md`.
