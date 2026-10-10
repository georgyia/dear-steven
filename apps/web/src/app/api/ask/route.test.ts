import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const ask = (question: string) =>
  POST(
    new Request('http://localhost/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
      body: JSON.stringify({ question, history: [] }),
    }),
  );

describe('POST /api/ask past the daily cap (P6-08)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('gets the resting reply, and no request leaves the server', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dear-steven-cap-'));
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(join(dir, 'spend.json'), JSON.stringify({ day: today, usd: 0.0002 }));
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-a-real-key');
    vi.stubEnv('DEAR_STEVEN_DEMO', '');
    vi.stubEnv('DEAR_STEVEN_DB_PATH', join(dir, 'kb.db'));
    vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '0.0001');
    const network = vi.spyOn(globalThis, 'fetch');

    const res = await ask('How do I build discipline?');
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    const body = await res.text();
    expect(body).toMatch(/daily limit/);
    expect(body).toMatch(/"mode":"conversational"/);
    expect(network).not.toHaveBeenCalled();
  });
});
