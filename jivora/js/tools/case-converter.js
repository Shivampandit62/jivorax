/*
 * Case Converter — Jivora
 * upper / lower / title / sentence / camel / snake, live conversion.
 */
(function () {
  "use strict";

  var form = document.getElementById("cv-form");
  if (!form) return;

  var input = document.getElementById("cv-text");
  var outEl = document.getElementById("cv-out");
  var statusEl = document.getElementById("cv-status");
  var copyBtn = document.getElementById("cv-copy");
  var mode = "upper";
  var lastOutput = "";

  var MODE_LABEL = {
    upper: "UPPERCASE",
    lower: "lowercase",
    title: "Title Case",
    sentence: "Sentence case",
    camel: "camelCase",
    snake: "snake_case"
  };

  function wordsOf(text) {
    return text.split(/[^\p{L}\p{N}]+/u).filter(function (w) { return w !== ""; });
  }

  function convert(text) {
    switch (mode) {
      case "upper":
        return text.toUpperCase();

      case "lower":
        return text.toLowerCase();

      case "title":
        return text.replace(/\p{L}[\p{L}\p{N}'\u2019]*/gu, function (w) {
          return w.charAt(0).toLocaleUpperCase() + w.slice(1).toLocaleLowerCase();
        });

      case "sentence": {
        var lower = text.toLocaleLowerCase();
        return lower.replace(/(^|[.!?…]\s+|\n+)(\p{L})/gu, function (_, pre, ch) {
          return pre + ch.toLocaleUpperCase();
        });
      }

      case "camel": {
        var ws = wordsOf(text);
        if (!ws.length) return "";
        var camel = ws[0].toLocaleLowerCase();
        for (var i = 1; i < ws.length; i++) {
          camel += ws[i].charAt(0).toLocaleUpperCase() + ws[i].slice(1).toLocaleLowerCase();
        }
        return camel;
      }

      case "snake":
        return wordsOf(text)
          .map(function (w) { return w.toLocaleLowerCase(); })
          .join("_");

      default:
        return text;
    }
  }

  function render() {
    var text = input.value;
    if (!text) {
      outEl.textContent = "Your converted text appears here.";
      statusEl.textContent = "Pick a case and start typing.";
      lastOutput = "";
      return;
    }
    var result = convert(text);
    lastOutput = result;
    outEl.textContent = result;
    statusEl.innerHTML =
      '<span class="is-ok">' + MODE_LABEL[mode] + "</span>" +
      "<span>" + text.length + " \u2192 " + result.length + " characters</span>";
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
      render();
      window.JivoraUI.track("tool_action", { tool: "case-converter", action: mode });
    });
  }

  input.addEventListener("input", render);

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      render();
      input.focus();
    }, 0);
  });

  copyBtn.addEventListener("click", function () {
    if (!lastOutput) {
      window.JivoraUI.flashButton(copyBtn, "Type something first");
      input.focus();
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastOutput, "tool_copy");
  });

  render();
})();
