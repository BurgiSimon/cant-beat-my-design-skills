/* ==========================================================================
   fx/cursor — custom cursor, magnetic buttons, label roll, card tilt

   • cursor   an 8px dot (instant) + a 36px ring (lags, quickTo .45s power3),
              both white in one mix-blend-mode:difference layer. Hover over
              anything interactive: the ring opens to a translucent disc and
              the dot folds away; press: the ring contracts; text fields: the
              marks hide and the native I-beam returns. Hidden when the pointer
              leaves the window (or sits on the scrollbar), back on return.
   • magnets  .contact .signin .start .export .f-form button .menu-btn lean
              toward the pointer inside their box + a 20px zone (soft-capped),
              their label a little further (parallax). Uses the individual
              `translate` property, so it never fights style.css's
              `transition: transform` on .btn nor anyone else's transform.
   • roll     .contact .signin .start .export .f-form button: the label is a
              clipped two-copy strip that rolls up on hover (.5s power3.out),
              driven by one custom property (--fx-roll) on the strip holder.
              The f-form label span stays app.js's text holder; a
              MutationObserver rebuilds the strip whenever the text changes.
   • tilt     (≥1100px) .media up to 4°, .panel-wrap up to 3°, the side under
              the pointer lifts toward it; .chart-glass counter-drifts ~9px in
              2D for depth. No preserve-3d, so the glass keeps its blur.

   Runs only with a fine hover pointer and without reduced motion; cursor +
   magnets + roll from 1024px, tilt from 1100px, none of it under forced
   colors (the system cursor stays). Touch input: nothing.
   Rects are cached (refreshed on visibility, scroll, resize, refresh, with a
   short TTL while moving) — never read in an animation frame. Every inline
   style written here is removed again once its value is back at rest.

   Owns: .fx-cursor; `translate` on the magnets and their label/lines;
   .fx-roll wrappers + their --fx-roll (the copies' transform); transform on .media,
   .panel-wrap, .chart-glass.
   ========================================================================== */
(() => {
  const FX = window.FX;
  if (!FX) return;
  const root = document.documentElement;
  const log = (where, e) => { try { console.error('[fx:cursor]', where, e); } catch (_) { /* noop */ } };
  if (!FX.hasGsap || !FX.finePointer || FX.reduce) return;

  const gsap = FX.gsap;
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const now = () => performance.now();
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const soft = (v, cap) => (cap > 0 ? cap * Math.tanh(v / cap) : 0);   // linear near 0, eases into the cap
  const r2 = v => Math.round(v * 100) / 100;
  const isMouse = e => !e.pointerType || e.pointerType === 'mouse' || e.pointerType === 'pen';
  const tidy = el => { if (el.style.length === 0 && el.hasAttribute('style')) el.removeAttribute('style'); };   // no empty style="" left at rest

  /* ------------------------------------------------------------------ config */
  const INTERACTIVE = 'a[href], button:not(:disabled), [role="button"], [role="tab"], input[type="submit"], input[type="button"], input[type="reset"], input[type="checkbox"], input[type="radio"], label[for], select, summary, [data-cursor="hover"]';
  const TEXTUAL = 'input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="image"]), textarea, [contenteditable]:not([contenteditable="false"])';
  const ROLL = '.contact, .signin, .start, .export, .f-form button';
  // s: share of the pointer offset the element follows; cap/capY: soft limits (design px);
  // inner: extra share for the label; inner element(s) chosen per magnet
  const MAGNETS = [
    { sel: '.contact', s: 0.3, cap: 10, capY: 7, inner: 0.15, innerCap: 5 },
    { sel: '.signin', s: 0.3, cap: 8, capY: 6, inner: 0.15, innerCap: 4 },
    { sel: '.start', s: 0.3, cap: 10, capY: 7, inner: 0.15, innerCap: 5 },
    { sel: '.export', s: 0.28, cap: 9, capY: 6, inner: 0.15, innerCap: 4 },
    { sel: '.f-form button', s: 0.22, cap: 5, capY: 3, inner: 0.14, innerCap: 3 },          // sits in the white field: small travel
    { sel: '.menu-btn', s: 0.16, cap: 2.5, capY: 2, inner: 0.12, innerCap: 3, lines: true }, // flush in the brand box: the lines do the moving
  ];
  const TILTS = [
    { sel: '.media', max: 4, depth: '.chart-glass', shift: 9 },
    { sel: '.panel-wrap', max: 3 },
  ];
  const PAD = 20;          // magnet zone around the box (design px)
  const TTL = 280;         // ms a cached rect is trusted while the pointer moves
  const RING = { dur: 0.45, ease: 'power3.out' };
  const MAG = { dur: 0.6, ease: 'power3.out' };
  const TILT = { dur: 0.8, ease: 'power3.out' };

  /* ------------------------------------------------------------------ state */
  let dead = false, errors = 0;
  let introDone = !!FX.introDone;
  const on = { cursor: false, tilt: false };       // feature gates (viewport + intro)
  const st = { shown: false, inside: false, hover: false, text: false, down: false };
  let px = -999, py = -999, vw = root.clientWidth, k = 1;
  let rollOn = null, scrollTimer = 0, cur = null, ring = null, dot = null, ringI = null, dotI = null;
  let ringX = null, ringY = null, dotX = null, dotY = null;
  const magnets = [], tilts = [], rolls = new Map();   // rolls: button -> { rolled }
  const dirty = new Set();
  const cleanups = [];

  const teardown = () => {
    if (dead) return;
    dead = true;
    try { root.classList.remove('has-cursor'); } catch (_) { /* noop */ }
    try { if (scrollTimer) clearTimeout(scrollTimer); } catch (_) { /* noop */ }
    cleanups.forEach(fn => { try { fn(); } catch (_) { /* noop */ } });
    try { if (cur) cur.remove(); } catch (_) { /* noop */ }
    magnets.concat(tilts).forEach(it => { try { it.reset(); } catch (_) { /* noop */ } });
    rolls.forEach((state, btn) => { try { if (state.tw) state.tw.kill(); state.p.v = 0; state.rolled = false; const h = holderOf(btn); if (h) setRoll(h, 0); } catch (_) { /* noop */ } });
  };
  // every handler runs through this: errors are logged, a burst of them shuts the module down cleanly
  const safe = (where, fn) => function () {
    if (dead) return undefined;
    try { return fn.apply(this, arguments); } catch (e) { log(where, e); if (++errors > 6) teardown(); return undefined; }
  };
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };

  /* ======================================================================
     LABEL ROLL — build the two-copy strip (runs at script time, before the
     first paint: the strip renders exactly like the bare label at rest)
     ====================================================================== */
  function holderOf(btn) {
    return btn.matches('.f-form button') ? btn.querySelector('span') : btn.querySelector(':scope > .fx-roll');
  }
  function fill(h, text) {
    h.textContent = '';
    const a = document.createElement('span');
    a.className = 'fx-roll__a';
    a.textContent = text;
    const b = document.createElement('span');
    b.className = 'fx-roll__b';
    b.setAttribute('aria-hidden', 'true');
    b.textContent = text;
    h.append(a, b);
  }
  // (re)establishes the strip; leaves foreign markup alone
  function ensureRoll(btn) {
    const form = btn.matches('.f-form button');
    let h = holderOf(btn);
    if (!h) {
      if (form) return null;
      const tn = Array.from(btn.childNodes).find(n => n.nodeType === 3 && n.nodeValue.trim());
      if (!tn) return null;
      h = document.createElement('span');
      h.className = 'fx-roll';
      btn.replaceChild(h, tn);
      fill(h, tn.nodeValue.trim());
    } else {
      h.classList.add('fx-roll');
      const kids = Array.from(h.childNodes);
      const a = h.querySelector(':scope > .fx-roll__a'), b = h.querySelector(':scope > .fx-roll__b');
      if (a && b && kids.length === 2) {
        if (b.textContent !== a.textContent) b.textContent = a.textContent;   // copy follows an in-place text edit
        return h;
      }
      if (!kids.every(n => n.nodeType === 3)) return h;
      fill(h, h.textContent.trim());             // app.js / live swapped the text: rebuild the strip
    }
    // a fresh strip keeps the holder's --fx-roll, so under a hovering pointer it is already rolled
    return h;
  }
  // the roll is one custom property on the holder (cursor.css turns it into the copies'
  // transform); it is removed again at 0, so at rest nothing is set at all
  function setRoll(h, v) {
    if (v > 0) h.style.setProperty('--fx-roll', v.toFixed(4));
    else { h.style.removeProperty('--fx-roll'); tidy(h); }
  }
  function roll(btn, open) {
    const state = rolls.get(btn), h = holderOf(btn);
    if (!state || !h) return;
    state.rolled = open;
    if (state.tw) state.tw.kill();
    state.tw = gsap.to(state.p, {
      v: open ? 1 : 0, duration: 0.5, ease: 'power3.out',
      onUpdate: () => setRoll(h, state.p.v),
      onComplete: () => { setRoll(h, state.p.v); state.tw = null; },
    });
  }

  safe('roll-build', () => {
    const mo = new MutationObserver(safe('roll-observe', records => {
      const btns = new Set();
      records.forEach(r => { const b = (r.target.nodeType === 1 ? r.target : r.target.parentElement); const btn = b && b.closest(ROLL); if (btn && rolls.has(btn)) btns.add(btn); });
      btns.forEach(ensureRoll);
      mo.takeRecords();                          // drop the records of our own rebuild
    }));
    cleanups.push(() => mo.disconnect());
    $$(ROLL).forEach(btn => {
      try {
        if (!ensureRoll(btn)) return;
        rolls.set(btn, { rolled: false, p: { v: 0 }, tw: null });
        mo.observe(btn, { childList: true, characterData: true, subtree: true });
      } catch (e) { log('roll ' + btn.className, e); }
    });
    mo.takeRecords();
  })();

  /* ======================================================================
     SPRINGS — magnets + tilts are driven through proxy objects (quickTo);
     a ticker callback (runs after GSAP's own update) writes each dirty item
     once per frame and drops the inline style once it is back at rest
     ====================================================================== */
  const flush = safe('flush', () => { if (!dirty.size) return; dirty.forEach(it => it.write()); dirty.clear(); });
  gsap.ticker.add(flush);
  cleanups.push(() => gsap.ticker.remove(flush));

  function springs(it, keys, cfg) {
    const mark = () => dirty.add(it);
    it.p = {};
    it.q = {};
    keys.forEach(key => { it.p[key] = 0; it.q[key] = gsap.quickTo(it.p, key, { duration: cfg.dur, ease: cfg.ease, onUpdate: mark, onComplete: mark }); });
    it.to = vals => keys.forEach(key => it.q[key](vals[key] || 0));
  }

  function makeMagnet(el, cfg) {
    const it = { el, cfg, vis: false, on: false, rect: null, readAt: -1 };
    springs(it, ['x', 'y', 'ix', 'iy'], MAG);
    it.inner = () => {
      if (cfg.lines) return Array.from(el.children).filter(n => n.tagName === 'SPAN');
      const h = rolls.has(el) ? holderOf(el) : null;
      return h ? [h] : [];
    };
    it.write = () => {
      const { x, y, ix, iy } = it.p;
      el.style.translate = (x || y) ? `${r2(x)}px ${r2(y)}px` : '';
      const t = (ix || iy) ? `${r2(ix)}px ${r2(iy)}px` : '';
      it.inner().forEach(n => { n.style.translate = t; if (!t) tidy(n); });
      if (!x && !y) tidy(el);
    };
    // rest-state rect: the live box minus our own translate (other modules' transforms count)
    it.read = () => {
      const r = el.getBoundingClientRect();
      it.rect = { l: r.left - it.p.x, t: r.top - it.p.y, w: r.width, h: r.height };
      it.readAt = now();
    };
    it.reset = () => { Object.values(it.q).forEach(q => q.tween.kill()); Object.keys(it.p).forEach(key => { it.p[key] = 0; }); it.on = false; it.write(); };
    return it;
  }

  function makeTilt(el, cfg) {
    const glass = cfg.depth ? el.querySelector(cfg.depth) : null;
    const it = { el, cfg, glass, vis: false, on: false, rect: null, readAt: -1 };
    springs(it, ['rx', 'ry', 'gx', 'gy'], TILT);
    it.write = () => {
      const { rx, ry, gx, gy } = it.p;
      el.style.transform = (rx || ry) ? `perspective(${Math.round(1200 * k)}px) rotateX(${r2(rx)}deg) rotateY(${r2(ry)}deg)` : '';
      if (!rx && !ry) tidy(el);
      if (glass) { glass.style.transform = (gx || gy) ? `translate(${r2(gx)}px, ${r2(gy)}px)` : ''; if (!gx && !gy) tidy(glass); }
    };
    // untransformed layout box (the tilted bounding box would wobble at the edges)
    it.read = () => {
      const op = el.offsetParent;
      if (!op) { it.rect = { l: 0, t: 0, w: 0, h: 0 }; it.readAt = now(); return; }
      const pr = op.getBoundingClientRect();
      it.rect = { l: pr.left + op.clientLeft + el.offsetLeft, t: pr.top + op.clientTop + el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      it.readAt = now();
    };
    it.reset = () => { Object.values(it.q).forEach(q => q.tween.kill()); Object.keys(it.p).forEach(key => { it.p[key] = 0; }); it.on = false; it.write(); };
    return it;
  }

  /* ======================================================================
     CURSOR
     ====================================================================== */
  function buildCursor() {
    cur = document.createElement('div');
    cur.className = 'fx-cursor';
    cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<div class="fx-cursor__ring"><i></i></div><div class="fx-cursor__dot"><i></i></div>';
    document.body.appendChild(cur);
    ring = cur.firstChild; dot = cur.lastChild;
    ringI = ring.firstChild; dotI = dot.firstChild;
    gsap.set([ring, dot], { x: -999, y: -999, force3D: true });
    ringX = gsap.quickTo(ring, 'x', { duration: RING.dur, ease: RING.ease });
    ringY = gsap.quickTo(ring, 'y', { duration: RING.dur, ease: RING.ease });
    dotX = gsap.quickSetter(dot, 'x', 'px');
    dotY = gsap.quickSetter(dot, 'y', 'px');
  }

  function paint(fast) {
    const d = fast ? 0.28 : 0.5;
    const press = st.down ? 0.85 : 1;
    gsap.to(ringI, {
      scale: (st.text ? 0.4 : st.hover ? 1.6 : 1) * press,
      opacity: st.text ? 0 : 1,
      // hover: the ring melts into a translucent disc (a full-white edge would difference to orange on the blue buttons)
      backgroundColor: st.hover && !st.text ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0)',
      borderColor: st.hover && !st.text ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,1)',
      duration: d, ease: 'power3.out', overwrite: 'auto',
    });
    gsap.to(dotI, {
      scale: st.hover || st.text ? 0 : 1,
      opacity: st.hover || st.text ? 0 : 1,
      duration: st.hover || st.text ? 0.25 : 0.4, ease: 'power3.out', overwrite: 'auto',
    });
  }

  function show() {
    if (st.shown || !on.cursor) return;
    st.shown = true;
    gsap.set(ring, { x: px, y: py });
    ringX(px, px); ringY(py, py);
    dotX(px); dotY(py);
    gsap.to(cur, { opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: true });
    root.classList.add('has-cursor');            // native cursor off only now that ours is live
  }
  function hide() {
    if (!st.shown) return;
    st.shown = false;
    root.classList.remove('has-cursor');
    gsap.to(cur, { opacity: 0, duration: 0.25, ease: 'power2.out', overwrite: true });
  }

  /* hover target: drives the cursor state and the label roll */
  function setTarget(t) {
    const el = t && (t.nodeType === 1 ? t : t.parentElement);
    const text = !!(el && el.closest && el.closest(TEXTUAL));
    const hover = !text && !!(el && el.closest && el.closest(INTERACTIVE));
    if (text !== st.text || hover !== st.hover) { st.text = text; st.hover = hover; paint(false); }
    let r = null;
    if (on.cursor && introDone && el && el.closest) { const b = el.closest(ROLL); if (b && rolls.has(b)) r = b; }
    if (r !== rollOn) { if (rollOn) roll(rollOn, false); rollOn = r; if (r) roll(r, true); }
  }

  /* ======================================================================
     MAGNETS + TILT — evaluated against cached rects
     ====================================================================== */
  function release(it) { if (!it.on) return; it.on = false; it.to({}); }

  function evalMagnets(x, y, fresh) {
    let best = null, bestD = Infinity;
    const pad = PAD * k;
    for (const it of magnets) {
      if (!it.vis || !on.cursor || !introDone) continue;
      if (fresh || !it.rect || now() - it.readAt > TTL) it.read();
      const r = it.rect;
      if (!r.w || !r.h) continue;
      const dx = Math.max(r.l - x, 0, x - (r.l + r.w)), dy = Math.max(r.t - y, 0, y - (r.t + r.h));
      const d = Math.hypot(dx, dy);
      if (d <= pad && d < bestD) { bestD = d; best = it; }
    }
    for (const it of magnets) if (it !== best) release(it);
    if (!best) return;
    const r = best.rect, c = best.cfg;
    const ox = x - (r.l + r.w / 2), oy = y - (r.t + r.h / 2);
    best.on = true;
    best.to({
      x: soft(ox * c.s, c.cap * k), y: soft(oy * c.s, c.capY * k),
      ix: soft(ox * c.inner, c.innerCap * k), iy: soft(oy * c.inner, c.innerCap * k * 0.7),
    });
  }

  function evalTilts(x, y, fresh) {
    for (const it of tilts) {
      if (!it.vis || !on.tilt) { release(it); continue; }
      if (fresh || !it.rect || now() - it.readAt > TTL) it.read();
      const r = it.rect;
      if (!r.w || !r.h || x < r.l || x > r.l + r.w || y < r.t || y > r.t + r.h) { release(it); continue; }
      const nx = clamp((x - (r.l + r.w / 2)) / (r.w / 2), -1, 1), ny = clamp((y - (r.t + r.h / 2)) / (r.h / 2), -1, 1);
      const c = it.cfg, s = (c.shift || 0) * k;
      it.on = true;
      // the side under the pointer lifts toward it; the glass, floating above the plane, drifts the other way
      it.to({ rx: c.max * ny, ry: -c.max * nx, gx: -s * nx, gy: -s * ny });
    }
  }

  function evaluate(fresh) {
    if (!st.inside) return;
    evalMagnets(px, py, fresh);
    evalTilts(px, py, fresh);
  }
  function releaseAll() { magnets.forEach(release); tilts.forEach(release); }
  function staleAll() { magnets.forEach(it => { it.readAt = -1; }); tilts.forEach(it => { it.readAt = -1; }); }

  /* ======================================================================
     EVENTS
     ====================================================================== */
  function leaveWindow() {
    st.inside = false;
    hide();
    releaseAll();
    setTarget(null);
    if (st.down) { st.down = false; paint(true); }
  }
  // a touch on a hybrid device: get out of the way entirely until the mouse is back
  function touched() {
    if (!st.inside && !st.shown) return;
    leaveWindow();
  }

  const onMove = safe('move', e => {
    if (!isMouse(e)) { touched(); return; }
    px = e.clientX; py = e.clientY;
    if (!on.cursor) return;
    if (px >= vw) { leaveWindow(); return; }      // over the page scrollbar: native arrow only
    const first = !st.inside;
    st.inside = true;
    if (st.down && !(e.buttons & 1)) { st.down = false; paint(true); }   // released outside the window
    evaluate(false);                              // layout reads first …
    if (first || !st.shown) { setTarget(e.target); show(); }
    dotX(px); dotY(py);                           // … then writes
    ringX(px); ringY(py);
  });

  const onOver = safe('over', e => { if (isMouse(e) && st.inside) setTarget(e.target); });
  const onDown = safe('down', e => {
    if (!isMouse(e)) { touched(); return; }
    if (e.button !== 0) return;
    st.down = true; paint(true);
  });
  const onUp = safe('up', () => { if (st.down) { st.down = false; paint(true); } });

  // content moving under a still pointer: re-hit-test + re-evaluate a few times a
  // second while scrolling (in a timer task, never inside the scroll frame)
  const scrollTick = safe('scroll-tick', () => {
    scrollTimer = 0;
    if (!st.inside) return;
    setTarget(document.elementFromPoint(px, py));
    evaluate(true);
  });
  const onScroll = safe('scroll', () => {
    staleAll();
    if (st.inside && !scrollTimer) scrollTimer = setTimeout(scrollTick, 110);
  });

  let resizeTimer = 0;
  const measure = safe('measure', () => {
    vw = root.clientWidth;
    k = Math.min(1, Math.max(0.5, FX.unit() || 1));
    staleAll();
  });
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { measure(); sync(); }, 120); };

  const mqCursor = matchMedia('(min-width: 1024px)');
  const mqTilt = matchMedia('(min-width: 1100px)');
  // forced colors (Windows high contrast): those users rely on their system cursor, and a
  // blended white mark is not guaranteed to survive the palette — keep the native one
  const mqForced = matchMedia('(forced-colors: active)');
  const sync = safe('sync', () => {
    on.cursor = mqCursor.matches && !mqForced.matches;
    on.tilt = mqTilt.matches && introDone;
    if (!on.cursor) { leaveWindow(); }
    if (!on.tilt) tilts.forEach(release);
    if (!introDone) magnets.forEach(release);
    staleAll();
  });

  /* ======================================================================
     INIT
     ====================================================================== */
  try {
    measure();
    buildCursor();
    paint(true);

    MAGNETS.forEach(c => $$(c.sel).forEach(el => magnets.push(makeMagnet(el, c))));
    TILTS.forEach(c => $$(c.sel).forEach(el => tilts.push(makeTilt(el, c))));

    // only on-screen items are ever hit-tested
    const items = new Map(magnets.concat(tilts).map(it => [it.el, it]));
    if (items.size) {
      const io = new IntersectionObserver(safe('io', entries => entries.forEach(en => {
        const it = items.get(en.target);
        if (!it) return;
        it.vis = en.isIntersecting;
        it.readAt = -1;
        if (!it.vis) release(it);
      })), { rootMargin: '40px' });
      items.forEach((_, el) => io.observe(el));
      cleanups.push(() => io.disconnect());
    }

    listen(window, 'pointermove', onMove, { passive: true });
    listen(document, 'pointerover', onOver, { passive: true });
    listen(window, 'pointerdown', onDown, { passive: true });
    listen(window, 'pointerup', onUp, { passive: true });
    listen(window, 'pointercancel', onUp, { passive: true });
    listen(window, 'blur', onUp);
    listen(window, 'dragend', onUp);
    // a native drag (a link dragged off) stops pointer events: get out of the way instead of
    // freezing at the drag origin; the next move after the drop brings the cursor back
    listen(document, 'dragstart', safe('drag', leaveWindow));
    listen(root, 'mouseleave', safe('leave', leaveWindow));
    listen(window, 'resize', onResize, { passive: true });
    listen(document, 'visibilitychange', safe('vis', () => { if (document.hidden) { onUp(); leaveWindow(); } }));
    const offScroll = FX.on('scroll', onScroll);
    const offLoad = FX.on('load', measure);
    cleanups.push(offScroll, offLoad);
    if (FX.ScrollTrigger) { FX.ScrollTrigger.addEventListener('refresh', staleAll); cleanups.push(() => FX.ScrollTrigger.removeEventListener('refresh', staleAll)); }
    const watch = (mq, fn) => { if (mq.addEventListener) { mq.addEventListener('change', fn); cleanups.push(() => mq.removeEventListener('change', fn)); } else if (mq.addListener) mq.addListener(fn); };
    watch(mqCursor, sync);
    watch(mqTilt, sync);
    watch(mqForced, sync);

    FX.once('intro:done', safe('intro-done', () => {
      introDone = true; measure(); sync();
      if (st.inside) setTarget(document.elementFromPoint(px, py));   // a pointer resting on a label rolls it now
      evaluate(true);
    }));
    sync();
  } catch (e) {
    log('init', e);
    teardown();                                   // native cursor, untouched page
  }
})();
