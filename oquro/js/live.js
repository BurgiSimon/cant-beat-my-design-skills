// The cards that are always on: the threat card's radar and its alarm when the vault is tampered with, the timeline,
// the matrix and the traffic grid, the performance bars, the dot display, the live counters and the local time.
// Each runs only while it is on screen.

import { calm, on, once, emit, whenVisible, loop, fmt, ScrollTrigger } from './core.js';
import * as V from './viz.js';

// A status line for screen readers: emptied first, so the same words said twice are heard twice.
function say(el, text) {
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 120);
}

function running(el, tick) {
  const run = loop(tick);
  if (calm) { tick(0.016); return run; }
  whenVisible(el, (v) => run.set(v));
  return run;
}

export function init() {
  // ---- the threat card ----
  const card = document.querySelector('[data-threat]');
  if (card) {
    const rd = V.radar(card.querySelector('.radar__svg'));
    const title = card.querySelector('[data-threat-title]');
    const time = card.querySelector('.widget__time');
    const risk = card.querySelector('[data-risk]');
    const status = card.querySelector('[data-threat-status]'); // the card's text can't be live (its clock ticks), so this tells
    let clockMin = 2 * 60 + 45; let acc = 0;
    running(card, (dt) => {
      rd.tick(dt);
      acc += dt; if (acc > 6) { acc = 0; clockMin++; if (!card.classList.contains('is-alarm')) time.textContent = V.clock(clockMin); }
    });
    on('vault:open', () => {
      rd.alarm(4.2);
      card.classList.add('is-alarm');
      title.textContent = 'Vault Tampering'; time.textContent = 'Just now';
      risk.lastChild.textContent = 'High';
      say(status, 'Alarm: vault tampering detected, high risk.');
      card.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }], { duration: 380, easing: 'ease-out', composite: 'add' });
    });
    on('vault:close', () => {
      card.classList.remove('is-alarm');
      title.textContent = 'Suspicious Login'; time.textContent = V.clock(clockMin);
      risk.lastChild.textContent = 'Risk';
      say(status, 'Alarm cleared.');
    });
    // the face in the card spins the wheel for those who can't drag it. Where there is no wheel to turn (no WebGL,
    // or reduced motion), it raises the alarm itself.
    let wheel = !calm;
    once('hero:gl', (d) => { wheel = !!d && !calm; });
    let busy = false;
    card.querySelector('[data-spin]')?.addEventListener('click', () => {
      if (wheel) { emit('vault:spin'); return; }
      if (busy) return;
      busy = true; emit('vault:open');
      setTimeout(() => { emit('vault:close'); busy = false; }, 4200);
    });
  }

  // ---- the features panel: timeline, matrix, traffic ----
  const panel = document.querySelector('[data-panel]');
  if (panel) {
    const tl = V.timeline(panel.querySelector('[data-timeline-track]'));
    const mx = V.matrix(panel.querySelector('[data-matrix-cols]'));
    const dg = V.dotgrid(panel.querySelector('[data-dotgrid]'));
    running(panel, (dt) => { tl.tick(dt); mx.tick(dt); dg.tick(dt); });
    const alert = panel.querySelector('[data-alert]');
    let shown = false; whenVisible(panel, (v) => { shown = v; });
    const ping = () => { if (!alert) return; alert.classList.remove('is-ping'); void alert.offsetWidth; alert.classList.add('is-ping'); };
    const told = panel.querySelector('[data-alert-status]'); const what = panel.querySelector('[data-p="aTitle"]');
    alert?.addEventListener('click', () => {
      ping(); mx.heat(); dg.jump(); setTimeout(() => mx.calm(), 2400);
      say(told, `Alert raised on the ${what ? what.textContent : 'matrix'}.`); // what it does is drawn
    });
    on('tab', ({ index }) => { tl.start(14 * 60 + 27 + index * 41); dg.jump(); });
    if (!calm) setInterval(() => { if (shown) ping(); }, 5200);
  }

  // ---- performance bars, grown when they come into view ----
  const pb = document.querySelector('[data-perf-bars]');
  if (pb) {
    const b = V.bars(pb);
    if (calm) b.grow();
    else {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setTimeout(() => b.grow(), 250); io.disconnect(); } }, { threshold: 0.4 });
      io.observe(pb);
      running(pb, (dt) => b.tick(dt));
    }
  }

  // ---- the about card's dot display ----
  const dm = document.querySelector('[data-matrix]');
  if (dm) { const d = V.dotMatrix(dm); running(dm, (dt) => d.tick(dt)); }

  // ---- the CTA's counter: threats stopped today, ticking up ----
  const lc = document.querySelector('[data-live-count]');
  if (lc) {
    const now = new Date(); const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    let n = Math.round(secs * 27.8 + 2400);
    lc.textContent = fmt(n);
    if (!calm) running(lc, (() => { let acc = 0; return (dt) => { acc += dt; if (acc > 0.35) { acc = 0; n += 3 + Math.floor(Math.random() * 18); lc.textContent = fmt(n); } }; })());
  }

  // ---- local time in the footer ----
  const lt = document.querySelector('[data-local-time]');
  if (lt) {
    const set = () => { lt.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
    set(); setInterval(set, 15000);
  }
  ScrollTrigger?.refresh();
}
