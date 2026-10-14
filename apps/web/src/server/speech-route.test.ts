import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SPEECH_CONTENT_TYPE } from '@dear-steven/core/speech';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { POST } from '@/app/api/speech/route';
import { resetRateLimits } from './rate-limit';

/**
 * POST /api/speech (P9-01): raw PCM, passed on as OpenAI synthesises it, so the browser can start
 * playing from the first bytes. OpenAI here is a fetch mock that sends one piece of audio and
 * holds the rest until the test releases it.
 */
let network: MockInstance<typeof fetch>;
let release: () => void;
const FIRST = Uint8Array.of(1, 0, 255, 127);
const REST = Uint8Array.of(0, 128, 2, 0);

beforeEach(() => {
  resetRateLimits();
  const handles = (globalThis as { __dearSteven?: { client?: unknown; apiKey?: string } })
    .__dearSteven;
  if (handles) {
    handles.client = undefined;
    handles.apiKey = undefined;
  }
  const dir = mkdtempSync(join(tmpdir(), 'dear-steven-speech-'));
  vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-a-real-key');
  vi.stubEnv('DEAR_STEVEN_FREE_QUESTIONS', '');
  vi.stubEnv('DEAR_STEVEN_DEMO', '');
  vi.stubEnv('DEAR_STEVEN_ALLOW_OPERATOR_KEY', '');
  vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '');
  vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', '');
  vi.stubEnv('DEAR_STEVEN_DB_PATH', join(dir, 'kb.db'));
  vi.stubEnv('DEAR_STEVEN_ENV_FILE', join(dir, '.env'));
  network = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.endsWith('/audio/speech')) return new Response(null, { status: 404 });
    let held: () => void = () => undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(FIRST);
        held = () => {
          controller.enqueue(REST);
          controller.close();
        };
      },
    });
    release = () => held();
    return new Response(body, { headers: { 'content-type': 'application/octet-stream' } });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const say = (text: string) =>
  POST(
    new Request('http://localhost/api/speech', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
      body: JSON.stringify({ text, language: 'en' }),
    }),
  );

describe('spoken replies as they are synthesised (P9-01)', () => {
  it('asks OpenAI for PCM and passes it on as it arrives', async () => {
    const res = await say('Start before you feel ready.');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(SPEECH_CONTENT_TYPE);
    expect(res.headers.get('cache-control')).toBe('no-store');

    const [, init] = network.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      input: 'Start before you feel ready.',
      response_format: 'pcm',
    });

    // The first piece reaches the browser while OpenAI is still synthesising the rest.
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const first = await reader.read();
    expect([...(first.value ?? [])]).toEqual([...FIRST]);
    release();
    const rest: number[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      rest.push(...value);
    }
    expect(rest).toEqual([...REST]);
  });

  it('still refuses what it can’t read, before any call', async () => {
    const res = await say('   ');
    expect(res.status).toBe(400);
    expect(network).not.toHaveBeenCalled();
  });
});
