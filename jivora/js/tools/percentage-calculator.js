/*
 * Percentage Calculator — Jivora
 * Modes: P% of X · X is what % of Y · percentage increase/decrease
 */
(function () {
  "use strict";

  var form = document.getElementById("pct-form");
  if (!form) return;

  var errorEl = document.getElementById("pct-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("pct-result");
  var copyBtn = document.getElementById("pct-copy");
  var mode = "of";
  var lastCopy = "";

  var modeGroups = {
    of: document.getElementById("mode-of"),
    what: document.getElementById("mode-what"),
    change: document.getElementById("mode-change")
  };

  /* ---------- helpers ---------- */

  function fmt(n) {
    if (!isFinite(n)) return "—";
    var r = Math.round(n * 1e6) / 1e6;
    if (Math.abs(r) >= 1e12) return r.toExponential(4);
    return String(r);
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
  }

  function hideError() {
    errorEl.classList.remove("is-shown");
    var invalid = form.querySelectorAll('[aria-invalid="true"]');
    for (var i = 0; i < invalid.length; i++) invalid[i].removeAttribute("aria-invalid");
  }

  function parseField(id, label, opts) {
    opts = opts || {};
    var el = document.getElementById(id);
    var raw = (el.value || "").trim().replace(/,/g, "");
    el.setAttribute("aria-invalid", "true");
    if (raw === "") throw new Error("Please enter " + label + ".");
    var v = Number(raw);
    if (!isFinite(v)) throw new Error("Please enter a valid number for " + label + ".");
    if (opts.noZero && v === 0) throw new Error(label + " can't be zero.");
    el.removeAttribute("aria-invalid");
    return v;
  }

  function render(out) {
    var html =
      '<p class="result__label">Result</p>' +
      '<p class="result__primary grad-text">' + esc(out.primary) + "</p>" +
      (out.caption ? '<p class="result__caption">' + esc(out.caption) + "</p>" : "") +
      '<div class="result__rows">';

    var copyLines = [out.primary];
    if (out.caption) copyLines.push(out.caption);

    for (var i = 0; i < out.rows.length; i++) {
      var row = out.rows[i];
      html +=
        '<div class="result-row"><span class="result-row__k">' + esc(row[0]) +
        '</span><span class="result-row__v">' + esc(row[1]) + "</span></div>";
      copyLines.push(row[0] + ": " + row[1]);
    }

    html += "</div>";
    resultEl.innerHTML = html;
    lastCopy = copyLines.join("\n");
  }

  /* ---------- calculations ---------- */

  function calculate() {
    hideError();

    try {
      if (mode === "of") {
        var rate = parseField("pct-rate", "the percentage");
        var value = parseField("pct-value", "the number");
        var answer = (rate / 100) * value;
        render({
          primary: fmt(answer),
          caption: fmt(rate) + "% of " + fmt(value),
          rows: [["Formula", "(" + fmt(rate) + " ÷ 100) × " + fmt(value)]]
        });
        return;
      }

      if (mode === "what") {
        var x = parseField("pct-x", "X");
        var y = parseField("pct-y", "Y", { noZero: true });
        var pct = (x / y) * 100;
        render({
          primary: fmt(pct) + "%",
          caption: fmt(x) + " is " + fmt(pct) + "% of " + fmt(y),
          rows: [["Formula", "(" + fmt(x) + " ÷ " + fmt(y) + ") × 100"]]
        });
        return;
      }

      /* change mode */
      var from = parseField("pct-from", "the original value", { noZero: true });
      var to = parseField("pct-to", "the new value");
      var diff = to - from;
      var change = (diff / from) * 100;
      var sign = change > 0 ? "+" : "";
      render({
        primary: sign + fmt(change) + "%",
        caption:
          diff > 0
            ? "Increase from " + fmt(from) + " to " + fmt(to)
            : diff < 0
            ? "Decrease from " + fmt(from) + " to " + fmt(to)
            : "No change — the value stayed at " + fmt(from),
        rows: [
          ["Difference", (diff > 0 ? "+" : "") + fmt(diff)],
          ["Original", fmt(from)],
          ["New", fmt(to)]
        ]
      });
    } catch (err) {
      showError(err && err.message ? err.message : "Something went wrong. Please check your numbers.");
    }
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
      for (var key in modeGroups) {
        if (modeGroups.hasOwnProperty(key)) modeGroups[key].hidden = key !== mode;
      }
      hideError();
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    calculate();
  });

  form.addEventListener("input", hideError);

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      hideError();
      resultEl.innerHTML =
        '<p class="result__empty">Choose a mode, enter your numbers and press Calculate — your answer appears here.</p>';
      lastCopy = "";
    }, 0);
  });

  copyBtn.addEventListener("click", function () {
    if (!lastCopy) {
      showError("Calculate a result first, then copy it.");
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastCopy, "tool_copy");
  });
})();
