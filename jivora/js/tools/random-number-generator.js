/*
 * Random Number Generator — Jivora
 * Cryptographically secure integers and decimals with an unbiased
 * range mapping (rejection sampling) and a no-repeats unique mode.
 */
(function () {
  "use strict";

  var form = document.getElementById("rn-form");
  if (!form) return;

  var minInput = document.getElementById("rn-min");
  var maxInput = document.getElementById("rn-max");
  var countInput = document.getElementById("rn-count");
  var uniqueChk = document.getElementById("rn-unique");
  var goBtn = document.getElementById("rn-go");
  var copyBtn = document.getElementById("rn-copy");
  var errorEl = document.getElementById("rn-error");
  var errorText = errorEl.querySelector("span");
  var primaryEl = document.getElementById("rn-primary");
  var outWrap = document.getElementById("rn-outwrap");
  var outEl = document.getElementById("rn-out");
  var rangeEl = document.getElementById("rn-range");
  var drawnEl = document.getElementById("rn-drawn");
  var statusEl = document.getElementById("rn-status");

  var mode = "int";
  var lastOutput = "";

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
    window.clearTimeout(errorEl._timer);
    errorEl._timer = window.setTimeout(function () {
      errorEl.classList.remove("is-shown");
    }, 5000);
    errorEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function hideError() {
    errorEl.classList.remove("is-shown");
  }

  /* ---------- secure randomness ---------- */

  function cryptoOk() {
    return !!(window.crypto && window.crypto.getRandomValues);
  }

  /* uniform integer in [0, range) via rejection sampling */
  function randBelow(range) {
    if (range <= 0) return 0;
    if (!cryptoOk()) return Math.floor(Math.random() * range);

    if (range <= 4294967296) {
      var buf = new Uint32Array(1);
      var limit = Math.floor(4294967296 / range) * range;
      var v;
      do {
        window.crypto.getRandomValues(buf);
        v = buf[0];
      } while (v >= limit);
      return v % range;
    }

    /* very large ranges: two 32-bit draws — bias is far below 1 part in 10^18 */
    var buf2 = new Uint32Array(2);
    window.crypto.getRandomValues(buf2);
    var combined = buf2[0] * 4294967296 + buf2[1];
    return combined % range;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randBelow(i + 1);
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /* ---------- generation ---------- */

  function generate() {
    hideError();

    var min = parseFloat(minInput.value);
    var max = parseFloat(maxInput.value);
    var count = parseInt(countInput.value, 10);
    var isInt = mode === "int";

    if (!isFinite(min) || !isFinite(max)) {
      showError("Enter both a minimum and a maximum value.");
      return;
    }
    if (min > max) {
      showError("The minimum must be less than or equal to the maximum.");
      (min < max ? maxInput : minInput).setAttribute("aria-invalid", "true");
      return;
    }
    if (!isFinite(count) || count < 1 || count > 100) {
      showError("Choose between 1 and 100 numbers.");
      countInput.setAttribute("aria-invalid", "true");
      return;
    }
    minInput.removeAttribute("aria-invalid");
    maxInput.removeAttribute("aria-invalid");
    countInput.removeAttribute("aria-invalid");

    if (isInt) {
      min = Math.round(min);
      max = Math.round(max);
    }

    var results = [];

    if (isInt && uniqueChk.checked) {
      var span = max - min + 1;
      if (count > span) {
        showError("A range of " + span + " number" + (span === 1 ? "" : "s") +
          " can't produce " + count + " unique draws. Widen the range or ask for fewer.");
        return;
      }
      /* sample without replacement */
      var picks = {};
      var guard = 0;
      while (results.length < count && guard < count * 200) {
        guard++;
        var v = min + randBelow(span);
        if (!picks[v]) {
          picks[v] = true;
          results.push(v);
        }
      }
      results = shuffle(results);
    } else if (isInt) {
      for (var i = 0; i < count; i++) {
        results.push(min + randBelow(max - min + 1));
      }
    } else {
      var spanDec = max - min;
      for (var d = 0; d < count; d++) {
        var r = spanDec === 0 ? 0 : randBelow(4294967296) / 4294967296 * spanDec;
        results.push(Math.round((min + r) * 100) / 100);
      }
    }

    render(results, min, max, count);
    window.JivoraUI.track("tool_action", {
      tool: "random-number-generator",
      action: "generate",
      count: results.length
    });
  }

  function render(results, min, max, count) {
    var isInt = mode === "int";
    var formatted = results.map(function (v) {
      return isInt ? String(v) : v.toFixed(2);
    });

    lastOutput = formatted.join(", ");

    if (results.length === 1) {
      primaryEl.hidden = false;
      outWrap.hidden = true;
      primaryEl.textContent = formatted[0];
    } else {
      primaryEl.hidden = true;
      outWrap.hidden = false;
      outEl.textContent = lastOutput;
    }

    rangeEl.textContent = min + " – " + max;
    drawnEl.textContent = String(results.length);
    statusEl.innerHTML =
      '<span class="is-ok">' + (isInt ? "Whole numbers" : "Decimals (2 dp)") +
      (uniqueChk.checked && isInt ? " \u00B7 unique" : "") + "</span>" +
      "<span>" + results.length + " number" + (results.length === 1 ? "" : "s") + " drawn on this device</span>";
  }

  /* ---------- events ---------- */

  var segButtons = form.querySelectorAll(".seg__btn");
  for (var s = 0; s < segButtons.length; s++) {
    segButtons[s].addEventListener("click", function (e) {
      var btn = e.currentTarget;
      mode = btn.getAttribute("data-mode");
      for (var i = 0; i < segButtons.length; i++) {
        var on = segButtons[i] === btn;
        segButtons[i].classList.toggle("is-on", on);
        segButtons[i].setAttribute("aria-pressed", on ? "true" : "false");
      }
      uniqueChk.disabled = mode === "dec";
      if (mode === "dec") {
        minInput.step = "0.01";
        maxInput.step = "0.01";
      } else {
        minInput.step = "1";
        maxInput.step = "1";
      }
      hideError();
      generate();
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    generate();
  });

  copyBtn.addEventListener("click", function () {
    if (!lastOutput) {
      window.JivoraUI.flashButton(copyBtn, "Nothing to copy yet");
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastOutput, "tool_copy");
  });

  var fields = [minInput, maxInput, countInput, uniqueChk];
  for (var f = 0; f < fields.length; f++) {
    fields[f].addEventListener("input", hideError);
    fields[f].addEventListener("change", hideError);
  }

  /* first draw so the panel shows real numbers */
  generate();
})();
