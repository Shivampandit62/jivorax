/*
 * Regex Tester — Jivora
 * Live ECMAScript regex matching with capture groups, a 200-match cap
 * and a replace preview.
 */
(function () {
  "use strict";

  var form = document.getElementById("rx-form");
  if (!form) return;

  var patternEl = document.getElementById("rx-pattern");
  var flagsEl = document.getElementById("rx-flags");
  var textEl = document.getElementById("rx-text");
  var replaceEl = document.getElementById("rx-replace");
  var errorEl = document.getElementById("rx-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("rx-result");
  var copyBtn = document.getElementById("rx-copy");

  var MAX_MATCHES = 200;
  var MAX_SHOWN = 30;
  var lastCopy = "";
  var timer = null;

  var EMPTY_HTML =
    '<p class="result__empty">Enter a pattern and some test text — matches and capture groups appear here live.</p>';

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
    patternEl.setAttribute("aria-invalid", "true");
  }

  function hideError() {
    errorEl.classList.remove("is-shown");
    patternEl.removeAttribute("aria-invalid");
  }

  function sanitizeFlags(raw) {
    var flags = String(raw || "").replace(/[^gimsuy]/g, "");
    var seen = "";
    var out = "";
    for (var i = 0; i < flags.length; i++) {
      if (seen.indexOf(flags.charAt(i)) === -1) {
        seen += flags.charAt(i);
        out += flags.charAt(i);
      }
    }
    if (flags !== String(raw || "").trim()) flagsEl.value = out;
    return out;
  }

  function findMatches(re, text) {
    var list = [];
    var m;

    if (re.global) {
      while ((m = re.exec(text)) !== null) {
        list.push(m);
        if (m[0] === "") {
          re.lastIndex++; /* avoid infinite loops on empty matches */
          continue;
        }
        if (list.length >= MAX_MATCHES) break;
      }
    } else {
      m = re.exec(text);
      if (m) list.push(m);
    }
    return list;
  }

  function renderEmpty(msg) {
    resultEl.innerHTML = msg ? '<p class="result__empty">' + esc(msg) + "</p>" : EMPTY_HTML;
    lastCopy = "";
  }

  function run() {
    hideError();

    var pattern = patternEl.value;
    var text = textEl.value;

    if (!pattern) {
      renderEmpty();
      return;
    }
    if (!text) {
      renderEmpty("Add some test text to match against.");
      return;
    }

    var flags = sanitizeFlags(flagsEl.value);

    var re;
    try {
      re = new RegExp(pattern, flags);
    } catch (e) {
      showError("Invalid pattern: " + (e && e.message ? e.message : "check your syntax"));
      renderEmpty("Fix the pattern above — results will appear here.");
      return;
    }

    var matches;
    try {
      matches = findMatches(re, text);
    } catch (e) {
      showError("Matching failed: " + (e && e.message ? e.message : "unknown error"));
      return;
    }

    if (!matches.length) {
      resultEl.innerHTML =
        '<p class="result__label">Matches</p>' +
        '<p class="result__primary grad-text">0</p>' +
        '<p class="result__caption">No matches in ' + text.length + " characters of test text.</p>";
      lastCopy = "";
      return;
    }

    var truncated = matches.length >= MAX_MATCHES;
    var shown = matches.slice(0, MAX_SHOWN);

    var html =
      '<p class="result__label">Matches</p>' +
      '<p class="result__primary grad-text">' + matches.length + (truncated ? "+" : "") + "</p>" +
      '<p class="result__caption">' + (truncated ? "first " + MAX_SHOWN + " shown" : matches.length + (matches.length === 1 ? " match" : " matches")) +
      " · flags /" + esc(flags) + "/</p>" +
      '<div class="result__rows">';

    var lines = [];
    for (var i = 0; i < shown.length; i++) {
      var m = shown[i];
      var groupText = "";
      if (m.length > 1) {
        var parts = [];
        for (var g = 1; g < m.length; g++) {
          parts.push("$" + g + "=" + (m[g] === undefined ? "—" : m[g]));
        }
        if (m.groups) {
          for (var name in m.groups) {
            if (Object.prototype.hasOwnProperty.call(m.groups, name)) {
              parts.push(name + "=" + (m.groups[name] === undefined ? "—" : m.groups[name]));
            }
          }
        }
        groupText = parts.join("  ");
      }

      html +=
        '<div class="result-row"><span class="result-row__k">#' + (i + 1) +
        ' at ' + m.index + '</span><span class="result-row__v">' +
        (groupText ? esc(m[0]) + " <small style=\"opacity:.7\">(" + esc(groupText) + ")</small>" : esc(m[0])) +
        "</span></div>";

      lines.push("#" + (i + 1) + " @" + m.index + ": " + m[0] + (groupText ? "  (" + groupText + ")" : ""));
    }

    html += "</div>";

    /* replace preview */
    var replacement = replaceEl.value;
    if (replacement) {
      var preview;
      try {
        preview = text.replace(new RegExp(pattern, flags.indexOf("g") === -1 ? flags + "g" : flags), replacement);
      } catch (e) {
        preview = "";
      }
      var snippet = preview.length > 400 ? preview.slice(0, 400) + "…" : preview;
      html +=
        '<p class="result__label" style="margin-top:20px;">Replace preview</p>' +
        '<div class="result" style="margin-top:8px; min-height:0; padding:16px;"><p style="margin:0; white-space:pre-wrap; word-break:break-word; font-family:var(--mono); font-size:.9rem;">' +
        esc(snippet) + "</p></div>";
      lines.push("", "--- replace preview ---", preview);
    }

    resultEl.innerHTML = html;
    lastCopy = lines.join("\n");
  }

  /* ---------- events ---------- */

  function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 250);
  }

  patternEl.addEventListener("input", schedule);
  textEl.addEventListener("input", schedule);
  replaceEl.addEventListener("input", schedule);
  flagsEl.addEventListener("input", schedule);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    window.clearTimeout(timer);
    run();
    if (lastCopy) {
      window.JivoraUI.track("tool_action", { tool: "regex-tester", action: "test" });
    }
  });

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      hideError();
      flagsEl.value = "g";
      renderEmpty();
      patternEl.focus();
    }, 0);
  });

  copyBtn.addEventListener("click", function () {
    if (!lastCopy) {
      showError("Run a match first (add a pattern and test text), then copy.");
      return;
    }
    hideError();
    window.JivoraUI.copyFromButton(copyBtn, lastCopy, "tool_copy");
  });
})();
