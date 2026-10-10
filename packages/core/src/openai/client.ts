import OpenAI from 'openai';

/**
 * The one place an OpenAI client is constructed. Server-side only: the key comes from
 * `readConfig()` and never reaches a browser bundle (enforced by `pnpm arch`).
 */
export function createOpenAI(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, maxRetries: 3, timeout: 60_000 });
}
