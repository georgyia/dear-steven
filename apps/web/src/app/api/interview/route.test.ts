import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MODERATION_UNAVAILABLE } from '@dear-steven/core/copy';
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

  it('runs a practice and debriefs it on the visitor’s own words, with no invented rewrite (P7-07)', async () => {
    const setup = { flavour: 'practice', expertise: 'Pricing for small agencies' };
    const answers = [
      'I help small agencies stop undercharging, usually by about 30 percent in a quarter.',
      'My own agency went broke in 2019 because we billed by the hour and never said no.',
      'It depends.',
      'One client doubled revenue in a year after we moved them to fixed fees per project.',
      'I once priced a rebrand at a tenth of its value and resented every hour of it.',
      'Charge for the outcome, not the hours.',
    ];
    const turns: InterviewTurn[] = [];
    for (const answer of answers) {
      const { reply } = await step({ setup, turns, action: 'next' });
      if (reply.type !== 'question') throw new Error(`expected a question, got ${reply.type}`);
      expect(reply.total).toBe(6);
      turns.push({ question: reply.question, stage: reply.stage, answer });
    }
    expect(turns.map((t) => t.stage)).toEqual([
      'opening',
      'origin',
      'belief',
      'evidence',
      'mistake',
      'takeaway',
    ]);
    const { reply } = await step({ setup, turns, action: 'next' });
    if (reply.type !== 'debrief') throw new Error('expected a debrief');
    expect(reply.demo).toBe(true);
    const { debrief } = reply;
    for (const p of [...debrief.strengths, ...debrief.improvements]) {
      expect(answers[p.turn]).toContain(p.evidence);
    }
    expect(debrief.weakest).toBe(2);
    expect(debrief.rewrite).toBeNull();
    for (const v of Object.values(debrief.scores)) expect(v).toBeGreaterThanOrEqual(1);
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

describe('POST /api/interview when moderation gives no verdict (P10-06)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('stops with an upstream error in the visitor’s language, and asks the model nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dear-steven-interview-moderation-'));
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-moderation-down');
    vi.stubEnv('DEAR_STEVEN_DEMO', '');
    vi.stubEnv('DEAR_STEVEN_DB_PATH', join(dir, 'kb.db'));
    vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '');
    vi.stubEnv('DEAR_STEVEN_FREE_QUESTIONS', '');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    // OpenAI refuses every call, echoing text that must never be shown or logged.
    const network = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { message: 'Moderation refused: sk-test-mod' } }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const { res, reply } = await step({
      setup: {},
      turns: [{ question: 'What do you do?', stage: 'opening', answer: 'I run a design studio.' }],
      action: 'next',
      uiLocale: 'de',
    });
    expect(res.status).toBe(502);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(reply.error).toEqual({ code: 'upstream', message: MODERATION_UNAVAILABLE.de });
    const called = network.mock.calls.map(([url]) => new URL(String(url)).pathname);
    expect(called).toEqual(['/v1/moderations', '/v1/moderations']);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain('moderation unavailable');
    expect(JSON.stringify(log.mock.calls)).not.toContain('sk-test');
  });
});
