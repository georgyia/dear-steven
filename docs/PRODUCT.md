# PRODUCT.md — what Dear Steven is

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | human | 2026-10-10 | every issue |

## 1. One sentence

> **Ask Steven a real question and get a thoughtful first-person answer whose every claim you can click through to the exact moment it was said.**

## 2. Who it is for

- **The listener with a real problem** — procrastination, a career decision, a relationship — who
  wants the best of hundreds of hours of conversations, applied to them, in a voice they enjoy.
- **The curious researcher** — who wants to check exactly who said what, in which episode, at
  which minute, before believing or repeating it.
- **The developer / maintainer** — one person running it locally or on a small server, adding
  episodes over time.

## 3. What it does (today)

- A cinematic home "stage" with one composer and a microphone; example questions; an honest
  readiness pill.
- Streams a first-person answer block by block: paragraphs, an occasional pull quote, a practical
  takeaway, and cards for the episodes it drew on.
- Inline citation chips open an evidence inspector: verbatim passage, speaker state, episode,
  podcast timestamp, surrounding transcript, the model's note on relevance, and the YouTube moment.
- Follow-up questions within a session (history is sent by the client; nothing is stored).
- Two ways to talk: **Ask** for a considered answer with its sources, or **Talk** for a quick
  back-and-forth (one to three sentences, read aloud by default when voice is available, still
  cited). The mode is kept for the visit; switching never loses the conversation.
- **Interview me**: Dear Steven interviews you, one question at a time, the way the show's
  conversations move, and ends with "What I learned about you", each line quoting your own words.
  Or **practise presenting your expertise**: a tougher interview about what you know, then a
  debrief (what came across, where you were vague, scores, one answer said the way it could land)
  and another go at the weakest answer.
- After an interview, **keep what I learned about you** on this device: answers then take it into
  account. You see exactly what is sent, can edit it, and Forget deletes it at once.
- Voice in (Web Speech, or recorder + server transcription) and voice out (stock voice, or the
  browser's), only on a user gesture.
- Demo mode with clearly labelled fixtures when no OpenAI key is configured.
- A CLI that builds the knowledge base from the publisher's RSS feed, incrementally.

## 4. What it deliberately does not do

- Pretend to be Steven Bartlett, imitate his voice, or claim affiliation with the show.
- Invent memories, opinions or quotes for the host, or conversations that did not happen.
- Store conversations (unless the operator turns on answer logging for evaluation).
- Publish or redistribute transcripts. No podcast content ships in the repository.
- Scrape YouTube captions in the pipeline.
- Listen continuously. The microphone opens only while the user holds or toggles it.
- Multi-user accounts, payments, analytics, a chat-history sidebar.

## 5. Vocabulary (use these words; do not invent synonyms)

| Term | Meaning | Do not say |
|------|---------|------------|
| **Dear Steven** / the persona | The AI character that answers in the first person | "Steven" (alone, for the AI), "the bot", "the assistant" |
| **Steven Bartlett** / the host | The real person who hosts the show | "Steven" when you mean the AI |
| **episode** / **conversation** | One podcast episode (UI copy prefers "conversation") | "video", "interview" for the unit |
| **passage** | A retrievable chunk of transcript (~350–500 tokens) | "chunk" in UI copy, "document" |
| **segment** | One transcript cue or speaker turn; the unit of speaker truth | "line" |
| **citation** / **chip** | A link from a claim to a passage | "footnote", "reference" |
| **attribution** | `host` · `guest` · `episode` · `synthesis` — whose statement a segment is | "source type" |
| **verified speaker** | Speaker label from diarization or a manual/publisher label | "known speaker" |
| **speaker not verified** | Real passage, transcript doesn't say who spoke | "anonymous", "unknown source" |
| **synthesis** | The persona's own reasoning and advice; never cited | "opinion of Steven" |
| **stage** | The single-page interface | "dashboard", "chat" |
| **evidence inspector** / drawer / sheet | The source panel (desktop) / bottom sheet (mobile) | "sidebar", "modal" |
| **Ask** / **Talk** | The two reply modes: a considered, sourced answer; or a short spoken-style reply with its chips | "chat mode", "quick mode" |
| **interview** / **Interview me** | Dear Steven asking the visitor questions, one at a time | "quiz", "chat" |
| **What I learned about you** | The interview's closing lines, each resting on a verbatim span of the visitor's answers | "profile", "summary of you" |
| **demo mode** | Fixture answers when no key is set; always labelled | "mock mode", "offline mode" |
| **knowledge base** | The SQLite file with episodes, segments, passages, embeddings | "vector DB", "corpus" in UI |
| **ingest** | Building the knowledge base with the CLI | "scrape", "crawl" |

## 6. Data and claims rules

- Demo fixtures are fictional, labelled "(fixture)" and "Demo Guest", and never attribute words to
  the real host. Video links are off in demo mode.
- Never claim a capability the code does not have (e.g. "verified speakers" when no episode is
  diarized). The setup panel says exactly what is configured.
- Quotes on screen are stored transcript text. Timestamps are podcast-relative; video timestamps
  are marked `≈` when estimated and omitted when alignment is unknown.
- A disclosure that Dear Steven is an AI persona — not Steven Bartlett, not affiliated with the
  show — is visible on every screen.
