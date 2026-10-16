import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRecognizer,
  MAX_RESTARTS,
  onDeviceProbeAllowed,
  QUIET_RESTARTS,
  type RecognizerOptions,
  recognitionLang,
} from './recognition';

describe('onDeviceProbeAllowed', () => {
  it('probes on-device recognition only in Google Chrome', () => {
    const brands = (...names: string[]) => ({
      userAgentData: { brands: names.map((brand) => ({ brand, version: '156' })) },
    });
    expect(onDeviceProbeAllowed(brands('Not A;Brand', 'Chromium', 'Google Chrome'))).toBe(true);
    // Plain Chromium crashes the tab on `available({ processLocally: true })`.
    expect(onDeviceProbeAllowed(brands('Not A;Brand', 'Chromium'))).toBe(false);
    expect(onDeviceProbeAllowed(brands('Microsoft Edge', 'Chromium'))).toBe(false);
    expect(onDeviceProbeAllowed({})).toBe(false); // Safari, Firefox: no userAgentData
    expect(onDeviceProbeAllowed(undefined)).toBe(false);
  });
});

describe('recognitionLang (P6-02)', () => {
  it('listens in the interface language, in the browser’s regional form when it matches', () => {
    expect(recognitionLang('de', 'de-AT')).toBe('de-AT');
    expect(recognitionLang('en', 'en-US')).toBe('en-US');
    expect(recognitionLang('de', 'en-US')).toBe('de-DE');
    expect(recognitionLang('en', 'fr-FR')).toBe('en-GB');
    expect(recognitionLang('en', '')).toBe('en-GB');
  });
});

/** The browser's recognizer, driven by the test: what it hears, and when it ends by itself. */
class ScriptedRecognition {
  static current: ScriptedRecognition;
  lang = '';
  interimResults = false;
  continuous = false;
  maxAlternatives = 1;
  onaudiostart: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  starts = 0;
  /** From this start on, `start()` throws, as a browser that won't start again does. */
  refuseFrom = Number.POSITIVE_INFINITY;
  constructor() {
    ScriptedRecognition.current = this;
  }
  start() {
    if (this.starts + 1 >= this.refuseFrom) throw new Error('InvalidStateError');
    this.starts += 1;
  }
  stop() {}
  abort() {}
  hear(text: string, isFinal = true) {
    this.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript: text }], { isFinal })],
    });
  }
  end() {
    this.onend?.();
  }
  fail(error: string) {
    this.onerror?.({ error });
  }
}

function listen(options: RecognizerOptions = { keepListening: true }) {
  const seen = {
    opened: 0,
    partials: [] as string[],
    finals: [] as string[],
    errors: [] as string[],
    ended: 0,
  };
  const rec = createRecognizer(
    {
      onAudioStart: () => {
        seen.opened += 1;
      },
      onPartial: (text) => seen.partials.push(text),
      onFinal: (text) => seen.finals.push(text),
      onError: (error) => seen.errors.push(error),
      onEnded: () => {
        seen.ended += 1;
      },
    },
    options,
  );
  if (!rec) throw new Error('no recognizer');
  rec.start();
  return { rec, seen, browser: ScriptedRecognition.current };
}

describe('listening that carries on when the browser stops by itself (P10-14)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { SpeechRecognition: ScriptedRecognition });
    vi.stubGlobal('navigator', { userAgent: 'Safari', language: 'en-GB' });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts again after a sentence, and hands over everything said as one transcript', () => {
    const { rec, seen, browser } = listen();
    browser.onaudiostart?.();
    browser.hear('I started a company');
    browser.end();
    expect(browser.starts).toBe(2);
    expect(seen.finals).toEqual([]);
    expect(seen.ended).toBe(0);

    browser.onaudiostart?.();
    expect(seen.opened).toBe(1);
    browser.hear('and it failed', false);
    expect(seen.partials.at(-1)).toBe('I started a company and it failed');

    rec.stop();
    browser.end();
    expect(seen.finals).toEqual(['I started a company and it failed']);
    expect(seen.ended).toBe(1);
    expect(browser.starts).toBe(2);
  });

  it('without keepListening, the browser’s own end is the end, as before', () => {
    const { seen, browser } = listen({});
    browser.hear('I started a company');
    browser.end();
    expect(browser.starts).toBe(1);
    expect(seen.finals).toEqual(['I started a company']);
  });

  it('stop and abort end it at once, with no restart', () => {
    const stopped = listen();
    stopped.browser.hear('one thing');
    stopped.rec.stop();
    stopped.browser.end();
    expect(stopped.browser.starts).toBe(1);
    expect(stopped.seen.finals).toEqual(['one thing']);

    const aborted = listen();
    aborted.browser.hear('one thing');
    aborted.rec.abort();
    aborted.browser.end();
    expect(aborted.browser.starts).toBe(1);
    expect(aborted.seen.finals).toEqual([]);
    expect(aborted.seen.ended).toBe(1);
  });

  it('quiet after words gives the words, not an error; quiet before any word is still an error', () => {
    const after = listen();
    after.browser.hear('hello there');
    after.browser.fail('no-speech');
    after.browser.end();
    expect(after.seen.errors).toEqual([]);
    expect(after.seen.finals).toEqual(['hello there']);
    expect(after.browser.starts).toBe(1);

    const before = listen();
    before.browser.fail('no-speech');
    before.browser.end();
    expect(before.seen.errors).toEqual(['no-speech']);
    expect(before.seen.finals).toEqual([]);
  });

  it('nothing heard: the browser’s end is the end, with nothing to hand over', () => {
    const { seen, browser } = listen();
    browser.end();
    expect(browser.starts).toBe(1);
    expect(seen.finals).toEqual(['']);
  });

  it(`gives up after ${QUIET_RESTARTS} restarts in a row with nothing new; a word resets that`, () => {
    const quiet = listen();
    quiet.browser.hear('so');
    for (let i = 0; i < QUIET_RESTARTS + 1; i += 1) quiet.browser.end();
    expect(quiet.browser.starts).toBe(1 + QUIET_RESTARTS);
    expect(quiet.seen.finals).toEqual(['so']);

    const talking = listen();
    talking.browser.hear('so');
    talking.browser.end();
    talking.browser.hear('anyway');
    for (let i = 0; i < QUIET_RESTARTS + 1; i += 1) talking.browser.end();
    expect(talking.browser.starts).toBe(2 + QUIET_RESTARTS);
    expect(talking.seen.finals).toEqual(['so anyway']);
  });

  it(`never restarts more than ${MAX_RESTARTS} times, however much is said`, () => {
    const { seen, browser } = listen();
    for (let i = 0; i < MAX_RESTARTS + 1; i += 1) {
      browser.hear('word');
      browser.end();
    }
    expect(browser.starts).toBe(1 + MAX_RESTARTS);
    expect(seen.finals).toHaveLength(1);
  });

  it('a browser that won’t start again ends with what was said', () => {
    const { seen, browser } = listen();
    browser.refuseFrom = 2;
    browser.hear('just this');
    browser.end();
    expect(seen.finals).toEqual(['just this']);
    expect(seen.ended).toBe(1);
  });
});
