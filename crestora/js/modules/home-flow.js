// Home #features: the flow. On a wide screen with motion the section pins into one stage (ScrollTrigger, only inside
// gsap.matchMedia('(min-width:1024px) and (prefers-reduced-motion:no-preference)')) and its progress drives it all:
//   - the title shows first, then the six stages, one at a time: the panel's copy swaps with a short masked rise;
//   - the ribbon (js/gl/lanes.js) lights band by band (uBands = p × 6) with the footer's bright reveal front;
//   - Night Bloom's card rides the ribbon's centre line at u = p and crossfades into each stage's state;
//   - the rail is a tablist: aria-selected follows the scroll, click/Enter scrolls to a stage, arrow keys move.
// Deep links to #features land at the start of the pin. Everywhere else (phones, reduced motion, no scripts) the
// section is the stacked list of stage blocks the markup already is, revealed by data-reveal-stagger.
import { gsap, ScrollTrigger, lenis, clamp, damp } from '../core.js';
import { getLanes, flowCentre } from '../gl/lanes.js';

const T = 0.07;      // the first stretch of the pin shows the section's title
const TAIL = 0.05;   // the last holds Afterglow, every band lit
const PIN = 3.4;     // the pin's length, in screen heights
const CARD = { w: 320, h: 282 };

export default function init({ calm, still }) {
  const section = document.getElementById('features');
  if (!section) return;
  const stage = section.querySelector('.home-flow__stage');
  const inner = section.querySelector('.home-flow__inner');
  const rail = section.querySelector('.home-flow__rail');
  const list = section.querySelector('.home-flow__list');
  const tabs = [...rail.querySelectorAll('[role="tab"]')];
  const blocks = [...section.querySelectorAll('.home-flow__block')];
  const riders = [section.querySelector('.home-flow__ride'), ...blocks.map((b) => b.querySelector('.home-flow__card'))];

  // The rail is a tablist driven by the scroll. tabs.js (on this page for the workspace) claims every tablist when it
  // starts and hides the panels it doesn't select; undo that whenever it does, and keep its handlers out (ours run
  // first, in the capture phase, and stop there).
  let cur = -1, selected = 0, landed = false;
  function sync() {
    for (const b of blocks) b.hidden = false;
    const focused = tabs.includes(document.activeElement) ? document.activeElement : null;
    tabs.forEach((t, i) => {
      t.setAttribute('aria-selected', String(i === selected));
      t.tabIndex = (focused ? t === focused : i === selected) ? 0 : -1;
      t.classList.toggle('is-done', i < cur);
    });
  }
  rail.addEventListener('tabs:change', (e) => { if (e.target === rail) sync(); });
  sync();

  if (calm || still || !gsap || !ScrollTrigger) return;
  // the pinned stage needs its ribbon: without WebGL the section stays the stacked list
  getLanes({ calm: false, velocity: () => lenis?.velocity || 0 }).then((lanes) => {
    if (lanes) gsap.matchMedia().add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => pin(lanes));
  });

  function pin(lanes) {
    let alive = true;
    let p = 0, shown = 0, visible = false, push = 0, lastTf = '', lastFill = '';
    const head = section.querySelector('.home-flow__head');

    section.classList.add('is-pinned', 'is-title');
    list.setAttribute('role', 'presentation');
    for (const b of blocks) { b.setAttribute('role', 'tabpanel'); b.setAttribute('aria-labelledby', `flow-tab-${b.dataset.stage}`); }

    const st = ScrollTrigger.create({
      trigger: stage,
      start: 'top top',
      end: () => `+=${Math.round(innerHeight * PIN)}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => progress(self.progress),
    });

    // pin progress → the stage on show
    function progress(P) {
      p = clamp((P - T) / (1 - T - TAIL), 0, 1);
      const k = P < T ? -1 : Math.min(5, Math.floor(p * 6));
      if (k === cur) return;
      cur = k;
      selected = Math.max(0, k);
      section.classList.toggle('is-title', k < 0);
      blocks.forEach((b, i) => { b.classList.toggle('is-current', i === k); b.classList.toggle('is-past', i < k); });
      sync();
    }
    progress(st.progress);

    // every frame while the stage is near the screen: the card rides the ribbon, the ribbon lights, the rail fills
    function frame(time, dtMs) {
      if (!visible) return;
      const dt = Math.min(0.05, (dtMs || 16) / 1000);
      shown = Math.abs(p - shown) < 1e-4 ? p : damp(shown, p, 12, dt);
      const W = stage.clientWidth, H = stage.clientHeight;
      const sx = W / 1600, sy = H / 900;
      const sr = stage.getBoundingClientRect(), ir = inner.getBoundingClientRect();
      const left = ir.left - sr.left, top = ir.top - sr.top;
      const xa = left + CARD.w / 2 + 6, xb = left + ir.width - CARD.w / 2;
      const x = xa + (xb - xa) * shown;
      const yd = flowCentre(x / sx);
      // on a small screen the card keeps clear of the copy above it: it rides lower on the ribbon (still on it)
      const copy = cur < 0 ? head : blocks[cur].querySelector('.home-flow__copy');
      const cr = copy.getBoundingClientRect();
      const cardTop = yd * sy - CARD.h / 2;
      let want = x - CARD.w / 2 < cr.right - sr.left + 24 ? Math.max(0, cr.bottom - sr.top + 28 - cardTop) : 0;
      want = Math.max(0, Math.min(want, H - 16 - (cardTop + CARD.h)));
      push = damp(push, want, 7, dt);
      const tx = (x - left - CARD.w / 2).toFixed(1), ty = (cardTop + push - top).toFixed(1);
      const tf = `translate3d(${tx}px, ${ty}px, 0)`;
      if (tf !== lastTf) { lastTf = tf; for (const el of riders) el.style.transform = tf; }
      const fill = clamp((shown * 6) / 5, 0, 1).toFixed(4);
      if (fill !== lastFill) { lastFill = fill; rail.style.setProperty('--rail', fill); }
      {
        const s = lanes.views.flow.state;
        s.bands = cur < 0 ? 0 : shown * 6;
        s.card.x = x / sx; s.card.y = yd + push / sy; s.card.on = damp(s.card.on, cur < 0 ? 0 : 1, 4, dt);
      }
    }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '200px 0px' });
    io.observe(section);
    gsap.ticker.add(frame);

    lanes.attach('flow', stage, { frame: () => ({ x: 0, y: 0, sx: stage.clientWidth / 1600, sy: stage.clientHeight / 900 }) });

    // ---- the rail: click or Enter scrolls to a stage; arrow keys, Home and End move between the tabs ----
    const yOf = (k) => st.start + (T + ((k + 0.5) / 6) * (1 - T - TAIL)) * (st.end - st.start);
    const go = (y, smooth = true) => {
      if (lenis) lenis.scrollTo(y, { duration: smooth ? 1.3 : 0, immediate: !smooth, easing: (t) => 1 - Math.pow(1 - t, 4) });
      else scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
    };
    const onClick = (e) => {
      const t = e.target.closest('[role="tab"]');
      if (!t) return;
      e.stopPropagation();
      go(yOf(tabs.indexOf(t)));
    };
    const onKey = (e) => {
      const i = tabs.indexOf(document.activeElement);
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (i < 0 || next === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      const t = tabs[(next + tabs.length) % tabs.length];
      tabs.forEach((x) => { x.tabIndex = x === t ? 0 : -1; });
      t.focus();
    };
    const onLeave = (e) => { if (!rail.contains(e.relatedTarget)) sync(); };
    rail.addEventListener('click', onClick, true);
    rail.addEventListener('keydown', onKey, true);
    rail.addEventListener('focusout', onLeave);

    // ---- deep links to #features land at the start of the pin (where the title is) ----
    const home = (path) => path.replace(/index\.html$/, '');
    const onLink = (e) => {
      const a = e.target.closest?.('a[href*="#features"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      const url = new URL(a.href, location.href);
      if (url.hash !== '#features' || home(url.pathname) !== home(location.pathname)) return;
      e.preventDefault();
      go(st.start);
      history.pushState(null, '', '#features');
      if (!section.hasAttribute('tabindex')) section.setAttribute('tabindex', '-1');
      section.focus({ preventScroll: true });
    };
    document.addEventListener('click', onLink, true);
    const first = !landed;
    landed = true;
    if (location.hash === '#features' && first) {
      const land = () => requestAnimationFrame(() => { if (alive) { ScrollTrigger.refresh(); go(st.start, false); } });
      if (document.readyState === 'complete') land(); else addEventListener('load', land, { once: true });
    }

    requestAnimationFrame(() => ScrollTrigger.refresh());

    // leaving the breakpoint (or turning reduced motion on): back to the stacked list
    return () => {
      alive = false;
      io.disconnect();
      gsap.ticker.remove(frame);
      lanes.detach('flow');
      rail.removeEventListener('click', onClick, true);
      rail.removeEventListener('keydown', onKey, true);
      rail.removeEventListener('focusout', onLeave);
      document.removeEventListener('click', onLink, true);
      section.classList.remove('is-pinned', 'is-title');
      list.removeAttribute('role');
      for (const b of blocks) { b.removeAttribute('role'); b.removeAttribute('aria-labelledby'); b.classList.remove('is-current', 'is-past'); }
      for (const el of riders) el.style.transform = '';
      rail.style.setProperty('--rail', '0');
      cur = -1; selected = 0;
      sync();
    };
  }
}
