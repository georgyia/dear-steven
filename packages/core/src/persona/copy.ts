/**
 * Words the server streams to the thought line, plus the empty-knowledge-base reply. Defined here
 * (not in the web app's brand.ts, which re-exports them) so live and demo answers read the same.
 */
const n = (x: number) => x.toLocaleString('en-GB');
const s = (x: number) => (x === 1 ? '' : 's');

export const THINKING_COPY = {
  searching: (episodes: number) =>
    episodes > 0
      ? `Searching ${n(episodes)} conversation${s(episodes)}…`
      : 'Searching my conversations…',
  found: (passages: number, episodes: number) =>
    passages === 0
      ? 'Nothing close in the transcripts'
      : `${passages} passage${s(passages)} from ${episodes} episode${s(episodes)}`,
  writing: 'Composing',
  checking: 'Checking every quote against the transcript',
  done: 'Thought for',
} as const;

export const EMPTY_KNOWLEDGE_REPLY = {
  text: 'I haven’t got any of my conversations loaded yet, so anything I said now would be a guess dressed up as a memory — and I’d rather not do that to you.',
  hint: 'Run `pnpm ingest all --limit 20` to load the twenty most recent episodes, then ask me again.',
  spoken:
    'I haven’t got any of my conversations loaded yet, so I’d only be guessing. Load a few episodes with the ingest command and ask me again.',
} as const;
