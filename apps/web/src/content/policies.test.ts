import { readFileSync } from 'node:fs';
import { LIMITS } from '@dear-steven/core/schema';
import { describe, expect, it } from 'vitest';
import { LOCALE_COOKIE } from '@/i18n';
import { REMEMBER_DAYS } from '@/lib/visitor-key';
import { ACCESS_COOKIE, ACCESS_MAX_AGE_S } from '@/server/access';
import { VISITOR_COOKIE, visitorCookie, WINDOW_MS } from '@/server/free-questions';
import {
  CONTACT,
  CONTACT_PENDING,
  OPERATOR,
  OPERATOR_PENDING,
  operatorLine,
  POLICIES,
  policyMarkdown,
} from './policies';

const repo = (file: string) => new URL(`../../../../${file}`, import.meta.url);
const source = (file: string) => readFileSync(repo(file), 'utf8');
const policyFile = (file: string) => {
  const found = POLICIES.find((p) => p.file === file);
  if (!found) throw new Error(`no ${file}`);
  return found;
};
const privacy = policyMarkdown(policyFile('PRIVACY.md'));
const DAY_S = 86_400;

describe('policies (P6-12)', () => {
  it('the repository files are exactly what the app shows — run `pnpm policies` after editing', () => {
    for (const policy of POLICIES) {
      expect(readFileSync(repo(policy.file), 'utf8'), policy.file).toBe(policyMarkdown(policy));
    }
  });

  it('says plainly that the takedown contact is still to come, until there is one', () => {
    expect(policyMarkdown(policyFile('TERMS.md'))).toContain(CONTACT ?? CONTACT_PENDING);
    expect(privacy).toContain(CONTACT ?? CONTACT_PENDING);
  });

  it('makes the privacy claims the code keeps', () => {
    // "Answers are requested with OpenAI's response storage switched off"
    expect(source('packages/core/src/answer/model.ts')).toContain('store: false');
    // "no tracking or advertising cookies and has no analytics": no analytics package in the web app
    const web = source('apps/web/package.json');
    expect(web).not.toMatch(/analytics|gtag|segment|posthog|mixpanel|plausible|sentry/i);
    // "an answer log … is off unless they turn it on"
    expect(source('packages/core/src/config/env.ts')).toContain(
      'logAnswers: flag(env.DEAR_STEVEN_LOG_ANSWERS)',
    );
  });
});

describe('the privacy notice (#116)', () => {
  it('has every section a notice under the GDPR needs', () => {
    expect(policyFile('PRIVACY.md').sections.map((s) => s.heading)).toEqual([
      'Who is responsible',
      'What is sent, and why',
      'Legal bases',
      'Who receives it',
      'How long it is kept',
      'Your rights',
      'Cookies and storage in your browser',
    ]);
    for (const article of ['Art. 6(1)(b)', 'Art. 6(1)(f)', 'Art. 77', '§ 25(2) no. 2 TDDDG']) {
      expect(privacy).toContain(article);
    }
    expect(privacy).toContain('not yet been reviewed by a lawyer');
  });

  it('names whoever runs this copy, or says plainly that they are still to come', () => {
    expect(privacy).toContain(operatorLine(OPERATOR));
    if (!OPERATOR) expect(privacy).toContain(OPERATOR_PENDING);
  });

  it('writes the operator in one line once they are set', () => {
    const line = operatorLine({
      name: 'Erika Example',
      address: ['Example Street 1', '12345 Example Town', 'Germany'],
      email: 'erika@example.org',
    });
    expect(line).toBe(
      'Erika Example, Example Street 1, 12345 Example Town, Germany. Email: erika@example.org.',
    );
    expect(operatorLine(null)).toBe(OPERATOR_PENDING);
  });

  it('says what goes with each question, as the code sends it', () => {
    expect(privacy).toContain(`up to ${LIMITS.historyTurns} earlier questions`);
    // The answer call sends the last six exchanges; the search step fewer.
    expect(source('packages/core/src/answer/prompt.ts')).toContain(
      'export function historyMessages(history: HistoryTurn[], turns = 6)',
    );
    expect(privacy).toContain('up to six exchanges');
    expect(privacy).toContain(`at most ${LIMITS.aboutChars} characters`);
  });

  it('says how long each cookie and count lasts, as the code keeps it', () => {
    expect(WINDOW_MS).toBe(30 * DAY_S * 1000);
    expect(privacy).toContain('30 days after its first question');
    expect(privacy).toContain(`a cookie (\`${VISITOR_COOKIE}\`) for 30 days`);
    expect(visitorCookie('id')).toContain(`Max-Age=${30 * DAY_S};`);
    expect(source('apps/web/src/server/free-questions.ts')).toContain(
      'const TICKET_MS = 2 * 3_600_000;',
    );
    expect(privacy).toContain('good for two hours');
    expect(ACCESS_MAX_AGE_S).toBe(30 * DAY_S);
    expect(privacy).toContain(`a cookie (\`${ACCESS_COOKIE}\`) for 30 days`);
    expect(source('apps/web/src/i18n/I18nProvider.tsx')).toContain(
      'const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;',
    );
    expect(privacy).toContain(`a cookie (\`${LOCALE_COOKIE}\`) for a year`);
    expect(REMEMBER_DAYS).toBe(30);
    expect(privacy).toContain('on this device for 30 days if you ask');
  });

  it('says what reaches YouTube and the podcast’s ad-measurement services, and when', () => {
    // Nothing loads before play: the player is a button until pressed, the audio has no source.
    const tab = source('apps/web/src/components/evidence/VideoTab.tsx');
    expect(tab).toContain('preload="none"');
    expect(tab).toContain('el.src = src;');
    // Only YouTube's privacy-enhanced player may be framed.
    expect(source('apps/web/src/server/csp.ts')).toContain(
      "'frame-src https://www.youtube-nocookie.com'",
    );
    // "They can tell the request came from this site, but not from which page": origin only.
    expect(source('apps/web/next.config.ts')).toContain(
      "{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }",
    );
    for (const host of ['pdst.fm', 'pscrb.fm', 'mgln.ai', 'claritaspod.com', 'podderapp.com']) {
      expect(privacy).toContain(host);
    }
    expect(privacy).toContain('transfer outside the EU');
  });
});
