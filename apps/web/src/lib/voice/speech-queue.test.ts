import { LIMITS } from '@dear-steven/core/limits';
import { describe, expect, it } from 'vitest';
import {
  createSpeechQueue,
  type SpeechOutput,
  type SpeechPart,
  START_SAMPLES,
} from './speech-queue';

/** One part's audio as the test releases it: chunks, then the end or a failure. */
class Channel {
  private queue: (Float32Array<ArrayBuffer> | 'end' | Error)[] = [];
  private wake: (() => void) | null = null;
  push(item: Float32Array<ArrayBuffer> | 'end' | Error) {
    this.queue.push(item);
    this.wake?.();
  }
  async *read(signal: AbortSignal): AsyncIterable<Float32Array<ArrayBuffer>> {
    for (;;) {
      if (signal.aborted) return;
      const item = this.queue.shift();
      if (item === undefined) {
        await new Promise<void>((resolve) => {
          this.wake = resolve;
          signal.addEventListener('abort', () => resolve(), { once: true });
        });
        continue;
      }
      if (item === 'end') return;
      if (item instanceof Error) throw item;
      yield item;
    }
  }
}

const tone = (n: number, value: number) => new Float32Array(n).fill(value);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeOutput(opts: { server?: boolean } = {}) {
  const log: string[] = [];
  const channels = new Map<string, Channel>();
  const fetched: SpeechPart[] = [];
  const channel = (text: string) => {
    let c = channels.get(text);
    if (!c) {
      c = new Channel();
      channels.set(text, c);
    }
    return c;
  };
  const out: SpeechOutput = {
    ...(opts.server === false
      ? {}
      : {
          fetch: (part: SpeechPart, signal: AbortSignal) => {
            fetched.push(part);
            return channel(part.text).read(signal);
          },
        }),
    schedule: (samples) => log.push(`play ${samples[0]}x${samples.length}`),
    ahead: () => 0,
    drained: async () => undefined,
    silence: () => log.push('silence'),
    speakLocally: async (part) => {
      log.push(`local ${part.text}`);
    },
  };
  return { out, log, channel, fetched };
}

describe('a reply read aloud as it arrives (P9-01)', () => {
  it('plays parts in the order they were added, even when a later one arrives first', async () => {
    const { out, log, channel, fetched } = fakeOutput();
    const q = createSpeechQueue(out);
    q.add('First.', 'en');
    q.add('Second.', 'en');
    // Both are fetched at once: the second downloads while the first plays.
    expect(fetched.map((p) => p.text)).toEqual(['First.', 'Second.']);
    channel('Second.').push(tone(START_SAMPLES, 2));
    channel('Second.').push('end');
    await settle();
    expect(log).toEqual([]);
    channel('First.').push(tone(START_SAMPLES, 1));
    channel('First.').push('end');
    q.close();
    await q.done;
    expect(log).toEqual([`play 1x${START_SAMPLES}`, `play 2x${START_SAMPLES}`]);
  });

  it('starts a part only with a moment of sound in hand, or once it is complete', async () => {
    const { out, log, channel } = fakeOutput();
    let started = 0;
    const q = createSpeechQueue(out, { onStart: () => started++ });
    q.add('Hello.', 'en');
    channel('Hello.').push(tone(100, 1));
    await settle();
    expect(log).toEqual([]);
    expect(q.started).toBe(false);
    channel('Hello.').push(tone(START_SAMPLES, 1));
    await settle();
    expect(log).toEqual([`play 1x${START_SAMPLES + 100}`]);
    expect(started).toBe(1);
    expect(q.playing).toBe(true);
    channel('Hello.').push(tone(50, 3));
    channel('Hello.').push('end');
    q.close();
    await q.done;
    expect(log).toEqual([`play 1x${START_SAMPLES + 100}`, 'play 3x50']);
    expect(started).toBe(1);
    expect(q.playing).toBe(false);
  });

  it('a short part plays once it is complete', async () => {
    const { out, log, channel } = fakeOutput();
    const q = createSpeechQueue(out);
    q.add('Hi.', 'en');
    q.close();
    channel('Hi.').push(tone(10, 1));
    channel('Hi.').push('end');
    await q.done;
    expect(log).toEqual(['play 1x10']);
  });

  it('stop silences it at once, and nothing queued plays afterwards', async () => {
    const { out, log, channel } = fakeOutput();
    let ended = 0;
    const q = createSpeechQueue(out, { onEnd: () => ended++ });
    q.add('First.', 'en');
    q.add('Second.', 'en');
    channel('First.').push(tone(START_SAMPLES, 1));
    await settle();
    q.stop();
    channel('First.').push(tone(START_SAMPLES, 1));
    channel('First.').push('end');
    channel('Second.').push(tone(START_SAMPLES, 2));
    channel('Second.').push('end');
    q.add('Third.', 'en');
    q.close();
    await q.done;
    await settle();
    expect(log).toEqual([`play 1x${START_SAMPLES}`, 'silence']);
    expect(ended).toBe(1);
    q.stop();
    expect(log).toEqual([`play 1x${START_SAMPLES}`, 'silence']);
  });

  it('a part the server refuses is read by the browser’s voice, in its place', async () => {
    const { out, log, channel } = fakeOutput();
    const q = createSpeechQueue(out);
    q.add('Refused.', 'en');
    q.add('After.', 'en');
    channel('After.').push(tone(START_SAMPLES, 2));
    channel('After.').push('end');
    channel('Refused.').push(new Error('speech 402'));
    q.close();
    await q.done;
    expect(log).toEqual(['local Refused.', `play 2x${START_SAMPLES}`]);
  });

  it('with no server voice, every part is read by the browser’s voice, in order', async () => {
    const { out, log } = fakeOutput({ server: false });
    let started = 0;
    const q = createSpeechQueue(out, { onStart: () => started++ });
    q.add('One.', 'de');
    q.add('Two.', 'de');
    q.close();
    await q.done;
    expect(log).toEqual(['local One.', 'local Two.']);
    expect(started).toBe(1);
  });

  it('ends, and never fails, when the audio can’t be played', async () => {
    const { out, channel } = fakeOutput();
    let ended = 0;
    const q = createSpeechQueue(
      {
        ...out,
        schedule: () => {
          throw new Error('the audio context is closed');
        },
      },
      { onEnd: () => ended++ },
    );
    q.add('Hello.', 'en');
    channel('Hello.').push(tone(START_SAMPLES, 1));
    q.close();
    await expect(q.done).resolves.toBeUndefined();
    expect(ended).toBe(1);
    expect(q.playing).toBe(false);
  });

  it('ends at once when closed with nothing in it', async () => {
    const { out, log } = fakeOutput();
    let ended = 0;
    const q = createSpeechQueue(out, { onEnd: () => ended++ });
    q.close();
    await q.done;
    expect(log).toEqual([]);
    expect(ended).toBe(1);
    expect(q.started).toBe(false);
  });

  it('splits a part too long for one request', () => {
    const { out, fetched } = fakeOutput();
    const sentence = 'This is one sentence of a long reply. ';
    const text = sentence.repeat(Math.ceil((LIMITS.speechChars * 1.5) / sentence.length));
    createSpeechQueue(out).add(text, 'en');
    expect(fetched.length).toBe(2);
    expect(fetched.every((p) => p.text.length <= LIMITS.speechChars)).toBe(true);
    expect(fetched.map((p) => p.text).join(' ')).toBe(text.trim());
  });
});
