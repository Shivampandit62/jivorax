/*
 * Compound Interest Calculator — Jivora
 * A = P (1 + r/n)^(n t) with frequency options and effective yield.
 */
(function () {
  "use strict";

  var form = document.getElementById("ci-form");
  if (!form) return;

  var errorEl = document.getElementById("ci-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("ci-result");
  var copyBtn = document.getElementById("ci-copy");
  var freqSel = document.getElementById("ci-freq");
  var lastCopy = "";

  var EMPTY_HTML =
    '<p class="result__empty">Enter the principal, rate and time, choose a compounding frequency and press Calculate.</p>';

  var FREQ_NAME = {
    1: "Yearly",
    2: "Half-yearly",
    4: "Quarterly",
    12: "Monthly",
    365: "Daily"
  };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function money(n) {
    var r = Math.round((n + Number.EPSILON) * 100) / 100;
    return window.JivoraUI ? window.JivoraUI.money(r) : "\u20B9" + r;
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
    if (opts.minExclusive != null && v <= opts.minExclusive) {
      throw new Error(label.charAt(0).toUpperCase() + label.slice(1) + " must be greater than " + opts.minExclusive + ".");
    }
    if (opts.min != null && v < opts.min) {
      throw new Error(label.charAt(0).toUpperCase() + label.slice(1) + " can't be negative.");
    }
    el.removeAttribute("aria-invalid");
    return v;
  }

  function calculate() {
    hideError();

    try {
      var principal = parseField("ci-principal", "the principal amount", { min: 0 });
      var rate = parseField("ci-rate", "the interest rate", { min: 0 });
      var years = parseField("ci-years", "the time period", { minExclusive: 0 });
      var n = parseInt(freqSel.value, 10) || 1;

      var r = rate / 100;
      var amount = principal * Math.pow(1 + r / n, n * years);
      var interest = amount - principal;
      var effective = (Math.pow(1 + r / n, n) - 1) * 100;
      var doubleYears = rate > 0 ? 72 / rate : Infinity;

      var rows = [
        ["Principal", money(principal)],
        ["Compound interest", money(interest)],
        ["Compounding", FREQ_NAME[n] + " (" + n + "/year)"],
        ["Effective annual yield", isFinite(effective) ? effective.toFixed(2) + "%" : "—"],
        ["Time period", years + (years === 1 ? " year" : " years")]
      ];
      if (isFinite(doubleYears)) {
        rows.push(["Rule of 72: doubles in", "~" + doubleYears.toFixed(1) + " years"]);
      }

      var html =
        '<p class="result__label">Total amount</p>' +
        '<p class="result__primary grad-text">' + esc(money(amount)) + "</p>" +
        '<p class="result__caption">' + esc(money(principal)) + " grew by " + esc(money(interest)) + " (" + esc(String(rate)) + "% " + esc(FREQ_NAME[n].toLowerCase()) + " compounding)</p>" +
        '<div class="result__rows">';

      var copyLines = ["Total amount: " + money(amount)];
      for (var i = 0; i < rows.length; i++) {
        html +=
          '<div class="result-row"><span class="result-row__k">' + esc(rows[i][0]) +
          '</span><span class="result-row__v">' + esc(rows[i][1]) + "</span></div>";
        copyLines.push(rows[i][0] + ": " + rows[i][1]);
      }

      html += "</div>";
      resultEl.innerHTML = html;
      lastCopy = copyLines.join("\n");
      window.JivoraUI.track("tool_action", { tool: "compound-interest-calculator", action: "calculate" });
    } catch (err) {
      showError(err && err.message ? err.message : "Something went wrong. Please check your numbers.");
    }
  }

  /* ---------- events ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    calculate();
  });

  form.addEventListener("input", hideError);
  form.addEventListener("change", hideError);

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      hideError();
      resultEl.innerHTML = EMPTY_HTML;
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
