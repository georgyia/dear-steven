import { test as base, expect, type Page } from '@playwright/test';

/**
 * Every spec imports `test` from here: it records Content-Security-Policy violations on the page
 * and fails the test if there were any (P6-09). A test that injects something on purpose marks
 * itself with `expectCspViolations()`.
 */
const CSP_MESSAGE = /Content Security Policy|securitypolicyviolation/i;

export const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: [
    async ({ page }, use, testInfo) => {
      const seen: string[] = [];
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          console.error(
            `securitypolicyviolation: ${e.effectiveDirective} ${e.blockedURI} at ${e.sourceFile}:${e.lineNumber}:${e.columnNumber}`,
          );
        });
      });
      page.on('console', (message) => {
        if (message.type() === 'error' && CSP_MESSAGE.test(message.text()))
          seen.push(message.text());
      });
      await use(seen);
      if (!testInfo.annotations.some((a) => a.type === 'csp-violations-expected')) {
        expect(seen, 'Content-Security-Policy violations').toEqual([]);
      }
    },
    { auto: true },
  ],
});

export const expectCspViolations = () =>
  test.info().annotations.push({ type: 'csp-violations-expected' });

export { expect, type Page };
