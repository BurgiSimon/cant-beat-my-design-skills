/* ==========================================================================
   fx/live — small "alive" details and interaction polish

   • tabs     (fine pointer) feature tabs auto-advance every 7s while
              #features is in view, the page is visible and the desktop pill
              exists (≥1100px).
              Progress: a 2px brand-blue line inside the white .tab-pill that
              grows 0→100%, fades as the pill slides on, restarts. Hover over
              the section (or keyboard focus inside it) freezes it; any press
              inside the section, or a keydown on .tabs, stops it for good.
              It tours every tab once and comes to rest back on the first one
              (the design's state), so the copy never keeps changing under
              someone reading it (2.2.2). Touch has no hover to hold it, so
              coarse pointers get no auto-advance at all.
   • chart    (fine pointer) hovering a weekday column highlights that bar
              through APP.drawChart — the blue bar, the dashed guide and the
              label pill glide to it (the pill with a FLIP on its `translate`,
              timed like the guide's own CSS transition); leaving the chart
              restores the current tab's highlight. Tab changes glide too,
              on every device (touch included).
   • leads    every 6–11s while the dashboard card is on screen, "+1,540"
              grows by 1–3 with a tiny upward roll and a soft green flash.
   • export   click: spinner replaces the arrow (1.1s) → "Exported" + drawn
              check (1.8s) → back. The label is found wherever it lives (bare
              text node, or both copies of the cursor module's label roll).
   • form     subscribe error: horizontal shake + red ring; success: the
              chevron gives way to a drawn check while app.js shows "Thanks!".
   • polish   social arrows loop through on hover (second arrow injected);
              the eyebrow dot pulses only while #process is on screen; touch
              screens get designed :active press states instead of the UA tap
              flash (a passive touchstart lets WebKit apply them); the rest is
              pure CSS in live.css.

   Reduced motion: no auto-advance, no counters, no shakes, no loops; state
   changes (export / subscribe / chart highlight) happen instantly.
   Owns: .fx-live-* elements; translate on .pill; .f-form translate (x);
   .c-leads em text + its y/opacity/--fx-flash; .export state classes, label
   text and icon internals; the newsletter button's icon internals.
   ========================================================================== */
(() => {
  const FX = window.FX;
  if (!FX) return;
  const APP = window.APP;
  const root = document.documentElement;
  const log = (where, e) => { try { console.error('[fx:live]', where, e); } catch (_) { /* noop */ } };
  const safe = (where, fn) => function () { try { return fn.apply(this, arguments); } catch (e) { log(where, e); return undefined; } };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const gsap = FX.hasGsap ? FX.gsap : null;
  const REDUCE = !!FX.reduce;
  const NS = 'http://www.w3.org/2000/svg';
  const isMouse = e => !e.pointerType || e.pointerType === 'mouse' || e.pointerType === 'pen';

  // cubic-bezier as an ease function (to run in step with style.css transitions)
  const bezier = (x1, y1, x2, y2) => {
    const f = (t, a, b) => ((1 - 3 * b + 3 * a) * t * t + (3 * b - 6 * a) * t + 3 * a) * t;
    const df = (t, a, b) => 3 * (1 - 3 * b + 3 * a) * t * t + 2 * (3 * b - 6 * a) * t + 3 * a;
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 10; i++) { t = (lo + hi) / 2; if (f(t, x1, x2) < x) lo = t; else hi = t; }
      for (let i = 0; i < 3; i++) { const s = df(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (f(t, x1, x2) - x) / s; }
      return f(Math.min(1, Math.max(0, t)), y1, y2);
    };
  };
  const GLIDE = bezier(0.6, 0.05, 0.2, 1);        // style.css: .guide / .bar transitions

  // nested <svg> drawn inside an existing icon <svg> (shares its box: no layout change)
  const iconLayer = (host, inner) => {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'fx-live-ico');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', '100%');
    s.setAttribute('height', '100%');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    s.innerHTML = inner;
    host.appendChild(s);
    return s;
  };
  const TICK = '<path class="fx-live-tick" d="M5.6 12.6l4.1 4.1L18.6 7.8" pathLength="1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>';

  /* ======================================================================
     TABS — auto-advance + progress line in the pill
     ====================================================================== */
  function initTabs() {
    // a fine pointer only: hovering is how a reader holds the copy still. Touch (and a screen
    // reader's virtual cursor on a tablet) has no such pause, so there the tabs simply wait
    if (REDUCE || !FX.finePointer || !gsap || !APP || typeof APP.selectTab !== 'function' || typeof APP.currentTab !== 'function') return;
    const sec = $('#features'), tabsEl = sec && $('.tabs', sec), pill = tabsEl && $('.tab-pill', tabsEl);
    if (!pill) return;
    const count = (APP.TABS && APP.TABS.length) || $$('.tab', tabsEl).length;
    if (count < 2) return;
    const PERIOD = 7;

    const line = document.createElement('span');
    line.className = 'fx-live-progress';
    line.setAttribute('aria-hidden', 'true');
    pill.appendChild(line);
    // 2D only: a 3D transform would composite the line and, by overlap, promote the
    // tab labels painted above it (their text would lose subpixel AA while it runs)
    gsap.set(line, { scaleX: 0, opacity: 1, force3D: false });

    const mq = matchMedia('(min-width: 1100px)');     // the pill only exists in the desktop composition
    const st = { stopped: false, intro: false, view: false, hover: false, focus: false };
    let run = null, auto = false, steps = 0;
    const live = () => !st.stopped && st.intro && st.view && !document.hidden && mq.matches;
    const update = () => { if (run) run.paused(!(live() && !st.hover && !st.focus)); };

    const cycle = safe('tabs-cycle', () => {
      if (st.stopped) return;
      if (run) run.kill();
      gsap.killTweensOf(line);
      gsap.set(line, { scaleX: 0, opacity: 1, force3D: false });
      run = gsap.to(line, { scaleX: 1, duration: PERIOD, ease: 'none', force3D: false, paused: true, onComplete: advance });
      update();
    });
    const advance = safe('tabs-advance', () => {
      run = null;
      if (st.stopped) return;
      auto = true;
      try { APP.selectTab((APP.currentTab() + 1) % count); } finally { auto = false; }
      // one full tour, back on the first tab: done for good
      if (++steps >= count) { stop(); return; }
      // the full line fades while the pill slides to the next tab, then a fresh cycle starts
      gsap.to(line, { opacity: 0, duration: 0.5, ease: 'power2.out', force3D: false, onComplete: cycle });
    });
    const stop = safe('tabs-stop', () => {
      if (st.stopped) return;
      st.stopped = true;
      if (run) run.kill();
      run = null;
      gsap.killTweensOf(line);
      gsap.to(line, { opacity: 0, duration: 0.4, ease: 'power2.out', force3D: false, onComplete: () => line.remove() });
    });

    tabsEl.addEventListener('click', stop);
    tabsEl.addEventListener('keydown', stop);
    // pressing anywhere in the section (a tap on a touch screen of a hybrid laptop, a click
    // or text selection in the copy) means someone is reading: done for good
    sec.addEventListener('pointerdown', stop, { passive: true });
    sec.addEventListener('pointerenter', e => { if (isMouse(e)) { st.hover = true; update(); } });
    sec.addEventListener('pointerleave', e => { if (isMouse(e)) { st.hover = false; update(); } });
    // a reader's focus inside pauses it; the section itself receiving focus as an anchor
    // target (nav's menu / footer jump, tabindex=-1) is not someone reading a control
    sec.addEventListener('focusin', e => {
      const t = e.target;
      if (t === sec || (t && t.hasAttribute && t.hasAttribute('data-fx-anchor'))) return;
      st.focus = true; update();
    });
    sec.addEventListener('focusout', e => { if (!sec.contains(e.relatedTarget)) { st.focus = false; update(); } });

    const io = new IntersectionObserver(safe('tabs-io', entries => {
      const en = entries[entries.length - 1];
      st.view = en.isIntersecting && en.intersectionRatio >= 0.35;
      update();
    }), { threshold: [0, 0.35, 0.6, 1] });
    io.observe(sec);
    FX.on('visibility', update);
    if (mq.addEventListener) mq.addEventListener('change', update);
    // a change made by someone else (keyboard, app) restarts the count
    FX.on('app:tab', () => { if (!auto && !st.stopped && run) cycle(); });
    FX.once('intro:done', () => { st.intro = true; cycle(); });
  }

  /* ======================================================================
     CHART — hover a weekday to move the highlight there
     ====================================================================== */
  function initChart() {
    if (!APP || typeof APP.drawChart !== 'function' || !APP.TABS) return;
    const chart = $('.chart');
    const bars = chart ? $$('.bar', chart) : [];
    const pill = chart && $('.pill', chart);
    if (!bars.length) return;

    // The label pill. drawChart re-places it with `left` (no transition) one frame
    // later; we FLIP it on `translate` so it glides with the guide. When the app's
    // spot (left of the bar) would cover a low-index bar, the pill floats centred
    // above the bar and the guide instead — a tooltip, not a collision.
    const off = { x: 0, y: 0 };
    let glide = null;
    const applyPill = () => {
      const x = Math.abs(off.x) > 0.01 ? off.x : 0, y = Math.abs(off.y) > 0.01 ? off.y : 0;
      pill.style.translate = x || y ? `${x.toFixed(2)}px ${y.toFixed(2)}px` : '';
    };
    const pillLeft = () => (pill ? parseFloat(getComputedStyle(pill).left) || 0 : 0);
    const restOffset = data => {
      const u = parseFloat(getComputedStyle(pill).getPropertyValue('--u')) || 1;
      const w = pill.offsetWidth / u, h = pill.offsetHeight / u;
      const X = APP.BAR_X || [], W = APP.BAR_W || 35.3, hi = data.hi;
      if (!(hi >= 0 && hi < X.length) || X[hi] - 13 - w >= 6) return { x: 0, y: 0 };
      const barTop = 137 - (data.bars && data.bars[hi] || 0);           // chart: bars sit 51u above its 188u bottom
      const top = Math.min(barTop, 86) - 8 - h;                          // clear of the bar and the guide (87u)
      const left = Math.min(Math.max(6, X[hi] + W / 2 - w / 2), 326 - 6 - w);
      return { x: (left - pillLeft() / u) * u, y: (top - 79) * u };       // relative to the app's spot (top 79u)
    };
    const place = (from, data) => {
      if (!pill || !data) return;
      requestAnimationFrame(safe('pill-place', () => {    // runs after drawChart's own rAF set `left`
        const r = restOffset(data);
        const sx = from + off.x - pillLeft(), sy = off.y;  // where it is now, relative to the new spot
        if (glide) glide.kill();
        glide = null;
        if (REDUCE || !gsap || (Math.abs(sx - r.x) < 0.5 && Math.abs(sy - r.y) < 0.5)) { off.x = r.x; off.y = r.y; applyPill(); return; }
        off.x = sx; off.y = sy;
        applyPill();
        glide = gsap.to(off, { x: r.x, y: r.y, duration: 0.6, ease: GLIDE, onUpdate: applyPill, onComplete: () => { glide = null; } });
      }));
    };

    let hover = -1, restoreT = 0;
    const current = () => APP.TABS[APP.currentTab()] || APP.TABS[0];
    const shown = () => bars.findIndex(b => b.classList.contains('on'));
    const setHover = safe('chart-hover', i => {
      clearTimeout(restoreT);
      if (i === hover) return;
      hover = i;
      const t = current(), hi = i < 0 ? t.hi : i;
      if (shown() === hi) return;
      const from = pillLeft(), data = Object.assign({}, t, { hi });
      APP.drawChart(data);
      place(from, data);
    });

    // hover is for a fine pointer only; the pill's glide on tab changes (below) is for everyone
    if (FX.finePointer) {
      chart.classList.add('fx-live-chart');            // hit columns + overlays click-through (live.css)
      bars.forEach((b, i) => {
        b.setAttribute('data-cursor', 'hover');         // the cursor module opens its ring here
        b.addEventListener('pointerenter', e => { if (isMouse(e)) setHover(i); });
      });
      chart.addEventListener('pointerleave', e => {
        if (!isMouse(e)) return;
        clearTimeout(restoreT);
        restoreT = setTimeout(() => setHover(-1), 90);
      });
    }
    // a tab change redraws the chart: forget the hover, glide the pill along
    FX.on('app:tab', e => { clearTimeout(restoreT); hover = -1; place(pillLeft(), (e && e.data) || current()); });
    // the tooltip offset is in px while the chart scales with --u: re-seat it on resize
    let rz = 0;
    addEventListener('resize', () => {
      if (rz || (!off.x && !off.y && !glide)) return;
      rz = requestAnimationFrame(safe('pill-resize', () => {
        rz = 0;
        const i = shown();
        if (i < 0 || !pill) return;
        if (glide) { glide.kill(); glide = null; }
        const r = restOffset(Object.assign({}, current(), { hi: i }));
        off.x = r.x; off.y = r.y; applyPill();
      }));
    }, { passive: true });
  }

  /* ======================================================================
     LEADS — the "+1,540" ticks up now and then
     ====================================================================== */
  function initLeads() {
    if (REDUCE || !gsap) return;
    const card = $('.c-leads'), em = card && $('em', card);
    if (!em) return;
    const m = /^(\D*)([\d,]+)(.*)$/.exec(em.textContent);
    if (!m) return;
    const pre = m[1], post = m[3];
    let value = parseInt(m[2].replace(/,/g, ''), 10);
    if (!isFinite(value)) return;
    em.classList.add('fx-live-num');
    let visible = false, timer = 0, busy = false, minW = 0;
    // Inter's figures are proportional ("1" is much narrower than "0"): the box
    // only ever grows (min-width in em), so " this month" never steps back and forth
    const widthEm = () => { const cs = getComputedStyle(em); return parseFloat(cs.width) / (parseFloat(cs.fontSize) || 1); };
    const swapText = txt => {
      if (!minW) minW = widthEm();               // the design's own width, measured at rest
      em.textContent = txt;
      em.style.minWidth = '';
      minW = Math.max(minW, widthEm());
      em.style.minWidth = minW.toFixed(4) + 'em';
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = 0;
      if (visible && !document.hidden && !busy) timer = setTimeout(bump, 6000 + Math.random() * 5000);
    };
    const bump = safe('leads-bump', () => {
      timer = 0;
      if (!visible || document.hidden) return;
      busy = true;
      value += 1 + Math.floor(Math.random() * 3);
      const d = Math.max(3, 6 * Math.min(1, FX.unit() || 1));
      gsap.timeline({
        onComplete: () => {
          gsap.set(em, { clearProps: 'transform,opacity' });
          em.style.removeProperty('--fx-flash');
          busy = false;
          schedule();
        },
      })
        .to(em, { y: -d, opacity: 0, duration: 0.26, ease: 'power2.in' })
        .add(() => { swapText(pre + value.toLocaleString('en-US') + post); })
        .fromTo(em, { y: d }, { y: 0, opacity: 1, duration: 0.7, ease: 'expo.out', immediateRender: false })
        .fromTo(em, { '--fx-flash': 0 }, { '--fx-flash': 1, duration: 0.25, ease: 'power1.out', immediateRender: false }, '<')
        .to(em, { '--fx-flash': 0, duration: 1.5, ease: 'power2.inOut' });
    });
    FX.whenVisible(card, v => { visible = v; schedule(); }, '0px');
    FX.on('visibility', schedule);
  }

  /* ======================================================================
     EXPORT — loading → done → back
     ====================================================================== */
  function initExport() {
    const btn = $('.export');
    const icon = btn && btn.querySelector(':scope > svg');
    if (!icon) return;
    iconLayer(icon,
      '<g class="fx-live-spin"><circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" stroke-width="2" opacity=".28"/>' +
      '<path d="M12 4.8a7.2 7.2 0 0 1 7.2 7.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></g>' +
      TICK.replace('fill="none"', 'fill="none" stroke-width="2.2"'));
    btn.classList.add('fx-live-export');

    const sr = document.createElement('span');
    sr.className = 'fx-live-sr';
    sr.setAttribute('role', 'status');
    sr.setAttribute('aria-live', 'polite');
    (btn.parentNode || btn).appendChild(sr);
    const say = t => { sr.textContent = t; };

    // the label: bare text node, or both copies of the cursor module's roll strip
    const labelNodes = () => {
      const copies = $$('.fx-roll__a, .fx-roll__b', btn);
      if (copies.length) return copies;
      return Array.from(btn.childNodes).filter(nd => nd.nodeType === 3 && nd.nodeValue.trim());
    };
    const getLabel = () => { const nd = labelNodes()[0]; return nd ? nd.textContent.trim() : ''; };
    const setLabel = t => labelNodes().forEach(nd => {
      const cur = nd.textContent.trim();
      nd.textContent = cur ? nd.textContent.replace(cur, t) : t;
    });
    const original = getLabel() || 'Export Data';
    btn.dataset.fxLabel = original;

    const later = (ms, fn) => setTimeout(safe('export-step', fn), ms);
    const FADE = REDUCE ? 0 : 170;
    // swap label + state while the button's ink is faded out (color transition in live.css)
    const swap = (fn, next) => {
      btn.classList.add('fx-live-fade');
      later(FADE, () => { fn(); btn.classList.remove('fx-live-fade'); if (next) next(); });
    };
    let busy = false;
    btn.addEventListener('click', safe('export-click', e => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      btn.setAttribute('aria-busy', 'true');
      btn.classList.add('fx-live-busy');
      say('Exporting data…');
      later(1100, () => swap(() => {
        btn.classList.remove('fx-live-busy');
        btn.classList.add('fx-live-done');
        btn.removeAttribute('aria-busy');
        setLabel('Exported');
        say('Data exported');
      }, () => later(1800, () => swap(() => {
        btn.classList.remove('fx-live-done');
        setLabel(btn.dataset.fxLabel || original);
      }, () => { busy = false; later(1500, () => { if (!busy) say(''); }); }))));
    }));
  }

  /* ======================================================================
     NEWSLETTER — error shake + ring, success check
     ====================================================================== */
  function initNewsletter() {
    const form = $('.f-form');
    if (!form) return;
    const btn = $('button', form);
    const icon = btn && btn.querySelector(':scope > svg');
    if (icon) iconLayer(icon, TICK.replace('fill="none"', 'fill="none" stroke-width="2.6"'));
    form.classList.add('fx-live-form');

    let shakeTween = null;
    const shake = safe('form-shake', () => {
      if (REDUCE || !gsap) return;
      const k = Math.min(1, Math.max(0.6, FX.unit() || 1));
      const p = { x: 0 };
      if (shakeTween) shakeTween.kill();
      shakeTween = gsap.to(p, {
        keyframes: { x: [0, -8, 7, -5, 3, 0], easeEach: 'sine.inOut' }, duration: 0.45, ease: 'none',
        onUpdate: () => { form.style.translate = `${(p.x * k).toFixed(2)}px 0px`; },
        onComplete: () => { form.style.translate = ''; },
        onInterrupt: () => { form.style.translate = ''; },
      });
    });
    let errT = 0;
    FX.on('app:subscribe-error', () => {
      form.classList.remove('fx-live-ok');
      form.classList.add('fx-live-err');
      clearTimeout(errT);
      errT = setTimeout(() => form.classList.remove('fx-live-err'), 1400);
      shake();
    });
    FX.on('app:subscribe', () => {
      clearTimeout(errT);
      form.classList.remove('fx-live-err');
      form.classList.add('fx-live-ok');
    });
    // app.js drops .done after 2.6s — the check leaves with it
    new MutationObserver(safe('form-mo', () => {
      if (!form.classList.contains('done') && form.classList.contains('fx-live-ok')) form.classList.remove('fx-live-ok');
    })).observe(form, { attributes: true, attributeFilter: ['class'] });
  }

  /* ======================================================================
     POLISH — the bits CSS can't do alone
     ====================================================================== */
  function initPolish() {
    // social arrows: a second arrow waits bottom-left, the first leaves top-right on hover
    if (FX.finePointer && !REDUCE) {
      let n = 0;
      $$('.f-social a svg').forEach(svg => {
        const use = svg.querySelector('use');
        if (!use) return;
        const twin = use.cloneNode(false);
        twin.setAttribute('class', 'fx-live-twin');
        svg.appendChild(twin);
        n++;
      });
      if (n) root.classList.add('fx-live-social');
    }
    // the ping and the step arc animate registered custom properties (paint-only);
    // unregistered ones would animate discretely (a blink), so they need @property
    const props = !!(window.CSS && typeof CSS.registerProperty === 'function');
    if (props) root.classList.add('fx-live-props');
    // the eyebrow dot pulses only while the black section is on screen
    const eyebrow = $('.process .eyebrow');
    if (eyebrow && !REDUCE && props) FX.whenVisible(eyebrow, v => eyebrow.classList.toggle('fx-live-run', v), '0px');
    // live.css swaps the UA tap flash for real :active press states; WebKit applies :active to
    // a touch only once a touchstart listener exists (passive: scrolling never waits on it)
    if (!FX.finePointer) document.addEventListener('touchstart', () => {}, { passive: true });
  }

  [['tabs', initTabs], ['chart', initChart], ['leads', initLeads], ['export', initExport], ['newsletter', initNewsletter], ['polish', initPolish]]
    .forEach(([name, fn]) => { try { fn(); } catch (e) { log(name, e); } });
  root.classList.add('fx-live');
})();
