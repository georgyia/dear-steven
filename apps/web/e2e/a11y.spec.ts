import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from './fixtures';

/**
 * Automated WCAG 2.1 A/AA audit (axe-core — the engine behind Lighthouse's accessibility score)
 * of every interactive state, which a URL-only Lighthouse run can't reach. Runs on desktop and
 * mobile (playwright.config.ts projects).
 */

const audit = async (page: Page, state: string) => {
  // Let reveals and the drawer slide finish so contrast is measured on settled colours.
  await page.waitForTimeout(900);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')}`,
  );
  expect(summary, `${state} has accessibility violations`).toEqual([]);
};

const answered = (page: Page) =>
  expect(page.getByText('Answer complete.').last()).toBeAttached({ timeout: 15_000 });

test('home', async ({ page }) => {
  await page.goto('/');
  await audit(page, 'home');
});

// Colour contrast is measured on rendered pixels, so a block still fading in can fail at random under
// load. The settled colours are identical with reduced motion, which makes these audits deterministic;
// the home audit above keeps full motion so the animated wordmark markup is covered too.
test.describe('interactive states', () => {
  test.use({ reducedMotion: 'reduce' });

  test('an answer, its evidence inspector and the spoken view', async ({ page }) => {
    test.slow(); // four full axe audits after a streamed answer
    await page.goto('/');
    const box = page.getByRole('textbox', { name: 'Ask Steven' });
    await box.fill('Why do I keep procrastinating?');
    await box.press('Enter');
    await answered(page);
    await audit(page, 'answer');

    await page.locator('[data-citation]').first().click();
    const inspector = page.getByRole('dialog', { name: 'Source inspector' });
    await expect(inspector).toBeVisible();
    await inspector
      .getByRole('region', { name: 'Related moments' })
      .getByRole('button')
      .first()
      .click();
    await audit(page, 'inspector — quote, related moment open');
    await inspector.getByRole('radio', { name: 'Context' }).click();
    await audit(page, 'inspector — context');
    await page.keyboard.press('Escape');
    await expect(inspector).toBeHidden();

    await page.getByRole('radio', { name: 'Spoken' }).click();
    await audit(page, 'spoken view');
  });

  test('conversation memory switched on, with Forget', async ({ page }) => {
    await page.goto('/');
    const box = page.getByRole('textbox', { name: 'Ask Steven' });
    await box.fill('Should I start a business?');
    await box.press('Enter');
    await answered(page);
    const region = page.getByRole('region', { name: 'Conversation memory' });
    await region.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await region.getByRole('switch').click();
    await expect(region.getByRole('button', { name: 'Forget' })).toBeVisible();
    await audit(page, 'conversation memory on');
  });

  test('setup, how-this-works, explorer and voice dialogs', async ({ page }) => {
    test.slow(); // four full axe audits
    await page.goto('/');
    await page.getByTestId('status-pill').click();
    await expect(page.getByRole('dialog', { name: 'What I have to work with' })).toBeVisible();
    await audit(page, 'setup dialog');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /How this works|About/ }).click();
    await expect(page.getByRole('dialog', { name: 'An AI persona with receipts' })).toBeVisible();
    await audit(page, 'about dialog');
    await page.keyboard.press('Escape');
    await page.getByTestId('status-pill').click();
    await page.getByRole('button', { name: /Browse the 3 conversations/ }).click();
    await expect(
      page.getByRole('dialog', { name: 'The conversations I know' }).getByRole('listitem'),
    ).toHaveCount(3);
    await audit(page, 'episode explorer');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Voice settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Voice' })).toBeVisible();
    await audit(page, 'voice settings');
  });
});
