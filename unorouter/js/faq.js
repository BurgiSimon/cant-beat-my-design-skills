// The FAQ: native <details>, opened and closed with their height (and one open at a time).

import { calm } from './core.js';

export function init() {
  const items = [...document.querySelectorAll('.qa')];
  for (const d of items) {
    const sum = d.querySelector('summary'); const body = d.querySelector('.qa__a');
    sum.addEventListener('click', (e) => {
      if (calm || !body.animate) { if (!d.open) items.forEach((o) => { if (o !== d) o.open = false; }); return; }
      e.preventDefault();
      if (d.open) {
        const h = body.offsetHeight;
        body.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 300, easing: 'cubic-bezier(.65,0,.35,1)' }).onfinish = () => { d.open = false; };
      } else {
        items.forEach((o) => { if (o !== d && o.open) o.querySelector('summary').click(); });
        d.open = true;
        const h = body.offsetHeight;
        body.animate([{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
    });
  }
}
