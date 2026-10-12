# Phase 6 — Reach and trust (M4)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | milestone M4 |

**Exit:** Dear Steven works in the visitor's language, can be set up without a terminal, gives
concrete, opinionated answers that stay grounded, is safe to put on the public internet, says
plainly what it is and isn't, and sends people to the original conversations on YouTube.

Issues are grouped by category; each category is a `track:*` label on GitHub.

| Category | Label | Issues |
|----------|-------|--------|
| Languages | `track:i18n` | P6-01, P6-02 |
| Setup in the app | `track:setup` | P6-03, P6-04, P6-05 |
| Better answers | `track:answers` | P6-06, P6-07 |
| Security | `track:security` | P6-08, P6-09, P6-10, P6-11 |
| Policies | `track:policy` | P6-12, P6-13 |
| YouTube | `track:youtube` | P6-14, P6-15 |
| Suggested | (by area) | P6-16, P6-17, P6-18 |

---

## Languages

### P6-01 — feat(core): ask and answer in any language

<!-- issue {"id":"P6-01","title":"feat(core): ask and answer in any language","labels":["type:core","stage:m4","track:core","track:i18n","owner:ai","risk:medium","P1","size:M"],"milestone":"M4 Reach and trust","depends":[],"github":1} -->

#### Context
Every transcript is English and the persona answers in British English. A question in German or
Spanish today gets weak keyword search (FTS5 matches English words only) and an English answer.

#### Goal
Ask in any language the answer model handles well; get the answer in that language, grounded in
the same English conversations, with quotes that stay verbatim.

#### Scope
**In** — detect the question's language; the condense step also writes an English search query
(keyword search runs on it; semantic search on both); the answer schema gains `language`; the
prompt answers in the question's language; quote blocks keep the **verbatim English** span and may
add a translation that the UI labels "translation" (never as Steven's or a guest's words);
`PERSONA.md` § language; eval questions in two non-English languages.
**Out** — translating transcripts at ingest; UI copy (P6-02).

#### Acceptance criteria
- [ ] A German and a Spanish question retrieve the same top passages as their English versions
  (recall@10 within 10 points on the translated eval set).
- [ ] The answer is in the question's language; every quote block still renders the stored
  English span; any translation is visibly labelled and never inside the quote marks.
- [ ] The validator still rejects anything it rejects today (no rule relaxed).

#### Tests required
Core: language detection and query condensation (fake model); validator tests for translated
quote blocks. Eval: `eval/questions.*.json` with translated questions.

#### Security notes
A translation is model output: it is never rendered as a quote and never fed to `locateQuote`.

#### Skills to consult
`dear-steven-persona`, `dear-steven-architecture`.

#### Dependencies
None. **Size:** M.

---

### P6-02 — feat(web): the interface and voice in the visitor's language

<!-- issue {"id":"P6-02","title":"feat(web): the interface and voice in the visitor's language","labels":["type:ui","stage:m4","track:web","track:voice","track:i18n","owner:ai","risk:low","P2","size:M"],"milestone":"M4 Reach and trust","depends":["P6-01"],"github":2} -->

#### Context
All copy lives in `apps/web/src/brand.ts` and `@dear-steven/core/copy`, in English. Voice input
uses `navigator.language`; spoken replies use one English stock voice.

#### Goal
The interface, the thinking steps and voice follow the visitor's language, starting with English
and German, with a language switch.

#### Scope
**In** — a message catalogue per locale (no new framework unless justified); locale from
`Accept-Language`, overridable in Voice settings and stored with the other preferences; Web Speech
`lang` and the TTS instructions follow it; dates and numbers through `Intl`.
**Out** — right-to-left layouts; more than two locales in this issue.

#### Acceptance criteria
- [ ] With a German browser, every visible string is German (e2e walks home → answer → inspector →
  dialogs and finds no English copy outside quotes and episode titles).
- [ ] Switching language takes effect without a reload and survives one.

#### Tests required
Unit: catalogue completeness (every key in every locale). E2E: German locale run of the main flow.

#### Design notes
German runs ~30% longer: check the pill, composer, chips and dialogs at 375 px.

#### Skills to consult
`docs/DESIGN.md`.

#### Dependencies
P6-01. **Size:** M.

---

## Setup in the app

### P6-03 — feat(web): bring your own API keys from the setup panel

<!-- issue {"id":"P6-03","title":"feat(web): bring your own API keys from the setup panel","labels":["type:ui","stage:m4","track:web","track:setup","track:security","owner:ai","risk:high","needs:human-review","P1","size:M"],"milestone":"M4 Reach and trust","depends":["P6-09"],"github":3} -->

#### Context
Keys can only be set in `.env` on the server. A visitor to a hosted instance can't use their own
OpenAI or YouTube key, and the operator pays for everyone.

#### Goal
The setup panel lets a visitor paste their own OpenAI key (and optionally a YouTube key). Their
requests then run on their key, which never leaves their browser except on those requests.

#### Scope
**In** — key fields in the setup panel with a "test key" button (free `models.retrieve`); kept in
`sessionStorage` by default, `localStorage` only with "remember on this device"; sent per request
in a header over HTTPS only; the server uses it for that request, never stores or logs it, and
falls back to the operator key only if the operator allows it (`DEAR_STEVEN_ALLOW_OPERATOR_KEY`);
a visible "using your key" state; Forget.
**Out** — accounts; server-side key storage; ingest with a visitor's key (P6-04).

#### Acceptance criteria
- [ ] With no operator key, a pasted valid key switches that browser to live mode.
- [ ] The key appears in no log, response, error message, URL or server-side storage (test with
  a canary key and grep the logs and responses).
- [ ] An invalid key gets a clear message; nothing about the key is echoed back.

#### Tests required
Route tests with a canary key; e2e for paste → test → ask → forget.

#### Security notes
A script injected into the page could read the key, so this waits for the strict CSP (P6-09).
Header name and handling go in the threat model; rate limits still apply per client.

#### Skills to consult
`dear-steven-security` (mandatory), `docs/DESIGN.md`.

#### Dependencies
P6-09. **Size:** M.

---

### P6-04 — feat(web): guided local setup — keys, knowledge base and budget from the browser

<!-- issue {"id":"P6-04","title":"feat(web): guided local setup — keys, knowledge base and budget from the browser","labels":["type:service","stage:m4","track:web","track:ingest","track:setup","owner:ai","risk:high","needs:human-review","P2","size:L"],"milestone":"M4 Reach and trust","depends":["P6-03"],"github":4} -->

#### Context
Setting up locally means a terminal: editing `.env` and running `pnpm ingest …` stages in order.

#### Goal
On a local machine, the setup panel walks through it: save keys to `.env`, then fetch transcripts,
embed and link videos, with a cost preview, a budget cap and live progress.

#### Scope
**In** — enabled only when the server is bound to localhost and started with a one-time setup
token printed in the terminal; writes `.env` atomically (never echoes values back); runs the
existing ingest stages through the CLI's functions (one place, no re-implementation) with the
dry-run cost first and a spend cap; progress over SSE; the status pill updates live.
**Out** — paid diarization from the browser (stays in the CLI with `--budget`); remote setup.

#### Acceptance criteria
- [ ] On a fresh clone, keys → transcripts → embeddings → YouTube links can be done from the
  browser; `pnpm ingest status` agrees with the panel.
- [ ] Every paid stage shows its estimate and needs a click; the cap is enforced.
- [ ] Off unless bound to localhost with the token; the routes 404 otherwise.

#### Tests required
Route tests (token, localhost guard, cap); e2e against a fixture feed.

#### Security notes
Writes secrets to disk and spends money: `risk:high`. Fail closed on any doubt about the binding.

#### Skills to consult
`dear-steven-security` (mandatory), `dear-steven-architecture`.

#### Dependencies
P6-03. **Size:** L.

---

### P6-05 — chore(core): spike — a second LLM provider behind the model adapter

<!-- issue {"id":"P6-05","title":"chore(core): spike — a second LLM provider behind the model adapter","labels":["type:spike","stage:m4","track:core","track:setup","owner:ai","risk:medium","P2","size:M"],"milestone":"M4 Reach and trust","depends":["P3-08"],"github":5} -->

#### Context
Answers, embeddings, transcription and speech are all OpenAI (`config/models.ts`). Some people
will want a different provider, or a local model.

#### Goal
A time-boxed spike: can the answer step run on a second provider (e.g. Anthropic, or a local model
through an OpenAI-compatible server) with strict structured output, and how do quality and cost
compare on the eval set?

#### Scope
**In** — prototype on a branch; `pnpm eval --answers` on both; findings in
`plan/11-research/R-07-providers.md` with numbers and a recommendation.
**Out** — merging; changing embeddings (that would mean re-indexing).

#### Acceptance criteria
- [ ] Findings with grounding, citation-validity and cost numbers for both providers.
- [ ] If recommended: a follow-up issue for a provider setting in the setup panel.

#### Security notes
A new provider is a new place questions are sent: record it in the threat model if adopted.

#### Dependencies
P3-08 (a live baseline to compare against). **Size:** M.

---

## Better answers

### P6-06 — feat(core): persona v2 — a concrete opinion and what I'd do, grounded in the interviews

<!-- issue {"id":"P6-06","title":"feat(core): persona v2 — a concrete opinion and what I'd do, grounded in the interviews","labels":["type:core","stage:m4","track:core","track:answers","owner:ai","risk:medium","P1","size:M"],"milestone":"M4 Reach and trust","depends":["P3-08","P6-11"],"github":6} -->

#### Context
The persona (`docs/PERSONA.md`) is built to be careful: it relays, it hedges, and on health, money
and legal questions it avoids prescriptions. The owner's feedback: it should not be scared of
giving advice. It should take a position and say what it would do, from Steven's perspective as
shown in the interviews.

#### Goal
Every substantive answer leads with a clear view ("Here's what I'd do"), gives concrete next steps
and names the trade-off. It is backed by what the conversations actually said, and stays honest
about which parts are the persona's own reasoning.

#### Scope
**In** — `PERSONA.md` v2 (bump `PERSONA_VERSION`): lead with the recommendation; concrete steps,
numbers and examples from the sources; disagree with a guest when the sources support it; fewer
hedges. `insufficient` only when nothing relevant was retrieved; thin evidence becomes `partial`
with a clearly labelled opinion instead of a refusal. Schema descriptions and the prompt updated
to match; eval rubric gains *decisiveness* and *actionability*.
**Out** — relaxing any validator rule; inventing what Steven believes.

#### Acceptance criteria
- [ ] On the eval set, ≥ 80% of grounded answers open with a concrete recommendation (judged,
  human-spot-checked), with citation validity unchanged or better.
- [ ] Opinions the sources don't show are `synthesis` ("If I were you, I'd…"), never attributed
  to Steven or a guest. `personaLint` and the validator stay green.
- [ ] High-stakes questions follow P6-11's rails: a concrete view, plus when to get a
  professional.

#### Tests required
`pnpm eval --answers` before/after (summary lines in the PR); prompt snapshot tests; validator
tests unchanged.

#### Security notes
The persona speaks as Steven but is not him. Persona v2 makes it more assertive, so the "Never"
list (`PERSONA.md` §4) and the AI-persona disclosure stay non-negotiable (SR-04).

#### Skills to consult
`dear-steven-persona` (mandatory), `dear-steven-architecture`.

#### Dependencies
P3-08 (baseline), P6-11 (safety rails ship first or together). **Size:** M.

---

### P6-07 — feat(core): answers that use more of each conversation

<!-- issue {"id":"P6-07","title":"feat(core): answers that use more of each conversation","labels":["type:core","stage:m4","track:core","track:ingest","track:answers","owner:ai","risk:medium","P1","size:L"],"milestone":"M4 Reach and trust","depends":["P3-08"],"github":7} -->

#### Context
The model sees 12 passages of ~1–2 minutes each. It can't tell how a guest built up to an idea,
or what the whole conversation was about, and Steven's own lines can't be told apart from the
guest's until episodes are diarized (P2-08).

#### Goal
Answers that refer to the video content more precisely: the right moment, the surrounding
argument, and agreement or disagreement across several conversations.

#### Scope
**In** — neighbouring segments as context around each retrieved passage (budgeted); a short
per-episode summary made once at ingest (`pnpm ingest summarise`, with a dry-run cost first);
multi-query retrieval (the condense step proposes 2–3 phrasings); prompt guidance for
cross-episode synthesis ("three guests agree…, one doesn't"); citation density checks in the eval.
**Out** — rerankers (P5-02); diarization itself (P2-08).

#### Acceptance criteria
- [ ] Eval: answer usefulness up and citation validity not down versus the P3-08 baseline
  (numbers in the PR).
- [ ] Summaries are labelled as generated and are never cited as quotes.
- [ ] Token cost per answer is reported and stays under the budget in `config/models.ts`.

#### Tests required
Retrieval tests for multi-query fusion; context-window tests; eval before/after.

#### Security notes
Summaries are model output stored in the knowledge base: they are never treated as transcript
evidence by the validator.

#### Skills to consult
`dear-steven-architecture`, `dear-steven-persona`.

#### Dependencies
P3-08. Steven's own perspective needs verified host lines: P2-08 (H-04/H-05). **Size:** L.

---

## Security

### P6-08 — feat(security): protect a public deployment — access gate and a daily spend cap

<!-- issue {"id":"P6-08","title":"feat(security): protect a public deployment — access gate and a daily spend cap","labels":["type:security","stage:m4","track:security","track:web","owner:ai","risk:high","needs:human-review","P0","size:M"],"milestone":"M4 Reach and trust","depends":[],"github":8} -->

#### Context
Per-client rate limits slow one visitor down. They don't stop many visitors, or one with many
IPs, from spending the operator's OpenAI budget.

#### Goal
A deployment can't cost more than the operator decided. Optionally, only people with the passcode
can use it at all.

#### Scope
**In** — `DEAR_STEVEN_DAILY_BUDGET_USD` (estimated from token usage on every paid call; past the cap,
paid routes return a clear in-persona "I'm resting until tomorrow" reply); optional
`DEAR_STEVEN_ACCESS_CODE` (signed, HTTP-only cookie after one entry; `/api/*` refuses without it);
a spend line in `/api/status` and the setup panel.
**Out** — accounts; payments.

#### Acceptance criteria
- [ ] With a tiny cap, the request after the cap gets the resting reply and no OpenAI call is made.
- [ ] With an access code set, every API route returns 401 without the cookie (route tests for
  each).
- [ ] P5-10 (deploy) depends on this issue.

#### Tests required
Spend-ledger unit tests; route tests; e2e for the passcode screen.

#### Security notes
The core budget protection (SR-02). Cookie: `Secure`, `HttpOnly`, `SameSite=Strict`, signed
with a server secret.

#### Skills to consult
`dear-steven-security` (mandatory).

#### Dependencies
None. **Size:** M.

---

### P6-09 — feat(security): strict Content-Security-Policy with per-request nonces, and HSTS

<!-- issue {"id":"P6-09","title":"feat(security): strict Content-Security-Policy with per-request nonces, and HSTS","labels":["type:security","stage:m4","track:security","track:web","owner:ai","risk:medium","P1","size:M"],"milestone":"M4 Reach and trust","depends":[],"github":9} -->

#### Context
P5-05 added a CSP for frames, media, objects, base and forms. `script-src`, `style-src` and
`connect-src` are still open, because Next's inline bootstrap scripts need nonces.

#### Goal
A policy that would stop an injected script: `script-src 'self' 'nonce-…' 'strict-dynamic'`,
`connect-src 'self'`, `img-src 'self' data:`, plus `Strict-Transport-Security` in production.

#### Scope
**In** — nonce generated per request in the proxy (`proxy.ts`), passed to Next; pages that need it
rendered dynamically; header tests; a CSP report endpoint in dev only.
**Out** — Trusted Types (follow-up if cheap).

#### Acceptance criteria
- [ ] The e2e suite passes with the strict policy and records no CSP violations.
- [ ] An inline `<script>` injected without the nonce is blocked (e2e).

#### Tests required
`e2e/api.spec.ts` header assertions; a violation listener in the e2e suite.

#### Security notes
Prerequisite for anything that holds a secret in the browser (P6-03). Update SR-15.

#### Skills to consult
`dear-steven-security` (mandatory); Next.js docs in `node_modules/next/dist/docs/` on CSP.

#### Dependencies
None. **Size:** M.

---

### P6-10 — ci(security): dependency and code scanning, and a full-history secret scan

<!-- issue {"id":"P6-10","title":"ci(security): dependency and code scanning, and a full-history secret scan","labels":["type:security","stage:m4","track:infra","track:security","owner:ai","risk:medium","P1","size:S"],"milestone":"M4 Reach and trust","depends":[],"github":10} -->

#### Context
The first CI run on GitHub showed that `gitleaks` errors on a repository's first push: its range
starts at the root commit's missing parent. Nothing watches dependencies for vulnerabilities.

#### Goal
Secrets, vulnerable dependencies and risky code are caught automatically.

#### Scope
**In** — gitleaks full-history scan on `workflow_dispatch` and weekly; Dependabot for npm and
GitHub Actions (keeping SHA pins); `pnpm audit --prod --audit-level=high` in `check`; CodeQL for
JavaScript/TypeScript where available (free on public repos; private repos need GitHub Advanced
Security, so record whichever applies).
**Out** — paid scanners.

#### Acceptance criteria
- [ ] A manual run scans the whole history and passes.
- [ ] A planted fake key in a test branch fails the scan (then removed).
- [ ] Dependabot opens update PRs whose titles pass `pr-title`.

#### Tests required
The CI runs themselves (links in the PR).

#### Security notes
Actions stay pinned by SHA; least-privilege `permissions:` per job (SR-14).

#### Skills to consult
`dear-steven-security` (mandatory).

#### Dependencies
None. **Size:** S.

---

### P6-11 — feat(security): safety rails for high-stakes questions

<!-- issue {"id":"P6-11","title":"feat(security): safety rails for high-stakes questions","labels":["type:security","stage:m4","track:core","track:eval","track:answers","track:security","owner:ai","risk:high","needs:human-review","P1","size:M"],"milestone":"M4 Reach and trust","depends":[],"github":11} -->

#### Context
Persona v2 (P6-06) gives concrete advice. Some questions need more than a confident opinion:
self-harm and crisis, medical symptoms and medication, legal exposure, large financial decisions.
Some inputs also try to make the persona say harmful things in Steven's voice.

#### Goal
Concrete where it helps, careful where it matters. Crisis questions always get real help first,
and the persona can't be steered into harmful or defamatory statements in Steven's name.

#### Scope
**In** — free moderation check on the question (OpenAI moderation endpoint) before retrieval;
a crisis path (in-persona, resources by locale, no persona theatre); for medical, legal and
financial questions, a concrete view plus a clear "this is where a professional matters" line;
refusal style for requests to impersonate Steven saying things he never said; a red-team eval set
(prompt injection in questions and transcripts, defamation bait, crisis phrasing) that runs in
`pnpm eval`.
**Out** — storing flagged questions.

#### Acceptance criteria
- [ ] Every red-team case passes (no harmful content; crisis cases lead with resources).
- [ ] Ordinary hard questions are not over-refused (false-refusal rate reported, ≤ 5% on the
  normal eval set).

#### Tests required
`eval/redteam.json` in `pnpm eval`; unit tests for the routing.

#### Security notes
Brand and personal-harm risk: `risk:high`, human review of the red-team set and the crisis copy.

#### Skills to consult
`dear-steven-persona`, `dear-steven-security` (mandatory).

#### Human steps
Review the crisis copy and resource list per locale.

#### Dependencies
None. **Size:** M.

---

## Policies

### P6-12 — docs: terms of use, disclaimer and no liability — in the repo and in the app

<!-- issue {"id":"P6-12","title":"docs: terms of use, disclaimer and no liability — in the repo and in the app","labels":["type:docs","stage:m4","track:docs","track:policy","track:web","owner:ai","risk:medium","needs:human","P1","size:M"],"milestone":"M4 Reach and trust","depends":[],"github":12} -->

#### Context
The app says it is an AI persona and not affiliated with the show. There are no terms, no
disclaimer of liability, no takedown route and no privacy note in one place.

#### Goal
Plain-language policies the owner can stand behind, linked from every page:
- **Not Steven, not the show:** an independent, non-commercial fan project. It is not affiliated
  with, endorsed by or speaking for Steven Bartlett, The Diary Of A CEO or FlightStory.
- **No liability:** answers are AI-generated from public interviews, can be wrong, and are not
  professional (medical, legal, financial) advice; provided as is, with no warranty.
- **Non-commercial:** not to be sold or commercialised (see P6-13).
- **Pro-creator:** we encourage watching the original conversations on YouTube and supporting the
  show; we only show short, attributed excerpts that link back.
- **Takedown and privacy:** how to ask for content to be removed (the `purge` command exists),
  and what is sent to OpenAI and what is kept.

#### Scope
**In** — `DISCLAIMER.md`, `TERMS.md`, `PRIVACY.md` and a takedown section in `README.md`; a
"Terms & disclaimer" page in the app linked from the footer and "How this works"; a one-time,
dismissible first-visit notice; a contact address for takedowns.
**Out** — cookie banners (no tracking cookies exist).

#### Acceptance criteria
- [ ] Every page links to the terms; the first-visit notice appears once and is keyboard and
  screen-reader usable.
- [ ] A human has reviewed the wording (ideally a lawyer: this is not legal advice).

#### Tests required
E2E: footer link, notice once per browser, axe audit of the page.

#### Security notes
Accurate privacy statements are a requirement, not marketing: they must match the code
(OpenAI calls, browser storage, no server-side logs of questions).

#### Human steps
Wording review; the takedown contact address.

#### Dependencies
None. **Size:** M.

---

### P6-13 — chore(repo): a non-commercial licence

<!-- issue {"id":"P6-13","title":"chore(repo): a non-commercial licence","labels":["type:docs","stage:m4","track:docs","track:policy","owner:ai","risk:medium","needs:decision","P1","size:S"],"milestone":"M4 Reach and trust","depends":[],"github":13} -->

#### Context
The repository is MIT-licensed, which allows commercial use and resale. The owner wants the
project never to be commercialised.

#### Goal
A licence that allows reading, running and modifying for non-commercial purposes only.

#### Scope
**In** — replace `LICENSE` (recommendation: PolyForm Noncommercial 1.0.0 for code; CC BY-NC 4.0 if
docs need their own); README licence section; check dependency licences stay compatible
(MIT / Apache / ISC; React Bits' MIT + Commons Clause already forbids selling its components);
`package.json` `license` fields.
**Out** — trademark registration.

#### Acceptance criteria
- [ ] The owner picked the licence (`needs:decision`), and it's in place everywhere.
- [ ] A licence-compatibility table of direct dependencies is in the PR.

#### Security notes
None.

#### Human steps
Choose the licence. Note: copies already distributed under MIT keep MIT terms. The repository has
been private so far, so that is unlikely to matter.

#### Dependencies
None. **Size:** S.

---

## YouTube

### P6-14 — feat(web): send people to the originals — YouTube on every episode, card and answer

<!-- issue {"id":"P6-14","title":"feat(web): send people to the originals — YouTube on every episode, card and answer","labels":["type:ui","stage:m4","track:web","track:youtube","track:policy","owner:ai","risk:low","P1","size:M"],"milestone":"M4 Reach and trust","depends":["P6-15"],"github":14} -->

#### Context
Only citation chips link to YouTube (in the drawer's Video tab). Episode cards under an answer,
the episode explorer and spoken replies don't, and nothing invites people to watch the show.

#### Goal
Every place an episode appears offers "Watch the full conversation on YouTube". Every answer ends
with a quiet invitation to watch the conversations it drew on, and "How this works" links to the
channel and says why: watch the originals and support the show.

#### Scope
**In** — episode cards and explorer rows link to the video (timestamped where a citation exists);
an end-of-answer "Watch these conversations" row; channel link in About; links open the YouTube
app on mobile where installed (plain `https://youtube.com` links do this); copy in the persona's
voice.
**Out** — embedding more than the click-to-load player (P5-05); thumbnails that load before a
click.

#### Acceptance criteria
- [ ] Every episode shown anywhere has a YouTube link when it is matched, and says so when it
  isn't.
- [ ] No request to YouTube before a click (the P5-05 request-log test still passes).

#### Tests required
E2E with stubbed matched episodes; axe audit.

#### Design notes
One link style for "to YouTube" everywhere; no red YouTube branding; ember only for the primary
action.

#### Skills to consult
`docs/DESIGN.md`.

#### Dependencies
P6-15 (more episodes matched). **Size:** M.

---

### P6-15 — feat(ingest): match more episodes to their videos and get the timing right

<!-- issue {"id":"P6-15","title":"feat(ingest): match more episodes to their videos and get the timing right","labels":["type:service","stage:m4","track:ingest","track:core","track:youtube","owner:ai","risk:medium","P1","size:M"],"milestone":"M4 Reach and trust","depends":[],"github":15} -->

#### Context
`pnpm ingest match-youtube` matches by title and date and marks timing `exact`, `estimated` or
`unknown`. It has not run on the real feed yet. Video and podcast audio often differ by an intro or
ads, so timestamps can be off.

#### Goal
Most episodes linked to the right video, and citations opening the video at the right second, with
honest `≈` where it is estimated.

#### Scope
**In** — scoring on title, guest, date and duration (Shorts and clips excluded); a report of
unmatched and low-confidence matches; offset estimation from duration differences and chapter
timestamps in video descriptions; `exact` only when verified (a chapter or a manual `align`);
coverage in `pnpm ingest status`.
**Out** — downloading video or captions.

#### Acceptance criteria
- [ ] On the real feed, ≥ 90% of full episodes since 2020 are matched; a human spot-check of 20
  links finds no wrong video.
- [ ] Of 20 spot-checked estimated timestamps, ≥ 16 land within 10 seconds.

#### Tests required
Matcher unit tests on recorded API fixtures; offset estimator tests.

#### Security notes
Uses the free YouTube Data API quota; uploads are listed at about 1 unit per 50 videos.

#### Skills to consult
`dear-steven-architecture` (YouTube link building lives in core).

#### Human steps
The 20-link spot check.

#### Dependencies
None. **Size:** M.

---

## Suggested

### P6-16 — feat(ingest): stay current — pick up new episodes on a schedule

<!-- issue {"id":"P6-16","title":"feat(ingest): stay current — pick up new episodes on a schedule","labels":["type:infra","stage:m4","track:ingest","track:infra","owner:ai","risk:medium","P2","size:M"],"milestone":"M4 Reach and trust","depends":["P5-10"],"github":16} -->

#### Context
The show publishes several episodes a week. The knowledge base only grows when someone runs
`pnpm ingest`.

#### Goal
New episodes appear within a day, without a person in the loop, inside a spend cap.

#### Scope
**In** — a scheduled job on the deployment (discover → free transcripts → chunk → embed → YouTube)
with a per-run budget; a "new this week" line in the explorer.
**Out** — scheduled paid diarization.

#### Acceptance criteria
- [ ] An episode published yesterday is answerable today on the deployment.
- [ ] A run over budget stops before spending and reports it.

#### Tests required
Dry-run of the scheduled command in CI against a fixture feed.

#### Security notes
Unattended paid calls: the budget cap is mandatory.

#### Dependencies
P5-10 (a deployment to run on). **Size:** M.

---

### P6-17 — feat(web): share an answer with its sources

<!-- issue {"id":"P6-17","title":"feat(web): share an answer with its sources","labels":["type:ui","stage:m4","track:web","owner:ai","risk:medium","P2","size:M"],"milestone":"M4 Reach and trust","depends":["P6-12"],"github":17} -->

#### Context
A good answer can't be shared except by screenshot, and a screenshot loses the sources.

#### Goal
"Share" produces a link or an image card of the answer with its citations and YouTube links. It
always carries the AI-persona disclosure.

#### Scope
**In** — the answer encoded in the link's fragment (never stored on a server) and re-validated when
opened, as stored conversations are (P5-11); an image card rendered in the browser; the disclosure
on both.
**Out** — server-side share storage.

#### Acceptance criteria
- [ ] A shared link opens the same answer and sources in another browser.
- [ ] A tampered link can't inject links or markup (same checks as restored conversations).

#### Tests required
Unit tests for encode/validate; e2e open-shared-link.

#### Security notes
Shared content is untrusted input; the disclosure can't be removed from a share.

#### Dependencies
P6-12 (terms to link to). **Size:** M.

---

### P6-18 — feat(web): was this useful? — answer feedback that feeds the eval

<!-- issue {"id":"P6-18","title":"feat(web): was this useful? — answer feedback that feeds the eval","labels":["type:ui","stage:m4","track:web","track:eval","owner:ai","risk:medium","P2","size:S"],"milestone":"M4 Reach and trust","depends":["P3-08"],"github":18} -->

#### Context
The only signal on answer quality is the eval set. Real questions where an answer fell short are
the best test cases, and today they are lost.

#### Goal
Useful / not useful on each answer, with an optional "what was missing". It is kept only where the
operator opted in, and turns into eval cases.

#### Scope
**In** — two quiet buttons per answer; stored locally, or sent to the operator's
`data/feedback.jsonl` only when `DEAR_STEVEN_LOG_FEEDBACK=1` and the visitor agreed; `pnpm eval`
can import feedback as candidate questions.
**Out** — analytics or tracking.

#### Acceptance criteria
- [ ] With logging off, nothing leaves the browser (request log test).
- [ ] Imported feedback becomes eval candidates a human approves.

#### Tests required
Route test (off/on); e2e for the buttons; eval import test.

#### Security notes
Questions can be personal: opt-in on both sides, and the privacy note (P6-12) says so.

#### Dependencies
P3-08. **Size:** S.
