// The guided-setup e2e builds its knowledge base from here, never from the real feed or OpenAI: a
// two-episode RSS feed whose VTT transcripts are labelled fixture text, and a fake embeddings
// endpoint. `node e2e/setup-fixtures.ts <port>`; started by playwright.config.ts.
import { rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { E2E_SETUP_DB, E2E_SETUP_ENV_FILE } from './setup-env.ts';

const port = Number(process.argv[2]);
const origin = `http://127.0.0.1:${port}`;
const root = new URL('../../../', import.meta.url);

for (const file of [
  E2E_SETUP_DB,
  `${E2E_SETUP_DB}-wal`,
  `${E2E_SETUP_DB}-shm`,
  E2E_SETUP_ENV_FILE,
]) {
  rmSync(new URL(file, root), { force: true });
}

const EPISODES = [1, 2];

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0">
<channel>
<title>E2E fixture feed</title>
${EPISODES.map(
  (n) => `<item>
<title>E2E fixture episode ${n}</title>
<guid>e2e-fixture-${n}</guid>
<pubDate>${new Date(Date.UTC(2026, 0, n)).toUTCString()}</pubDate>
<itunes:episodeType>full</itunes:episodeType>
<itunes:duration>600</itunes:duration>
<description>Fixture episode for the guided setup end-to-end test.</description>
<podcast:transcript url="${origin}/vtt/${n}.vtt" type="text/vtt"/>
</item>`,
).join('\n')}
</channel>
</rss>`;

const stamp = (s: number) =>
  `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.000`;

const vtt = (n: number) =>
  `WEBVTT\n\n${Array.from(
    { length: 60 },
    (_, i) =>
      `${stamp(i * 5)} --> ${stamp(i * 5 + 5)}\nFixture cue ${i + 1} of episode ${n}, written for the guided setup test and spoken by no one.`,
  ).join('\n\n')}\n`;

/** A deterministic unit vector, so the store accepts it like a real embedding. */
function vector(text: string, dimensions: number): number[] {
  let seed = [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const v = Array.from({ length: dimensions }, () => {
    seed = (seed * 1_103_515_245 + 12_345) >>> 0;
    return seed / 2 ** 32 - 0.5;
  });
  const norm = Math.hypot(...v);
  return v.map((x) => x / norm);
}

createServer((req, res) => {
  const vttMatch = req.url?.match(/^\/vtt\/(\d+)\.vtt$/);
  if (req.method === 'GET' && req.url === '/feed.xml') {
    res.writeHead(200, { 'Content-Type': 'application/rss+xml' }).end(feed);
  } else if (req.method === 'GET' && vttMatch && EPISODES.includes(Number(vttMatch[1]))) {
    res.writeHead(200, { 'Content-Type': 'text/vtt' }).end(vtt(Number(vttMatch[1])));
  } else if (req.method === 'POST' && req.url === '/v1/embeddings') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const { input, dimensions, model } = JSON.parse(body) as {
        input: string[];
        dimensions: number;
        model: string;
      };
      const tokens = input.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          object: 'list',
          model,
          data: input.map((text, index) => ({
            object: 'embedding',
            index,
            embedding: vector(text, dimensions),
          })),
          usage: { prompt_tokens: tokens, total_tokens: tokens },
        }),
      );
    });
  } else {
    res.writeHead(404).end();
  }
}).listen(port, '127.0.0.1');
