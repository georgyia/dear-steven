import { en } from '../src/i18n/en';
import { conversationBar, events, fakeMic, onTheRecorderPath } from './fake-mic';
import { expect, test } from './fixtures';

/**
 * Talking out loud without speech recognition (P9-02): a fake mic that, every 5 s, is quiet for
 * 0.8 s, speaks for 1.2 s, then is quiet again. Its level ends the turn.
 */
test.use(fakeMic('speaking', 0.8, 1.2, 3));

test('the level ends the turn, and the mic is off before the upload and while he speaks', async ({
  page,
}) => {
  test.slow();
  const uploads = await onTheRecorderPath(page);
  await expect(page.getByRole('article', { name: 'Should I start a business?' })).toBeVisible({
    timeout: 20_000,
  });
  await expect.poll(async () => (await events(page)).some((e) => e.startsWith('say '))).toBe(true);
  expect(uploads).toHaveLength(1);
  expect(uploads[0]).toBeGreaterThan(0);
  const log = await events(page);
  expect(log.slice(0, 2)).toEqual(['mic on', 'mic off']);
  const said = log.findIndex((e) => e.startsWith('say '));
  const before = log.slice(0, said);
  expect(before.filter((e) => e === 'mic on').length).toBe(
    before.filter((e) => e === 'mic off').length,
  );
  // Then it is listening again, and End turns the mic off.
  await expect.poll(async () => (await events(page)).filter((e) => e === 'mic on').length).toBe(2);
  await conversationBar(page)
    .getByRole('button', { name: en.conversation.end, exact: true })
    .click();
  await expect.poll(async () => (await events(page)).at(-1)).toBe('mic off');
});
