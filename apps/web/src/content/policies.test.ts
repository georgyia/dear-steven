import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTACT, CONTACT_PENDING, POLICIES, policyMarkdown } from './policies';

const repo = (file: string) => new URL(`../../../../${file}`, import.meta.url);

describe('policies (P6-12)', () => {
  it('the repository files are exactly what the app shows — run `pnpm policies` after editing', () => {
    for (const policy of POLICIES) {
      expect(readFileSync(repo(policy.file), 'utf8'), policy.file).toBe(policyMarkdown(policy));
    }
  });

  it('says plainly that the takedown contact is still to come, until there is one', () => {
    const terms = POLICIES.find((p) => p.file === 'TERMS.md');
    expect(terms && policyMarkdown(terms)).toContain(CONTACT ?? CONTACT_PENDING);
  });

  it('makes the privacy claims the code keeps', () => {
    // "Answers are requested with OpenAI's response storage switched off"
    const model = readFileSync(repo('packages/core/src/answer/model.ts'), 'utf8');
    expect(model).toContain('store: false');
    // "no tracking cookies and no analytics": no analytics package anywhere in the web app
    const web = readFileSync(repo('apps/web/package.json'), 'utf8');
    expect(web).not.toMatch(/analytics|gtag|segment|posthog|mixpanel|plausible|sentry/i);
    // "an answer log … is off unless they turn it on"
    const env = readFileSync(repo('packages/core/src/config/env.ts'), 'utf8');
    expect(env).toContain('logAnswers: flag(env.DEAR_STEVEN_LOG_ANSWERS)');
  });
});
