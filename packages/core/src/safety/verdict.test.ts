import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODERATION_UNAVAILABLE } from '../persona/copy.ts';
import type { ModerationResult } from './route.ts';
import { ModerationUnavailableError, moderationVerdict, UNAVAILABLE } from './verdict.ts';

const CLEAN: ModerationResult = { flagged: false, categories: {}, scores: {} };

/** A provider error as the OpenAI SDK throws it: a status, and text that must never be logged. */
const providerError = (status: number) =>
  Object.assign(new Error(`${status} Incorrect API key provided: sk-proj-****abcd`), { status });

/** A moderator that fails `failures` times, then gives a clean verdict; it counts its calls. */
function flaky(failures: number) {
  const calls = { n: 0 };
  const moderate = async () => {
    calls.n += 1;
    if (calls.n <= failures) throw providerError(503);
    return CLEAN;
  };
  return { moderate, calls };
}

describe('moderationVerdict (P10-06)', () => {
  afterEach(() => vi.restoreAllMocks());
  const signal = () => new AbortController().signal;

  it('is null with no moderator configured: the phrase rules decide alone', async () => {
    expect(await moderationVerdict(undefined, 'Why do I procrastinate?', signal())).toBeNull();
  });

  it('gives the first verdict, asked once', async () => {
    const { moderate, calls } = flaky(0);
    expect(await moderationVerdict(moderate, 'hello', signal())).toEqual(CLEAN);
    expect(calls.n).toBe(1);
  });

  it('asks once more after a failure, and quietly takes the second verdict', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { moderate, calls } = flaky(1);
    expect(await moderationVerdict(moderate, 'hello', signal())).toEqual(CLEAN);
    expect(calls.n).toBe(2);
    expect(log).not.toHaveBeenCalled();
  });

  it('has no verdict after two failures, and logs one line without the provider’s text', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { moderate, calls } = flaky(5);
    expect(await moderationVerdict(moderate, 'hello', signal())).toBe(UNAVAILABLE);
    expect(calls.n).toBe(2);
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]?.[0]);
    expect(line).toContain('moderation unavailable');
    expect(line).toContain('openai 503');
    expect(line).not.toMatch(/Incorrect|sk-/);
  });

  it('does not retry or log a visitor’s abort', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctrl = new AbortController();
    let calls = 0;
    const moderate = async () => {
      calls += 1;
      ctrl.abort();
      throw new DOMException('aborted', 'AbortError');
    };
    expect(await moderationVerdict(moderate, 'hello', ctrl.signal)).toBe(UNAVAILABLE);
    expect(calls).toBe(1);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('ModerationUnavailableError', () => {
  it('is an upstream failure, worded in the interface language', () => {
    expect(new ModerationUnavailableError()).toMatchObject({
      code: 'upstream',
      message: MODERATION_UNAVAILABLE.en,
    });
    expect(new ModerationUnavailableError('de').message).toBe(MODERATION_UNAVAILABLE.de);
  });
});
