/*
 * GPA Calculator — Jivora
 * Credit-weighted or simple-average GPA with a 4.0 / 10.0 scale selector.
 */
(function () {
  "use strict";

  var form = document.getElementById("gpa-form");
  if (!form) return;

  var rowsEl = document.getElementById("gpa-rows");
  var addBtn = document.getElementById("gpa-add");
  var scaleSel = document.getElementById("gpa-scale");
  var errorEl = document.getElementById("gpa-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("gpa-result");
  var copyBtn = document.getElementById("gpa-copy");
  var lastCopy = "";

  var EMPTY_HTML =
    '<p class="result__empty">Enter your courses and grade points, then press Calculate — your GPA appears here.</p>';

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

  function scaleMax() {
    return scaleSel.value === "4" ? 4 : 10;
  }

  function bandFor(gpa, scale) {
    if (scale === 4) {
      if (gpa >= 3.7) return "Excellent";
      if (gpa >= 3.0) return "Good";
      if (gpa >= 2.0) return "Satisfactory";
      if (gpa >= 1.0) return "Below average";
      return "Failing range";
    }
    if (gpa >= 8.5) return "Outstanding";
    if (gpa >= 7.5) return "First class";
    if (gpa >= 6.0) return "Second class";
    if (gpa >= 5.0) return "Pass";
    return "Below passing";
  }

  function rowMarkup() {
    return (
      '<input class="crow__name" type="text" placeholder="Course name (optional)" aria-label="Course name" autocomplete="off">' +
      '<input type="number" step="0.01" min="0" placeholder="Grade point" aria-label="Grade point" data-gp inputmode="decimal">' +
      '<input type="number" step="0.5" min="0" placeholder="Credits" aria-label="Credits (optional)" data-credits inputmode="decimal">' +
      '<button type="button" class="crow__remove" aria-label="Remove course">' +
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
      var max = scaleMax();
      var rows = rowsEl.querySelectorAll(".crow");
      var entries = [];
      var anyCredits = false;
      var allCredits = true;

      for (var i = 0; i < rows.length; i++) {
        var nameEl = rows[i].querySelector(".crow__name");
        var gpEl = rows[i].querySelector("[data-gp]");
        var crEl = rows[i].querySelector("[data-credits]");

        var gpRaw = (gpEl.value || "").trim();
        var crRaw = (crEl.value || "").trim();
        var nameRaw = (nameEl.value || "").trim();

        if (gpRaw === "" && crRaw === "" && nameRaw === "") continue;

        if (gpRaw === "") {
          fail(gpEl, "Every course needs a grade point between 0 and " + max + ".");
        }
        var gp = Number(gpRaw);
        if (!isFinite(gp) || gp < 0 || gp > max) {
          fail(gpEl, "Grade point must be a number between 0 and " + max + " on this scale.");
        }

        var credits = 1;
        if (crRaw === "") {
          allCredits = false;
        } else {
          var cr = Number(crRaw);
          if (!isFinite(cr) || cr <= 0) {
            fail(crEl, "Credits must be greater than 0.");
          }
          credits = cr;
          anyCredits = true;
        }

        entries.push({ gp: gp, cr: credits });
      }

      if (!entries.length) {
        throw new Error("Add at least one course with a grade point.");
      }
      if (anyCredits && !allCredits) {
        throw new Error("Either add credits to every course, or leave them all blank.");
      }

      var gpa;
      var method;
      var totalCredits = 0;

      if (anyCredits && allCredits) {
        var sumW = 0;
        var sumC = 0;
        for (var w = 0; w < entries.length; w++) {
          sumW += entries[w].gp * entries[w].cr;
          sumC += entries[w].cr;
        }
        gpa = sumW / sumC;
        totalCredits = sumC;
        method = "Weighted by credits";
      } else {
        var sum = 0;
        for (var s = 0; s < entries.length; s++) sum += entries[s].gp;
        gpa = sum / entries.length;
        method = "Simple average";
      }

      var gpaText = gpa.toFixed(2);
      var band = bandFor(gpa, max);

      var rowsOut = [
        ["Grading scale", max === 4 ? "4.0 scale" : "10.0 scale"],
        ["Courses counted", String(entries.length)],
        ["Method", method]
      ];
      if (method === "Weighted by credits") {
        rowsOut.push(["Total credits", String(totalCredits)]);
      }
      rowsOut.push(["Rough band", band]);

      var html =
        '<p class="result__label">Your GPA</p>' +
        '<p class="result__primary grad-text">' + esc(gpaText) + " / " + max + ".0</p>" +
        '<p class="result__caption">' + esc(band) + " · " + esc(method.toLowerCase()) + "</p>" +
        '<div class="result__rows">';

      var copyLines = ["GPA: " + gpaText + " / " + max];
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

  scaleSel.addEventListener("change", hideError);

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
      resultEl.innerHTML = EMPTY_HTML;
      lastCopy = "";
    }, 0);
  });

  copyBtn.addEventListener("click", function () {
    if (!lastCopy) {
      showError("Calculate your GPA first, then copy it.");
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastCopy, "tool_copy");
  });
})();
