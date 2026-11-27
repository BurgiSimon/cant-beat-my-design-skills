// [data-dialog-open="id"] opens <dialog id> as a modal; [data-dialog-close] and a click on the backdrop close it.
// The page doesn't scroll behind it, and focus returns to the opener.
import { lockScroll, unlockScroll, $$ } from '../core.js';

export default function init() {
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-dialog-open]');
    if (opener) {
      const d = document.getElementById(opener.dataset.dialogOpen);
      if (!d || d.open) return;
      e.preventDefault();
      d._opener = opener;
      d.showModal(); lockScroll();
      d.dispatchEvent(new CustomEvent('dialog:open', { detail: opener }));
      return;
    }
    const closer = e.target.closest('[data-dialog-close]');
    if (closer) closer.closest('dialog')?.close();
  });
  for (const d of $$('dialog')) {
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => { unlockScroll(); d._opener?.focus(); });
  }
}
