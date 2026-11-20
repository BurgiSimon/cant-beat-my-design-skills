/**
 * Sign in + sign up pages (<main class="auth" data-module="auth">).
 *
 * Shared:   password show/hide toggle, Caps Lock note, ambient mist that
 *           pauses off-screen, tidy success states, ?email= prefill.
 * Sign in:  "Continue with SSO" disclosure, forgot-password view swap.
 * Sign up:  ?plan=starter|team|enterprise (default team), ?billing=annual|monthly
 *           and ?template=… adapt the copy, fields and plan card; the plan
 *           switcher changes plan in place (history.replaceState); live
 *           password-strength meter.
 *
 * Validation + success panels come from form.js (data-module="form"); it is
 * initialised here first so its listeners exist before fields are disabled.
 */
import { $, $$, reducedMotion } from "../core/utils.js";
import initForm from "./form.js";

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";

export default function init(root) {
  if (root.dataset.authReady) return;
  root.dataset.authReady = "true";

  $$('form[data-module~="form"]', root).forEach(initForm);

  initPasswordToggles(root);
  initCapsLock(root);
  initSso(root);
  initViews(root);
  initSignup(root);
  initSuccess(root);
  initAmbient(root);
  prefillEmail(root);
}

/* ── Password show / hide ─────────────────────────────────── */
function initPasswordToggles(root) {
  for (const btn of $$("[data-auth-reveal]", root)) {
    const input = document.getElementById(btn.getAttribute("aria-controls"));
    const label = $("[data-auth-reveal-label]", btn);
    if (!input) continue;
    btn.addEventListener("click", () => {
      const show = input.type === "password";
      // keep the caret where it was when the type flips
      const { selectionStart: start, selectionEnd: end } = input;
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-pressed", String(show));
      if (label) label.textContent = show ? "Hide password" : "Show password";
      if (start !== null) {
        try {
          input.setSelectionRange(start, end);
        } catch {
          /* not all types support selection */
        }
      }
    });
    // never let a revealed password linger in the form when it is submitted
    input.form?.addEventListener("mist:submit", () => {
      input.type = "password";
    });
  }
}

/* ── Caps Lock note on password fields ────────────────────── */
function initCapsLock(root) {
  for (const input of $$("[data-caps]", root)) {
    const note = document.getElementById(input.dataset.caps);
    if (!note) continue;
    let on = false;
    const set = (next) => {
      if (next === on) return;
      on = next;
      note.textContent = on ? "Caps Lock is on" : "";
    };
    const read = (e) => typeof e.getModifierState === "function" && set(e.getModifierState("CapsLock"));
    input.addEventListener("keydown", read);
    input.addEventListener("keyup", read);
    input.addEventListener("blur", () => set(false));
  }
}

/* ── Disclosure helper: 0fr → 1fr rows (see .auth__collapse) ─ */
function setCollapse(panel, open) {
  if (reducedMotion()) {
    panel.classList.toggle("is-shown", open);
    panel.classList.toggle("is-open", open);
    return;
  }
  if (open) {
    panel.classList.add("is-shown");
    void panel.offsetHeight; // commit the closed state so the rows animate
    panel.classList.add("is-open");
    return;
  }
  panel.classList.remove("is-open");
  const done = () => {
    if (!panel.classList.contains("is-open")) panel.classList.remove("is-shown");
  };
  panel.addEventListener("transitionend", (e) => e.target === panel && done(), { once: true });
  setTimeout(done, 600);
}

/* ── Sign in: "Continue with SSO" ─────────────────────────── */
function initSso(root) {
  const btn = $("[data-auth-sso]", root);
  const panel = btn && document.getElementById(btn.getAttribute("aria-controls"));
  if (!panel) return;
  const ssoEmail = $('input[type="email"]', panel);
  const mainEmail = $("[data-auth-signin] input[type='email']", root);

  const toggle = (open, { focus = false } = {}) => {
    btn.setAttribute("aria-expanded", String(open));
    setCollapse(panel, open);
    if (open && ssoEmail) {
      if (!ssoEmail.value && mainEmail?.value) ssoEmail.value = mainEmail.value;
      if (focus) ssoEmail.focus({ preventScroll: true });
    }
  };
  btn.addEventListener("click", () => toggle(btn.getAttribute("aria-expanded") !== "true", { focus: true }));
  // Esc inside the panel folds it away and hands focus back
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    toggle(false);
    btn.focus();
  });
}

/* ── Sign in: forgot password ⇄ sign in ───────────────────── */
/* The page keeps a single h1. Each view carries its own heading, intro and
   document title (data-auth-heading / -sub / -title); the shared header
   takes them on as the views swap, and focus lands on the heading. */
function initViews(root) {
  const signin = $('[data-auth-view="signin"]', root);
  const reset = $('[data-auth-view="reset"]', root);
  if (!signin || !reset) return;
  const forgot = $("[data-auth-forgot]", root);
  const head = $("[data-auth-head]", root);
  const heading = $("[data-auth-heading]", root);
  const sub = $("[data-auth-sub]", root);
  // the sign-in copy lives in the markup: remember it for the way back
  signin.dataset.authHeading ??= heading?.textContent.trim() ?? "";
  signin.dataset.authSub ??= sub?.textContent.trim() ?? "";
  signin.dataset.authTitle ??= document.title;
  let busy = false;

  const swap = (from, to, then) => {
    if (busy) return;
    busy = true;
    const finish = () => {
      from.hidden = true;
      to.hidden = false;
      if (heading) heading.textContent = to.dataset.authHeading;
      if (sub) sub.textContent = to.dataset.authSub;
      document.title = to.dataset.authTitle;
      then();
      if (!reducedMotion()) {
        [head, to].forEach((el, i) =>
          el?.animate?.(
            [
              { opacity: 0, transform: "translateY(12px)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 560, delay: i * 60, easing: EASE_OUT, fill: "backwards" }
          )
        );
      }
      busy = false;
    };
    if (reducedMotion() || !from.animate) return finish();
    const outs = [head, from].filter(Boolean).map((el) =>
      el.animate(
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: "translateY(-8px)" },
        ],
        { duration: 180, easing: EASE_IN_OUT, fill: "forwards" }
      )
    );
    Promise.all(outs.map((a) => a.finished)).then(() => {
      outs.forEach((a) => a.cancel());
      finish();
    });
  };

  forgot?.addEventListener("click", () => {
    const resetEmail = $('input[type="email"]', reset);
    const mainEmail = $("[data-auth-signin] input[type='email']", root);
    if (resetEmail && !resetEmail.value && mainEmail?.validity.valid && mainEmail.value) resetEmail.value = mainEmail.value;
    swap(signin, reset, () => heading?.focus({ preventScroll: true }));
  });
  for (const back of $$("[data-auth-back]", reset)) {
    back.addEventListener("click", () =>
      swap(reset, signin, () => {
        // Forgot sits inside the sign-in form, which a finished sign-in hides
        const target = forgot?.isConnected && !forgot.closest("[hidden]") ? forgot : heading;
        target?.focus({ preventScroll: true });
      })
    );
  }
}

/* ── Success states: tidy the surroundings, add follow-ups ── */
function initSuccess(root) {
  root.addEventListener("mist:submit", (e) => {
    const form = e.target;
    const parent = form.parentElement;
    const view = form.closest("[data-auth-view]") || root;
    const isReset = form.matches("[data-auth-reset]");
    const isSso = form.matches("[data-auth-sso-form]");
    const isHandoff = isSso || form.matches("[data-auth-signin]"); // "taking you somewhere…"

    if (!isReset) {
      for (const el of $$("[data-auth-hide-on-done]", view)) {
        if (!el.contains(form)) el.hidden = true;
      }
      if (isSso) {
        $("[data-auth-sso]", root)?.setAttribute("hidden", "");
        const signinForm = $("[data-auth-signin]", root);
        if (signinForm) signinForm.hidden = true;
      }
    }

    // form.js replaces the form with its panel right after this event
    queueMicrotask(() => {
      const panel = parent && $(":scope > .form-success", parent);
      if (!panel) return;
      if (isReset) {
        const again = document.createElement("button");
        again.type = "button";
        again.className = "auth__link auth__success-more";
        again.textContent = "Use a different email";
        again.addEventListener("click", () => {
          panel.replaceWith(form);
          const input = $('input[type="email"]', form);
          input?.focus();
          input?.select();
        });
        panel.append(again);
      } else if (isHandoff) {
        panel.classList.add("auth__success--progress");
      } else if (form.matches("[data-auth-signup]")) {
        panel.append(signupFollowUp(root.dataset.plan));
      }
      // the panel is shorter than the form it replaced: keep it in view
      const box = panel.getBoundingClientRect();
      const top = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      if (box.top < top || box.bottom > innerHeight) {
        panel.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
      }
    });
  });
}

/* After sign-up, never a dead end: self-serve plans can resend the
   confirmation email; Enterprise gets a path back into the product story. */
function signupFollowUp(plan) {
  if (plan === "enterprise") {
    const link = document.createElement("a");
    link.className = "auth__link auth__success-more";
    link.href = "./#use-cases";
    link.textContent = "See how teams use Mist";
    return link;
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "auth__link auth__success-more";
  btn.textContent = "Resend the email";
  btn.addEventListener("click", () => {
    if (btn.getAttribute("aria-disabled") === "true") return;
    btn.setAttribute("aria-disabled", "true");
    btn.textContent = "Sending…";
    // inside the role="status" panel, so the new text is announced
    setTimeout(() => (btn.textContent = "Sent again — check your spam folder too"), 900);
  });
  return btn;
}

/* ── Ambient mist: only drifts while the art is on screen ─── */
function initAmbient(root) {
  const art = $(".auth__art", root);
  if (!art || reducedMotion() || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(([entry]) => art.classList.toggle("is-paused", !entry.isIntersecting));
  io.observe(art);
}

/* ── ?email= (e.g. from the home page CTA) ─────────────────── */
function prefillEmail(root) {
  const email = new URLSearchParams(location.search).get("email");
  if (!email || email.length > 254) return;
  const input = $("form:not([data-auth-sso-form]):not([data-auth-reset]) input[type='email']", root);
  if (input && !input.value) input.value = email.trim();
}

/* ────────────────────────────────────────────────────────────
   Sign up
   ──────────────────────────────────────────────────────────── */
const CHECK =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>';

const TEMPLATES = {
  support: "Ticket triage",
  sales: "Call to CRM",
  operations: "Vendor intake",
  finance: "Invoice matching",
  people: "New hire onboarding",
  engineering: "Incident triage",
};

const trialEnd = () =>
  new Date(Date.now() + 14 * 864e5).toLocaleDateString("en-US", { month: "long", day: "numeric" });

const PLANS = {
  starter: {
    label: "Starter",
    title: "Create your free Starter&nbsp;workspace",
    sub: "Free forever for up to 3 members. Upgrade whenever your workflows outgrow\u00a0it.",
    submit: "Create workspace",
    doc: "Create your free workspace — Mist",
    announce: "Starter plan selected. Free forever for up to 3 members.",
    badge: "",
    amount: "$0",
    unit: () => ["per month, forever", "for up to 3 members"],
    note: () => "No trial clock — <strong>start building today</strong>.",
    lead: "Includes:",
    includes: ["1,000 tasks / month", "5 active workflows", "50+ core integrations", "100 AI steps / month"],
    perks: ["Free forever", "No credit card required", "Upgrade anytime"],
    successTitle: "Your workspace is ready",
    successText: "We’ve sent a confirmation link to {email}. Your free Starter workspace is waiting.",
  },
  team: {
    label: "Team",
    title: 'Start your <span class="auth__nowrap">14-day</span> Team&nbsp;trial',
    sub: "Every Team feature, free for 14 days. No credit\u00a0card, and you can invite your whole\u00a0team.",
    submit: "Start free trial",
    doc: "Start your 14-day Team trial — Mist",
    announce: "Team plan selected. 14-day free trial, no credit card required.",
    badge: "Most popular",
    amount: (billing) => (billing === "monthly" ? "$30" : "$24"),
    unit: (billing) =>
      billing === "monthly" ? ["per member / month", "billed monthly"] : ["per member / month", "billed annually"],
    note: () => `$0 today — your trial runs until <strong>${trialEnd()}</strong>.`,
    lead: "Everything in Starter, plus:",
    includes: ["25,000 tasks / month", "Unlimited workflows and AI steps", "All 300+ integrations", "Human-in-the-loop approvals"],
    perks: ["14-day free trial", "No credit card required", "Cancel anytime"],
    successTitle: "Your workspace is ready",
    successText: "We’ve sent a confirmation link to {email}. Your 14-day Team trial starts now.",
  },
  enterprise: {
    label: "Enterprise",
    title: "Talk to our team",
    sub: "Tell us about your organization. We’ll tailor a demo, security review and pricing to how you\u00a0work.",
    submit: "Contact sales",
    doc: "Talk to our team — Mist",
    announce: "Enterprise plan selected. The form now asks about your company instead of a password.",
    badge: "",
    amount: "Custom",
    unit: () => ["pricing for your", "whole organization"],
    note: () => "Includes a <strong>security review &amp; DPA</strong>.",
    lead: "Everything in Team, plus:",
    includes: ["SSO / SAML & SCIM", "Audit logs and custom retention", "EU or US data residency", "99.99% uptime SLA"],
    perks: ["Tailored demo", "Dedicated success manager", "Private networking"],
    successTitle: "Thanks — we’ll be in touch",
    successText: "A Mist product specialist will email {email} to find a time that suits you.",
  },
};

const resolve = (v, billing) => (typeof v === "function" ? v(billing) : v);

function initSignup(root) {
  const form = $("[data-auth-signup]", root);
  if (!form) return;

  const params = new URLSearchParams(location.search);
  const billing = params.get("billing") === "monthly" ? "monthly" : "annual";
  const seg = $("[data-auth-seg]", root);
  const radios = seg ? $$('input[type="radio"]', seg) : [];
  const pill = seg && $(".auth__seg-pill", seg);
  const live = $("[data-plan-live]", root);
  const planInput = $("[data-auth-plan-input]", form);
  const card = $("[data-plan-card]", root);
  const title = $("[data-plan-title]", root);
  const sub = $("[data-plan-sub]", root);
  const submit = $("[data-plan-submit]", form);
  const groupsOnly = $$("[data-plan-only]", form);
  const groupsExcept = $$("[data-plan-except]", form);
  const billingInput = $("[data-auth-billing]", form);
  if (billingInput) billingInput.value = billing;

  const q = (sel) => $(sel, card || root);
  const els = {
    badge: q("[data-plan-badge]"),
    name: q("[data-plan-name]"),
    amount: q("[data-plan-amount]"),
    unit: q("[data-plan-unit]"),
    unitSub: q("[data-plan-unit-sub]"),
    note: q("[data-plan-note]"),
    lead: q("[data-plan-lead]"),
    includes: q("[data-plan-includes]"),
    perks: q("[data-plan-perks]"),
  };
  const list = (items) => items.map((t) => `<li>${CHECK}<span>${escapeHtml(t)}</span></li>`).join("");

  let current = null;
  const template = initTemplate(root, form, params);

  const placePill = () => {
    const opt = radios.find((r) => r.checked)?.closest(".auth__seg-opt");
    if (!opt || !pill) return;
    seg.style.setProperty("--pill-x", `${opt.offsetLeft}px`);
    seg.style.setProperty("--pill-w", `${opt.offsetWidth}px`);
  };

  const setFields = (plan) => {
    const toggle = (group, show) => {
      group.hidden = !show;
      for (const el of $$("input, select, textarea", group)) el.disabled = !show;
    };
    groupsOnly.forEach((g) => toggle(g, g.dataset.planOnly.split(/\s+/).includes(plan)));
    groupsExcept.forEach((g) => toggle(g, !g.dataset.planExcept.split(/\s+/).includes(plan)));
  };

  const apply = (plan, { initial = false } = {}) => {
    if (plan === current) return;
    current = plan;
    const p = PLANS[plan];
    root.dataset.plan = plan;
    radios.forEach((r) => (r.checked = r.value === plan));
    if (planInput) planInput.value = plan;

    if (title) title.innerHTML = p.title;
    if (sub) sub.textContent = p.sub;
    if (submit) submit.textContent = p.submit;
    form.dataset.successTitle = p.successTitle;
    form.dataset.successText = p.successText;
    document.title = p.doc;

    if (els.badge) {
      els.badge.hidden = !p.badge;
      els.badge.textContent = p.badge;
    }
    if (els.name) els.name.textContent = p.label;
    if (els.amount) els.amount.textContent = resolve(p.amount, billing);
    const [unit, unitSub] = resolve(p.unit, billing);
    if (els.unit) els.unit.textContent = unit;
    if (els.unitSub) els.unitSub.textContent = unitSub;
    if (els.note) els.note.innerHTML = p.note(billing);
    if (els.lead) els.lead.textContent = p.lead;
    if (els.includes) els.includes.innerHTML = list(p.includes);
    if (els.perks) els.perks.innerHTML = list(p.perks);

    setFields(plan);
    placePill();
    template?.render(plan);

    if (initial) return;
    if (live) {
      live.textContent = "";
      requestAnimationFrame(() => (live.textContent = p.announce));
    }
    const next = new URLSearchParams(location.search);
    next.set("plan", plan);
    history.replaceState(history.state, "", `${location.pathname}?${next}${location.hash}`);
    document.dispatchEvent(new CustomEvent("mist:plan", { detail: { plan } }));

    if (!reducedMotion()) {
      const enter = [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ];
      for (const [el, delay] of [
        [title, 0],
        [sub, 40],
        [card, 0],
      ]) {
        el?.animate(enter, { duration: 560, delay, easing: EASE_OUT, fill: "backwards" });
      }
    }
  };

  const fromUrl = params.get("plan");
  apply(PLANS[fromUrl] ? fromUrl : "team", { initial: true });
  for (const r of radios) r.addEventListener("change", () => r.checked && apply(r.value));

  // pill: position without animating first, then let it slide
  if (seg && pill) {
    pill.style.transition = "none";
    requestAnimationFrame(() => {
      placePill();
      requestAnimationFrame(() => {
        pill.style.transition = "";
        seg.classList.add("is-ready");
      });
    });
    document.fonts?.ready.then(placePill);
    if ("ResizeObserver" in window) new ResizeObserver(placePill).observe(seg);
  }

  initStrength(form);
}

/* ── ?template=… notice ───────────────────────────────────── */
function initTemplate(root, form, params) {
  const key = params.get("template");
  const box = $("[data-auth-template]", root);
  const input = $("[data-auth-template-input]", form);
  if (!box || !key || !TEMPLATES[key]) return null;
  const name = TEMPLATES[key];
  const msg = $("[data-auth-template-msg]", box);
  $("[data-auth-template-remove-label]", box).textContent = `Remove the ${name} template`;
  box.hidden = false;
  if (input) {
    input.value = key;
    input.disabled = false;
  }
  $("[data-auth-template-remove]", box)?.addEventListener("click", () => {
    if (input) {
      input.value = "";
      input.disabled = true;
    }
    const next = new URLSearchParams(location.search);
    next.delete("template");
    const qs = next.toString();
    history.replaceState(history.state, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
    const finish = () => {
      box.hidden = true;
      $("h1", root)?.setAttribute("tabindex", "-1");
      $("h1", root)?.focus({ preventScroll: true });
    };
    if (reducedMotion() || !box.animate) return finish();
    box
      .animate(
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: "translateY(-6px)" },
        ],
        { duration: 220, easing: EASE_IN_OUT, fill: "forwards" }
      )
      .finished.then(finish);
  });

  // self-serve plans get the template in the new workspace; Enterprise sees it in the demo
  return {
    render(plan) {
      if (!msg) return;
      const strong = document.createElement("strong");
      strong.textContent = name;
      msg.replaceChildren(
        ...(plan === "enterprise" ? ["We’ll include ", strong, " in your demo."] : [strong, " will be ready in your workspace."])
      );
    },
  };
}

/* ── Password strength ────────────────────────────────────── */
const LEVELS = ["", "Weak", "Okay", "Good", "Strong"];
const COMMON = /(password|passw0rd|qwerty|letmein|welcome|iloveyou|admin|mist|12345|abcde|11111)/i;

export function scorePassword(pw) {
  if (!pw) return 0;
  if (pw.length < 10) return 1;
  const unique = new Set(pw.toLowerCase()).size;
  if (unique < 5 || COMMON.test(pw)) return pw.length >= 16 && unique >= 8 ? 2 : 1;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (pw.length >= 16 || (pw.length >= 13 && variety >= 3)) return 4;
  if (pw.length >= 12 || variety >= 3) return 3;
  return 2;
}

function initStrength(form) {
  const input = $("[data-auth-strength-input]", form);
  const meter = $("[data-auth-strength]", form);
  const label = $("[data-auth-strength-label]", form);
  if (!input || !meter || !label) return;
  let level = -1;
  const update = () => {
    const next = scorePassword(input.value);
    if (next === level) return;
    level = next;
    meter.dataset.level = String(next);
    label.textContent = LEVELS[next];
  };
  input.addEventListener("input", update);
  update();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
