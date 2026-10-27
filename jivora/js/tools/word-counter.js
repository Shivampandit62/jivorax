/*
 * Word Counter — Jivora
 * Live words / characters / sentences / paragraphs + reading time.
 * Everything happens in the browser as the user types.
 */
(function () {
  "use strict";

  var input = document.getElementById("wc-text");
  if (!input) return;

  var form = document.getElementById("wc-form");
  var errorEl = document.getElementById("wc-error");
  var errorText = errorEl.querySelector("span");
  var copyBtn = document.getElementById("wc-copy");

  var out = {
    words: document.getElementById("wc-words"),
    chars: document.getElementById("wc-chars"),
    noSpaces: document.getElementById("wc-chars-ns"),
    sentences: document.getElementById("wc-sentences"),
    paragraphs: document.getElementById("wc-paragraphs"),
    reading: document.getElementById("wc-reading")
  };

  var lastStats = null;

  /* ---------- helpers ---------- */

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
    window.clearTimeout(errorEl._timer);
    errorEl._timer = window.setTimeout(function () {
      errorEl.classList.remove("is-shown");
    }, 3200);
  }

  function readingTime(words) {
    if (words === 0) return "0 min";
    var seconds = Math.round((words / 200) * 60);
    if (seconds < 60) return Math.max(1, seconds) + " sec";
    return Math.max(1, Math.round(seconds / 60)) + " min";
  }

  function analyze(text) {
    var trimmed = text.trim();
    var words = trimmed ? trimmed.split(/\s+/).length : 0;
    var chars = text.length;
    var noSpaces = text.replace(/\s/g, "").length;

    var sentences = 0;
    if (trimmed) {
      var parts = trimmed.split(/[.!?…]+/);
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].trim() !== "") sentences++;
      }
    }

    var paragraphs = 0;
    if (trimmed) {
      var blocks = trimmed.split(/\n\s*\n/);
      for (var b = 0; b < blocks.length; b++) {
        if (blocks[b].trim() !== "") paragraphs++;
      }
    }

    return {
      words: words,
      chars: chars,
      noSpaces: noSpaces,
      sentences: sentences,
      paragraphs: paragraphs,
      reading: readingTime(words)
    };
  }

  function render() {
    var stats = analyze(input.value);
    lastStats = stats;

    out.words.textContent = stats.words;
    out.chars.textContent = stats.chars;
    out.noSpaces.textContent = stats.noSpaces;
    out.sentences.textContent = stats.sentences;
    out.paragraphs.textContent = stats.paragraphs;
    out.reading.textContent = stats.reading;
  }

  function statsText() {
    if (!lastStats) return "";
    return [
      "Words: " + lastStats.words,
      "Characters: " + lastStats.chars,
      "Characters (no spaces): " + lastStats.noSpaces,
      "Sentences: " + lastStats.sentences,
      "Paragraphs: " + lastStats.paragraphs,
      "Reading time: " + lastStats.reading
    ].join("\n");
  }

  /* ---------- events ---------- */

  input.addEventListener("input", render);

  copyBtn.addEventListener("click", function () {
    if (!input.value.trim()) {
      showError("Type or paste some text first — then copy the counts.");
      input.focus();
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, statsText(), "tool_copy");
  });

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      errorEl.classList.remove("is-shown");
      render();
      input.focus();
    }, 0);
  });

  render();
})();
