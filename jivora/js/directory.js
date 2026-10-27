/*
 * Jivora — tools directory (tools/index.html).
 * Renders every tool from the shared registry, grouped by category,
 * and filters the grid as you type. No network requests.
 */
(function () {
  "use strict";

  var wrap = document.getElementById("dir-sections");
  if (!wrap || typeof JIVORA_TOOLS === "undefined") return;

  var searchInput = document.getElementById("dir-search");
  var countEl = document.getElementById("dir-count");
  var emptyEl = document.getElementById("dir-empty");
  var liveTotal = 0;

  var EMOJI = {
    student: "📚",
    finance: "💰",
    developer: "💻",
    text: "📝",
    image: "🖼️",
    everyday: "⚡"
  };

  function root() {
    return (document.body && document.body.getAttribute("data-root")) || "";
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function categoryOf(id) {
    for (var i = 0; i < JIVORA_CATEGORIES.length; i++) {
      if (JIVORA_CATEGORIES[i].id === id) return JIVORA_CATEGORIES[i];
    }
    return { id: id, name: "Tools", blurb: "" };
  }

  function iconFor(tool) {
    return JIVORA_ICONS[tool.icon] || JIVORA_ICONS.grid;
  }

  var ARROW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function cardMarkup(tool) {
    var cat = categoryOf(tool.cat);
    var inner =
      '<span class="tool-card__icon" aria-hidden="true">' + iconFor(tool) + "</span>" +
      '<span class="tool-card__cat">' + esc(cat.name) + "</span>" +
      '<h3 class="tool-card__name">' + esc(tool.name) + "</h3>" +
      '<p class="tool-card__desc">' + esc(tool.desc) + "</p>";

    if (tool.available) {
      return (
        '<a class="tool-card" href="' + root() + "tools/" + esc(tool.slug) + '.html" ' +
        'data-cat="' + esc(tool.cat) + '" data-dir-card data-keywords="' +
        esc((tool.name + " " + tool.desc + " " + (tool.keywords || []).join(" ")).toLowerCase()) +
        '">' + inner +
        '<span class="tool-card__foot">Open Tool ' + ARROW + "</span></a>"
      );
    }

    return (
      '<div class="tool-card tool-card--soon" data-cat="' + esc(tool.cat) + '" data-dir-card ' +
      'data-keywords="' +
      esc((tool.name + " " + tool.desc + " " + (tool.keywords || []).join(" ")).toLowerCase()) +
      '">' + inner +
      '<span class="tool-card__foot">Coming soon</span></div>'
    );
  }

  function build() {
    var html = "";
    var total = 0;
    var available = 0;

    for (var c = 0; c < JIVORA_CATEGORIES.length; c++) {
      var cat = JIVORA_CATEGORIES[c];
      var tools = [];
      for (var t = 0; t < JIVORA_TOOLS.length; t++) {
        if (JIVORA_TOOLS[t].cat === cat.id) tools.push(JIVORA_TOOLS[t]);
      }
      if (!tools.length) continue;

      var live = 0;
      var cards = "";
      for (var i = 0; i < tools.length; i++) {
        if (tools[i].available) live++;
        cards += cardMarkup(tools[i]);
      }
      total += tools.length;
      available += live;
      liveTotal = available;

      html +=
        '<section class="section section--sm" id="cat-' + esc(cat.id) + '" data-dir-section data-cat="' + esc(cat.id) + '">' +
          '<div class="section-head section-head--left">' +
            '<h2 class="section-title">' + (EMOJI[cat.id] || "") + " " + esc(cat.name) + "</h2>" +
            '<p class="section-sub">' + tools.length + " tools · " + live + " available now</p>" +
          "</div>" +
          '<div class="tools-grid">' + cards + "</div>" +
        "</section>";
    }

    wrap.innerHTML = html;
    if (countEl) {
      countEl.textContent = "Showing " + total + " of " + total + " tools (" + available + " live today)";
    }
  }

  /* ---------- filtering ---------- */

  function applyFilter() {
    var q = (searchInput && searchInput.value ? searchInput.value : "").trim().toLowerCase();
    var cards = wrap.querySelectorAll("[data-dir-card]");
    var shown = 0;
    var i;

    for (i = 0; i < cards.length; i++) {
      var card = cards[i];
      var key = card.getAttribute("data-keywords") || "";
      var hit = !q || key.indexOf(q) !== -1;
      card.style.display = hit ? "" : "none";
      if (hit) shown++;
    }

    var sections = wrap.querySelectorAll("[data-dir-section]");
    for (i = 0; i < sections.length; i++) {
      var inner = sections[i].querySelectorAll("[data-dir-card]");
      var any = false;
      for (var k = 0; k < inner.length; k++) {
        if (inner[k].style.display !== "none") { any = true; break; }
      }
      sections[i].style.display = any ? "" : "none";
    }

    if (emptyEl) emptyEl.classList.toggle("is-shown", shown === 0);
    if (countEl) {
      countEl.textContent = q
        ? "Showing " + shown + " matching tool" + (shown === 1 ? "" : "s")
        : "Showing " + cards.length + " of " + cards.length + " tools (" +
          liveTotal + " live today)";
    }
  }

  build();
  applyFilter();

  if (searchInput) {
    searchInput.addEventListener("input", applyFilter);
    searchInput.form && searchInput.form.addEventListener("submit", function (e) {
      e.preventDefault();
    });
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        searchInput.value = "";
        applyFilter();
      }
    });
  }

  /* category deep-links from the home page (#cat-student etc.) */
  if (window.location.hash) {
    var target = document.getElementById(window.location.hash.slice(1));
    if (target && target.scrollIntoView) {
      window.setTimeout(function () { target.scrollIntoView(); }, 60);
    }
  }
})();
