// tutorials.html: lessons marked as done (kept in this browser as crestora:tutorials) light the paths' six-lane bars,
// the hero's count and the library cards; the featured lesson's chapters and transcript times move the playhead on
// the poster mock, and Play runs a short preview through the chapters; links into the library clear its filters
// first when the lesson they point at is filtered out.
import { store, odometer, toast, whenVisible, clamp, $, $$ } from '../core.js';
import { keepFocusInStrips } from './page-strips.js';

const KEY = 'tutorials';
const LENGTH = 720; // the featured lesson: 12:00
const PREVIEW = 60; // the preview plays at 60×: the whole lesson in twelve seconds

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function init({ calm }) {
  keepFocusInStrips(...$$('.tu-chips'));
  progress();
  player(calm);
  libraryLinks();
}

// ---- progress: one set of done lessons, mirrored by every checkbox that names a lesson ----
function progress() {
  const boxes = $$('input[data-lesson]');
  if (!boxes.length) return;
  const known = new Set(boxes.map((b) => b.dataset.lesson));
  const saved = store.get(KEY, []);
  const done = new Set((Array.isArray(saved) ? saved : []).filter((s) => known.has(s)));
  const cards = $$('[data-lesson-card]');
  const titleOf = (slug) => cards.find((c) => c.dataset.lessonCard === slug)?.querySelector('.tu-card__title')?.textContent.trim() || 'Lesson';
  const paths = $$('[data-path]');
  const total = $('[data-tu-total]');

  const render = () => {
    const completed = [];
    for (const b of boxes) b.checked = done.has(b.dataset.lesson);
    for (const c of cards) c.classList.toggle('is-done', done.has(c.dataset.lessonCard));
    for (const p of paths) {
      const list = p.dataset.lessons.split(/\s+/);
      const n = list.filter((s) => done.has(s)).length;
      const bar = $('.tu-lanes', p);
      bar.style.setProperty('--p', (n / list.length).toFixed(4));
      bar.setAttribute('aria-valuenow', String(n));
      bar.setAttribute('aria-valuetext', `${n} of ${list.length} lessons done`);
      $('[data-path-done]', p).textContent = String(n);
      const complete = n === list.length;
      if (complete && !p.classList.contains('is-complete')) completed.push($('.tu-path__title', p).textContent.trim());
      p.classList.toggle('is-complete', complete);
      // the path's link points at its next lesson, or, once it is all done, at the community
      const next = $('[data-path-next]', p);
      const i = list.findIndex((s) => !done.has(s));
      const steps = $$('.tu-step__t', p).map((el) => el.textContent.trim());
      const label = complete ? 'Path complete. Show the crew' : `${n ? 'Next' : 'Start with'}: ${steps[i]}`;
      next.setAttribute('href', complete ? 'community.html' : `#lesson-${list[i]}`);
      if (next.firstChild?.nodeType === 3) next.firstChild.textContent = `${label} `;
    }
    if (total) odometer(total, done.size);
    return completed;
  };

  render();

  for (const b of boxes) {
    b.addEventListener('change', () => {
      const slug = b.dataset.lesson;
      if (b.checked) done.add(slug); else done.delete(slug);
      store.set(KEY, [...done]);
      const completed = render();
      if (completed.length) toast(`Path complete: ${completed[0]}`, 'Done');
      else if (b.checked) toast(`${titleOf(slug)}, marked as done`, 'Saved');
    });
  }
}

// ---- the featured lesson's player ----
function player(calm) {
  const pl = $('[data-tu-player]');
  if (!pl) return;
  const chapters = $$('[data-chapter]');
  // the chapters and transcript times are disabled in the page (without scripts they do nothing): turn them on
  for (const b of [...chapters, ...$$('[data-seek]')]) b.disabled = false;
  const starts = chapters.map((b) => Number(b.dataset.t));
  const names = chapters.map((b) => b.querySelector('.tu-chapters__t')?.firstChild?.textContent.trim() || '');
  const timeEl = $('[data-tu-time]', pl);
  const nowEl = $('[data-tu-now]', pl);
  const play = $('[data-tu-play]', pl);
  const lines = $$('[data-seek]').map((b) => ({ t: Number(b.dataset.seek), li: b.closest('li') }));
  let t = 0, playing = false, raf = 0, last = 0, visible = true;

  const chapterAt = (s) => starts.reduce((acc, st, k) => (s >= st ? k : acc), 0);
  const set = (s) => {
    t = clamp(s, 0, LENGTH);
    pl.style.setProperty('--t', (t / LENGTH).toFixed(4));
    timeEl.textContent = mmss(t);
    const i = chapterAt(t);
    if (pl.dataset.ch !== String(i + 1) || !nowEl.dataset.set) {
      pl.dataset.ch = String(i + 1);
      chapters.forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
      nowEl.textContent = `Chapter ${i + 1}: ${names[i]}`;
      nowEl.dataset.set = '1';
    }
    // the line of the transcript being said at t
    lines.forEach((l, k) => {
      const end = k < lines.length - 1 ? lines[k + 1].t : l.t + 30;
      l.li.classList.toggle('is-now', t >= l.t && t < end);
    });
  };

  const stop = () => {
    playing = false;
    cancelAnimationFrame(raf);
    pl.classList.remove('is-playing');
    play?.setAttribute('aria-pressed', 'false');
  };
  const frame = (now) => {
    if (!playing) return;
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    set(t + dt * PREVIEW);
    if (t >= LENGTH) { stop(); return; }
    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (t >= LENGTH - 1) set(0);
    playing = true;
    pl.classList.add('is-playing');
    play.setAttribute('aria-pressed', 'true');
    last = performance.now();
    if (visible) raf = requestAnimationFrame(frame);
  };

  set(Number(chapters.find((b) => b.hasAttribute('aria-current'))?.dataset.t ?? 0));

  play?.addEventListener('click', () => {
    if (calm) {
      // at rest: no running playhead; Play steps to the next chapter
      const i = chapterAt(t);
      set(i + 1 < starts.length ? starts[i + 1] : 0);
      return;
    }
    if (playing) stop(); else start();
  });
  for (const b of chapters) b.addEventListener('click', () => { stop(); set(Number(b.dataset.t)); });
  for (const b of $$('[data-seek]')) b.addEventListener('click', () => { stop(); set(Number(b.dataset.seek)); });

  // the preview pauses off screen and picks up where it was
  whenVisible(pl, (on) => {
    visible = on;
    cancelAnimationFrame(raf);
    if (on && playing) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }, '0px');
}

// ---- links into the library land on their card even when the filters hide it ----
function libraryLinks() {
  const groups = $$('[data-filter-group]');
  const clear = () => {
    for (const g of groups) {
      const all = g.querySelector('[data-filter="all"]');
      if (all && all.getAttribute('aria-pressed') !== 'true') all.click();
    }
  };
  // capture phase: runs before the shared anchor glide measures where the card is
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#lesson-"]');
    if (!a) return;
    const card = document.getElementById(a.getAttribute('href').slice(1));
    if (!card) return;
    if (card.hidden) clear();
    card.classList.remove('is-flash');
    setTimeout(() => {
      card.classList.add('is-flash');
      setTimeout(() => card.classList.remove('is-flash'), 1800);
    }, 700);
  }, true);
  $('[data-tu-clear]')?.addEventListener('click', clear);
}
