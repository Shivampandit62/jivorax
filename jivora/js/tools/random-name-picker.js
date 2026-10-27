/*
 * Random Name Picker — Jivora
 * Unbiased draws from a pasted list using the same rejection-sampling
 * helper as the Random Number Generator. The list never leaves the tab.
 */
(function () {
  "use strict";

  var form = document.getElementById("rp-form");
  if (!form) return;

  var namesEl = document.getElementById("rp-names");
  var countEl = document.getElementById("rp-count");
  var noRepeatEl = document.getElementById("rp-norepeat");
  var errorEl = document.getElementById("rp-error");
  var errorText = errorEl.querySelector("span");
  var primaryEl = document.getElementById("rp-primary");
  var totalEl = document.getElementById("rp-total");
  var pickedEl = document.getElementById("rp-picked");
  var leftEl = document.getElementById("rp-left");
  var statusEl = document.getElementById("rp-status");
  var copyBtn = document.getElementById("rp-copy");
  var resetBtn = document.getElementById("rp-reset");

  var pool = [];      /* names still waiting to be picked (no-repeat mode) */
  var signature = ""; /* fingerprint of the list the pool was built from */
  var picked = 0;
  var lastPick = "";

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
    window.clearTimeout(errorEl._timer);
    errorEl._timer = window.setTimeout(function () {
      errorEl.classList.remove("is-shown");
    }, 5000);
  }

  function hideError() {
    errorEl.classList.remove("is-shown");
    namesEl.removeAttribute("aria-invalid");
    countEl.removeAttribute("aria-invalid");
  }

  /* ---------- fair randomness ---------- */

  function randBelow(range) {
    if (range <= 0) return 0;
    if (!(window.crypto && window.crypto.getRandomValues)) {
      return Math.floor(Math.random() * range);
    }
    var buf = new Uint32Array(1);
    var limit = Math.floor(4294967296 / range) * range;
    var v;
    do {
      window.crypto.getRandomValues(buf);
      v = buf[0];
    } while (v >= limit);
    return v % range;
  }

  /* ---------- list handling ---------- */

  function parseNames() {
    var lines = namesEl.value.split(/\r?\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var name = lines[i].replace(/^\s+|\s+$/g, "");
      if (name) out.push(name);
    }
    return out;
  }

  function uniqueNames(list) {
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (!seen[list[i]]) {
        seen[list[i]] = true;
        out.push(list[i]);
      }
    }
    return out;
  }

  function baseList(names, noRepeat) {
    return noRepeat ? uniqueNames(names) : names;
  }

  function refreshCounts(base, noRepeat) {
    totalEl.textContent = String(base.length);
    pickedEl.textContent = String(picked);
    leftEl.textContent = noRepeat ? String(pool.length) : String(base.length);
  }

  function status(noRepeat, base, leftText) {
    statusEl.innerHTML =
      '<span class="is-ok">Fair draw on this device</span>' +
      "<span>" + base.length + " name" + (base.length === 1 ? "" : "s") +
      " in the list · " + picked + " picked · " + leftText + "</span>";
    if (!noRepeat) return;
    if (pool.length === 0) {
      statusEl.innerHTML += "<span>Everyone has been picked — the list refills for the next draw.</span>";
    }
  }

  /* ---------- drawing ---------- */

  function draw() {
    hideError();

    var names = parseNames();
    if (!names.length) {
      showError("Add at least one name — one per line.");
      namesEl.setAttribute("aria-invalid", "true");
      namesEl.focus();
      return;
    }

    var count = parseInt(countEl.value, 10);
    if (!isFinite(count) || count < 1 || count > 20) {
      showError("Choose how many names to draw — between 1 and 20.");
      countEl.setAttribute("aria-invalid", "true");
      countEl.focus();
      return;
    }

    var noRepeat = noRepeatEl.checked;
    var base = baseList(names, noRepeat);
    var sig = (noRepeat ? "1|" : "0|") + base.join("\u0001");

    if (sig !== signature) {
      signature = sig;
      pool = base.slice();
      picked = 0;
    } else if (noRepeat && pool.length === 0) {
      pool = base.slice(); /* everyone was picked — start a fresh round */
    }

    if (noRepeat && count > pool.length) {
      showError(
        "Only " + pool.length + " name" + (pool.length === 1 ? "" : "s") +
        " left before the list refills — draw " + pool.length + " or fewer, or turn off no repeats."
      );
      countEl.setAttribute("aria-invalid", "true");
      return;
    }

    var picks = [];
    for (var i = 0; i < count; i++) {
      var idx = randBelow(pool.length);
      picks.push(pool[idx]);
      if (noRepeat) pool.splice(idx, 1);
    }

    picked += picks.length;
    lastPick = picks.join(", ");
    primaryEl.textContent = lastPick;

    refreshCounts(base, noRepeat);
    status(noRepeat, base, noRepeat ? pool.length + " left" : "repeats allowed");

    window.JivoraUI.track("tool_action", {
      tool: "random-name-picker",
      action: "draw",
      count: picks.length
    });
  }

  /* ---------- events ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    draw();
  });

  copyBtn.addEventListener("click", function () {
    if (!lastPick) {
      window.JivoraUI.flashButton(copyBtn, "Nothing to copy yet");
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastPick, "tool_copy");
  });

  resetBtn.addEventListener("click", function () {
    namesEl.value = "";
    countEl.value = "1";
    noRepeatEl.checked = true;
    pool = [];
    signature = "";
    picked = 0;
    lastPick = "";
    hideError();
    primaryEl.textContent = "Add your names to begin";
    totalEl.textContent = "0";
    pickedEl.textContent = "0";
    leftEl.textContent = "0";
    statusEl.textContent = "Paste a list of names — one per line — then press Pick a name.";
    namesEl.focus();
  });

  namesEl.addEventListener("input", hideError);
  countEl.addEventListener("input", hideError);
  noRepeatEl.addEventListener("change", function () {
    hideError();
    var base = baseList(parseNames(), noRepeatEl.checked);
    var sig = (noRepeatEl.checked ? "1|" : "0|") + base.join("\u0001");
    if (sig !== signature) {
      signature = sig;
      pool = base.slice();
      picked = 0;
    }
    refreshCounts(base, noRepeatEl.checked);
  });
})();
