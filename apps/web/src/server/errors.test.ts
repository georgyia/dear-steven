import { describe, expect, it } from 'vitest';
import { describeFailure } from './errors';

const apiError = (status: number) =>
  Object.assign(new Error('Incorrect API key provided: sk-abc****xyz'), { status });

describe('describeFailure', () => {
  it('explains a rejected key without echoing the provider message', () => {
    const f = describeFailure(apiError(401));
    expect(f.code).toBe('not_configured');
    expect(f.message).toMatch(/OPENAI_API_KEY/);
    expect(`${f.message} ${f.log}`).not.toMatch(/sk-/);
  });

  it('classifies rate limits, outages and network failures as upstream', () => {
    expect(describeFailure(apiError(429)).message).toMatch(/rate-limiting|credit/);
    expect(describeFailure(apiError(503)).code).toBe('upstream');
    expect(describeFailure(new Error('fetch failed')).code).toBe('upstream');
  });

  it('words the message in the visitor’s interface language', () => {
    expect(describeFailure(apiError(500), 'de').message).toBe(
      'OpenAI hatte gerade ein Problem beim Antworten.',
    );
    expect(describeFailure(apiError(401), 'de').message).toMatch(/OPENAI_API_KEY/);
  });

  it('falls back to a generic internal error', () => {
    expect(describeFailure(new TypeError('x is undefined'))).toEqual({
      code: 'internal',
      message: 'Something went wrong on my end.',
      log: 'TypeError',
    });
  });
});
