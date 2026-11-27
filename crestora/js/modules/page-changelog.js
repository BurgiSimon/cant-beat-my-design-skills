// changelog.html: the releases as a lane.
//   - the rail runs from the first release's node to the last stop; its fill is a gradient through each release's
//     stage colour, placed at that release's node, and it is scrubbed by the scroll so the road fills as you read;
//   - each release lights (its node in its stage colour, its version in white) as its node reaches the middle of
//     the screen;
//   - the generic filter module hides releases without the chosen kind of change; this focuses what is left on that
//     kind (data-only) and says how many changes match;
//   - copy-link buttons copy a link to their release (#v4-12).
// Reduced motion or no GSAP: the rail stays filled and every release lit.
import { $, $$, gsap, ScrollTrigger, toast } from '../core.js';
import { copyText } from './copy.js';

const NOUN = { new: ['new feature', 'new features'], improved: ['improvement', 'improvements'], fixed: ['fix', 'fixes'] };
const plural = (n, [one, many]) => `${n} ${n === 1 ? one : many}`;

export default function init({ calm }) {
  const scope = $('.cl-log');
  const road = scope && $('.cl-road', scope);
  const list = road && $('.cl-timeline', road);
  if (!list) return;
  const rail = $('.cl-rail', road);
  const fill = $('.cl-rail__fill', rail);
  const end = $('.cl-node--end', road);
  const entries = $$('.cl-entry', list);
  const count = $('[data-filter-count]', scope);

  // ---- copy a link to a release ----
  for (const b of $$('[data-cl-copy]', list)) {
    b.hidden = false;
    const id = b.dataset.clCopy;
    const name = $('.cl-ver', b.closest('.cl-entry'))?.textContent.trim() || id;
    b.setAttribute('aria-label', `Copy link to ${name}`);
    b.addEventListener('click', async () => {
      const ok = await copyText(`${location.origin}${location.pathname}#${id}`);
      toast(ok ? `Link to ${name} copied` : 'Copy is blocked here', ok ? 'Copied' : 'Oops');
    });
  }

  // ---- the rail: from the first visible node to the last stop, its colours at each release's node ----
  const centre = (node) => { const r = node.getBoundingClientRect(); return r.top + r.height / 2; };
  let live = false, was = '';
  const layout = () => {
    const shown = entries.filter((e) => !e.hidden);
    if (!shown.length || !end) { rail.style.opacity = '0'; return; }
    rail.style.opacity = '';
    const base = road.getBoundingClientRect().top;
    const top = centre($('.cl-node', shown[0])) - base;
    const bottom = centre(end) - base;
    const h = Math.max(1, bottom - top);
    road.style.setProperty('--rail-top', `${top.toFixed(1)}px`);
    road.style.setProperty('--rail-h', `${h.toFixed(1)}px`);
    const stops = shown.map((e) => {
      const y = ((centre($('.cl-node', e)) - base - top) / h) * 100;
      return `${getComputedStyle(e).getPropertyValue('--stage').trim()} ${y.toFixed(2)}%`;
    });
    const last = getComputedStyle(shown[shown.length - 1]).getPropertyValue('--stage').trim();
    rail.style.setProperty('--rail-grad', `linear-gradient(180deg, ${stops.join(', ')}, color-mix(in srgb, ${last} 30%, transparent) 100%)`);
    // the scrub's start and end follow the rail, so measure again when it moved
    const now = `${top.toFixed(0)}:${h.toFixed(0)}`;
    if (live && now !== was) requestAnimationFrame(() => ScrollTrigger.refresh());
    was = now;
  };

  // ---- focus the releases on one kind of change, and count it ----
  const summarise = (kind) => {
    const shown = entries.filter((e) => !e.hidden);
    const rel = plural(shown.length, ['release', 'releases']);
    if (!kind || kind === 'all') {
      const changes = shown.reduce((n, e) => n + $$('.cl-text, .cl-change', e).length, 0);
      return `${rel} · ${changes} changes`;
    }
    const n = shown.reduce((sum, e) => sum + $$(`.cl-text[data-kind="${kind}"], .cl-change[data-kind="${kind}"]`, e).length, 0);
    return `${plural(n, NOUN[kind])} in ${rel}`;
  };
  const focus = (kind = 'all') => {
    list.dataset.only = kind;
    if (count) count.textContent = summarise(kind);
    was = '';   // the releases moved: the scrub and the nodes measure again
    layout();
  };
  scope.addEventListener('filter:change', (e) => focus(e.detail?.wanted?.[0]));
  focus($('[data-filter][aria-pressed="true"]', scope)?.dataset.filter);

  addEventListener('resize', layout, { passive: true });
  document.fonts?.ready.then(layout);
  addEventListener('load', layout, { once: true });

  // ---- motion: the rail fills with the reading, and releases light as they reach the middle ----
  if (calm || !gsap || !ScrollTrigger) return;
  road.classList.add('is-live');
  live = true;
  road.style.setProperty('--fill', '0');
  ScrollTrigger.create({
    trigger: rail, start: 'top 50%', end: 'bottom 50%',
    onUpdate: (self) => {
      road.style.setProperty('--fill', self.progress.toFixed(4));
      // a soft white head rides the front of the fill while it is moving through the releases
      road.style.setProperty('--head', self.progress > 0.002 && self.progress < 0.998 ? '1' : '0');
    },
    onRefresh: (self) => road.style.setProperty('--fill', self.progress.toFixed(4)),
  });
  for (const e of entries) {
    ScrollTrigger.create({
      trigger: $('.cl-node', e), start: 'center 50%',
      onEnter: () => e.classList.add('is-lit'),
      onLeaveBack: () => e.classList.remove('is-lit'),
      onRefresh: (self) => e.classList.toggle('is-lit', self.progress > 0),
    });
  }
  layout();
  void fill;
}
