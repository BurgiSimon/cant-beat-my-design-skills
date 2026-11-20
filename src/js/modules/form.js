/**
 * Accessible client-side form handling (no backend — the site is static).
 *
 * <form data-module="form" novalidate
 *       data-success-title="You're in." data-success-text="Check your inbox…">
 *   <div class="field">
 *     <label class="field__label" for="email">Work email</label>
 *     <input class="input" id="email" name="email" type="email" required
 *            autocomplete="email" aria-describedby="email-error"
 *            data-error-required="Enter your work email."
 *            data-error-type="That doesn't look like an email address." />
 *     <p class="field__error" id="email-error" aria-live="polite"></p>
 *   </div>
 *   <button class="btn btn--primary" type="submit">Start free trial</button>
 * </form>
 *
 * Error messages come from data-error-{required,type,minlength,pattern,match}
 * or sensible defaults. data-match="password" makes a field match another.
 * On success the form is replaced by a status panel (role="status"),
 * unless data-success="none"; a "mist:submit" event fires either way.
 */
const DEFAULTS = {
  required: "This field is required.",
  type: "Please enter a valid value.",
  email: "Enter a valid email address, like you@company.com.",
  minlength: (n) => `Use at least ${n} characters.`,
  pattern: "Please match the requested format.",
  match: "These don't match.",
  checkbox: "Please check this box to continue.",
};

function messageFor(input) {
  const v = input.validity;
  const d = input.dataset;
  if (v.valueMissing) return d.errorRequired || (input.type === "checkbox" ? DEFAULTS.checkbox : DEFAULTS.required);
  if (v.typeMismatch) return d.errorType || (input.type === "email" ? DEFAULTS.email : DEFAULTS.type);
  if (v.tooShort) return d.errorMinlength || DEFAULTS.minlength(input.minLength);
  if (v.patternMismatch) return d.errorPattern || DEFAULTS.pattern;
  if (v.customError) return input.validationMessage;
  return "";
}

function errorEl(input) {
  const ids = (input.getAttribute("aria-describedby") || "").split(/\s+/);
  for (const id of ids) {
    const el = id ? document.getElementById(id) : null;
    if (el?.classList.contains("field__error")) return el;
  }
  return input.closest(".field, .check")?.querySelector(".field__error") || null;
}

function validate(input, form) {
  if (input.dataset.match) {
    const other = form.elements[input.dataset.match];
    input.setCustomValidity(other && input.value && other.value !== input.value ? input.dataset.errorMatch || DEFAULTS.match : "");
  }
  const msg = input.checkValidity() ? "" : messageFor(input);
  const err = errorEl(input);
  if (err) err.textContent = msg;
  if (msg) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
  return !msg;
}

const CHECK_ICON =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

export default function initForm(form) {
  if (form.dataset.formReady) return;
  form.dataset.formReady = "true";
  form.noValidate = true;
  const fields = () => [...form.elements].filter((el) => el.willValidate && el.type !== "submit");

  for (const input of fields()) {
    input.addEventListener("blur", () => input.value && validate(input, form));
    input.addEventListener("input", () => input.getAttribute("aria-invalid") && validate(input, form));
    input.addEventListener("change", () => input.type === "checkbox" && validate(input, form));
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (form.dataset.busy) return; // ignore Enter presses while "sending"
    const invalid = fields().filter((input) => !validate(input, form));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }
    const button = form.querySelector('[type="submit"]');
    button?.setAttribute("aria-busy", "true");
    form.dataset.busy = "true";
    const data = Object.fromEntries(new FormData(form));
    const editable = fields().filter((el) => "readOnly" in el && !el.readOnly);
    editable.forEach((el) => (el.readOnly = true));
    setTimeout(() => {
      button?.removeAttribute("aria-busy");
      delete form.dataset.busy;
      editable.forEach((el) => (el.readOnly = false));
      form.dispatchEvent(new CustomEvent("mist:submit", { detail: data, bubbles: true }));
      if (form.dataset.success === "none") return;
      const panel = document.createElement("div");
      panel.className = "form-success";
      panel.setAttribute("role", "status");
      panel.tabIndex = -1;
      const title = form.dataset.successTitle || "Thanks — you're all set.";
      const text = form.dataset.successText || "We'll be in touch shortly.";
      panel.innerHTML = `<span class="form-success__icon">${CHECK_ICON}</span><p class="title-4"></p><p class="body"></p>`;
      panel.querySelector(".title-4").textContent = title;
      panel.querySelector(".body").textContent = text.replace("{email}", data.email || "your inbox");
      form.replaceWith(panel);
      panel.focus({ preventScroll: true });
    }, 900);
  });
}
