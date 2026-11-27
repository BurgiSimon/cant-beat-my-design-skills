// The shared runtime: GSAP and its plugins, Lenis smooth scrolling (where there is a wheel), the header, and the small
// motion primitives every page uses, driven by data attributes so sections stay declarative:
//
//   data-reveal[="up|fade|scale|left|right"]   rises/fades in once when it enters the screen
//   data-reveal-stagger                          its children reveal one after another
//   data-split                                   a heading whose lines rise out of a mask
//   data-count="1234" [data-decimals data-prefix data-suffix]   a number that counts up when seen
//   data-odometer="1234" [same]                  Michroma digits that roll up, digit by digit, when seen
//   data-marquee[="speed"]                       an endless horizontal strip (duplicate the content once in the markup)
//   data-magnetic                                leans toward the pointer
//   data-tilt                                    tilts toward the pointer in 3D
//   data-spotlight                               a soft light follows the pointer across it (sets --mx/--my)
//   data-roll                                    its text rolls up into a white copy on hover (icons are kept)
//
// Helpers for modules: toast(text, key?), odometer(el, value, opts), store.get/set, countTo, whenVisible,
// scrollToTarget(el | selector | y, { offset?, immediate? }) (an element lands where a native #anchor would: html's
// scroll-padding-top plus its scroll-margin-top, see anchorOffset), landing(fn) (a module says where a deep link or an
// in-page link to one of its elements lands; returns a remove function), restingTop(el), …
//
// Everything resolves to the resting design under reduced motion (.is-calm) and without scripts.

export const root = document.documentElement;
export const calm = root.classList.contains('is-calm');
export const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const gsap = window.gsap || null;
export const ScrollTrigger = window.ScrollTrigger || null;
export const SplitText = window.SplitText || null;
export let lenis = null;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/** Run fn(true/false) as el comes near / leaves the screen. Returns a stop function. */
export function whenVisible(el, fn, rootMargin = '120px') {
  if (!el) return () => {};
  const io = new IntersectionObserver(([e]) => fn(e.isIntersecting), { rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

/** How far below the top of the screen an #id lands: exactly where the browser's own anchor scrolling puts it (html's
 *  scroll-padding-top, which keeps the header clear, plus the target's own scroll-margin-top), so a deep link, a click
 *  on an in-page link and a native jump all agree. */
export function anchorOffset(el) {
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const o = px(getComputedStyle(root).scrollPaddingTop) + (el instanceof Element ? px(getComputedStyle(el).scrollMarginTop) : 0);
  return o > 0 ? o : 84;
}

/** Where an element's top will rest, relative to the screen: a target (or one of its ancestors) still waiting for its
 *  reveal sits a little lower than that until it rises, and a landing must not be off by the rise. */
export function restingTop(el) {
  let top = el.getBoundingClientRect().top;
  if (gsap) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.matches('[data-reveal], [data-reveal-stagger] > *')) top -= Number(gsap.getProperty(n, 'y')) || 0;
    }
  }
  return top;
}

// Lenis keeps its own idea of where the page is, and a native scroll (focus moving to a control off screen, the
// browser's own jump to an #id) can leave it behind for a moment: anything measured against it would land off target.
// Tell it where the page really is first.
function syncLenis() {
  if (lenis && Math.abs(lenis.scroll - scrollY) > 1) lenis.resize();
}

/** Scroll to an element (or a selector, or a y), smoothly where Lenis runs. An element lands where a native #anchor
 *  would, unless an offset is given. */
export function scrollToTarget(target, { offset, immediate = false } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  syncLenis();
  let y = 0;
  if (typeof el === 'number') y = el + (offset ?? 0);
  else if (el) y = restingTop(el) + scrollY + (offset ?? -anchorOffset(el));
  y = Math.max(0, Math.round(y));
  if (lenis) { lenis.scrollTo(y, { duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4), immediate }); return; }
  scrollTo({ top: y, behavior: calm || immediate ? 'auto' : 'smooth' });
}

// ---- the one toast: the footer's hint pill at the foot of the screen ----
let toastEl = null, toastT = 0;
export function toast(text, key = 'Demo') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
  }
  // a modal dialog sits in the top layer, above everything else: while one is open the toast rides inside it
  const host = document.querySelector('dialog[open]') || document.body;
  if (toastEl.parentElement !== host) host.append(toastEl);
  const msg = document.createElement('span');
  msg.textContent = text;
  if (key) {
    const pill = document.createElement('span');
    pill.className = 'toast__key';
    pill.textContent = key;
    toastEl.replaceChildren(pill, msg);
  } else toastEl.replaceChildren(msg);
  requestAnimationFrame(() => toastEl.classList.add('is-on'));
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('is-on'), 3600);
}

// ---- storage that never throws (private windows, blocked storage); keys are prefixed crestora: ----
// The cookie page's Preferences switch (crestora:cookies → { preferences: false }) is honoured here, once for every
// module: with it off, nothing but that choice itself is remembered.
export const remembers = () => {
  try { return JSON.parse(localStorage.getItem('crestora:cookies'))?.preferences !== false; } catch { return true; }
};
export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(`crestora:${key}`); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    if (key !== 'cookies' && !remembers()) return;
    try { localStorage.setItem(`crestora:${key}`, JSON.stringify(value)); } catch {}
  },
  clear(key) { try { localStorage.removeItem(`crestora:${key}`); } catch {} },
};

// ---- odometer: Michroma digits in fixed cells, each a column of 0–9 that rolls to its value ----
export const formatNumber = (v, { decimals = 0, prefix = '', suffix = '', grouping = true } = {}) =>
  `${prefix}${Number(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping })}${suffix}`;
// data-decimals, data-prefix, data-suffix and data-grouping="false" (a year: 2021, not 2,021)
const numberOpts = (el) => ({ decimals: parseInt(el.dataset.decimals || 0, 10), prefix: el.dataset.prefix || '', suffix: el.dataset.suffix || '', grouping: el.dataset.grouping !== 'false' });
const isDigit = (ch) => ch >= '0' && ch <= '9';
export function odometer(el, value, opts = {}) {
  const text = formatNumber(value, opts);
  el.setAttribute('aria-label', text);
  el.classList.add('odo');
  if ((el._odo || '').length !== text.length) {
    // build one column per digit (and a plain span for commas, points, signs), starting at 0
    el.textContent = '';
    for (const ch of text) {
      const cell = document.createElement('span');
      cell.setAttribute('aria-hidden', 'true');
      if (isDigit(ch)) {
        cell.className = 'odo__d';
        const col = document.createElement('span');
        for (let i = 0; i <= 9; i++) { const n = document.createElement('span'); n.textContent = String(i); col.append(n); }
        cell.append(col);
      } else {
        // Michroma draws % as "o/o": units are set in Inter
        cell.className = ch === '%' ? 'odo__s odo__u' : 'odo__s';
        cell.textContent = ch;
      }
      el.append(cell);
    }
    el.getBoundingClientRect(); // lay out at 0 so the columns roll from there
  }
  el._odo = text;
  if (opts.hold) return;                 // built, held at 0 until the next call rolls it
  const cells = [...el.children];
  [...text].forEach((ch, i) => {
    const cell = cells[i];
    if (!cell || !cell.classList.contains('odo__d')) return;
    const col = cell.firstChild;
    col.style.transition = calm ? 'none' : '';
    col.style.transitionDelay = `${(cells.length - i) * 0.025}s`;
    col.style.transform = `translateY(${-Number(ch) * 1.15}em)`;
  });
  el._odo = text;
}

let locks = 0;
export function lockScroll() { if (locks++ === 0) { lenis?.stop(); root.style.overflow = 'hidden'; } }
export function unlockScroll() { if (locks > 0 && --locks === 0) { lenis?.start(); root.style.overflow = ''; } }

export function boot() {
  if (gsap) {
    gsap.registerPlugin(...[ScrollTrigger, SplitText].filter(Boolean));
    gsap.defaults({ ease: 'power3.out', duration: 0.9 });
  }
  if (!calm && fine && gsap && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, autoRaf: false, anchors: false });
    if (ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  header();
  anchors();
  rolls();
  deepLink();
  if (calm || !gsap) { root.classList.add('is-ready'); return; }
  reveals();
  splits();
  counters();
  odometers();
  marquees();
  if (fine) { magnetic(); tilt(); spotlight(); }
  onLoad(() => ScrollTrigger?.refresh());
  document.fonts?.ready.then(() => ScrollTrigger?.refresh());
}

const onLoad = (fn) => { if (document.readyState === 'complete') fn(); else addEventListener('load', () => fn(), { once: true }); };

// main.js says when the page's modules have started (they may open, filter or claim the target of a deep link first)
let markStarted = () => {};
const started = new Promise((r) => { markStarted = r; });
export function modulesStarted() { markStarted(); }

// ---- deep links ----
// A module can say where a deep link (or an in-page link) to one of its elements lands instead: the start of a pinned
// section, a card in the middle of the screen. fn(target) returns a scroll y, or nothing to leave it to the default.
// Returns a function that withdraws it.
const landers = new Set();
let reland = null;
export function landing(fn) {
  landers.add(fn);
  reland?.();
  return () => landers.delete(fn);
}
function landY(t) {
  for (const fn of landers) {
    const y = fn(t);
    if (Number.isFinite(y)) return y;
  }
  return restingTop(t) + scrollY - anchorOffset(t);
}
function land(t) {
  // a hidden target (a filtered card) or a dialog (its own module opens it) is not a place on the page
  if (!t?.isConnected || !t.getClientRects().length || t.closest('dialog')) return;
  syncLenis();
  const y = Math.max(0, Math.round(landY(t)));
  if (Math.abs(y - scrollY) < 1) return;
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else scrollTo(0, y);
}

// The browser jumps to the #id natively while the page is still loading. Once the page's modules have started (they may
// open, filter or claim the target first), or once it has loaded if they are slow to come, the target is landed where it
// points, and landed again whenever late layout moves it: the load, the fonts, a pin that adds its length once its canvas
// is up (every ScrollTrigger refresh), a module claiming the target. All of that stops the moment the reader moves the
// page themselves. Under reduced motion it's the same, without Lenis.
// A reload or a step back through history is the browser's to restore, as it does without scripts: the reader goes back
// to where they were. Only if that was still where the link points is it landed again (late layout would move it).
// (that is noted in the history entry itself, as the browser keeps its scroll position there: not in site storage)
const histState = () => (history.state && typeof history.state === 'object' ? history.state : {});
function deepLink() {
  let id = '';
  try { id = decodeURIComponent(location.hash.slice(1)); } catch {}
  // whenever the page comes to rest: has the reader moved on from where the address's #id lands? (noted then, as the
  // browser no longer takes a note once a reload has begun)
  let rest = 0;
  addEventListener('scroll', () => {
    clearTimeout(rest);
    rest = setTimeout(() => {
      let at = '';
      try { at = decodeURIComponent(location.hash.slice(1)); } catch {}
      const t = at && document.getElementById(at);
      if (!t || !t.getClientRects().length || t.closest('dialog')) return;
      const away = Math.abs(landY(t) - scrollY) >= 8;
      if (Boolean(histState().crestoraAway) !== away) try { history.replaceState({ ...histState(), crestoraAway: away }, ''); } catch {}
    }, 200);
  }, { passive: true });
  // the #id changes without a reload (a typed #hash, a plain link the kit didn't glide, a step back to a link's entry):
  // the browser jumps natively, measuring targets that a reveal may still be moving, so land it where it points. Not
  // when the step goes back to a place the reader had moved on from: the browser restores that, as it should.
  addEventListener('hashchange', () => {
    if (histState().crestoraAway) return;
    let at = '';
    try { at = decodeURIComponent(location.hash.slice(1)); } catch {}
    const t = at && document.getElementById(at);
    if (!t) return;
    const USER = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    let over = false;
    const stop = () => { over = true; for (const e of USER) removeEventListener(e, stop, true); };
    for (const e of USER) addEventListener(e, stop, { capture: true, passive: true });
    const again = () => { if (!over) land(t); };
    requestAnimationFrame(again);
    setTimeout(() => { again(); stop(); }, 900);   // once a reveal still rising under it has come to rest
  });
  if (!id) return;
  const nav = performance.getEntriesByType?.('navigation')?.[0]?.type;
  if ((nav === 'reload' || nav === 'back_forward') && histState().crestoraAway) return;
  const USER = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  let live = false, done = false;
  const again = () => { if (live && !done) land(document.getElementById(id)); };
  const stop = () => {
    done = true; reland = null;
    for (const t of USER) removeEventListener(t, stop, true);
    ScrollTrigger?.removeEventListener('refresh', again);
  };
  for (const t of USER) addEventListener(t, stop, { capture: true, passive: true });
  const go = () => {
    if (done) return;
    if (!live) {
      live = true;
      reland = again;
      ScrollTrigger?.addEventListener('refresh', again);
    }
    again();
    requestAnimationFrame(again);
  };
  started.then(go);
  onLoad(() => {
    go();
    document.fonts?.ready.then(again);
    setTimeout(stop, 10000);   // by then the page has long settled
  });
}

// ---- the header: frosted once the page moves, out of the way while reading down, a progress line, a menu ----
function header() {
  const bar = $('.header');
  if (!bar) return;
  let last = scrollY;
  const onScroll = () => {
    const y = lenis ? lenis.scroll : scrollY;
    bar.classList.toggle('is-scrolled', y > 16);
    const down = y > last + 2, up = y < last - 2;
    if (!bar.contains(document.activeElement) && !bar.classList.contains('is-open')) {
      if (down && y > 480) bar.classList.add('is-hidden');
      else if (up || y < 480) bar.classList.remove('is-hidden');
    }
    last = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
  };
  if (lenis) lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  bar.addEventListener('focusin', () => bar.classList.remove('is-hidden', 'is-away'));

  // the night at the foot of every page (and the home finale) is a full screen of its own: the bar steps out of it
  const scenes = $$('#start, .footer');
  if (scenes.length) {
    const inView = new Set();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? inView.add(e.target) : inView.delete(e.target);
      const away = inView.size > 0 && !bar.contains(document.activeElement) && !bar.classList.contains('is-open');
      bar.classList.toggle('is-away', away);
    }, { rootMargin: '0px 0px -55% 0px' });   // once the scene reaches the top 45% of the screen
    scenes.forEach((s) => io.observe(s));
  }

  // dropdowns: open on hover (with a short grace) and on click/Enter; Escape closes and returns focus
  for (const item of $$('.nav__item[data-menu]', bar)) {
    const btn = $('.nav__trigger', item);
    let t = 0;
    const open = (v) => { item.classList.toggle('is-open', v); btn.setAttribute('aria-expanded', String(v)); };
    btn.addEventListener('click', () => open(!item.classList.contains('is-open')));
    if (fine) {
      item.addEventListener('pointerenter', () => { clearTimeout(t); open(true); });
      item.addEventListener('pointerleave', () => { t = setTimeout(() => open(false), 160); });
    }
    item.addEventListener('keydown', (e) => { if (e.key === 'Escape') { open(false); btn.focus(); } });
    item.addEventListener('focusout', (e) => { if (!item.contains(e.relatedTarget)) open(false); });
  }

  // the menu on small screens: a real dialog (focus kept inside, Escape, scroll locked)
  const toggle = $('.header__burger', bar);
  const panel = $('.menu', bar.parentElement) || $('.menu');
  if (!toggle || !panel) return;
  const focusables = () => $$('a, button', panel).filter((el) => !el.closest('[hidden]'));
  const set = (v) => {
    bar.classList.toggle('is-open', v);
    panel.classList.toggle('is-open', v);
    toggle.setAttribute('aria-expanded', String(v));
    toggle.setAttribute('aria-label', v ? 'Close menu' : 'Open menu');
    panel.inert = !v;
    if (v) { lockScroll(); setTimeout(() => focusables()[0]?.focus(), 60); } else unlockScroll();
  };
  panel.inert = true;
  toggle.addEventListener('click', () => set(!panel.classList.contains('is-open')));
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  addEventListener('keydown', (e) => {
    if (!panel.classList.contains('is-open')) return;
    if (e.key === 'Escape') { set(false); toggle.focus(); }
    if (e.key === 'Tab') {
      const f = [toggle, ...focusables()]; const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  matchMedia('(min-width: 1024px)').addEventListener('change', (m) => { if (m.matches && panel.classList.contains('is-open')) set(false); });
}

// ---- in-page anchors glide to where a deep link would land (and move focus there) ----
// A link that opens a dialog ([data-dialog-open]) is the dialog module's: it doesn't glide anywhere.
function anchors() {
  const page = (p) => p.replace(/\/index\.html$/, '/');
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    if (a.matches('[data-dialog-open]') || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (page(url.pathname) !== page(location.pathname) || !url.hash || url.hash === '#') return;
    let id = '';
    try { id = decodeURIComponent(url.hash.slice(1)); } catch { return; }
    const t = document.getElementById(id);
    if (!t || !t.getClientRects().length) return;
    e.preventDefault();
    syncLenis();
    scrollToTarget(landY(t));
    history.pushState(null, '', url.hash);
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
  });
}

function rolls() {
  for (const a of $$('[data-roll]')) {
    if (a.querySelector('.roll')) continue;
    // wrap the label (its text nodes) and keep any icon beside it
    const text = [...a.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!text.length) continue;
    const roll = document.createElement('span');
    roll.className = 'roll';
    const inner = document.createElement('span');
    inner.textContent = text.map((n) => n.textContent.trim()).join(' ');
    roll.append(inner);
    text[0].replaceWith(roll);
    for (const n of text.slice(1)) n.textContent = '';
  }
}

// ---- reveals ----
const FROM = {
  up: { y: 28, opacity: 0 },
  fade: { opacity: 0 },
  scale: { scale: 0.94, opacity: 0 },
  left: { x: -28, opacity: 0 },
  right: { x: 28, opacity: 0 },
};
function reveals() {
  const items = $$('[data-reveal]');
  const groups = $$('[data-reveal-stagger]');
  for (const el of items) {
    const from = FROM[el.dataset.reveal] || FROM.up;
    gsap.set(el, from);
    ScrollTrigger.create({
      // measured from where it rests, not from where it waits (28 px lower)
      trigger: el, start: from.y ? `top-=${from.y} 88%` : 'top 88%', once: true,
      onEnter: () => gsap.to(el, { x: 0, y: 0, scale: 1, opacity: 1, duration: 1.1, ease: 'expo.out', delay: parseFloat(el.dataset.delay || 0), clearProps: 'transform,opacity', onComplete: () => el.classList.add('is-in') }),
    });
  }
  for (const g of groups) {
    const kids = [...g.children];
    gsap.set(kids, { y: 24, opacity: 0 });
    ScrollTrigger.create({
      trigger: g, start: 'top 86%', once: true,
      onEnter: () => gsap.to(kids, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: parseFloat(g.dataset.revealStagger || 0.07), clearProps: 'transform,opacity' }),
    });
  }
  root.classList.add('is-ready');
}

// Lines are measured in the real font: a heading is split once the face it is set in has loaded (it's preloaded, so
// this is a frame or two), and held hidden until then, so it never shows unsplit and then jumps. Lines measured in a
// stand-in face would break wrongly once the real one arrives (a line's words wrapping inside its mask), so a face that
// is slow to come doesn't hold the headings back: after 1.5 s they show as plain text, and only those still below the
// screen are split when it arrives. For the same reason a heading that hasn't risen yet is split again when the width
// changes.
const SPLIT = { type: 'lines', mask: 'lines', linesClass: 'split-line' };
function splits() {
  if (!SplitText) return;
  const els = $$('[data-split]');
  if (!els.length) return;
  gsap.set(els, { autoAlpha: 0 });
  const font = (el) => { const cs = getComputedStyle(el); return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; };
  // the headings' own faces (asked for here, in case nothing has asked yet), then whatever else is still loading
  const faces = document.fonts?.load
    ? Promise.all(els.map((el) => document.fonts.load(font(el), el.textContent.trim() || 'A').catch(() => null))).then(() => document.fonts.ready)
    : Promise.resolve();
  let late = false;
  const timer = setTimeout(() => { late = true; gsap.set(els, { autoAlpha: 1 }); }, 1500);
  faces.then(() => {
    clearTimeout(timer);
    gsap.set(els, { autoAlpha: 1 });
    for (const el of els) if (!late || el.getBoundingClientRect().top > innerHeight) split(el);
  });
  let w = innerWidth, t = 0;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (innerWidth === w) return;
      w = innerWidth;
      // a new width can ask for faces (or subsets) not needed before: measure once they are in
      (document.fonts?.ready || Promise.resolve()).then(() => {
        for (const el of els) {
          const st = el._split;
          if (!st || st.risen) continue;
          st.s.revert();
          st.s = new SplitText(el, SPLIT);
          gsap.set(st.s.lines, { yPercent: 110 });
        }
      });
    }, 120);
  });
}
function split(el) {
  if (el._split) return;
  const st = { s: new SplitText(el, SPLIT), risen: false };
  el._split = st;
  gsap.set(st.s.lines, { yPercent: 110 });
  ScrollTrigger.create({
    trigger: el, start: 'top 88%', once: true,
    onEnter: () => {
      st.risen = true;
      gsap.to(st.s.lines, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.08, delay: parseFloat(el.dataset.delay || 0), onComplete: () => st.s.revert() });
    },
  });
}

// a number's text, with any % set in Inter (.odo__u: Michroma draws % as "o/o")
function paintNumber(el, text) {
  if (!text.includes('%')) { el.textContent = text; return; }
  el.replaceChildren(...text.split(/(%)/).filter(Boolean).map((s) => {
    if (s !== '%') return s;
    const u = document.createElement('span');
    u.className = 'odo__u';
    u.textContent = s;
    return u;
  }));
}
export function countTo(el, to, { decimals = 0, prefix = '', suffix = '', grouping = true, duration = 1.8 } = {}) {
  const n = { v: 0 };
  const fmt = (v) => formatNumber(v, { decimals, prefix, suffix, grouping });
  el.setAttribute('aria-label', fmt(to));
  gsap.to(n, { v: to, duration, ease: 'power3.out', onUpdate: () => paintNumber(el, fmt(n.v)) });
}

// Numbers start when they are in view: wholly on screen, or with their top above the screen's lowest tenth. An
// IntersectionObserver rather than a ScrollTrigger: it follows the number's real box as it changes, so one low on the
// first screen that a reveal is still carrying up into place starts as soon as it gets there, without waiting for a
// scroll.
function whenSeen(el, fn) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const h = e.rootBounds?.height || innerHeight;
      if (!e.isIntersecting || (e.intersectionRatio < 0.98 && e.boundingClientRect.top > h * 0.9)) continue;
      io.disconnect();
      fn();
      return;
    }
  }, { threshold: [0, 0.25, 0.5, 0.75, 0.98] });
  io.observe(el);
}
function counters() {
  for (const el of $$('[data-count]')) {
    const to = parseFloat(el.dataset.count);
    const opts = numberOpts(el);
    whenSeen(el, () => countTo(el, to, opts));
  }
}

// ---- odometers: built at zero, rolled to their value when seen ----
function odometers() {
  for (const el of $$('[data-odometer]')) {
    const to = parseFloat(el.dataset.odometer);
    const opts = numberOpts(el);
    // built now, every column at 0 (the number's own shape), and rolled up when seen
    odometer(el, to, { ...opts, hold: true });
    whenSeen(el, () => odometer(el, to, opts));
  }
}

// ---- marquees: an endless strip, faster (and with you) while the page scrolls ----
function marquees() {
  for (const m of $$('[data-marquee]')) {
    const track = m.firstElementChild;
    if (!track) continue;
    const speed = parseFloat(m.dataset.marquee) || 40;   // px a second
    let x = 0, v = 0, on = false;
    whenVisible(m, (vis) => { on = vis; });
    gsap.ticker.add((t, dt) => {
      if (!on) return;
      const half = track.scrollWidth / 2;
      const kick = lenis ? lenis.velocity : 0;
      v = damp(v, kick * 0.6, 4, dt / 1000);
      x -= (speed + Math.abs(v) * 14) * (dt / 1000) * (m.matches(':hover') ? 0.25 : 1);
      if (-x >= half) x += half;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    });
  }
}

function magnetic() {
  for (const el of $$('[data-magnetic]')) {
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    const k = parseFloat(el.dataset.magnetic) || 0.3;
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * k); y((e.clientY - r.top - r.height / 2) * k); });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' }));
  }
}

function tilt() {
  for (const el of $$('[data-tilt]')) {
    const max = parseFloat(el.dataset.tilt) || 6;
    gsap.set(el, { transformPerspective: 900 });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * max * 2); rx(-((e.clientY - r.top) / r.height - 0.5) * max * 2); });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }
}

function spotlight() {
  for (const el of $$('[data-spotlight]')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }
}
