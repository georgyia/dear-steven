# Phase 10 — Launch readiness (M8)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-16 | milestone M8 |

**Exit:** a public deployment can't spend the operator's key without a cap. It reports when it
can't answer, and it starts from a committed configuration and a written runbook. Nobody gets an
unchecked answer, or a helpline that can't help them. Visitors see their own kind of error, an
error page in the product's design, and an honest link preview. The privacy notice says where data
goes, and the legal notice is one step away from publishing.

The owner's request (2026-10-16): *"fix what needs to be fixed before launch"*, after a read-only
launch audit of the whole repository. These are the gaps an agent can close. The ones only a
person can close are listed under **Not in this milestone**.

Issues are grouped by category; each category is a label on GitHub.

| Category | Label | Issues |
|----------|-------|--------|
| Deployment | `track:infra` | P10-01, P10-02, P10-03 |
| Security and safety | `track:security` | P10-04, P10-05, P10-06, P10-07 |
| Visitor-facing | `track:web` | P10-08, P10-09, P10-10, P10-11 |
| Policies | `track:policy` | P10-12 |

**Merge policy for this milestone (owner, 2026-10-16):** every PR merges once `pnpm check`, the
build and `pnpm e2e` pass locally, `risk:high` included, because CI isn't running (billing). The
board records each one as merged on the owner's instruction.

**Not in this milestone (a person must act):** permission or a legal view on using the podcast
and the name, the contact address and the operator's details for the legal notice (P6-12), a
lawyer's review of the policies, the safety copy review (H-11) and German crisis replies (#35,
whose criteria need H-11 sign-off before merge), the hosting account and secrets (H-08), GitHub
billing, five graded live answers (H-07), the YouTube spot check (H-10) and voice on real devices.

---

## Deployment

### P10-01 — fix(security): a public deployment won't spend the operator's key without a daily cap

<!-- issue {"id":"P10-01","title":"fix(security): a public deployment won't spend the operator's key without a daily cap","labels":["type:security","stage:m8","track:security","track:infra","owner:ai","risk:high","needs:human-review","P0","size:S"],"milestone":"M8 Launch readiness","depends":[],"github":105} -->

#### Context
Every limit on the operator's key is opt-in (`packages/core/src/config/env.ts`). With only
`OPENAI_API_KEY` set:

- the key is used (`DEAR_STEVEN_ALLOW_OPERATOR_KEY` defaults to on);
- there is no daily cap (`DEAR_STEVEN_DAILY_BUDGET_USD` unset means none);
- there is no per-visitor limit.

The only brake left is the per-network rate limit. The Docker example in `docs/DEPLOY.md` sets
exactly that one variable. A deployment made by copying it is a public, uncapped endpoint on the
operator's account.

#### Goal
A production web server uses the operator's key only when a daily cap is set. Without one it
behaves as if no operator key was given, says why on `/api/status`, and logs it once.

#### Scope
**In**
- In the web server, under `NODE_ENV=production`, an operator key without a valid daily cap is
  not used. Visitors can still bring their own key (P6-03); otherwise it's demo. The reason
  (`no_daily_cap`) is decided in one place in core config and shown by `/api/status` and the
  setup panel.
- One log line when it happens, naming the variable to set.
- `docs/DEPLOY.md`: the Docker example sets a cap; the variable table says the cap is required
  for the operator's key in production.

**Out:** `pnpm dev` and the ingest CLI (not production web servers). Changing what a cap of `0`
means.

#### Acceptance criteria
- [ ] Production, operator key, no cap: no OpenAI call is made on the operator's key, and
  `/api/status` reports demo with reason `no_daily_cap` (route test).
- [ ] Production, operator key, cap set: live, as today (route test).
- [ ] A visitor's own key still works on a server held back this way (route test).
- [ ] Development and the CLI are unchanged (unit).
- [ ] The e2e servers that run live set a cap, and `pnpm e2e` passes.

#### Tests required
Unit: the config decision for each combination of environment, key, cap and the allow flag.
Route: `/api/ask` and `/api/status` with and without a cap in production.

#### Security notes
SR-02 (budget drain) and SR-19 (the operator's cap). This closes a fail-open default. The
log line names the variable and never prints the key.

#### Skills to consult
`dear-steven-security`, `dear-steven-architecture`, TypeScript clean-code and testing skills.

#### Human steps
None. The owner picks the cap's value when deploying (H-08).

#### Dependencies
None. **Size:** S.

---

### P10-02 — feat(infra): a health check that fails when the site can't answer

<!-- issue {"id":"P10-02","title":"feat(infra): a health check that fails when the site can't answer","labels":["type:infra","stage:m8","track:infra","track:web","owner:ai","risk:medium","P0","size:S"],"milestone":"M8 Launch readiness","depends":["P10-01"],"github":106} -->

#### Context
The image's `HEALTHCHECK` (and the planned Fly check) polls `/api/status`, which is wrong in both
directions:

- it answers **401** when an access code is set (`apps/web/src/proxy.ts`), so a private
  deployment never looks healthy;
- it answers **200** in demo mode, with no database, or when the store can't be opened. A broken
  deployment looks fine.

If the data directory can't be written (for example a volume owned by root), the spend ledger and
the share and free-question secrets fail on every save. Only an error line in the log shows it.

#### Goal
`GET /api/health` answers 200 only when this deployment can do what it was configured to do, and
503 with a reason code otherwise. Container and platform checks use it.

#### Scope
**In**
- `/api/health`, outside the access gate. It returns `{ ok, reason? }`: no paths, messages, counts
  or spend.
  - 200 when demo is forced (`DEAR_STEVEN_DEMO`).
  - 200 when the server is keyless on purpose (visitors bring their own key) and the knowledge
    base is ready.
  - 200 when live and the knowledge base is ready.
  - "Ready" means the database opens, it has passages, and the data directory is writable.
  - 503 otherwise, with a reason: `no_database`, `empty`, `store_error`, `data_dir_read_only`
    or `no_daily_cap` (P10-01).
- `Dockerfile` `HEALTHCHECK` uses it.
- `docs/DEPLOY.md` names it.

**Out:** checking OpenAI from the health check (that would spend money on every poll).

#### Acceptance criteria
- [ ] 401 never: `/api/health` answers with the access code set and no cookie (proxy test).
- [ ] Each reason code is produced by its condition, and a ready deployment answers 200 (route
  tests with a fixture DB, an empty DB, a missing file, a read-only directory).
- [ ] The response holds nothing but `ok` and the reason code (route test).

#### Tests required
Route tests as above. Proxy test for the access-gate exemption.

#### Security notes
Public and unauthenticated by design. It reveals only a reason code, no counts, spend or
filesystem detail.

#### Skills to consult
`dear-steven-security`, `dear-steven-architecture`.

#### Human steps
None.

#### Dependencies
P10-01 (the `no_daily_cap` reason). **Size:** S.

---

### P10-03 — chore(infra): Fly.io configuration and a runbook for the knowledge base

<!-- issue {"id":"P10-03","title":"chore(infra): Fly.io configuration and a runbook for the knowledge base","labels":["type:infra","stage:m8","track:infra","owner:ai","risk:medium","P0","size:M"],"milestone":"M8 Launch readiness","depends":["P10-01","P10-02"],"github":107} -->

#### Context
P5-10 needs a committed `fly.toml`, and there is none. Nothing explains how the knowledge base
reaches a server, or how it is safely replaced there. Several facts are undocumented or out of
date:

- The local database runs in WAL mode. Copying the `.db` file alone ships a stale copy.
- The spend ledger, the free-question counts and the interview tickets are per machine. Two
  machines mean twice the cap.
- A Fly volume may be owned by root, while the app runs as `node`.
- Nothing describes backups.
- `plan/human/deploy.md` (H-08) predates the spend cap, the free questions and the client
  address.

#### Goal
The owner deploys by following `docs/DEPLOY.md` from an empty Fly account to a verified live site,
and can replace the knowledge base without corrupting it.

#### Scope
**In**
- `fly.toml`:
  - one machine, with no automatic second machine;
  - a volume mounted at `/data`;
  - `force_https`;
  - the `/api/health` check;
  - a VM size that fits the knowledge base in memory;
  - an app name and region for the owner to change.
- `docs/DEPLOY.md`, step by step:
  - create the app and the volume;
  - set the secrets (key, cap, free questions, client address, access code if private);
  - make a consistent copy of the database (`sqlite3 … ".backup …"`) and upload it;
  - set the file owner;
  - restart and verify with `/api/health` and `/api/status`;
  - replace the database later;
  - backups (volume snapshots, plus the copy kept locally, plus the deployment secrets);
  - why there is exactly one machine;
  - variables not to set (`OPENAI_ORG_ID` and `OPENAI_PROJECT_ID` would go out with visitors' keys).
- `plan/human/deploy.md` brought up to date.

**Out:** the deploy itself (H-08, P5-10's live acceptance), a custom domain, scheduled ingest
(P7-11).

#### Acceptance criteria
- [ ] `fly.toml` is valid TOML. Its port, mount path and health path match the image and
  `/api/health`.
- [ ] The database copy step is run locally on the real database, and the copy opens with
  sqlite-vec and passes `pnpm ingest status`.
- [ ] Every variable the web server reads is in the `docs/DEPLOY.md` table (checked against a grep
  of `process.env` / `env.` reads).
- [ ] P5-10 in `plan/04-issues/phase-5.md` points at this runbook; its live acceptance stays open.

#### Tests required
A unit check that `fly.toml`'s internal port, mount destination and health path match the
`Dockerfile` and the route. The database copy step run once and recorded in the PR.

#### Security notes
Secrets only through `fly secrets`, never in `fly.toml`. The runbook keeps the
`share-secret` / `free-secret` files on the volume and in the backup, never in git.

#### Skills to consult
`dear-steven-security`, naming and comments skills.

#### Human steps
H-08 uses this runbook.

#### Dependencies
P10-01, P10-02. **Size:** M.

---

## Security and safety

### P10-04 — fix(security): request bodies are capped before they are read

<!-- issue {"id":"P10-04","title":"fix(security): request bodies are capped before they are read","labels":["type:security","stage:m8","track:security","track:web","owner:ai","risk:medium","P1","size:S"],"milestone":"M8 Launch readiness","depends":[],"github":108} -->

#### Context
`/api/ask`, `/api/interview` and `/api/share` read the whole body with `req.text()`. Only then do
they compare its length, in characters rather than bytes, with their limit. `/api/speech` calls
`req.json()` with no limit at all. A client can make the server buffer an arbitrarily large body
before it is refused. `/api/transcribe` already checks `Content-Length` first.

#### Goal
Every route that reads a body refuses one over its limit without buffering it. Each limit is
counted in bytes.

#### Scope
**In:** one server helper that reads a request body up to a byte limit. It refuses early on a
`Content-Length` over the limit, and stops reading once the limit is passed when there is no
length or a false one. Every API route that reads a body uses it, each with its own limit.

**Out:** changing the limits' values, except to state them in bytes.

#### Acceptance criteria
- [ ] A body over the limit gets 413 on every body-reading route, with or without
  `Content-Length`, and the reader stops at the limit (route tests, with a streamed body that
  would never end).
- [ ] Bodies within the limit behave exactly as before (existing tests pass).
- [ ] A multi-byte body is measured in bytes (unit).

#### Tests required
Unit: the helper (exact limit, one byte over, no length, a false length, multi-byte). Route: one
over-limit case per route.

#### Security notes
SR-01, SR-20 and SR-22 (body limits): resource exhaustion before validation. Their threat-model
rows say the limit is enforced before the body is read.

#### Skills to consult
`dear-steven-security`, TypeScript testing skills.

#### Human steps
None.

#### Dependencies
None. **Size:** S.

---

### P10-05 — fix(security): a free question isn't used up when OpenAI fails to answer it

<!-- issue {"id":"P10-05","title":"fix(security): a free question isn't used up when OpenAI fails to answer it","labels":["type:security","stage:m8","track:security","track:web","owner:ai","risk:high","needs:human-review","P1","size:S"],"milestone":"M8 Launch readiness","depends":[],"github":109} -->

#### Context
`/api/ask` gives a free question back only when it cost nothing (`countedOnlyIfPaid`). The
question's embedding is paid for first, so suppose OpenAI then fails: a 429, a 5xx, a timeout or
a malformed answer. The visitor sees an error and has lost one of their three questions.
`/api/interview` follows the same rule. The rule exists so that a visitor can't stop a paid
answer and keep the question. That reason still holds.

#### Goal
A free question is given back when the answer fails on the server's or OpenAI's side before it
is complete, whatever it cost. A visitor who stops an answer still uses the question up, as now.

#### Scope
**In:** in `/api/ask` and `/api/interview`, the question (or interview) is counted unless one of
these holds:

- it cost nothing (as now);
- the stream ended in a server-side failure: a thrown error, or an `error` event from core,
  before the `final` event, without the visitor cancelling.

**Out:** changing what counts as one question; the daily cap (it still counts every cent).

#### Acceptance criteria
- [ ] OpenAI failing after the embedding (429, 500, timeout, malformed answer): the free count is
  unchanged (route tests against the fake model).
- [ ] A complete answer: counted (route test).
- [ ] The visitor aborting after a paid call: counted (route test).
- [ ] The same three cases for the interview.

#### Tests required
Route tests as above, for both routes.

#### Security notes
SR-02 and SR-19 (free questions, P8-02). The abuse case, stopping a paid answer to keep the question, stays
closed: a client abort is never a server-side failure. Total spend is still bounded by the daily
cap and the rate limits.

#### Skills to consult
`dear-steven-security`, TypeScript testing skills.

#### Human steps
None.

#### Dependencies
None. **Size:** S.

---

### P10-06 — fix(security): no question is answered without its safety check

<!-- issue {"id":"P10-06","title":"fix(security): no question is answered without its safety check","labels":["type:security","stage:m8","track:security","track:core","track:answers","owner:ai","risk:high","needs:human-review","P1","size:S"],"milestone":"M8 Launch readiness","depends":[],"github":110} -->

#### Context
The safety rails (P6-11) have two layers:

- **phrase rules**, which are English only;
- **OpenAI moderation**, which covers every language.

If the moderation call fails, `composeAnswer` drops it (`.catch(() => null)`) and answers on the
phrase rules alone. Then a crisis message in German, or worded in a way the phrase rules miss, gets
an ordinary answer.

#### Goal
When moderation can't give a verdict, the question isn't answered. The visitor gets a short, clear
error and can try again. Where a free question was used, it's given back.

#### Scope
**In**
- Every path that moderates a question (Ask, Talk, the interview, practice) retries the
  moderation call once.
- If that also fails, the path ends with an `error` event (`upstream`, worded in the interface
  language) and makes no model call for the answer.
- One log line: `moderation unavailable`.
- The phrase rules still run first: a phrase match is answered with the safety reply even when
  moderation is down.

**Out:** demo mode (it has no moderation, and fixtures only), and the crisis copy (H-11).

#### Acceptance criteria
- [ ] Moderation failing twice: no answer model call, an `error` event, and the log line (core
  unit test with a failing moderator).
- [ ] Moderation failing once, then succeeding: answered as normal (unit).
- [ ] A crisis phrase with moderation down still gets the crisis reply (unit).
- [ ] The same for the interview and practice paths.
- [ ] With P10-05 merged, the free question is given back (route test).

#### Tests required
Core unit tests as above. One route test for the given-back question.

#### Security notes
SR-18 (safety rails) and SR-22 (the interview). This changes a fail-open into a fail-closed,
and the SR-18 row is updated. A server with no moderator at all (demo) still answers, as today.

#### Skills to consult
`dear-steven-security`, `dear-steven-persona`, `dear-steven-architecture`.

#### Human steps
None. H-11 still reviews the safety copy.

#### Dependencies
None (the given-back test needs P10-05). **Size:** S.

---

### P10-07 — fix(security): a crisis reply always says how to find a helpline in any country

<!-- issue {"id":"P10-07","title":"fix(security): a crisis reply always says how to find a helpline in any country","labels":["type:security","stage:m8","track:security","track:core","owner:ai","risk:high","needs:human-review","P1","size:S"],"milestone":"M8 Launch readiness","depends":[],"github":111} -->

#### Context
`crisisResources` picks a country from the browser's language (`en-US` → US), not from where the
visitor is. Someone in Germany with an American-English browser is given 988 and 911, which don't
work there. Only visitors whose browser names no known country get the international line
(findahelpline.com).

#### Goal
Every crisis reply names the country's helpline when one is known, and always ends with the
international way to find one wherever you are.

#### Scope
**In:** `packages/core/src/safety/resources.ts` and the reply that uses it. The country's entry is
followed by the international line, in every crisis reply, in the reply's language.

**Out:** new countries, translated crisis replies (#35), and the wording of the replies themselves
(H-11). Only the added line is new copy.

#### Acceptance criteria
- [ ] For every country in the table and for no country, the crisis reply includes
  findahelpline.com (unit).
- [ ] The country's own numbers are unchanged (unit snapshot of the table).
- [ ] The red team still passes (`pnpm eval`'s safety set, phrase rules only, no cost).

#### Tests required
Unit as above.

#### Security notes
SR-18. The added line goes to H-11 with the rest of the safety copy.

#### Skills to consult
`dear-steven-security`, `dear-steven-persona`.

#### Human steps
H-11 reviews the line along with the rest of the copy.

#### Dependencies
None. **Size:** S.

---

## Visitor-facing

### P10-08 — fix(web): visitors see errors in their own words; the operator's details go to the log

<!-- issue {"id":"P10-08","title":"fix(web): visitors see errors in their own words; the operator's details go to the log","labels":["type:ui","stage:m8","track:web","owner:ai","risk:low","P1","size:S"],"milestone":"M8 Launch readiness","depends":[],"github":112} -->

#### Context
Some error messages are written for the person who runs the server, and every visitor sees them:

- a rejected operator key says "Check OPENAI_API_KEY in .env and restart";
- `noKey`, `noKnowledgeBase` and the empty state ("Run the ingest command") are similar.

The cross-site refusal (403 `cross_site`) shows "My side of the conversation dropped out". With
no free questions left, the "Try again" button repeats a request that will fail the same way.

#### Goal
A visitor reads what happened and what they can do. The operator's instructions go to the
server log, and the setup panel still shows them to whoever runs it locally.

#### Scope
**In**
- English and German copy for the operator's key being rejected or rate-limited, no key, and no
  knowledge base, worded for a visitor. Matching log lines carry the operator's hint.
- The empty-knowledge state for a visitor. The setup link stays where setup is available.
- A message for `cross_site`.
- No "Try again" where retrying can't help (`needs_key`).

**Out:** a visitor's own key being rejected (already theirs to fix), and policy text.

#### Acceptance criteria
- [ ] No visitor-facing string mentions `.env`, an environment variable or a CLI command (unit
  over both catalogues).
- [ ] A rejected operator key logs the hint and shows the visitor wording (route test).
- [ ] `cross_site` and `needs_key` show their own message, with no "Try again" for `needs_key`
  (component or e2e).
- [ ] German typed against English, as for every other key (existing check).

#### Tests required
As above.

#### Security notes
None. Copy and routing of existing errors; no new data shown.

#### Skills to consult
`dear-steven-architecture`, frontend design skills, `docs/DESIGN.md` (voice of system messages).

#### Human steps
None.

#### Dependencies
None. **Size:** S.

---

### P10-09 — feat(web): an error page and a not-found page in Dear Steven's own design

<!-- issue {"id":"P10-09","title":"feat(web): an error page and a not-found page in Dear Steven's own design","labels":["type:ui","stage:m8","track:web","track:design","owner:ai","risk:low","P1","size:S"],"milestone":"M8 Launch readiness","depends":[],"github":113} -->

#### Context
`apps/web/src/app` has no `error.tsx`, `global-error.tsx` or `not-found.tsx`. A client exception
anywhere in the stage leaves the visitor on Next's unbranded "Application error" page, and an
unknown path shows Next's default 404.

#### Goal
An unknown address and a crash both land on a calm page in the product's design. It says what
happened in the visitor's language, offers a way back, and never shows error details.

#### Scope
**In:** `not-found.tsx`, `error.tsx` (with a retry) and `global-error.tsx` (its own `<html>`).
English and German copy. They work under the strict CSP (P6-09) and reduced motion.

**Out:** error reporting to a service.

#### Acceptance criteria
- [ ] An unknown path renders the not-found page with a link home, status 404, axe clean, at 375
  and 1280 px (e2e).
- [ ] A thrown render error shows the error page, no stack or message, and the retry recovers
  (component test).
- [ ] No CSP violation (the e2e CSP listener).

#### Tests required
As above.

#### Design notes
`docs/DESIGN.md` tokens and type. No new motion beyond the existing entrance. The wordmark links
home.

#### Security notes
None. No error detail reaches the page.

#### Skills to consult
Frontend design skills, `docs/DESIGN.md`, `dear-steven-architecture`.

#### Human steps
None.

#### Dependencies
None. **Size:** S.

---

### P10-10 — feat(web): an icon and a link preview that say it's an unofficial AI persona

<!-- issue {"id":"P10-10","title":"feat(web): an icon and a link preview that say it's an unofficial AI persona","labels":["type:ui","stage:m8","track:web","track:design","owner:ai","risk:low","P2","size:S"],"milestone":"M8 Launch readiness","depends":[],"github":114} -->

#### Context
The layout sets only a title, a description and `noindex`. There is no favicon, no Open Graph or
Twitter metadata, and no `metadataBase`. A shared link unfurls as a bare "Dear Steven". The AI
persona label is only in the description, and nothing says the site is unofficial.

#### Goal
In a tab or a link preview, the site has its own icon. The preview says it's an unofficial AI
persona built from the podcast's public interviews.

#### Scope
**In**
- An icon derived from the wordmark (`app/icon.svg`, plus an Apple touch icon).
- `openGraph` and `twitter` metadata (summary card, no image), titled and described as an
  unofficial AI persona, in the visitor's language.
- `metadataBase` from an optional public-URL variable, documented in `docs/DEPLOY.md`.

**Out:** an image preview (no likeness of Steven Bartlett, by design). Indexing stays `noindex`
until the owner decides (noted in `docs/DEPLOY.md`).

#### Acceptance criteria
- [ ] The page head has the icon, `og:title`, `og:description`, `og:site_name` and
  `twitter:card`. Title or description contains "unofficial" and "AI" in English, and the same in
  German (e2e on the head).
- [ ] Without the public-URL variable, nothing absolute is emitted (unit on `generateMetadata`).

#### Tests required
As above.

#### Design notes
The icon uses the wordmark's letterform and the accent token. It is legible at 16 px, in light
and dark.

#### Security notes
None.

#### Skills to consult
Frontend design skills, `docs/DESIGN.md`, `dear-steven-persona` (the disclosure wording).

#### Human steps
None.

#### Dependencies
None. **Size:** S.

---

### P10-11 — fix(web): the interview shows the AI disclosure too, and it says it isn't advice

<!-- issue {"id":"P10-11","title":"fix(web): the interview shows the AI disclosure too, and it says it isn't advice","labels":["type:ui","stage:m8","track:web","track:conversation","owner:ai","risk:low","P1","size:S"],"milestone":"M8 Launch readiness","depends":[],"github":115} -->

#### Context
The disclosure line ("Dear Steven is an AI persona — not Steven Bartlett, and not affiliated with
the show") sits under the Ask and Talk composers. The interview view has none, written or spoken,
and the visitor reaches the disclosure there only through the About dialog. "Not advice" appears
only in the one-time first-visit notice and on `/terms`. Since 2026-08-02 the EU AI Act asks that
people talking to an AI system be told so.

#### Goal
Wherever you talk to Dear Steven, the disclosure is in view. It says the site is unofficial and
gives no professional advice.

#### Scope
**In**
- The disclosure line in the interview view (written and spoken), under its composer as elsewhere.
- The disclosure copy, English and German: an unofficial AI persona, not Steven Bartlett, not
  affiliated with the show, and not medical, legal or financial advice. It stays one short line.

**Out:** the first-visit notice and `/terms` (already say so). Share cards already draw the
disclosure in, and pick up the new wording.

#### Acceptance criteria
- [ ] The disclosure is visible in Ask, Talk and the interview, at 375 and 1280 px (e2e).
- [ ] The wording says unofficial, AI persona and not advice, in both languages (unit on the
  catalogues).
- [ ] The line fits on two lines or fewer at 375 px (e2e screenshot check).

#### Tests required
As above.

#### Design notes
Same component and placement as under the other composers.

#### Security notes
None.

#### Skills to consult
`dear-steven-persona`, frontend design skills, `docs/DESIGN.md`.

#### Human steps
None. P6-12's wording review covers the new line.

#### Dependencies
None. **Size:** S.

---

## Policies

### P10-12 — docs: a privacy notice that says where data goes, and a legal notice page

<!-- issue {"id":"P10-12","title":"docs: a privacy notice that says where data goes, and a legal notice page","labels":["type:docs","stage:m8","track:policy","track:web","owner:ai","risk:medium","P0","size:M"],"milestone":"M8 Launch readiness","depends":[],"github":116} -->

#### Context
The privacy notice (`apps/web/src/content/policies.ts`, which also generates `PRIVACY.md`) has
two problems.

It says things that aren't so:
- podcast audio loads "from the podcast's host" and there is "no tracking". In fact the stored
  audio URLs pass through the publisher's ad-measurement redirects (`pdst.fm`, `pscrb.fm`,
  `claritaspod.com`, `podderapp.com`, …) when you press play;
- transcription is "never stored" and the interview "isn't stored", which leaves out OpenAI's own
  retention;
- it doesn't say that the conversation so far is sent with each question.

It also lacks what a GDPR notice needs:
- who the controller is;
- the legal bases and retention;
- the recipients and the transfer to the US;
- visitors' rights and the right to complain;
- the basis for the strictly necessary cookies and storage.

The site also has no legal notice (Impressum), which a German operator's public site needs.

#### Goal
The privacy notice is accurate. It has every section a GDPR notice needs, with the operator's
details left as one clearly marked gap. A legal-notice page exists and fills itself from the same
place the contact address does.

#### Scope
**In**
- The privacy notice rewritten from what the code does today, in `policies.ts`, and
  `PRIVACY.md` regenerated. Every factual claim is checked against the code it describes.
- An operator-details constant next to `CONTACT` (`null` until the owner fills it in), shown as
  pending exactly as the contact is.
- A `/legal` page (legal notice / Impressum) from it, linked from `/terms` and from the footer
  where Terms is.
- The "not yet reviewed by a lawyer" line stays.

**Out:** the operator's details and contact (owner), the lawyer's review (P6-12), German
translations of the policies (the English text prevails, as today).

#### Acceptance criteria
- [ ] Each statement about data in the notice names the code that makes it true. The list goes in
  the PR, with the four corrections above.
- [ ] The notice has sections for controller, data and purposes, legal bases, recipients and
  transfers, retention, rights and complaint, cookies and storage.
- [ ] `/legal` renders, says pending while the details are `null`, and shows them once set
  (e2e, unit).
- [ ] The generated `.md` files match `policies.ts` (existing check).

#### Tests required
As above. The existing terms e2e stays green.

#### Security notes
Accuracy of what visitors are told about their data (SR-16 says the audio redirect is
disclosed). No code path changes.

#### Skills to consult
`dear-steven-security` (data flows), naming and comments skills.

#### Human steps
The owner fills in the contact and operator details, and has the policies reviewed (P6-12).

#### Dependencies
None. **Size:** M.

---

### P10-13 — fix(security): a rejected key is reported as such, not as a failed safety check

<!-- issue {"id":"P10-13","title":"fix(security): a rejected key is reported as such, not as a failed safety check","labels":["type:security","stage:m8","track:security","track:core","owner:ai","risk:high","needs:human-review","P1","size:S"],"milestone":"M8 Launch readiness","depends":["P10-06"],"github":124} -->

#### Context
Since P10-06 (#119), a question whose moderation call fails twice isn't answered. The visitor
reads "I couldn't run my safety check just now". But moderation also fails when OpenAI refuses the
key itself (401, 403) or holds it back (429: too many requests, or no credit). Moderation is often
the first call to reach OpenAI: always in the interview, and in Ask when there are no embeddings
to search with. Then:

- the visitor reads about a safety check instead of the key;
- a visitor with their own key isn't told to check it;
- the operator's log says `moderation unavailable (openai 401)` instead of the hint P10-08 adds.

P10-08's route tests found this once rebased onto #119.

#### Goal
A refused or held-back key fails the question exactly as the answer call would, and
`describeFailure` words it for whoever owns the key. Only an outage (5xx, a timeout, the network)
gets the safety-check reply.

#### Scope
**In:** `moderationVerdict` returns the key's own error for 401, 403 and 429, without a second try
(the SDK has already retried a 429). `composeAnswer` and the interview throw it, so it reaches
`describeFailure`. The fail-mode row in `docs/ARCHITECTURE.md` and the SR-18 row are updated.

**Out:**
- What an outage does: unchanged, still fail-closed.
- The wording of the messages (P10-08).

#### Acceptance criteria
- [ ] A 401, 403 or 429 from moderation means no second moderation call and no answer model call.
  The original error reaches the caller, and nothing is answered (core unit tests for Ask and the
  interview).
- [ ] A 5xx still gets one retry and then the safety-check reply (existing tests).
- [ ] `moderationVerdict` still never rejects (unit).
- [ ] P10-08's route tests for a rejected operator key pass on top of this.

#### Tests required
As above.

#### Security notes
SR-18: still fail-closed, so nothing is answered without a verdict. SR-19: a problem with a
visitor's own key is reported as theirs. No provider text is logged or shown, because
`describeFailure` maps status codes to fixed messages.

#### Skills to consult
`dear-steven-security`, `dear-steven-architecture`.

#### Human steps
None.

#### Dependencies
P10-06. **Size:** S.

## Found by trying it

After M8 merged, on 2026-10-16: two problems the owner found by talking to it, and one from the diarization
batch.

### P10-14 — fix(voice): you aren't cut off mid-thought: listening carries on when the browser stops

<!-- issue {"id":"P10-14","title":"fix(voice): you aren't cut off mid-thought: listening carries on when the browser stops","labels":["type:ui","stage:m8","track:voice","track:web","owner:ai","risk:medium","P1","size:S"],"milestone":"M8 Launch readiness","depends":[],"github":133} -->

#### Context
The owner tried the app and reported that speaking "interrupts after I said one sentence". The code
has two causes:

- The browser's speech recognition ends by itself after a sentence. Safari does this, and Android
  Chrome always does, because it listens to one utterance at a time (`recognition.ts`). Talk and the
  spoken interview take that end as the end of your turn (`listen.ts`). The mic button sends what
  it has (`useVoice.ts`), though you are still talking.
- In Talk, 0.9 s of quiet ends your turn (`TURN_TIMING.talk`). A breath between two sentences
  takes about that long.

#### Goal
Your turn ends when you pause for real, or when you say so, never because the browser stopped
listening by itself.

#### Scope
**In:**
- `createRecognizer` gains `keepListening`. When the browser ends by itself after words were heard,
  it starts again and keeps the words. A `no-speech` after words ends with those words, not with an
  error. It allows at most two restarts in a row with nothing new and 50 in all, so a broken
  recognizer can't loop.
- Talk, the spoken interview (`listenForTurn`) and the mic button (`useVoice`) listen that way.
- `TURN_TIMING`: Talk waits for 1.5 s of quiet, the interview for 2.5 s. "Send now" still ends a
  turn at once.

**Out:**
- The recorder path's level gate, apart from the shared timing.
- A voice-activity model.
- Tuning on real devices, which stays a human step.

#### Acceptance criteria
- [ ] A recognizer that ends by itself after words starts again. The words from before and after
  the restart arrive together, as one final transcript (unit, with a scripted recognizer).
- [ ] `stop()` and `abort()` still end it at once, with no restart after either (unit).
- [ ] A `no-speech` after words gives the words, not an error. Before any words it is still an
  error (unit).
- [ ] It stops restarting after two quiet restarts in a row (unit).
- [ ] Talk ends a turn after 1.5 s of quiet but not after 1.2 s, and the interview after 2.5 s
  (unit, `turnVerdict`).
- [ ] The e2e conversation and voice suites pass unchanged.

#### Tests required
As above.

#### Security notes
The mic is never open while Dear Steven speaks. That is unchanged, and `conversation.spec.ts` still
proves it. A restart happens only while you are listening, never after a stop, an abort, a pause or
the end of the conversation.

#### Skills to consult
`dear-steven-architecture`, the testing skills, Playwright.

#### Human steps
Try it on a real phone with Android Chrome and iOS Safari. This is the existing human step for voice
on devices.

#### Dependencies
None. **Size:** S.

### P10-15 — fix(core): the interview asks in the language you chose, unless you clearly answer in another

<!-- issue {"id":"P10-15","title":"fix(core): the interview asks in the language you chose, unless you clearly answer in another","labels":["type:core","stage:m8","track:core","track:conversation","owner:ai","risk:low","P1","size:S"],"milestone":"M8 Launch readiness","depends":[],"github":134} -->

#### Context
The owner chose German, and an interview question sometimes came in English. `interviewLanguage`
guesses the language from the visitor's last two texts once there are 20 characters, and those texts
include the setup's "about" and "expertise". The guess (`detectLanguage`) was built for search, where
English is the safe default, so any text it can't place counts as English. "Founder of a fintech
startup" counts as English, and so does "Ich bin Designer", because one German word isn't enough.
Nothing checks that the model's question is in the language it was asked for, and the style examples
it sees are in English.

#### Goal
The interview is in the language you chose. It changes only when your answers are clearly in another
language. A question that comes back in the wrong language is asked again.

#### Scope
**In:**
- `clearLanguage(text, min)` in `language/detect.ts` returns a language only when its words clearly
  outnumber every other language's, English included. Otherwise it returns null.
- `interviewLanguage` uses your last two answers when they are clearly in another language, and the
  interface language otherwise. The setup fields no longer count, because job titles and bios are
  often in English.
- `questionProblems` takes the language. A question clearly in another language is a problem, so it
  is asked again. If it fails again, the fixed question for that stage is used, in the right language.
- The demo interview uses the same rule.

**Out:**
- The Ask flow, whose answers already follow the question's language.
- More interface languages.

#### Acceptance criteria
- [ ] With the German interface and the setup "Founder of a fintech startup", the first question is
  asked in German (unit).
- [ ] With the German interface, a German answer with one German stop word still gets German (unit).
- [ ] With the German interface, an answer clearly in English gets the next question in English
  (unit).
- [ ] A question in English when German was asked for is retried, then replaced by the German
  fallback (unit).
- [ ] The demo interview follows the same rule (unit).

#### Tests required
As above.

#### Security notes
None. No new input reaches the model, and the language code is still one of ours.

#### Skills to consult
`dear-steven-architecture`, `dear-steven-persona`, the TypeScript clean-code and testing skills.

#### Human steps
None.

#### Dependencies
None. **Size:** S.

### P10-16 — fix(ingest): a failed episode's paid audio counts toward the budget, and an outage stops the run

<!-- issue {"id":"P10-16","title":"fix(ingest): a failed episode's paid audio counts toward the budget, and an outage stops the run","labels":["type:service","stage:m8","track:ingest","owner:ai","risk:medium","P1","size:S"],"milestone":"M8 Launch readiness","depends":[],"github":135} -->

#### Context
The resumed diarization batch of 2026-10-16 lost its network for a while. One episode failed after
16 of its 22 chunks had been transcribed and paid for, about $0.58. `transcribe --diarize` counted
none of it in `spent` or in the run's meta, so both the `--budget` stop and the recorded spend come
out short. The next 21 episodes then failed one after another within seconds, and each was marked
failed.

#### Goal
A run counts everything it pays for, even when an episode fails. A run that keeps failing stops
instead of working through the rest of the list.

#### Scope
**In:**
- When an episode fails, the cost of its finished chunks (from `diarizeChunks`' `onChunk`) is added
  to `spent` and recorded on the failed run, as `meta.costUsd` and `meta.chunksDone`.
- After three failures in a row, the run stops and says why: most likely the network or the key.

**Out:** reusing finished chunks on a retry. That can be a later issue if retries turn out to be
common.

#### Acceptance criteria
- [ ] An episode that fails after k of n chunks adds the cost of k chunks to `spent` and to the
  failed run's meta (unit).
- [ ] The budget stop counts that cost (unit).
- [ ] Three failures in a row stop the run, and a success in between resets the count (unit).

#### Tests required
As above.

#### Security notes
On spending, this makes `--budget` stricter, never looser.

#### Skills to consult
`dear-steven-security`, the testing skills.

#### Human steps
None.

#### Dependencies
None. **Size:** S.
