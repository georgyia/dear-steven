// Renders composition-v3/index.html (or --html <path>) frame by frame at 60 fps (every frame a pure function of t).
//   node render2.mjs <outdir> [--stills t1,t2,…] [--from s] [--to s]
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire('/Users/georgychomakhashvili/dear-steven/apps/web/package.json');
const { chromium } = require('@playwright/test');

const FRAMES = '/Users/georgychomakhashvili/dear-steven/brag-output/work2/frames';
const [, , outdir, ...rest] = process.argv;
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const FPS = Number(opt('--fps', 60));
const HTML = opt('--html', '/Users/georgychomakhashvili/dear-steven/brag-output/composition-v3/index.html');

const clips = {};
for (const name of ['ask', 'about', 'talk', 'interview', 'practice', 'sources', 'play']) {
  const p = join(FRAMES, `${name}.json`);
  if (existsSync(p)) clips[name] = JSON.parse(readFileSync(p, 'utf8'));
}
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await context.addInitScript((c) => { window.__clips = c; }, clips);
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error(`[page] ${m.text().slice(0, 240)}`); });
page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => console.error(`[missing] ${r.url()}`));
await page.goto(`file://${HTML}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
const duration = await page.evaluate(() => window.__duration);
mkdirSync(outdir, { recursive: true });
writeFileSync(join(outdir, 'audio.json'), JSON.stringify(await page.evaluate(() => window.__audio), null, 1));
writeFileSync(join(outdir, 'schedule.json'), JSON.stringify(await page.evaluate(() => window.__schedule), null, 1));

const stills = opt('--stills', null);
if (stills) {
  for (const t of stills.split(',').map(Number)) {
    await page.evaluate((t) => window.__seek(t), t);
    writeFileSync(join(outdir, `s_${t.toFixed(2)}.jpg`), await page.screenshot({ type: 'jpeg', quality: 88 }));
  }
  console.log(`stills: ${stills.split(',').length}`);
  await browser.close();
  process.exit(0);
}

const framesDir = join(outdir, 'frames');
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
const from = Number(opt('--from', 0));
const to = Number(opt('--to', duration));
const first = Math.round(from * FPS), last = Math.round(to * FPS);
const t0 = Date.now();
for (let f = first; f < last; f++) {
  await page.evaluate((t) => window.__seek(t), f / FPS);
  writeFileSync(join(framesDir, `f${String(f - first).padStart(5, '0')}.jpg`), await page.screenshot({ type: 'jpeg', quality: 94 }));
  if ((f - first) % 300 === 0) console.log(`frame ${f - first}/${last - first} — ${((f - first) / ((Date.now() - t0) / 1000 || 1)).toFixed(1)} fps`);
}
console.log(`done: ${last - first} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
await browser.close();
