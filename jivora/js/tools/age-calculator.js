/*
 * Age Calculator — Jivora
 * Exact years/months/days between two dates, defaulting to today.
 */
(function () {
  "use strict";

  var form = document.getElementById("age-form");
  if (!form) return;

  var dobInput = document.getElementById("age-dob");
  var asOfInput = document.getElementById("age-asof");
  var errorEl = document.getElementById("age-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("age-result");
  var copyBtn = document.getElementById("age-copy");
  var lastCopy = "";

  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function toISO(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function parseISO(value) {
    if (!value) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return null;
    var y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
    var date = new Date(y, mo, d);
    if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
    return date;
  }

  function daysInMonth(year, month0) {
    return new Date(year, month0 + 1, 0).getDate();
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
  }

  function hideError() {
    errorEl.classList.remove("is-shown");
    dobInput.removeAttribute("aria-invalid");
    asOfInput.removeAttribute("aria-invalid");
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  /* ---------- default & limits ---------- */

  var today = new Date();
  asOfInput.value = toISO(today);
  asOfInput.max = toISO(today);
  dobInput.max = toISO(today);

  /* ---------- calculation ---------- */

  function calculate() {
    hideError();

    var dob = parseISO(dobInput.value);
    if (!dobInput.value) {
      dobInput.setAttribute("aria-invalid", "true");
      showError("Please enter a date of birth.");
      return;
    }
    if (!dob) {
      dobInput.setAttribute("aria-invalid", "true");
      showError("Please enter a valid date of birth.");
      return;
    }

    var asOf = asOfInput.value ? parseISO(asOfInput.value) : today;
    if (!asOf) {
      asOfInput.setAttribute("aria-invalid", "true");
      showError("Please enter a valid date.");
      return;
    }

    if (dob > asOf) {
      dobInput.setAttribute("aria-invalid", "true");
      showError("The date of birth can't be after the age-as-of date.");
      return;
    }

    /* year / month / day difference with borrowing */
    var years = asOf.getFullYear() - dob.getFullYear();
    var months = asOf.getMonth() - dob.getMonth();
    var days = asOf.getDate() - dob.getDate();

    if (days < 0) {
      months -= 1;
      var borrowYear = asOf.getMonth() === 0 ? asOf.getFullYear() - 1 : asOf.getFullYear();
      var borrowMonth = asOf.getMonth() === 0 ? 11 : asOf.getMonth() - 1;
      days += daysInMonth(borrowYear, borrowMonth);
    }
    if (months < 0) {
      months += 12;
      years -= 1;
    }

    var totalDays = Math.round((asOf - dob) / 86400000);
    var totalMonths = years * 12 + months;
    var totalWeeks = Math.floor(totalDays / 7);

    /* next birthday */
    var isBirthdayToday = asOf.getMonth() === dob.getMonth() && asOf.getDate() === dob.getDate();
    var nextBirthdayText;
    if (isBirthdayToday) {
      nextBirthdayText = "Today — happy birthday! 🎉";
    } else {
      var alreadyPassed =
        asOf.getMonth() > dob.getMonth() ||
        (asOf.getMonth() === dob.getMonth() && asOf.getDate() > dob.getDate());
      var nbYear = alreadyPassed ? asOf.getFullYear() + 1 : asOf.getFullYear();
      var nbMonth = dob.getMonth();
      var nbDay = dob.getDate();
      if (nbMonth === 1 && nbDay === 29 && daysInMonth(nbYear, 1) < 29) nbDay = 28;
      var nextDate = new Date(nbYear, nbMonth, nbDay);
      var daysTo = Math.round((nextDate - asOf) / 86400000);
      nextBirthdayText =
        nbDay + " " + MONTHS[nbMonth] + " " + nbYear +
        " (" + (daysTo === 1 ? "tomorrow" : "in " + daysTo + " days") + ")";
    }

    var asOfLabel = WEEKDAYS[asOf.getDay()] + ", " + asOf.getDate() + " " +
      MONTHS[asOf.getMonth()] + " " + asOf.getFullYear();

    var rows = [
      ["Total months", totalMonths.toLocaleString()],
      ["Total weeks", totalWeeks.toLocaleString()],
      ["Total days", totalDays.toLocaleString()],
      ["Next birthday", nextBirthdayText]
    ];

    var html =
      '<p class="result__label">Exact age</p>' +
      '<p class="result__primary grad-text">' +
      esc(plural(years, "year") + ", " + plural(months, "month") + ", " + plural(days, "day")) +
      "</p>" +
      '<p class="result__caption">Measured up to ' + esc(asOfLabel) + "</p>" +
      '<div class="result__rows">';

    var copyLines = [plural(years, "year") + ", " + plural(months, "month") + ", " + plural(days, "day")];
    copyLines.push("As of: " + asOfLabel);

    for (var i = 0; i < rows.length; i++) {
      html +=
        '<div class="result-row"><span class="result-row__k">' + esc(rows[i][0]) +
        '</span><span class="result-row__v">' + esc(rows[i][1]) + "</span></div>";
      copyLines.push(rows[i][0] + ": " + rows[i][1]);
    }

    html += "</div>";
    resultEl.innerHTML = html;
    lastCopy = copyLines.join("\n");
  }

  /* ---------- events ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    calculate();
  });

  form.addEventListener("input", hideError);

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      hideError();
      asOfInput.value = toISO(today);
      resultEl.innerHTML =
        '<p class="result__empty">Enter a date of birth and press Calculate — the exact age appears here.</p>';
      lastCopy = "";
    }, 0);
  });

  copyBtn.addEventListener("click", function () {
    if (!lastCopy) {
      showError("Calculate an age first, then copy it.");
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastCopy, "tool_copy");
  });
})();
