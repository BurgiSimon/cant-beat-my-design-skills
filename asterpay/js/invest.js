// Invest: the chart from the left phone, grown up. Four assets, five ranges; switching morphs the line from one
// to the other, the price rolls, and the change turns red when it is down. Point at the plot (or drag a finger
// along it) and a crosshair reads the price on that day; let go and it returns to now, where the last price
// keeps ticking.

import { gsap, ScrollTrigger, calm, odometer, seeded, money, smoothPath, whenVisible } from './core.js';

const ASSETS = {
  AAPL: { name: 'Apple', sym: 'AAPL · Nasdaq', logo: '<svg viewBox="0 0 24 24" width="20" height="20"><use href="#i-apple"/></svg>', price: 231.4, dec: 2, vol: 0.012, pos: 18450, chg: { '1D': 0.42, '1W': 1.8, '1M': 3.9, '1Y': 21.4, ALL: 412 } },
  NVDA: { name: 'NVIDIA', sym: 'NVDA · Nasdaq', logo: 'N', price: 142.18, dec: 2, vol: 0.022, pos: 16820, chg: { '1D': 1.12, '1W': 4.6, '1M': 2.31, '1Y': 118.5, ALL: 2480 } },
  TSLA: { name: 'Tesla', sym: 'TSLA · Nasdaq', logo: 'T', price: 248.9, dec: 2, vol: 0.028, pos: 9850, chg: { '1D': -1.12, '1W': -3.4, '1M': 6.8, '1Y': 34.2, ALL: 1220 } },
  BTC: { name: 'Bitcoin', sym: 'BTC · Crypto', logo: '₿', price: 96412, dec: 0, vol: 0.03, pos: 2410.55, chg: { '1D': 3.2, '1W': 7.9, '1M': 12.4, '1Y': 128, ALL: 9400 } },
};
const RANGES = { '1D': { n: 96, label: 'today' }, '1W': { n: 84, label: 'this week' }, '1M': { n: 90, label: 'this month' }, '1Y': { n: 120, label: 'this year' }, ALL: { n: 120, label: 'all time' } };
const PTS = 120;          // every series is drawn with this many points, so any two can morph
const VW = 800; const VH = 320;

// A seeded walk from start to end (a Brownian bridge), resampled to PTS points.
function series(sym, range) {
  const a = ASSETS[sym]; const r = RANGES[range];
  const rand = seeded([...(sym + range)].reduce((h, c) => h * 31 + c.charCodeAt(0), 7));
  const end = a.price; const start = end / (1 + a.chg[range] / 100);
  const vol = a.vol * (range === 'ALL' ? 2.2 : range === '1Y' ? 1.6 : 1);
  const raw = [0];
  // steps scaled so a range's overall wobble does not depend on how many points it has; a little momentum
  // makes it trend in runs, the way prices do
  const step = 5.5 / Math.sqrt(r.n); let m = 0;
  for (let i = 1; i < r.n; i++) { m = m * 0.55 + (rand() - 0.5) * 2; raw.push(raw[i - 1] + m * step * 0.8 + (rand() < 0.04 ? (rand() - 0.5) * step * 4 : 0)); }
  const last = raw[raw.length - 1];
  const logS = Math.log(start); const logE = Math.log(end);
  const vals = raw.map((w, i) => {
    const t = i / (r.n - 1);
    return Math.exp(logS + (logE - logS) * (range === 'ALL' ? t ** 1.7 : t) + (w - last * t) * vol);
  });
  const out = [];
  for (let i = 0; i < PTS; i++) {
    const f = (i / (PTS - 1)) * (r.n - 1); const k = Math.floor(f); const u = f - k;
    out.push(vals[k] + ((vals[Math.min(k + 1, r.n - 1)] ?? vals[k]) - vals[k]) * u);
  }
  out[PTS - 1] = end;
  return out;
}

function dateAt(range, i) {
  const now = new Date(); const f = 1 - i / (PTS - 1);
  const span = { '1D': 6.5 * 3600e3, '1W': 7 * 86400e3, '1M': 30 * 86400e3, '1Y': 365 * 86400e3, ALL: 5.9 * 365 * 86400e3 }[range];
  const d = new Date(now.getTime() - span * f);
  if (range === '1D') return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (range === '1W') return d.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric' });
  if (range === 'ALL') return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: range === '1Y' ? 'numeric' : undefined });
}

export function init() {
  const root = document.querySelector('[data-chart]');
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const svg = $('.chart__svg'); const line = $('.chart__line'); const glow = $('.chart__glow'); const area = $('.chart__area');
  const plot = $('[data-chart-plot]'); const cross = $('.chart__cross'); const marker = $('.chart__marker'); const tip = $('.chart__tip');
  const gridG = $('.chart__grid');
  for (let i = 1; i <= 3; i++) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', 0); l.setAttribute('x2', VW); l.setAttribute('y1', (VH / 4) * i); l.setAttribute('y2', (VH / 4) * i);
    gridG.append(l);
  }

  let sym = 'NVDA'; let range = '1M';
  let shown = series(sym, range);          // what is on screen (mid-morph too)
  let target = shown;
  const priceOdo = odometer($('[data-chart-price]'), { value: ASSETS[sym].price, prefix: '$', decimals: 2 });

  const scaleOf = (vals) => {
    let lo = Infinity; let hi = -Infinity;
    for (const v of vals) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const pad = (hi - lo) * 0.14 || 1;
    return { lo: lo - pad, hi: hi + pad * 0.6 };
  };
  let sc = scaleOf(shown);
  const xy = (vals, i, s = sc) => [(i / (PTS - 1)) * VW, VH - ((vals[i] - s.lo) / (s.hi - s.lo)) * VH];
  function render(vals) {
    const pts = vals.map((_, i) => xy(vals, i));
    const d = smoothPath(pts, 0.3);
    line.setAttribute('d', d); glow.setAttribute('d', d);
    area.setAttribute('d', `${d}L${VW},${VH + 2}L0,${VH + 2}Z`);
    if (!hovering) placeMarker(PTS - 1);
  }
  function placeMarker(i) {
    const [x, y] = xy(shown, i);
    marker.style.left = `${(x / VW) * 100}%`; marker.style.top = `${(y / VH) * 100}%`;
  }

  // ---- the text around it ----
  function head(value, { instant = false } = {}) {
    const a = ASSETS[sym]; const first = target[0];
    const pct = (value / first - 1) * 100; const abs = value - first;
    priceOdo.set(Math.round(value * 100) / 100, { instant });
    const chip = $('[data-chart-chg]');
    chip.className = `chip ${pct >= 0 ? 'chip--green' : 'chip--red'}`;
    chip.querySelector('svg').style.transform = pct >= 0 ? '' : 'rotate(180deg)';
    chip.querySelector('span').textContent = `${Math.abs(pct).toFixed(2)}%`;
    $('[data-chart-abs]').textContent = `${abs >= 0 ? '+' : '−'}$${money(Math.abs(abs), a.dec)} ${RANGES[range].label}`;
  }
  function setMeta() {
    const a = ASSETS[sym];
    $('[data-chart-name]').textContent = a.name; $('[data-chart-sym]').textContent = a.sym;
    $('[data-chart-logo]').innerHTML = a.logo;
    $('[data-chart-pos]').textContent = `$${money(a.pos)}`;
    $('[data-chart-buy]').textContent = sym === 'BTC' ? 'Bitcoin' : sym;
  }

  // ---- switching ----
  let morph = null;
  function go() {
    const from = shown.slice(); const fromSc = { ...sc };
    target = series(sym, range);
    const toSc = scaleOf(target);
    setMeta(); head(ASSETS[sym].price);
    morph?.kill();
    const m = { t: 0 };
    const step = () => {
      const t = m.t;
      shown = from.map((v, i) => {
        // morph in screen space: each point moves from where it was drawn to where it will be drawn
        const y0 = (v - fromSc.lo) / (fromSc.hi - fromSc.lo); const y1 = (target[i] - toSc.lo) / (toSc.hi - toSc.lo);
        const y = y0 + (y1 - y0) * t;
        return toSc.lo + y * (toSc.hi - toSc.lo);
      });
      sc = toSc; render(shown);
    };
    if (calm || !gsap) { m.t = 1; step(); shown = target.slice(); return; }
    morph = gsap.to(m, { t: 1, duration: 0.9, ease: 'expo.inOut', onUpdate: step, onComplete: () => { shown = target.slice(); render(shown); } });
  }
  function tabs(selector, key, set) {
    const btns = [...root.querySelectorAll(selector)];
    const select = (b, focus) => {
      btns.forEach((x) => { const on = x === b; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
      set(b.dataset[key]); go();
      if (focus) b.focus();
    };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => { if (b.getAttribute('aria-selected') !== 'true') select(b); });
      b.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!d) return;
        e.preventDefault(); select(btns[(i + d + btns.length) % btns.length], true);
      });
    });
  }
  tabs('[data-asset]', 'asset', (v) => { sym = v; });
  tabs('[data-range]', 'range', (v) => { range = v; });

  // ---- reading the chart ----
  let hovering = false;
  const read = (clientX) => {
    const r = plot.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const i = Math.round(f * (PTS - 1));
    const [x, y] = xy(shown, i);
    const px = (x / VW) * 100;
    cross.style.left = `${px}%`;
    tip.style.left = `${Math.min(88, Math.max(12, px))}%`; tip.style.top = `${(y / VH) * 100}%`;
    tip.querySelector('b').textContent = `$${money(shown[i], ASSETS[sym].dec)}`;
    tip.querySelector('small').textContent = dateAt(range, i);
    placeMarker(i);
    head(shown[i], { instant: true });
  };
  plot.addEventListener('pointermove', (e) => { hovering = true; plot.classList.add('is-hover'); read(e.clientX); });
  plot.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { hovering = true; plot.classList.add('is-hover'); read(e.clientX); } });
  const leave = () => { hovering = false; plot.classList.remove('is-hover'); placeMarker(PTS - 1); head(target[PTS - 1]); };
  plot.addEventListener('pointerleave', leave);
  plot.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') leave(); });

  // ---- first look: the line draws itself ----
  setMeta(); render(shown); head(target[PTS - 1], { instant: true });
  if (gsap && ScrollTrigger) {
    gsap.fromTo(svg, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 2, ease: 'power2.inOut', scrollTrigger: { trigger: root, start: 'top 70%', once: true } });
    gsap.from(marker, { scale: 0, duration: 0.6, delay: 1.7, ease: 'back.out(3)', scrollTrigger: { trigger: root, start: 'top 70%', once: true } });
  }

  // ---- and it keeps ticking ----
  if (!calm) {
    let visible = false;
    whenVisible(root, (v) => { visible = v; });
    const rand = seeded(99);
    setInterval(() => {
      if (!visible || hovering || morph?.isActive() || document.hidden) return;
      const a = ASSETS[sym];
      const v = target[PTS - 1] * (1 + (rand() - 0.48) * a.vol * 0.12);
      target[PTS - 1] = v; shown[PTS - 1] = v;
      render(shown); head(v);
    }, 1800);
  }
}
