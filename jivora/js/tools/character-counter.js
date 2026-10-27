/*
 * Character Counter — Jivora
 * Live character/word/line stats plus a character-limit helper.
 */
(function () {
  "use strict";

  var form = document.getElementById("cc-form");
  if (!form) return;

  var input = document.getElementById("cc-text");
  var limitInput = document.getElementById("cc-limit");
  var limitStatus = document.getElementById("cc-limit-status");
  var errorEl = document.getElementById("cc-error");
  var errorText = errorEl.querySelector("span");
  var copyBtn = document.getElementById("cc-copy");

  var out = {
    chars: document.getElementById("cc-chars"),
    nospace: document.getElementById("cc-nospace"),
    words: document.getElementById("cc-words"),
    lines: document.getElementById("cc-lines"),
    letters: document.getElementById("cc-letters"),
    digits: document.getElementById("cc-digits")
  };

  var lastStats = null;

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
    window.clearTimeout(errorEl._timer);
    errorEl._timer = window.setTimeout(function () {
      errorEl.classList.remove("is-shown");
    }, 3200);
  }

  function analyse(text) {
    var chars = text.length;
    var noSpaces = text.replace(/\s/g, "").length;
    var trimmed = text.trim();
    var words = trimmed ? trimmed.split(/\s+/).length : 0;
    var lines = text === "" ? 1 : text.split("\n").length;
    var letters = (text.match(/[a-zA-Z\u00C0-\u024F\u0900-\u097F]/g) || []).length;
    var digits = (text.match(/[0-9]/g) || []).length;
    return { chars: chars, noSpaces: noSpaces, words: words, lines: lines, letters: letters, digits: digits };
  }

  function renderLimit(chars) {
    var raw = (limitInput.value || "").trim();
    if (raw === "") {
      limitStatus.textContent = "No limit set";
      limitStatus.className = "result-row__v";
      return;
    }
    var limit = parseInt(raw, 10);
    if (!isFinite(limit) || limit < 1) {
      limitStatus.textContent = "Enter a limit of 1 or more";
      limitStatus.className = "result-row__v";
      return;
    }
    var left = limit - chars;
    if (left >= 0) {
      limitStatus.textContent = left + " of " + limit + " left";
      limitStatus.className = "result-row__v is-good";
    } else {
      limitStatus.textContent = Math.abs(left) + " over the " + limit + "-character limit";
      limitStatus.className = "result-row__v is-bad";
    }
  }

  function render() {
    var s = analyse(input.value);
    lastStats = s;

    out.chars.textContent = s.chars;
    out.nospace.textContent = s.noSpaces;
    out.words.textContent = s.words;
    out.lines.textContent = s.lines;
    out.letters.textContent = s.letters;
    out.digits.textContent = s.digits;

    renderLimit(s.chars);
  }

  function statsText() {
    if (!lastStats) return "";
    var lines = [
      "Characters: " + lastStats.chars,
      "Characters (no spaces): " + lastStats.noSpaces,
      "Words: " + lastStats.words,
      "Lines: " + lastStats.lines,
      "Letters: " + lastStats.letters,
      "Digits: " + lastStats.digits
    ];
    var raw = (limitInput.value || "").trim();
    if (raw !== "") {
      var limit = parseInt(raw, 10);
      if (isFinite(limit) && limit > 0) {
        lines.push("Limit: " + limit + " (" + (limit - lastStats.chars >= 0 ? (limit - lastStats.chars) + " left" : Math.abs(limit - lastStats.chars) + " over") + ")");
      }
    }
    return lines.join("\n");
  }

  /* ---------- events ---------- */

  input.addEventListener("input", render);
  limitInput.addEventListener("input", render);

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      errorEl.classList.remove("is-shown");
      render();
      input.focus();
    }, 0);
  });

  copyBtn.addEventListener("click", function () {
    if (!input.value.trim()) {
      showError("Type or paste some text first — then copy the counts.");
      input.focus();
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, statsText(), "tool_copy");
  });

  render();
})();
