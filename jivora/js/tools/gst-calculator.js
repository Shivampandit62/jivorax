/*
 * GST Calculator — Jivora
 * Add GST to a base price or remove GST from an inclusive total.
 */
(function () {
  "use strict";

  var form = document.getElementById("gst-form");
  if (!form) return;

  var errorEl = document.getElementById("gst-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("gst-result");
  var copyBtn = document.getElementById("gst-copy");
  var rateSelect = document.getElementById("gst-rate");
  var customWrap = document.getElementById("gst-custom-wrap");
  var customInput = document.getElementById("gst-custom");
  var amountInput = document.getElementById("gst-amount");
  var amountUnit = document.getElementById("gst-amount-unit");
  var amountNote = document.getElementById("gst-amount-note");
  var mode = "add";
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

  function applyMode() {
    if (mode === "add") {
      amountUnit.textContent = "before GST";
      amountNote.textContent = "The base price before tax is added.";
    } else {
      amountUnit.textContent = "including GST";
      amountNote.textContent = "The total you paid, with tax already included.";
    }
  }

  function getAmount() {
    var raw = (amountInput.value || "").trim().replace(/,/g, "");
    amountInput.setAttribute("aria-invalid", "true");
    if (raw === "") throw new Error("Please enter an amount.");
    var v = Number(raw);
    if (!isFinite(v)) throw new Error("Please enter a valid number for the amount.");
    if (v < 0) throw new Error("The amount can't be negative.");
    amountInput.removeAttribute("aria-invalid");
    return v;
  }

  function getRate() {
    if (rateSelect.value === "custom") {
      var raw = (customInput.value || "").trim();
      customInput.setAttribute("aria-invalid", "true");
      if (raw === "") throw new Error("Please enter a custom GST rate.");
      var v = Number(raw);
      if (!isFinite(v) || v < 0 || v > 100) {
        throw new Error("Please enter a GST rate between 0 and 100.");
      }
      customInput.removeAttribute("aria-invalid");
      return v;
    }
    return Number(rateSelect.value);
  }

  function calculate() {
    hideError();

    try {
      var amount = getAmount();
      var rate = getRate();
      var f = rate / 100;
      var money = window.JivoraUI.money;

      var net, gross, gst, primary, caption, firstLabel, lastLabel;

      if (mode === "add") {
        net = amount;
        gst = net * f;
        gross = net + gst;
        primary = money(gross);
        caption = money(net) + " + " + rate + "% GST";
        firstLabel = "Original amount (without GST)";
        lastLabel = "Final amount (with GST)";
      } else {
        gross = amount;
        net = gross / (1 + f);
        gst = gross - net;
        primary = money(net);
        caption = money(gross) + " includes " + rate + "% GST";
        firstLabel = "Original amount (with GST)";
        lastLabel = "Final amount (without GST)";
      }

      var rows = [
        [firstLabel, money(mode === "add" ? net : gross)],
        ["GST amount (" + rate + "%)", money(gst)],
        [lastLabel, money(mode === "add" ? gross : net)]
      ];

      var html =
        '<p class="result__label">Result</p>' +
        '<p class="result__primary grad-text">' + esc(primary) + "</p>" +
        '<p class="result__caption">' + esc(caption) + "</p>" +
        '<div class="result__rows">';

      var copyLines = [primary, caption];

      for (var i = 0; i < rows.length; i++) {
        html +=
          '<div class="result-row"><span class="result-row__k">' + esc(rows[i][0]) +
          '</span><span class="result-row__v">' + esc(rows[i][1]) + "</span></div>";
        copyLines.push(rows[i][0] + ": " + rows[i][1]);
      }

      html += "</div>";
      resultEl.innerHTML = html;
      lastCopy = copyLines.join("\n");
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
      applyMode();
      hideError();
    });
  }

  rateSelect.addEventListener("change", function () {
    var isCustom = rateSelect.value === "custom";
    customWrap.hidden = !isCustom;
    if (isCustom) customInput.focus();
    hideError();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    calculate();
  });

  form.addEventListener("input", hideError);

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      hideError();
      mode = "add";
      var buttons = form.querySelectorAll(".seg__btn");
      for (var i = 0; i < buttons.length; i++) {
        var on = buttons[i].getAttribute("data-mode") === "add";
        buttons[i].classList.toggle("is-on", on);
        buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
      }
      rateSelect.value = "18";
      customWrap.hidden = true;
      customInput.value = "";
      applyMode();
      resultEl.innerHTML =
        '<p class="result__empty">Enter an amount, pick a rate and press Calculate — the breakdown appears here.</p>';
      lastCopy = "";
    }, 0);
  });

  copyBtn.addEventListener("click", function () {
    if (!lastCopy) {
      showError("Calculate the GST first, then copy it.");
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastCopy, "tool_copy");
  });
})();
