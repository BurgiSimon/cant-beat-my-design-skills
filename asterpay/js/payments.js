// Payments: a dotted globe of where money goes (arcs leave New York for the world and land with a ping; drag
// it to spin it), and a transfer you can make: pick an amount, then slide to send. Sending fires a bright arc
// to Lisbon, where Maya is.

import { gsap, calm, fine, odometer, whenVisible, damp, clamp, money } from './core.js';

// Land, from Natural Earth's 1:110m outline (public domain, via world-atlas): 240 × 120 cells, one bit each,
// row by row from 90°N and 180°W.
const LAND = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAF//gD//+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP////////8AAAAAAAAAAAMAAAAAAAAAAAAAAAAAAf////////wAA//gB+AAAA/gAAAAAAAAAAAAAAAOf/////////AAAf8AAAAAAAP+AAAAAAAAAAAAAAHvB+/4//////AAAH+AAAAMAAA/4AAAAAAAAAAAAAP/3//gf////+AAAAAAAAf8AD//+AAf+AAAAAAAAA/ux//wAH////AAAAAAAB4AB////zgPsAAAAAAAAA/////8AB///+AAAAAAADwD//////4P8AAAwAfoAA//5+//4D///8AAAADgAD4P/////////8ABgB//9///////8B///8AAAA//gAD///////////9/wP/////////P+A///AAAAH//7////////////////P/////////P/g//wNYAAH////////////////////////////+f/Af/Af4AAP7/////////////////jz/////////v+Af4AP4AB///////////////////gn////////D/+APwAAAAH/P/////////////////AP///////8APyAHwAAAAH/v//////////////7/gAP/8P////8Af/AAAAAAMH/H//////////////z5AAAfgD/////AP/gAAAAAOD+P////////////4APgAAA/AAf////4P/wAAAAAeB+P////////////wAfgAADgAAf///////8AAAAA/B///////////////AfgAAAAAAX/////f/+AAAAB/3///////////////AeAAAAAAAL////////AAAAB/////////////////AMAAAAAAAD///////3AAAAAP////////////////AAAAAAAAAA///////vgAAAAP////////////////gAAAAAAAAAf//////fgAAAAH/////4/////////7AAAAAAAAAAf//////4AAAAAB/////g/////////7AAAAAAAAAAf//////AAAAAA5///zfh/////////jgAAAAAAAAA//////wAAAAAB//9/jPg/////////HwAAAAAAAAAf/////wAAAAAB/5v///wf///////4HAAAAAAAAAAf////+AAAAAAB/hn///w////////4GAAAAAAAAAAf////+AAAAAAB/hPf//w///////5wMAAAAAAAAAAP////8AAAAAAA//2M//4///////84cAAAAAAAAAAH////8AAAAAAAf/wHH/////////w/8AAAAAAAAAAH////wAAAAAAA//wAB/////////4vgAAAAAAAAAAB////gAAAAAAB//+fL/////////8OAAAAAAAAAAAA////AAAAAAAB//////////////8MAAAAAAAAAAAA///ngAAAAAAD//////////////8AAAAAAAAAAAAAf/wDoAAAAAAH//////7///////8AAAAAAAAAAAAAP/wB4AAAAAAP////+/////////wAAAAAAAAAAAAAH/gB4AAAAAAf///////3//////8AAAAAAAAAAAAAD/gH4AAAAAAf/////f/8P/////oAAAAAAAAcAAAAAfx/8AAAAAA//////v/8D////+IAAAAAAAAGAAAAAfx4fwAAAAA//////v/4D/+f/4AAAAAAAAACAAAAAP/wf+AAAAAf/////3/4A/4P+wMAAAAAAAAAAAAAAH/wMmAAAAA//////3/wA/wH/AMAAAAAAAAAAAAAAA/+AAAAAAA//////7+AAfgP/gcAAAAAAAAAAAAAAAD+AAAAAAA///////8AAfAB/gOAAAAAAAAAAAAAAAA+AwAAAAA///////2AAfAB/gPAAAAAAAAAAAAAAAAOH9wAAAAf//////+AAPABvgXAAAAAAAAAAAAAAAAP3/wAAAAP//////8AAPABnA3gAAAAAAAAAAAAAAAD//4AAAAH//////8AAHgBiAngAAAAAAAAAAAAAAAAv/9AAAAH//////4AABgA4BngAAAAAAAAAAAAAAAAP//wAAAB/n////4AABAG4DxAAAAAAAAAAAAAAAAAP//wAAAAgH////wAAAAD4HwAAAAAAAAAAAAAAAAAf//4AAAAAA////wAAAAB8fhQAAAAAAAAAAAAAAAA///4AAAAAA////AAAAAB8//wAAAAAAAAAAAAAAAA///+AAAAAB///+AAAAAA8/+XAAAAAAAAAAAAAAAA////8AAAAA///8AAAAAAefcf+CAAAAAAAAAAAAAB////+AAAAAf//4AAAAAAOPd//jgAAAAAAAAAAAAB/////gAAAAf//4AAAAAAHAeB//QAAAAAAAAAAAAB/////gAAAAP//4AAAAAAD8ABP+cAAAAAAAAAAAAAf////gAAAAP//4AAAAAAA/9gf4HAAAAAAAAAAAAAf////gAAAAP//4AAAAAAAB7ADODgAAAAAAAAAAAAP////AAAAAH//4AAAAAAAAAHjCBgAAAAAAAAAAAAP///+AAAAAP//8MAAAAAAAAPzAAAAAAAAAAAAAAAH///+AAAAAP//8cAAAAAAAB/jgAEAgAAAAAAAAAAH///+AAAAAf//58AAAAAAAD/zgAEBgAAAAAAAAAAA///8AAAAAf//58AAAAAAAH//wAEDgAAAAAAAAAAAf//8AAAAAf//h4AAAAAAAP//4AADAAAAAAAAAAAAf//8AAAAAP//B4AAAAAAB///8AYAAAAAAAAAAAAAf//4AAAAAH//DwAAAAAAH///+AcAAAAAAAAAAAAAf//4AAAAAH//DwAAAAAAH///+AAAAAAAAAAAAAAAf//AAAAAAH//BwAAAAAAH////AAAAAAAAAAAAAAA//8AAAAAAH/8AgAAAAAAH////gAAAAAAAAAAAAAA//8AAAAAAD/8AAAAAAAAD////gAAAAAAAAAAAAAA//8AAAAAAD/8AAAAAAAAD////gAAAAAAAAAAAAAA//4AAAAAAB/4AAAAAAAAD////gAAAAAAAAAAAAAA//wAAAAAAB/wAAAAAAAAB/7//AAAAAAAAAAAAAAA//gAAAAAAA/gAAAAAAAAD+B//AAQAAAAAAAAAAAB//AAAAAAAAQAAAAAAAAABwA/+AAYAAAAAAAAAAAD/+AAAAAAAAAAAAAAAAAAAAAH+AAcgAAAAAAAAAAD/8AAAAAAAAAAAAAAAAAAAAAH8AAPAAAAAAAAAAAD/gAAAAAAAAAAAAAAAAAAAAAAQAAeAAAAAAAAAAAD/gAAAAAAAAAAAAAAAAAAAAAA4AA8AAAAAAAAAAAD/AAAAAAAAAAAAAAAAAAAAAAA4ABwAAAAAAAAAAAD+AAAAAAAAAAAAAAAAAAAAAAAQADwAAAAAAAAAAAD+AAAAAAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAH+AAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAH+AAAAAAAAAAAAAAHAAAAAAAAAAAAAAAAAAAAAAAH4AAAAAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAAAAH4cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAABwAAAAMEAAgAAAAAAAAAAAAAAAAPgAAAAAAAAAAAP8gA///////wAAAAAAAAAAAAAAAfAAAAAAAAAADH//+D////////wAAAAAAAAAAAAAA/gAAAAAADv7////+//////////AAAAAAAAAAHwAH/gAAAAD////////////////////gAAAAABqAP/8r/wAAAAf////////////////////gAAAAH///P////wAAAA////////////////////+AAAAD/////////AAAB/////////////////////wAAAP/////////gACAf/////////////////////wAAD/////////+AAPw//////////////////////8AAAgH////////n5/wf/////////////////////AAAAH//////////4////////////////////////wAAgB///////////////////////////////////+A////////////////////////////////////////AAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const LW = 240; const LH = 120;
const landBits = Uint8Array.from(atob(LAND), (c) => c.charCodeAt(0));
const isLand = (lat, lon) => {
  const x = Math.floor(((lon + 180) / 360) * LW) % LW; const y = Math.min(LH - 1, Math.floor(((90 - lat) / 180) * LH));
  const i = y * LW + x;
  return (landBits[i >> 3] >> (7 - (i & 7))) & 1;
};

const CITIES = {
  'New York': [40.7, -74], London: [51.5, -0.1], Lisbon: [38.7, -9.1], Lagos: [6.5, 3.4], 'São Paulo': [-23.5, -46.6],
  Tokyo: [35.7, 139.7], Mumbai: [19.1, 72.9], Sydney: [-33.9, 151.2], 'Mexico City': [19.4, -99.1], Toronto: [43.7, -79.4],
  Nairobi: [-1.3, 36.8], Singapore: [1.35, 103.8], Zürich: [47.4, 8.5], 'Los Angeles': [34, -118.2], Bogotá: [4.7, -74.1],
};
const HOME = 'New York';
const RAD = Math.PI / 180;
const vec = (lat, lon) => [Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.cos(lon * RAD)];

function slerp(a, b, t) {
  const d = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
  if (d < 1e-6) return a;
  const s = Math.sin(d); const k1 = Math.sin((1 - t) * d) / s; const k2 = Math.sin(t * d) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

function globe(host) {
  const cv = host.querySelector('canvas'); const g = cv.getContext('2d');
  // the dots: a Fibonacci sphere, kept where there is land
  const pts = [];
  const N = 16000;
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N; const r = Math.sqrt(1 - y * y); const th = i * 2.399963229728653;
    const p = [Math.cos(th) * r, y, Math.sin(th) * r];
    const lat = Math.asin(y) / RAD; const lon = Math.atan2(p[0], p[2]) / RAD;
    if (lat > -62 && isLand(lat, lon)) pts.push(p);
  }
  const view = { lon: -38, lat: 18, vlon: 0, drag: null, spin: calm ? 0 : 4 };   // degrees; spin: degrees a second
  let W = 0; let H = 0; let R = 0; let dpr = 1; let cx = 0; let cy = 0;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = host.clientWidth; H = host.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const wide = innerWidth > 760;
    R = Math.min(W, H) * (wide ? 0.4 : 0.42); cx = W * (wide ? 0.57 : 0.5); cy = H * (wide ? 0.44 : 0.47);
  };
  resize();
  new ResizeObserver(resize).observe(host);

  // rotate a unit vector by the view, then project (orthographic)
  let cl = 1; let sl = 0; let cp = 1; let sp = 0;
  const setView = () => { cl = Math.cos(-view.lon * RAD); sl = Math.sin(-view.lon * RAD); cp = Math.cos(view.lat * RAD); sp = Math.sin(view.lat * RAD); };
  const project = (p) => {
    const x1 = p[0] * cl + p[2] * sl; const z1 = -p[0] * sl + p[2] * cl;   // around y (longitude)
    const y2 = p[1] * cp - z1 * sp; const z2 = p[1] * sp + z1 * cp;         // around x (tilt)
    return [cx + x1 * R, cy - y2 * R, z2];
  };

  // arcs: a comet from A to B over the surface, lifted with distance; then a ping at B
  const arcs = []; const pings = [];
  const fire = (from, to, { bright = false, label = '' } = {}) => {
    const a = vec(...CITIES[from]); const b = vec(...CITIES[to]);
    const d = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
    arcs.push({ a, b, lift: 0.06 + d * 0.16, t: 0, dur: 1.1 + d * 0.55, bright, to, label });
  };
  const others = Object.keys(CITIES).filter((c) => c !== HOME);

  let last = performance.now(); let raf = 0; let visible = false; let clock = 0; let nextFire = 0.6;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    if (!view.drag) {
      view.vlon = damp(view.vlon, 0, 2.2, dt);
      view.lon += (view.spin + view.vlon) * dt;
      if (view.target != null) { view.lon = damp(view.lon, view.target, 3, dt); if (Math.abs(view.lon - view.target) < 0.05) view.target = null; }
    }
    setView();
    if (!calm && clock > nextFire) { fire(HOME, others[Math.floor(Math.random() * others.length)]); nextFire = clock + 0.9 + Math.random() * 1.2; }
    draw(dt);
    if (visible && !calm) raf = requestAnimationFrame(frame);
  }
  function draw(dt) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // the planet: a dark disc with an orange rim of light from below
    const body = g.createRadialGradient(cx, cy + R * 0.9, R * 0.1, cx, cy, R * 1.15);
    body.addColorStop(0, 'rgba(120, 30, 14, 0.55)'); body.addColorStop(0.55, 'rgba(26, 14, 14, 0.6)'); body.addColorStop(1, 'rgba(14, 13, 16, 0)');
    g.fillStyle = body; g.beginPath(); g.arc(cx, cy, R * 1.15, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255, 170, 140, 0.16)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    // dots
    for (const p of pts) {
      const [x, y, z] = project(p);
      if (z < -0.05) continue;
      const a = Math.max(0, z) ** 0.6;
      const warm = clamp((y - cy) / R, 0, 1);   // lit from below
      g.fillStyle = `rgba(${Math.round(220 + 35 * warm)}, ${Math.round(214 - 100 * warm)}, ${Math.round(208 - 130 * warm)}, ${(0.18 + 0.62 * a).toFixed(3)})`;
      g.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
    }
    // arcs
    g.lineCap = 'round';
    for (let i = arcs.length - 1; i >= 0; i--) {
      const A = arcs[i]; A.t += dt / A.dur;
      const head = Math.min(1, A.t); const tail = clamp(A.t - 0.45, 0, 1);
      if (tail >= 1) { arcs.splice(i, 1); continue; }
      const STEPS = 40; let prev = null;
      for (let s = 0; s <= STEPS; s++) {
        const k = tail + ((head - tail) * s) / STEPS;
        const v = slerp(A.a, A.b, k); const h = 1 + A.lift * Math.sin(Math.PI * k);
        const q = project([v[0] * h, v[1] * h, v[2] * h]);
        if (prev && q[2] > -0.1 && prev[2] > -0.1) {
          const f = s / STEPS;
          g.strokeStyle = A.bright ? `rgba(255, ${Math.round(150 + 80 * f)}, ${Math.round(120 + 90 * f)}, ${0.15 + 0.85 * f})` : `rgba(255, ${Math.round(110 + 60 * f)}, 80, ${0.08 + 0.6 * f})`;
          g.lineWidth = A.bright ? 1.2 + 2 * f : 0.8 + 1.1 * f;
          g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(q[0], q[1]); g.stroke();
        }
        prev = q;
      }
      if (A.t >= 1 && !A.landed) { A.landed = true; pings.push({ city: A.to, t: 0, bright: A.bright, label: A.label }); }
    }
    // pings
    for (let i = pings.length - 1; i >= 0; i--) {
      const P = pings[i]; P.t += dt / (P.bright ? 3.2 : 1.4);
      if (P.t >= 1) { pings.splice(i, 1); continue; }
      const [x, y, z] = project(vec(...CITIES[P.city]));
      if (z < 0) continue;
      const r = (P.bright ? 26 : 14) * (P.t * 1.6 % 1 + 0.1);
      g.strokeStyle = `rgba(255, 140, 110, ${(1 - P.t) * 0.9})`; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
      g.fillStyle = `rgba(255, 236, 228, ${1 - P.t * 0.6})`; g.beginPath(); g.arc(x, y, P.bright ? 3.2 : 2.2, 0, Math.PI * 2); g.fill();
      if (P.label) {
        const o = Math.min(1, (1 - P.t) * 4) * Math.min(1, P.t * 8);
        g.font = '500 13px Satoshi, system-ui, sans-serif';
        const w = g.measureText(P.label).width + 20;
        g.fillStyle = `rgba(24, 23, 27, ${0.92 * o})`; g.beginPath(); g.roundRect(x + 12, y - 30, w, 26, 13); g.fill();
        g.fillStyle = `rgba(255, 255, 255, ${o})`; g.fillText(P.label, x + 22, y - 12.5);
      }
    }
    // the home city, always marked
    const [hx, hy, hz] = project(vec(...CITIES[HOME]));
    if (hz > 0) {
      g.fillStyle = 'rgba(246, 80, 47, 0.25)'; g.beginPath(); g.arc(hx, hy, 7 + Math.sin(clock * 3) * 1.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff6a45'; g.beginPath(); g.arc(hx, hy, 3, 0, Math.PI * 2); g.fill();
    }
  }
  const kick = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  whenVisible(host, (v) => { visible = v; if (calm) { setView(); draw(0); } else kick(); });
  addEventListener('resize', () => { if (calm) { setView(); draw(0); } });

  // drag to spin (sideways), with a throw
  host.addEventListener('pointerdown', (e) => { view.drag = { x: e.clientX, t: e.timeStamp }; view.target = null; host.setPointerCapture(e.pointerId); });
  host.addEventListener('pointermove', (e) => {
    if (!view.drag) return;
    const dx = e.clientX - view.drag.x; const dtt = Math.max(1, e.timeStamp - view.drag.t);
    view.lon -= dx * 0.35; view.vlon = (-dx * 0.35 * 1000) / dtt * 0.5; view.drag = { x: e.clientX, t: e.timeStamp };
    if (calm) { setView(); draw(0); }
  });
  const release = () => { view.drag = null; };
  host.addEventListener('pointerup', release); host.addEventListener('pointercancel', release);

  return {
    send(label) {
      // turn the globe so New York and Lisbon both face us, then fire
      const target = -42; const turns = Math.round((view.lon - target) / 360);
      view.target = target + turns * 360; view.vlon = 0;
      setTimeout(() => fire(HOME, 'Lisbon', { bright: true, label }), calm ? 0 : 350);
      if (calm) { view.lon = view.target; setView(); draw(0); }
    },
  };
}

export function init() {
  const host = document.querySelector('[data-globe]');
  const G = host ? globe(host) : null;

  const form = document.querySelector('[data-send]');
  if (!form) return;
  const slide = form.querySelector('[data-slide]');
  const amountEl = form.querySelector('[data-send-amount]');
  const eurEl = form.querySelector('[data-send-eur]');
  const timeEl = form.querySelector('[data-send-time]');
  const status = form.querySelector('[data-send-status]');
  const RATE = 0.9231;
  let amount = 240;
  const odo = odometer(amountEl, { value: amount, decimals: 2 });
  const setAmount = (v) => { amount = v; odo.set(v); eurEl.textContent = `€${money(v * RATE)}`; };
  form.querySelectorAll('input[name="amount"]').forEach((r) => r.addEventListener('change', () => setAmount(Number(r.value))));

  let k = 0; let busy = false;
  const setK = (v) => { k = clamp(v, 0, 1); slide.style.setProperty('--k', k.toFixed(4)); };
  const knobW = 52 + 8;
  function complete() {
    if (busy) return;
    busy = true;
    slide.classList.add('is-sending');
    const t = (0.3 + Math.random() * 0.4).toFixed(2);
    setTimeout(() => {
      timeEl.textContent = t;
      slide.classList.add('is-sent');
      status.textContent = `Sent $${money(amount)} to Maya Chen in ${t} seconds.`;
      G?.send(`+€${money(amount * RATE)} · Maya`);
      setTimeout(reset, 3200);
    }, calm ? 0 : 380);
  }
  function reset() {
    slide.classList.add('is-back');
    slide.classList.remove('is-sending', 'is-sent');
    setK(0);
    setTimeout(() => { slide.classList.remove('is-back'); busy = false; }, 700);
  }
  function glideTo(v, done) {
    slide.classList.add('is-back');
    setK(v);
    setTimeout(() => { slide.classList.remove('is-back'); done?.(); }, calm ? 0 : 450);
  }

  // dragging the knob
  let drag = null;
  slide.addEventListener('pointerdown', (e) => {
    if (busy || e.button) return;
    const r = slide.getBoundingClientRect();
    drag = { x0: e.clientX, k0: k, w: r.width - knobW, moved: false };
    slide.setPointerCapture(e.pointerId);
  });
  slide.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    if (Math.abs(dx) > 3) drag.moved = true;
    setK(drag.k0 + dx / drag.w);
  });
  const end = () => {
    if (!drag) return;
    const moved = drag.moved; drag = null;
    if (k > 0.82) glideTo(1, complete);
    else if (moved) glideTo(0);
    else { // a tap: show that it slides
      slide.dataset.tap = '1';
      glideTo(0.18, () => glideTo(0));
    }
  };
  slide.addEventListener('pointerup', end);
  slide.addEventListener('pointercancel', () => { drag = null; glideTo(0); });
  // the keyboard (and assistive tech) sends with Enter or Space, as a button does
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) return;
    if (slide.dataset.tap) { delete slide.dataset.tap; return; }  // the click that follows a tap on the knob
    glideTo(1, complete);
  });
  slide.addEventListener('click', (e) => { if (e.detail > 0 && !slide.dataset.tap) e.preventDefault(); if (e.detail > 0) delete slide.dataset.tap; });
  slide.setAttribute('aria-label', 'Slide to send, or press to send');
}
