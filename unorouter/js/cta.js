// The call to action: the mark again, large and dark, its colours coming up only where the pointer is (and all at
// once, from the button, when a key is made). The key generator types out a demo key, made in the browser.

import { calm, loop, clamp, copyText, toast, damp } from './core.js';
import { CellField } from './cells.js';
import { grid } from './mark.js';
import { decode } from './type.js';

export function init() {
  const section = document.querySelector('.cta');
  if (!section) return;

  // ---- the field ----
  const cv = section.querySelector('.cta__field');
  let field = null; let reveal = calm ? 1 : 0; let revealTo = calm ? 1 : 0;
  if (cv?.getContext) {
    field = new CellField(cv, grid(), { gap: 0.14, flow: 0.12, scale: 0.06, halo: 6.5, haloSteps: 1.6, repel: 3, lift: 0.1 });
    field.dimmed = 1; field.dimMask = new Float32Array(field.cells.length).fill(1);
    const frame = (dt) => {
      field.step(dt);
      reveal = damp(reveal, revealTo, 1.6, dt);
      for (let k = 0; k < field.cells.length; k++) field.dimMask[k] = clamp(1 - field.infl[k] * 1.7 - field.white[k] * 1.4 - reveal, 0, 1) * 0.92;
      field.draw();
    };
    if (calm) { field.step(0); frame(0); } else loop(cv, frame);
  }

  // ---- the key ----
  const out = section.querySelector('[data-key]');
  const make = section.querySelector('[data-key-make]');
  const copy = section.querySelector('[data-key-copy]');
  let key = ''; let busy = false;
  make?.addEventListener('click', async () => {
    if (busy) return; busy = true; make.setAttribute('aria-busy', 'true');
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    key = `uno-sk-v1-${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
    out.classList.remove('is-key'); out.textContent = 'creating key…';
    if (field) {
      const r = make.getBoundingClientRect(); const f = cv.getBoundingClientRect();
      // the ring starts from the field's edge nearest the button
      field.ripple(clamp(r.left + r.width / 2, f.left, f.right), clamp(r.top, f.top, f.bottom), 26);
      revealTo = 1; setTimeout(() => { revealTo = 0; }, 2600);
    }
    await new Promise((res) => setTimeout(res, calm ? 0 : 420));
    out.textContent = key; out.classList.add('is-key');
    out.setAttribute('aria-busy', 'true');                 // announce the key, not every frame of its decoding
    await decode(out, { duration: 0.9 });
    out.removeAttribute('aria-busy');
    out.innerHTML = `${key.slice(0, 10)}<span class="hl">${key.slice(10, 14)}</span>${key.slice(14)}`;
    delete out.dataset.text;
    copy.hidden = false;
    make.querySelector('[data-scramble]').textContent = 'Generate another';
    make.querySelector('[data-scramble]').dataset.text = 'Generate another';
    make.setAttribute('aria-label', 'Generate another key');
    toast('Demo key created: it won’t call anything');
    busy = false; make.removeAttribute('aria-busy');
  });
  copy?.addEventListener('click', async () => { const ok = await copyText(key); toast(ok ? 'Key copied' : 'Copy failed'); });
}
