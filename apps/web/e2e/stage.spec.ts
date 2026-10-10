import { expect, type Page, test } from '@playwright/test';

const ask = async (page: Page, question: string) => {
  const box = page.getByRole('textbox', { name: 'Ask Steven' });
  await box.fill(question);
  await box.press('Enter');
};

const answered = (page: Page) =>
  expect(page.getByText('Answer complete.')).toBeAttached({ timeout: 15_000 });

test.describe('home, with no API keys', () => {
  test('renders the stage and says plainly that it is a demo', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Dear Steven' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Ask Steven' })).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Example questions' }).getByRole('button'),
    ).toHaveCount(3);
    await expect(page.getByTestId('status-pill')).toHaveAttribute('data-state', 'demo');
    await expect(page.getByText('Demo — not AI-generated or source-verified')).toBeVisible();
    await expect(page.getByText(/AI persona — not Steven Bartlett/).first()).toBeVisible();
  });

  test('setup panel explains what is missing instead of crashing', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('status-pill').click();
    const dialog = page.getByRole('dialog', { name: 'What I have to work with' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('OpenAI API key')).toBeVisible();
    await expect(dialog.getByText(/No database yet/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('the "how this works" panel explains the four kinds of statement', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /How this works|About/ }).click();
    const dialog = page.getByRole('dialog', { name: 'An AI persona with receipts' });
    await expect(dialog.getByText('Something the host actually said.')).toBeVisible();
    await expect(dialog.getByText('My own reasoning.')).toBeVisible();
  });

  test('/ focuses the composer', async ({ page }) => {
    await page.goto('/');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('/');
    await expect(page.getByRole('textbox', { name: 'Ask Steven' })).toBeFocused();
  });

  test('has no horizontal scroll', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('asking (demo fixtures)', () => {
  test('streams a labelled answer block by block, then lists the episodes', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /procrastinating on an important project/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: /procrastinating/ })).toBeVisible();
    await expect(
      page.getByText('Demo fixture · not AI-generated or source-verified'),
    ).toBeVisible();
    await expect(page.getByText(/Searching 3 conversations/).first()).toBeAttached();
    await answered(page);
    await expect(page.locator('[data-attribution]')).not.toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Conversations cited' }).getByRole('listitem'),
    ).toHaveCount(2);
    await expect(page.getByText(/Thought for/).first()).toBeVisible();
  });

  test('says so honestly when nothing in the sources answers the question', async ({ page }) => {
    await page.goto('/');
    await ask(page, 'What is the capital of Peru?');
    await answered(page);
    await expect(page.getByText(/rather tell you that than make something up/)).toBeVisible();
    await expect(page.locator('[data-citation]')).toHaveCount(0);
  });

  test('can be stopped mid-answer', async ({ page }) => {
    await page.goto('/');
    await ask(page, 'How do I build discipline?');
    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByText('You stopped me there.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  });
});

test.describe('evidence inspector', () => {
  test('opens from a chip, cycles with [ and ], closes with Esc', async ({ page, isMobile }) => {
    await page.goto('/');
    await ask(page, 'Why do I keep procrastinating?');
    await answered(page);

    const chip = page.locator('[data-citation]').first();
    if (!isMobile) {
      await chip.hover();
      await expect(page.getByRole('tooltip')).toContainText('speaker not verified');
    }
    await chip.click();

    const inspector = page.getByRole('dialog', { name: 'Source inspector' });
    await expect(inspector).toBeVisible();
    await expect(inspector.getByText('1 of 3')).toBeVisible();
    await expect(inspector.getByText('Speaker not verified')).toBeVisible();

    await page.keyboard.press(']');
    await expect(inspector.getByText('2 of 3')).toBeVisible();
    await expect(inspector.getByText('Verified guest')).toBeVisible();
    await page.keyboard.press('[');
    await expect(inspector.getByText('1 of 3')).toBeVisible();

    await inspector.getByRole('radio', { name: 'Context' }).click();
    await expect(inspector.locator('mark')).toBeVisible();
    await inspector.getByRole('radio', { name: 'Video' }).click();
    await expect(inspector.getByText(/switched off in demo mode/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(inspector).toBeHidden();
  });

  test('desktop: the panel sits beside the conversation instead of covering it', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'desktop layout only');
    await page.goto('/');
    await ask(page, 'Why do I keep procrastinating?');
    await answered(page);
    await page.locator('[data-citation]').first().click();
    const panel = page.getByRole('dialog', { name: 'Source inspector' });
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    const headingBox = await page
      .getByRole('heading', { level: 2, name: /procrastinating/ })
      .boundingBox();
    expect(panelBox && headingBox && headingBox.x + headingBox.width).toBeLessThanOrEqual(
      panelBox?.x ?? 0,
    );
  });

  test('mobile: the inspector is a bottom sheet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile layout only');
    await page.goto('/');
    await ask(page, 'How do I build discipline?');
    await answered(page);
    await page.locator('[data-citation]').first().click();
    const sheet = page.locator('dialog[open][aria-label="Source inspector"]');
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    const viewport = page.viewportSize();
    expect(box?.width).toBe(viewport?.width);
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(viewport?.height);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('renders the wordmark statically and still completes an answer', async ({ page }) => {
    await page.goto('/');
    const h1 = page.getByRole('heading', { level: 1, name: 'Dear Steven' });
    await expect(h1).toBeVisible();
    await expect(h1.locator('span')).toHaveCount(0);
    await ask(page, 'Should I start a business?');
    await answered(page);
    await expect(page.locator('[data-citation]').first()).toBeVisible();
  });
});
