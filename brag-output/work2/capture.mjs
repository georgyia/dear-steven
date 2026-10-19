// Frame-exact capture of Dear Steven in demo mode (http://localhost:3100), on virtual time.
//   node capture.mjs <scene> [--fps 60]       scenes: probe | ask | about | talk | interview | practice | sources
// `sources` needs the live knowledge base (no DEAR_STEVEN_DEMO; run the server with
// DEAR_STEVEN_DAILY_BUDGET_USD=0 so nothing can be spent); every other scene runs in demo mode.
// Writes work2/frames/<scene>/f00000.jpg… (2560x1600: a 1280x800 viewport at 2x) and
// work2/frames/<scene>.json with the frame count and named marks (frame numbers).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire('/Users/georgychomakhashvili/dear-steven/apps/web/package.json');
const { chromium } = require('@playwright/test');

const HERE = '/Users/georgychomakhashvili/dear-steven/brag-output/work2';
const BASE = 'http://localhost:3100';
const W = 1280;
const H = 800;
const scene = process.argv[2] ?? 'probe';
const fpsArg = process.argv.indexOf('--fps');
const FPS = fpsArg > 0 ? Number(process.argv[fpsArg + 1]) : 60;
const DT = 1000 / FPS;

const VT = readFileSync(join(HERE, 'vt-init.js'), 'utf8');

// A crisp arrow cursor drawn into the page (the capture has none) and an ember ring on click.
// Styles go through the CSSOM and inline style properties, so the app's CSP is untouched.
const CURSOR = () => {
  if (window.top !== window) return;
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30"><path d="M2 1.5 L2 23.5 L7.4 18.6 L11.1 27.6 L14.9 26 L11.2 17.2 L18.6 17.2 Z" fill="#fbf8f3" stroke="#0a0908" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  let el = null;
  const ensure = () => {
    if (el || !document.body) return;
    el = document.createElement('div');
    el.innerHTML = SVG;
    Object.assign(el.style, {
      position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none',
      transform: 'translate(-200px,-200px)', filter: 'drop-shadow(0 1.5px 3px rgba(0,0,0,.55))',
    });
    document.body.appendChild(el);
  };
  window.__cursor = {
    move(x, y) {
      ensure();
      if (el) el.style.transform = `translate(${x - 2}px, ${y - 1.5}px)`;
    },
    ring(x, y) {
      ensure();
      const r = document.createElement('div');
      r.dataset.ring = '1';
      Object.assign(r.style, {
        position: 'fixed', left: `${x - 18}px`, top: `${y - 18}px`, width: '36px', height: '36px',
        borderRadius: '50%', border: '2px solid #e3a857', pointerEvents: 'none', zIndex: '2147483646',
      });
      document.body.appendChild(r);
      r.animate([{ transform: 'scale(.35)', opacity: 0.95 }, { transform: 'scale(1.45)', opacity: 0 }], {
        duration: 480, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards',
      }).onfinish = () => r.remove();
    },
  };
  document.addEventListener('DOMContentLoaded', ensure);
};

// The in-drawer YouTube player talks the IFrame API over postMessage once its URL carries
// enablejsapi=1. The page keeps its state, so the recorder can wait for playback and pause it.
const YT_LISTENER = () => {
  if (window.top !== window) return;
  window.__yt = { state: null, time: null, events: 0, ready: false };
  window.addEventListener('message', (e) => {
    if (typeof e.data !== 'string' || !/youtube/.test(e.origin)) return;
    let d;
    try { d = JSON.parse(e.data); } catch { return; }
    window.__yt.events++;
    if (d.event === 'onReady') window.__yt.ready = true;
    if (d.event === 'onStateChange') window.__yt.state = d.info;
    if (d.event === 'infoDelivery' && d.info) {
      if (d.info.playerState != null) window.__yt.state = d.info.playerState;
      if (d.info.currentTime != null) {
        window.__yt.time = d.info.currentTime;
        (window.__yt.samples ||= []).push({ at: window.__vt ? window.__vt.realNow() : Date.now(), cur: d.info.currentTime, state: window.__yt.state });
      }
    }
  });
};

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

class Recorder {
  constructor(page, cdp, dir) {
    this.page = page;
    this.cdp = cdp;
    this.dir = dir;
    this.n = 0;
    this.marks = {};
    this.x = W + 40;
    this.y = H * 0.75;
    this.capturing = false;
    this.started = Date.now();
  }
  async tick() {
    await this.page.evaluate(async (dt) => {
      await window.__vt.advance(dt);
      await window.__vt.realSleep(12);
      window.__vt.sync();
    }, DT);
    if (!this.capturing) return;
    // the clip is in document coordinates, so a scrolled page needs the offset or the capture
    // stays on the document's top and the fixed header walks down the frame
    const [sx, sy] = await this.page.evaluate(() => [window.scrollX, window.scrollY]);
    const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, clip: { x: sx, y: sy, width: W, height: H, scale: 2 } });
    writeFileSync(join(this.dir, `f${String(this.n).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
    this.n++;
    if (this.n % 120 === 0) {
      const s = (Date.now() - this.started) / 1000;
      console.log(`  ${this.n} frames (${(this.n / FPS).toFixed(1)} s of video) in ${s.toFixed(0)} s real`);
    }
  }
  mark(name) {
    this.marks[name] = this.n;
  }
  async hold(seconds) {
    const frames = Math.round(seconds * FPS);
    for (let i = 0; i < frames; i++) await this.tick();
  }
  /** Advances until `cond` is true (checked each frame), at most `max` seconds. */
  async until(cond, max = 10) {
    for (let i = 0; i < max * FPS; i++) {
      if (await cond()) return true;
      await this.tick();
    }
    throw new Error('until: timed out');
  }
  async moveTo(x, y) {
    this.x = x;
    this.y = y;
    await this.page.mouse.move(x, y);
    await this.page.evaluate(([x, y]) => window.__cursor.move(x, y), [x, y]);
  }
  async glide(x, y, seconds = 0.7) {
    const fx = this.x;
    const fy = this.y;
    const frames = Math.max(2, Math.round(seconds * FPS));
    for (let i = 1; i <= frames; i++) {
      const k = easeInOut(i / frames);
      // a slight arc, as a hand moves
      const arc = Math.sin(Math.PI * k) * Math.min(40, Math.hypot(x - fx, y - fy) * 0.08);
      await this.moveTo(fx + (x - fx) * k, fy + (y - fy) * k - arc);
      await this.tick();
    }
  }
  async box(locator) {
    const b = await locator.boundingBox();
    if (!b) throw new Error('no bounding box');
    return b;
  }
  async glideTo(locator, seconds = 0.7, fx = 0.5, fy = 0.5) {
    const b = await this.box(locator);
    await this.glide(b.x + b.width * fx, b.y + b.height * fy, seconds);
  }
  async click() {
    await this.page.evaluate(([x, y]) => window.__cursor.ring(x, y), [this.x, this.y]);
    await this.page.mouse.down();
    await this.tick();
    await this.page.mouse.up();
    await this.tick();
  }
  async type(text, cps = 16) {
    const per = FPS / cps;
    let acc = 0;
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      acc += per;
      while (acc >= 1) {
        await this.tick();
        acc -= 1;
      }
    }
  }
  async press(key) {
    await this.page.keyboard.press(key);
    await this.tick();
  }
  async scrollBy(dy, seconds = 1) {
    const frames = Math.round(seconds * FPS);
    const y0 = await this.page.evaluate(() => document.scrollingElement.scrollTop);
    for (let i = 1; i <= frames; i++) {
      const k = easeInOut(i / frames);
      await this.page.evaluate((y) => document.scrollingElement.scrollTo(0, y), y0 + dy * k);
      await this.tick();
    }
  }
}

async function open() {
  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--hide-scrollbars', '--font-render-hinting=none', '--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    locale: 'en-GB',
    timezoneId: 'Europe/Berlin',
    permissions: ['microphone'],
  });
  await context.addInitScript(VT);
  await context.addInitScript(CURSOR);
  await context.addInitScript(YT_LISTENER);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`[pageerror] ${e.message.slice(0, 200)}`));
  const cdp = await context.newCDPSession(page);
  return { browser, context, page, cdp };
}

/**
 * Loads the stage once and reads the first-visit notice (remembered across loads). Then reloads,
 * and closes the demo toast before the virtual clock has moved, so it never appears: the status
 * pill and every answer still say "demo".
 */
async function prepare(page, rec) {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const gotIt = page.getByRole('button', { name: 'Got it' });
  await rec.until(() => gotIt.isVisible(), 15);
  await gotIt.click();
  await rec.hold(0.4);
  await page.reload({ waitUntil: 'networkidle' });
  await dismissToast(page);
}

/** Closes the demo toast before the virtual clock moves; in live mode there is none to close. */
async function dismissToast(page) {
  const close = page.getByRole('region', { name: 'Notifications' }).getByRole('button', { name: 'Close' }).first();
  try {
    await close.waitFor({ state: 'attached', timeout: 4000 });
    await close.dispatchEvent('click');
  } catch {}
  await page.waitForTimeout(150);
}

/** Scrolls a dialog over `seconds` so `target` sits `margin` px below the top of its scroller. */
async function scrollDialogTo(dialog, target, rec, seconds = 1.0, margin = 140) {
  const handle = await target.elementHandle();
  const { y0, delta } = await dialog.evaluate((d, [el, m]) => {
    const s = [d, ...d.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
    if (!s) return { y0: 0, delta: 0 };
    return { y0: s.scrollTop, delta: el.getBoundingClientRect().top - s.getBoundingClientRect().top - m };
  }, [handle, margin]);
  const frames = Math.max(2, Math.round(seconds * FPS));
  for (let i = 1; i <= frames; i++) {
    const k = easeInOut(i / frames);
    await dialog.evaluate((d, y) => {
      const s = [d, ...d.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
      if (s) s.scrollTop = y;
    }, y0 + delta * k);
    await rec.tick();
  }
}

/**
 * A real-time screencast of the page (CDP), for the one shot the virtual clock can't take: the
 * YouTube player playing. Frames land in `dir` stamped with the wall clock; the player's own
 * clock samples (window.__yt.samples) are saved beside them, so the audio can be aligned later.
 */
async function screencast(page, cdp, dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];
  const marks = {};
  const started = Date.now();
  await page.evaluate(() => { window.__yt.samples = []; });
  const onFrame = async ({ data, metadata, sessionId }) => {
    const at = Date.now();
    const n = frames.length;
    writeFileSync(join(dir, `c${String(n).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
    frames.push({ n, at, ts: metadata.timestamp, w: metadata.deviceWidth, h: metadata.deviceHeight });
    try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch {}
  };
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 2560, maxHeight: 1600, everyNthFrame: 1 });
  return {
    mark: (name) => { marks[name] = Date.now(); },
    async stop() {
      await cdp.send('Page.stopScreencast');
      cdp.off('Page.screencastFrame', onFrame);
      const samples = await page.evaluate(() => window.__yt.samples || []);
      writeFileSync(join(dir, 'screencast.json'), JSON.stringify({ started, frames, marks, samples }));
      const secs = (Date.now() - started) / 1000;
      return { frames: frames.length, seconds: +secs.toFixed(1), fps: +(frames.length / secs).toFixed(1), size: frames[0] ? `${frames[0].w}x${frames[0].h}` : '?', samples: samples.length };
    },
  };
}

const ytSend = (frame, msg) => frame.evaluate((f, m) => f.contentWindow?.postMessage(JSON.stringify(m), '*'), msg);

/**
 * Waits, in real time, until the player reports that it is playing (state 1). The embed carries
 * autoplay=1 and Chromium runs with autoplay allowed; if it still sits cued, it is told to play.
 */
async function waitForPlayer(page, frame, maxMs = 25000) {
  const t0 = Date.now();
  let nudged = false;
  while (Date.now() - t0 < maxMs) {
    await ytSend(frame, { event: 'listening', id: 1, channel: 'widget' });
    await page.waitForTimeout(300);
    const yt = await page.evaluate(() => window.__yt);
    if (yt.state === 1) return yt;
    if (!nudged && Date.now() - t0 > 7000 && yt.events > 0) {
      nudged = true;
      await ytSend(frame, { event: 'command', func: 'playVideo', args: [], id: 1, channel: 'widget' });
    }
  }
  return page.evaluate(() => window.__yt);
}

async function run() {
  const dir = join(HERE, 'frames', scene);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const { browser, page, cdp } = await open();
  const rec = new Recorder(page, cdp, dir);
  try {
    await prepare(page, rec);
    await SCENES[scene](page, rec);
  } finally {
    writeFileSync(join(HERE, 'frames', `${scene}.json`), JSON.stringify({ scene, fps: FPS, frames: rec.n, width: W * 2, height: H * 2, marks: rec.marks }, null, 2));
    console.log(`${scene}: ${rec.n} frames at ${FPS} fps, ${((Date.now() - rec.started) / 1000).toFixed(0)} s real`, rec.marks);
    await browser.close();
  }
}

// A scripted voice for the spoken Talk scene, as the e2e suite fakes one: it "says" each line word
// by word (interim results), then goes quiet. Its timers run on the virtual clock.
const FAKE_RECOGNITION = (lines) => {
  let line = 0;
  class FakeRecognition {
    lang = ''; interimResults = false; continuous = false; maxAlternatives = 1;
    onaudiostart = null; onresult = null; onerror = null; onend = null;
    pending = ''; timers = [];
    result(text, isFinal) {
      const r = Object.assign([{ transcript: text, confidence: 0.94 }], { isFinal });
      this.onresult?.({ resultIndex: 0, results: [r] });
    }
    start() {
      const said = lines[line++] ?? '';
      this.timers.push(setTimeout(() => this.onaudiostart?.(), 20));
      if (!said) return;
      const words = said.split(' ');
      this.pending = said;
      let at = 260;
      words.forEach((_, n) => {
        this.timers.push(setTimeout(() => this.result(words.slice(0, n + 1).join(' '), false), at));
        at += 150 + (n % 3) * 30;
      });
    }
    stop() {
      setTimeout(() => {
        if (this.pending) this.result(this.pending, true);
        this.pending = '';
        this.onend?.();
      }, 30);
    }
    abort() {
      for (const t of this.timers) clearTimeout(t);
      this.pending = '';
      setTimeout(() => this.onend?.(), 10);
    }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
};

const modes = (page) => page.getByRole('radiogroup', { name: 'How Dear Steven replies' });

const SCENES = {
  async probe(page, rec) {
    rec.capturing = true;
    rec.mark('load');
    await rec.hold(2.0);
    await rec.glideTo(page.getByRole('textbox', { name: 'Ask Steven' }), 0.8);
    await rec.click();
    await rec.type('Why do I keep procrastinating?', 16);
    rec.mark('typed');
    await rec.hold(0.3);
  },

  async ask(page, rec) {
    rec.capturing = true;
    rec.mark('load');
    await rec.hold(2.6);
    const box = page.getByRole('textbox', { name: 'Ask Steven' });
    rec.mark('glide');
    await rec.glideTo(box, 0.9, 0.3, 0.5);
    await rec.click();
    rec.mark('focus');
    await rec.type('Why do I keep procrastinating?', 16);
    rec.mark('typed');
    await rec.hold(0.35);
    await rec.press('Enter');
    rec.mark('sent');
    await rec.glide(1150, 560, 0.8);
    await rec.until(async () => (await page.getByText('Answer complete.').count()) > 0, 15);
    rec.mark('answered');
    await rec.hold(0.8);
    const chip = page.locator('[data-citation="c2"]').first();
    const cb = await rec.box(chip);
    if (cb.y + cb.height > H - 180) await rec.scrollBy(cb.y + cb.height - (H - 260), 0.9);
    await rec.glideTo(chip, 0.9, 0.35, 0.55);
    rec.mark('hover');
    await rec.hold(1.4);
    await rec.click();
    rec.mark('inspector');
    await rec.hold(2.8);
    const inspector = page.getByRole('dialog', { name: 'Source inspector' });
    await rec.glideTo(inspector.getByRole('radio', { name: 'Context' }), 0.8);
    await rec.click();
    rec.mark('context');
    await rec.hold(2.6);
    // on to the Video tab: the cut dissolves from this press into the live take's Video tab
    await rec.glideTo(inspector.getByRole('radio', { name: 'Video' }), 0.8);
    await rec.hold(0.2);
    await rec.click();
    rec.mark('video');
    await rec.hold(0.6);
  },

  async about(page, rec) {
    rec.capturing = true;
    await rec.hold(1.6);
    rec.mark('glide');
    await rec.glideTo(page.getByRole('button', { name: /How this works/ }), 0.9);
    await rec.click();
    rec.mark('open');
    await rec.hold(2.2);
    const dialog = page.getByRole('dialog', { name: 'An AI persona with receipts' });
    const kinds = dialog.getByText('Four kinds of statement');
    const y0 = await dialog.evaluate((d) => {
      const s = [d, ...d.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
      return s ? s.scrollTop : -1;
    });
    rec.mark('kinds-scroll');
    const target = await kinds.evaluate((k) => k.getBoundingClientRect().top);
    const frames = Math.round(1.1 * FPS);
    for (let i = 1; i <= frames; i++) {
      const k = easeInOut(i / frames);
      await dialog.evaluate((d, y) => {
        const s = [d, ...d.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
        if (s) s.scrollTop = y;
      }, Math.max(0, y0) + (target - 150) * k);
      await rec.tick();
    }
    rec.mark('kinds');
    await rec.hold(3.0);
    const checked = dialog.getByText('Checked, not trusted');
    const t2 = await checked.evaluate((k) => k.getBoundingClientRect().top);
    const y1 = await dialog.evaluate((d) => {
      const s = [d, ...d.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
      return s ? s.scrollTop : 0;
    });
    rec.mark('checked-scroll');
    for (let i = 1; i <= frames; i++) {
      const k = easeInOut(i / frames);
      await dialog.evaluate((d, y) => {
        const s = [d, ...d.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
        if (s) s.scrollTop = y;
      }, y1 + (t2 - 150) * k);
      await rec.tick();
    }
    rec.mark('checked');
    await rec.hold(3.0);
  },

  async talk(page, rec) {
    await page.addInitScript(FAKE_RECOGNITION, ['How do I stay disciplined when the motivation runs out?', '', '', '']);
    await page.reload({ waitUntil: 'networkidle' });
    const close = page.getByRole('region', { name: 'Notifications' }).getByRole('button', { name: 'Close' }).first();
    await close.waitFor({ state: 'attached', timeout: 15000 });
    await close.dispatchEvent('click');
    await page.waitForTimeout(150);
    rec.capturing = true;
    await rec.hold(1.8);
    rec.mark('glide');
    await rec.glideTo(modes(page).getByRole('radio', { name: 'Talk' }), 0.8);
    await rec.click();
    rec.mark('talk');
    await rec.hold(0.9);
    await rec.glideTo(page.getByRole('button', { name: 'Talk out loud with Steven (M)' }), 0.8);
    await rec.click();
    rec.mark('listening');
    await rec.glide(1100, 640, 0.7);
    await rec.until(() => page.getByRole('article', { name: /stay disciplined/ }).isVisible(), 20);
    rec.mark('reply');
    await rec.hold(5.5);
    rec.mark('end');
  },

  async interview(page, rec) {
    rec.capturing = true;
    await rec.hold(1.4);
    rec.mark('glide');
    await rec.glideTo(modes(page).getByRole('radio', { name: 'Interview me' }), 0.8);
    await rec.click();
    rec.mark('mode');
    await rec.hold(1.2);
    const nameField = page.getByLabel(/What should I call you\?/);
    await rec.glideTo(nameField, 0.7, 0.2, 0.5);
    await rec.click();
    await rec.type('Alex', 10);
    await rec.glideTo(page.getByRole('button', { name: 'Start the interview' }), 0.7);
    await rec.click();
    rec.mark('start');
    const answerBox = page.getByRole('textbox', { name: 'Your answer' });
    const answer = async (text, next) => {
      await rec.until(() => answerBox.isEditable().catch(() => false), 15);
      await rec.hold(1.2);
      rec.mark(`q-${next}`);
      await answerBox.focus();
      await rec.type(text, 38);
      await rec.hold(0.3);
      await rec.press('Enter');
      await rec.until(() => page.getByRole('progressbar', { name: `Question ${next} of 7` }).isVisible().catch(() => false), 15);
    };
    await rec.glide(1120, 600, 0.6);
    await answer('I run a small design studio in Leeds, mostly brands for food start-ups.', 2);
    await answer('It started at my kitchen table with one client who paid us in pizza.', 3);
    await rec.hold(1.0);
    await rec.glideTo(page.getByRole('button', { name: 'End the interview' }), 0.8);
    await rec.click();
    await rec.until(() => page.getByRole('heading', { name: 'Thank you, Alex.' }).isVisible().catch(() => false), 15);
    rec.mark('learned');
    await rec.glide(1150, 420, 0.8);
    await rec.hold(3.2);
  },

  /** Interview me → practise presenting an expertise: six questions, then the debrief (P7-07). */
  async practice(page, rec) {
    rec.capturing = true;
    await rec.hold(1.4);
    rec.mark('glide');
    await rec.glideTo(modes(page).getByRole('radio', { name: 'Interview me' }), 0.8);
    await rec.click();
    rec.mark('mode');
    await rec.hold(1.0);
    await rec.glideTo(page.getByText('Practise presenting my expertise'), 0.7);
    await rec.click();
    rec.mark('practice');
    await rec.hold(0.9);
    const expertise = page.getByLabel('What are you expert in?');
    await rec.glideTo(expertise, 0.6, 0.2, 0.5);
    await rec.click();
    rec.mark('expertise');
    await rec.type('Branding for food start-ups', 14);
    await rec.hold(0.3);
    const audience = page.getByLabel(/Who are you presenting it to\?/);
    await rec.glideTo(audience, 0.5, 0.2, 0.5);
    await rec.click();
    await rec.type('Founders at a start-up meetup', 16);
    const nameField = page.getByLabel(/What should I call you\?/);
    await rec.glideTo(nameField, 0.5, 0.2, 0.5);
    await rec.click();
    await rec.type('Alex', 10);
    await rec.hold(0.2);
    await rec.glideTo(page.getByRole('button', { name: 'Start the practice' }), 0.7);
    await rec.click();
    rec.mark('start');
    await rec.glide(1120, 600, 0.6);
    const answerBox = page.getByRole('textbox', { name: 'Your answer' });
    const ANSWERS = [
      'I run a six-person design studio in Leeds. We build brands for food start-ups, the kind that begin at a market stall. It matters because a good brand is often the only thing a tiny company can afford to get right.',
      'It started at my kitchen table in 2017. One client paid us in pizza for a logo, then sold his sauce into 40 shops within a year. I realised the packaging had done half the selling for him.',
      'Most designers think a food brand needs a story first. I think it needs a shelf test. Two metres away, can you tell what it is?',
      'A granola client relaunched with our packaging in March. Same recipe, same price, same shops. Repeat purchases went from 18 percent to 31 percent in twelve weeks, and the retailer doubled their facings.',
      'We designed a beautiful hot sauce label that printed almost black on the actual bottle. We had only ever seen it on screen. The client lost a season, and we now print a physical proof for every job.',
      'Design for the shelf before you design for the story. If a stranger cannot tell what you sell from two metres away, no amount of storytelling will rescue it.',
    ];
    for (const [i, text] of ANSWERS.entries()) {
      await rec.until(() => page.getByRole('progressbar', { name: `Question ${i + 1} of 6` }).isVisible().catch(() => false), 15);
      await rec.until(() => answerBox.isEditable().catch(() => false), 15);
      rec.mark(`q-${i + 1}`);
      await rec.hold(i === 0 ? 1.4 : 1.0);
      await answerBox.focus();
      rec.mark(`type-${i + 1}`);
      // the third answer is the one the cut shows being typed; the others go quickly
      await rec.type(text, i === 2 ? 38 : 70);
      await rec.hold(0.3);
      await rec.press('Enter');
      rec.mark(`sent-${i + 1}`);
    }
    await rec.until(() => page.getByText('Debrief', { exact: true }).isVisible().catch(() => false), 15);
    rec.mark('debrief');
    await rec.glide(1150, 500, 0.8);
    await rec.hold(1.0);
    // down to what to work on, the rewrite note and "practise the weakest answer again"
    rec.mark('scroll');
    await rec.scrollBy(360, 1.8);
    rec.mark('scrolled');
    await rec.hold(2.4);
    rec.mark('end');
  },

  /**
   * The live knowledge base: the conversations it knows → one episode's summary → a moment →
   * the Video tab → the YouTube player at that second. Nothing here calls a model.
   */
  async sources(page, rec) {
    rec.capturing = true;
    await rec.hold(1.4);
    rec.mark('glide');
    await rec.glideTo(page.getByTestId('status-pill'), 0.8);
    await rec.click();
    rec.mark('setup');
    await rec.hold(0.8);
    // the Browse button sits below the setup panel's fold
    const setup = page.getByRole('dialog', { name: /What I have to work with/ });
    const browse = page.getByRole('button', { name: /Browse the \d+ conversations/ });
    await browse.waitFor({ state: 'attached', timeout: 15000 });
    await scrollDialogTo(setup, browse, rec, 0.9, 480);
    await rec.hold(0.3);
    await rec.glideTo(browse, 0.7);
    await rec.click();
    rec.mark('explorer');
    const explorer = page.getByRole('dialog', { name: 'The conversations I know' });
    await rec.until(() => explorer.getByRole('listitem').first().isVisible().catch(() => false), 15);
    await rec.hold(1.0);
    const search = explorer.getByRole('searchbox', { name: 'Search by guest or title' });
    await rec.glideTo(search, 0.6, 0.15, 0.5);
    await rec.click();
    rec.mark('search');
    await rec.type('Huberman', 14);
    const row = explorer.getByRole('listitem').filter({ hasText: 'Deep Sleep' }).first();
    await rec.until(async () => (await explorer.getByRole('listitem').count()) <= 5 && (await row.isVisible().catch(() => false)), 10);
    rec.mark('matches');
    await rec.hold(1.0);
    await rec.glideTo(row.getByRole('button', { name: /^Summary of/ }), 0.7);
    await rec.click();
    rec.mark('summary');
    await rec.until(() => explorer.getByText('Most interesting moments').isVisible().catch(() => false), 15);
    rec.mark('summary-ready');
    await rec.hold(0.8);
    const moment = explorer.getByRole('button').filter({ hasText: '30:24' }).first();
    rec.mark('moments-scroll');
    await scrollDialogTo(explorer, moment, rec, 1.0, 150);
    rec.mark('moments');
    await rec.hold(1.0);
    await rec.glideTo(moment, 0.8, 0.3, 0.4);
    await rec.hold(0.3);
    await rec.click();
    rec.mark('inspector');
    const inspector = page.getByRole('dialog', { name: 'Source inspector' });
    const videoTab = inspector.getByRole('radio', { name: 'Video' });
    await rec.until(() => videoTab.isVisible().catch(() => false), 15);
    await rec.hold(1.8);
    await rec.glideTo(videoTab, 0.8);
    await rec.click();
    rec.mark('video');
    const play = inspector.getByRole('button', { name: /Play the video here from/ });
    await rec.until(() => play.isVisible().catch(() => false), 10);
    await rec.hold(1.6);
    await rec.glideTo(play, 0.9, 0.5, 0.5);
    await rec.hold(0.4);
    await rec.click();
    rec.mark('play');
    const frame = inspector.locator('iframe[title^="YouTube video"]');
    await frame.waitFor({ state: 'attached', timeout: 15000 });
    await frame.evaluate((f) => {
      const u = new URL(f.src);
      u.searchParams.set('enablejsapi', '1');
      u.searchParams.set('origin', location.origin);
      f.src = u.toString();
    });
    // the cursor leaves the player at once, so YouTube's hover chrome doesn't stay up
    await rec.moveTo(900, 700);
    // the click ring's animation lives on the virtual clock, which stops here: take it off
    await page.evaluate(() => { for (const r of document.querySelectorAll('[data-ring]')) r.remove(); });
    await rec.tick();
    rec.mark('loading');
    // From here the player runs in real time: a screencast of the page while it loads and plays.
    const cast = await screencast(page, rec.cdp, join(HERE, 'frames', 'play'));
    const yt = await waitForPlayer(page, frame, 25000);
    cast.mark('playing');
    console.log('player', yt);
    await page.waitForTimeout(5400);
    cast.mark('end');
    console.log('screencast', await cast.stop());
    rec.mark('end');
  },
};

await run();
