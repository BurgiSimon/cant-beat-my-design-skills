/* ==========================================================================
   fx/reveals — scroll-driven storytelling
   SplitText line-mask headings, line fade-ups, clip/zoom section reveals,
   weekly-chart + dashboard builds, counters, the statement colour scrub, the
   growth timeline draw, panel-card depth drift, the footer background settle
   and the footer entrance.

   Note on the photo backgrounds: turn.jpg, footer.jpg, statue.jpg and
   panel.jpg carry feathered blur patches baked in under the UI that sits on
   them (the design's glass backdrops / removed text). Anything that moves an
   image relative to its UI exposes those patches, so: no .growth background
   parallax, a very small footer settle, the .media zoom finishes before the
   chart area is uncovered, and the middle dashboard card never drifts.

   Ground rules (see the brief's ownership table):
   - the first viewport (hero, nav, .intro, .logos) belongs to the intro module;
   - never transforms .media, .panel-wrap, .chart-glass, .start, .export;
   - every element ends in exactly its original state (splits are reverted,
     inline props cleared, scrubbed layers return to identity at rest);
   - anything already on screen when we initialise is left untouched.
   ========================================================================== */
(() => {
  const FX = window.FX;
  if (!FX || FX.reduce || !FX.hasGsap || !FX.ScrollTrigger) return;
  const gsap = FX.gsap, ST = FX.ScrollTrigger, Split = FX.SplitText || null;
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const EXPO = 'expo.out';
  let alive = true;
  const fail = (where, e) => console.error('[fx:reveals]', where, e);
  const guard = (where, fn) => function () {
    if (!alive) return undefined;
    try { return fn.apply(this, arguments); } catch (e) { fail(where, e); return undefined; }
  };
  // fully below the fold right now? (anything already visible is never hidden)
  const below = el => !!el && el.getBoundingClientRect().top >= innerHeight;

  /* ---------- rollback registry (used only if init throws half-way) ---------- */
  const rb = { classes: [], texts: [], drops: [] };
  const addCls = (el, c) => { if (el && !el.classList.contains(c)) { el.classList.add(c); rb.classes.push([el, c]); } };

  /* ---------- keyboard safety: focus landing inside a not-yet-revealed block reveals it now ---------- */
  const focusQueue = [];   // [{ root, run }]
  const onFocusReveal = (root, run) => { if (root) focusQueue.push({ root, run }); };
  const once = fn => { let done = false; return function () { if (done) return undefined; done = true; return fn.apply(this, arguments); }; };
  document.addEventListener('focusin', e => {
    if (!alive || !focusQueue.length) return;
    for (let i = focusQueue.length; i--;) {
      const f = focusQueue[i];
      if (f.root.contains(e.target)) { focusQueue.splice(i, 1); try { f.run(); } catch (err) { fail('focus', err); } }
    }
  });

  /* ======================================================================
     TEXT — split into lines, rise / fade them, then revert to pristine markup
     ====================================================================== */
  /* The rendered line structure of a block: the text of every line box, read
     from per-character Range rects (one layout, read once per reveal — never
     per frame). SplitText breaks lines between space-separated words only, so
     copy the browser breaks elsewhere (after the hyphen of "AI-powered" /
     "follow-ups", at an em dash …) would re-wrap while split and jump back
     when reverted. Comparing before/after catches every such case. */
  const rng = document.createRange();
  function lineTexts(el) {
    const lines = [];
    let cur = '', lastTop = null, lastH = 0;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const t = n.data;
      for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (/\s/.test(ch)) { cur += ' '; continue; }
        rng.setStart(n, i); rng.setEnd(n, i + 1);
        const r = rng.getBoundingClientRect();
        if (!r.height) continue;
        if (lastTop !== null && Math.abs(r.top - lastTop) > Math.min(r.height, lastH) * 0.5) { lines.push(cur); cur = ''; }
        lastTop = r.top; lastH = r.height; cur += ch;
      }
    }
    lines.push(cur);
    return lines.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  }
  function splitLines(el, mask) {
    if (!Split || !el || !el.textContent.trim()) return null;
    const before = lineTexts(el);
    // headings: SplitText hides the line wrappers from AT and labels the heading;
    // innerText turns <br> into a break (SplitText's own label would glue the words).
    // Paragraphs can't carry a label (not announced on <p>), so their lines stay plain DOM text.
    const label = mask ? (el.innerText || el.textContent).replace(/\s+/g, ' ').trim() : '';
    const s = Split.create(el, { type: 'lines', linesClass: 'rv-line', mask: mask ? 'lines' : false, aria: mask ? 'auto' : 'none' });
    if (!s.lines.length || lineTexts(el) !== before) { s.revert(); return null; }   // fall back to a whole-block rise
    if (label) el.setAttribute('aria-label', label);
    // SplitText's masks clip at the line box (overflow: clip), which cuts the serif's
    // ascenders/descenders (line-height ≈ 1em) until the revert pops them back. Clip with
    // a clip-path that reaches .3em past the box instead: same box, nothing cut at rest.
    // (Styled inline via s.masks: SplitText derives the mask class name in its own way.)
    (s.masks || []).forEach(m => { m.style.overflow = 'visible'; m.style.clipPath = 'inset(-.3em -.3em -.3em -.3em)'; });
    return s;
  }

  /* parts: [{ el, kind, at }]
       head  -> masked line rise (yPercent)
       body  -> per-line fade + small rise
       rise  -> whole element fade + rise (element is ours to transform)
       fade  -> opacity only (element is transformed by another module)
     Returns { tl, finish } — finish() jumps to the final, pristine state. */
  function playText(parts, quick, onDone) {
    const splits = [], clear = [];
    let finished = false;
    const cleanup = () => {
      if (finished) return; finished = true;
      splits.forEach(([s, el, label]) => {
        try { s.revert(); } catch (e) { fail('revert', e); }
        if (label === null) el.removeAttribute('aria-label'); else el.setAttribute('aria-label', label);   // exactly as it was
      });
      clear.forEach(([el, props]) => gsap.set(el, { clearProps: props }));
      if (onDone) onDone();
    };
    const tl = gsap.timeline({ onComplete: guard('text-done', cleanup) });
    parts.forEach(({ el, kind, at = 0 }) => {
      if (!el) return;
      if (kind === 'head' || kind === 'body') {
        const label = el.getAttribute('aria-label');
        const s = splitLines(el, kind === 'head');
        gsap.set(el, { opacity: 1 });
        if (s) {
          splits.push([s, el, label]); clear.push([el, 'opacity']);
          if (kind === 'head') {
            // park each line fully below its mask (.rv-line-mask reaches .3em past the line box
            // so ascenders/descenders are never cut at rest): line box + .62em clears the tallest glyph
            const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
            tl.fromTo(s.lines, { y: (i, line) => line.offsetHeight + fs * 0.62 }, { y: 0, duration: quick ? 0.8 : 1.25, ease: EXPO, stagger: quick ? 0.06 : 0.09 }, at);
          } else {
            tl.fromTo(s.lines, { y: quick ? 10 : 14, opacity: 0 }, { y: 0, opacity: 1, duration: quick ? 0.75 : 1.15, ease: 'power3.out', stagger: quick ? 0.04 : 0.07 }, at);
          }
          return;
        }
        clear.push([el, 'opacity,transform']);
        tl.fromTo(el, { y: quick ? 10 : 14, opacity: 0 }, { y: 0, opacity: 1, duration: quick ? 0.75 : 1.15, ease: EXPO }, at);
      } else if (kind === 'rise') {
        clear.push([el, 'opacity,transform']);
        tl.fromTo(el, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: EXPO }, at);
      } else {
        clear.push([el, 'opacity']);
        tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 1.1, ease: 'power2.out' }, at);
      }
    });
    return { tl, finish: () => { tl.kill(); cleanup(); } };
  }

  /* one-shot text block revealed when its trigger reaches `start` */
  function textOnEnter(trigger, parts, start = 'top 85%', focusRoot = null) {
    if (!below(trigger)) return;
    parts.forEach(({ el }) => { if (el) gsap.set(el, { opacity: 0 }); });
    const run = once(guard('text', () => playText(parts, false)));
    ST.create({ trigger, start, once: true, onEnter: run });
    onFocusReveal(focusRoot, run);
  }

  /* ======================================================================
     COUNTERS — count up from 0 keeping prefix/suffix; width is locked so
     nothing around the number moves while digits change
     ====================================================================== */
  const pendingCounters = new Set();
  /* sr: the counting digits are aria-hidden and a visually-hidden copy carries
     the real value, so assistive tech never reads "0+" while a number waits
     below the fold (only for elements nobody else reads: app.js parses the
     dashboard value's textContent, so that one counts as bare text) */
  function makeCounter(el, align, sr) {
    const full = el.textContent.trim();
    const m = full.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(\D*)$/);
    if (!m) return null;
    const pre = m[1], suf = m[3], comma = m[2].indexOf(',') > -1, to = parseFloat(m[2].replace(/,/g, ''));
    const fmt = v => pre + (comma ? Math.round(v).toLocaleString('en-US') : String(Math.round(v))) + suf;
    let tw = null, vis = el;
    const show = txt => { vis.textContent = txt; };
    const api = {
      arm() {   // measure the final text, lock its box, show 0
        el.style.minWidth = ''; el.textContent = full; vis = el;
        el.style.minWidth = el.getBoundingClientRect().width.toFixed(2) + 'px';
        el.style.textAlign = align;
        if (sr) {
          el.textContent = '';
          vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true');
          const hid = document.createElement('span'); hid.className = 'rv-sr'; hid.textContent = full;
          el.append(vis, hid);
        }
        show(fmt(0));
      },
      release(restore) {
        if (tw) { tw.kill(); tw = null; }
        el.textContent = restore ? full : vis.textContent; vis = el;
        el.style.minWidth = ''; el.style.textAlign = '';
      },
      play(delay = 0, dur = 1.8) {
        const o = { v: 0 };
        tw = gsap.to(o, {
          v: to, duration: dur, delay, ease: 'power3.out',
          onUpdate: () => show(fmt(o.v)),
          onComplete: () => { tw = null; api.release(true); },
        });
        return tw;
      },
      el, full,
    };
    rb.texts.push([el, full]);
    return api;
  }

  /* ======================================================================
     CLIP REVEAL — section opens from an inset, rounded frame while it
     enters; forward-only (once open it stays open, clip-path back to none)
     ====================================================================== */
  function clipReveal(sec, end = 'top 55%') {
    if (!sec || !below(sec)) return;
    let iv = 0, ih = 0, rr = 0, done = false;
    const measure = () => {
      const desk = FX.isDesktop();
      iv = Math.min(sec.offsetHeight, innerHeight) * (desk ? 0.07 : 0.045);
      ih = sec.offsetWidth * (desk ? 0.05 : 0.035);
      rr = (desk ? 18 : 12) * FX.unit();
    };
    const render = k => {   // k: 1 = fully inset, 0 = open
      if (k <= 0.0005) { sec.style.clipPath = ''; return; }
      sec.style.clipPath = `inset(${(iv * k).toFixed(2)}px ${(ih * k).toFixed(2)}px round ${(rr * k).toFixed(2)}px)`;
    };
    measure(); render(1);
    const o = { p: 0 };
    gsap.to(o, {
      p: 1, ease: 'power1.out',
      scrollTrigger: {
        trigger: sec, start: 'top bottom', end, scrub: 0.8,
        onRefresh: guard('clip-refresh', () => { if (!done) { measure(); render(1 - o.p); } }),
      },
      onUpdate: guard('clip', () => { if (!done) render(1 - o.p); }),
      onComplete: guard('clip-done', function () {
        done = true; render(0);
        const st = this.scrollTrigger;
        if (st) gsap.delayedCall(0, () => st.kill(false));   // false: keep the finished state (no revert)
      }),
    });
  }

  /* ======================================================================
     IMAGE LAYER — the section's background on a pseudo-element that drifts
     and breathes with scroll. shape(progress) -> [yPercent, scale]; the
     layer is exact identity whenever the section is off-screen and at the
     rest position defined by the shape.
     ====================================================================== */
  function bgLayer(sec, shape, end = 'bottom top') {
    if (!sec) return;
    addCls(sec, 'rv-bg');
    let on = false, live = false;
    const put = (y, s) => { sec.style.setProperty('--rv-by', y.toFixed(3) + '%'); sec.style.setProperty('--rv-bs', s.toFixed(4)); };
    const apply = guard('bg', self => {
      if (!self.isActive) {
        if (on) { on = false; put(0, 1); }
        if (live) { live = false; sec.classList.remove('rv-live'); }
        return;
      }
      on = true;
      const [y, s] = shape(self.progress);
      const want = s > 1.004;           // promote only while noticeably transformed
      if (want !== live) { live = want; sec.classList.toggle('rv-live', live); }
      put(y, s);
    });
    ST.create({ trigger: sec, start: 'top bottom', end, onUpdate: apply, onToggle: apply, onRefresh: apply });
  }

  /* ======================================================================
     FEATURES — tab copy, feature list, weekly chart
     ====================================================================== */
  function setupFeatures() {
    const h = $('.tab-copy h2'), p = $('.tab-copy p');
    const lis = $$('.feat-list li');
    const feat = $('.features');
    const copy = { state: 'done', run: null, swaps: 0, fallback: 0 };
    const pendingLis = new Set(lis.filter(below));

    if (h && below(h)) {
      copy.state = 'pending';
      gsap.set([h, p], { opacity: 0 });
      ST.create({
        trigger: h, start: 'top 85%', once: true,
        onEnter: guard('copy', function enter() {
          // app.js is about to swap this copy (a tab was picked while it was hidden): wait for it
          if (copy.swaps > 0) { setTimeout(guard('copy', enter), 60); return; }
          copy.state = 'running';
          copy.run = playText([{ el: h, kind: 'head' }, { el: p, kind: 'body', at: 0.3 }], false, () => { copy.state = 'done'; copy.run = null; });
        }),
      });
    }

    if (pendingLis.size) {
      const items = [...pendingLis];
      gsap.set(items, { opacity: 0, y: 12 });
      ST.batch(items, {
        start: 'top 92%', once: true, interval: 0.08,
        onEnter: guard('list', batch => {
          batch.forEach(li => pendingLis.delete(li));
          gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: EXPO, stagger: 0.08, overwrite: true, clearProps: 'opacity,transform' });
        }),
      });
    }

    /* tab change: app.js fades .tab-copy/.feat-list out (.swap-out), swaps the
       copy 220ms later in a timer task of its own and fades back in; we ride on
       that with a quick line rise. The swap is caught by a MutationObserver —
       its callback is a microtask right after app.js's task, i.e. before the
       next paint — so the new copy is never painted unsplit. Every app:tab is
       followed by exactly one swap; with several tab changes in flight only
       the last swap starts the rise (an earlier one would be overwritten).
       Our own split/revert mutations happen while no swap is pending (or are
       flushed with takeRecords) and are ignored. */
    let featH = feat ? feat.offsetHeight : 0;
    ST.addEventListener('refresh', () => { if (alive && feat) featH = feat.offsetHeight; });
    const swapIn = guard('tab-in', () => {
      copy.swaps = 0; clearTimeout(copy.fallback);
      if (copy.state === 'pending') return;     // the entrance (still to come) shows the new copy
      if (copy.run) copy.run.finish();
      copy.state = 'running';
      copy.run = playText([{ el: h, kind: 'head' }, { el: p, kind: 'body', at: 0.1 }], true, () => { copy.state = 'done'; copy.run = null; });
      const ready = lis.filter(li => !pendingLis.has(li));
      if (ready.length) gsap.fromTo(ready, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out', stagger: 0.05, delay: 0.05, overwrite: true, clearProps: 'opacity,transform' });
      // reflow layout: new copy can change the section height -> re-measure triggers below
      if (feat && !FX.isDesktop()) {
        const nh = feat.offsetHeight;
        if (Math.abs(nh - featH) > 1) { featH = nh; ST.refresh(); }
      }
    });
    const mo = new MutationObserver(guard('tab-swap', () => {
      if (copy.swaps > 0 && --copy.swaps === 0) swapIn();
    }));
    [h, p].forEach(el => { if (el) mo.observe(el, { childList: true }); });
    FX.on('app:tab', guard('tab', () => {
      if (copy.run) copy.run.finish();          // settle the outgoing copy (restores its markup)…
      mo.takeRecords();                         // …and drop the records of that revert
      copy.swaps++;
      clearTimeout(copy.fallback);              // safety net, should app.js ever not swap
      copy.fallback = setTimeout(guard('tab-fallback', () => { if (copy.swaps) swapIn(); }), 600);
    }));

    setupMedia();
  }

  function setupMedia() {
    const media = $('.media');
    if (!media || !below(media)) return;
    const chart = $('.chart', media), bars = $$('.bar', media), days = $$('.day', media);
    const pill = $('.pill', media), guide = $('.guide', media);
    addCls(media, 'rv-bg');
    gsap.set(media, { clipPath: 'inset(100% 0% 0% 0%)', '--rv-bs': 1.16 });
    if (chart) gsap.set(chart, { opacity: 0, y: 18 });
    gsap.set(bars, { scaleY: 0, transformOrigin: '50% 100%' });
    gsap.set(days, { opacity: 0, y: 6 });
    // the pill pops through the CSS `scale` property (via a custom property): GSAP transforms
    // would fold live.js's `translate` (its label FLIP) into the transform and wipe it on clear
    if (pill) { addCls(pill, 'rv-pop'); gsap.set(pill, { opacity: 0, '--rv-ps': 0.9 }); }
    if (guide) gsap.set(guide, { scaleX: 0, transformOrigin: '0% 50%' });

    ST.create({
      trigger: media, start: 'top 68%', once: true,
      onEnter: guard('media', () => {
        const tl = gsap.timeline({
          onComplete: guard('media-done', () => {
            media.classList.remove('rv-bg');
            media.style.removeProperty('--rv-bs');
            gsap.set(media, { clearProps: 'clipPath' });
            if (chart) gsap.set(chart, { clearProps: 'opacity,transform' });
            gsap.set(bars, { clearProps: 'transform,transformOrigin' });
            gsap.set(days, { clearProps: 'opacity,transform' });
            if (pill) { pill.classList.remove('rv-pop'); pill.style.removeProperty('--rv-ps'); gsap.set(pill, { clearProps: 'opacity' }); }
            if (guide) gsap.set(guide, { clearProps: 'transform,transformOrigin' });
          }),
        });
        tl.to(media, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.35, ease: 'expo.inOut' }, 0)
          .to(media, { '--rv-bs': 1, duration: 2.1, ease: EXPO }, 0.2);
        if (chart) tl.to(chart, { opacity: 1, y: 0, duration: 1.1, ease: EXPO }, 0.65);
        tl.to(bars, { scaleY: 1, duration: 1.2, ease: EXPO, stagger: 0.06 }, 0.95)
          .to(days, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.04 }, 1.05);
        if (guide) tl.to(guide, { scaleX: 1, duration: 1.1, ease: 'expo.inOut' }, 1.2);
        if (pill) tl.to(pill, { opacity: 1, '--rv-ps': 1, duration: 0.8, ease: EXPO }, 1.5);
      }),
    });
  }

  /* ======================================================================
     GROWTH — clip + image layer, heading, lede, dashboard panel, timeline
     ====================================================================== */
  let viewTouched = false, valueCounter = null;
  function setupGrowth() {
    const sec = $('.growth');
    if (!sec) return;
    clipReveal(sec);
    // No background parallax here: turn.jpg carries baked, feathered blur patches exactly
    // under the dashboard panel, the "High-Value Leads" label and the Start button (the
    // design's glass backdrops). Any drift/zoom slides those grey patches out from behind
    // the UI. Depth comes from the panel cards' differential drift instead.

    const h = $('h2', sec);
    if (h) textOnEnter(h, [{ el: h, kind: 'head' }]);
    const lede = $('.lede', sec), start = $('.start', sec);
    if (lede) textOnEnter(lede, [{ el: lede, kind: 'body' }, { el: start, kind: 'fade', at: 0.35 }], 'top 90%', start);

    setupPanel();
    setupTimeline(sec);
  }

  function setupPanel() {
    const wrap = $('.panel-wrap');
    if (!wrap) return;
    const cards = $$('.card', wrap);

    // depth: the outer cards drift a few px against the middle one (0 when the panel is
    // centred). The middle card stays put: panel.jpg has a baked 1px highlight right under
    // its bottom edge that any upward drift would expose as a second edge line.
    const amp = { 'c-leads': 9, 'c-rev': 6 };   // design px
    const drift = cards.map(c => {
      const k = Object.keys(amp).find(n => c.classList.contains(n));
      if (!k) return null;
      const base = { 'c-leads': 89, 'c-rev': 100 }[k];
      return { el: c, set: gsap.quickSetter(c, 'yPercent'), pct: (amp[k] / base) * 100 };
    }).filter(Boolean);
    const still = cards.filter(c => !drift.some(d => d.el === c));
    const applyDrift = guard('drift', self => {
      const u = self.isActive ? 2 * self.progress - 1 : 0;
      drift.forEach(d => d.set(-u * d.pct));
    });
    ST.create({ trigger: wrap, start: 'top bottom', end: 'bottom top', onUpdate: applyDrift, onToggle: applyDrift, onRefresh: applyDrift });

    if (!below(wrap)) return;
    const cols = $$('.col', wrap), labels = cols.map(c => c.firstElementChild).filter(Boolean);
    const months = $$('.month', wrap), val = $('[data-k="value"]', wrap);
    gsap.set(cards, { opacity: 0, y: 36 });
    gsap.set(cols, { scaleY: 0, transformOrigin: '50% 100%' });
    gsap.set(labels, { opacity: 0 });
    gsap.set(months, { opacity: 0, y: 6 });

    const reveal = once(guard('panel', () => {
        const tl = gsap.timeline({
          onComplete: guard('panel-done', () => {
            gsap.set(cards, { clearProps: 'opacity' });          // drifting cards keep their transform…
            gsap.set(still, { clearProps: 'transform' });        // …the anchored one goes back to bare markup
            gsap.set(cols, { clearProps: 'transform,transformOrigin' });
            gsap.set(labels, { clearProps: 'opacity' });
            gsap.set(months, { clearProps: 'opacity,transform' });
          }),
        });
        tl.to(cards, { opacity: 1, y: 0, duration: 1.1, ease: EXPO, stagger: 0.12 }, 0)
          .to(cols, { scaleY: 1, duration: 1.2, ease: EXPO, stagger: 0.07 }, 0.5)
          .to(months, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.05 }, 0.6)
          .to(labels, { opacity: 1, duration: 0.6, ease: 'power2.out', stagger: 0.07 }, 0.85);
        // the big number counts once — unless the visitor already used the segmented control
        if (val && !viewTouched) {
          valueCounter = makeCounter(val, 'left');
          if (valueCounter) { valueCounter.arm(); valueCounter.play(0.3); }
        }
    }));
    ST.create({ trigger: wrap, start: 'top 75%', once: true, onEnter: reveal });
    onFocusReveal(wrap, reveal);
  }
  FX.on('app:view', () => {
    viewTouched = true;
    if (valueCounter) { valueCounter.release(false); valueCounter = null; }   // app.js counts from here
  });

  function setupTimeline(sec) {
    const line = $('.tl-line', sec), items = $$('.tl-item', sec);
    if (line && below(line)) {
      // the tip of the line rides at ~85% of the viewport; forward-only, then stays drawn.
      // Measured on the (untransformed) .timeline with the line's layout offsets — the line's
      // own rect is collapsed by its scaleY(0) start state.
      const box = line.offsetParent || line.parentElement;
      gsap.set(line, { scaleY: 0, transformOrigin: '50% 0%' });
      gsap.to(line, {
        scaleY: 1, ease: 'none',
        scrollTrigger: {
          trigger: box, scrub: 0.8,
          start: () => `top+=${line.offsetTop} 85%`,
          end: () => `top+=${line.offsetTop + line.offsetHeight} 85%`,
        },
        onComplete: guard('line-done', function () {
          const st = this.scrollTrigger;
          gsap.set(line, { clearProps: 'transform,transformOrigin' });
          if (st) gsap.delayedCall(0, () => st.kill(false));   // false: keep the finished state (no revert)
        }),
      });
    }
    items.filter(below).forEach(it => {
      addCls(it, 'rv-off');
      ST.create({
        trigger: it, start: 'center 80%', once: true,
        onEnter: guard('tl-item', () => {
          it.classList.add('rv-tr'); it.classList.remove('rv-off');
          setTimeout(() => it.classList.remove('rv-tr'), 1500);
        }),
      });
    });
  }

  /* ======================================================================
     PROCESS — clip, eyebrow + heading + aside, steps
     ====================================================================== */
  function setupProcess() {
    const sec = $('.process');
    if (!sec) return;
    clipReveal(sec);
    const eyebrow = $('.eyebrow', sec), h = $('h2', sec), aside = $('.aside', sec);
    if (eyebrow && h) textOnEnter(eyebrow, [{ el: eyebrow, kind: 'rise' }, { el: h, kind: 'head', at: 0.1 }, { el: aside, kind: 'body', at: 0.35 }]);

    const steps = $$('.step', sec).filter(below);
    if (!steps.length) return;
    steps.forEach(s => {
      gsap.set($('.ico', s), { opacity: 0, scale: 0.7, transition: 'none' });
      gsap.set($$('h3, p', s), { opacity: 0, y: 16 });
    });
    ST.batch(steps, {
      start: 'top 88%', once: true, interval: 0.1,
      onEnter: guard('steps', batch => batch.forEach((s, i) => {
        const ico = $('.ico', s), txt = $$('h3, p', s);
        gsap.timeline({
          delay: i * 0.14,
          onComplete: () => { gsap.set(ico, { clearProps: 'opacity,transform,transition' }); gsap.set(txt, { clearProps: 'opacity,transform' }); },
        })
          .to(ico, { opacity: 1, scale: 1, duration: 1.1, ease: EXPO }, 0)
          .to(txt, { opacity: 1, y: 0, duration: 1.1, ease: EXPO, stagger: 0.08 }, 0.12);
      })),
    });
  }

  /* ======================================================================
     STATEMENT — words scrub from light grey to their own final colour
     ====================================================================== */
  function setupStatement() {
    const p = $('.statement p');
    if (!p || !Split) return;
    const GREY = [212, 212, 212], STEP = 0.32;          // #d4d4d4; each word starts 0.32 of a word-fade after the previous
    const rgb = c => (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
    let split = null, words = [], finals = [], last = [], off = false;
    // Words exist only while the scrub is mid-way: inline <span>s (no display change =>
    // identical line breaks), aria 'none' so the text stays real, readable DOM text (an
    // aria-label on <p> is not reliably announced). Once every word has reached its colour
    // the split is reverted, so the resting paragraph is the untouched original markup.
    const ensure = () => {
      if (split || off) return !!split;
      const before = lineTexts(p);
      split = Split.create(p, { type: 'words', tag: 'span', wordsClass: 'rv-w', aria: 'none' });
      // belt and braces: if wrapping the words ever changed a line break, leave the paragraph alone
      if (!split.words.length || lineTexts(p) !== before) { split.revert(); split = null; off = true; return false; }
      words = split.words;
      finals = words.map(w => rgb(getComputedStyle(w).color));   // #0f0f0f outside .fade, #8d8d8d inside
      last = words.map(() => -1);
      return true;
    };
    const drop = () => { if (split) { split.revert(); split = null; words = []; } };
    rb.drops.push(drop);
    const render = P => {
      if (P >= 0.9995) { drop(); return; }
      if (!ensure()) return;
      const x = Math.max(0, P) * ((words.length - 1) * STEP + 1);
      words.forEach((w, i) => {
        const t = Math.round(Math.min(1, Math.max(0, x - i * STEP)) * 200) / 200;
        if (t === last[i]) return;
        last[i] = t;
        if (t >= 1) { w.style.color = ''; return; }    // inherit the design colour itself
        const f = finals[i];
        w.style.color = `rgb(${GREY.map((g, k) => Math.round(g + (f[k] - g) * t)).join(',')})`;
      });
    };
    const sm = { p: 0 };
    const follow = gsap.quickTo(sm, 'p', { duration: 0.5, ease: 'power3', onUpdate: guard('words', () => render(sm.p)) });
    const jump = guard('words-jump', self => { follow(self.progress, self.progress); sm.p = self.progress; render(sm.p); });
    const st = ST.create({ trigger: p, start: 'top 85%', end: 'top 38%', onUpdate: self => follow(self.progress), onRefresh: jump });
    jump(st);
  }

  /* ======================================================================
     STATS — rules draw, quote bar draws, numbers count
     ====================================================================== */
  function setupStats() {
    const stats = $('.stats');
    if (!stats) return;
    const draw = (el, cls, start, trigger = el) => {
      addCls(el, cls);
      ST.create({ trigger, start, once: true, onEnter: guard('rule', () => el.classList.remove(cls)) });
    };
    if (below(stats)) draw(stats, 'rv-rule-off', 'top 92%');
    const rows = $$('.stat', stats);
    rows.forEach((row, i) => { if (i < rows.length - 1 && row.getBoundingClientRect().bottom >= innerHeight) draw(row, 'rv-rule-off', 'bottom 94%'); });
    const bq = $('blockquote', stats);
    if (bq && below(bq)) draw(bq, 'rv-bar-off', 'top 88%');

    $$('.num', stats).forEach(n => {
      if (!below(n)) return;
      const c = makeCounter(n, 'right', true);
      if (!c) return;
      c.arm(); pendingCounters.add(c);
      ST.create({ trigger: n, start: 'top 90%', once: true, onEnter: guard('count', () => { pendingCounters.delete(c); c.play(0.05); }) });
    });
    // keep the locked width honest across resizes while a number is still waiting
    ST.addEventListener('refreshInit', () => { if (alive) pendingCounters.forEach(c => c.arm()); });
  }

  /* ======================================================================
     FOOTER — clip + image layer settling exactly at the page bottom, content
     ====================================================================== */
  function setupFooter() {
    const foot = $('.footer');
    if (!foot) return;
    clipReveal(foot, 'clamp(top 55%)');
    // settles from a slight zoom/offset to the exact cover crop at the very bottom of the page.
    // Kept deliberately small: footer.jpg has feathered patches baked in under the newsletter,
    // the link columns and the description; with a quadratic settle they stay within ~3px of
    // their text while it is on screen (a bigger drift exposes them as smudges).
    bgLayer(foot, p => { const t = 1 - p; return [-0.8 * t * t, 1 + 0.035 * t * t]; }, 'clamp(bottom bottom)');

    const form = $('.f-form', foot);
    const els = ['.f-brand', '.f-desc', '.f-news', '.f-form', '.f-col', '.f-social', '.f-bottom']
      .flatMap(s => $$(s, foot)).filter(below);
    if (!els.length) return;
    const waiting = new Set(els);
    els.forEach(el => gsap.set(el, el === form ? { opacity: 0 } : { opacity: 0, y: 28 }));
    const show = batch => batch.filter(el => waiting.delete(el)).forEach((el, i) => {
      gsap.to(el, el === form
        ? { opacity: 1, duration: 1.2, delay: i * 0.07, ease: 'power2.out', clearProps: 'opacity' }   // x belongs to live, button to cursor
        : { opacity: 1, y: 0, duration: 1.3, delay: i * 0.07, ease: EXPO, clearProps: 'opacity,transform' });
    });
    ST.batch(els, { start: 'clamp(top 94%)', once: true, interval: 0.1, onEnter: guard('footer', show) });
    onFocusReveal(foot, () => show([...waiting]));   // tabbing into the footer shows whatever is still waiting
  }

  /* ======================================================================
     INIT
     ====================================================================== */
  function init() {
    const ctx = gsap.context(() => {});
    try {
      ctx.add(() => {
        setupFeatures();
        setupGrowth();
        setupProcess();
        setupStatement();
        setupStats();
        setupFooter();
      });
      root.classList.add('fx-reveals');
    } catch (e) {
      // leave the page exactly as designed
      alive = false;
      fail('init', e);
      try { ctx.revert(); } catch (_) { /* noop */ }
      rb.drops.forEach(d => { try { d(); } catch (_) { /* noop */ } });
      rb.classes.forEach(([el, c]) => el.classList.remove(c));
      rb.texts.forEach(([el, t]) => { el.textContent = t; el.style.minWidth = ''; el.style.textAlign = ''; });
      $$('.growth, .process, .footer, .media').forEach(el => { el.style.clipPath = ''; el.style.removeProperty('--rv-by'); el.style.removeProperty('--rv-bs'); });
      root.classList.remove('fx-reveals');
    }
  }

  FX.ready.then(() => { try { init(); } catch (e) { fail('ready', e); } });
})();
