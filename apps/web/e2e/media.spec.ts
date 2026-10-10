import { expect, test } from './fixtures';
import { AUDIO, answerWithMedia } from './media-stub';

test.describe('in-drawer player and podcast audio', () => {
  test('nothing loads from YouTube or the audio host until the user presses play', async ({
    page,
  }) => {
    const thirdParty = await answerWithMedia(page);
    await page.locator('[data-citation]').first().click();
    const inspector = page.getByRole('dialog', { name: 'Source inspector' });
    await inspector.getByRole('radio', { name: 'Video' }).click();

    const playVideo = inspector.getByRole('button', { name: /Play the video here from ≈ \d/ });
    await expect(playVideo).toBeVisible();
    await expect(inspector.getByText(/Approximate \(≈\)/)).toBeVisible();
    const playAudio = inspector.getByRole('button', { name: /Play the podcast audio here/ });
    await expect(playAudio).toBeVisible();
    expect(thirdParty).toEqual([]);

    await playVideo.click();
    const player = inspector.locator('iframe[title^="YouTube video"]');
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute(
      'src',
      /youtube-nocookie\.com\/embed\/.+start=\d+.*autoplay=1/,
    );
    await expect.poll(() => thirdParty.some((u) => u.includes('youtube-nocookie.com'))).toBe(true);
    expect(thirdParty.some((u) => u.includes('audio.example.test'))).toBe(false);

    await playAudio.click();
    await expect.poll(() => thirdParty.some((u) => u.startsWith(AUDIO))).toBe(true);
    // The stub sends no audio, so the player reports it and offers another try.
    await expect(inspector.getByText(/didn’t send the audio/)).toBeVisible();
    await expect(
      inspector.getByRole('button', { name: 'Try the podcast audio again' }),
    ).toBeVisible();
    expect(thirdParty.every((u) => /youtube-nocookie\.com|audio\.example\.test/.test(u))).toBe(
      true,
    );
  });
});
