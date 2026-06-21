/* ==========================================================
   Tabs — one delegated listener, swaps `active` on both the
   button and the matching panel. No frameworks, no fuss.
   DRY: zero per-tab handlers.
   ========================================================== */
(function initTabs() {
  const tabs   = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');

  function activate(tabName) {
    tabs.forEach(t => {
      const on = t.dataset.tab === tabName;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(p => {
      p.classList.toggle('active', p.id === `panel-${tabName}`);
    });
  }

  tabs.forEach(t => {
    t.addEventListener('click', () => activate(t.dataset.tab));
  });
})();

/* ==========================================================
   OwnerGate — Visitor / Owner mode toggle
   Mirrors the pattern from lukethomasselzer.com, adapted for a
   pure-static site (no /api/auth). Verification is a client-side
   SHA-256 compare against OWNER_PW_HASH below. UX-level only.

   🔑 TO CHANGE THE PASSWORD:
     1. Pick a new password (let's call it NEW_PW).
     2. Compute its SHA-256 in a terminal:
          python -c "import hashlib; print(hashlib.sha256(b'NEW_PW').hexdigest())"
        (or use any online SHA-256 generator)
     3. Paste the resulting hex into OWNER_PW_HASH below.
     4. Commit + push. Done.

   Single source of truth for "what mode are we in?" → body.is-owner.
   Persisted in sessionStorage so a tab refresh keeps your choice,
   but closing the tab logs you back out (safer default for a shared
   device than localStorage).
   ========================================================== */
const OwnerGate = (() => {
  // SHA-256 of "Velocity" — change via the recipe above.
  const OWNER_PW_HASH = "8965cdc71634bfb3aee3598d2996bc72c78cbcb1c744076bcd2f9d2368bf0295";
  const SS_KEY        = "vrip_role";   // "owner" | "visitor"

  // Web Crypto SHA-256 → lowercase hex. Async, browser-native, zero deps.
  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const buf   = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(buf))
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
  }

  async function verifyPassword(password) {
    try { return (await sha256Hex(password)) === OWNER_PW_HASH; }
    catch (err) { console.warn("OwnerGate: hash failed:", err); return false; }
  }

  // Single mutation point: toggle class, persist, refresh pill. DRY.
  function setMode(role) {
    const isOwner = role === "owner";
    document.body.classList.toggle("is-owner", isOwner);
    sessionStorage.setItem(SS_KEY, role);
    updatePill(role);
  }

  function updatePill(role) {
    const pill      = document.getElementById("mode-pill");
    const label     = document.getElementById("mode-pill-label");
    const switchBtn = document.getElementById("mode-pill-switch");
    if (!pill || !label || !switchBtn) return;
    pill.hidden = false;
    if (role === "owner") {
      pill.classList.remove("is-visitor");
      label.textContent     = "🧤 Owner mode";
      switchBtn.textContent = "Switch to Visitor";
    } else {
      pill.classList.add("is-visitor");
      label.textContent     = "👀 Visitor mode";
      switchBtn.textContent = "Switch to Owner →";
    }
  }

  function showGate(show) {
    const gate = document.getElementById("gate");
    if (gate) gate.hidden = !show;
  }

  function showStep(step) {
    document.querySelectorAll("#gate [data-gate-step]").forEach(el => {
      el.hidden = el.dataset.gateStep !== step;
    });
    const err = document.getElementById("gate-error");
    if (err) err.textContent = "";
    if (step === "password") {
      setTimeout(() => document.getElementById("gate-pw")?.focus(), 50);
    }
  }

  function shake() {
    const card = document.getElementById("gate-card");
    if (!card) return;
    card.classList.add("is-shaking");
    setTimeout(() => card.classList.remove("is-shaking"), 320);
  }

  // Going visitor is the lower-privilege mode → no password needed.
  function switchToVisitor() {
    setMode("visitor");
    showGate(false);
  }

  // Going owner always requires the password challenge.
  function promptForOwner() {
    showStep("password");
    showGate(true);
  }

  function init() {
    // Role buttons on the first-visit chooser.
    document.querySelectorAll("[data-role]").forEach(btn => {
      btn.addEventListener("click", () => {
        const role = btn.dataset.role;
        if (role === "visitor") switchToVisitor();
        else if (role === "owner") showStep("password");
      });
    });

    // Back button on the password step.
    document.querySelectorAll("[data-gate-back]").forEach(btn => {
      btn.addEventListener("click", () => {
        const saved = sessionStorage.getItem(SS_KEY);
        if (saved) { showGate(false); }
        else       { showStep("choose"); }
      });
    });

    // Password form → SHA-256 compare.
    const form = document.getElementById("gate-pw-form");
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const input = document.getElementById("gate-pw");
        const err   = document.getElementById("gate-error");

        err.textContent       = "";
        submitBtn.disabled    = true;
        const originalLabel   = submitBtn.textContent;
        submitBtn.textContent = "Checking…";

        const ok = await verifyPassword(input.value);

        submitBtn.disabled    = false;
        submitBtn.textContent = originalLabel;

        if (ok) {
          setMode("owner");
          showGate(false);
          input.value = "";
        } else {
          err.textContent = "Wrong password — try again.";
          shake();
          input.select();
        }
      });
    }

    // Mode-pill switch — action depends on current mode.
    const switchBtn = document.getElementById("mode-pill-switch");
    if (switchBtn) {
      switchBtn.addEventListener("click", () => {
        const isOwner = document.body.classList.contains("is-owner");
        if (isOwner) switchToVisitor();
        else         promptForOwner();
      });
    }

    // Restore prior choice for this tab, or show the chooser gate.
    const saved = sessionStorage.getItem(SS_KEY);
    if (saved === "owner" || saved === "visitor") {
      setMode(saved);
      showGate(false);
    } else {
      updatePill("visitor");
      document.getElementById("mode-pill").hidden = true;
      showStep("choose");
      showGate(true);
    }
  }

  return { init, switchToVisitor, promptForOwner };
})();
window.OwnerGate = OwnerGate;
OwnerGate.init();

/* ==========================================================
   Inline editor factory — owner-only contenteditable toggle.

   Single source of truth for the "click Edit → fields become
   editable → click Save → snapshot to localStorage" pattern.
   DRY win: every panel that wants inline editing just calls
   createInlineEditor({...}) once with its config. Add a third
   editor in two lines.

   Config:
     panelId    — element id of the section being edited
     btnId      — element id of the toggle button (lives in the h2)
     lsKey      — localStorage key for persistence
     selector   — CSS selector for editable elements WITHIN the panel

   Persistence model: serialize the outerHTML of each matched
   element and re-hydrate by replacing in order on load. Works for
   <p>, <ul>, <span class="bio-fact-value">, etc. — anything whose
   element count is stable across edits.
   ========================================================== */
function createInlineEditor({ panelId, btnId, lsKey, selector }) {
  const btn   = document.getElementById(btnId);
  const panel = document.getElementById(panelId);
  if (!btn || !panel) return;

  const targets = () => panel.querySelectorAll(selector);

  // Rehydrate any saved edits from a prior session.
  const saved = localStorage.getItem(lsKey);
  if (saved) {
    const sandbox = document.createElement("div");
    sandbox.innerHTML = saved;
    const fresh   = sandbox.querySelectorAll(selector);
    const current = targets();
    // Only replace if the schema matches — guards against stale
    // localStorage written when the panel had a different shape.
    if (fresh.length === current.length && fresh.length > 0) {
      fresh.forEach((node, i) => current[i].replaceWith(node));
    }
  }

  btn.addEventListener("click", () => {
    const editing = btn.classList.toggle("is-editing");
    targets().forEach(el => el.setAttribute("contenteditable", editing));
    btn.textContent = editing ? "💾 Save" : "✏️ Edit";
    if (!editing) {
      const snapshot = Array.from(targets())
                            .map(el => el.outerHTML)
                            .join("\n");
      localStorage.setItem(lsKey, snapshot);
    }
  });
}

// Personal Bio — profile-list values (locked-label/editable-value cards),
// free-form bio paragraphs, the section headings (h3), and the
// Strengths/Working-On <ul>s are all editable. The selector EXCLUDES
// .profile-list itself (we edit the inner .value spans instead) to
// avoid double-counting the same DOM region. LS key bumped to _v3
// because the profile-list grew from 6 → 10 items (physical facts
// consolidated here from the old Soccer Bio bio-grid).
createInlineEditor({
  panelId:  "panel-about",
  btnId:    "about-edit-btn",
  lsKey:    "vrip_about_html_v3",
  selector: "#personal-list .value, p, h3, ul:not(.profile-list)",
});

// Soccer Bio no longer has editable bio-facts — the panel is now
// strictly career stats (Career Totals + By Competition table).
// If we make the stat numbers editable later, register here.

/* ==========================================================
   ThemeEditor — owner-customizable site colors
   Ported from lukethomasselzer.com's ThemeEditor, adapted for a
   pure-static site (no /api/theme). Theme is persisted to
   localStorage — per-browser, not globally published. Owners get
   a 🎨 pill in the hero; clicking opens a modal with two native
   color pickers (Primary + Accent), a live four-swatch preview,
   and Save / Cancel / Reset actions.

   We override exactly four CSS custom properties:
     --pitch, --pitch-deep, --pitch-soft, --kit-accent.
   The deep/soft shades are DERIVED from the owner's primary pick
   via HSL lightness shifts — one decision updates the whole
   pitch-green family coherently. DRY + Open/Closed: adding a new
   theme slot is a one-line addition to applyTheme().
   ========================================================== */
const ThemeEditor = (() => {
  const LS_KEY   = "vrip_theme";
  // Match the :root defaults in styles.css so the modal opens to a
  // sensible starting state when no theme has been saved yet.
  const DEFAULTS = { primary: "#14532d", accent: "#ff6b35" };
  // Lightness deltas eyeballed from the stock palette. Soft is a touch
  // smaller than Luke's because the soccer green family is tighter.
  const DEEP_DELTA = -0.15;
  const SOFT_DELTA = +0.12;

  // Snapshot of the theme active when the modal opened, so Cancel
  // can revert any live-preview changes the user dragged through.
  let snapshot = {};

  // ---- Color math (hex ↔ HSL) ----
  // Tiny self-contained color utility. 30 lines of well-known formulas
  // beats pulling in a library for a single derivation pass.
  function hexToHsl(hex) {
    const m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
    if (!m) return null;
    const r = parseInt(m[1], 16) / 255;
    const g = parseInt(m[2], 16) / 255;
    const b = parseInt(m[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if      (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else                h = (r - g) / d + 4;
      h /= 6;
    }
    return { h, s, l };
  }
  function hslToHex(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  function adjustLightness(hex, delta) {
    const hsl = hexToHsl(hex);
    if (!hsl) return hex;
    const l = Math.max(0, Math.min(1, hsl.l + delta));
    return hslToHex(hsl.h, hsl.s, l);
  }

  // Apply (or clear) the four overridable CSS custom properties on <html>.
  // Calling with {} cleanly resets to the original pitch-green palette
  // — single function for both apply and reset paths.
  function applyTheme(theme) {
    const root = document.documentElement.style;
    if (theme && theme.primary) {
      root.setProperty("--pitch",      theme.primary);
      root.setProperty("--pitch-deep", adjustLightness(theme.primary, DEEP_DELTA));
      root.setProperty("--pitch-soft", adjustLightness(theme.primary, SOFT_DELTA));
    } else {
      root.removeProperty("--pitch");
      root.removeProperty("--pitch-deep");
      root.removeProperty("--pitch-soft");
    }
    if (theme && theme.accent) root.setProperty("--kit-accent", theme.accent);
    else                       root.removeProperty("--kit-accent");
  }

  // ---- localStorage I/O (no backend on this site) ----
  function loadTheme() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
    catch { return {}; }
  }
  function saveTheme(theme)  { localStorage.setItem(LS_KEY, JSON.stringify(theme)); }
  function clearTheme()      { localStorage.removeItem(LS_KEY); }

  // ---- Modal helpers ----
  function setStatus(text, kind) {
    const el = document.getElementById("theme-status");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("is-error", "is-success");
    if (kind) el.classList.add("is-" + kind);
  }

  function updateSwatches(primary, accent) {
    const set = (sel, color) => {
      const el = document.querySelector(sel);
      if (el) el.style.background = color;
    };
    set('[data-preview="deep"]',    adjustLightness(primary, DEEP_DELTA));
    set('[data-preview="primary"]', primary);
    set('[data-preview="soft"]',    adjustLightness(primary, SOFT_DELTA));
    set('[data-preview="accent"]',  accent);
  }

  function openModal() {
    const current = loadTheme();
    snapshot = { ...current };
    const modal        = document.getElementById("theme-modal");
    const primaryInput = document.getElementById("theme-primary");
    const accentInput  = document.getElementById("theme-accent");
    primaryInput.value = current.primary || DEFAULTS.primary;
    accentInput.value  = current.accent  || DEFAULTS.accent;
    updateSwatches(primaryInput.value, accentInput.value);
    setStatus("", null);
    modal.hidden = false;
  }

  function closeModal() {
    document.getElementById("theme-modal").hidden = true;
    setStatus("", null);
  }

  // Cancel = revert any live-preview changes back to whatever was in
  // effect when the modal opened, then close.
  function cancelModal() {
    applyTheme(snapshot);
    closeModal();
  }

  function wire() {
    const triggerBtn   = document.getElementById("theme-edit-btn");
    const primaryInput = document.getElementById("theme-primary");
    const accentInput  = document.getElementById("theme-accent");
    const saveBtn      = document.getElementById("theme-save-btn");
    const resetBtn     = document.getElementById("theme-reset-btn");

    if (triggerBtn) triggerBtn.addEventListener("click", openModal);

    // Live preview as the owner drags the native color wheel. `input`
    // fires on every value change (vs `change` which only fires on commit).
    const onPickerChange = () => {
      const primary = primaryInput.value;
      const accent  = accentInput.value;
      applyTheme({ primary, accent });
      updateSwatches(primary, accent);
    };
    if (primaryInput) primaryInput.addEventListener("input", onPickerChange);
    if (accentInput)  accentInput .addEventListener("input", onPickerChange);

    if (saveBtn) saveBtn.addEventListener("click", () => {
      const theme = { primary: primaryInput.value, accent: accentInput.value };
      saveTheme(theme);
      // Snapshot becomes the just-saved theme so a later Cancel doesn't
      // revert what we just persisted.
      snapshot = theme;
      setStatus("Saved!", "success");
      setTimeout(closeModal, 600);
    });

    // Backdrop + Cancel button both have data-theme-close — one listener,
    // two trigger points. DRY.
    document.querySelectorAll("[data-theme-close]").forEach((el) => {
      el.addEventListener("click", cancelModal);
    });

    if (resetBtn) resetBtn.addEventListener("click", () => {
      if (!confirm("Reset site theme to the original pitch-green palette?")) return;
      clearTheme();
      applyTheme({});
      // Refresh the picker values to the defaults so the swatches match.
      primaryInput.value = DEFAULTS.primary;
      accentInput.value  = DEFAULTS.accent;
      updateSwatches(DEFAULTS.primary, DEFAULTS.accent);
      snapshot = {};
      setStatus("Reset to defaults.", "success");
    });

    // Esc closes the modal (same effect as Cancel).
    document.addEventListener("keydown", (e) => {
      const modal = document.getElementById("theme-modal");
      if (e.key === "Escape" && modal && !modal.hidden) cancelModal();
    });
  }

  function init() {
    // Apply saved theme on page load for THIS browser. Runs synchronously
    // before first paint when this script is in <head defer>, which
    // prevents a flash of the default palette. (Currently the script is
    // bottom-of-body, so there may be a tiny one-frame flash on cold
    // load. Acceptable trade-off for keeping all JS in one file.)
    applyTheme(loadTheme());
    wire();
  }

  return { init, openModal };
})();
window.ThemeEditor = ThemeEditor;
ThemeEditor.init();

