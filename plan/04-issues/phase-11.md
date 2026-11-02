# Phase 11 — Open to contributors (M9)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-17 | milestone M9 |

**Exit:** a person who has never seen the project can run it, find work that suits them, report
a bug or a vulnerability the right way, and ship a change on an ordinary laptop. The knowledge base
is safer to keep: backed up, with guest names that can be corrected, and paid work that isn't paid
twice. Visitors get real value from it with no model at all. The build, the image and the headers
are harder to attack, and CI doesn't change under anyone's feet.

The owner's request (2026-10-17): *"think of ideas deeply what could be done, added, maybe for
future developers, what could they take over"*, with security in mind, after deciding not to spend
more on OpenAI for now. So nothing in this milestone needs a paid call to be built or tested. Each
issue was checked against the code on `main` (bc17f0b) so that it builds on what exists and repeats
nothing already planned (P5-*, #5, #7, #18, #27, #35, #63, #73).

Issues are numbered by priority (`AGENTS.md` § 8: the lowest open number goes first) and grouped
by category; each category is a label on GitHub. Issues suited to someone new carry
`good first issue`; ones that welcome outside help carry `help wanted`.

| Category | Label | Issues |
|----------|-------|--------|
| CI and supply chain | `track:infra` | P11-01, P11-05, P11-19, P11-20 |
| Security and privacy | `track:security` | P11-02, P11-04, P11-10, P11-11 |
| Contributors | `track:docs` | P11-03, P11-12, P11-18, P11-21 |
| Knowledge base | `track:ingest` | P11-06, P11-07, P11-14, P11-15 |
| Free features | `track:web`, `track:core` | P11-08, P11-09, P11-13 |
| Tests | `track:core`, `track:web` | P11-16, P11-17 |

**Merge policy:** the normal workflow (`docs/WORKFLOW.md`): `pnpm check` green, `pnpm e2e` for
anything a visitor sees, CI once it runs again (billing), and `risk:high` waits for a person.
None of these issues is `risk:high`.

**Not in this milestone (a person must act, or it costs money the owner chose not to spend on
2026-10-16):** embeddings and summaries for the 100 newly transcribed conversations (about $0.07
and $0.70), the rest of the diarization batch, the first live eval (#27, H-07), German crisis
replies (#35, H-11), the deployment (P5-10, H-08), the takedown contact and operator details
(P6-12), a lawyer's review, voice on real devices, and GitHub billing for CI.

---

## CI and supply chain

### P11-01 — ci: pin the runner to Ubuntu 24.04 before ubuntu-latest moves to 26.04

<!-- issue {"id":"P11-01","title":"ci: pin the runner to Ubuntu 24.04 before ubuntu-latest moves to 26.04","labels":["type:infra","stage:m9","track:infra","owner:ai","risk:low","P0","size:S","good first issue"],"milestone":"M9 Open to contributors","depends":[],"github":141} -->

#### Context
Every job in `.github/workflows/ci.yml` and `.github/workflows/security.yml` runs on
`ubuntu-latest`. GitHub is moving that label from Ubuntu 24.04 to 26.04 in a gradual rollout from
2026-10-19 to 2026-11-19. It warns that 26.04 updates or removes some preinstalled tools, and it
recommends pinning `ubuntu-24.04` until a project is ready
([changelog, 2026-09-17](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration)).
On an unpinned label, CI can start failing on a PR that changed nothing. The e2e job, with
Chromium's system libraries and fonts, is the most exposed.

#### Goal
CI runs on a named image, and moving to 26.04 is a deliberate change that was tested first.

#### Scope
**In:**
- `runs-on: ubuntu-24.04` for every job in both workflows.
- A test, beside the other repository checks (`apps/web/src/deploy.test.ts` reads `fly.toml` the
  same way), that fails if any workflow uses a `*-latest` runner label.
- A line in `plan/07-ci-cd.md` on the pin and on how to move: a branch run on `ubuntu-26.04`
  first.

**Out:** moving to 26.04, which gets its own issue once a branch run passes there. CI billing is
the owner's.

#### Acceptance criteria
- [ ] No workflow under `.github/workflows/` uses `ubuntu-latest`.
- [ ] The guard test fails when a `-latest` label is put back (mutation-checked in the PR).
- [ ] Once CI runs again, every job passes on the pinned image.

#### Tests required
The guard test.

#### Security notes
SR-14 is unchanged: actions stay pinned by SHA and permissions stay least-privilege.

#### Skills to consult
The naming and comments skills; `plan/07-ci-cd.md`.

#### Human steps
None. (CI billing is tracked separately.)

#### Dependencies
None. **Size:** S. **Time-critical:** before 2026-10-19 if possible.

---

### P11-05 — ci(security): the container's base image pinned by digest, kept current, and scanned

<!-- issue {"id":"P11-05","title":"ci(security): the container's base image pinned by digest, kept current, and scanned","labels":["type:infra","stage:m9","track:infra","track:security","owner:ai","risk:medium","P1","size:S"],"milestone":"M9 Open to contributors","depends":[],"github":142} -->

#### Context
The `Dockerfile` builds from `node:22.23.1-slim` by tag in both stages, and a tag can be moved to
other contents. `.github/dependabot.yml` watches npm and GitHub Actions but not Docker, so the
image's operating-system packages age without anyone noticing. CI's `docker` job builds the image,
but nothing scans it, and there is no record of what is inside it (an SBOM).

#### Goal
The image can be rebuilt exactly, Dependabot keeps its base current like everything else, and a
base with known, fixable vulnerabilities fails CI.

#### Scope
**In:**
- `FROM node:22.23.1-slim@sha256:…` in both stages, with the same digest, and the tag kept for
  readers.
- A `docker` entry in `dependabot.yml`: weekly, with `chore(deps)` titles that pass `pr-title`.
- In the `docker` job, a vulnerability scan of the built image that fails on fixable critical
  or high findings, and an SBOM (SPDX or CycloneDX) uploaded as an artifact.
- The scanner pinned by SHA with least-privilege `permissions:`. Its choice (Trivy, Grype or
  Docker Scout) is justified in the PR: maintainer, licence, no telemetry
  (`SECURE-CODING.md` 8–9).

**Out:**
- Signing the image and provenance (once images are published).
- Publishing to a registry.

#### Acceptance criteria
- [ ] Both stages build from the pinned digest.
- [ ] The Dependabot configuration is valid and includes Docker.
- [ ] A deliberately old base digest on a scratch branch fails the scan, and the current one
  passes. While CI is down, a local run of the same scanner command is pasted in the PR.
- [ ] A CI run of the `docker` job has the SBOM as an artifact.

#### Tests required
The CI job itself, plus the local scanner run while CI is down.

#### Security notes
Extends SR-14 (supply chain) to the image. The image still holds no data and no secrets, and runs
as `node` (`SECURE-CODING.md` 10).

#### Skills to consult
`dear-steven-security`; `plan/07-ci-cd.md`.

#### Human steps
GitHub billing, so the job can run in CI.

#### Dependencies
None. **Size:** S.

---

### P11-19 — chore(deps): move to the OpenAI SDK v7, every call path checked

<!-- issue {"id":"P11-19","title":"chore(deps): move to the OpenAI SDK v7, every call path checked","labels":["type:infra","stage:m9","track:core","track:infra","owner:ai","risk:medium","P2","size:M"],"milestone":"M9 Open to contributors","depends":[],"github":143} -->

#### Context
The core and the ingest CLI use `openai` 6.x for every model call: answers (Responses API with
strict JSON), moderation, embeddings, transcription (including `diarized_json`) and speech (PCM).
Dependabot opened #44 and #45 to move to 7.x. A major version can change request shapes, error
objects (`status`, and the `retry-after-ms` header the P10-05 tests rely on), streaming and types.
Merging the bump without looking could break a paid path in a way only a live call shows.

#### Goal
The project is on v7, every call path is checked, and the Dependabot PRs are closed.

#### Scope
**In:**
- The v7 changelog and migration notes, applied to:
  - `packages/core/src/openai/*` and `packages/core/src/answer/model.ts`;
  - `packages/ingest/src/sources/openai-*.ts`;
  - error handling (`apps/web/src/server/errors.ts`: `describeFailure`, `statusOf`);
  - client options (`maxRetries`, `timeout`) and the test fakes.
- One PR covering both lockfile entries, closing #44 and #45 with a reference to it.

**Out:** new v7 features.

#### Acceptance criteria
- [ ] `pnpm check` and `pnpm e2e` pass.
- [ ] The fake-OpenAI suites pass unchanged: the operator-key and visitor-key canaries, the free
  routes and the setup e2e.
- [ ] Errors still map to the same codes and messages (the 401/403/429/5xx table in
  `server/errors.test.ts`).
- [ ] With the owner's go-ahead for a few cents, one live smoke run: one answer, one moderation,
  one speech part and one embedding. Without it, recorded as pending on the issue.

#### Tests required
The existing suites, plus a test for any error shape that changed.

#### Security notes
SR-05 and SR-19: provider text and keys are never logged. Re-run the canary tests, and check that
v7 doesn't log requests or headers by default.

#### Skills to consult
`dear-steven-architecture`, `dear-steven-security`, the testing skills.

#### Human steps
Optional: a few cents for the live smoke run.

#### Dependencies
None. **Size:** M.

---

### P11-20 — chore(deps): move to motion 14, with reduced motion unchanged

<!-- issue {"id":"P11-20","title":"chore(deps): move to motion 14, with reduced motion unchanged","labels":["type:infra","stage:m9","track:web","track:design","owner:ai","risk:low","P2","size:S"],"milestone":"M9 Open to contributors","depends":[],"github":144} -->

#### Context
The interface animates with `motion` 12, imported in 19 files, including vendored React Bits
components. Dependabot's #42 and #43 move it to 14. A major version can change exports and
behaviour (`motion/react`, `AnimatePresence`, reduced-motion handling). Reduced motion is part of
the accessibility tests (P7-10, `a11y.spec.ts`).

#### Goal
The project is on motion 14, and the stage's choreography and reduced motion are unchanged.

#### Scope
**In:**
- Read the changelog.
- Update imports and usages. Vendored components keep their licence header
  (`components/vendor/react-bits/`).
- Close #42 and #43.

**Out:** redesigning any animation.

#### Acceptance criteria
- [ ] `pnpm e2e` passes on desktop and mobile, reduced motion and axe included.
- [ ] No hydration warnings.
- [ ] The client bundle grows by at most 5%, reported in the PR.

#### Tests required
The existing suites; P11-16's screenshots if they have landed.

#### Security notes
None in the code. Check the dependency as `SECURE-CODING.md` 9 asks.

#### Skills to consult
The frontend design skills; `docs/DESIGN.md`.

#### Human steps
None.

#### Dependencies
None. **Size:** S.

---

## Security and privacy

### P11-02 — docs(security): SECURITY.md for private reports, and a checklist for going public

<!-- issue {"id":"P11-02","title":"docs(security): SECURITY.md for private reports, and a checklist for going public","labels":["type:docs","stage:m9","track:security","track:docs","owner:ai","risk:medium","P1","size:S"],"milestone":"M9 Open to contributors","depends":[],"github":145} -->

#### Context
There is no `SECURITY.md`, so GitHub shows "no security policy". The threat model
(`plan/09-security/THREAT-MODEL.md`) is thorough, but nothing tells an outsider how to report a
flaw without opening a public issue. The repository is private today. Before it goes public (H-01),
several protections must be switched on or only work once it is public:
- CodeQL is in `security.yml` but waits for a public repository.
- Private vulnerability reporting, secret scanning with push protection, Dependabot alerts and
  branch protection on `main` are all settings.

#### Goal
Someone who finds a vulnerability knows exactly where to report it. The owner has one checklist
to work through before making the repository public.

#### Scope
**In:**
- `SECURITY.md`:
  - **How to report:** GitHub's private vulnerability reporting, never a public issue, and what
    to include.
  - **What to expect:** best effort from a single maintainer, an acknowledgement goal (for
    example 7 days) and no bounty.
  - **Scope:** this repository's code and its deployment defaults. Out of scope: OpenAI, YouTube
    and podcast hosts, and denial of service beyond the rate limits, as the threat model says.
  - **Safe harbour:** good-faith research on your own copy, never on someone else's deployment.
  - **Supported versions:** `main`.
- `plan/human/go-public.md`, a checklist for the owner:
  - a full-history gitleaks scan passes, with no `data/`, audio, transcripts or keys in history;
  - private vulnerability reporting, secret scanning with push protection, Dependabot alerts and
    branch protection with required checks are switched on (H-01);
  - CodeQL runs on the first public push;
  - the takedown contact and operator details are published (P6-12);
  - the licence is described plainly: PolyForm Noncommercial is source-available, not OSI open
    source;
  - open issues are reviewed for anything that shouldn't be public.
- `README.md` links to `SECURITY.md`; the threat model links back. The checklist becomes H-12 on
  the board and in `plan/human/README.md`.

**Out:**
- Changing any setting, which is the owner's job.
- A bug bounty.

#### Acceptance criteria
- [ ] `SECURITY.md` exists, and GitHub shows it as the security policy once merged.
- [ ] The checklist is H-12 on the board, with an owner.
- [ ] Neither file holds a secret, an address or personal data.

#### Tests required
None (docs).

#### Security notes
Keeps reports private, and it is the gate for SR-14's "CodeQL once the repository is public".

#### Skills to consult
`dear-steven-security`; the naming and comments skills.

#### Human steps
- Switch on the settings in the checklist.
- Confirm the acknowledgement goal.

#### Dependencies
None. **Size:** S.

---

### P11-04 — fix(security): cross-origin isolation headers and a deny-by-default Permissions-Policy

<!-- issue {"id":"P11-04","title":"fix(security): cross-origin isolation headers and a deny-by-default Permissions-Policy","labels":["type:security","stage:m9","track:security","track:web","owner:ai","risk:medium","P1","size:S"],"milestone":"M9 Open to contributors","depends":[],"github":146} -->

#### Context
`apps/web/next.config.ts` already sends:
- `X-Content-Type-Options: nosniff`;
- a strict `Referrer-Policy`;
- `X-Frame-Options: DENY`;
- `Permissions-Policy: microphone=(self), camera=(), geolocation=()`.

`src/proxy.ts` adds the per-request CSP (SR-15). Three protections are missing:
- **`Cross-Origin-Opener-Policy`.** A site that opens this one, or that this one opens, can keep
  a handle on the window. That allows cross-window leaks and tab-nabbing.
- **`Cross-Origin-Resource-Policy`.** Another site's page can load this site's responses as
  no-cors subresources, which is the basis of several cross-site leaks.
- **A deny-by-default `Permissions-Policy`.** It should name the powerful features the app never
  uses, so neither an injected frame nor a future dependency can ask for them.

#### Goal
Windows and responses don't leak across sites, and the browser refuses every powerful feature
except the microphone.

#### Scope
**In:**
- `Cross-Origin-Opener-Policy: same-origin` on every response.
- `Cross-Origin-Resource-Policy: same-origin` everywhere, except the icon and link-preview image
  routes. Those are `cross-origin`, so web clients that load previews in the browser keep
  working.
- Permissions-Policy:
  - Keep `microphone=(self)`.
  - Add `()` for payment, usb, serial, hid, bluetooth, display-capture, midi, accelerometer,
    gyroscope, magnetometer, idle-detection and browsing-topics.
  - Leave out `autoplay`, `fullscreen`, `encrypted-media` and `picture-in-picture`. The in-drawer
    YouTube player and spoken replies use them.
- No `Cross-Origin-Embedder-Policy`: `require-corp` would break the youtube-nocookie player
  (SR-16). A comment says so.
- A row in the threat model (SR-24, or SR-15 extended).

**Out:**
- COEP.
- Trusted Types (its own issue if wanted).

#### Acceptance criteria
- [ ] Pages, API routes and static files carry the new headers. The `api.spec.ts` header test is
  extended to cover them.
- [ ] The in-drawer player, podcast audio, spoken replies and the share image card still work
  (`media`, `spoken-reply`, `share` e2e).
- [ ] The icon is fetchable from another origin.
- [ ] No CSP violation or console error in any e2e test.
- [ ] Removing any one of the headers fails a test (mutation-checked).

#### Tests required
Header assertions for each kind of response; the existing media and voice e2e.

#### Security notes
New protections against cross-site leaks and window handles. Nothing is relaxed.

#### Skills to consult
`dear-steven-security`; Next's headers docs in `apps/web/node_modules/next/dist/docs/`.

#### Human steps
None.

#### Dependencies
None. **Size:** S.

---

### P11-10 — fix(security): the answer log is owner-only, rotated daily and kept 30 days at most

<!-- issue {"id":"P11-10","title":"fix(security): the answer log is owner-only, rotated daily and kept 30 days at most","labels":["type:security","stage:m9","track:security","track:policy","owner:ai","risk:medium","P2","size:S"],"milestone":"M9 Open to contributors","depends":[],"github":147} -->

#### Context
With `DEAR_STEVEN_LOG_ANSWERS=1`, `answerLogger` (`apps/web/src/server/knowledge.ts`) appends each
question to `data/answers.jsonl`, with its search, the passages, the answer and the safety routing.
`PRIVACY.md` says they are kept "until they delete it". There are three problems:
- The file is created with the process's default permissions, usually readable by everyone. The
  share secret next to it is owner-only.
- It grows without limit.
- The privacy notice can't name a retention period.

Questions can be personal.

#### Goal
Only the server's user can read the log. It's kept no longer than evaluation needs, and the
privacy notice says how long.

#### Scope
**In:**
- Files are created with mode 0600, one per UTC day (`answers-YYYY-MM-DD.jsonl`).
- Files older than `DEAR_STEVEN_LOG_ANSWERS_DAYS` are deleted at startup and once a day. The
  default is 30, the allowed range is 1–90, and an unreadable value means 30.
- The eval harness, and anything else that reads the log, reads the dated files.
- `apps/web/src/content/policies.ts` (and the generated `PRIVACY.md`) states the retention.
- `.env.example` documents the variable.

**Out:**
- What is logged, which is unchanged.
- Logging anywhere but the local file.

#### Acceptance criteria
- [ ] A new log file has mode 0600 (on POSIX).
- [ ] A file dated 31 days ago is deleted with the default, and one dated 8 days ago with `=7`.
- [ ] An invalid value falls back to 30.
- [ ] With logging off, nothing is created.
- [ ] The policy test ties the retention claim to the code, like the other policy claims.

#### Tests required
Unit tests with a temporary directory and a fake clock; `policies.test.ts`.

#### Security notes
Privacy: storage limitation. The file permission matches the share secret's (SR-20). Add or extend
an SR row.

#### Skills to consult
`dear-steven-security`; the testing skills.

#### Human steps
None.

#### Dependencies
None. **Size:** S.

---

### P11-11 — chore(infra): structured server logs with a request id, and proof nothing personal is logged

<!-- issue {"id":"P11-11","title":"chore(infra): structured server logs with a request id, and proof nothing personal is logged","labels":["type:infra","stage:m9","track:infra","track:security","owner:ai","risk:medium","P2","size:M"],"milestone":"M9 Open to contributors","depends":[],"github":148} -->

#### Context
The web server logs through about 25 plain `console.*` calls in `apps/web/src/server` and
`apps/web/src/app`, each with its own prefix. The rules are strict: status codes and error names
only, never provider text, questions or keys (`SECURE-CODING.md` 6). They are tested for keys
(the SR-19 canaries). Two things are missing:
- Nothing ties one request's lines together.
- On a deployment there's no way to count errors or slow answers without reading prose.

#### Goal
Every log event is one JSON line with a request id, a fixed event name and only safe fields. A
test proves no visitor text reaches the log.

#### Scope
**In:**
- `apps/web/src/server/log.ts`, with `log.info`, `log.warn` and `log.error(event, fields)`.
  Fields are limited by type to numbers, booleans, status codes, fixed strings and ids that match
  an id pattern. There is no free-text parameter at all.
- A request id: random, 96 bits, made in `src/proxy.ts`. It's passed to the routes and returned in
  `X-Request-Id`, so a visitor can quote it in a bug report.
- Every existing `console.*` in server code moves to the logger.
- Durations in milliseconds for ask, interview, speech and transcribe.
- A canary test, like `operator-key.test.ts`. Each route runs with a canary question, about-text,
  key and transcript line, and no canary may appear in any log line.
- `docs/DEPLOY.md` shows how to read the logs.

**Out:**
- Sending logs anywhere but stdout.
- Metrics or tracing stacks.

#### Acceptance criteria
- [ ] Every server log line parses as JSON with `ts`, `level`, `event` and `requestId`.
- [ ] The canary test passes, and fails when a free-text field is added (mutation-checked).
- [ ] API responses carry `X-Request-Id`.

#### Tests required
As above.

#### Security notes
SR-05 becomes true by construction: the logger's types leave no room for free text.

#### Skills to consult
`dear-steven-security`; the naming and comments skills.

#### Human steps
None.

#### Dependencies
None. **Size:** M.

---

## Contributors

### P11-03 — docs: CONTRIBUTING.md, a code of conduct, and issue forms for people

<!-- issue {"id":"P11-03","title":"docs: CONTRIBUTING.md, a code of conduct, and issue forms for people","labels":["type:docs","stage:m9","track:docs","owner:ai","risk:low","P1","size:S","good first issue"],"milestone":"M9 Open to contributors","depends":["P11-02"],"github":149} -->

#### Context
The README's contributing section says "Start with `AGENTS.md`", a file written for coding agents.
For a person there is no way in:
- There's no `CONTRIBUTING.md` and no code of conduct.
- The issue templates (task, spike, research, human task) are the plan's internal formats.
- `.github/ISSUE_TEMPLATE/config.yml` turns blank issues off and has no contact links, so a
  person who finds a bug has nowhere obvious to go.

Before the repository is public (H-01), people need that.

#### Goal
Someone new can do all of this without reading the whole plan first:
- run the app in demo mode;
- find an issue that suits them;
- open a good PR;
- report a bug or an idea.

#### Scope
**In:**
- `CONTRIBUTING.md`:
  - A two-command start (demo mode, no keys).
  - The product rules in short: no transcripts in the repository, nothing invented in anyone's
    name, the disclosure.
  - How to pick an issue (`good first issue`, `help wanted`, `plan/STATUS.md`).
  - One issue per PR, and Conventional Commits with the allowed scopes.
  - How to run the checks, on a small machine too (P11-12).
  - What never goes into an issue or PR: keys, transcripts, audio, personal data.
  - How review works.
  - The licence in one paragraph: contributions are under PolyForm Noncommercial.
- `CODE_OF_CONDUCT.md`: the Contributor Covenant 2.1. Its contact follows `CONTACT` in
  `content/policies.ts`, pending like the takedown contact (P6-12).
- `.github/ISSUE_TEMPLATE/bug.yml` and `idea.yml` issue forms:
  - steps, expected and actual result, browser and OS, demo or live;
  - a required box: "I didn't paste keys, transcripts or personal data".
- `config.yml` gets a contact link to `SECURITY.md` for vulnerabilities (P11-02).
- The README's "Contributing" section points to `CONTRIBUTING.md`. `AGENTS.md` stays the agents'
  entry point.

**Out:**
- GitHub settings (Discussions, syncing labels), which are the owner's.
- A contributor licence agreement.

#### Acceptance criteria
- [ ] Following only `CONTRIBUTING.md` on a fresh clone reaches the demo stage.
- [ ] A test checks that every `pnpm <script>` named in `CONTRIBUTING.md` exists in a
  `package.json`.
- [ ] The issue forms render on GitHub (checked on the branch), and the privacy box is required.

#### Tests required
The script-name test.

#### Security notes
The forms warn against pasting secrets and data. The security link sends vulnerabilities away
from public issues.

#### Skills to consult
The naming and comments skills; `docs/WORKFLOW.md`.

#### Human steps
- Read it for tone.
- Publish a contact (P6-12).

#### Dependencies
P11-02. **Size:** S.

---

### P11-12 — chore(repo): checks that fit a 16 GB laptop, one step at a time

<!-- issue {"id":"P11-12","title":"chore(repo): checks that fit a 16 GB laptop, one step at a time","labels":["type:infra","stage:m9","track:infra","track:docs","owner:ai","risk:low","P2","size:S","good first issue"],"milestone":"M9 Open to contributors","depends":[],"github":150} -->

#### Context
- `pnpm check` runs `pnpm -r --parallel typecheck`, three TypeScript compilers at once, and
  `vitest run` with one worker per CPU core.
- `pnpm e2e` builds Next.js and runs six Playwright projects (desktop, mobile, gated, setup,
  live, free).

On a 16 GB laptop with an editor and a browser open, running these side by side froze a machine
during the M8 work (2026-10-16). Measured on that machine with a memory guard:

| Step | Peak memory |
|------|-------------|
| Typecheck, one package at a time | ~600 MB |
| `vitest` with 2 workers | ~300 MB |
| Playwright with 2 workers | ~2.3 GB |

#### Goal
Contributors with ordinary laptops can run every check safely and know what each one costs.

#### Scope
**In:**
- `pnpm check:light`: lint, typecheck one package at a time, `vitest` with 2 workers, and arch.
- Playwright reads its worker count from `E2E_WORKERS`. The default doesn't change.
- `AGENTS.md` § 4 and the README list the light commands and the measured memory, with the rule:
  one heavy command at a time.

**Out:** changing CI's commands.

#### Acceptance criteria
- [ ] `pnpm check:light` runs the same checks as `pnpm check`, and a test compares the two
  scripts' steps.
- [ ] Its peak memory is measured and reported in the PR.
- [ ] `E2E_WORKERS=1 pnpm e2e` runs with one worker.

#### Tests required
The scripts comparison test.

#### Security notes
None.

#### Skills to consult
The naming and comments skills.

#### Human steps
None.

#### Dependencies
None. **Size:** S.

---

### P11-18 — docs: a guide to adding an interface language, and catalogue tests for any number of them

<!-- issue {"id":"P11-18","title":"docs: a guide to adding an interface language, and catalogue tests for any number of them","labels":["type:docs","stage:m9","track:i18n","track:docs","owner:ai","risk:low","P2","size:S","good first issue","help wanted"],"milestone":"M9 Open to contributors","depends":[],"github":151} -->

#### Context
The interface speaks English and German. A language lives in several places:
- the catalogues in `apps/web/src/i18n/`;
- `UI_LOCALES` and `LOCALE_TAG` in `packages/core/src/persona/copy.ts`;
- server-side copy in the core: the resting reply, "safety check unavailable", the interview's
  fallback questions and the safety replies. Crisis replies are English only today; German waits
  on #35.
- the voice and recognition tags;
- the policies, which are English.

`apps/web/src/i18n/catalogue.test.ts` compares exactly `en` and `de`. A volunteer who wants to add
French has to find all of this by reading code. The safety copy needs a native speaker and a
reviewer (H-11), and the guide must say so up front.

#### Goal
One page lists every place a language lives and what a person must review. The tests work for any
number of languages, so adding one is mostly translation.

#### Scope
**In:**
- `docs/I18N.md`:
  - every place a language lives;
  - whether demo fixtures need translating;
  - what a person must review before merge: crisis replies and helplines, the disclosure, the
    policies;
  - how to test a new language.
- `catalogue.test.ts` checks every locale in `UI_LOCALES` against `en`.
- A test that every locale has a `LOCALE_TAG` and fallback interview questions.

**Out:** adding a language. Each one is its own `help wanted` issue, with `needs:human-review`
for the safety copy.

#### Acceptance criteria
- [ ] Every file the guide names exists.
- [ ] The generalised test fails when a key is missing in any locale (mutation-checked with `de`).

#### Tests required
The catalogue tests.

#### Security notes
States the safety-copy review requirement (SR-18, H-11) for every new language.

#### Skills to consult
The naming and comments skills.

#### Human steps
None for the guide. Each new language needs a native speaker's review.

#### Dependencies
None. **Size:** S.

---

### P11-21 — docs: research — what it would take to run this for another show

<!-- issue {"id":"P11-21","title":"docs: research — what it would take to run this for another show","labels":["type:research","stage:m9","track:docs","track:policy","owner:ai","risk:medium","P2","size:M"],"milestone":"M9 Open to contributors","depends":[],"github":152} -->

#### Context
Dear Steven is built around one show, but much of it is general: the knowledge base, retrieval,
the citation validator, speaker attribution and the interview. The show-specific parts are spread
out:
- the names in `apps/web/src/brand.ts`;
- the persona and its copy in `packages/core/src/persona`;
- the feed (`DEAR_STEVEN_FEED_URL`);
- the host's voiceprint for diarization;
- the YouTube channel;
- the policies, and the README's rights section.

A future maintainer, or a show that wants this for its own archive, would need a map. They would
also need a clear rule on permission before starting.

#### Goal
A research note that:
- lists every show-specific piece;
- proposes how each could become configuration;
- states what permission and review a new show needs first.

#### Scope
**In:** `plan/11-research/R-05-another-show.md`:
- **The inventory:** each file, what it holds, and how it could become configuration.
- **The persona question:** a persona per show is a product and legal decision, not
  configuration.
- **Rights and consent:** the show's written permission, no impersonation, and the
  non-commercial licence.
- **Work estimate and recommendation:** an estimate of the work, then do, don't, or only with a
  partner show.

**Out:**
- Any code change.
- Contacting anyone.

#### Acceptance criteria
- [ ] The note exists, and every file it names exists.
- [ ] The owner's decision is recorded on the issue.

#### Tests required
None (research).

#### Security notes
None in code. The note covers the legal and consent risks.

#### Skills to consult
`dear-steven-persona`, `dear-steven-architecture`.

#### Human steps
The owner decides whether to pursue it.

#### Dependencies
None. **Size:** M.

---

## Knowledge base

### P11-06 — feat(ingest): correct an episode's guest names by hand, and re-check its speaker labels

<!-- issue {"id":"P11-06","title":"feat(ingest): correct an episode's guest names by hand, and re-check its speaker labels","labels":["type:service","stage:m9","track:ingest","track:answers","owner:ai","risk:medium","P1","size:S"],"milestone":"M9 Open to contributors","depends":[],"github":153} -->

#### Context
Guest names come from the episode title, or from the description by a model
(`discover --guests llm`). The model can miss a guest. In a real knowledge base, two conversations
with two guests each list only one name (found 2026-10-16).

The store already supports `setGuestNames(…, 'manual')`, and `upsertEpisodes` keeps manual names
when the feed is read again. But no command sets them.

Speaker labels depend on the list. With one named guest, diarized guest speech can be credited to
that person by name. With two, it stays "speaker not verified" (P8-11). In the cases found, the
guest speech had stayed unverified, so nothing was misattributed. But a wrong list puts the
product's core promise at risk: who said what.

#### Goal
A maintainer can fix an episode's guest list in one command. No segment keeps a name the
corrected list no longer supports.

#### Scope
**In:**
- `pnpm ingest guests <episode>` prints the names and their source.
- `pnpm ingest guests <episode> --set "Name A" "Name B"` stores them as `manual`. `--clear` goes
  back to the names from the title.
- When the list changes on a diarized episode:
  - Every guest segment whose `speaker_name` isn't the single remaining guest becomes "speaker
    not verified": speaker `unknown`, no name, method `none`. A label is never upgraded.
  - The episode's passages are rebuilt, so citations show the new state. That also drops a stale
    summary, as rebuilding passages does today.
- `attribute` flags an episode whose title joins two names ("A and B", "A & B") or uses a plural
  role ("Doctors", "Founders") while one guest is listed. The flag is only a hint.
- `docs/INGESTION.md` documents it.

**Out:**
- Re-diarizing.
- Speaker names on publisher (VTT) transcripts, which carry none.

#### Acceptance criteria
- [ ] Setting names on a fixture episode stores them, and a second `discover` keeps them.
- [ ] A diarized fixture has guest segments named "A". After setting ["A", "B"], no segment says
  "A", and its passages show "speaker not verified".
- [ ] `--clear` restores the title's names, and setting the same list again changes nothing.
- [ ] An unknown episode reference errors without writing anything.
- [ ] The `attribute` hint shows for a title with "and" and one guest.

#### Tests required
Ingest command tests with a temporary store; a core store test for the downgrade.

#### Security notes
Integrity of attribution (threat model, assets): this fails closed (`SECURE-CODING.md` 5). The
command only ever removes names from segments, never adds them.

#### Skills to consult
`dear-steven-architecture`, `dear-steven-persona`.

#### Human steps
None.

#### Dependencies
None. **Size:** S.

---

### P11-07 — feat(ingest): backup and restore commands that check what they copy

<!-- issue {"id":"P11-07","title":"feat(ingest): backup and restore commands that check what they copy","labels":["type:service","stage:m9","track:ingest","track:infra","owner:ai","risk:medium","P1","size:S"],"milestone":"M9 Open to contributors","depends":[],"github":154} -->

#### Context
The knowledge base is one SQLite file in WAL mode. `docs/DEPLOY.md` explains a manual `.backup`
and a careful swap, but nothing automates it or checks a copy. Copying the file while the server
writes can produce a broken copy.

Rebuilding isn't free either. Diarized transcripts, embeddings and summaries cost money (about
$73 of diarization so far), so a lost volume loses paid work.

#### Goal
`pnpm ingest backup` makes a consistent, checked copy, and `pnpm ingest restore` puts one back
safely.

#### Scope
**In:**
- `backup [--to <dir>] [--keep N]`:
  - takes a SQLite online backup (better-sqlite3's `backup()`);
  - runs `PRAGMA integrity_check` and compares row counts on the copy;
  - writes the copy owner-only (0600) with a timestamped name;
  - removes old copies beyond N;
  - prints the size and the counts.
  - Warns when `--to` is outside `data/` (`.gitignore` won't cover it).
- `restore <file> --yes`:
  - refuses unless the integrity check passes and the schema version (`user_version`) is one this
    code knows;
  - refuses while another process holds the database (documented: stop the web server first);
  - keeps the current file as `.before-restore` and swaps by an atomic rename.
- `status` shows the age of the latest backup.
- `docs/DEPLOY.md` uses the commands in place of the manual steps, with an example schedule
  (not switched on).

**Out:**
- Off-site copies, which need a storage account and secrets (a person).
- Scheduling on the deployment (P5-10, #63).

#### Acceptance criteria
- [ ] A backup taken while a writer is busy passes `integrity_check` (a test with a writer).
- [ ] A truncated copy is refused by `restore`, and so is a copy from a newer schema.
- [ ] Copies have mode 0600, and `--keep` prunes the oldest.

#### Tests required
Ingest command tests in temporary directories.

#### Security notes
Backups hold transcripts. They are owner-only, never in the image and never committed.

#### Skills to consult
`dear-steven-security`; the testing skills.

#### Human steps
None. An off-site copy later needs an account.

#### Dependencies
None. **Size:** S.

---

### P11-14 — feat(ingest): a retried diarization reuses the chunks it already paid for

<!-- issue {"id":"P11-14","title":"feat(ingest): a retried diarization reuses the chunks it already paid for","labels":["type:service","stage:m9","track:ingest","owner:ai","risk:medium","P2","size:M"],"milestone":"M9 Open to contributors","depends":["P10-16"],"github":155} -->

#### Context
Diarized transcription sends an episode's audio in five-minute chunks, up to ten at a time. When
one fails (a timeout, a dropped connection, the account's limit), the whole episode is marked
failed and its finished chunks are thrown away. Since P10-16 they are counted, but a retry pays
for them again. In the 2026-10-16 batch, one network outage cost an episode 16 paid chunks out of
22.

#### Goal
A retry pays only for the chunks it doesn't have yet.

#### Scope
**In:**
- After each chunk, its diarized result is written to
  `data/cache/diarized/<episode>/<audio sha-256>/<index>.json`, owner-only.
- On the next attempt, chunks whose audio hash and boundaries match are read from there, and only
  the rest are sent. The cost counts only the chunks sent.
- The cache is removed when the episode succeeds. `status` shows partly cached episodes and their
  size.
- A cached chunk that fails validation is discarded and sent again.

**Out:**
- Keeping the downloaded audio (it is deleted on purpose, to save disk).
- Reuse across different chunk lengths.

#### Acceptance criteria
- [ ] An episode that failed after 3 of 5 chunks sends only 2 when retried (the fake OpenAI counts
  calls) and records the cost of 2.
- [ ] Changed audio (a different hash) reuses nothing.
- [ ] A corrupted cache file is ignored and its chunk is sent again.
- [ ] Success removes the cache, and cache files have mode 0600.

#### Tests required
`transcribe.test.ts`, with the existing stand-ins.

#### Security notes
SR-13: spending stays bounded and is only ever lower. The cache holds transcript text, so it lives
under `data/` and is never committed.

#### Skills to consult
`dear-steven-security`; the testing skills.

#### Human steps
None.

#### Dependencies
P10-16 (done). **Size:** M.

---

### P11-15 — chore(ingest): spike — free semantic search with a local embedding model

<!-- issue {"id":"P11-15","title":"chore(ingest): spike — free semantic search with a local embedding model","labels":["type:spike","stage:m9","track:ingest","track:core","owner:ai","risk:medium","P2","size:M","help wanted"],"milestone":"M9 Open to contributors","depends":[],"github":156} -->

#### Context
Semantic search and related moments need an embedding of every passage. These are made with
OpenAI's `text-embedding-3-small` (`packages/core/src/openai/embedder.ts`). That's cheap (about
$0.07 for the 7,700 newest passages), but it needs a paid key, and the question itself is
embedded on every ask.

Without embeddings the app falls back to keyword search. That misses paraphrases and questions in
another language, such as a German question on English transcripts; P6-01 translates the query
with the model.

The project is TypeScript-only (`plan/00-vision.md` § 6). That rules out Python toolchains, but
not ONNX models run from Node (transformers.js).

#### Goal
Find out whether a small local model can replace the paid embedder for search: its recall, speed,
memory, licence and supply-chain cost.

#### Scope
**In:**
- On a branch, an `Embedder` backed by a local model, behind a flag. Candidates: a multilingual
  MiniLM or e5-small class model.
- `pnpm eval` recall@10 for keyword-only, OpenAI (from an already embedded copy, if available) and
  local.
- Time and peak memory to embed the knowledge base on a laptop, and per question on a 1 GB
  machine.
- How vectors of another size would sit beside today's: a second vec0 table, or a migration.
- The model's download size and licence, and how it's pinned: a revision plus a checksum, fetched
  at build or ingest time and never because a visitor asked.

**Out:** shipping it. That's a follow-up issue if recommended.

#### Acceptance criteria
- [ ] A findings note in `plan/11-research/` with the numbers and a recommendation.
- [ ] Nothing merged into the main path.

#### Tests required
None (spike). The branch's eval output goes in the note.

#### Security notes
Supply chain:
- A model is code-like data: pinned and checksummed, never fetched at request time.
- The new dependency needs the justification in `SECURE-CODING.md` 9.
- The ONNX runtime ships native binaries, so pnpm's `onlyBuiltDependencies` needs a review.

#### Skills to consult
`dear-steven-architecture`, `dear-steven-security`.

#### Human steps
None.

#### Dependencies
None. **Size:** M.

---

## Free features

### P11-08 — feat(web): find the moment — search what was said across every conversation

<!-- issue {"id":"P11-08","title":"feat(web): find the moment — search what was said across every conversation","labels":["type:ui","stage:m9","track:web","track:core","owner:ai","risk:medium","P1","size:M","help wanted"],"milestone":"M9 Open to contributors","depends":[],"github":157} -->

#### Context
The episode explorer (`components/stage/EpisodeExplorer.tsx`, `GET /api/episodes?q=`) searches
titles and guest names only. The knowledge base already has full-text search over every passage:
`KnowledgeStore.ftsSearch`, FTS5 with BM25, safe from query injection through `toFtsQuery`. Today
it is only used inside answers.

"The checker" (`docs/PRODUCT.md` § 2) wants to find where something was said. That costs nothing:
no model, no embedding, and it works on any copy that has a knowledge base.

#### Goal
Type a few words and see the moments they were said. Open one in the evidence inspector, or at its
time in the video or podcast.

#### Scope
**In:**
- `GET /api/search?q=&page=`:
  - zod-validated, with `q` of 2–100 characters;
  - FTS5 over passages, at most 2 results per episode, 10 per page and 3 pages;
  - each result carries the episode (title, date, guests), the passage id and a snippet;
  - the snippet is at most 30 words around the match, stored text only, with match offsets for
    highlighting, never HTML from the database;
  - each result also carries the segment's speaker state, shown the way chips show it, and the
    podcast and video moments (`resolveMoment`).
- Rate-limited in the shared passages-and-episodes bucket (SR-07), with
  `Cache-Control: no-store`.
- The interface:
  - a "What was said" search in the explorer, with results as a list;
  - a result opens the evidence inspector on that passage;
  - empty, no-results and rate-limited states;
  - keyboard and screen-reader friendly, in English and German.
- Without a knowledge base, the search says nothing is indexed yet.

**Out:**
- Semantic search, which needs embeddings.
- Searching summaries.
- Search operators: the query builder quotes every term, on purpose.

#### Acceptance criteria
- [ ] A word from a fixture transcript returns that passage, with a snippet that contains it.
- [ ] Queries with FTS syntax (`"`, `*`, `NEAR`, `-`, `^`) give results or none, never an error
  (SR-08).
- [ ] No response carries more than 30 words of transcript per result, more than 10 results, or a
  page past the third. Tested with a long passage.
- [ ] Past the rate limit, the response is `429`.
- [ ] A result opens the inspector at the right passage (e2e on a fixture knowledge base built
  like `e2e/free-fixtures.ts`: labelled fixture text only).
- [ ] axe passes, and the copy is in English and German.

#### Tests required
Route tests; a store test for snippet bounds; e2e.

#### Security notes
- SR-07, bulk extraction: the snippet length, page size, page cap and rate limit together bound
  how much transcript one client can pull. Full passages are never returned here; the inspector
  already fetches one at a time.
- Queries are never logged.
- Rights: short, attributed quotations only (README, "Rights").

#### Design notes
Follow `docs/DESIGN.md`: the explorer's list styles, the speaker colours the chips use, and
highlights as `<mark>` styled by tokens. On a phone it opens as a sheet.

#### Skills to consult
The frontend design skills, `docs/DESIGN.md`, `dear-steven-architecture`, `dear-steven-security`.

#### Human steps
None.

#### Dependencies
None. **Size:** M.

---

### P11-09 — feat(core): quotes-only replies when no answer model is available

<!-- issue {"id":"P11-09","title":"feat(core): quotes-only replies when no answer model is available","labels":["type:core","stage:m9","track:core","track:answers","owner:ai","risk:medium","P1","size:M"],"milestone":"M9 Open to contributors","depends":[],"github":158} -->

#### Context
Without a usable answer model, a server shows labelled demo fixtures, or the resting reply once
the daily cap is reached, even when a real knowledge base is on disk. That happens:
- when there is no key;
- on a production server without a daily cap (P10-01's `no_daily_cap`);
- after the cap is reached for the day.

Yet everything needed to show real moments without a model is there: keyword search, stored
passages, speaker states and links. Someone who doesn't want to pay for answers, or whose quota
has run out, gets nothing real today.

#### Goal
With an opt-in setting, a question asked when no model is available gets "here is where this came
up": real quotations, with their citations, and no generated words.

#### Scope
**In:**
- `DEAR_STEVEN_NO_MODEL_REPLIES=quotes` (default `fixtures`, today's behaviour). It applies when
  the answer model isn't available for the request (no key, held back, or the cap reached) and
  the knowledge base has passages.
- In the core, `quotesReply(store, question, locale)`:
  - searches by keyword (`hybridSearch` with no embedder);
  - takes the top 3 passages, at most 1 per episode;
  - for each, makes a quote block: a verbatim span of the passage (the sentences that hold the
    most query terms, located with `locateQuote`), with its citation, speaker state and moments;
  - opens with a fixed framing line from the copy catalogue. It's in English and German, it isn't
    first person and it isn't the persona. For example: "There's no AI answer right now. Here's
    where this came up in the conversations."
  - goes through `validateBlock` like any answer.
- A new answer mode, `quotes`. Share links, conversation memory and exports accept and label it.
- **Safety:** the phrase rules run first (crisis → the fixed reply, refuse → the refusal), as in
  demo mode. When a moderator is configured but failing, the question stays unanswered (P10-06).
  Quotes-only never gets around a failing safety check.
- **Talk:** the framing line is read aloud. The quotations are shown, not read: a stock voice
  reading a guest's words could be taken for theirs.
- `/api/status` reports which kind of reply visitors get, and the setup panel shows it.

**Out:**
- Making `quotes` the default. That's the owner's decision once it's been tried.
- Quotes from summaries.
- Any generated text.

#### Acceptance criteria
- [ ] With the setting on and no key, a question whose words appear in the fixture knowledge base
  gets 1–3 quote blocks. Each is a verbatim span of its passage, with the stored speaker state,
  and the only other text is the fixed framing line.
- [ ] When nothing matches, the reply is a fixed line saying so.
- [ ] A crisis phrase gets the crisis reply.
- [ ] With a key configured but moderation failing, the error is the same as today.
- [ ] With the setting off, fixtures behave exactly as today.
- [ ] No OpenAI request is made in any of these cases (a request-log test).
- [ ] The answer is labelled "Quotes only" in the interface, in share cards and in exports.

#### Tests required
- Core unit tests: the span is located, attribution is never upgraded, the framing line is fixed.
- Route tests.
- e2e with the setting on and a fixture knowledge base built like `e2e/free-fixtures.ts`
  (labelled fixture text only, never podcast text).

#### Security notes
- SR-04, SR-18: no model output at all, quotes are stored text, and attribution stays as stored
  (fails closed).
- SR-02: no paid call is possible on this path.

#### Design notes
A quiet "Quotes only" label where the answer's heading sits, with the existing quote and chip
styles. The disclosure stays.

#### Skills to consult
`dear-steven-persona` (the four kinds of statement; nothing in Steven Bartlett's name),
`dear-steven-architecture`, `dear-steven-security`.

#### Human steps
The owner decides later whether it becomes the default.

#### Dependencies
None. **Size:** M.

---

### P11-13 — feat(web): export a conversation as Markdown, every citation a link to its moment

<!-- issue {"id":"P11-13","title":"feat(web): export a conversation as Markdown, every citation a link to its moment","labels":["type:ui","stage:m9","track:web","owner:ai","risk:low","P2","size:S","good first issue","help wanted"],"milestone":"M9 Open to contributors","depends":[],"github":159} -->

#### Context
A visitor can share one answer (P6-17: a signed link and an image card) and keep a conversation on
this device (P5-11). They can't take a conversation away, to their notes or to check later.
Everything needed is already in the browser: the validated final answers, citations with their
speakers, episodes and moments.

#### Goal
"Download as Markdown" gives a faithful file of the conversation, where every quote says who said
it and links to the moment.

#### Scope
**In:**
- Client only: no request is made.
- What the file holds:
  - the disclosure first;
  - each question and answer, with paragraphs as written and the persona's synthesis plainly
    marked as Dear Steven's own words, not quotes;
  - quotes as blockquotes signed "host", the guest's name or "speaker not verified", with the
    episode title, `mm:ss`, and a link (the YouTube moment when matched, the podcast time
    otherwise);
  - demo answers labelled as demo.
- The file is named `dear-steven-YYYY-MM-DD.md`, with headings in English or German.
- Offered from the conversation's menu, and after an interview. "What I learned about you" is
  exported with the visitor's own quoted words.

**Out:**
- PDF.
- Server-side export.
- The transcript itself, which is never exported.

#### Acceptance criteria
- [ ] Exporting a fixture conversation gives a golden file (a unit test from the reducer's state).
- [ ] Nothing goes over the network on export (an e2e request log).
- [ ] The four kinds of statement stay apart in the file: host quote, guest quote, speaker not
  verified, synthesis.
- [ ] Links are rebuilt from ids (`linksAt`), never taken from stored strings.

#### Tests required
A golden-file unit test; an e2e download.

#### Security notes
Links are rebuilt from ids (the SR-17 rules), no transcript goes beyond the quoted spans, and
nothing is sent.

#### Design notes
A quiet secondary action in the conversation's menu, and a toast once downloaded.

#### Skills to consult
The frontend design skills; `dear-steven-persona`.

#### Human steps
None.

#### Dependencies
None. **Size:** S.

---

## Tests

### P11-16 — test(web): visual regression screenshots of the main screens

<!-- issue {"id":"P11-16","title":"test(web): visual regression screenshots of the main screens","labels":["type:test","stage:m9","track:web","track:design","owner:ai","risk:low","P2","size:M","help wanted"],"milestone":"M9 Open to contributors","depends":[],"github":160} -->

#### Context
The design system (`docs/DESIGN.md`) is enforced by review, and by e2e checks of structure and
accessibility, but not of looks. A token change or a dependency update (motion, Tailwind) can shift
the layout or colours on a screen nobody opened. P7-02 asked for screenshots in a PR description,
taken by hand.

#### Goal
A change to how a main screen looks shows up in the PR. Accepting an intended change takes one
command.

#### Scope
**In:**
- Playwright `toHaveScreenshot` for these screens:
  - home;
  - an answer with the evidence inspector open;
  - the explorer;
  - an interview question;
  - "What I learned about you";
  - the practice debrief;
  - the error and not-found pages.
- On desktop and mobile, with reduced motion, a fixed clock and fixtures.
- Baselines made in the Playwright Docker image, so they match CI (fonts differ on macOS).
- A `pnpm e2e:update-screens` script, and a threshold that ignores anti-aliasing.

**Out:**
- Every state of every component.
- Cross-browser screenshots.

#### Acceptance criteria
- [ ] The suite passes twice in a row in CI's image.
- [ ] Changing a colour token fails it, with a diff artifact.
- [ ] Snapshots hold demo fixtures only, never podcast text.

#### Tests required
The suite itself.

#### Security notes
None. The fixtures are fictional and labelled (P1-06).

#### Design notes
`docs/DESIGN.md` is the reference. Baselines are updated only with a design reason in the PR.

#### Skills to consult
Playwright; the frontend design skills.

#### Human steps
None.

#### Dependencies
None. **Size:** M.

---

### P11-17 — test(core): property-based tests for quote matching and the search query builder

<!-- issue {"id":"P11-17","title":"test(core): property-based tests for quote matching and the search query builder","labels":["type:test","stage:m9","track:core","owner:ai","risk:low","P2","size:S","good first issue"],"milestone":"M9 Open to contributors","depends":[],"github":161} -->

#### Context
Two functions carry a lot of trust:
- `locateQuote` (`packages/core/src/answer/quotes.ts`) decides whether a quote is real and returns
  the stored span.
- `toFtsQuery` (`packages/core/src/store/fts.ts`) turns visitor text into an FTS5 query that can't
  inject syntax (SR-08).

Both have example-based tests. Neither is tested against generated input: Unicode, odd whitespace,
punctuation, very long or empty text.

#### Goal
Their properties hold for any input, not just the examples.

#### Scope
**In:**
- `fast-check` as a dev dependency, justified in the PR: MIT, widely used, no install scripts.
- These properties:
  - any substring of a passage, with whitespace and case changed as far as `normalise` allows, is
    located, and the span returned is exactly the stored text;
  - text that isn't in the passage is never located as exact;
  - `locateQuote` never throws;
  - `toFtsQuery` of any string gives either nothing or a query FTS5 accepts, run against an
    in-memory FTS5 table, with no operator left unquoted;
  - `normalise` is idempotent.
- The suite runs in under 5 s in `pnpm test`.

**Out:** other modules.

#### Acceptance criteria
- [ ] The properties run with the unit tests.
- [ ] A deliberately broken quoting rule is caught (mutation-checked).
- [ ] Any counterexample is fixed in this PR if it's small, or gets its own issue.

#### Tests required
The suite itself.

#### Security notes
Strengthens SR-04 and SR-08.

#### Skills to consult
The testing skills.

#### Human steps
None.

#### Dependencies
None. **Size:** S.

---

## Ideas parked for later

These came up while writing this milestone. Each needs a decision, money or a partner first, so
none is an issue yet:
- **A local answer model** (for example Ollama) as a second provider: continue in the existing
  spike #5.
- **A "new this week" digest** of conversations added by `latest`, as a page, never an email list
  (no accounts).
- **A topic map** of the knowledge base: needs embeddings (P11-15 first).
- **Speaker labels for the publisher's transcripts**, which have none: only with a free, local
  diarization that passes the P8-11 bar. Python toolchains are out (vision § 6).
- **Disagreements between guests:** P5-06 waits on the live eval.
- **A browser extension** ("ask about the episode on this page"): cross-site rules (SR-23) and
  rights first.
