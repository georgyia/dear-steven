# Security review: sessions, free questions and what is stored (re-check)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| reviewed | ai | 2026-10-15 | SR-02, SR-19, SR-23, #94, #95, #73 |

**Question (from the owner):** check the whole security system once more: sessions, how the free
questions are counted, how everything is stored. Is it secure, and do we need Supabase?

**Short answer.** The counting and the storage hold. Two gaps were found, and both have issues:

- **Other sites can make their visitors ask questions on your key (#94).** The API doesn't check
  where a request comes from, so any web page can send questions from its visitors' browsers,
  each from a real address. Proven against a production server. The fix is one check in the
  proxy.
- **Free questions can run without a daily cap (#95).** The cap is what bounds the bill when
  someone has many addresses, but nothing requires it. The fix: no cap, no free questions.

**Supabase: not needed now** (below).

## Scope

Read at `main` on 2026-10-15 (after #93):
- the visitor and access cookies;
- free questions (`server/free-questions.ts`) and interview tickets;
- the rate limiter and client addresses;
- the spend ledger and the deployment secrets;
- every API route that takes a body.

The keys themselves were reviewed on 2026-10-13 (`2026-10-13-keys.md`) and nothing about them has
changed since.

## How free questions are counted

1. **Who you are.** A visitor without a key of their own is counted twice:
   - **by browser:** an anonymous cookie `ds_visitor`, 16 random bytes and nothing else;
   - **by network:** the address this deployment can trust (IPv6 by its /64).
2. **How many.** The browser gets n (`DEAR_STEVEN_FREE_QUESTIONS`), the network 3n, and the
   stricter of the two decides. Both counts run for 30 days from their first question.
3. **When.** A question is counted before OpenAI is asked, and given back if it cost nothing: a
   safety reply, an empty knowledge base, a failure before any call.
4. **Interviews.** A whole interview counts once. Its first step returns a signed ticket, and each
   later step spends one of the ticket's 14 steps.
5. **When none are left.** `needs_key`, with no OpenAI call. Server voice is never offered on free
   questions. A visitor's own key is never counted.

## Checks

| # | Area | Check | Evidence | Verdict |
|---|------|-------|----------|---------|
| 1 | Sessions | What sessions exist | None: no accounts, no logins, no server-side session store. Two cookies. `ds_visitor`: an id for counting, `HttpOnly`, `Secure`, `SameSite=Lax`, 30 days. `ds_access` (only with an access code): `<expiry>.<HMAC-SHA256>`, keyed by a hash of the code, `HttpOnly`, `Secure`, `SameSite=Strict`, 30 days; changing the code signs every browser out | Holds |
| 2 | Free questions | Guessing or forging a visitor | The id is 128 random bits and carries no count; a forged or missing id is simply a new visitor, still bounded by the network count | Holds |
| 3 | Free questions | What the ledger stores | HMAC-SHA256 of the id and of the address under `data/free-secret` (32 random bytes, owner-only), cut to 192 bits; never the id or the address itself. Counts and a start time, nothing else | Holds |
| 4 | Free questions | The ledger file | `data/free-questions.json`, written owner-only by temp file and rename, at most a second after a change. If it can't be read, no free questions until it is fixed (fails closed). At most 50,000 browsers and 50,000 networks in 30 days | Holds |
| 5 | Free questions | Two questions at once | Counting is synchronous in one process: a question is taken before the model is asked, so parallel requests can't both take the last one | Holds |
| 6 | Free questions | Interview tickets | `v1.<id>.<expiry>.<HMAC>`, bound to the visitor's hash, 2 hours, at most 14 steps, compared with `timingSafeEqual`. Kept in memory: after a restart the next step counts as a new question | Holds |
| 7 | Free questions | Voice | `/api/speech` and `/api/transcribe` refuse free questions (they would read any text or hear any audio for free) | Holds |
| 8 | Free questions | Without a daily cap | Allowed. An IPv6 /48 holds 65,536 /64 networks (about 590,000 free questions at n = 3), and only the per-address rate limits slow them | **Gap: #95** |
| 9 | Requests | From other sites' pages | No route checks `Origin` or Fetch Metadata. `/api/ask` and `/api/interview` parse any body as JSON, and `/api/transcribe` takes a form, so a `no-cors` `text/plain` POST from any page works without a preflight. A production server answered one (`Origin: https://attacker.example`, `Sec-Fetch-Site: cross-site`) with `200` and a streamed answer. The other site's visitors become many real addresses asking on the operator's key, and their networks lose their free questions. With an access code set, the `Strict` cookie isn't sent, so these are refused | **Gap: #94** |
| 10 | Rate limits | Per address, can't be reset | Unchanged since P8-01 (`2026-10-13-keys.md` #13, #14) | Holds |
| 11 | Spend | The daily ledger | `data/spend.json`, temp file and rename; an unreadable ledger counts as spent | Holds |
| 12 | Secrets | `share-secret`, `free-secret` | 32 random bytes each, created on first use, `0600`, opened exclusively (`wx`), one per purpose; never logged or sent | Holds |
| 13 | Status | What `/api/status` tells anyone | Today's estimated spend and the cap, and the asker's own free questions. It shows how close the cap is, nothing about anyone else | Noted |
| 14 | Deployment | More than one instance | Ledgers and limits are per process (ADR-001); two machines would give everyone twice as much. `docs/DEPLOY.md` says to keep one machine | Noted |
| 15 | Deployment | Many people behind one address | A mobile carrier's shared address (CGNAT) can run out of its network's 3n for everyone behind it; they are asked for their own key. It fails safe | Noted |
| 16 | Requests | Large bodies | Some routes read the whole body before checking its size, but the proxy buffers at most 10 MB (Next's `proxyClientMaxBodySize` default) | Noted |

## Do we need Supabase? (#73)

**No, not now.** What Supabase would add, and why each part isn't needed yet:

- **Accounts, so free questions are per person.** Disposable email addresses cost nothing, so
  email sign-in raises the bar only a little. Phone or payment checks would raise it, but people
  would have to sign up before trying anything. The daily cap already bounds the bill, whatever
  anyone does, once #95 makes it required.
- **Visitors' keys on the server, so they follow them across devices.** That makes a database of
  working OpenAI keys the most valuable thing to steal, and its safety the operator's
  responsibility. Today a key is sealed in the visitor's own browser and dropped by the server
  after each request. That is safer.
- **Shared counters for several servers.** One machine (ADR-001) doesn't need them. If it ever
  does, a shared store (Redis, or the same SQLite file on one volume) is a smaller step than
  accounts.
- **Its cost.** A third party holding personal data (email addresses), which needs a GDPR
  processing agreement and an EU region, and a second service to run.

**When to revisit:** if free questions are abused beyond what the cap allows, if questions or
history should follow people across devices, or if Dear Steven moves to more than one server.

## Residual risks

- **Someone with many addresses gets more free questions.** The daily cap bounds the bill; after
  #95, free questions run only with one.
- **The cap is an estimate** (core `PRICES`). Keep a hard limit in the OpenAI dashboard too
  (`docs/DEPLOY.md`).
- **Once the cap is reached, everyone waits until midnight UTC**, including people who haven't
  used a question. A flood of free questions can use up the day for everyone. Visitors with their
  own key are not affected.
