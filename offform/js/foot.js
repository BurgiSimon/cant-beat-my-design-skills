// The foot: the newsletter checks its address and answers; the wordmark rises letter by letter, and its letters
// stretch toward the pointer as it passes over them.
import { calm, fine, gsap, ScrollTrigger, loop, pointer, damp } from './core.js';

export function init() {
  const year = document.querySelector('[data-year-now]');
  if (year) year.textContent = String(new Date().getFullYear());

  // ---- newsletter ----
  const form = document.querySelector('[data-news]');
  if (form) {
    const input = form.querySelector('input');
    const msg = form.querySelector('[data-news-msg]');
    const base = msg.textContent;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      msg.classList.toggle('is-error', !ok);
      msg.classList.toggle('is-ok', ok);
      input.setAttribute('aria-invalid', String(!ok));
      if (!ok) {
        msg.textContent = v ? 'That address looks off. Check it and try again.' : 'Add your email first.';
        input.focus();
        if (gsap && !calm) gsap.fromTo(form.querySelector('.foot__field'), { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
        return;
      }
      msg.textContent = 'You’re in. First word of the next drop comes to you.';
      input.value = '';
      input.blur();
    });
    input.addEventListener('input', () => { if (msg.classList.contains('is-error')) { msg.classList.remove('is-error'); msg.textContent = base; input.removeAttribute('aria-invalid'); } });
  }

  // ---- wordmark ----
  const word = document.querySelector('[data-word]');
  if (!word || calm || !gsap) return;
  const letters = [...word.children];
  if (ScrollTrigger) {
    gsap.from(letters, { yPercent: 100, duration: 1.3, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: word, start: 'top 95%', once: true } });
    word.style.clipPath = 'inset(-60% -4% -0.05em -4%)';
  }
  if (!fine) return;
  const sy = letters.map(() => 1);
  loop(word, (dt) => {
    const r = word.getBoundingClientRect();
    const near = pointer.active && pointer.y > r.top - 200 && pointer.y < r.bottom + 60;
    letters.forEach((el, i) => {
      const lr = el.getBoundingClientRect();
      const cx = lr.left + lr.width / 2;
      const d = Math.abs(pointer.x - cx) / (r.width * 0.16);
      const want = near ? 1 + 0.16 * Math.exp(-d * d) : 1;
      sy[i] = damp(sy[i], want, 8, dt);
      el.style.scale = `1 ${sy[i].toFixed(4)}`;
    });
  });
}
