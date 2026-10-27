/*
 * Discount Calculator — Jivora
 * Single or successive discounts, per-item and basket totals.
 */
(function () {
  "use strict";

  var form = document.getElementById("dc-form");
  if (!form) return;

  var errorEl = document.getElementById("dc-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("dc-result");
  var copyBtn = document.getElementById("dc-copy");
  var lastCopy = "";

  var EMPTY_HTML =
    '<p class="result__empty">Enter the price and discount, then press Calculate — the final price and savings appear here.</p>';

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
    if (opts.max != null && v > opts.max) {
      throw new Error(label.charAt(0).toUpperCase() + label.slice(1) + " can't be more than " + opts.max + ".");
    }
    el.removeAttribute("aria-invalid");
    return v;
  }

  function calculate() {
    hideError();

    try {
      var price = parseField("dc-price", "the original price", { min: 0 });
      var off = parseField("dc-off", "the discount", { min: 0, max: 100 });
      var qtyRaw = (document.getElementById("dc-qty").value || "").trim();
      var qty = qtyRaw === "" ? 1 : Number(qtyRaw);
      if (!isFinite(qty) || qty < 1 || Math.floor(qty) !== qty) {
        var qtyEl = document.getElementById("dc-qty");
        qtyEl.setAttribute("aria-invalid", "true");
        throw new Error("Quantity must be a whole number of 1 or more.");
      }

      var off2Raw = (document.getElementById("dc-off2").value || "").trim();
      var off2 = 0;
      if (off2Raw !== "") {
        off2 = Number(off2Raw);
        if (!isFinite(off2) || off2 < 0 || off2 > 100) {
          var off2El = document.getElementById("dc-off2");
          off2El.setAttribute("aria-invalid", "true");
          throw new Error("The second discount must be between 0 and 100%.");
        }
      }

      var afterFirst = price * (100 - off) / 100;
      var finalUnit = off2 > 0 ? afterFirst * (100 - off2) / 100 : afterFirst;

      var originalTotal = price * qty;
      var finalTotal = finalUnit * qty;
      var saved = originalTotal - finalTotal;
      var savedPct = originalTotal > 0 ? (saved / originalTotal) * 100 : 0;

      var rows = [
        ["Price per item", money(finalUnit)],
        ["Original total", money(originalTotal)],
        ["Total payable", money(finalTotal)],
        ["You save", money(saved) + " (" + savedPct.toFixed(1) + "%)"],
        ["First discount", off + "% off"]
      ];
      if (off2 > 0) {
        rows.push(["Second discount", off2 + "% on the reduced price"]);
        rows.push(["Equivalent single discount", (off + off2 - (off * off2) / 100).toFixed(1) + "%"]);
      }
      rows.push(["Quantity", String(qty)]);

      var html =
        '<p class="result__label">Final price</p>' +
        '<p class="result__primary grad-text">' + esc(money(finalUnit)) + '<span style="font-size:0.45em; font-weight:600;"> each</span></p>' +
        '<p class="result__caption">You pay ' + esc(money(finalTotal)) + " for " + qty + (qty === 1 ? " item" : " items") + " · save " + esc(money(saved)) + "</p>" +
        '<div class="result__rows">';

      var copyLines = ["Final price per item: " + money(finalUnit)];
      for (var r = 0; r < rows.length; r++) {
        html +=
          '<div class="result-row"><span class="result-row__k">' + esc(rows[r][0]) +
          '</span><span class="result-row__v">' + esc(rows[r][1]) + "</span></div>";
        copyLines.push(rows[r][0] + ": " + rows[r][1]);
      }

      html += "</div>";
      resultEl.innerHTML = html;
      lastCopy = copyLines.join("\n");
      window.JivoraUI.track("tool_action", { tool: "discount-calculator", action: "calculate" });
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
      document.getElementById("dc-qty").value = "1";
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
