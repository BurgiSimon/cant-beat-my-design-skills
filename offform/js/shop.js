// The latest edit: tabs that filter the rail (the count rolls to the new number), a rail you can drag, throw, step
// with the arrows or swipe, a progress rule that tracks it, quick add by size, and swatches that recolour the product
// in place (a canvas reads the photo and repaints the garment, leaving its background and shadow alone).
import { calm, fine, gsap, on, emit, odometer } from './core.js';

export function init() {
  const section = document.getElementById('shop');
  const rail = section.querySelector('[data-rail]');
  const cards = [...section.querySelectorAll('.card')];
  const tabs = [...section.querySelectorAll('.shop__tab')];
  const prev = section.querySelector('[data-prev]');
  const next = section.querySelector('[data-next]');
  const bar = section.querySelector('.shop__progress i');

  // ---- counts, from what is actually on the rail ----
  const counts = new Map();
  for (const t of tabs) {
    const n = t.dataset.tab === 'all' ? cards.length : cards.filter((c) => c.dataset.cat === t.dataset.tab).length;
    const el = t.querySelector('[data-count]');
    el.textContent = String(n);
    counts.set(t, { n, odo: odometer(el) });
  }

  // ---- filter ----
  let current = 'all';
  function filter(cat, { focusTab = false } = {}) {
    if (!tabs.some((t) => t.dataset.tab === cat)) cat = 'all';
    for (const t of tabs) {
      const on_ = t.dataset.tab === cat;
      t.setAttribute('aria-selected', String(on_));
      t.tabIndex = on_ ? 0 : -1;
      if (on_) {
        const c = counts.get(t);
        c.odo.scramble();
        requestAnimationFrame(() => c.odo.set(String(c.n)));
        if (focusTab) t.focus();
      }
    }
    if (cat === current) return;
    current = cat;
    emit('shop:filter', cat);
    const show = cards.filter((c) => cat === 'all' || c.dataset.cat === cat);
    const swap = () => {
      for (const c of cards) c.classList.toggle('is-out', !show.includes(c));
      rail.scrollLeft = 0;
      progress();
    };
    if (calm || !gsap) { swap(); return; }
    const visible = cards.filter((c) => !c.classList.contains('is-out'));
    gsap.to(visible, {
      opacity: 0, y: 18, duration: 0.25, ease: 'power2.in', stagger: 0.02,
      onComplete: () => {
        swap();
        gsap.fromTo(show, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06, clearProps: 'opacity,transform' });
      },
    });
  }
  for (const t of tabs) t.addEventListener('click', () => filter(t.dataset.tab));
  section.querySelector('.shop__tabs').addEventListener('keydown', (e) => {
    const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (k) { e.preventDefault(); filter(tabs[(i + k + tabs.length) % tabs.length].dataset.tab, { focusTab: true }); }
    if (e.key === 'Home') { e.preventDefault(); filter(tabs[0].dataset.tab, { focusTab: true }); }
    if (e.key === 'End') { e.preventDefault(); filter(tabs[tabs.length - 1].dataset.tab, { focusTab: true }); }
  });
  tabs.forEach((t, i) => { t.tabIndex = i === 0 ? 0 : -1; });
  on('shop:filter', (cat) => { if (cat !== current) filter(cat); });

  // a search result: show it on the rail
  on('shop:show', (id) => {
    const card = cards.find((c) => c.dataset.id === id);
    if (!card) return;
    setTimeout(() => {
      const r = card.getBoundingClientRect(), rr = rail.getBoundingClientRect();
      rail.scrollTo({ left: rail.scrollLeft + r.left - rr.left - parseFloat(getComputedStyle(section.querySelector('.shop__list')).paddingLeft), behavior: calm ? 'auto' : 'smooth' });
      if (gsap && !calm) gsap.fromTo(card.querySelector('.card__media'), { outline: '3px solid #fe4b1f', outlineOffset: '0px' }, { outlineOffset: '10px', outlineColor: 'rgba(254,75,31,0)', duration: 1.4, delay: 0.6, ease: 'expo.out', clearProps: 'outline,outlineOffset' });
    }, 400);
  });

  // ---- rail: progress, arrows ----
  function progress() {
    const max = rail.scrollWidth - rail.clientWidth;
    const w = rail.scrollWidth ? rail.clientWidth / rail.scrollWidth : 1;
    const p = max > 0 ? rail.scrollLeft / max : 0;
    bar.style.setProperty('--w', Math.min(1, w).toFixed(3));
    bar.style.setProperty('--x', `${(p * (1 / Math.min(1, w) - 1) * 100).toFixed(2)}%`);
    prev.disabled = rail.scrollLeft < 4;
    next.disabled = rail.scrollLeft > max - 4;
  }
  rail.addEventListener('scroll', progress, { passive: true });
  new ResizeObserver(progress).observe(rail);
  progress();
  const step = () => { const c = cards.find((x) => !x.classList.contains('is-out')); return c ? (c.offsetWidth + 20) * (innerWidth >= 1000 ? 2 : 1) : 300; };
  prev.addEventListener('click', () => glide(-step()));
  next.addEventListener('click', () => glide(step()));
  function glide(dx) {
    const to = Math.max(0, Math.min(rail.scrollWidth - rail.clientWidth, rail.scrollLeft + dx));
    if (calm || !gsap) { rail.scrollLeft = to; return; }
    gsap.to(rail, { scrollLeft: to, duration: 1, ease: 'expo.out', overwrite: true });
  }

  // ---- rail: drag and throw (mouse); touch keeps the native swipe ----
  if (fine) {
    let down = false, moved = false, x0 = 0, s0 = 0, lastX = 0, v = 0, lastT = 0, raf = 0;
    rail.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return;
      down = true; moved = false; x0 = lastX = e.clientX; s0 = rail.scrollLeft; v = 0; lastT = performance.now();
      cancelAnimationFrame(raf);
      if (gsap) gsap.killTweensOf(rail);
    });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - x0;
      if (!moved && Math.abs(dx) > 5) { moved = true; rail.classList.add('is-drag'); emit('cursor', 'Drag'); }
      if (!moved) return;
      const now = performance.now();
      v = (e.clientX - lastX) / Math.max(1, now - lastT) * 16; lastX = e.clientX; lastT = now;
      rail.scrollLeft = s0 - dx;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (!moved) return;
      rail.classList.remove('is-drag');
      emit('cursor', '');
      const throwIt = () => { v *= 0.94; rail.scrollLeft -= v; if (Math.abs(v) > 0.4) raf = requestAnimationFrame(throwIt); };
      if (!calm) raf = requestAnimationFrame(throwIt);
    });
    rail.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    rail.addEventListener('dragstart', (e) => e.preventDefault());
  }

  // ---- quick add ----
  section.addEventListener('click', (e) => {
    const b = e.target.closest('.card__size');
    if (!b) return;
    const card = b.closest('.card');
    const sw = card.querySelector('.card__sw[aria-pressed="true"]');
    const img = card.querySelector('.card__media img');
    const canvas = card.querySelector('.card__media canvas');
    emit('bag:add', {
      product: {
        id: card.dataset.id, name: card.dataset.name, price: Number(card.dataset.price), size: b.dataset.size,
        colour: sw?.dataset.colour || '', img: canvas && card.querySelector('.card__media').classList.contains('is-tinted') ? canvas.toDataURL('image/jpeg', 0.8) : img.getAttribute('src'),
      },
      from: b,
    });
    b.classList.add('is-added');
    setTimeout(() => b.classList.remove('is-added'), 1200);
  });

  // ---- swatches: repaint the garment ----
  section.addEventListener('click', (e) => {
    const sw = e.target.closest('.card__sw');
    if (!sw) return;
    const card = sw.closest('.card');
    const all = [...card.querySelectorAll('.card__sw')];
    for (const s of all) s.setAttribute('aria-pressed', String(s === sw));
    const img = card.querySelector('.card__media img');
    img.alt = `${card.dataset.name}, ${sw.dataset.colour.toLowerCase()}`;
    const media = card.querySelector('.card__media');
    if (all.indexOf(sw) === 0) { media.classList.remove('is-tinted'); return; }
    recolour(card, img, sw.dataset.hex).then(() => media.classList.add('is-tinted'));
  });
}

// --- recolouring: the garment is whatever is unlike the background (sampled at the corners); its own light and shade
// are kept and mapped onto the new colour. Each product says what may be repainted, so skin and props stay as they are:
// dark = only the dark, colourless garment; accent = only the coloured parts (a shoe's trims); hue = what shares the
// garment's own hue (read at the middle of the photo); solid = the whole object.
const cache = new WeakMap();
const smoothstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function hueOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
async function recolour(card, img, hex) {
  if (!img.complete || !img.naturalWidth) await new Promise((r) => img.addEventListener('load', r, { once: true }));
  let st = cache.get(img);
  const mode = card.dataset.mode || 'solid';
  if (!st) {
    const w = Math.min(640, img.naturalWidth), h = Math.round(w * img.naturalHeight / img.naturalWidth);
    const src = document.createElement('canvas'); src.width = w; src.height = h;
    const sx = src.getContext('2d', { willReadFrequently: true });
    sx.drawImage(img, 0, 0, w, h);
    const data = sx.getImageData(0, 0, w, h);
    const d = data.data;
    const pick = [];
    for (const [cx, cy] of [[4, 4], [w - 5, 4], [4, h - 5], [w - 5, h - 5]]) { const i = (cy * w + cx) * 4; pick.push([d[i], d[i + 1], d[i + 2]]); }
    const bg = [0, 1, 2].map((k) => pick.map((p) => p[k]).sort((a, b) => a - b)[1]);
    // the garment's own hue, from the middle of the frame
    let hx = 0, hy = 0;
    for (let y = Math.floor(h * 0.4); y < h * 0.6; y += 3) for (let x = Math.floor(w * 0.35); x < w * 0.65; x += 3) {
      const i = (y * w + x) * 4; const hh = hueOf(d[i], d[i + 1], d[i + 2]) * Math.PI / 180; hx += Math.cos(hh); hy += Math.sin(hh);
    }
    const refHue = (Math.atan2(hy, hx) * 180 / Math.PI + 360) % 360;
    const mask = new Float32Array(w * h), lum = new Float32Array(w * h);
    const ls = [];
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2]) / 255;
      let m = smoothstep(0.06, 0.2, dist);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx ? (mx - mn) / mx : 0;
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (mode === 'dark') m *= (1 - smoothstep(0.42, 0.6, l)) * (1 - smoothstep(0.16, 0.3, sat));
      else if (mode === 'accent') m *= smoothstep(0.3, 0.5, sat);
      else if (mode === 'hue') {
        let dh = Math.abs(hueOf(r, g, b) - refHue); dh = Math.min(dh, 360 - dh);
        m *= (1 - smoothstep(16, 34, dh)) * smoothstep(0.05, 0.12, sat);
      }
      mask[p] = m;
      lum[p] = l;
      if (m > 0.7 && (p & 7) === 0) ls.push(l);
    }
    ls.sort((a, b) => a - b);
    const lo = ls[Math.floor(ls.length * 0.02)] ?? 0, hi = ls[Math.floor(ls.length * 0.98)] ?? 1;
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    canvas.setAttribute('aria-hidden', 'true');
    card.querySelector('.card__media').insertBefore(canvas, img.nextSibling);
    st = { w, h, data, mask, lum, lo, hi, canvas, ctx: canvas.getContext('2d') };
    cache.set(img, st);
  }
  const c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const cl = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  const dark = c.map((v) => v * 0.18), light = c.map((v) => v + (255 - v) * (cl < 0.2 ? 0.3 : 0.5));
  const out = st.ctx.createImageData(st.w, st.h);
  const s = st.data.data, o = out.data;
  const span = Math.max(0.05, st.hi - st.lo);
  const mid = Math.min(0.72, Math.max(0.32, cl * 0.8 + 0.18));
  for (let p = 0, i = 0; p < st.w * st.h; p++, i += 4) {
    const m = st.mask[p];
    o[i + 3] = 255;
    if (m <= 0.002) { o[i] = s[i]; o[i + 1] = s[i + 1]; o[i + 2] = s[i + 2]; continue; }
    // the garment's own shading, re-centred on the new colour's lightness
    const t = Math.min(1, Math.max(0, (st.lum[p] - st.lo) / span));
    for (let k = 0; k < 3; k++) {
      const v = t < mid ? dark[k] + (c[k] - dark[k]) * (t / mid) : c[k] + (light[k] - c[k]) * ((t - mid) / (1 - mid));
      o[i + k] = s[i + k] + (v - s[i + k]) * m;
    }
  }
  st.ctx.putImageData(out, 0, 0);
}
