// The shop: the product's state (paint, size, quantity), the accordion, the cart and every panel that opens over
// the page (cart, compare, reviews, search, account, the phone's menu). Panels are real dialogs: focus goes in and
// stays in, Escape closes, focus returns to what opened them.

import { gsap, calm, emit, on, lock, unlock, toast, odometer, scrollToTarget, stageReady, lenis } from './core.js';
import { scramble } from './ui.js';

const SIZES = [
  { id: 'XS', cm: '53–54', g: 1190, note: 'small heads' },
  { id: 'S', cm: '55–56', g: 1220, note: 'small to medium heads' },
  { id: 'M', cm: '57–58', g: 1250, note: 'most medium heads' },
  { id: 'L', cm: '59–60', g: 1290, note: 'medium to large heads' },
  { id: 'XL', cm: '61–62', g: 1320, note: 'large heads' },
  { id: 'XXL', cm: '63–64', g: 1360, note: 'the largest heads' },
];
const PAINT_PRICE = { dust: 649, sage: 649, haze: 649, volt: 749 };
const PAINT_NAME = { dust: 'Dust', sage: 'Sage', haze: 'Haze', ash: 'Ash', volt: 'Volt' };
const FREE_SHIP = 300;
const SEED = [{ id: 'visor-smoke', kind: 'visor', name: 'Smoke visor', meta: 'Pinlock 120 ready', price: 49, qty: 1 }];
const fmt = (n) => `$${n.toLocaleString('en-US')}`;

export function init() {
  const state = { paint: 'dust', size: 'M', qty: 1 };
  let stage = null;
  stageReady.then((s) => { stage = s; renderCart(); });

  // ---------------------------------------------------------------- paint
  const titleName = document.querySelector('[data-paint-name]');
  const monoName = document.querySelector('[data-paint-name-mono]');
  const swatches = [...document.querySelectorAll('.swatch')];
  const priceEl = document.querySelector('[data-price]');
  const price = priceEl ? odometer(priceEl, { value: 649, prefix: '$' }) : null;
  function setPaint(name, { scroll = false } = {}) {
    if (!PAINT_PRICE[name]) { toast(`${PAINT_NAME[name]} Nomadic is sold out. Join the dispatch to hear about the next archive run.`); return; }
    if (name === state.paint) return;
    const go = () => {
      state.paint = name;
      emit('paint', name);
      scramble(titleName, PAINT_NAME[name].toUpperCase(), { duration: 700 });
      scramble(monoName, PAINT_NAME[name].toUpperCase(), { duration: 600 });
      swatches.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.paint === name)));
      price?.set(PAINT_PRICE[name]);
      document.title = `${PAINT_NAME[name]} Nomadic — Vizen helmets`;
    };
    if (scroll && scrollY > innerHeight * 0.5) { scrollToTarget(0); setTimeout(go, lenis ? 1000 : 50); } else go();
  }
  swatches.forEach((b, i) => {
    b.addEventListener('click', () => setPaint(b.dataset.paint));
    b.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return; e.preventDefault();
      const n = swatches[(i + d + swatches.length) % swatches.length]; n.focus(); n.click();
    });
  });
  // the colours' pointer glides over the one you point at
  const cursor = document.querySelector('.colors__cursor');
  if (cursor) {
    const panel = document.querySelector('.colors__panel');
    swatches.forEach((b) => b.addEventListener('pointerenter', () => {
      const r = b.getBoundingClientRect(); const c = cursor.getBoundingClientRect();
      const base = cursor.dataset.base ? Number(cursor.dataset.base) : (cursor.dataset.base = String(c.left), c.left);
      cursor.style.transform = `translateX(${r.left + r.width * 0.62 - base}px)`;
    }));
    panel?.addEventListener('pointerleave', () => { cursor.style.transform = ''; });
  }
  on('pick', (name) => setPaint(name, { scroll: true }));
  // the intro rolls the price and the weight into place
  on('intro:roll', () => { price?.scramble(); weight?.scramble(); requestAnimationFrame(() => { price?.set(PAINT_PRICE[state.paint]); weight?.set(SIZES.find((x) => x.id === state.size).g); }); });

  // ---------------------------------------------------------------- size, quantity
  const sizeEl = document.querySelector('[data-size]');
  const weightEl = document.querySelector('[data-weight]');
  const weight = weightEl ? odometer(weightEl, { value: 1250, suffix: '\u00a0g' }) : null;
  const sizesHost = document.querySelector('[data-sizes]');
  const sizeNote = document.querySelector('[data-size-note]');
  const sizeBtns = SIZES.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'size'; b.textContent = s.id; b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(s.id === state.size)); b.setAttribute('aria-label', `${s.id}, ${s.cm} cm`);
    b.tabIndex = s.id === state.size ? 0 : -1;
    b.addEventListener('click', () => setSize(s.id));
    b.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return; e.preventDefault();
      const n = SIZES[(i + d + SIZES.length) % SIZES.length]; setSize(n.id); sizeBtns[SIZES.indexOf(n)].focus();
    });
    sizesHost?.append(b);
    return b;
  });
  function setSize(id) {
    if (id === state.size) return;
    const s = SIZES.find((x) => x.id === id);
    state.size = id;
    sizeBtns.forEach((b, i) => { const yes = SIZES[i].id === id; b.setAttribute('aria-checked', String(yes)); b.tabIndex = yes ? 0 : -1; });
    scramble(sizeEl, id, { duration: 380 });
    weight?.set(s.g);
    if (sizeNote) sizeNote.textContent = `${s.cm} cm · fits ${s.note}`;
  }
  const qtyEl = document.querySelector('[data-qty-val]');
  const qtyMinus = document.querySelector('[data-qty="-1"]');
  function setQty(n) {
    state.qty = Math.max(1, Math.min(9, n));
    const txt = String(state.qty).padStart(2, '0');
    if (qtyEl && gsap && !calm) {
      gsap.fromTo(qtyEl, { yPercent: n > Number(qtyEl.textContent) ? 60 : -60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
    }
    if (qtyEl) qtyEl.textContent = txt;
    if (qtyMinus) qtyMinus.style.color = state.qty === 1 ? '' : '#121212';
  }
  document.querySelectorAll('[data-qty]').forEach((b) => b.addEventListener('click', () => setQty(state.qty + Number(b.dataset.qty))));

  // ---------------------------------------------------------------- ship-by date
  const eta = document.querySelector('[data-eta]');
  if (eta) {
    const d = new Date(); let n = 0;
    while (n < 2) { d.setDate(d.getDate() + 1); if (d.getDay() % 6 !== 0) n++; }
    eta.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  // ---------------------------------------------------------------- accordion (one open at a time)
  const accBtns = [...document.querySelectorAll('.acc__h button')];
  function setAcc(btn, open) {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if ((btn.getAttribute('aria-expanded') === 'true') === open) return;
    btn.setAttribute('aria-expanded', String(open));
    if (calm || !panel.animate) { panel.hidden = !open; return; }
    panel.getAnimations().forEach((a) => a.cancel());
    if (open) panel.hidden = false;
    const h = panel.scrollHeight;
    const a = panel.animate([{ height: `${open ? 0 : h}px`, opacity: open ? 0 : 1 }, { height: `${open ? h : 0}px`, opacity: open ? 1 : 0 }], { duration: 560, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    a.onfinish = () => { if (!open) panel.hidden = true; };
  }
  accBtns.forEach((b) => b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    accBtns.forEach((o) => { if (o !== b) setAcc(o, false); });
    setAcc(b, open);
  }));
  document.querySelectorAll('[data-open-acc]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const b = accBtns[Number(a.dataset.openAcc)];
    scrollToTarget(0);
    setTimeout(() => { accBtns.forEach((o) => setAcc(o, o === b)); b.focus({ preventScroll: true }); }, lenis ? 1000 : 0);
  }));

  // ---------------------------------------------------------------- dialogs
  const scrim = document.querySelector('[data-scrim]');
  let current = null; let opener = null;
  const MODAL = new Set(['cart', 'compare', 'reviews', 'search', 'menu']);
  const focusables = (el) => [...el.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.closest('[hidden]') && x.offsetParent !== null);
  function open(name, from) {
    const el = document.querySelector(`[data-dialog="${name}"]`);
    if (!el) return;
    if (current && current !== el) close({ restore: false });
    if (current === el) { close(); return; }
    current = el; opener = from || document.activeElement;
    el.hidden = false;
    const modal = MODAL.has(name);
    if (modal) { scrim.hidden = false; lock(); }
    requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('is-on'); if (modal) scrim.classList.add('is-on'); }));
    emit(`open:${name}`, el);
    const first = el.querySelector('[data-search-q], input') || focusables(el)[0];
    first?.focus({ preventScroll: true });
  }
  function close({ restore = true } = {}) {
    const el = current; if (!el) return;
    current = null;
    el.classList.remove('is-on'); scrim.classList.remove('is-on');
    const modal = MODAL.has(el.dataset.dialog);
    if (modal) unlock();
    setTimeout(() => { if (current !== el) el.hidden = true; if (!current) scrim.hidden = true; }, calm ? 0 : 600);
    if (restore) opener?.focus?.({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o) { e.preventDefault(); open(o.dataset.open, o); return; }
    if (e.target.closest('[data-close]') || e.target === scrim) { close(); return; }
    if (current && current.dataset.dialog === 'account' && !current.contains(e.target)) close({ restore: false });
    if (current?.dataset.dialog === 'menu' && e.target.closest('.menu a')) close({ restore: false });
  });
  document.addEventListener('keydown', (e) => {
    if (!current) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab' && MODAL.has(current.dataset.dialog)) {
      const f = focusables(current); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // compare: the bars grow when it opens
  on('open:compare', (el) => {
    el.querySelectorAll('[data-bar]').forEach((c) => { c.style.setProperty('--b', '0'); requestAnimationFrame(() => requestAnimationFrame(() => c.style.setProperty('--b', c.dataset.bar))); });
  });

  // account: a magic link that is not sent
  const signin = document.querySelector('[data-signin]');
  signin?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = signin.querySelector('input'); const msg = document.querySelector('[data-signin-msg]');
    if (!input.value || !input.checkValidity()) { msg.textContent = 'That address does not look right.'; input.focus(); return; }
    msg.textContent = `Link sent to ${input.value}. (A design study: nothing was sent.)`;
  });

  // ---------------------------------------------------------------- search
  const ITEMS = [
    { t: 'Dust Nomadic', k: 'helmet bone white', act: () => setPaint('dust', { scroll: true }) },
    { t: 'Sage Nomadic', k: 'helmet grey green', act: () => setPaint('sage', { scroll: true }) },
    { t: 'Haze Nomadic', k: 'helmet lilac blue', act: () => setPaint('haze', { scroll: true }) },
    { t: 'Volt Nomadic', k: 'helmet yellow archive', act: () => setPaint('volt', { scroll: true }) },
    { t: 'Ash Nomadic', k: 'helmet graphite archive sold out', act: () => toast('Ash Nomadic is sold out.') },
    { t: 'Smoke visor', k: 'visor dark tint pinlock', act: () => addLine({ id: 'visor-smoke', kind: 'visor', name: 'Smoke visor', meta: 'Pinlock 120 ready', price: 49 }) },
    { t: 'Clear visor', k: 'visor night', act: () => addLine({ id: 'visor-clear', kind: 'visor', name: 'Clear visor', meta: 'Pinlock 120 ready', price: 39 }) },
    { t: 'Iridium visor', k: 'visor mirror yellow gold', act: () => addLine({ id: 'visor-iridium', kind: 'visor', name: 'Iridium visor', meta: 'Mirrored, yellow', price: 79 }) },
    { t: 'Pinlock 120 insert', k: 'part fog anti-fog', act: () => addLine({ id: 'pinlock', kind: 'visor', name: 'Pinlock 120 insert', meta: 'Anti-fog', price: 29 }) },
    { t: 'Brake-light battery', k: 'part led spare', act: () => addLine({ id: 'battery', kind: 'part', name: 'Brake-light battery', meta: '40 h a charge', price: 19 }) },
    { t: 'Size guide', k: 'fit measure head', act: () => document.querySelector('[data-open-acc="1"]').click() },
    { t: 'Shipping & returns', k: 'delivery return', act: () => document.querySelector('[data-open-acc="2"]').click() },
    { t: 'Anatomy', k: 'visor spoiler stabiliser light shell', href: '#anatomy' },
    { t: 'Wind tunnel', k: 'aero noise drag', href: '#tunnel' },
    { t: 'The Vault', k: 'paints colours archive', href: '#vault' },
  ];
  const q = document.querySelector('[data-search-q]');
  const results = document.querySelector('[data-search-results]');
  let sel = 0; let shown = [];
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function search() {
    const v = q.value.trim().toLowerCase();
    shown = ITEMS.filter((i) => !v || i.t.toLowerCase().includes(v) || i.k.includes(v)).slice(0, 8);
    sel = 0;
    results.replaceChildren();
    if (!shown.length) { const li = document.createElement('li'); li.className = 'is-empty'; li.textContent = `Nothing for “${q.value}”. Try “visor”.`; results.append(li); return; }
    shown.forEach((it, i) => {
      const li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = `sr-${i}`;
      const a = document.createElement('a'); a.href = it.href || '#top'; a.tabIndex = -1;
      const hi = v ? esc(it.t).replace(new RegExp(`(${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i'), '<mark>$1</mark>') : esc(it.t);
      a.innerHTML = `<span>${hi}</span><small>${esc(it.k.split(' ')[0])}</small>`;
      a.addEventListener('click', (e) => { e.preventDefault(); choose(i); });
      li.append(a); results.append(li);
    });
    mark();
  }
  function mark() { [...results.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === sel))); q.setAttribute('aria-activedescendant', `sr-${sel}`); }
  function choose(i) {
    const it = shown[i]; if (!it) return;
    close({ restore: false });
    if (it.href) setTimeout(() => scrollToTarget(document.querySelector(it.href)), 80);
    else setTimeout(() => it.act(), 120);
  }
  if (q) {
    q.addEventListener('input', search);
    q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
    });
    on('open:search', () => { q.value = ''; search(); });
    addEventListener('keydown', (e) => { if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !current && !/input|textarea/i.test(document.activeElement?.tagName)) { e.preventDefault(); open('search'); } });
  }

  // ---------------------------------------------------------------- cart
  let cart;
  try { cart = JSON.parse(localStorage.getItem('vizen:cart') || 'null'); } catch { cart = null; }
  if (!Array.isArray(cart)) cart = SEED.map((x) => ({ ...x }));
  const save = () => { try { localStorage.setItem('vizen:cart', JSON.stringify(cart)); } catch { /* private mode */ } };
  const badge = document.querySelector('[data-badge]');
  const cartBtn = document.querySelector('.icon-btn--cart');
  const lines = document.querySelector('[data-lines]');
  const subtotal = document.querySelector('[data-subtotal]');
  const shipMsg = document.querySelector('[data-ship-msg]');
  const shipBar = document.querySelector('[data-ship-bar]');
  const count = document.querySelector('[data-cart-count]');
  let fresh = null;
  function renderCart() {
    const n = cart.reduce((a, l) => a + l.qty, 0);
    const sum = cart.reduce((a, l) => a + l.qty * l.price, 0);
    if (badge) { badge.textContent = String(n); badge.hidden = n === 0; }
    cartBtn?.setAttribute('aria-label', `Cart, ${n} item${n === 1 ? '' : 's'}`);
    if (count) count.textContent = `(${n})`;
    if (subtotal) subtotal.textContent = fmt(sum);
    if (shipMsg) shipMsg.textContent = sum >= FREE_SHIP ? 'Free express shipping is on us.' : `Add ${fmt(FREE_SHIP - sum)} for free express shipping`;
    shipBar?.style.setProperty('--p', String(Math.min(1, sum / FREE_SHIP)));
    if (!lines) return;
    lines.replaceChildren();
    if (!cart.length) { const li = document.createElement('li'); li.className = 'lines__empty'; li.textContent = 'Your cart is empty.'; lines.append(li); return; }
    cart.forEach((l, i) => {
      const li = document.createElement('li'); li.className = 'line' + (l.id === fresh ? ' is-new' : '');
      const img = document.createElement('div'); img.className = `line__img${l.kind === 'helmet' ? '' : ' line__img--visor'}`;
      if (l.kind === 'helmet' && stage) { const c = stage.helmetStill(l.paint, 152, 152, { az: -30, el: 10, fill: 0.76 }); if (c) { const cv = document.createElement('canvas'); cv.width = 152; cv.height = 152; cv.getContext('2d').drawImage(c, 0, 0); img.append(cv); } }
      else img.innerHTML = '<svg viewBox="0 0 76 76" width="76" height="76" aria-hidden="true"><path d="M14 44c6-14 20-22 34-22 7 0 12 2 15 5-4 9-13 17-27 20-9 2-17 0-22-3Z" fill="#141414" stroke="#6a6964"/><path d="M22 41c8-8 18-12 30-12" stroke="#fce91b" stroke-width="1.5" fill="none" opacity=".8"/></svg>';
      const mid = document.createElement('div');
      mid.innerHTML = `<p class="line__name">${esc(l.name)}</p><span class="line__meta">${esc(l.meta)}</span>`;
      const qty = document.createElement('div'); qty.className = 'line__qty';
      qty.innerHTML = `<button type="button" aria-label="One fewer ${esc(l.name)}"><svg><use href="#i-minus"/></svg></button><span>${String(l.qty).padStart(2, '0')}</span><button type="button" aria-label="One more ${esc(l.name)}"><svg><use href="#i-plus"/></svg></button>`;
      const [m, p] = qty.querySelectorAll('button');
      m.addEventListener('click', () => { l.qty -= 1; if (l.qty < 1) cart.splice(i, 1); save(); renderCart(); lines.querySelector('button')?.focus(); });
      p.addEventListener('click', () => { l.qty = Math.min(9, l.qty + 1); save(); renderCart(); });
      mid.append(qty);
      const right = document.createElement('div');
      right.innerHTML = `<p class="line__price">${fmt(l.price * l.qty)}</p>`;
      const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'line__rm'; rm.textContent = 'Remove';
      rm.addEventListener('click', () => { cart.splice(i, 1); save(); renderCart(); });
      right.append(rm);
      li.append(img, mid, right); lines.append(li);
    });
    fresh = null;
  }
  function addLine(item, { silent = false } = {}) {
    const found = cart.find((l) => l.id === item.id);
    if (found) found.qty = Math.min(9, found.qty + (item.qty || 1)); else cart.unshift({ ...item, qty: item.qty || 1 });
    fresh = item.id; save(); renderCart();
    if (badge && !calm) { badge.classList.remove('is-bump'); void badge.offsetWidth; badge.classList.add('is-bump'); }
    if (!silent) open('cart', cartBtn);
  }
  renderCart();

  // Add to cart: the button fills, a picture of the helmet flies to the bag, the bag takes it, the cart opens.
  const form = document.querySelector('[data-buy]');
  const addBtn = document.querySelector('[data-add]');
  const flyer = document.querySelector('[data-flyer]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (addBtn.classList.contains('is-busy')) return;
    const item = { id: `nomadic-${state.paint}-${state.size}`, kind: 'helmet', paint: state.paint, name: `${PAINT_NAME[state.paint]} Nomadic`, meta: `Size ${state.size} · ${SIZES.find((s) => s.id === state.size).g.toLocaleString('en-US')} g`, price: PAINT_PRICE[state.paint], qty: state.qty };
    const label = addBtn.querySelector('.cta__label');
    addBtn.classList.add('is-busy');
    const land = () => { addBtn.classList.remove('is-busy'); addBtn.classList.add('is-done'); scramble(label, 'Added', { duration: 300 }); setTimeout(() => { addBtn.classList.remove('is-done'); scramble(label, 'Add to cart', { duration: 400 }); }, 1600); addLine(item); setQty(1); };
    const pic = stage?.helmetStill(state.paint, 128, 112, { az: -30, el: 10, fill: 0.74 });
    if (calm || !gsap || !flyer || !pic || !cartBtn) { land(); return; }
    flyer.replaceChildren(); const cv = document.createElement('canvas'); cv.width = 128; cv.height = 112; cv.getContext('2d').drawImage(pic, 0, 0); flyer.append(cv);
    const from = document.querySelector('[data-frame]').getBoundingClientRect();
    const to = cartBtn.getBoundingClientRect();
    const x0 = from.left + from.width / 2 - 32, y0 = from.top + from.height * 0.45 - 28;
    const x1 = to.left + to.width / 2 - 32, y1 = to.top + to.height / 2 - 28;
    const p = { t: 0 };
    gsap.set(flyer, { opacity: 1, x: x0, y: y0, scale: 1.6, rotate: 0 });
    gsap.to(p, {
      t: 1, duration: 0.95, delay: 0.25, ease: 'power2.inOut',
      onUpdate() {
        const t = p.t; const arc = Math.sin(Math.PI * t) * -160;
        gsap.set(flyer, { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t + arc, scale: 1.6 - 1.35 * t, rotate: -25 * t, opacity: t > 0.92 ? (1 - t) / 0.08 : 1 });
      },
      onComplete() { gsap.set(flyer, { opacity: 0 }); land(); },
    });
  });

  document.querySelector('[data-checkout]')?.addEventListener('click', () => toast('Vizen is a design study: there is nothing to pay for, and nothing will arrive.'));
}
