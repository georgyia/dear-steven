import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkKey, createOpenAI } from './client.ts';

const KEY = 'sk-test-0000000000000000000000';

describe('checkKey (P6-03)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks for the model, free, on the given key', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ id: 'gpt-x', object: 'model' }));
    await checkKey(createOpenAI(KEY), 'gpt-x');
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://api.openai.com/v1/models/gpt-x');
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${KEY}`);
  });

  it('throws the status of a rejected key, without retrying', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ error: { message: 'Incorrect API key' } }, { status: 401 }),
      );
    await expect(checkKey(createOpenAI(KEY), 'gpt-x')).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
