// cookies.html: what this browser holds, and the switches.
//   - every crestora: item in local and session storage is read and shown on its row of the table ("On this device:
//     Yearly"); an item the table doesn't describe gets a row of its own, so the list stays honest as the site grows.
//   - the preferences panel: role="switch" buttons (Essential is locked on); Save choices stores them in
//     crestora:cookies and toasts (with Preferences off it also clears the preference items already kept); Reset
//     everything clears every crestora: item from local and session storage, puts the switches back to their
//     defaults and toasts.
// Nothing moves here, so calm needs no special case. Storage that throws (private windows, blocked) reads as empty.
import { store, toast, $, $$ } from '../core.js';

const PREFIX = 'crestora:';
const DEFAULTS = { preferences: true, analytics: false };
// the items a "Preferences: off" save clears (crestora:cookies itself is essential: it remembers that choice)
const PREFERENCE_ITEMS = [['local', 'billing'], ['local', 'api-lang'], ['local', 'roadmap-votes'], ['local', 'tutorials'], ['local', 'docs-helpful'], ['session', 'seen']];

const date = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function area(where) {
  try { const s = where === 'session' ? sessionStorage : localStorage; void s.length; return s; } catch { return null; }
}
/** every crestora: item, as { where, key, raw } */
function items() {
  const out = [];
  for (const where of ['local', 'session']) {
    const s = area(where);
    if (!s) continue;
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(PREFIX)) out.push({ where, key: k.slice(PREFIX.length), raw: s.getItem(k) });
    }
  }
  return out;
}
function remove(where, key) {
  const s = area(where);
  if (!s || s.getItem(PREFIX + key) === null) return 0;
  try { s.removeItem(PREFIX + key); return 1; } catch { return 0; }
}

/** what an item holds, in a few words */
function describe(key, raw) {
  let v = raw;
  try { v = JSON.parse(raw); } catch {}
  const count = (x) => (Array.isArray(x) ? x.length : x && typeof x === 'object' ? Object.keys(x).length : 0);
  switch (key) {
    case 'seen': return 'set in this tab';
    case 'billing': return v === 'monthly' ? 'Monthly' : v === 'yearly' ? 'Yearly' : String(v);
    case 'api-lang': return String(v);
    case 'roadmap-votes': return plural(count(v), 'vote');
    case 'tutorials': return plural(count(v), 'lesson') + ' done';
    case 'docs-helpful': return plural(count(v), 'answer');
    case 'cookies': return v && v.saved ? `saved ${date(v.saved)}` : 'saved';
    default: {
      const text = typeof v === 'string' ? v : JSON.stringify(v);
      return text.length > 28 ? `${text.slice(0, 27)}…` : text;
    }
  }
}

export default function init() {
  const panel = $('[data-ck-prefs]');
  const rows = $('[data-ck-rows]');
  const count = $('[data-ck-count]');
  const status = $('[data-ck-status]');
  if (!panel) return;

  // ---- the table: what this browser holds right now ----
  function refresh() {
    const all = items();
    const known = new Set();
    for (const live of $$('[data-ck-live]')) {
      const hit = all.find((it) => it.key === live.dataset.ckLive && it.where === live.dataset.ckWhere);
      known.add(`${live.dataset.ckWhere}:${live.dataset.ckLive}`);
      live.classList.toggle('is-on', !!hit);
      live.textContent = '';
      if (hit) {
        live.append('On this device: ');
        const b = document.createElement('b');
        b.textContent = describe(hit.key, hit.raw);
        live.append(b);
      }
    }
    // anything stored that the table doesn't describe gets a row of its own
    for (const tr of $$('tr[data-ck-extra]', rows)) tr.remove();
    for (const it of all.filter((x) => !known.has(`${x.where}:${x.key}`))) rows?.append(extraRow(it));
    if (count) {
      const n = all.length;
      count.textContent = '';
      if (!n) count.append('This browser holds no Crestora items right now.');
      else {
        count.append('This browser holds ');
        const b = document.createElement('strong');
        b.textContent = plural(n, 'Crestora item');
        count.append(b, ' right now.');
      }
    }
  }
  function extraRow(it) {
    const tr = document.createElement('tr');
    tr.dataset.ckExtra = '';
    const cell = (label, ...kids) => { const td = document.createElement('td'); if (label) td.dataset.label = label; td.append(...kids); return td; };
    const code = document.createElement('code'); code.textContent = PREFIX + it.key;
    const where = document.createElement('span'); where.className = 'ck-where'; where.textContent = it.where === 'session' ? 'Session storage' : 'Local storage';
    const live = document.createElement('span'); live.className = 'ck-live is-on'; live.append('On this device: ');
    const b = document.createElement('b'); b.textContent = describe(it.key, it.raw); live.append(b);
    const cat = document.createElement('span'); cat.className = 'ck-cat'; cat.textContent = 'Preferences';
    tr.append(
      cell('', code, where, live),
      cell('What it remembers', 'A setting saved by another page of this site, not described here yet. Reset everything clears it too.'),
      cell('How long', it.where === 'session' ? 'Until you close the tab' : 'Until you clear it'),
      cell('Kind', cat),
    );
    return tr;
  }

  // ---- the switches ----
  const switches = $$('[data-ck-switch]', panel);
  const get = (name) => switches.find((s) => s.dataset.ckSwitch === name)?.getAttribute('aria-checked') === 'true';
  const set = (name, on) => {
    const sw = switches.find((s) => s.dataset.ckSwitch === name);
    if (!sw) return;
    sw.setAttribute('aria-checked', String(!!on));
    const state = $(`[data-ck-state="${name}"]`, panel);
    if (state) state.textContent = on ? 'On' : 'Off';
  };
  for (const sw of switches) sw.addEventListener('click', () => set(sw.dataset.ckSwitch, sw.getAttribute('aria-checked') !== 'true'));
  // the locked one says why when it's pressed
  for (const sw of $$('.switch[aria-disabled="true"]', panel)) sw.addEventListener('click', () => toast('Essential stays on: it’s what signs you in.', 'Locked'));

  const describeChoice = (c) => `Preferences ${c.preferences ? 'on' : 'off'}, Analytics ${c.analytics ? 'on' : 'off'}`;
  function showStatus(saved) {
    if (!status) return;
    status.textContent = '';
    if (!saved) { status.append('Using the defaults. Nothing saved yet.'); return; }
    status.append(`Saved ${date(saved.saved)}: `);
    const b = document.createElement('b'); b.textContent = describeChoice(saved);
    status.append(b);
  }

  const saved = store.get('cookies', null);
  const start = saved && typeof saved === 'object' ? { ...DEFAULTS, ...saved } : DEFAULTS;
  set('preferences', start.preferences);
  set('analytics', start.analytics);
  showStatus(saved && typeof saved === 'object' ? saved : null);

  $('[data-ck-save]', panel)?.addEventListener('click', () => {
    const choice = { preferences: get('preferences'), analytics: get('analytics'), saved: new Date().toISOString() };
    let cleared = 0;
    if (!choice.preferences) for (const [where, key] of PREFERENCE_ITEMS) cleared += remove(where, key);
    store.set('cookies', choice);
    showStatus(choice);
    refresh();
    toast(cleared ? `Saved. Preferences are off, so ${plural(cleared, 'kept setting')} ${cleared === 1 ? 'was' : 'were'} cleared.` : `Saved: ${describeChoice(choice)}.`, 'Saved');
  });

  $('[data-ck-reset]', panel)?.addEventListener('click', () => {
    let n = 0;
    for (const it of items()) n += remove(it.where, it.key);
    set('preferences', DEFAULTS.preferences);
    set('analytics', DEFAULTS.analytics);
    showStatus(null);
    refresh();
    toast(n ? `Cleared ${plural(n, 'item')}. This site now remembers nothing.` : 'Nothing to clear: this browser holds no Crestora items.', 'Reset');
  });

  // another tab may change what's stored
  addEventListener('storage', (e) => { if (!e.key || e.key.startsWith(PREFIX)) refresh(); });
  refresh();
}
