// Virtual time for frame-exact capture. Injected before any page script.
//
// The page sees a clock that only moves when the recorder calls window.__vt.advance(ms): timers,
// requestAnimationFrame, performance.now, Date, Web Animations / CSS transitions (paused and seeked
// each frame), smooth scrolling, the answer stream's pacing and speech all run on it. So every
// frame is rendered exactly as it would be at that moment, however slowly the machine draws it.
(() => {
  if (window.__vt) return;
  // Only the page itself: a YouTube player in an iframe keeps real time, or it would never load.
  if (window.top !== window) return;
  const realPerfNow = performance.now.bind(performance);
  const realSetTimeout = window.setTimeout.bind(window);
  const RealDate = Date;
  const realFetch = window.fetch.bind(window);
  const realRAF = window.requestAnimationFrame.bind(window);
  const epoch = RealDate.now();
  let vnow = 0;
  let seq = 1;
  const timers = new Map();
  const rafs = new Map();

  // ---- clocks ----
  performance.now = () => vnow;
  class VDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(epoch + vnow);
      else super(...args);
    }
    static now() {
      return epoch + vnow;
    }
  }
  window.Date = VDate;

  // motion accelerates opacity, filter and transform with Web Animations and times them against
  // the document timeline, which virtual time can't move. It only checks Element.prototype for
  // `animate`, so with the method moved one level down motion animates in JS, on the virtual
  // clock, while other components (toasts, the fuse button) keep element.animate.
  const nativeAnimate = Element.prototype.animate;
  if (nativeAnimate) {
    delete Element.prototype.animate;
    HTMLElement.prototype.animate = nativeAnimate;
    SVGElement.prototype.animate = nativeAnimate;
  }

  // ---- timers ----
  window.setTimeout = (fn, ms, ...args) => {
    const id = seq++;
    timers.set(id, { at: vnow + Math.max(0, Number(ms) || 0), fn, args });
    return id;
  };
  window.setInterval = (fn, ms, ...args) => {
    const id = seq++;
    const every = Math.max(4, Number(ms) || 0);
    timers.set(id, { at: vnow + every, fn, args, every });
    return id;
  };
  window.clearTimeout = (id) => void timers.delete(id);
  window.clearInterval = (id) => void timers.delete(id);
  window.requestAnimationFrame = (cb) => {
    const id = seq++;
    rafs.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => void rafs.delete(id);

  // ---- Web Animations and CSS transitions: paused, then seeked to virtual time ----
  const anims = new WeakMap();
  function syncAnimations() {
    let list = [];
    try {
      list = document.getAnimations();
    } catch {}
    for (const a of list) {
      let st = anims.get(a);
      if (!st) {
        st = { start: vnow, done: false };
        anims.set(a, st);
      }
      if (st.done) continue;
      const rate = a.playbackRate || 1;
      const t = Math.max(0, (vnow - st.start) * rate);
      let end = Infinity;
      try {
        end = a.effect?.getComputedTiming?.().endTime ?? Infinity;
      } catch {}
      try {
        if (Number.isFinite(end) && t >= end) {
          st.done = true;
          if (a.playState !== 'finished') a.finish();
        } else {
          if (a.playState === 'running') a.pause();
          a.currentTime = t;
        }
      } catch {}
    }
  }

  // Animations started between frames (at hydration, on a click) are pinned to the virtual clock
  // within one real frame, so nothing ever plays out in real time behind the recorder's back.
  const pin = () => {
    syncAnimations();
    realRAF(pin);
  };
  realRAF(pin);

  // ---- smooth scrolling, on virtual time ----
  const scrollers = () => {
    const out = [document.scrollingElement];
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) out.push(el);
    }
    return out.filter(Boolean);
  };
  const animateScroll = (moves, ms = 520) => {
    const t0 = vnow;
    const ease = (x) => 1 - (1 - x) ** 3;
    const step = () => {
      const k = Math.min(1, (vnow - t0) / ms);
      for (const m of moves) m.el.scrollTop = m.from + (m.to - m.from) * ease(k);
      if (k < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  };
  const smoothly = (run) => {
    const els = scrollers();
    const before = els.map((el) => el.scrollTop);
    run();
    const moves = els
      .map((el, i) => ({ el, from: before[i], to: el.scrollTop }))
      .filter((m) => Math.abs(m.to - m.from) > 0.5);
    for (const m of moves) m.el.scrollTop = m.from;
    if (moves.length) animateScroll(moves);
  };
  const realIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (opts) {
    if (opts && typeof opts === 'object' && opts.behavior === 'smooth') {
      return smoothly(() => realIntoView.call(this, { ...opts, behavior: 'auto' }));
    }
    return realIntoView.call(this, opts);
  };
  const realScrollTo = window.scrollTo.bind(window);
  window.scrollTo = (a, b) => {
    if (a && typeof a === 'object' && a.behavior === 'smooth') {
      return smoothly(() => realScrollTo({ ...a, behavior: 'auto' }));
    }
    return typeof a === 'object' ? realScrollTo(a) : realScrollTo(a, b);
  };

  // ---- streamed responses keep their real pacing, replayed on virtual time ----
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url ?? String(input);
    if (!/\/api\/(ask|interview)/.test(url)) return realFetch(input, init);
    const v0 = vnow;
    const r0 = realPerfNow();
    const res = await realFetch(input, init);
    if (!res.body) return res;
    const reader = res.body.getReader();
    const body = new ReadableStream({
      start(controller) {
        let pending = 0;
        let ended = false;
        let lastAt = v0;
        const closeIfDone = () => {
          if (ended && pending === 0) controller.close();
        };
        (async () => {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const at = Math.max(lastAt, v0 + (realPerfNow() - r0));
            lastAt = at;
            pending++;
            window.setTimeout(() => {
              controller.enqueue(value);
              pending--;
              closeIfDone();
            }, at - vnow);
          }
          ended = true;
          closeIfDone();
        })().catch((e) => controller.error(e));
      },
    });
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  };

  // ---- speech: a voice that takes its time on the virtual clock ----
  if ('speechSynthesis' in window) {
    let speaking = null;
    const synth = window.speechSynthesis;
    synth.speak = (u) => {
      const ms = 900 + String(u.text || '').length * 62;
      speaking = window.setTimeout(() => {
        speaking = null;
        u.onend?.(new Event('end'));
      }, ms);
      window.setTimeout(() => u.onstart?.(new Event('start')), 0);
    };
    synth.cancel = () => {
      if (speaking) window.clearTimeout(speaking);
      speaking = null;
    };
    try {
      Object.defineProperty(synth, 'speaking', { get: () => speaking !== null, configurable: true });
    } catch {}
  }

  window.__vt = {
    now: () => vnow,
    sync: syncAnimations,
    realSleep: (ms) => new Promise((r) => realSetTimeout(r, ms)),
    realNow: () => RealDate.now(),
    async advance(ms) {
      const target = vnow + ms;
      for (let guard = 0; guard < 4000; guard++) {
        let next = null;
        for (const [id, t] of timers) {
          if (t.at <= target && (!next || t.at < next.t.at || (t.at === next.t.at && id < next.id))) next = { id, t };
        }
        if (!next) break;
        vnow = Math.max(vnow, next.t.at);
        if (next.t.every) next.t.at += next.t.every;
        else timers.delete(next.id);
        try {
          if (typeof next.t.fn === 'function') next.t.fn(...next.t.args);
        } catch (e) {
          console.error(e);
        }
        await Promise.resolve();
      }
      vnow = target;
      syncAnimations();
      const cbs = [...rafs.values()];
      rafs.clear();
      for (const cb of cbs) {
        try {
          cb(vnow);
        } catch (e) {
          console.error(e);
        }
      }
      await Promise.resolve();
      syncAnimations();
    },
  };
})();
