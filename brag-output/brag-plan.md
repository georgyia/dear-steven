# Dear Steven promo, version 3: the script

Written for: the owner, and whoever re-cuts the video later.

Three changes from version 2, all asked for on 2026-10-18: the YouTube jump to the exact second
is shown on a real episode; the practice interview with its debrief replaces the plain interview;
and every caption was rewritten without the usual signs of machine-written text (middle dots,
em dashes, "not X but Y", lists of three, slogans).

The music is "Happy Beats / Business Moves Vol. 12" (Sascha Ende, ende.app, CC BY 4.0), 110 BPM.
Cuts sit on its bar lines; the chip click lands on the drop at 17.47 s.

| Time (s) | Picture | Words on screen |
|---------:|---------|-----------------|
| 0.0 | Black, the inspector out of focus behind | "An unofficial AI persona of Steven Bartlett." |
| 1.85 | Same | "Every claim links to the second it was said." |
| 2.9 | The app window rises into place (demo mode) | Dear Steven / "Ask it a real question." |
| 5.6 | In on the composer; "Why do I keep procrastinating?" is typed | |
| 8.74 | Enter on the build. The answer streams in with its chips | The answer / "It answers in the first person." / "Every claim carries a chip that links to its source." |
| 16.15 | The cursor hovers a chip; the quote previews | Sources / "Hover a chip to preview the quote." |
| 17.47 | The click lands on the drop; the inspector opens on the quote, speaker and minute | Sources / "Click it to see who said it, and when." / "The words come from the stored transcript, never from the model." |
| 22.37 | The Context tab: the passage inside the transcript | Sources / "Then read the conversation around it." |
| 26.2 | Cut to the Video tab of a real moment (the live knowledge base): "Play the video here from 30:44", "Watch on YouTube at 30:44" | YouTube / "Open the moment on YouTube, at the exact second." / "A real episode, matched to its video." |
| 28.36 | Play is clicked; the player loads | |
| 28.67 | The video plays, with its own sound; the music dips underneath | |
| 33.29 | Cut to the episode browser, already filtered to "Huberman" (two matches); Summary is clicked; the summary and its topics; the most interesting moments; the moment at 30:24 is clicked | 214 conversations / "Browse every episode it knows." / "Each summary opens at the moments it quotes." |
| 39.83 | Cut to the home screen; Talk is clicked, then the microphone; the question is heard; then the reply | Talk / "Talk it through, out loud." |
| 44.19 | Cut to the home screen; Interview me is clicked, then "Practise presenting my expertise"; the form filled; Start | Interview me / "Or practise your pitch." / "Six hard questions about what you know." |
| 48.24 | Question 3 of 6 ("What do you believe about your field that most people in it would disagree with?"), the answer typed | |
| 50.18 | The debrief: how it came across (four scores), what worked, then the page scrolls to what to work on, the rewrite note and "Practise the weakest answer again" | Debrief / "Then a debrief on how you came across." / "It scores you on four counts and quotes the answer to fix. Then you retake it." |
| 55.11 | End card: "Dear Steven", "An AI persona with receipts.", "Every claim is one click from the moment it was said.", the disclosure | |
| 63.83 | Black | |

## Where every claim comes from

- "An unofficial AI persona of Steven Bartlett": the product's own disclosure (`apps/web/src/i18n/en.ts`, `notice`).
- "Every claim links to the second it was said": `docs/PRODUCT.md`'s one sentence; `packages/core/src/youtube/links.ts` builds `t=<seconds>s` links for exact and estimated alignments only.
- "The words come from the stored transcript, never from the model": the About dialog's "Checked, not trusted" (`en.ts`, `about.checked`). The About dialog itself was cut from the video on 2026-10-19 at the owner's request.
- "214 conversations": `select count(distinct episode_id) from passages` on `data/dear-steven.db` on 2026-10-18; the explorer shows the same number.
- The Huberman moment: episode `ep_107a6e48457c`, passage `ep_107a6e48457c_p0022`, podcast 30:24, video offset +20 s (exact alignment), video `MGxcosNuC8k`. The player shot is a real-time screen recording of the product's own embed playing (headless Chromium delivers it at 1x, so it is laid over the player's rectangle of the crisp 2x frame; everything around the player is the frame-exact take). Its sound is the same seconds of the video's audio track, fetched with yt-dlp (`work2/yt-segment.mp4`) and aligned to the player's own clock, because a headless browser has no audio output to record.
- "Six hard questions, then a debrief": the practice flavour (`packages/core/src/interview/arc.ts`, `apps/web/src/server/demo-interview.ts`). In demo mode the debrief's scores come from fixed rules and say so on screen.
- Demo mode: the ask, talk and practice scenes run on `DEAR_STEVEN_DEMO=1`; every fixture is labelled "Demo fixture" in the app and the corner tag says "Demo mode, fixture answers". The knowledge-base scene runs live with `DEAR_STEVEN_DAILY_BUDGET_USD=0`, so no model is called; its corner tag says "Live knowledge base, real episodes".
