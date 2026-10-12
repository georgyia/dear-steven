import { createHmac, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { type AppConfig, readConfig } from '@dear-steven/core/config';
import type { AskEvent, FinalAnswer } from '@dear-steven/core/schema';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as ask } from '@/app/api/ask/route';
import { POST as share } from '@/app/api/share/route';
import { MESSAGES } from '@/i18n';
import { relinked } from '@/lib/memory';
import { readEvents } from '@/lib/sse';
import { streamDemoAnswer } from './demo';
import { resetRateLimits } from './rate-limit';
import { openSharedAnswer, openShareToken, shareToken, withShareToken } from './share';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

const QUESTION = 'Why do I procrastinate?';
const copy = MESSAGES.en.serverErrors;
const g = globalThis as { __dearStevenShareSecrets?: Map<string, Buffer> };

const deployment = (): AppConfig => ({
  ...readConfig({}),
  dbPath: join(mkdtempSync(join(tmpdir(), 'dear-steven-share-')), 'kb.db'),
});

let answer: FinalAnswer;
beforeAll(async () => {
  for await (const e of streamDemoAnswer(
    { question: QUESTION },
    new AbortController().signal,
    async () => {},
  )) {
    if (e.type === 'final') answer = e.answer;
  }
});

/** A token signed with this deployment's real secret around any body — what an attacker can't do. */
function signed(config: AppConfig, json: string): string {
  const key = readFileSync(join(config.dbPath, '..', 'share-secret'));
  const body = deflateRawSync(json).toString('base64url');
  const mac = createHmac('sha256', key).update(`dear-steven/share/v1.${body}`).digest('base64url');
  return `v1.${body}.${mac}`;
}

const flip = (s: string, at: number) =>
  `${s.slice(0, at)}${s[at] === 'A' ? 'B' : 'A'}${s.slice(at + 1)}`;

describe('share tokens', () => {
  afterEach(() => vi.restoreAllMocks());

  it('open to exactly the answer that was written, links rebuilt', () => {
    const config = deployment();
    const token = shareToken(config, QUESTION, answer);
    expect(token).toMatch(/^v1\.[\w-]+\.[\w-]{43}$/);
    const opened = openShareToken(config, token ?? '');
    expect(opened).toEqual({ question: QUESTION, answer: relinked(answer) });
  });

  it('carry no links and no token of their own', () => {
    const config = deployment();
    const token = shareToken(config, QUESTION, { ...answer, share: 'v1.old.token' }) ?? '';
    const json = inflateRawSync(Buffer.from(token.split('.')[1] ?? '', 'base64url')).toString();
    const carried = JSON.parse(json) as { answer: FinalAnswer };
    expect(carried.answer.share).toBeUndefined();
    for (const c of carried.answer.citations) {
      expect(c.youtubeUrl).toBeNull();
      expect(c.embedUrl).toBeNull();
    }
  });

  it('open nothing once a single character has changed', () => {
    const config = deployment();
    const token = shareToken(config, QUESTION, answer) ?? '';
    const [, body = '', mac = ''] = token.split('.');
    expect(openShareToken(config, `v1.${flip(body, 40)}.${mac}`)).toBeNull();
    expect(openShareToken(config, `v1.${body}.${flip(mac, 5)}`)).toBeNull();
    expect(openShareToken(config, `v1.${body.slice(0, -4)}.${mac}`)).toBeNull();
    expect(openShareToken(config, `v2.${body}.${mac}`)).toBeNull();
    expect(openShareToken(config, `${token}.x`)).toBeNull();
    expect(openShareToken(config, '')).toBeNull();
  });

  it('made by another copy do not open here', () => {
    const token = shareToken(deployment(), QUESTION, answer) ?? '';
    expect(openShareToken(deployment(), token)).toBeNull();
  });

  it('are re-validated even when the signature holds', () => {
    const config = deployment();
    shareToken(config, QUESTION, answer); // creates the secret
    const notAnAnswer = JSON.stringify({ question: QUESTION, answer: { blocks: 'x' } });
    expect(openShareToken(config, signed(config, notAnAnswer))).toBeNull();
    expect(openShareToken(config, signed(config, '{ not json'))).toBeNull();
  });

  it('cannot be a decompression bomb', () => {
    const config = deployment();
    shareToken(config, QUESTION, answer);
    const padded = { ...answer, spoken: ` ${' '.repeat(2 ** 20)}` };
    const bomb = signed(config, JSON.stringify({ question: QUESTION, answer: padded }));
    expect(bomb.length).toBeLessThan(24_000);
    expect(openShareToken(config, bomb)).toBeNull();
  });

  it('are not made for an answer too long for a link', () => {
    const huge = { ...answer, spoken: randomBytes(30_000).toString('hex') };
    expect(shareToken(deployment(), QUESTION, huge)).toBeUndefined();
  });

  it('keep opening after a restart: the secret is saved, owner-only', () => {
    const config = deployment();
    const token = shareToken(config, QUESTION, answer) ?? '';
    const path = join(config.dbPath, '..', 'share-secret');
    expect(statSync(path).mode & 0o777).toBe(0o600);
    g.__dearStevenShareSecrets?.clear();
    expect(openShareToken(config, token)).not.toBeNull();
  });

  it('are attached to the final event only', async () => {
    const config = deployment();
    async function* events(): AsyncGenerator<AskEvent> {
      yield { type: 'status', step: 'searching', message: 'Searching…' };
      yield { type: 'final', answer };
    }
    const out: AskEvent[] = [];
    for await (const e of withShareToken(events(), config, QUESTION)) out.push(e);
    expect(out[0]).toEqual({ type: 'status', step: 'searching', message: 'Searching…' });
    const final = out[1];
    expect(final?.type === 'final' && final.answer.share).toBeTruthy();
  });
});

describe('opening a shared live answer', () => {
  const live = () => ({ ...answer, demo: false });
  /** The passages as stored now: each cited one, holding every quote, unless it was taken down. */
  const knowledge = (takenDown: string[] = []) => {
    const quotes = answer.blocks.flatMap((b) => (b.kind === 'quote' ? [b.text] : [])).join(' ');
    const asked: string[][] = [];
    const store = {
      getPassagesByIds: (ids: string[]) => {
        asked.push(ids);
        return ids.filter((id) => !takenDown.includes(id)).map((id) => ({ id, text: quotes }));
      },
    };
    return { asked, open: () => store };
  };

  it('opens while every source is still in the knowledge base', () => {
    const config = deployment();
    const kb = knowledge();
    const opened = openSharedAnswer(config, shareToken(config, QUESTION, live()) ?? '', kb.open);
    expect('shared' in opened && opened.shared.question).toBe(QUESTION);
    expect(kb.asked).toEqual([answer.citations.map((c) => c.passageId)]);
  });

  it('stops opening once a cited episode is taken down', () => {
    const config = deployment();
    const token = shareToken(config, QUESTION, live()) ?? '';
    const gone = answer.citations[0]?.passageId ?? '';
    expect(openSharedAnswer(config, token, knowledge([gone]).open)).toEqual({ refused: 'gone' });
    expect(openSharedAnswer(config, token, () => null)).toEqual({ refused: 'gone' });
  });

  it('never looks a demo answer or a broken link up', () => {
    const config = deployment();
    const kb = knowledge();
    expect(
      'shared' in openSharedAnswer(config, shareToken(config, QUESTION, answer) ?? '', kb.open),
    ).toBe(true);
    expect(openSharedAnswer(config, 'v1.x.y', kb.open)).toEqual({ refused: 'broken' });
    expect(kb.asked).toEqual([]);
  });
});

describe('POST /api/share', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('DEAR_STEVEN_DEMO', '');
    vi.stubEnv('DEAR_STEVEN_DB_PATH', deployment().dbPath);
  });
  afterEach(() => vi.unstubAllEnvs());

  const post = (body: string) =>
    share(
      new Request('http://localhost/api/share', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
        body,
      }),
    );

  it('opens a link /api/ask signed, and nothing else', async () => {
    const res = await ask(
      new Request('http://localhost/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: QUESTION }),
      }),
    );
    let final: FinalAnswer | null = null;
    for await (const e of readEvents(res.body as ReadableStream<Uint8Array>)) {
      if (e.type === 'final') final = e.answer;
    }
    const token = final?.share ?? '';
    expect(token).not.toBe('');

    const opened = await post(JSON.stringify({ token }));
    expect(opened.status).toBe(200);
    expect(opened.headers.get('cache-control')).toBe('no-store');
    const body = (await opened.json()) as { question: string; answer: FinalAnswer };
    expect(body.question).toBe(QUESTION);
    expect(body.answer.blocks).toEqual(final?.blocks);
    expect(body.answer.demo).toBe(true);

    for (const bad of [
      JSON.stringify({ token: flip(token, 30) }),
      '{',
      '{"token":1}',
      'x'.repeat(40_000),
    ]) {
      const res = await post(bad);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await res.text()).toContain(copy.shareBroken);
    }
  });

  it('is rate-limited', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await post('{}')).status);
    expect(statuses.at(-1)).toBe(429);
  });
});
