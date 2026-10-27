/*
 * Text Reverser — Jivora
 * Four modes: whole text, word order, letters-per-word, line order.
 * Unicode-aware (code-point based) so emoji and accents survive.
 */
(function () {
  "use strict";

  var form = document.getElementById("tr-form");
  if (!form) return;

  var input = document.getElementById("tr-text");
  var outEl = document.getElementById("tr-out");
  var statusEl = document.getElementById("tr-status");
  var copyBtn = document.getElementById("tr-copy");
  var mode = "text";
  var lastOutput = "";

  var MODE_LABEL = {
    text: "Reverse text",
    words: "Reverse words",
    letters: "Reverse each word",
    lines: "Reverse lines"
  };

  function charsOf(str) {
    /* full code points so emoji and astral chars survive */
    return Array.from(str);
  }

  function reverseChars(str) {
    return charsOf(str).reverse().join("");
  }

  function reverse(text) {
    switch (mode) {
      case "text":
        return reverseChars(text);

      case "words":
        /* words stay intact; only their order flips. Splitting with a
         * captured whitespace group keeps separators exactly as they were */
        return text.split(/(\s+)/).reverse().join("");

      case "letters":
        return text.split(/(\s+)/).map(function (part) {
          return /^\s+$/.test(part) ? part : reverseChars(part);
        }).join("");

      case "lines":
        return text.split("\n").reverse().join("\n");

      default:
        return text;
    }
  }

  function render() {
    var text = input.value;
    if (!text) {
      outEl.textContent = "Your reversed text appears here.";
      statusEl.textContent = "Pick a mode and start typing.";
      lastOutput = "";
      return;
    }

    var result = reverse(text);
    lastOutput = result;
    outEl.textContent = result;
    statusEl.innerHTML =
      '<span class="is-ok">' + MODE_LABEL[mode] + "</span>" +
      "<span>" + text.length + " characters in, " + result.length + " out</span>";
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
      window.JivoraUI.track("tool_action", { tool: "text-reverser", action: mode });
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
