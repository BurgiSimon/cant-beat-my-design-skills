// Home #workspace: the app window's life. The generic tabs module switches its views (and keeps the phone tabs in
// step); this crossfades them, opens the phone pane on the lane rather than the sidebar, and plays the story: frame 118
// waits in Review, a notice slides in ("Lena approved frame 118"), its chip turns green, the activity rail logs it and
// the card rolls on to Launch, then it all resets and waits again. Each beat is a class on .ws-mock and CSS does the
// moving, in every view at once. The story pauses off screen, while the tab is hidden, or when the viewer pauses it;
// under reduced motion (and ?still) it never starts and the window rests on its last frame, as the markup has it.
import { $, $$, whenVisible } from '../core.js';

const BEATS = ['is-noticed', 'is-approved', 'is-logged', 'is-moved'];

export default function init({ calm, still }) {
  const section = $('#workspace');
  const mock = section && $('.ws-mock', section);
  if (!mock) return;
  const pane = $('.ws-pane', section);
  const main = $('.ws-main', mock);

  // ---- the views: the one leaving fades out over the one arriving ----
  const views = $$('.ws-view', mock);
  const leaving = new Map();
  let current = views.find((v) => !v.hidden);
  section.addEventListener('tabs:change', (e) => {
    const next = document.getElementById(e.detail.tab.getAttribute('aria-controls'));
    if (!next || next === current || !views.includes(next)) return;
    if (leaving.has(next)) { clearTimeout(leaving.get(next)); leaving.delete(next); next.classList.remove('is-leaving'); next.removeAttribute('aria-hidden'); }
    const old = current;
    current = next;
    if (!old || calm) return;
    old.classList.add('is-leaving');
    old.setAttribute('aria-hidden', 'true');
    leaving.set(old, setTimeout(() => { old.classList.remove('is-leaving'); old.removeAttribute('aria-hidden'); leaving.delete(old); }, 420));
  });

  // ---- phones: the pane opens on the lane itself; the sidebar is a swipe to the left ----
  let touched = false;
  pane?.addEventListener('pointerdown', () => { touched = true; }, { passive: true });
  const openPane = () => {
    if (!pane || touched) return;
    pane.scrollLeft = pane.scrollWidth > pane.clientWidth + 2 ? Math.max(0, main.offsetLeft - 12) : 0;
  };
  openPane();
  addEventListener('resize', openPane, { passive: true });
  document.fonts?.ready.then(openPane);

  if (calm || still) return;

  // ---- the story ----
  const pause = $('.ws-pause', section);
  const label = pause && $('.ws-pause__label', pause);
  const on = (c) => mock.classList.add(c);
  const off = (c) => mock.classList.remove(c);
  // back to the first frame without gliding there: the card is out of sight while it jumps
  const rewind = () => {
    on('is-instant');
    for (const c of BEATS) off(c);
    void mock.offsetWidth;
    off('is-instant');
  };
  const steps = [
    [1800, () => on('is-noticed')],
    [2350, () => on('is-approved')],
    [2800, () => on('is-logged')],
    [3500, () => on('is-moved')],
    [5800, () => off('is-noticed')],
    [9400, () => on('is-fading')],
    [9900, rewind],
    [10900, () => off('is-fading')],
    [12400, null],
  ];

  let i = 0, startAt = 0, timer = 0, running = false;
  const next = () => { timer = setTimeout(tick, Math.max(0, steps[i][0] - (performance.now() - startAt))); };
  function tick() {
    steps[i][1]?.();
    if (++i >= steps.length) { i = 0; startAt = performance.now(); }
    next();
  }
  let pausedAt = 0;
  const play = () => { if (running) return; running = true; startAt = performance.now() - pausedAt; next(); };
  const stop = () => { if (!running) return; running = false; clearTimeout(timer); pausedAt = performance.now() - startAt; };

  // the markup rests on the last frame; the story starts from the first
  rewind();

  let seen = false, held = false;
  const sync = () => (seen && !held && !document.hidden ? play() : stop());
  whenVisible(mock, (v) => { seen = v; sync(); }, '0px');
  document.addEventListener('visibilitychange', sync);

  const loop = $('.ws-caption__loop', section);
  if (loop) loop.hidden = false;
  if (pause) {
    pause.hidden = false;
    pause.addEventListener('click', () => {
      held = !held;
      pause.toggleAttribute('data-held', held);
      label.textContent = held ? 'Play the story' : 'Pause the story';
      sync();
    });
  }
}
