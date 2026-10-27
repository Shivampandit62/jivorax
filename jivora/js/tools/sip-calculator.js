/*
 * SIP Calculator — Jivora
 * Monthly SIP and one-time lumpsum projections with an
 * invested-vs-returns breakdown bar.
 */
(function () {
  "use strict";

  var form = document.getElementById("sip-form");
  if (!form) return;

  var errorEl = document.getElementById("sip-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("sip-result");
  var copyBtn = document.getElementById("sip-copy");
  var mode = "sip";
  var lastCopy = "";

  var groups = {
    sip: document.getElementById("mode-sip"),
    lump: document.getElementById("mode-lump")
  };

  var EMPTY_HTML =
    '<p class="result__empty">Enter your amount, expected return and time period — the projected value appears here.</p>';

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function money(n) {
    return window.JivoraUI ? window.JivoraUI.money(n) : "\u20B9" + Math.round(n);
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
      throw new Error(label.charAt(0).toUpperCase() + label.slice(1) + " must be at least " + opts.min + ".");
    }
    el.removeAttribute("aria-invalid");
    return v;
  }

  function calculate() {
    hideError();

    try {
      var future;
      var invested;
      var ratePct;
      var years;

      if (mode === "sip") {
        var monthly = parseField("sip-monthly", "the monthly amount", { min: 1 });
        ratePct = parseField("sip-rate", "the expected return rate", { min: 0 });
        years = parseField("sip-years", "the time period", { min: 0.08 });

        var months = Math.round(years * 12);
        var i = ratePct / 12 / 100;
        if (i === 0) {
          future = monthly * months;
        } else {
          future = monthly * ((Math.pow(1 + i, months) - 1) / i) * (1 + i);
        }
        invested = monthly * months;
      } else {
        var amount = parseField("lump-amount", "the investment amount", { min: 1 });
        ratePct = parseField("lump-rate", "the expected return rate", { min: 0 });
        years = parseField("lump-years", "the time period", { min: 0.08 });

        future = amount * Math.pow(1 + ratePct / 100, years);
        invested = amount;
      }

      var returns = future - invested;
      var inPct = future > 0 ? (invested / future) * 100 : 100;
      var retPct = 100 - inPct;

      var rows = [
        ["Total invested", money(invested)],
        ["Estimated returns", money(returns)],
        ["Return rate", ratePct + "% per year"],
        ["Time period", years + (years === 1 ? " year" : " years")]
      ];

      var html =
        '<p class="result__label">Projected value</p>' +
        '<p class="result__primary grad-text">' + esc(money(future)) + "</p>" +
        '<p class="result__caption">' +
          esc(money(invested)) + " invested \u00B7 " + esc(money(returns)) + " gained" +
        "</p>" +
        '<div class="bar" aria-hidden="true">' +
          '<span class="bar__seg bar__seg--principal" style="width: ' + inPct.toFixed(1) + '%"></span>' +
          '<span class="bar__seg bar__seg--interest" style="width: ' + retPct.toFixed(1) + '%"></span>' +
        "</div>" +
        '<div class="legend">' +
          '<span class="legend__item"><span class="legend__dot legend__dot--principal"></span>Invested ' + inPct.toFixed(0) + "%</span>" +
          '<span class="legend__item"><span class="legend__dot legend__dot--interest"></span>Returns ' + retPct.toFixed(0) + "%</span>" +
        "</div>" +
        '<div class="result__rows">';

      var copyLines = ["Projected value: " + money(future)];
      for (var r = 0; r < rows.length; r++) {
        html +=
          '<div class="result-row"><span class="result-row__k">' + esc(rows[r][0]) +
          '</span><span class="result-row__v">' + esc(rows[r][1]) + "</span></div>";
        copyLines.push(rows[r][0] + ": " + rows[r][1]);
      }

      html += "</div>";
      resultEl.innerHTML = html;
      lastCopy = copyLines.join("\n");
      window.JivoraUI.track("tool_action", { tool: "sip-calculator", action: "calculate" });
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
      for (var key in groups) {
        if (groups.hasOwnProperty(key)) groups[key].hidden = key !== mode;
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
      resultEl.innerHTML = EMPTY_HTML;
      lastCopy = "";
    }, 0);
  });

  copyBtn.addEventListener("click", function () {
    if (!lastCopy) {
      showError("Calculate a projection first, then copy it.");
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastCopy, "tool_copy");
  });
})();
