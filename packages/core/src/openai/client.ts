import OpenAI from 'openai';

/**
 * The one place an OpenAI client is constructed. Server-side only: the key comes from
 * `readConfig()` or, for one request, the visitor's own (`forVisitor`), and never reaches a
 * browser bundle (enforced by `pnpm arch`).
 */
export function createOpenAI(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, maxRetries: 3, timeout: 60_000 });
}

/**
 * Whether a key works and can use `model`, at no cost (`models.retrieve`). Resolves when it does;
 * otherwise throws the provider's error (401 rejected, 404 model unavailable to this key).
 */
export async function checkKey(client: OpenAI, model: string, signal?: AbortSignal) {
  await client.models.retrieve(model, { signal, maxRetries: 0 });
}
