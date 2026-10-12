import { describe, expect, it, vi } from 'vitest';
import { config } from 'zod';
import { FinalAnswerSchema } from './index.ts';

describe('schema entry point', () => {
  it('turns off the eval probe a strict CSP would refuse', () => {
    expect(config().jitless).toBe(true);
  });

  it('parses without ever calling Function', () => {
    const spy = vi.spyOn(globalThis, 'Function');
    FinalAnswerSchema.safeParse({ blocks: [] });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
