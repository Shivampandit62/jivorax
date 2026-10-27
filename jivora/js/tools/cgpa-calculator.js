/*
 * CGPA Calculator — Jivora
 * Dynamic subject rows, credit-weighted or simple average, approx percentage.
 */
(function () {
  "use strict";

  var form = document.getElementById("cgpa-form");
  if (!form) return;

  var rowsEl = document.getElementById("cgpa-rows");
  var addBtn = document.getElementById("cgpa-add");
  var errorEl = document.getElementById("cgpa-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("cgpa-result");
  var copyBtn = document.getElementById("cgpa-copy");
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

  function rowMarkup() {
    return (
      '<input class="crow__name" type="text" placeholder="Subject name (optional)" aria-label="Subject name" autocomplete="off">' +
      '<input type="number" step="0.01" min="0" max="10" placeholder="0–10" aria-label="Grade point" data-gp inputmode="decimal">' +
      '<input type="number" step="0.5" min="0" placeholder="Credits" aria-label="Credits (optional)" data-credits inputmode="decimal">' +
      '<button type="button" class="crow__remove" aria-label="Remove subject">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
      "</button>"
    );
  }

  function fail(el, msg) {
    if (el) el.setAttribute("aria-invalid", "true");
    throw new Error(msg);
  }

  function calculate() {
    hideError();

    try {
      var rows = rowsEl.querySelectorAll(".crow");
      var gps = [];
      var crs = [];
      var anyCredits = false;
      var allCredits = true;
      var count = 0;

      for (var i = 0; i < rows.length; i++) {
        var nameEl = rows[i].querySelector(".crow__name");
        var gpEl = rows[i].querySelector("[data-gp]");
        var crEl = rows[i].querySelector("[data-credits]");

        var gpRaw = (gpEl.value || "").trim();
        var crRaw = (crEl.value || "").trim();
        var nameRaw = (nameEl.value || "").trim();

        var rowTouched = gpRaw !== "" || crRaw !== "" || nameRaw !== "";
        if (!rowTouched) continue; /* ignore completely empty rows */

        if (gpRaw === "") {
          fail(gpEl, "Every subject needs a grade point between 0 and 10.");
        }
        var gp = Number(gpRaw);
        if (!isFinite(gp) || gp < 0 || gp > 10) {
          fail(gpEl, "Grade point must be a number between 0 and 10.");
        }

        var creditValue = 1;
        if (crRaw === "") {
          allCredits = false;
        } else {
          var cr = Number(crRaw);
          if (!isFinite(cr) || cr <= 0) {
            fail(crEl, "Credits must be greater than 0.");
          }
          creditValue = cr;
          anyCredits = true;
          crs.push(cr);
        }

        gps.push({ gp: gp, cr: creditValue });
        count++;
      }

      if (count === 0) {
        throw new Error("Add at least one subject with a grade point.");
      }
      if (anyCredits && !allCredits) {
        throw new Error("Either add credits to every subject, or leave them all blank.");
      }

      var cgpa;
      var method;
      var totalCredits = 0;

      if (anyCredits && allCredits) {
        var sumW = 0;
        var sumC = 0;
        for (var w = 0; w < gps.length; w++) {
          sumW += gps[w].gp * gps[w].cr;
          sumC += gps[w].cr;
        }
        cgpa = sumW / sumC;
        totalCredits = sumC;
        method = "Weighted by credits";
      } else {
        var sum = 0;
        for (var s = 0; s < gps.length; s++) sum += gps[s].gp;
        cgpa = sum / count;
        method = "Simple average";
      }

      var cgpaText = cgpa.toFixed(2);
      var pctText = (cgpa * 9.5).toFixed(2);

      var rowsOut = [
        ["Approximate percentage", pctText + "%"],
        ["Subjects counted", String(count)]
      ];
      if (method === "Weighted by credits") {
        rowsOut.push(["Total credits", String(totalCredits)]);
      }
      rowsOut.push(["Method", method]);

      var html =
        '<p class="result__label">Your result</p>' +
        '<p class="result__primary grad-text">' + esc(cgpaText) + " CGPA</p>" +
        '<p class="result__caption">Approximately ' + esc(pctText) + "% (CGPA × 9.5)</p>" +
        '<div class="result__rows">';

      var copyLines = ["CGPA: " + cgpaText, "Approximate percentage: " + pctText + "% (CGPA × 9.5)"];

      for (var r = 0; r < rowsOut.length; r++) {
        html +=
          '<div class="result-row"><span class="result-row__k">' + esc(rowsOut[r][0]) +
          '</span><span class="result-row__v">' + esc(rowsOut[r][1]) + "</span></div>";
        copyLines.push(rowsOut[r][0] + ": " + rowsOut[r][1]);
      }

      html += "</div>";
      resultEl.innerHTML = html;
      lastCopy = copyLines.join("\n");
    } catch (err) {
      showError(err && err.message ? err.message : "Something went wrong. Please check your inputs.");
    }
  }

  /* ---------- events ---------- */

  addBtn.addEventListener("click", function () {
    var div = document.createElement("div");
    div.className = "crow";
    div.innerHTML = rowMarkup();
    rowsEl.appendChild(div);
    var nameInput = div.querySelector(".crow__name");
    if (nameInput) nameInput.focus();
  });

  rowsEl.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".crow__remove") : null;
    if (!btn) return;
    var row = btn.closest(".crow");
    if (!row) return;

    if (rowsEl.querySelectorAll(".crow").length <= 1) {
      var inputs = row.querySelectorAll("input");
      for (var i = 0; i < inputs.length; i++) inputs[i].value = "";
      hideError();
      return;
    }
    row.parentNode.removeChild(row);
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
      var rows = rowsEl.querySelectorAll(".crow");
      for (var i = rows.length - 1; i > 2; i--) {
        rows[i].parentNode.removeChild(rows[i]);
      }
      var remaining = rowsEl.querySelectorAll(".crow");
      for (var r = 0; r < remaining.length; r++) {
        var inputs = remaining[r].querySelectorAll("input");
        for (var k = 0; k < inputs.length; k++) inputs[k].value = "";
      }
      resultEl.innerHTML =
        '<p class="result__empty">Enter your subjects and grade points, then press Calculate — your CGPA appears here.</p>';
      lastCopy = "";
    }, 0);
  });

  copyBtn.addEventListener("click", function () {
    if (!lastCopy) {
      showError("Calculate your CGPA first, then copy it.");
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastCopy, "tool_copy");
  });
})();
