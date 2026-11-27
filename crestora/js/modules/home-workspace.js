// Home #workspace: the app window's life. The generic tabs module switches its views (and keeps the phone tabs in
// step); this crossfades them, opens a pane narrower than the lane on the story, and plays the story: frame 118
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

  // ---- the views: the one leaving fades out over the one arriving. While it fades it is still drawn, so it is made
  // inert: Tab goes on to the view that is arriving, and a screen reader is never sent into the one on its way out ----
  const views = $$('.ws-view', mock);
  const leaving = new Map();
  const settle = (v) => { clearTimeout(leaving.get(v)); leaving.delete(v); v.classList.remove('is-leaving'); v.removeAttribute('aria-hidden'); v.inert = false; };
  let current = views.find((v) => !v.hidden);
  section.addEventListener('tabs:change', (e) => {
    const next = document.getElementById(e.detail.tab.getAttribute('aria-controls'));
    if (!next || next === current || !views.includes(next)) return;
    if (leaving.has(next)) settle(next);
    const old = current;
    current = next;
    if (!old || calm) return;
    old.classList.add('is-leaving');
    old.setAttribute('aria-hidden', 'true');
    old.inert = true;
    leaving.set(old, setTimeout(() => settle(old), 420));
  });

  // ---- a pane narrower than the lane (phones) opens on Review and Launch, where the story plays; the start of the
  // lane is a swipe to the right ----
  // (only a touch on a pane that can pan keeps it where the reader left it: a click on the window's own tabs on a wide
  // screen does not stop it opening on the story once the screen turns narrow)
  let touched = false;
  pane?.addEventListener('pointerdown', () => { if (pane.scrollWidth > pane.clientWidth + 2) touched = true; }, { passive: true });
  const openPane = () => {
    if (!pane || touched) return;
    if (pane.scrollWidth <= pane.clientWidth + 2) { pane.scrollLeft = 0; return; }
    // Review is the fourth of the lane's six columns: it starts halfway across the views
    const views = $('.ws-views', main);
    const x = views.getBoundingClientRect().left - pane.getBoundingClientRect().left + pane.scrollLeft + views.offsetWidth / 2;
    pane.scrollLeft = Math.max(0, x - (parseFloat(getComputedStyle(pane).paddingLeft) || 0) - 12);
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
