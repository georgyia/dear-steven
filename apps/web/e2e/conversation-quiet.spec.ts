import { conversationBar, events, fakeMic, onTheRecorderPath } from './fake-mic';
import { expect, test } from './fixtures';

/** Talking out loud without speech recognition (P9-02), to a fake mic that says nothing. */
test.use(fakeMic('quiet', 10, 0, 0));

test('silence is never sent', async ({ page }) => {
  const uploads = await onTheRecorderPath(page);
  await expect.poll(() => events(page)).toEqual(['mic on']);
  // Long enough for the recording to start afresh once (it does after every 4 s of quiet).
  await page.waitForTimeout(5_000);
  expect(uploads).toEqual([]);
  await expect(conversationBar(page)).toHaveAttribute('data-turn', 'yours');
  await page.keyboard.press('Escape');
  await expect.poll(() => events(page)).toEqual(['mic on', 'mic off']);
});
