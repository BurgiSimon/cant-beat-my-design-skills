// Every form[data-form]: inline validation (required, email, minlength, pattern; messages in the field's
// .field__error, wired with aria-invalid and aria-describedby), a busy button on submit, then the success toast
// (data-success) and a reset. Nothing is ever sent: data-demo forms are demos. A "form:success" event carries the
// FormData, for pages that want to do more (the home CTA launches the footer).
import { toast, $$ } from '../core.js';

const MESSAGES = {
  valueMissing: (el) => el.dataset.msgRequired || `${label(el)} is needed.`,
  typeMismatch: (el) => (el.type === 'email' ? 'That email doesn’t look right.' : `Check ${label(el).toLowerCase()}.`),
  tooShort: (el) => `A little longer, please (at least ${el.minLength} characters).`,
  patternMismatch: (el) => el.dataset.msgPattern || `Check ${label(el).toLowerCase()}.`,
};
const label = (el) => (el.labels?.[0]?.textContent || el.name || 'This').replace(/\s*\(optional\)\s*/i, '').trim();

function errorEl(el) {
  const field = el.closest('.field') || el.parentElement;
  let err = field.querySelector('.field__error');
  if (!err) { err = document.createElement('p'); err.className = 'field__error'; field.append(err); }
  if (!err.id) err.id = `${el.id || el.name || 'f'}-error-${Math.random().toString(36).slice(2, 7)}`;
  return err;
}
function check(el) {
  if (!el.willValidate || el.disabled || el.closest('[hidden]')) return true;
  const v = el.validity;
  const kind = Object.keys(MESSAGES).find((k) => v[k]);
  const err = errorEl(el);
  if (kind) {
    el.setAttribute('aria-invalid', 'true');
    err.textContent = MESSAGES[kind](el);
    el.setAttribute('aria-describedby', [...new Set([...(el.getAttribute('aria-describedby') || '').split(' ').filter(Boolean), err.id])].join(' '));
    return false;
  }
  el.removeAttribute('aria-invalid');
  err.textContent = '';
  return true;
}

export default function init() {
  for (const form of $$('form[data-form]')) {
    form.noValidate = true;
    const fields = () => [...form.elements].filter((el) => el.matches('input, select, textarea'));
    for (const el of fields()) {
      el.addEventListener('blur', () => { if (el.value || el.hasAttribute('aria-invalid')) check(el); });
      el.addEventListener('input', () => { if (el.hasAttribute('aria-invalid')) check(el); });
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = fields().filter((el) => !check(el));
      if (bad.length) { bad[0].focus(); return; }
      const btn = form.querySelector('[type="submit"]');
      btn?.setAttribute('aria-busy', 'true');
      const data = new FormData(form);
      setTimeout(() => {
        btn?.removeAttribute('aria-busy');
        if (form.dataset.success) toast(form.dataset.success, form.dataset.successKey ?? 'Demo');
        form.dispatchEvent(new CustomEvent('form:success', { detail: data, bubbles: true }));
        if (!form.hasAttribute('data-keep')) form.reset();
      }, 700);
    });
  }
}
