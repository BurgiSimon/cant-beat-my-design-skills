// The picker: a line of cards, one per site, each with a still of its hero. Where the cards fit the screen they stand
// in the middle; where they do not, the line is endless: it drifts by itself when the page is left alone, and the
// wheel, a drag or the arrow keys move it. The card under the pointer (or the one with the keyboard's focus) is lit
// and gets a trace in its site's own manner: mist that drifts and parts, a hole torn through the clouds onto a night
// of ASCII. A chosen card opens into its site: it grows to fill the screen and gives way to the colour the site
// paints first, so the site's own entrance carries on from there. On a phone the cards are a strip that a swipe
// moves from one to the next. Without this script the page is still a row of links.

const list = document.querySelector('.list');
const rows = [...list.querySelectorAll('a')];            // one card per site, as the page has them
const ids = rows.map((a) => a.dataset.id);
const cards = [...rows];                                 // every card in the line; the endless line adds copies
const phone = matchMedia('(max-width: 640px)');          // the phone layout: a strip that scrolls and snaps by itself
const calm = new URLSearchParams(location.search).has('reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
const mod = (a, m) => ((a % m) + m) % m;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const inside = (r, p) => p && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
// Hash of an index, 0..1: the same traces on every load.
const rnd = (i) => {
  let t = Math.imul(i + 1, 0x9e3779b9);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// the line: x is where it stands and want where it is going (in cards: 1 is the second card in the middle), v what
// a drag has left it (px a second). spin: see lay(). loop: whether it is endless (the cards do not fit the screen).
const DRIFT = 28;                                        // px a second, when the page is left alone
let loop = false;
let step = 0; let mid = 0; let base = []; let x = Math.min(1, rows.length - 1); let want = x; let v = 0; let spin = 0;
let drifting = false; let down = null; let dragged = false;
let lit = null; let was = -1; let ptr = null; let keys = false;
// the traces (drawn at the foot of this file)
const cv = document.querySelector('.trace'); const g = cv.getContext('2d');
const INK = '244 242 236';
let raf = 0; let last = 0; let clock = 0; let inked = false;
const spot = ids.map(() => null);                        // the card each site's trace is on
const out = ids.map(() => 0);                            // how far each trace has come out, 0 to 1

// ---- the lit card: the one under the pointer or the one with the keyboard's focus, whichever spoke last. On a
// phone it is the card in the middle.
function set(el) {
  if (el === lit) return;
  lit = el; if (el) was = ids.indexOf(el.dataset.id);
  for (const a of cards) a.classList.toggle('is-on', a === el);
  list.classList.toggle('has-on', !!el);
  kick();
}
const under = () => (ptr && document.elementFromPoint(ptr.x, ptr.y)?.closest('.list a')) || null;
const keyed = () => (rows.includes(document.activeElement) && document.activeElement.matches(':focus-visible') ? document.activeElement : null);
const light = () => { if (!phone.matches) set(keys ? keyed() || under() : under() || keyed()); };
const middle = new IntersectionObserver((seen) => { if (phone.matches) for (const e of seen) if (e.isIntersecting) set(e.target); }, { root: list, threshold: 0.6 });
rows.forEach((a) => middle.observe(a));

// ---- the line. While the cards fit the screen they keep their place in the page. When they do not, the line is
// endless: the cards are moved from their place, and copies of them are added until a card can go round from one
// end of the line to the other behind the screen's edges.
function fit() {
  const w = rows[0].offsetWidth; const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
  step = w + gap;
  const wasLoop = loop;
  loop = !phone.matches && rows.length * step - gap > list.clientWidth - 64;
  list.classList.toggle('is-loop', loop);
  if (!loop) {
    for (const a of cards) a.style.transform = '';
    if (wasLoop) { drifting = false; v = 0; }
    return;
  }
  mid = (list.clientWidth - w) / 2;
  while (cards.length < 2 * rows.length || cards.length * step < list.clientWidth + w + step) {
    for (const a of rows) {
      const c = a.cloneNode(true); c.classList.remove('is-on'); c.classList.add('is-copy'); c.tabIndex = -1; c.setAttribute('aria-hidden', 'true');
      c.addEventListener('click', (e) => open(e, c)); list.append(c); cards.push(c);
    }
  }
  base = cards.map((a) => a.offsetLeft);
  lay();
}
// Card i stands in the slots i + spin, modulo the number of cards: in the one of them nearest the middle. spin
// moves every card on by whole sets, which nobody can see; it is how the card that takes the keyboard's focus can
// always be one of the page's own and never a copy.
function lay() {
  const n = cards.length;
  cards.forEach((a, i) => { a.style.transform = `translateX(${(mid + (mod(i + spin - x + n / 2, n) - n / 2) * step - base[i]).toFixed(1)}px)`; });
}

function frame(now) {
  if (phone.matches) { raf = 0; return; }
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; clock += dt;
  if (loop) {
    if (!down) {
      if (drifting && !lit) want += DRIFT * dt / step;                                 // a lit card holds the line still
      if (Math.abs(v) > 4) { want += v * dt / step; v *= Math.exp(-dt * 3.2); } else v = 0;
      x = calm || Math.abs(want - x) < 0.0005 ? want : x + (want - x) * (1 - Math.exp(-dt * 9));
    }
    lay();
  }
  light();
  raf = draw(dt) || (loop && (down || drifting || v || x !== want)) ? requestAnimationFrame(frame) : 0;
}
function kick() { if (!raf && !phone.matches) { last = performance.now(); raf = requestAnimationFrame(frame); } }

// The wheel moves an endless line: sideways always, up and down too unless the page itself has somewhere to scroll.
list.addEventListener('wheel', (e) => {
  if (!loop || e.ctrlKey) return;
  const flat = Math.abs(e.deltaX) > Math.abs(e.deltaY);
  if (!flat && document.documentElement.scrollHeight > innerHeight + 1) return;
  e.preventDefault(); want += (flat ? e.deltaX : e.deltaY) * (e.deltaMode ? 32 : 1) / step; v = 0; kick();
}, { passive: false });

// A drag moves it and lets it run on. (No pointer capture: the click that follows has to reach the card, where a
// click that ends a drag is dropped. A second finger is a pinch, not the drag: the line keeps pinch-zoom.)
list.addEventListener('pointerdown', (e) => { if (!loop || e.button || !e.isPrimary) return; down = { id: e.pointerId, x: e.clientX, t: e.timeStamp }; dragged = false; v = 0; want = x; });
list.addEventListener('dragstart', (e) => e.preventDefault());
const drop = (e) => { if (down?.id !== e.pointerId) return; if (e.timeStamp - down.t > 90) v = 0; down = null; list.classList.remove('is-dragging'); kick(); };
addEventListener('pointermove', (e) => {
  ptr = e.pointerType === 'touch' ? null : { x: e.clientX, y: e.clientY }; keys = false;
  if (down?.id === e.pointerId) {
    const dx = e.clientX - down.x;
    if (e.pointerType === 'mouse' && !e.buttons) drop(e);                              // let go outside the window
    else if (dragged || Math.abs(dx) > 6) {
      dragged = true; list.classList.add('is-dragging');
      x = want = x - dx / step; v = 0.6 * v - 0.4 * dx / Math.max(0.004, (e.timeStamp - down.t) / 1000); down.x = e.clientX; down.t = e.timeStamp;
    }
  }
  light(); kick();
}, { passive: true });
addEventListener('pointerup', drop); addEventListener('pointercancel', drop);
document.documentElement.addEventListener('pointerleave', () => { ptr = null; light(); });

// The arrow keys go from card to card (Enter is the link's own), and on an endless line a card that takes the
// keyboard's focus comes to the middle. Up and down only while the page has nowhere to scroll.
addEventListener('keydown', (e) => {
  const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  if (!d || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/Up|Down/.test(e.key) && document.documentElement.scrollHeight > innerHeight + 1) return;
  e.preventDefault();
  let k = rows.indexOf(document.activeElement);
  if (!loop) k = k < 0 ? (d > 0 ? 0 : rows.length - 1) : mod(k + d, rows.length);
  else { const slot = Math.round(want) + d; k = mod(slot, rows.length); spin = slot - k; want = slot; v = 0; }
  rows[k].focus({ preventScroll: !phone.matches });
});
rows.forEach((a, i) => {
  a.addEventListener('focus', () => {
    if (loop && a.matches(':focus-visible')) { const n = cards.length; want = i + spin + n * Math.round((want - i - spin) / n); v = 0; }
    if (a.matches(':focus-visible')) keys = true;
    light(); kick();
  });
  a.addEventListener('blur', light);
  a.addEventListener('click', (e) => open(e, a));
});

// ---- left alone for a few seconds, an endless line drifts (on a phone: the strip goes on by a card, once, to show
// that it can: a strip that kept turning would carry the card a screen reader is reading out from under it); any
// input hands it back, and so does focus, which VoiceOver moves as it reads
let idle = 0;
const turn = () => rows[(was + 1) % rows.length].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
const wake = () => {
  clearTimeout(idle); drifting = false;
  if (!calm) idle = setTimeout(() => {
    if (loop) { drifting = true; kick(); } else if (phone.matches && !list.contains(document.activeElement)) turn();
  }, 4000);
};
for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'focusin']) addEventListener(type, wake, { passive: true });

// ---- a chosen card opens into its site: a copy of it grows from where the card is until it is the screen, and on
// the way its still gives way to what the site paints first. A click meant for a new tab stays a plain link.
function open(e, a) {
  if (dragged && e.detail) { e.preventDefault(); return; }   // the click that ends a drag (a key's click has no detail)
  if (calm || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  clearTimeout(idle); drifting = false; v = 0; want = x;
  const r = a.getBoundingClientRect(); const page = document.documentElement;
  const o = document.createElement('div'); o.className = 'opener'; o.dataset.id = a.dataset.id;
  Object.assign(o.style, { inset: `${r.top}px ${page.clientWidth - r.right}px ${page.clientHeight - r.bottom}px ${r.left}px`, borderRadius: getComputedStyle(a).borderRadius });
  document.body.append(o); o.getBoundingClientRect();   // laid out where it starts
  Object.assign(o.style, { inset: '0px', borderRadius: '0px' }); o.classList.add('is-grown');
  document.body.classList.add('is-opening');
  setTimeout(() => { location.href = a.href; }, 640);
}

// Shown, or shown again on the way back from a site: the page closed up again, and a card that was only clicked
// let go of.
addEventListener('pageshow', () => {
  document.querySelector('.opener')?.remove(); document.body.classList.remove('is-opening');
  const f = document.activeElement; if (cards.includes(f) && !f.matches(':focus-visible')) f.blur();
  wake(); kick();
});
addEventListener('resize', fit);
// A phone turned from upright to sideways (or back) changes the line's whole manner: what was lit and the idle
// timer belong to the old one, so both start again.
phone.addEventListener('change', () => { set(null); wake(); });
fit();

// ---- traces: what the pointer leaves on the lit card, drawn on one canvas over the line (in the colour of the
// type, so they read as lying under it). For a mouse or a pen; a card lit from the keyboard gets a quiet version
// of its own. Each site's trace draws on the card it is on and says whether it has anything left to draw; a site
// without one simply has none.
const TRACES = {
  // Mist: wisps of mist drift across the foot of the card and part around the pointer as it moves through them.
  mist: (() => {
    const at = { x: 0, y: 0, on: false, part: 0 };
    return {
      reset() { at.on = false; at.part = 0; },
      draw(r, o, on, dt) {
        if (o < 0.01) return false;
        const want_ = on && inside(r, ptr) ? ptr : { x: r.left + r.width * (0.5 + 0.32 * Math.sin(clock * 0.37)), y: r.top + r.height * (0.72 + 0.1 * Math.sin(clock * 0.61)) };
        if (!at.on) { at.x = want_.x; at.y = want_.y; at.on = true; }
        const ease = 1 - Math.exp(-dt * 6);
        at.x += (want_.x - at.x) * ease; at.y += (want_.y - at.y) * ease; at.part += ((on ? 1 : 0) - at.part) * ease;
        within(r);
        const N = 16; const top = r.top + r.height * 0.4; const span = r.bottom - top - 4;
        for (let j = 0; j < N; j++) {
          const f = (j + 0.6 * rnd(j + 20)) / N;                   // 0: the highest wisp, 1: the ones along the foot
          const y0 = top + span * f ** 0.75 + (1 - o) * 22;        // they settle into place as they come out
          const amp = 2 + 5 * f; const sp = 0.3 + 0.4 * rnd(j + 40); const ph = rnd(j + 80) * 6.2832;
          // a wisp is a short run of mist, thickest in its middle, and it drifts on with the air (in card widths)
          const len = 0.14 + 0.24 * rnd(j + 200); const c = mod(rnd(j + 120) * 1.8 + clock * (0.02 + 0.03 * rnd(j + 160)), 1.8) - 0.4;
          if (c + len < 0 || c - len > 1) continue;
          const a = (0.1 + 0.42 * f) * o;
          for (const [lift, k] of [[0, 1], [3.5 + 2 * rnd(j + 240), 0.45]]) {   // two strands, the upper one fainter
            const fade = g.createLinearGradient(r.left, 0, r.right, 0);
            for (const [s, m] of [[c - len, 0], [c - len * 0.3, 1], [c + len * 0.3, 1], [c + len, 0]]) fade.addColorStop(clamp(s, 0, 1), `rgb(${INK} / ${a * k * m})`);
            g.beginPath();
            const from = Math.max(-6, Math.floor((c - len) * r.width / 6) * 6); const to = Math.min(r.width + 6, (c + len) * r.width + 6);
            for (let px = from; px <= to; px += 6) {
              const X = r.left + px;
              let Y = y0 - lift + amp * (0.6 * Math.sin(px * 0.017 + clock * sp + ph) + 0.4 * Math.sin(px * 0.043 - clock * sp * 1.7 + ph * 2));
              const dy = Y - at.y; const d = Math.hypot((X - at.x) * 0.8, dy);
              if (d < 130) Y += Math.sign(dy || 1) * (1 - d / 130) ** 2 * 40 * at.part;   // a hand through mist: it opens round it
              if (px === from) g.moveTo(X, Y); else g.lineTo(X, Y);
            }
            g.strokeStyle = fade; g.stroke();
          }
        }
        g.restore();
        return true;
      },
    };
  })(),

  // Nelson: a hole tears open in the clouds where the pointer is, as the page's own hero tears its paper, and behind
  // it is a night of drifting ASCII cloud, the field the page sets behind "How it works". Its rim scrambles as it
  // goes, the way that field decodes; lit with no pointer on it, the hole wanders.
  nelson: (() => {
    const at = { x: 0, y: 0, on: false };
    const EDGE = Array.from({ length: 44 }, (_, i) => rnd(i + 300));
    const RAMP = [' ', ' ', '·', '.', ':', '-', '~', '=', '+', '*', '#', '%'];
    const SCRAMBLE = [...':-~=+*#%/\\|<>^'];
    const smooth = (t) => t * t * (3 - 2 * t);
    const hash = (i, j) => rnd(Math.imul(i, 73856093) ^ Math.imul(j, 19349663));
    const noise = (px, py) => {
      const i = Math.floor(px); const j = Math.floor(py); const u = smooth(px - i); const w = smooth(py - j);
      const a = hash(i, j); const b = hash(i + 1, j); const c = hash(i, j + 1); const d = hash(i + 1, j + 1);
      return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
    };
    const cloud = (px, py) => 0.6 * noise(px, py) + 0.28 * noise(px * 2.1 + 5.2, py * 2.1 - 1.3) + 0.12 * noise(px * 4.3 - 2.7, py * 4.3 + 8.1);
    const CW = 8; const CH = 14;                                   // a glyph's cell, px
    return {
      reset() { at.on = false; },
      draw(r, o, on, dt) {
        if (o < 0.01) return false;
        const want_ = on && inside(r, ptr) ? ptr : { x: r.left + r.width * (0.5 + 0.24 * Math.sin(clock * 0.43)), y: r.top + r.height * (0.46 + 0.16 * Math.sin(clock * 0.71)) };
        if (!at.on) { at.x = want_.x; at.y = want_.y; at.on = true; }
        const ease = 1 - Math.exp(-dt * 7);
        at.x += (want_.x - at.x) * ease; at.y += (want_.y - at.y) * ease;
        const R = Math.min(118, r.width * 0.27) * o ** 1.5;         // it tears open as the card lights, and closes after
        if (R < 2) return true;
        within(r);
        g.beginPath();
        for (let i = 0; i <= EDGE.length; i++) {
          const a = (i / EDGE.length) * 6.2832; const k = R * (0.9 + 0.13 * EDGE[i % EDGE.length] + 0.04 * Math.sin(a * 3 + 1));
          if (i) g.lineTo(at.x + k * Math.cos(a), at.y + k * Math.sin(a)); else g.moveTo(at.x + k, at.y);
        }
        g.closePath();
        g.fillStyle = `rgb(8 11 18 / ${0.9 * Math.min(1, o * 1.4)})`; g.fill();
        g.save(); g.clip();
        g.font = '500 11px "JetBrains Mono Variable", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const tick = Math.floor(clock * 14);
        for (let cy = Math.floor((at.y - R - r.top) / CH); cy <= Math.ceil((at.y + R - r.top) / CH); cy++) {
          for (let cx = Math.floor((at.x - R - r.left) / CW); cx <= Math.ceil((at.x + R - r.left) / CW); cx++) {
            const X = r.left + cx * CW + CW / 2; const Y = r.top + cy * CH + CH / 2;
            const d = Math.hypot(X - at.x, Y - at.y) / R;
            if (d > 1.05) continue;
            const lv = Math.floor(clamp((cloud(cx * 0.16 + clock * 0.22, cy * 0.27 + clock * 0.05) - 0.3) / 0.46, 0, 0.999) * RAMP.length);
            let ch = RAMP[lv]; let t = lv / (RAMP.length - 1); let alpha = 0.3 + 0.6 * t;
            if (d > 0.74 && rnd(cx * 131 + cy * 977 + tick * 7) < 0.45) { ch = SCRAMBLE[Math.floor(rnd(cx * 31 + cy * 17 + tick) * SCRAMBLE.length)]; alpha = 0.55; t = 0.2; }
            else if (ch === ' ' && rnd(cx * 7 + cy * 1301) < 0.05) { ch = rnd(cx + cy * 3) < 0.5 ? '+' : '·'; t = 0.9; alpha = 0.35 + 0.45 * Math.sin(clock * 3 + rnd(cx * 5 + cy) * 6.28) ** 2; }   // a star in the clear
            if (ch === ' ') continue;
            g.fillStyle = `rgb(${Math.round(244 - 104 * t)} ${Math.round(242 - 46 * t)} ${Math.round(236 + 15 * t)} / ${alpha * o})`;   // from the type's white to Nelson's light blue
            g.fillText(ch, X, Y);
          }
        }
        g.restore();
        g.strokeStyle = `rgb(250 248 242 / ${0.85 * o})`; g.lineWidth = 2; g.stroke(); g.lineWidth = 1;   // the paper's torn edge
        g.restore();
        return true;
      },
    };
  })(),
};

function within(r) { g.save(); g.beginPath(); g.roundRect(r.left, r.top, r.width, r.height, 14); g.clip(); }

function draw(dt) {
  const dpr = Math.min(devicePixelRatio || 1, 2); const W = cv.clientWidth; const H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 1;
  if (inked) g.clearRect(0, 0, W, H);   // only a canvas that was drawn on: a line that just drifts repaints nothing here
  inked = false;
  if (calm || !finePointer()) return false;
  const k = lit ? ids.indexOf(lit.dataset.id) : -1;
  if (k >= 0 && spot[k] !== lit) { spot[k] = lit; out[k] = 0; TRACES[ids[k]]?.reset(); }   // on another card of its site it starts over
  out.forEach((o, i) => { out[i] = o + ((k === i ? 1 : 0) - o) * (1 - Math.exp(-dt * 5)); });
  let busy = false;
  ids.forEach((id, i) => {
    const t = TRACES[id];
    if (t && spot[i] && t.draw(spot[i].getBoundingClientRect(), out[i], k === i, dt)) busy = true;
  });
  inked = k >= 0 || busy;
  return inked;
}
