import { describe, expect, it } from 'vitest';
import { de } from '@/i18n/de';
import { en } from '@/i18n/en';
import { describeFailure } from './errors';

const apiError = (status: number) =>
  Object.assign(new Error('Incorrect API key provided: sk-abc****xyz'), { status });

describe('describeFailure', () => {
  it('tells a visitor the operator’s key was rejected, and the operator what to do', () => {
    const f = describeFailure(apiError(401));
    expect(f.code).toBe('not_configured');
    expect(f.message).toBe(en.serverErrors.keyRejected);
    expect(f.log).toMatch(/^openai 401: .*OPENAI_API_KEY in \.env/);
    expect(`${f.message} ${f.log}`).not.toMatch(/sk-/);
  });

  it('tells a visitor whose own key was rejected to check it, and logs no operator hint', () => {
    const f = describeFailure(apiError(401), 'en', 'visitor');
    expect(f.message).toBe(en.serverErrors.yourKeyRejected);
    expect(f.log).not.toMatch(/OPENAI_API_KEY|\.env/);
  });

  it('words a rate limit for whoever owns the key', () => {
    const operator = describeFailure(apiError(429));
    expect(operator.message).toBe(en.serverErrors.rateLimited);
    expect(operator.log).toMatch(/^openai 429: .*billing/);
    const visitor = describeFailure(apiError(429), 'en', 'visitor');
    expect(visitor.message).toBe(en.serverErrors.yourKeyRateLimited);
    expect(visitor.log).not.toMatch(/billing/);
  });

  it('classifies rate limits, outages and network failures as upstream', () => {
    expect(describeFailure(apiError(429)).code).toBe('upstream');
    expect(describeFailure(apiError(503)).code).toBe('upstream');
    expect(describeFailure(new Error('fetch failed')).code).toBe('upstream');
  });

  it('words the message in the visitor’s interface language, and the log in English', () => {
    expect(describeFailure(apiError(500), 'de').message).toBe(
      'OpenAI hatte gerade ein Problem beim Antworten.',
    );
    const rejected = describeFailure(apiError(401), 'de');
    expect(rejected.message).toBe(de.serverErrors.keyRejected);
    expect(rejected.log).toBe(describeFailure(apiError(401), 'en').log);
  });

  it('falls back to a generic internal error', () => {
    expect(describeFailure(new TypeError('x is undefined'))).toEqual({
      code: 'internal',
      message: 'Something went wrong on my end.',
      log: 'TypeError',
    });
  });
});
