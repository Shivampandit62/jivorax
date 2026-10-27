/*
 * Jivora — instant, fully client-side tool search.
 * Builds a command-palette overlay (Ctrl/Cmd + K or "/") and powers the
 * hero search box. No network requests: everything runs in your browser.
 */
(function () {
  "use strict";

  var overlay = null;
  var input = null;
  var resultsEl = null;
  var lastTrigger = null;
  var currentResults = [];
  var activeIndex = 0;
  var noResultsTracked = false;

  /* ---------- helpers ---------- */

  function root() {
    return (document.body && document.body.getAttribute("data-root")) || "";
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function categoryOf(id) {
    for (var i = 0; i < JIVORA_CATEGORIES.length; i++) {
      if (JIVORA_CATEGORIES[i].id === id) return JIVORA_CATEGORIES[i];
    }
    return { id: id, name: "Tools", icon: "grid", blurb: "" };
  }

  function iconFor(tool) {
    return JIVORA_ICONS[tool.icon] || JIVORA_ICONS.grid;
  }

  function toolUrl(slug) {
    return root() + "tools/" + slug + ".html";
  }

  function findTool(slug) {
    for (var i = 0; i < JIVORA_TOOLS.length; i++) {
      if (JIVORA_TOOLS[i].slug === slug) return JIVORA_TOOLS[i];
    }
    return null;
  }

  function track(name, params) {
    if (window.JivoraAnalytics) window.JivoraAnalytics.track(name, params);
  }

  function trackNoResults() {
    if (noResultsTracked) return;
    noResultsTracked = true;
    track("search_no_results", {});
  }

  function popularTools() {
    var list = [];
    var i;
    for (i = 0; i < JIVORA_POPULAR_SLUGS.length; i++) {
      var t = findTool(JIVORA_POPULAR_SLUGS[i]);
      if (t) list.push(t);
    }
    return list;
  }

  /* ---------- scoring ---------- */

  function scoreTool(tool, words) {
    var name = tool.name.toLowerCase();
    var nameWords = name.split(/[\s→]+/);
    var desc = tool.desc.toLowerCase();
    var cat = categoryOf(tool.cat).name.toLowerCase();
    var kws = (tool.keywords || []).map(function (k) { return k.toLowerCase(); });
    var total = 0;

    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var s = 0;
      var k;

      for (k = 0; k < kws.length; k++) {
        if (kws[k] === w) s = Math.max(s, 100);
        else if (kws[k].indexOf(w) === 0) s = Math.max(s, 88);
      }

      if (name === w) s = Math.max(s, 96);
      else if (name.indexOf(w) === 0) s = Math.max(s, 92);
      else {
        var startsWord = false;
        for (var n = 0; n < nameWords.length; n++) {
          if (nameWords[n].indexOf(w) === 0) { startsWord = true; break; }
        }
        if (startsWord) s = Math.max(s, 86);
        else if (name.indexOf(w) !== -1) s = Math.max(s, 80);
      }

      if (cat.indexOf(w) !== -1) s = Math.max(s, 62);
      if (desc.indexOf(w) !== -1) s = Math.max(s, 54);

      if (s === 0) return 0; /* every word must match something */
      total += s;
    }
    return total;
  }

  function search(query) {
    var q = String(query || "").trim().toLowerCase().replace(/\s+/g, " ");

    if (!q) {
      var defaults = popularTools();
      for (var d = 0; d < JIVORA_TOOLS.length; d++) {
        if (JIVORA_TOOLS[d].available && defaults.indexOf(JIVORA_TOOLS[d]) === -1) {
          defaults.push(JIVORA_TOOLS[d]);
        }
      }
      return defaults;
    }

    var words = q.split(" ");
    var scored = [];
    for (var i = 0; i < JIVORA_TOOLS.length; i++) {
      var s = scoreTool(JIVORA_TOOLS[i], words);
      if (s > 0) scored.push({ tool: JIVORA_TOOLS[i], score: s });
    }

    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.tool.available !== b.tool.available) return a.tool.available ? -1 : 1;
      return a.tool.name.localeCompare(b.tool.name);
    });

    return scored.slice(0, 12).map(function (x) { return x.tool; });
  }

  /* ---------- rendering ---------- */

  function resultMarkup(tool) {
    var cat = categoryOf(tool.cat);
    var tag = tool.available
      ? '<span class="result-tag">Open</span>'
      : '<span class="result-tag is-soon">Coming soon</span>';

    return (
      '<span class="result-icon" aria-hidden="true">' + iconFor(tool) + "</span>" +
      '<span class="result-body">' +
        '<span class="result-name">' + esc(tool.name) + "</span>" +
        '<span class="result-meta"><span class="result-cat">' + esc(cat.name) + "</span>" +
        '<span class="result-desc">' + esc(tool.desc) + "</span></span>" +
      "</span>" + tag
    );
  }

  function renderItem(tool) {
    if (tool.available) {
      return (
        '<button type="button" class="search-result" role="option" data-slug="' +
        esc(tool.slug) + '" data-available="1">' + resultMarkup(tool) + "</button>"
      );
    }
    return (
      '<div class="search-result is-soon" role="option" aria-disabled="true" data-slug="' +
      esc(tool.slug) + '">' + resultMarkup(tool) + "</div>"
    );
  }

  function renderResults(container, tools, opts) {
    opts = opts || {};
    currentResults = tools || [];
    activeIndex = 0;
    container.innerHTML = "";

    if (!currentResults.length) {
      var pop = popularTools();
      var html =
        '<div class="search-empty">' +
          '<p class="search-empty-title">We couldn\'t find that tool yet 👀</p>' +
          '<p class="search-empty-sub">Try one of the popular tools instead:</p>' +
        "</div>";
      html += '<div class="search-list">';
      for (var p = 0; p < Math.min(pop.length, 4); p++) html += renderItem(pop[p]);
      html += "</div>";
      container.innerHTML = html;
      trackNoResults();
    } else {
      var list = '<div class="search-list">';
      for (var i = 0; i < currentResults.length; i++) list += renderItem(currentResults[i]);
      list += "</div>";
      container.innerHTML = list;
      if (opts.note) {
        container.insertAdjacentHTML(
          "afterbegin",
          '<p class="search-note">' + esc(opts.note) + "</p>"
        );
      }
    }

    highlightActive();
  }

  function items() {
    if (!resultsEl) return [];
    return Array.prototype.slice.call(
      resultsEl.querySelectorAll(".search-result")
    );
  }

  function highlightActive() {
    var all = items();
    for (var i = 0; i < all.length; i++) {
      var on = i === activeIndex;
      all[i].classList.toggle("is-active", on);
      all[i].setAttribute("aria-selected", on ? "true" : "false");
      if (on && all[i].scrollIntoView) {
        try { all[i].scrollIntoView({ block: "nearest" }); } catch (e) { /* ignore */ }
      }
    }
  }

  function moveActive(delta) {
    var all = items();
    if (!all.length) return;
    activeIndex = (activeIndex + delta + all.length) % all.length;
    highlightActive();
  }

  function goTo(tool) {
    if (!tool || !tool.available) return;
    track("search_result_open", { tool: tool.slug, category: tool.cat });
    window.location.href = toolUrl(tool.slug);
  }

  function toolForIndex(idx) {
    var all = items();
    if (!all.length) return null;
    var slug = all[idx] && all[idx].getAttribute("data-slug");
    return slug ? findTool(slug) : null;
  }

  /* ---------- overlay ---------- */

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.className = "search-overlay";
    overlay.id = "search-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="search-backdrop" data-search-close></div>' +
      '<div class="search-panel" role="dialog" aria-modal="true" aria-label="Search tools">' +
        '<div class="search-field">' +
          '<span class="search-field-icon" aria-hidden="true">' + JIVORA_ICONS.grid + "</span>" +
          '<input type="search" id="search-input" class="search-input" autocomplete="off" ' +
          'spellcheck="false" role="combobox" aria-expanded="true" aria-controls="search-results" ' +
          'aria-autocomplete="list" aria-label="Search tools" ' +
          'placeholder="Search tools… e.g. QR, EMI, JSON">' +
          '<button type="button" class="search-esc" data-search-close aria-label="Close search">Esc</button>' +
        "</div>" +
        '<div class="search-results" id="search-results" role="listbox" aria-label="Search results"></div>' +
        '<div class="search-hints" aria-hidden="true">' +
          "<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>" +
          "<span><kbd>Enter</kbd> open</span>" +
          "<span><kbd>Esc</kbd> close</span>" +
          '<span class="search-hint-private">Runs in your browser 🔒</span>' +
        "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    input = overlay.querySelector(".search-input");
    resultsEl = overlay.querySelector(".search-results");

    overlay.addEventListener("click", function (e) {
      var closer = e.target.closest ? e.target.closest("[data-search-close]") : null;
      if (closer) { closeSearch(); return; }
      var item = e.target.closest ? e.target.closest(".search-result") : null;
      if (item && item.getAttribute("data-available")) {
        goTo(findTool(item.getAttribute("data-slug")));
      }
    });

    input.addEventListener("input", function () {
      noResultsTracked = false;
      refresh();
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
      else if (e.key === "Enter") { e.preventDefault(); goTo(toolForIndex(activeIndex)); }
      else if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
    });
  }

  function refresh() {
    if (!resultsEl) return;
    var q = input.value;
    var tools = search(q);
    var trimmed = q.trim();
    renderResults(resultsEl, tools, {
      note: trimmed
        ? null
        : "Popular tools — or start typing to search all " + JIVORA_TOOLS.length + " tools"
    });
  }

  function openSearch(prefill) {
    if (!overlay) return;
    lastTrigger = document.activeElement;
    noResultsTracked = false;
    overlay.hidden = false;
    document.body.classList.add("is-locked");
    input.value = typeof prefill === "string" ? prefill : "";
    refresh();
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) { /* search inputs may differ */ }
  }

  function closeSearch() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove("is-locked");
    if (lastTrigger && lastTrigger.focus) {
      try { lastTrigger.focus({ preventScroll: true }); } catch (e) { lastTrigger.focus(); }
    }
  }

  function isOpen() {
    return overlay && !overlay.hidden;
  }

  /* ---------- hero search (home page) ---------- */

  function initHero() {
    var heroInput = document.getElementById("hero-search");
    var heroBox = document.getElementById("hero-results");
    if (!heroInput || !heroBox) return;

    function hideHero() {
      heroBox.hidden = true;
      heroInput.setAttribute("aria-expanded", "false");
    }

    function renderHero() {
      var q = heroInput.value;
      if (!q.trim()) { hideHero(); return; }
      noResultsTracked = false;
      var tools = search(q).slice(0, 6);
      renderResults(heroBox, tools, {});
      heroBox.hidden = false;
      heroInput.setAttribute("aria-expanded", "true");
    }

    heroInput.addEventListener("input", renderHero);
    heroInput.addEventListener("focus", function () {
      if (heroInput.value.trim()) renderHero();
    });

    heroInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var tools = search(heroInput.value);
        var first = null;
        for (var i = 0; i < tools.length; i++) {
          if (tools[i].available) { first = tools[i]; break; }
        }
        if (first) goTo(first);
        else if (heroInput.value.trim()) openSearch(heroInput.value);
      } else if (e.key === "ArrowDown") {
        var firstItem = heroBox.querySelector(".search-result");
        if (firstItem) { e.preventDefault(); firstItem.focus(); }
      } else if (e.key === "Escape") {
        hideHero();
        heroInput.blur();
      }
    });

    /* keep focus while clicking a result */
    heroBox.addEventListener("mousedown", function (e) { e.preventDefault(); });

    heroBox.addEventListener("click", function (e) {
      var item = e.target.closest ? e.target.closest(".search-result") : null;
      if (item && item.getAttribute("data-available")) {
        goTo(findTool(item.getAttribute("data-slug")));
      }
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      if (!e.target.closest(".hero-search")) hideHero();
    });
  }

  /* ---------- global wiring ---------- */

  function onDocumentClick(e) {
    var trigger = e.target.closest ? e.target.closest("[data-search-open]") : null;
    if (!trigger) return;
    e.preventDefault();
    openSearch(trigger.getAttribute("data-prefill") || "");
  }

  function onKeydown(e) {
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    var typing = tag === "input" || tag === "textarea" || tag === "select" ||
      (e.target && e.target.isContentEditable);

    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      if (isOpen()) closeSearch();
      else openSearch("");
      return;
    }

    if (e.key === "/" && !typing && !isOpen()) {
      e.preventDefault();
      openSearch("");
      return;
    }

    if (e.key === "Escape" && isOpen()) {
      closeSearch();
    }
  }

  buildOverlay();
  initHero();
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);

  /* small public API (used by tool pages if needed) */
  window.JivoraSearch = {
    search: search,
    renderResults: renderResults,
    open: openSearch,
    close: closeSearch
  };
})();
