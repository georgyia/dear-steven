# brag-output: the Dear Steven promo

Written for: the owner, and whoever re-cuts the video later.

| File | What it is |
|------|------------|
| `dear-steven-promo.mp4` | The promo for X: 1920x1080, 60 fps, 66.0 s, -14 LUFS. Frame 0 is the poster. |
| `dear-steven-promo.jpg` | The poster frame, for platforms that take a custom thumbnail. |
| `share-copy.txt`, `share-copy-variants.md` | The post, a shorter post, the reply with credit and disclosure, a German version, and the list of machine-writing signs the copy avoids. |
| `brag-plan.md` | The script, shot by shot, and where every claim comes from. |
| `composition-v3/` | The video as an HTML page; every frame is a pure function of time. |
| `work2/` | The recorder, renderer and mixer, plus the recorded frames. |
| `v1/`, `v2/` | The two earlier versions' plans and posters. |
| `seedance-prompts.md` | Optional AI B-roll prompts (Higgsfield). Not used in the video. |

Only the sources are committed: the recordings, renders, mixes, the superseded `composition-v2/` and the video files are ignored (`.gitignore`). The video itself is attached to the draft release `promo-v3`.

## How it is made

1. **Record the app on a virtual clock.** `work2/capture.mjs <scene>` drives the real app with
   Playwright at 1280x800, 2x. `work2/vt-init.js` replaces the page's clock: timers,
   `requestAnimationFrame`, `Date`, `performance.now`, CSS transitions and Web Animations, smooth
   scrolling, the answer stream's pacing and speech all advance only when the recorder steps a
   frame. So each frame is exact and every animation plays at its real speed, however slowly the
   machine renders. motion is routed through its JS animation path (its Web Animations path times
   itself against the real document timeline). The clock stays out of iframes, so the YouTube
   player runs in real time; the recorder talks to it over the IFrame API, and for the one shot
   where it plays it switches to a real-time CDP screencast (`work2/frames/play/`, turned into a
   60 fps clip by `work2/screencast-to-frames.py`, which also fits the player's clock to the wall
   clock so the audio lines up).
   - Demo scenes, against `DEAR_STEVEN_DEMO=1 next dev -p 3100`: `ask`, `about`, `talk` (a
     scripted voice, as the e2e suite fakes one), `interview`, `practice`.
   - The knowledge-base scene, against the live database with no spend possible
     (`DEAR_STEVEN_DAILY_BUDGET_USD=0 next dev -p 3100`): `sources`. It opens the episode
     browser, one summary, one moment, the Video tab and the player. No model is called.
   - Marks land in `work2/frames/<scene>.json`.
   - While an answer is typed in the interview, the composer dock vanishes for single frames (a
     layout-animation hiccup of the app under the virtual clock). `work2/patch-blank-frames.py`
     finds those frames by the dock's brightness and replaces each with the frame before it:
     `python3 -I work2/patch-blank-frames.py practice 580 1470 2000 1580 q-1 debrief`.
2. **Compose.** `composition-v3/index.html` shows the frames in a window and moves a camera over
   them; captions and cuts are keyed to the music's bar lines and the recordings' marks. Cuts
   inside a flow are cross-dissolves (`DISSOLVES`): the frame before the cut fades out over the
   one after it while the camera eases.
3. **Render.** `node work2/render2.mjs work2/render3` (60 fps), which also exports `audio.json`.
   `--stills 10,20.5` renders single frames for a check.
4. **Sound.** `python3 -I work2/mix.py work2/render3/audio.json work2/soundtrack3.wav`. The music
   ducks under the player's sound, a slice of `work2/yt-segment.mp4` (the video's own audio for
   those seconds, fetched with yt-dlp into a scratch venv; a headless browser has no audio out).
5. **Finish.** `work2/finish2.sh work2/render3/frames work2/soundtrack3.wav <poster-seconds>`.

Run the recorder from `apps/web` (it resolves `@playwright/test` from there), one Chromium at a
time: this machine swaps heavily.

## Credits

- Music: "Happy Beats / Business Moves Vol. 12" by Sascha Ende, ende.app, CC BY 4.0. Credit it
  in the post (the reply in `share-copy-variants.md` does).
- Sound effects: Kenney (kenney.nl), CC0, via latent-spaces/brag.
- Workflow: latent-spaces/brag (`/brag-slim`): plan, creative laws, poster as frame 0.
- The YouTube frames in the knowledge-base scene are from The Diary Of A CEO's own upload of the
  Andrew Huberman episode, shown inside the product's privacy-enhanced player. Whether to publish
  them is the owner's call.
