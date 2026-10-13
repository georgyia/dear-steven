import { expect, type Page, test } from './fixtures';

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
    // One message at a time (P7-04): the first-visit notice, then the demo notice.
    const notice = page.getByRole('region', { name: 'Before you start' });
    await expect(notice).toBeVisible();
    await expect(page.getByText('Demo — not AI-generated or source-verified')).toHaveCount(0);
    await notice.getByRole('button', { name: 'Got it' }).click();
    await expect(page.getByText('Demo — not AI-generated or source-verified')).toBeVisible();
    await expect(page.getByText(/AI persona — not Steven Bartlett/).first()).toBeVisible();
  });

  test('on a phone, nothing covers the first-visit notice', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 760 });
    await page.goto('/');
    const notice = page.getByRole('region', { name: 'Before you start' });
    await expect(notice).toBeVisible();
    await page.waitForTimeout(800); // let any toast that would appear, appear
    const box = await notice.boundingBox();
    const toasts = await page
      .getByRole('region', { name: 'Notifications' })
      .getByRole('status')
      .all();
    for (const toast of toasts) {
      const t = await toast.boundingBox();
      if (!box || !t) continue;
      const overlap =
        box.x < t.x + t.width &&
        t.x < box.x + box.width &&
        box.y < t.y + t.height &&
        t.y < box.y + box.height;
      expect(overlap).toBe(false);
    }
    // Its link and button respond to a plain click, with nothing in the way.
    await notice.getByRole('button', { name: 'Got it' }).click({ trial: true, timeout: 2000 });
    await notice
      .getByRole('link', { name: 'Terms & disclaimer' })
      .click({ trial: true, timeout: 2000 });
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
    await expect(page.getByText('Demo fixture: not AI-generated or source-verified')).toBeVisible();
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
      // The answer can still settle (the thought line folding away) just after it completes, moving
      // the chip from under the pointer; like a person, move onto it again until the preview opens.
      await expect(async () => {
        await chip.hover();
        await expect(page.getByRole('tooltip')).toContainText('speaker not verified', {
          timeout: 1500,
        });
      }).toPass();
    }
    await chip.click();

    const inspector = page.getByRole('dialog', { name: 'Source inspector' });
    await expect(inspector).toBeVisible();
    await expect(inspector.getByText('1 of 3')).toBeVisible();
    await expect(inspector.getByText('Speaker not verified', { exact: true })).toBeVisible();

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

  test('related moments: other conversations, labelled as not cited, opened in place', async ({
    page,
  }) => {
    await page.goto('/');
    await ask(page, 'Why do I keep procrastinating?');
    await answered(page);
    await page.locator('[data-citation]').first().click();
    const inspector = page.getByRole('dialog', { name: 'Source inspector' });
    const related = inspector.getByRole('region', { name: 'Related moments' });
    await expect(related).toBeVisible();
    await expect(related.getByText(/Related, not cited/)).toBeVisible();
    await expect(related.getByRole('listitem')).toHaveCount(2);
    // The cited passage is from "The Science Of Starting": related moments never are.
    await expect(related.getByText(/Science Of Starting/)).toHaveCount(0);
    const first = related.getByRole('button').first();
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    await expect(related.getByText(/in the podcast/)).toBeVisible();
  });

  test('related moments stay hidden when there are none', async ({ page }) => {
    await page.goto('/');
    await ask(page, 'Should I start a business?');
    await answered(page);
    const loaded = page.waitForResponse((r) => r.url().includes('/related'));
    await page.locator('[data-citation]').first().click();
    await loaded;
    const inspector = page.getByRole('dialog', { name: 'Source inspector' });
    await expect(inspector.getByText('Copy quote with attribution')).toBeVisible();
    await expect(inspector.getByRole('region', { name: 'Related moments' })).toHaveCount(0);
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

/** Loads the home page and waits for hydration (the mic only appears once client effects ran). */
async function loadHydrated(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /Talk to Steven|Voice isn’t available/ }),
  ).toBeVisible();
  return errors;
}

test('hydrates without errors', async ({ page }) => {
  const errors = await loadHydrated(page);
  expect(errors).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('renders the wordmark statically and still completes an answer', async ({ page }) => {
    const errors = await loadHydrated(page);
    const h1 = page.getByRole('heading', { level: 1, name: 'Dear Steven' });
    await expect(h1).toBeVisible();
    // Every word is fully drawn at once: no fade, no blur, no drop. Same markup as the server's.
    const looks = await h1.locator('span').evaluateAll((spans) =>
      spans.map((el) => {
        const c = getComputedStyle(el);
        return `${c.opacity} ${c.filter} ${c.transform}`;
      }),
    );
    expect(looks.length).toBeGreaterThan(0);
    expect(new Set(looks)).toEqual(new Set(['1 none none']));
    expect(errors).toEqual([]); // no hydration mismatch (P5-12)
    // The rest of the home screen settles sharp and in place: no blur, no offset (P7-10).
    const unsettled = () =>
      page.locator('main *').evaluateAll((els) =>
        els.flatMap((el) => {
          const c = getComputedStyle(el);
          const blurred = c.filter !== 'none' && c.filter !== 'blur(0px)';
          const moved = c.transform !== 'none' && c.transform !== 'matrix(1, 0, 0, 1, 0, 0)';
          return blurred || moved ? [`${el.tagName} ${c.filter} ${c.transform}`] : [];
        }),
      );
    await expect.poll(unsettled, { timeout: 4000 }).toEqual([]);
    await ask(page, 'Should I start a business?');
    await answered(page);
    await expect(page.locator('[data-citation]').first()).toBeVisible();
  });
});

test.describe('episode explorer', () => {
  test('lists what is indexed and searches by guest', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('status-pill').click();
    await page.getByRole('button', { name: /Browse the 3 conversations/ }).click();
    const explorer = page.getByRole('dialog', { name: 'The conversations I know' });
    await expect(explorer).toBeVisible();
    await expect(explorer.getByText('3 conversations indexed')).toBeVisible();
    await expect(explorer.getByRole('listitem')).toHaveCount(3);
    await explorer.getByRole('searchbox', { name: 'Search by guest or title' }).fill('coach');
    await expect(explorer.getByText('1 match')).toBeVisible();
    await expect(explorer.getByRole('listitem')).toHaveCount(1);
    await explorer.getByRole('button', { name: 'Clear search' }).click();
    await expect(explorer.getByRole('listitem')).toHaveCount(3);
    await expect(explorer.getByRole('button', { name: 'Clear search' })).toHaveCount(0);
    await expect(explorer.getByRole('searchbox')).toBeFocused();
    await explorer.getByRole('searchbox', { name: 'Search by guest or title' }).fill('zzz');
    await expect(explorer.getByText('No conversation matches “zzz”.')).toBeVisible();
    // Native search-field behaviour: the first Esc clears the search, the second closes the dialog.
    await page.keyboard.press('Escape');
    await expect(explorer.getByRole('searchbox')).toHaveValue('');
    await expect(explorer.getByRole('listitem')).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(explorer).toBeHidden();
  });
});
