/*
 * Jivora — shared UI behaviour.
 * Theme toggle, sticky navbar, mobile menu, scroll reveals, rotating hero
 * placeholders and small helpers (copy, format bytes) used by the tools.
 */
(function () {
  "use strict";

  var THEME_KEY = "jivora-theme";

  function track(name, params) {
    if (window.JivoraAnalytics) window.JivoraAnalytics.track(name, params);
  }

  /* ---------- theme ---------- */

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function applyTheme(theme, persist) {
    if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");

    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* private mode */ }
    }

    var btn = document.getElementById("theme-toggle");
    if (btn) {
      var next = theme === "light" ? "dark" : "light";
      btn.setAttribute("aria-label", next === "light" ? "Switch to light theme" : "Switch to dark theme");
      btn.setAttribute("title", next === "light" ? "Light mode" : "Dark mode");
    }

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f7f9fc" : "#070a14");
  }

  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
    applyTheme(stored === "light" ? "light" : "dark", false);

    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = currentTheme() === "light" ? "dark" : "light";
      applyTheme(next, true);
      track("theme_toggle", { theme: next });
    });
  }

  /* ---------- sticky header ---------- */

  function initHeader() {
    var header = document.getElementById("site-header");
    if (!header) return;

    var ticking = false;
    function update() {
      header.classList.toggle("scrolled", window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  /* ---------- mobile menu ---------- */

  function initMobileMenu() {
    var toggle = document.getElementById("menu-toggle");
    var menu = document.getElementById("mobile-menu");
    if (!toggle || !menu) return;

    function setOpen(open) {
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.classList.toggle("is-locked", open);
    }

    toggle.addEventListener("click", function () {
      setOpen(menu.hidden);
    });

    menu.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) setOpen(false);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 900 && !menu.hidden) setOpen(false);
    });
  }

  /* ---------- scroll reveal ---------- */

  function initReveal() {
    var els = document.querySelectorAll("[data-reveal]");
    if (!els.length) return;

    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || !("IntersectionObserver" in window)) {
      for (var i = 0; i < els.length; i++) els[i].classList.add("is-visible");
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    for (var j = 0; j < els.length; j++) io.observe(els[j]);
  }

  /* ---------- rotating hero placeholder ---------- */

  function initHeroPlaceholder() {
    var input = document.getElementById("hero-search");
    if (!input) return;

    var phrases = [
      'What do you need today?',
      'Search "QR Generator"',
      'Search "EMI Calculator"',
      'Search "Word Counter"',
      'Search "JSON Formatter"'
    ];
    var idx = 0;
    input.setAttribute("placeholder", phrases[0]);

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    window.setInterval(function () {
      if (document.activeElement === input || input.value) return;
      idx = (idx + 1) % phrases.length;
      input.classList.add("is-fading");
      window.setTimeout(function () {
        input.setAttribute("placeholder", phrases[idx]);
        input.classList.remove("is-fading");
      }, 220);
    }, 2800);
  }

  /* ---------- shared helpers for tool pages ---------- */

  function copyText(text) {
    return new Promise(function (resolve) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { resolve(true); }, function () {
          resolve(fallbackCopy(text));
        });
      } else {
        resolve(fallbackCopy(text));
      }
    });
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function flashButton(btn, label) {
    if (!btn) return;
    if (btn.dataset.origLabel === undefined) btn.dataset.origLabel = btn.innerHTML;
    var original = btn.dataset.origLabel;
    btn.classList.add("is-success");
    btn.innerHTML = label || "&#10003; Copied!";
    window.clearTimeout(btn._flashTimer);
    btn._flashTimer = window.setTimeout(function () {
      btn.classList.remove("is-success");
      btn.innerHTML = original;
    }, 1600);
  }

  function copyFromButton(btn, text, trackName) {
    copyText(text).then(function (ok) {
      if (ok) {
        flashButton(btn, "&#10003; Copied!");
        if (trackName) track(trackName, { tool: document.body.getAttribute("data-tool") || "" });
      } else if (btn) {
        var prev = btn.innerHTML;
        btn.innerHTML = "Press Ctrl+C";
        window.setTimeout(function () { btn.innerHTML = prev; }, 1600);
      }
    });
  }

  function formatBytes(bytes) {
    if (!isFinite(bytes) || bytes < 0) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function round(value, places) {
    var f = Math.pow(10, places == null ? 2 : places);
    return Math.round((value + Number.EPSILON) * f) / f;
  }

  function money(value) {
    var n = round(value, 2);
    try {
      return "\u20B9" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
      return "\u20B9" + n.toFixed(2);
    }
  }

  /* ---------- boot ---------- */

  initTheme();
  initHeader();
  initMobileMenu();
  initReveal();
  initHeroPlaceholder();

  /* track a tool page view */
  if (document.body.getAttribute("data-page") === "tool") {
    var slug = document.body.getAttribute("data-tool");
    var cat = "";
    if (window.JIVORA_TOOLS && slug) {
      for (var t = 0; t < JIVORA_TOOLS.length; t++) {
        if (JIVORA_TOOLS[t].slug === slug) { cat = JIVORA_TOOLS[t].cat; break; }
      }
    }
    track("tool_view", { tool: slug, category: cat });
  }

  /* expose helpers for tool scripts */
  window.JivoraUI = {
    copyText: copyText,
    copyFromButton: copyFromButton,
    flashButton: flashButton,
    formatBytes: formatBytes,
    round: round,
    money: money,
    track: track
  };
})();
