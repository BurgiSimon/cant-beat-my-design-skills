// The bag: quick add from a card (a dot flies from the size to the bag's count), a drawer with quantities, and a
// meter toward the complimentary delivery the announcement promises. Kept for the session in this browser.
import { calm, gsap, on, emit, dialog, toast } from './core.js';

const FREE = 150;
const KEY = 'offform:bag';

export function init() {
  const el = document.querySelector('[data-bag]');
  const list = el.querySelector('[data-bag-items]');
  const empty = el.querySelector('[data-bag-empty]');
  const total = el.querySelector('[data-bag-total]');
  const shipMsg = el.querySelector('[data-ship-msg]');
  const shipBar = el.querySelector('[data-ship-bar]');
  const checkout = el.querySelector('[data-checkout]');
  const counts = [...document.querySelectorAll('[data-bag-count]')];
  const bagBtn = document.querySelector('.head__bag');

  let items = [];
  try { items = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (e) { items = []; }
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* private mode */ } };

  const d = dialog(el);
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-bag-open]');
    if (t) { e.preventDefault(); emit('menu:close'); d.open(t); }
    if (e.target.closest('[data-bag-close]')) d.close();
  });

  const money = (v) => `$${v.toLocaleString('en-US')}`;
  function render({ bump = false } = {}) {
    const n = items.reduce((a, it) => a + it.qty, 0);
    const sum = items.reduce((a, it) => a + it.qty * it.price, 0);
    for (const c of counts) c.textContent = n;
    bagBtn?.setAttribute('aria-label', `Bag, ${n} item${n === 1 ? '' : 's'}`);
    if (bump) {
      const cnt = document.querySelector('.head__count');
      cnt?.classList.remove('is-bump'); void cnt?.offsetWidth; cnt?.classList.add('is-bump');
    }
    total.textContent = money(sum);
    checkout.disabled = n === 0;
    empty.hidden = n > 0;
    const left = Math.max(0, FREE - sum);
    shipMsg.textContent = n === 0 ? `Complimentary delivery on orders ${money(FREE)}+`
      : left > 0 ? `You’re ${money(left)} away from complimentary delivery` : 'Complimentary delivery unlocked';
    shipBar.parentElement.style.setProperty('--ship', Math.min(1, sum / FREE).toFixed(3));
    list.innerHTML = items.map((it, i) => `
      <li class="bag__item">
        <img src="${it.img}" alt="" />
        <div>
          <p class="bag__iname">${it.name}</p>
          <p class="bag__imeta label">${it.colour} <i>/</i> Size ${it.size}</p>
          <div class="bag__qty">
            <button type="button" data-qty="-1" data-i="${i}" aria-label="One fewer ${it.name}"><svg class="i"><use href="#i-minus"/></svg></button>
            <span aria-label="Quantity">${it.qty}</span>
            <button type="button" data-qty="1" data-i="${i}" aria-label="One more ${it.name}"><svg class="i"><use href="#i-plus"/></svg></button>
          </div>
        </div>
        <div>
          <p class="bag__iprice">${money(it.price * it.qty)}</p>
          <button class="bag__remove label" type="button" data-remove="${i}">Remove</button>
        </div>
      </li>`).join('');
  }
  list.addEventListener('click', (e) => {
    const q = e.target.closest('[data-qty]');
    const r = e.target.closest('[data-remove]');
    if (q) {
      const it = items[+q.dataset.i];
      it.qty = Math.max(0, it.qty + Number(q.dataset.qty));
      if (!it.qty) items.splice(+q.dataset.i, 1);
    } else if (r) items.splice(+r.dataset.remove, 1);
    else return;
    save(); render();
    const first = list.querySelector('button') || el.querySelector('[data-bag-close]');
    first?.focus();
  });
  checkout.addEventListener('click', () => toast('This is a design study: nothing is charged, nothing ships.'));

  on('bag:add', ({ product, from }) => {
    const found = items.find((it) => it.id === product.id && it.size === product.size && it.colour === product.colour);
    if (found) found.qty += 1; else items.push({ ...product, qty: 1 });
    save();
    const target = document.querySelector('.head__count') || bagBtn;
    const head = document.querySelector('[data-head]');
    head?.classList.remove('is-hidden');
    const done = () => { render({ bump: true }); toast(`${product.name} — size ${product.size} — added to your bag`); };
    if (!from || !target || calm || !gsap || target.offsetParent === null) { done(); return; }
    const a = from.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const dot = document.createElement('i');
    dot.className = 'fly';
    document.body.append(dot);
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
    gsap.set(dot, { x: x0, y: y0 });
    gsap.to(dot, { x: x1, duration: 0.75, ease: 'power2.inOut' });
    gsap.to(dot, { y: y1, duration: 0.75, ease: 'back.in(1.6)', onComplete: () => { dot.remove(); done(); } });
    gsap.fromTo(dot, { scale: 1.6 }, { scale: 0.5, duration: 0.75, ease: 'power2.in' });
  });

  render();
}
