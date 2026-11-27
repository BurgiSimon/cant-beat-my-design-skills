// [data-copy="text"] buttons copy their text and say so in the toast (data-copy-toast overrides the message).
import { toast, $$ } from '../core.js';

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;opacity:0';
    document.body.append(t); t.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    t.remove(); return ok;
  }
}

export default function init() {
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const text = b.dataset.copy || b.closest('[data-copy-scope]')?.querySelector('[data-copy-source]')?.textContent || '';
    const ok = await copyText(text.trim());
    toast(ok ? (b.dataset.copyToast || `Copied ${text.length > 28 ? '' : text}`.trim()) : 'Copy is blocked here', ok ? 'Copied' : 'Oops');
  });
  void $$;
}
