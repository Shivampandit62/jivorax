/*
 * Simple Interest Calculator — Jivora
 * I = (P × R × T) ÷ 100 with time in years, months or days.
 */
(function () {
  "use strict";

  var form = document.getElementById("si-form");
  if (!form) return;

  var errorEl = document.getElementById("si-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("si-result");
  var copyBtn = document.getElementById("si-copy");
  var lastCopy = "";

  var EMPTY_HTML =
    '<p class="result__empty">Enter the principal, rate and time, then press Calculate — the interest appears here.</p>';

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
    if (opts.min != null && v < opts.min) {
      throw new Error(label.charAt(0).toUpperCase() + label.slice(1) + " can't be negative.");
    }
    if (opts.minExclusive != null && v <= opts.minExclusive) {
      throw new Error(label.charAt(0).toUpperCase() + label.slice(1) + " must be greater than " + opts.minExclusive + ".");
    }
    el.removeAttribute("aria-invalid");
    return v;
  }

  function calculate() {
    hideError();

    try {
      var principal = parseField("si-principal", "the principal amount", { min: 0 });
      var rate = parseField("si-rate", "the interest rate", { min: 0 });
      var time = parseField("si-time", "the time period", { minExclusive: 0 });
      var unit = document.getElementById("si-unit").value;

      var years = time;
      var unitLabel = time + (time === 1 ? " year" : " years");
      if (unit === "months") {
        years = time / 12;
        unitLabel = time + (time === 1 ? " month" : " months");
      } else if (unit === "days") {
        years = time / 365;
        unitLabel = time + (time === 1 ? " day" : " days");
      }

      var interest = (principal * rate * years) / 100;
      var total = principal + interest;

      var rows = [
        ["Principal", money(principal)],
        ["Interest rate", rate + "% per year"],
        ["Time period", unitLabel + " (" + years.toFixed(4).replace(/\.?0+$/, "") + " years)"],
        ["Total amount", money(total)]
      ];

      var html =
        '<p class="result__label">Simple interest</p>' +
        '<p class="result__primary grad-text">' + esc(money(interest)) + "</p>" +
        '<p class="result__caption">' + esc(money(principal)) + " × " + esc(String(rate)) + "% × " + esc(years.toFixed(4).replace(/\.?0+$/, "")) + " years</p>" +
        '<div class="result__rows">';

      var copyLines = ["Simple interest: " + money(interest)];
      for (var r = 0; r < rows.length; r++) {
        html +=
          '<div class="result-row"><span class="result-row__k">' + esc(rows[r][0]) +
          '</span><span class="result-row__v">' + esc(rows[r][1]) + "</span></div>";
        copyLines.push(rows[r][0] + ": " + rows[r][1]);
      }

      html += "</div>";
      resultEl.innerHTML = html;
      lastCopy = copyLines.join("\n");
      window.JivoraUI.track("tool_action", { tool: "simple-interest-calculator", action: "calculate" });
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
