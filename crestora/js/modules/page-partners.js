// partners.html: the tier ladder and the apply form's program.
//   - the ladder is a tablist (click, hover with a fine pointer, arrow keys, Home/End): the chosen tier's benefits
//     show, and the road lights from its start up to that tier, stretch by stretch (each tier keeps the ones below);
//   - the program radios are preselected from ?program= or by the program cards' Apply links, and a pick clears the
//     group's error.
// Without scripts every tier's benefits show one after another and the whole road is lit; under reduced motion the
// road lights at once and nothing glides.
import { $, $$, fine, whenVisible } from '../core.js';

export default function init({ calm }) {
  ladder(calm);
  program();
}

function ladder(calm) {
  const root = $('[data-ladder]');
  if (!root) return;
  const tabs = $$('[role="tab"]', root);
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  const segs = $$('.pt-road__seg', root);
  const nodes = $$('.pt-road__node', root);
  let current = 0;
  let lit = -1;      // how far the road is lit (-1: not yet, until it is first seen)
  // a tier that is not chosen is inert at once, though it takes 0.45 s to fade out: Tab never lands in a panel that is
  // about to turn hidden (which would drop focus to the page)
  panels.forEach((p, i) => { if (p) p.inert = i !== current; });
  // the tabs come out of hiding (without scripts they are a picture of the ladder above the full list)
  root.querySelector('[role="tablist"]')?.removeAttribute('aria-hidden');
  tabs.forEach((t, i) => { t.tabIndex = i === current ? 0 : -1; });

  // light stretches 0..k: new stretches draw in one after another, dropped ones retract from the far end
  const light = (k) => {
    const prev = lit;
    segs.forEach((s, i) => {
      const on = i <= k;
      const d = calm ? 0 : on ? Math.max(0, i - prev - 1) * 0.32 : Math.max(0, prev - i) * 0.16;
      s.style.setProperty('--d', `${d}s`);
      s.classList.toggle('is-lit', on);
    });
    nodes.forEach((n, i) => {
      // a node lights as its stretch starts to draw
      const on = i <= k;
      const d = calm ? 0 : on ? Math.max(0, i - prev - 1) * 0.32 : 0;
      n.style.transitionDelay = `${d}s`;
      n.classList.toggle('is-lit', on);
    });
    lit = k;
  };

  const select = (k, { focus = false } = {}) => {
    if (k === current && !focus) return;
    current = k;
    tabs.forEach((t, i) => {
      const on = i === k;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panels[i]?.classList.toggle('is-on', on);
      if (panels[i]) panels[i].inert = !on;
    });
    if (focus) tabs[k].focus();
    if (lit >= 0) light(k);
  };

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    if (fine) t.addEventListener('pointerenter', () => select(i));
  });
  root.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select((next + tabs.length) % tabs.length, { focus: true });
  });

  // the road lights up to the chosen tier once the ladder is first seen
  if (calm) light(current);
  else {
    const stop = whenVisible(root, (v) => { if (v && lit < 0) { setTimeout(() => light(current), 250); stop(); } }, '-15% 0px');
  }
}

function program() {
  const radios = $$('input[name="program"]');
  if (!radios.length) return;
  const group = radios[0].closest('fieldset');
  const clear = () => {
    for (const r of radios) r.removeAttribute('aria-invalid');
    const err = group?.querySelector('.field__error');
    if (err) err.textContent = '';
  };
  const pick = (value) => {
    const r = radios.find((x) => x.value === value);
    if (!r) return;
    r.checked = true;
    clear();
  };
  pick(new URLSearchParams(location.search).get('program'));
  for (const a of $$('[data-apply-program]')) a.addEventListener('click', () => pick(a.dataset.applyProgram));
  group?.addEventListener('change', clear);
}
