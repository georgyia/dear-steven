import type { Page } from '@playwright/test';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';
import { expect, test } from './fixtures';

/**
 * In a tab or a link preview (P10-10), the site has its own icon and says what it is: an
 * unofficial AI persona, in the visitor's language, with no preview image (so no likeness).
 */
const content = (page: Page, key: string) =>
  page.locator(`meta[property="${key}"], meta[name="${key}"]`).first().getAttribute('content');

test.describe('the page head (P10-10)', () => {
  test('carries the icon, and previews as an unofficial AI persona', async ({ page, request }) => {
    await page.goto('/');
    expect(await content(page, 'og:title')).toBe(en.meta.previewTitle);
    expect(await content(page, 'og:description')).toBe(en.meta.description);
    expect(await content(page, 'og:site_name')).toBe('Dear Steven');
    expect(await content(page, 'twitter:card')).toBe('summary');
    expect(`${en.meta.previewTitle} ${en.meta.description}`).toMatch(/unofficial.*\bAI\b/);
    await expect(page.locator('meta[property="og:image"], meta[name="twitter:image"]')).toHaveCount(
      0,
    );
    expect(await content(page, 'robots')).toBe('noindex, nofollow');

    const icon = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute('href');
    const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect(icon).toBeTruthy();
    expect(apple).toBeTruthy();
    const svg = await request.get(icon as string);
    expect(svg.status()).toBe(200);
    expect(svg.headers()['content-type']).toContain('image/svg+xml');
    const png = await request.get(apple as string);
    expect(png.status()).toBe(200);
    expect(png.headers()['content-type']).toBe('image/png');
    expect((await png.body()).subarray(1, 4).toString()).toBe('PNG');
  });

  test.describe('in a German browser', () => {
    test.use({ locale: 'de-DE' });

    test('previews in German', async ({ page }) => {
      await page.goto('/');
      expect(await content(page, 'og:title')).toBe(de.meta.previewTitle);
      expect(await content(page, 'og:description')).toBe(de.meta.description);
      expect(await content(page, 'og:locale')).toBe('de_DE');
      expect(`${de.meta.previewTitle} ${de.meta.description}`).toMatch(/inoffizielle.*\bKI\b/);
    });
  });
});
