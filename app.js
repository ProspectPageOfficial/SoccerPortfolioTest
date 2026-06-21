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


