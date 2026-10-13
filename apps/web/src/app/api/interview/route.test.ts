import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { InterviewReply, InterviewTurn } from '@dear-steven/core/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGES } from '@/i18n';
import { POST } from './route';

let ip = 0;
const step = async (body: unknown) => {
  ip += 1;
  const res = await POST(
    new Request('http://localhost/api/interview', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept-language': 'en-GB',
        'x-forwarded-for': `203.0.113.${ip}`,
      },
      body: JSON.stringify(body),
    }),
  );
  return { res, reply: (await res.json()) as InterviewReply & { error?: { message: string } } };
};

const ANSWERS = [
  'I run a small design studio in Leeds. We make brands for food start-ups.',
  'It started at my kitchen table with one client who paid us in pizza.',
  'Everything changed when our biggest client left and we had to rebuild.',
  'It cost me most of my twenties, and a lot of sleep.',
  'I thought we had to say yes to everything. We did not.',
  'Start smaller than feels respectable, and charge from day one.',
  'Now it matters most that the team still likes coming in.',
];

describe('POST /api/interview in demo mode (P7-06)', () => {
  beforeEach(() => {
    vi.stubEnv('DEAR_STEVEN_DEMO', '1');
    vi.stubEnv('OPENAI_API_KEY', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('runs a whole interview, then learns only what was said, labelled demo', async () => {
    const turns: InterviewTurn[] = [];
    for (const answer of ANSWERS) {
      const { res, reply } = await step({ setup: { name: 'Sam' }, turns, action: 'next' });
      expect(res.headers.get('cache-control')).toBe('no-store');
      if (reply.type !== 'question') throw new Error(`expected a question, got ${reply.type}`);
      expect(reply).toMatchObject({ index: turns.length, total: 7, demo: true });
      turns.push({ question: reply.question, stage: reply.stage, answer });
    }
    const { reply } = await step({ setup: { name: 'Sam' }, turns, action: 'next' });
    if (reply.type !== 'learned') throw new Error('expected what I learned');
    expect(reply.demo).toBe(true);
    expect(reply.lines.length).toBeGreaterThan(0);
    for (const line of reply.lines) expect(ANSWERS[line.turn]).toContain(line.evidence);
  });

  it('ends the interview with help when an answer says someone is in crisis', async () => {
    const { reply } = await step({
      setup: {},
      turns: [
        { question: 'How are you, really?', stage: 'opening', answer: 'I want to end my life.' },
      ],
      action: 'next',
    });
    expect(reply.type).toBe('ended');
    if (reply.type === 'ended') {
      expect(reply.reason).toBe('crisis');
      expect(JSON.stringify(reply.blocks)).toMatch(/Samaritans|116 123/);
    }
  });

  it('refuses what it can’t read, in the visitor’s language', async () => {
    const { res, reply } = await step({ setup: {}, turns: 'nope', action: 'next' });
    expect(res.status).toBe(400);
    expect(reply.error?.message).toBe(MESSAGES.en.serverErrors.interviewBroken);
  });
});

describe('POST /api/interview past the daily cap (P6-08)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('ends with the resting reply, and no request leaves the server', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dear-steven-interview-cap-'));
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(join(dir, 'spend.json'), JSON.stringify({ day: today, usd: 0.0002 }));
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-a-real-key');
    vi.stubEnv('DEAR_STEVEN_DEMO', '');
    vi.stubEnv('DEAR_STEVEN_DB_PATH', join(dir, 'kb.db'));
    vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '0.0001');
    const network = vi.spyOn(globalThis, 'fetch');

    const { reply } = await step({ setup: {}, turns: [], action: 'next' });
    expect(reply).toMatchObject({ type: 'ended', reason: 'resting' });
    expect(network).not.toHaveBeenCalled();
  });
});
