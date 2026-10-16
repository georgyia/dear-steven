import { brand } from '../src/brand';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';
import { expect, type Page, test } from './fixtures';

/** Words that only English uses (none of them is also a German word, unlike "was", "will", "an"). */
const STOPWORDS = (
  'the and you your is are to of this that with for it on not what how my be from can have or ' +
  'about when if just there they we our been'
).split(' ');
/** Names, not words: they read the same in every language. */
const NAMES = [brand.name, brand.host.fullName, brand.show, 'YouTube', 'OpenAI', 'Chrome'];

/** Every fixed English string that has a different German one. */
function englishOnly(a: unknown, b: unknown): string[] {
  if (typeof a === 'string') return a !== b ? [a] : [];
  if (typeof a !== 'object' || a === null) return [];
  return Object.entries(a).flatMap(([key, value]) =>
    englishOnly(value, (b as Record<string, unknown>)[key]),
  );
}
const ENGLISH = englishOnly(en, de).filter((s) => s.trim().length > 2);

/**
 * English the visitor would see or hear on a German page: text and accessible names outside
 * original content (marked `lang="en"`: transcripts, quotes, episode titles) and outside code.
 */
function englishOnPage(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ stopwords, english, names }) => {
      const found: string[] = [];
      const original = (el: Element) =>
        (el.closest('[lang]')?.getAttribute('lang') ?? '').startsWith('en');
      const check = (raw: string, where: string) => {
        const text = raw.replace(/\s+/g, ' ').trim();
        if (!text) return;
        if (english.includes(text)) return void found.push(`${where}: ${text}`);
        const words = names.reduce((t, name) => t.split(name).join(' '), text);
        const hits = (words.toLowerCase().match(/[a-z']+/g) ?? []).filter((w) =>
          stopwords.includes(w),
        );
        if (hits.length >= 2) found.push(`${where}: ${text}`);
      };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement;
        if (!el || el.closest('script, style, code') || original(el)) continue;
        check(node.textContent ?? '', el.tagName.toLowerCase());
      }
      for (const el of document.body.querySelectorAll('[aria-label], [title], [placeholder]')) {
        if (original(el)) continue;
        for (const attr of ['aria-label', 'title', 'placeholder']) {
          const value = el.getAttribute(attr);
          if (value) check(value, `@${attr}`);
        }
      }
      return found;
    },
    { stopwords: STOPWORDS, english: ENGLISH, names: NAMES },
  );
}

const noEnglish = async (page: Page, where: string) =>
  expect(await englishOnPage(page), `English text on ${where}`).toEqual([]);

test.describe('in a German browser (P6-02)', () => {
  test.use({ locale: 'de-DE' });

  test('the whole interface is German, and only the original words are English', async ({
    page,
  }, testInfo) => {
    // A full answer and every dialog.
    test.slow();
    // Screenshots for the 375 px review (German runs ~30% longer); not committed.
    const shoot = async (name: string, fullPage = false) => {
      if (testInfo.project.name !== 'mobile') return;
      await page.waitForTimeout(600);
      await page.screenshot({ path: `e2e/screenshots/p6-02-${name}-de-375.png`, fullPage });
    };
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('textbox', { name: de.composer.label })).toBeVisible();
    await noEnglish(page, 'the home page');
    await shoot('home');

    await page.getByRole('button', { name: de.home.examples[0] }).click();
    await expect(page.getByText(de.turn.complete)).toBeAttached({ timeout: 15_000 });
    await expect(page.getByText(de.thinking.done).first()).toBeVisible();
    await expect(page.getByText(de.answer.takeaway, { exact: true })).toBeVisible();
    await noEnglish(page, 'a German answer');
    await shoot('answer', true);

    await page.locator('[data-citation]').first().click();
    const inspector = page.getByRole('dialog', { name: de.inspector.label });
    await expect(inspector).toBeVisible();
    await noEnglish(page, 'the source inspector');
    await shoot('inspector');
    for (const tab of [de.inspector.tabs.context, de.inspector.tabs.video]) {
      await inspector.getByRole('radio', { name: tab }).click();
      await noEnglish(page, `the ${tab} tab`);
    }
    await inspector.getByRole('button', { name: de.inspector.close }).click();

    await page.getByRole('button', { name: de.stage.voiceSettings }).click();
    await expect(page.getByRole('dialog', { name: de.voice.title })).toBeVisible();
    await noEnglish(page, 'voice and language settings');
    await shoot('voice');
    await page.keyboard.press('Escape');

    await page.getByTestId('status-pill').click();
    await expect(page.getByRole('dialog', { name: de.setup.title })).toBeVisible();
    await noEnglish(page, 'setup');
    await shoot('setup');
    await page.keyboard.press('Escape');
  });

  test('the terms page says its text is English only, in German', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('heading', { level: 1, name: de.termsPage.title })).toBeVisible();
    await expect(page.getByText(de.termsPage.englishOnly ?? '')).toBeVisible();
    await noEnglish(page, 'the terms page');
  });

  test('the legal notice is German, apart from the details still to come', async ({ page }) => {
    await page.goto('/legal');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('heading', { level: 1, name: de.legalPage.title })).toBeVisible();
    await expect(page.getByRole('link', { name: de.termsPage.title })).toBeVisible();
    await noEnglish(page, 'the legal notice');
  });

  test('an English question still gets an English answer, in a German interface', async ({
    page,
  }) => {
    await page.goto('/');
    const box = page.getByRole('textbox', { name: de.composer.label });
    await box.fill('Why do I keep procrastinating?');
    await box.press('Enter');
    await expect(page.getByText(de.turn.complete)).toBeAttached({ timeout: 15_000 });
    await expect(page.getByText(de.answer.takeaway, { exact: true })).toBeVisible();
    await expect(page.locator('p[lang="en"]').first()).toContainText('procrastination');
  });
});

test.describe('the English check', () => {
  test.use({ locale: 'de-DE' });

  test('finds English left on a German page, and leaves original words alone', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(
      ({ label }) => {
        const add = (html: string) => document.body.insertAdjacentHTML('beforeend', html);
        add('<p>Ask me anything and I will show you where it came from.</p>');
        add(`<button aria-label="${label}"></button>`);
        add(
          '<blockquote lang="en">You procrastinate on the feeling the work gives you.</blockquote>',
        );
      },
      { label: en.ui.close },
    );
    expect(await englishOnPage(page)).toEqual([
      'p: Ask me anything and I will show you where it came from.',
      `@aria-label: ${en.ui.close}`,
    ]);
  });
});

test('the language can be switched in settings, and the choice survives a reload', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: en.stage.voiceSettings }).click();
  await page.getByRole('combobox', { name: en.voice.language }).selectOption('de');

  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('dialog', { name: de.voice.title })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: de.composer.label })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('textbox', { name: de.composer.label })).toBeVisible();

  await page.getByRole('button', { name: de.stage.voiceSettings }).click();
  await page.getByRole('combobox', { name: de.voice.language }).selectOption('en');
  await expect(page.getByRole('textbox', { name: en.composer.label })).toBeVisible();
});
