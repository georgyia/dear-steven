import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { en } from '../src/i18n/en';
import type { Page } from './fixtures';

/**
 * The recorder path of a spoken conversation (P9-02): Firefox, or a browser without speech
 * recognition. Chromium's fake microphone plays a WAV written here, on a loop: quiet, then a tone as
 * loud as a voice, then quiet. A launch option, so each fake mic has a spec file of its own.
 */

/** A 16 kHz mono WAV: `before` seconds quiet, `tone` seconds of a modulated tone, `after` quiet. */
function wav(before: number, tone: number, after: number): Buffer {
  const rate = 16_000;
  const samples = Math.round((before + tone + after) * rate);
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const t = i / rate;
    const on = t >= before && t < before + tone;
    const envelope = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t);
    const value = on ? Math.sin(2 * Math.PI * 220 * t) * envelope * 0.4 : 0;
    data.writeInt16LE(Math.round(value * 32_767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Launch options for a fake mic playing that WAV over and over (from whenever the browser opened it). */
export function fakeMic(name: string, before: number, tone: number, after: number) {
  const file = join(tmpdir(), `dear-steven-e2e-${name}.wav`);
  writeFileSync(file, wav(before, tone, after));
  return {
    permissions: ['microphone'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${file}`,
      ],
    },
  };
}

export const events = (page: Page) =>
  page.evaluate(() => (window as unknown as { __log: string[] }).__log);

export const conversationBar = (page: Page) =>
  page.getByRole('region', { name: en.conversation.label });

/**
 * No speech recognition; the mic's tracks and every line said are logged; the status says live,
 * so server transcription is offered, and it is answered here. Starts a spoken conversation in
 * Talk and returns the size of every upload.
 */
export async function onTheRecorderPath(page: Page): Promise<number[]> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown> & { __log: string[] };
    w.__log = [];
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
    window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      w.__log.push(`say ${u.text}`);
      setTimeout(() => u.onend?.(new Event('end') as SpeechSynthesisEvent), 300);
    };
    const open = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await open(constraints);
      w.__log.push('mic on');
      let live = stream.getTracks().length;
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => {
          if (track.readyState === 'live' && --live === 0) w.__log.push('mic off');
          stop();
        };
      }
      return stream;
    };
  });
  await page.route('**/api/status', async (route) => {
    const res = await route.fetch();
    await route.fulfill({
      response: res,
      json: { ...(await res.json()), mode: 'live', demoReason: null },
    });
  });
  const uploads: number[] = [];
  await page.route('**/api/transcribe', async (route) => {
    uploads.push(route.request().postDataBuffer()?.length ?? 0);
    await route.fulfill({ json: { text: 'Should I start a business?' } });
  });
  await page.route('**/api/speech', (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/');
  await page.waitForResponse('**/api/status');
  await page.getByRole('button', { name: en.terms.dismiss }).click();
  await page
    .getByRole('radiogroup', { name: en.modes.label })
    .getByRole('radio', { name: en.modes.talk })
    .click();
  await page.getByRole('button', { name: en.conversation.start }).click();
  return uploads;
}
