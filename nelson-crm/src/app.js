(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const U = n => `calc(${n} * var(--u))`;
  const emit = (n, d) => { if (window.FX) window.FX.emit(n, d); };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- menu ---------- */
  const menuBtn = $('.menu-btn'), menu = $('#menu');
  const setMenu = open => {
    open = !!open;
    if (open !== menu.classList.contains('open')) emit('app:menu', { open });
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('open', open);
  };
  menuBtn.addEventListener('click', e => { e.stopPropagation(); setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));

  /* ---------- feature tabs + weekly chart ---------- */
  const TABS = [
    { h: 'Enhanced your<br>team productivity',
      p: 'Sendir is an advanced analytics tools provide insights into team performance, engagement, and satisfaction.',
      f: [['Insights', 'Small description in here'], ['Engagement', 'Small description in here'], ['Performance', 'Small description in here'], ['Satisfaction', 'Small description in here']],
      bars: [21, 71, 92, 122, 92, 71, 71], hi: 2, label: 'Interactions' },
    { h: 'Automate every<br>repetitive task',
      p: 'Build sequences once and let Sendir follow up, assign owners and update deal stages for you.',
      f: [['Sequences', 'Multi-step follow-ups'], ['Triggers', 'React to buyer signals'], ['Assignments', 'Route to the right rep'], ['Reminders', 'Never miss a next step']],
      bars: [44, 58, 80, 104, 123, 66, 50], hi: 4, label: 'Automations' },
    { h: 'See what moves<br>your pipeline',
      p: 'Live dashboards break down win rates, cycle length and rep activity so you can act on facts.',
      f: [['Forecasts', 'Weighted by deal stage'], ['Win rates', 'Per rep and per source'], ['Activity', 'Calls, emails, meetings'], ['Reports', 'Scheduled to your inbox']],
      bars: [30, 86, 62, 118, 96, 100, 58], hi: 3, label: 'Deals won' },
    { h: 'Plug into the<br>tools you love',
      p: 'Two-way sync with email, calendars, WhatsApp and 40+ sales tools — no spreadsheets in between.',
      f: [['Email & calendar', 'Gmail and Outlook sync'], ['Messaging', 'WhatsApp and Slack'], ['Webhooks', 'Push events anywhere'], ['Open API', 'Build custom workflows']],
      bars: [52, 40, 76, 96, 82, 123, 88], hi: 5, label: 'Synced events' },
  ];
  const BAR_X = [15, 58.6, 101.7, 144.8, 188.5, 232, 275], BAR_W = 35.3;
  const tabs = $$('.tab'), pill = $('.tab-pill'), copy = $('.tab-copy'), list = $('.feat-list');
  const bars = $$('.bar'), chartPill = $('.pill'), guide = $('.guide');

  function drawChart(t) {
    bars.forEach((b, i) => { b.style.height = U(t.bars[i]); b.classList.toggle('on', i === t.hi); });
    chartPill.textContent = t.label;
    const cx = BAR_X[t.hi] + BAR_W / 2;
    guide.style.left = U(cx - 2);
    guide.style.display = t.hi === 6 ? 'none' : '';
    // place the label pill just left of the highlighted bar
    requestAnimationFrame(() => {
      // layout width (ignores any entrance scale); 8.9u gap reproduces the design's resting left of 23.8u
      const w = chartPill.offsetWidth;
      const unit = parseFloat(getComputedStyle(chartPill).getPropertyValue('--u')) || 1;
      chartPill.style.left = U(Math.max(6, BAR_X[t.hi] - 8.9 - w / unit));
    });
  }
  function selectTab(i, focus) {
    tabs.forEach((t, j) => { t.setAttribute('aria-selected', i === j); t.tabIndex = i === j ? 0 : -1; });
    if (focus) tabs[i].focus();
    pill.style.transform = `translateX(${tabs[i].offsetLeft - tabs[0].offsetLeft}px)`;
    const t = TABS[i];
    copy.classList.add('swap-out'); list.classList.add('swap-out');
    setTimeout(() => {
      copy.querySelector('h2').innerHTML = t.h;
      copy.querySelector('p').textContent = t.p;
      $$('li', list).forEach((li, k) => { li.querySelector('b').textContent = t.f[k][0]; li.querySelector('span').textContent = t.f[k][1]; });
      copy.classList.remove('swap-out'); list.classList.remove('swap-out');
    }, reduce ? 0 : 220);
    drawChart(t);
    emit('app:tab', { index: i, data: t });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(i));
    t.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        selectTab((i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length, true);
      }
    });
  });
  addEventListener('resize', () => {
    const i = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
    pill.style.transform = `translateX(${tabs[i].offsetLeft - tabs[0].offsetLeft}px)`;
  });

  /* ---------- dashboard segmented control ---------- */
  const VIEWS = [
    { value: 8458, delta: '1.124', note: 'Your sales increased this month by around 58%', rev: '$10,850.10', cols: [[32.5, 40.7], [45.5, 61.8], [75.5, 78.5], [92.5, 100.5]] },
    { value: 3214, delta: '0.862', note: 'Closed deals grew by around 24% this month', rev: '$7,420.55', cols: [[28.4, 36.5], [52.1, 60.2], [61.0, 69.1], [84.7, 92.8]] },
    { value: 1962, delta: '0.417', note: 'Average order value rose by around 12%', rev: '$3,964.20', cols: [[41.2, 49.3], [38.6, 46.7], [66.3, 74.4], [79.9, 88.0]] },
  ];
  const seg = $$('.seg button'), thumb = $('.seg .thumb'), cols = $$('.col');
  const field = k => $(`[data-k="${k}"]`);
  let raf;
  function countTo(el, to) {
    cancelAnimationFrame(raf);
    const from = parseInt(el.textContent.replace(/\D/g, ''), 10) || 0, t0 = performance.now(), d = reduce ? 1 : 650;
    const step = now => {
      const p = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * e).toLocaleString('en-US');
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function selectView(i) {
    seg.forEach((b, j) => { b.setAttribute('aria-selected', i === j); b.tabIndex = i === j ? 0 : -1; });
    const b = seg[i];
    thumb.style.width = b.offsetWidth + 'px';
    thumb.style.transform = `translateX(${b.offsetLeft - seg[0].offsetLeft}px)`;
    const v = VIEWS[i];
    countTo(field('value'), v.value);
    field('delta').textContent = v.delta;
    field('note').textContent = v.note;
    field('rev').textContent = v.rev;
    cols.forEach((c, k) => { c.style.height = U(v.cols[k][1]); c.querySelector('span').innerHTML = `${v.cols[k][0]}<br>%`; });
    emit('app:view', { index: i, data: v });
  }
  seg.forEach((b, i) => b.addEventListener('click', () => selectView(i)));

  /* ---------- newsletter ---------- */
  const form = $('.f-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = form.email, label = form.querySelector('button span');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
      input.focus(); input.placeholder = 'Enter a valid email'; input.value = '';
      emit('app:subscribe-error', {});
      setTimeout(() => (input.placeholder = 'youremail@gmail.com'), 2200);
      return;
    }
    form.classList.add('done'); label.textContent = 'Thanks!'; input.value = '';
    emit('app:subscribe', {});
    setTimeout(() => { form.classList.remove('done'); label.textContent = 'Submit'; }, 2600);
  });

  /* ---------- public API for the fx modules ---------- */
  window.APP = {
    TABS, VIEWS, BAR_X, BAR_W,
    selectTab, selectView, setMenu, drawChart,
    currentTab: () => tabs.findIndex(t => t.getAttribute('aria-selected') === 'true'),
    currentView: () => seg.findIndex(b => b.getAttribute('aria-selected') === 'true'),
  };
})();
