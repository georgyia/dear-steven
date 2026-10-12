import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { E2E_ACCESS_CODE } from './gated';

/**
 * Runs against the gated server only (playwright.config.ts, project "gated"): an access code is
 * set, so every API route refuses a browser until it enters it (P6-08). Each test claims its own
 * client address, so the passcode rate limit of one never touches another.
 */
test.beforeEach(async ({ page }, info) => {
  const id = [...info.title].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 65_000, 7);
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `198.51.${id >> 8}.${id & 255}` });
});

test('the API refuses a browser that has not entered the passcode', async ({ request }) => {
  for (const path of ['/api/status', '/api/episodes']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(401);
    expect((await res.json()).error.code).toBe('locked');
  }
  const ask = await request.post('/api/ask', { data: { question: 'Hi', history: [] } });
  expect(ask.status()).toBe(401);
});

test('the passcode screen: a wrong code is refused, the right one opens the stage', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByText(/This copy of Dear Steven is private/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Ask Steven' })).toHaveCount(0);
  await expect(page.getByText(/AI persona — not Steven Bartlett/)).toBeVisible();

  const field = page.getByLabel(/Enter the passcode/);
  await field.fill('open sesame');
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page.getByRole('status')).toHaveText('That passcode isn’t right.');
  await expect(field).toHaveAttribute('aria-invalid', 'true');

  await field.fill(E2E_ACCESS_CODE);
  await field.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Ask Steven' })).toBeVisible();
  const [cookie] = await context.cookies();
  expect(cookie).toMatchObject({
    name: 'ds_access',
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
  });
  expect(cookie?.value).not.toContain(E2E_ACCESS_CODE);
  expect((await page.request.get('/api/status')).status()).toBe(200);

  // And it answers, end to end, through the gate.
  const box = page.getByRole('textbox', { name: 'Ask Steven' });
  await box.fill('How do I build discipline?');
  await box.press('Enter');
  await expect(page.getByText('Answer complete.')).toBeAttached({ timeout: 15_000 });
});

test('guessing is slowed down after five tries', async ({ page }) => {
  await page.goto('/');
  const field = page.getByLabel(/Enter the passcode/);
  for (let i = 0; i < 5; i++) {
    await field.fill(`guess ${i}`);
    await field.press('Enter');
    await expect(page.getByRole('status')).toHaveText('That passcode isn’t right.');
    await page.getByRole('status').evaluate((el) => {
      el.textContent = '';
    });
  }
  await field.fill(E2E_ACCESS_CODE);
  await field.press('Enter');
  await expect(page.getByRole('status')).toHaveText(/Too many tries/);
});

test('the passcode screen passes an accessibility audit', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/This copy of Dear Steven is private/)).toBeVisible();
  await page.waitForTimeout(900);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
