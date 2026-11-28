// Everything you need: three tabs (roving tabindex, arrow keys) that play through on their own while on screen, the
// active one filling as it waits, until someone picks one or presses pause. A change fades the copy and the panels out
// and back with the new numbers, and tells the laptop's screen (scenes.js) which to show.

import { calm, emit, whenVisible, loop, autoplay } from './core.js';

const TABS = {
  live: {
    tag: 'Live Network Activity', title: 'Real-Time Network Activity', body: 'Monitor incoming and outgoing traffic across your network in real time.',
    mediaTitle: 'Network Activity', mediaPill: '#Finance-DB-01', flag: 'Threat Identified',
    aTitle: 'Threat Detection Matrix', aValue: '12', aLabel: 'Flagged Events', bTitle: 'Network Traffic Overview', bValue: '1.8 GB', bLabel: 'Network Traffic',
  },
  ai: {
    tag: 'AI Threat Intelligence', title: 'Predictive Threat Detection', body: 'Models learn what normal looks like on your network and flag what isn’t, before it spreads.',
    mediaTitle: 'Behaviour Model', mediaPill: '#Payroll-API', flag: 'Anomaly Predicted',
    aTitle: 'Anomaly Score Matrix', aValue: '3', aLabel: 'High-Risk Signals', bTitle: 'Signals Analysed', bValue: '4.2M', bLabel: 'Events per Hour',
  },
  auto: {
    tag: 'Automated Playbooks', title: 'Instant, Automated Response', body: 'Isolate devices, block IPs and roll back changes in seconds, with or without a human in the loop.',
    mediaTitle: 'Response Timeline', mediaPill: '#Laptop-MK-07', flag: 'Device Isolated',
    aTitle: 'Containment Matrix', aValue: '0.8s', aLabel: 'Mean Time to Respond', bTitle: 'Blocked Connections', bValue: '9,412', bLabel: 'Last 24 Hours',
  },
};
const DWELL = 7.5;

export function init() {
  const list = document.querySelector('[data-tabs]');
  const panel = document.querySelector('[data-panel]');
  if (!list || !panel) return;
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const fields = [...panel.querySelectorAll('[data-p]')];
  let current = 0; let wait = 0; let timer = 0;

  function select(i, { focus = false } = {}) {
    if (i === current) return;
    current = i; wait = 0;
    tabs.forEach((t, k) => {
      const on = k === i;
      t.classList.toggle('is-on', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      t.style.setProperty('--p', 0);
    });
    if (focus) tabs[i].focus();
    panel.setAttribute('aria-labelledby', tabs[i].id);
    const key = tabs[i].dataset.tab; const d = TABS[key];
    emit('tab', { key, index: i });
    const apply = () => { for (const f of fields) if (d[f.dataset.p] != null) f.textContent = d[f.dataset.p]; };
    if (calm) { apply(); return; }
    clearTimeout(timer);
    panel.classList.add('is-swapping');
    timer = setTimeout(() => { apply(); requestAnimationFrame(() => panel.classList.remove('is-swapping')); }, 420);
  }

  // a tab someone picked stays picked
  const play = calm ? null : autoplay(list.closest('section'), () => { wait = 0; tabs.forEach((t) => t.style.setProperty('--p', 0)); });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { play?.stop(); select(i); });
    t.addEventListener('keydown', (e) => {
      const k = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[e.key];
      if (k === undefined) return;
      e.preventDefault(); play?.stop();
      const n = k === -Infinity ? 0 : k === Infinity ? tabs.length - 1 : (i + k + tabs.length) % tabs.length;
      select(n, { focus: true });
    });
  });

  if (!play) return;
  const run = loop((dt) => {
    if (play.held()) return;
    wait += dt;
    tabs[current].style.setProperty('--p', Math.min(1, wait / DWELL).toFixed(4));
    if (wait >= DWELL) select((current + 1) % tabs.length);
  });
  whenVisible(panel, (v) => run.set(v), '-15% 0px');
}
