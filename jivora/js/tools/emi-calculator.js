/*
 * EMI Calculator — Jivora
 * P × r × (1+r)^n / ((1+r)^n − 1), with a proper 0% branch.
 */
(function () {
  "use strict";

  var form = document.getElementById("emi-form");
  if (!form) return;

  var errorEl = document.getElementById("emi-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("emi-result");
  var copyBtn = document.getElementById("emi-copy");
  var unitSelect = document.getElementById("emi-unit");
  var lastCopy = "";

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

  function parseField(id, label, check) {
    var el = document.getElementById(id);
    var raw = (el.value || "").trim().replace(/,/g, "");
    el.setAttribute("aria-invalid", "true");
    if (raw === "") throw new Error("Please enter " + label + ".");
    var v = Number(raw);
    if (!isFinite(v)) throw new Error("Please enter a valid number for " + label + ".");
    if (check) {
      var msg = check(v);
      if (msg) throw new Error(msg);
    }
    el.removeAttribute("aria-invalid");
    return v;
  }

  function calculate() {
    hideError();

    try {
      var amount = parseField("emi-amount", "the loan amount", function (v) {
        return v > 0 ? "" : "Loan amount must be greater than zero.";
      });

      var rate = parseField("emi-rate", "the interest rate", function (v) {
        if (v < 0) return "Interest rate can't be negative.";
        if (v > 100) return "Please enter an interest rate between 0 and 100.";
        return "";
      });

      var tenure = parseField("emi-tenure", "the loan duration", function (v) {
        return v > 0 ? "" : "Loan duration must be greater than zero.";
      });

      var unit = unitSelect.value;
      var n = unit === "years" ? Math.round(tenure * 12) : Math.round(tenure);

      if (unit === "years" && tenure > 50) {
        document.getElementById("emi-tenure").setAttribute("aria-invalid", "true");
        throw new Error("That duration looks too long — enter up to 50 years.");
      }
      if (n < 1) {
        document.getElementById("emi-tenure").setAttribute("aria-invalid", "true");
        throw new Error("Loan duration must be at least one month.");
      }
      if (n > 600) {
        document.getElementById("emi-tenure").setAttribute("aria-invalid", "true");
        throw new Error("That duration looks too long — enter up to 600 months (50 years).");
      }

      var r = rate / 12 / 100;
      var emi;
      if (r === 0) {
        emi = amount / n;
      } else {
        var factor = Math.pow(1 + r, n);
        emi = (amount * r * factor) / (factor - 1);
      }

      var total = emi * n;
      var interest = total - amount;
      if (!isFinite(emi) || emi <= 0) {
        throw new Error("That combination of numbers is too large to calculate. Please try smaller values.");
      }

      var money = window.JivoraUI.money;
      var principalPct = total > 0 ? (amount / total) * 100 : 100;
      var pWidth = Math.max(0, Math.min(100, Math.round(principalPct)));
      var iWidth = 100 - pWidth;

      var tenureText = n + " months at " + rate + "% per year";

      var html =
        '<p class="result__label">Monthly EMI</p>' +
        '<p class="result__primary grad-text">' + esc(money(emi)) + "</p>" +
        '<p class="result__caption">Over ' + esc(tenureText) + "</p>" +
        '<div class="result__rows">' +
          '<div class="result-row"><span class="result-row__k">Loan amount (principal)</span><span class="result-row__v">' + esc(money(amount)) + "</span></div>" +
          '<div class="result-row"><span class="result-row__k">Total interest</span><span class="result-row__v">' + esc(money(interest)) + "</span></div>" +
          '<div class="result-row"><span class="result-row__k">Total payment</span><span class="result-row__v">' + esc(money(total)) + "</span></div>" +
          '<div class="result-row"><span class="result-row__k">Number of payments</span><span class="result-row__v">' + n + " monthly</span></div>" +
        "</div>" +
        '<div class="bar" aria-hidden="true">' +
          '<div class="bar__seg bar__seg--principal" style="width:' + pWidth + '%"></div>' +
          '<div class="bar__seg bar__seg--interest" style="width:' + iWidth + '%"></div>' +
        "</div>" +
        '<div class="legend">' +
          '<span class="legend__item"><span class="legend__dot legend__dot--principal"></span>Principal — ' + esc(money(amount)) + " (" + pWidth + "%)</span>" +
          '<span class="legend__item"><span class="legend__dot legend__dot--interest"></span>Interest — ' + esc(money(interest)) + " (" + iWidth + "%)</span>" +
        "</div>";

      resultEl.innerHTML = html;

      lastCopy = [
        "Monthly EMI: " + money(emi),
        "Loan amount: " + money(amount),
        "Total interest: " + money(interest),
        "Total payment: " + money(total),
        "Tenure: " + tenureText
      ].join("\n");
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
  unitSelect.addEventListener("change", hideError);

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      hideError();
      unitSelect.value = "years";
      resultEl.innerHTML =
        '<p class="result__empty">Enter the loan amount, rate and duration, then press Calculate — your EMI appears here.</p>';
      lastCopy = "";
    }, 0);
  });

  copyBtn.addEventListener("click", function () {
    if (!lastCopy) {
      showError("Calculate your EMI first, then copy it.");
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastCopy, "tool_copy");
  });
})();
