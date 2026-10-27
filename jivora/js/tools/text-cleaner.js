/*
 * Text Cleaner — Jivora
 * Collapses extra whitespace, trims lines, removes blank-line runs
 * and straightens smart punctuation. Live, entirely client-side.
 */
(function () {
  "use strict";

  var form = document.getElementById("tc-form");
  if (!form) return;

  var input = document.getElementById("tc-text");
  var outEl = document.getElementById("tc-out");
  var statusEl = document.getElementById("tc-status");
  var copyBtn = document.getElementById("tc-copy");
  var optSpaces = document.getElementById("tc-spaces");
  var optTrim = document.getElementById("tc-trim");
  var optBlanks = document.getElementById("tc-blanks");
  var optQuotes = document.getElementById("tc-quotes");
  var lastOutput = "";

  function clean(text) {
    var out = text;

    if (optQuotes.checked) {
      out = out
        .replace(/[\u201C\u201D]/g, "\"")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\u2026/g, "...")
        .replace(/\u00A0/g, " ");
    }

    if (optSpaces.checked) {
      out = out.replace(/[ \t\u00A0]{2,}/g, " ");
    }

    if (optTrim.checked) {
      out = out.split("\n").map(function (line) {
        return line.replace(/^[ \t]+|[ \t]+$/g, "");
      }).join("\n");
    }

    if (optBlanks.checked) {
      out = out.replace(/\n[ \t]*(?:\n[ \t]*){2,}/g, "\n\n");
    }

    return out;
  }

  function render() {
    var text = input.value;
    if (!text) {
      outEl.textContent = "Your cleaned text appears here.";
      statusEl.textContent = "Paste some text to get started.";
      lastOutput = "";
      return;
    }

    var result = clean(text);
    lastOutput = result;

    outEl.textContent = result;

    if (result === text) {
      statusEl.innerHTML = '<span class="is-ok">Already clean</span><span>nothing to fix</span>';
      return;
    }

    var saved = text.length - result.length;
    statusEl.innerHTML =
      '<span class="is-ok">Cleaned</span>' +
      "<span>" + text.length + " \u2192 " + result.length +
      " characters (\u2212" + saved + ")</span>";
  }

  /* ---------- events ---------- */

  input.addEventListener("input", render);

  var toggles = [optSpaces, optTrim, optBlanks, optQuotes];
  for (var i = 0; i < toggles.length; i++) {
    toggles[i].addEventListener("change", render);
  }

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      render();
      input.focus();
    }, 0);
  });

  copyBtn.addEventListener("click", function () {
    if (!lastOutput) {
      window.JivoraUI.flashButton(copyBtn, "Nothing to copy yet");
      input.focus();
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastOutput, "tool_copy");
  });

  render();
})();
