/*
 * Password Generator — Jivora
 * Cryptographically secure passwords (crypto.getRandomValues) with
 * length control, character-set options and entropy-based scoring.
 */
(function () {
  "use strict";

  var form = document.getElementById("pw-form");
  if (!form) return;

  var output = document.getElementById("pw-output");
  var copyBtn = document.getElementById("pw-copy");
  var lengthInput = document.getElementById("pw-length");
  var lengthVal = document.getElementById("pw-length-val");
  var errorEl = document.getElementById("pw-error");
  var errorText = errorEl.querySelector("span");

  var boxes = {
    upper: document.getElementById("pw-upper"),
    lower: document.getElementById("pw-lower"),
    numbers: document.getElementById("pw-numbers"),
    symbols: document.getElementById("pw-symbols"),
    similar: document.getElementById("pw-similar")
  };

  var bars = document.getElementById("pw-bars");
  var strength = document.getElementById("pw-strength");
  var entropyEl = document.getElementById("pw-entropy");

  var POOLS = {
    upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lower: "abcdefghijklmnopqrstuvwxyz",
    numbers: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{};:,.?/~"
  };
  var SIMILAR = "il1LI0Oo`'\"{}[]();:,.";

  var current = "";

  /* ---------- helpers ---------- */

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
    window.clearTimeout(errorEl._timer);
    errorEl._timer = window.setTimeout(function () {
      errorEl.classList.remove("is-shown");
    }, 3600);
  }

  function randomInt(max) {
    /* Uniform integer in [0, max) using rejection sampling. */
    var arr = new Uint32Array(1);
    var limit = Math.floor(4294967296 / max) * max;
    var x;
    do {
      window.crypto.getRandomValues(arr);
      x = arr[0];
    } while (x >= limit);
    return x % max;
  }

  function pick(str) {
    return str.charAt(randomInt(str.length));
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randomInt(i + 1);
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function stripSimilar(str) {
    var outStr = "";
    for (var i = 0; i < str.length; i++) {
      if (SIMILAR.indexOf(str.charAt(i)) === -1) outStr += str.charAt(i);
    }
    return outStr;
  }

  /* ---------- generation ---------- */

  function activePools() {
    var pools = [];
    if (boxes.upper.checked) pools.push(POOLS.upper);
    if (boxes.lower.checked) pools.push(POOLS.lower);
    if (boxes.numbers.checked) pools.push(POOLS.numbers);
    if (boxes.symbols.checked) pools.push(POOLS.symbols);
    if (boxes.similar.checked) {
      pools = pools.map(stripSimilar).filter(function (p) { return p.length > 0; });
    }
    return pools;
  }

  function strengthFor(bits) {
    if (bits < 30) return { level: 1, label: "Weak" };
    if (bits < 50) return { level: 2, label: "Fair" };
    if (bits < 70) return { level: 3, label: "Strong" };
    return { level: 4, label: "Excellent" };
  }

  function updateMeter(poolSize, length) {
    var bits = poolSize > 0 ? Math.round(length * (Math.log(poolSize) / Math.LN2)) : 0;
    var s = strengthFor(bits);
    bars.setAttribute("data-level", String(s.level));
    strength.setAttribute("data-level", String(s.level));
    strength.textContent = poolSize > 0 ? s.label : "—";
    entropyEl.textContent = bits > 0 ? "~" + bits + " bits of entropy" : "select a character set";
    return bits;
  }

  function generate() {
    var pools = activePools();

    if (!pools.length) {
      current = "";
      output.textContent = "\u2014";
      updateMeter(0, 0);
      showError("Choose at least one character set to generate a password.");
      return;
    }

    errorEl.classList.remove("is-shown");

    var length = Math.max(6, Math.min(64, parseInt(lengthInput.value, 10) || 16));
    var all = pools.join("");

    /* one guaranteed character from each selected pool */
    var chars = [];
    var p;
    for (p = 0; p < pools.length && p < length; p++) chars.push(pick(pools[p]));
    while (chars.length < length) chars.push(pick(all));

    shuffle(chars);
    current = chars.join("");

    output.textContent = current;
    updateMeter(all.length, length);
  }

  /* ---------- events ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    generate();
    window.JivoraUI.track("tool_action", { tool: "password-generator", action: "generate" });
  });

  lengthInput.addEventListener("input", function () {
    lengthVal.textContent = lengthInput.value;
    generate();
  });

  for (var key in boxes) {
    if (boxes.hasOwnProperty(key)) {
      boxes[key].addEventListener("change", generate);
    }
  }

  copyBtn.addEventListener("click", function () {
    if (!current) {
      showError("Generate a password first, then copy it.");
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, current, "tool_copy");
  });

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      lengthVal.textContent = lengthInput.value;
      errorEl.classList.remove("is-shown");
      generate();
    }, 0);
  });

  /* first password, ready on load */
  lengthVal.textContent = lengthInput.value;
  generate();
})();
