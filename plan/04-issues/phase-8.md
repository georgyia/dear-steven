# Phase 8 — Summaries and open access (M6)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-13 | milestone M6 |

**Exit:** anyone can try Dear Steven on the operator's key for three questions, then carry on with
a key of their own, kept safely in their browser, while the operator's key stays secret. Every
indexed conversation has a summary you can read in a minute (what it's about, its topics, its
most interesting moments, and its best questions and answers), and every line of it opens the
moment it was said.

Issues are grouped by category; each category is a label on GitHub.

| Category | Label | Issues |
|----------|-------|--------|
| Security | `track:security` | P8-01, P8-02, P8-05, P8-08, P8-09 |
| Summaries | `track:summaries` | P8-03, P8-04 |

Owner decisions (2026-10-13): one free use is one **question**. Each Ask or Talk question
counts; a whole interview counts once. `risk:high` PRs in this milestone merge after green CI on
the owner's instruction, recorded on this board.

---

## Security

### P8-01 — fix(security): your own key, audited and kept encrypted, behind limits that can't be reset

<!-- issue {"id":"P8-01","title":"fix(security): your own key, audited and kept encrypted, behind limits that can't be reset","labels":["type:security","stage:m6","track:security","track:web","owner:ai","risk:high","needs:human-review","P0","size:M"],"milestone":"M6 Summaries and open access","depends":[],"github":71} -->

#### Context
The owner asked whether a visitor's key, once saved for the session, is really stored securely.
P6-03 built "bring your own key" (SR-19): the key travels only in the `x-openai-key` header to
this site, is validated, used for that request and dropped; a canary test proves it never reaches
a response or a log line. A first read of the code found four gaps:

- **At rest, it is plain text.** `sessionStorage` (or `localStorage` with "remember") holds the
  raw `sk-…` string. Same-origin rules and the strict CSP (SR-15) keep other sites and injected
  scripts away from it, but anything that reads the browser's files (a backup, an info-stealer
  scanning profiles for `sk-`) reads the key. A remembered key never expires.
- **The rate limiter can be emptied.** `takeToken` clears every bucket once 10,000 clients are
  tracked, including the global ones that stop this server being used to test stolen keys in
  bulk (`keyCheckAll`, `accessAll`). Ten thousand requests with made-up addresses reset them.
- **The client address is the client's to choose.** `clientKey` takes the *first*
  `X-Forwarded-For` hop, which the client writes; only the hops a proxy appends can be trusted.
- **Nothing proves the operator's key stays on the server.** It does by design (no
  `NEXT_PUBLIC_*`, no route returns it), but no test covers pages, the client bundle or every
  route.

#### Goal
A written review of how both keys are handled, and fixes for what it finds, so the answer to "is
my key safe here?" is yes, with evidence, and with its limits stated plainly.

#### Scope
**In**
- A review record, `plan/09-security/reviews/2026-10-13-keys.md`, covering storage, transport,
  server handling, logs, caches, third parties, browser extensions, shared computers and the
  operator's key. Each item gives the check, the evidence and the verdict.
- In the browser, the key is kept encrypted (AES-GCM under a non-extractable key held in
  IndexedDB), never as plain text in any storage. "Remember on this device" lasts 30 days.
  Forget deletes the ciphertext and the key.
- The rate limiter evicts the oldest entries instead of clearing everything, and never evicts a
  global bucket.
- The client address comes from the hop this deployment trusts (`DEAR_STEVEN_TRUSTED_PROXIES`, or
  the platform's client-IP header), never the first, client-written hop.
- A test with a canary operator key: it is absent from every API response, every page, the built
  client bundle and every log line.
- The own-key panel suggests a project key with a monthly budget.

**Out:** storing keys on a server or accounts (P8-05).

#### Acceptance criteria
- [ ] After a key is saved, `sessionStorage`, `localStorage` and IndexedDB contain no `sk-`
  string, in both modes (e2e reads all three), and the key still works after a reload.
- [ ] A remembered key older than 30 days is not sent and is deleted.
- [ ] Flooding the limiter with 20,000 made-up clients refills neither another client's bucket
  nor a global one (unit).
- [ ] A client-written `X-Forwarded-For` doesn't change which bucket a request lands in behind a
  trusted proxy (unit).
- [ ] The canary operator key appears in no API response, no page, no file under `.next/static`
  and no log line.
- [ ] The review lists every check with its evidence; SR-19 and SR-02 in `THREAT-MODEL.md` are
  updated.

#### Tests required
Unit: storage encryption and expiry (fake IndexedDB), limiter eviction, client address. Route:
the operator canary across every route on disk. Build: a scan of `.next/static`. E2E: storage
contents after "use" and "remember", reload, forget.

#### Security notes
Encryption at rest protects the key from someone reading the browser's files. It does not
protect it from a script running in the page, which can use the same key handle; the CSP is
what stops such scripts. The review must say so.

#### Skills to consult
`dear-steven-security` (mandatory), differential review, `plan/09-security/SECURE-CODING.md`.

#### Dependencies
None. **Size:** M.

---

### P8-07 — test(web): the sealed-key tamper test always changes what it tampers with

<!-- issue {"id":"P8-07","title":"test(web): the sealed-key tamper test always changes what it tampers with","labels":["type:test","track:web","owner:ai","risk:low","P1","size:S","stage:m6"],"milestone":"M6 Summaries and open access","depends":["P8-01"],"github":82} -->

#### Context
`lib/visitor-key.test.ts` › "treats anything else in storage as nothing" (#71) tampers with a
sealed key by setting its second-to-last character to `A`, or to `B` when the last character is
`A`. When that character already *is* `A`, nothing changes, the key opens, and the test fails.
With a random IV that happens about once in 64 runs, on any PR. It failed `check` on #80.

#### Goal
The tamper check always tampers.

#### Acceptance criteria
- [ ] The test changes a character of the ciphertext to one it is not, every time.
- [ ] 500 runs in a row pass.

#### Dependencies
P8-01. **Size:** S.

---

### P8-02 — feat(security): three free questions on the operator's key, then your own

<!-- issue {"id":"P8-02","title":"feat(security): three free questions on the operator's key, then your own","labels":["type:security","stage:m6","track:security","track:web","track:setup","owner:ai","risk:high","needs:human-review","P1","size:L"],"milestone":"M6 Summaries and open access","depends":["P8-01"],"github":72} -->

#### Context
A public deployment today does one of two things. It runs everyone on the operator's key,
bounded only by the daily cap (P6-08), or it runs no one on it
(`DEAR_STEVEN_ALLOW_OPERATOR_KEY=0`). The owner wants a middle way: anyone can try a few questions
for free, then continues with their own key, which stays in their browser. Nobody may ever see
the operator's key.

#### Goal
`DEAR_STEVEN_FREE_QUESTIONS=3`: each visitor without a key of their own gets three questions on
the operator's key. After that, Dear Steven explains, once and plainly, how to add their own key,
and carries on with it.

#### Scope
**In**
- **Config.** `DEAR_STEVEN_FREE_QUESTIONS`: unset means no per-visitor limit (as today); `0`
  means none; `n` means n. An unreadable value is treated as 0 (fail closed).
- **What counts.** Each Ask or Talk question answered on the operator's key. An interview counts
  once, at its first question, and gets a signed ticket that covers its usual length. A ticket
  can't be forged, moved to another visitor, or used past that length. A question that costs
  nothing (refused before a paid call, a safety reply without one, a server error) is not
  counted.
- **Who.** Each visitor gets an anonymous cookie (`HttpOnly`, `Secure`, `SameSite=Lax`, a random
  id and nothing else). The network it comes from is also counted: the client address from
  P8-01, IPv6 by /64, stored only as an HMAC.
  - Each visitor gets `n` questions; each network gets `3n` per 30 days. Clearing cookies
    therefore doesn't reset anything for long, while a shared office still gets several people's
    worth.
  - The ledger is `data/free-questions.json`, beside the spend ledger. It is pruned after 30
    days, bounded in size, and fails closed when full.
  - The daily cap still bounds the total.
- **Running out.** `/api/ask` and `/api/interview` answer `needs_key` without calling OpenAI. The
  conversation shows a notice with "Use your own key", which opens the setup panel there.
  `/api/status` reports this visitor's remaining free questions; the composer shows it quietly
  once the first one is used.
- **Voice.** Server voice on the operator's key (`/api/speech` takes any text,
  `/api/transcribe` any audio) is not offered on free questions. The browser's own speech
  recognition and voices still work.
- **Own key.** Unlimited, never counted, never stopped by the cap (as today).

**Out:** accounts and sign-in (P8-05), paid plans, daily resets.

#### Acceptance criteria
- [ ] With `n = 3`, a fresh visitor gets three answers on the operator's key. The fourth gets
  `needs_key` with no OpenAI call (route test with a network guard).
- [ ] A new cookie gives a new allowance only until the network's `3n` are used.
- [ ] A whole interview counts once. A forged, expired, foreign or overused ticket is refused
  without a call.
- [ ] With their own key, a visitor who used up the free questions carries on, uncounted.
- [ ] Server voice on the operator's key refuses visitors on free questions; browser voice still
  works (e2e).
- [ ] The ledger holds no raw address or cookie id, prunes after 30 days, and fails closed when
  unreadable or full.
- [ ] E2E against a fake OpenAI: three answers, the notice, add a key, a fourth answer; axe clean;
  EN and DE.
- [ ] `PRIVACY.md`, `DEPLOY.md`, `.env.example` and SR-02/SR-19 describe it.

#### Tests required
Unit: allowance, network window, pruning, tickets. Route: counting and refusals with no network
call. E2E: the full flow against the fake OpenAI used by the setup e2e.

#### Security notes
A determined visitor with many addresses can get more than three. The daily cap is what bounds
the operator's bill, and the PR must say so. Cookies carry no personal data; the privacy page
explains the cookie and the network counter.

#### Skills to consult
`dear-steven-security` (mandatory), differential review, `dear-steven-architecture`, frontend
design skills, `docs/DESIGN.md`.

#### Dependencies
P8-01 (trusted client address). **Size:** L.

---

### P8-05 — chore(infra): accounts and server-side key storage with Supabase — decide first

<!-- issue {"id":"P8-05","title":"chore(infra): accounts and server-side key storage with Supabase — decide first","labels":["type:infra","stage:m6","track:infra","track:security","owner:ai","risk:high","needs:human-review","needs:decision","P2","size:L"],"milestone":"M6 Summaries and open access","depends":["P8-02"],"github":73} -->

#### Context
The owner mentioned Supabase for later. Today Dear Steven has no accounts. Free questions
(P8-02) are counted per browser and per network, which a determined visitor can get around, and
a visitor's key lives only in their browser, so it doesn't follow them to another device.

#### Goal
A decision, written down, on whether and how to add accounts (Supabase Auth) and, separately,
whether to keep visitors' keys on the server.

#### Questions for the owner
- **Accounts for free questions.** Sign-in with email (magic link) or Google, so the allowance is
  per person. This is stronger than cookies, but asks people to sign in before they try anything.
- **Keys on the server.** Encrypted with envelope encryption (Supabase Vault or a KMS), so a key
  follows its owner across devices. The trade-off: a database of working OpenAI keys becomes the
  most valuable thing to steal, and its breach would be the operator's responsibility. The
  default recommendation is **no**: keep keys in the browser.
- **Hosting.** Supabase's free tier, region (EU for GDPR), and what moves there (only accounts,
  or also the spend and free-question ledgers).

#### Acceptance criteria
- [ ] An ADR (`plan/12-adr/`) records the decision and its reasons.
- [ ] If accepted, follow-up issues are written and this one is closed.

#### Dependencies
P8-02. **Size:** L (if accepted).

---

### P8-08 — fix(security): the API refuses requests sent from other sites' pages

<!-- issue {"id":"P8-08","title":"fix(security): the API refuses requests sent from other sites' pages","labels":["type:security","stage:m6","track:security","track:web","owner:ai","risk:high","needs:human-review","P0","size:S"],"milestone":"M6 Summaries and open access","depends":[],"github":94} -->

#### Context
The paid routes (`/api/ask`, `/api/interview`, `/api/speech`, `/api/transcribe`) and the free ones
that take a body (`/api/share`, `/api/access`) don't look at where a request comes from. `/api/ask`
and `/api/interview` parse any body as JSON whatever its type; `/api/transcribe` takes a form. So a
page on **any other site** can make its visitors' browsers send questions with a "simple" request
(`text/plain` or a form), which needs no preflight:

```js
fetch('https://dear-steven.example/api/ask', { method: 'POST', mode: 'no-cors', body: '{"question":"…","history":[]}' })
```

That page can't read the answer, but the server still makes the call. Found in the security re-check
of 2026-10-15 (`plan/09-security/reviews/2026-10-15-free-questions.md`). A production server
answered such a request (`Origin: https://attacker.example`, `Sec-Fetch-Site: cross-site`,
`text/plain`) with `200` and a streamed answer.

- **Who pays:** the operator, up to the daily cap. Each of the other site's visitors is a real
  browser at a real address, so per-address limits don't stop it.
- **Free questions:** no `ds_visitor` cookie goes with a cross-site POST (`SameSite=Lax`), so each
  request counts as a new visitor on that visitor's network. Those networks lose their free
  questions for 30 days.
- **Without free questions set:** the operator's key answers them, limited only per address.
- **With an access code set:** the `SameSite=Strict` access cookie isn't sent, so these requests are
  already refused (401).

#### Goal
Only this site's own pages can call its API from a browser.

#### Acceptance criteria
- [ ] The proxy (`src/proxy.ts`) answers `403` to any `/api/*` request that isn't `GET`, `HEAD` or
      `OPTIONS` and comes from another site, before any route runs: no rate-limit token, no free
      question, no OpenAI call. "Another site" means:
  - Fetch Metadata `Sec-Fetch-Site` is `cross-site` or `same-site`;
  - or, without Fetch Metadata, `Origin` is `null` or names a host other than the request's `Host`
    (or `X-Forwarded-Host`).
- [ ] Unaffected:
  - this site's own requests (`same-origin`, or a matching `Origin`);
  - requests with neither header (scripts, `curl`), which are limited as before;
  - `GET` reads;
  - `/api/setup`, which has its own stricter check and answers `404`.
- [ ] Unit tests on the proxy: every `POST` route on disk refuses a cross-site request and passes a
      same-origin one, plus each header case.
- [ ] e2e against the production server: a cross-site question is refused and the visitor's free
      questions are untouched.
- [ ] Mutation-checked: with the check removed, the tests fail.
- [ ] THREAT-MODEL gets a new SR-23 row; DEPLOY says what a proxy in front must keep (`Host`, or
      `X-Forwarded-Host`).

#### Dependencies
None. **Size:** S.

---

### P8-09 — fix(security): free questions need a daily cap

<!-- issue {"id":"P8-09","title":"fix(security): free questions need a daily cap","labels":["type:security","stage:m6","track:security","track:web","owner:ai","risk:high","needs:human-review","P1","size:S"],"milestone":"M6 Summaries and open access","depends":[],"github":95} -->

#### Context
Free questions (P8-02) count per browser (n) and per network (3n), and the code and the docs both
say the daily cap is what bounds the bill when someone has many addresses. But nothing makes the cap
required. With `DEAR_STEVEN_FREE_QUESTIONS=3` and no `DEAR_STEVEN_DAILY_BUDGET_USD`, the operator's
key answers strangers with no bound but per-address limits. An IPv6 /48, which a cheap server comes
with, holds 65,536 /64 networks: about 590,000 free questions. Found in the security re-check of
2026-10-15 (`plan/09-security/reviews/2026-10-15-free-questions.md`).

#### Goal
Free questions are given only when a daily cap bounds what they can cost.

#### Acceptance criteria
- [ ] With free questions set and no daily cap:
  - no free question is given: `/api/ask` and `/api/interview` answer `needs_key` with no OpenAI
    call;
  - `/api/status` reports none left;
  - the server log says why once per process, naming both variables.
- [ ] With a cap set (any value, including `0`), nothing changes. A visitor's own key is never
      affected.
- [ ] The `needs_key` sentence reads right when a visitor had none, in English and German.
- [ ] Tests:
  - unit, each case and the log line;
  - routes against the fake OpenAI, with no network call;
  - the e2e free-questions server gets a cap.
- [ ] `docs/DEPLOY.md`, `.env.example` and THREAT-MODEL SR-02 say the cap is required.

#### Dependencies
None. **Size:** S.

---

## Summaries

### P8-03 — feat(ingest): episode summaries, with every line quoted from the transcript

<!-- issue {"id":"P8-03","title":"feat(ingest): episode summaries, with every line quoted from the transcript","labels":["type:core","stage:m6","track:core","track:ingest","track:summaries","owner:ai","risk:medium","P1","size:L"],"milestone":"M6 Summaries and open access","depends":[],"github":74} -->

#### Context
The explorer lists 114 indexed conversations, most of them one to three hours long. To know
whether one is worth your time, or to recall what was said, you have to watch it. The owner asked
for a summary of each one: the most interesting facts, the topics, and the questions and answers.

Draft #33 (P6-07, waiting on the owner) has its own `summarise` command, which writes a short
overview for the answer model into `episodes.summary` and never shows it to anyone. This issue
takes the command name and keeps its own table. If #33 is accepted, its overview comes from this
summary's About section: one run, one cost.

#### Goal
For each indexed episode, a stored summary in which every fact, question and answer is a span
of its transcript, with the moment it was said:

- **About:** two or three sentences, machine-written and labelled so.
- **Topics:** what was discussed, each with where it starts.
- **Most interesting moments:** facts, claims and stories, quoted.
- **Questions and answers:** the best exchanges, quoted.

#### Scope
**In**
- A core `summary` module: the prompt (the transcript as untrusted, neutralised text, SR-03), a
  strict JSON schema, and validation in code.
  - Every quote is located in the episode's passages (`locateQuote`) and carries its passage id
    and start time. An item that can't be located is dropped, never rewritten.
  - Items are deduplicated and ordered by time.
  - Every number in the overview must appear in the transcript.
  - Names may come only from the episode's metadata.
- **Speakers.** All current transcripts are RSS captions without speaker labels, so no question
  or answer names who said it unless the transcript attributes it. The summary marks them
  "speakers not verified".
- **Storage.** A store migration (`episode_summaries`: episode, summary version, model, JSON,
  created), read by episode id.
- **Generation.** `pnpm ingest summarise [--limit n] [--dry-run] [--budget usd] [--force]` prints
  its estimate first, embeds nothing, and stops at the budget. `pnpm ingest latest --budget`
  summarises new episodes too.
- **Eval.** `pnpm eval:summaries` judges faithfulness and usefulness on 10 episodes; the
  baseline is saved.

**Out:** the reading view (P8-04), a show-wide summary, translations (summaries stay in English
and are marked `lang="en"`, like transcripts).

#### Acceptance criteria
- [ ] Every fact, question and answer in a stored summary is a stored transcript span, with its
  passage and time (unit and eval).
- [ ] No question or answer names a speaker the transcript doesn't attribute.
- [ ] The overview is labelled machine-written, quotes nothing, and every number in it appears in
  the transcript.
- [ ] `--dry-run` prints the estimate with no call; a run stops at `--budget`.
- [ ] Live, all indexed episodes summarised within the estimate. On 10 judged episodes: overview
  faithful 10/10, and on average at least 4 topics, 5 moments and 3 exchanges per episode.

#### Tests required
Unit: validation (unlocatable quote dropped, numbers, names, dedupe, order), prompt snapshot,
store round trip and migration, CLI estimate and budget. Eval: `pnpm eval:summaries`.

#### Security notes
Transcript text is untrusted input to the model (SR-03). Output is validated in code before it is
stored. Spend is bounded by `--budget`, and the owner's $5 allowance covers the first full run
(about $0.45 estimated).

#### Skills to consult
`dear-steven-persona`, `dear-steven-architecture`, TypeScript clean-code and testing skills.

#### Dependencies
None. **Size:** L.

---

### P8-04 — feat(web): read an episode's summary in the explorer

<!-- issue {"id":"P8-04","title":"feat(web): read an episode's summary in the explorer","labels":["type:ui","stage:m6","track:web","track:design","track:summaries","owner:ai","risk:low","P1","size:M"],"milestone":"M6 Summaries and open access","depends":["P8-03"],"github":75} -->

#### Context
P8-03 stores a summary for each episode; nobody can see them yet.

#### Goal
Open an episode in the explorer and read its summary in a minute. Every line opens the moment it
was said.

#### Scope
**In**
- A Summary view for each episode in the explorer, with four sections:
  - About: labelled machine-written.
  - Topics: each with its time.
  - Most interesting moments: set like the pull quotes.
  - Questions and answers: in pairs, marked "speakers not verified" where they are.
- Each item opens the evidence drawer at its passage.
- `GET /api/episodes/[id]/summary`: returns the stored summary only, no other transcript text.
  No OpenAI call, rate limited.
- An episode without a summary says so plainly.
- Demo mode uses a fixture summary built from the demo passages and labelled demo.
- EN and DE interface; the quoted content stays English with `lang="en"`.

**Out:** generating a summary from the browser.

#### Acceptance criteria
- [ ] Every item opens the evidence drawer at its passage and time.
- [ ] An episode without a summary shows a plain notice, not an error.
- [ ] The route returns the summary and nothing else from the transcript.
- [ ] 375 and 1280 px, keyboard, reduced motion, axe clean, no "·".

#### Tests required
Route: summary shape, missing summary, rate limit. E2E (demo): open, read, open a moment, axe,
both locales.

#### Design notes
`docs/DESIGN.md`: the ember hairline and display serif of pull quotes for moments; mono
timestamps; one column on phones.

#### Skills to consult
Frontend design skills, `docs/DESIGN.md`, `dear-steven-architecture`.

#### Dependencies
P8-03. **Size:** M.

---

## Maintenance

### P8-10 — fix(ingest): paid transcription in batches: only episodes with no transcript, and no audio left on disk

<!-- issue {"id":"P8-10","title":"fix(ingest): paid transcription in batches: only episodes with no transcript, and no audio left on disk","labels":["type:service","stage:m6","track:ingest","owner:ai","risk:medium","P1","size:S"],"milestone":"M6 Summaries and open access","depends":[],"github":99} -->

#### Context
The owner asked for 186 more conversations to be transcribed from their audio, with speaker labels
(H-05), to reach 300 of 739. That's about $133 and 368 hours of audio. Three things in `pnpm ingest
transcribe --diarize` stand in the way of a batch that size:

- **It picks the wrong episodes.** It takes every episode not yet diarized, newest first, so
  `--limit 186` would re-do the 114 that already have the publisher's transcripts before reaching
  any of the 625 that have none.
- **It fills the disk.** Each episode's audio (about a megabyte a minute, 112 MB on average for
  these) stays in `data/cache/audio/` after use. The batch would leave about 21 GB on a disk with 16
  GB free.
- **A download cut short is taken for the whole file.** A run of 186 downloads will see a dropped
  connection. The partial file is kept under its final name and used next time.

#### Goal
A paid transcription batch adds only conversations that have no transcript, can run to the end on a
nearly full disk, and can be stopped and resumed.

#### Acceptance criteria
- [ ] `--missing` takes only episodes with no transcript (status not `fetched`), newest first.
      Without it, behaviour is as before.
- [ ] Each episode's audio and chunks are deleted after it, whether it worked or failed.
- [ ] Downloads go to `<file>.part` and are renamed when complete; a cut-short download leaves
      nothing under the final name.
- [ ] The run says first how many episodes it covers, roughly what they cost, and where it stops.
- [ ] A diarization request gets long enough to finish (minutes, not the shared client's 60 s),
  and a timeout is never tried again: OpenAI may have billed it. *(Added after the first real run
  timed out, 2026-10-15.)*
- [ ] Tests for each, mutation-checked. INGESTION and the H-05 runbook name `--missing`.

#### Dependencies
None. **Size:** S.

---

### P8-11 — fix(ingest): a diarized voice is credited to the guest only when the labels leave no doubt

<!-- issue {"id":"P8-11","title":"fix(ingest): a diarized voice is credited to the guest only when the labels leave no doubt","labels":["type:service","stage:m6","track:ingest","track:answers","owner:ai","risk:medium","P0","size:S"],"milestone":"M6 Summaries and open access","depends":["P8-10"],"github":101} -->

#### Context
`mapDiarizedSegments` credits every voice that isn't the enrolled host to the episode's guest, by
name when there is one. But OpenAI doesn't always recognise the host. On 2026-10-15 the same five
minutes of the Oz Pearlman episode was diarized twice:
- the first time, 5 s went to "Steven" and 47 s to a second voice "B";
- the second time, all 50 s went to "Steven", and there was no "B".

So "B" was Steven, unrecognised. In a one-guest episode he would have become "Oz Pearlman said…":
words in a real person's mouth that he never said. Attribution may only be weakened when in doubt
(`SECURE-CODING.md` §5, SR-04), never strengthened.

#### Goal
A diarized transcript credits a voice to the guest only when the labels leave no doubt; anything
else is "speaker not verified", as RSS transcripts are today.

#### Acceptance criteria
- [ ] Per chunk, voices other than the host are credited to the guest(s) only when the host was
      heard in that chunk and the other voices are no more than the episode's known guests (one when
      none is known). Named only for a sole guest, as before.
- [ ] Otherwise those segments are `unknown` with `attributionMethod: 'none'`; the host's own
      segments stay `host`.
- [ ] Unit tests: the B case above, a chunk with no host, a panel with too many voices, a clean
      chunk unchanged.
- [ ] Mutation-checked; INGESTION and the attribution notes say so.

#### Dependencies
P8-10 (#99). **Size:** S.

---

### P8-06 — chore(ci): give the e2e job room for the servers it now runs

<!-- issue {"id":"P8-06","title":"chore(ci): give the e2e job room for the servers it now runs","labels":["type:infra","track:infra","owner:ai","risk:low","P1","size:S","stage:m6"],"milestone":"M6 Summaries and open access","depends":[],"github":81} -->

#### Context
#79 (P8-02) adds a production server on a fake operator key, with its tests, to the e2e run.
#77 added another. On CI the Playwright tests then took 19.1 minutes. With install, the browser
download and the build on top, the job hit its 20-minute `timeout-minutes` and was cancelled after
every one of the 168 tests had passed (run 38483667362).

#### Goal
The e2e job finishes with room to spare, so a green suite is never reported as cancelled.

#### Acceptance criteria
- [ ] The e2e job's limit is 30 minutes, and the other jobs keep theirs.
- [ ] CI on this PR passes.

#### Dependencies
None. **Size:** S.
