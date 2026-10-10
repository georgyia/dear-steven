import { expect, type Page, test } from './fixtures';

const DB = 'dear-steven-memory';

const ask = async (page: Page, question: string) => {
  // The demo notice is a persistent toast over the end of the page; dismiss it like a reader would.
  const notices = page.getByRole('region', { name: 'Notifications' });
  await notices.getByRole('button', { name: 'Close' }).first().click();
  await expect(notices.getByText(/Demo — not AI-generated/)).toHaveCount(0);
  const box = page.getByRole('textbox', { name: 'Ask Steven' });
  await box.fill(question);
  await box.press('Enter');
  await expect(page.getByText('Answer complete.').last()).toBeAttached({ timeout: 15_000 });
};
const databases = (page: Page) =>
  page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
const memorySwitch = (page: Page) =>
  page.getByRole('switch', { name: 'Remember this conversation on this device' });
/** Scrolls the memory control to the middle of the screen, clear of the docked composer. */
const reveal = (page: Page) =>
  page
    .getByRole('region', { name: 'Conversation memory' })
    .evaluate((el) => el.scrollIntoView({ block: 'center' }));

test('off by default: nothing is written, and a reload starts fresh', async ({ page }) => {
  await page.goto('/');
  await ask(page, 'How do I build discipline?');
  await expect(memorySwitch(page)).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Off: nothing is kept once you close this tab.')).toBeVisible();
  expect(await databases(page)).not.toContain(DB);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Dear Steven' })).toBeVisible();
  await page.waitForTimeout(300);
  expect(await databases(page)).not.toContain(DB); // looking for a memory never creates one
});

test('opted in: the conversation comes back after a reload, sources and all', async ({ page }) => {
  test.slow(); // two loads and a full answer
  await page.goto('/');
  await ask(page, 'Why do I keep procrastinating?');
  await reveal(page);
  await memorySwitch(page).click();
  await expect(memorySwitch(page)).toHaveAttribute('aria-checked', 'true');
  await expect(
    page.getByText(/Kept in this browser’s own storage, on this device only/),
  ).toBeVisible();
  await expect.poll(() => databases(page)).toContain(DB);

  await page.reload();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Why do I keep procrastinating?' }),
  ).toBeVisible();
  await expect(page.getByText('Picked up where you left off')).toBeVisible();
  await expect(memorySwitch(page)).toHaveAttribute('aria-checked', 'true');
  await page.locator('[data-citation]').first().click();
  await expect(page.getByRole('dialog', { name: 'Source inspector' })).toBeVisible();
});

test('Forget deletes at once, Undo brings it back, and after the fuse it stays forgotten', async ({
  page,
}) => {
  test.slow(); // waits out the five-second undo window
  await page.goto('/');
  await ask(page, 'Should I start a business?');
  await reveal(page);
  await memorySwitch(page).click();
  await expect.poll(() => databases(page)).toContain(DB);

  await reveal(page);
  await page.getByRole('button', { name: 'Forget' }).click();
  await expect.poll(() => databases(page)).not.toContain(DB);
  await expect(memorySwitch(page)).toHaveAttribute('aria-checked', 'false');
  await reveal(page);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(memorySwitch(page)).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => databases(page)).toContain(DB);

  await reveal(page);
  await page.getByRole('button', { name: 'Forget' }).click();
  await expect(page.getByText(/Forgotten — nothing from this conversation/)).toBeVisible();
  // The fuse pauses while a mouse rests on it; move away so it can run out.
  await page.mouse.move(1, 1);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeHidden({ timeout: 8_000 });
  await expect(memorySwitch(page)).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Dear Steven' })).toBeVisible();
  expect(await databases(page)).not.toContain(DB);
});
