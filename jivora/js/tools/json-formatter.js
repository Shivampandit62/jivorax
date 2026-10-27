/*
 * JSON Formatter — Jivora
 * Format / minify / validate JSON with friendly, line-aware errors.
 */
(function () {
  "use strict";

  var form = document.getElementById("json-form");
  if (!form) return;

  var input = document.getElementById("json-input");
  var statusEl = document.getElementById("json-status");
  var errorEl = document.getElementById("json-error");
  var errorMsg = errorEl.querySelector(".editor-error__msg");
  var errorCode = errorEl.querySelector("code");
  var minifyBtn = document.getElementById("json-minify");
  var copyBtn = document.getElementById("json-copy");

  var DEFAULT_STATUS = "Paste your JSON above, then choose Format or Minify.";
  var statusTimer = null;

  /* ---------- helpers ---------- */

  function setStatus(html) {
    statusEl.innerHTML = html;
  }

  function showError(msg, detail) {
    errorMsg.textContent = msg;
    errorCode.textContent = detail || "";
    errorCode.style.display = detail ? "" : "none";
    errorEl.classList.add("is-shown");
  }

  function hideError() {
    errorEl.classList.remove("is-shown");
    input.removeAttribute("aria-invalid");
  }

  /* Turn a raw parser error into something human friendly. */
  function friendly(raw) {
    var m = String(raw);
    if (/Unexpected end of JSON input|end of data/i.test(m)) {
      return "The JSON ends too early — a value, quote or closing bracket is missing.";
    }
    if (/Expected property name or ['"]?}/i.test(m) || /Expected property name/i.test(m)) {
      return 'Object keys must be double-quoted and separated by commas — and there are no trailing commas before "}".';
    }
    if (/Unexpected token ['"]?}/i.test(m) || /Unexpected token ','|trailing comma/i.test(m)) {
      return "There is an unexpected character here — a trailing comma or a missing comma between items is the usual cause.";
    }
    if (/Unexpected (token|character)/i.test(m)) {
      var tok = m.match(/Unexpected token (.)|Unexpected character (.)|at position/i);
      var ch = (tok && (tok[1] || tok[2])) || "";
      if (ch === "'" || ch === "\u2019") {
        return "Single quotes are not allowed in JSON — strings must use double quotes.";
      }
      if (ch === "`") {
        return "Backticks are not allowed in JSON — strings must use double quotes.";
      }
      return "The parser hit an unexpected character — check for a missing quote, comma or bracket.";
    }
    if (/is not valid JSON|invalid/i.test(m)) {
      return "That is not valid JSON — check quotes, commas and brackets.";
    }
    return "We couldn't read that as JSON.";
  }

  /* Work out line / column for the parser error, if possible. */
  function locate(text, raw) {
    var m = String(raw);
    var lineCol = m.match(/line (\d+) column (\d+)/i);
    if (lineCol) {
      return { line: Number(lineCol[1]), column: Number(lineCol[2]) };
    }
    var pos = m.match(/position (\d+)/i);
    if (!pos) return null;
    var p = Math.min(Number(pos[1]), text.length);
    var before = text.slice(0, p);
    var line = before.split("\n").length;
    var column = p - before.lastIndexOf("\n");
    return { line: line, column: column };
  }

  /* One-line snippet around the failure, with a caret. */
  function snippet(text, loc) {
    if (!loc) return "";
    var lines = text.split("\n");
    var line = lines[loc.line - 1];
    if (line === undefined) return "";
    var trimmed = line.length > 90 ? line.slice(0, 90) + "…" : line;
    var caretPad = Math.min(Math.max(loc.column - 1, 0), trimmed.length);
    return trimmed + "\n" + new Array(caretPad + 1).join(" ") + "^";
  }

  function parseJSON(text, opts) {
    opts = opts || {};
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (err) {
      var raw = err && err.message ? err.message : String(err);
      var loc = locate(text, raw);
      var detail = "";
      if (loc) {
        detail = "Line " + loc.line + ", column " + loc.column;
        var snip = snippet(text, loc);
        if (snip) detail += ":\n" + snip;
      }
      if (!opts.quiet) {
        showError(friendly(raw), detail);
        input.setAttribute("aria-invalid", "true");
      }
      return { ok: false };
    }
  }

  function countLines(s) {
    return s.split("\n").length;
  }

  /* ---------- live status while typing ---------- */

  function updateStatus() {
    var text = input.value;
    if (!text.trim()) {
      setStatus(DEFAULT_STATUS);
      hideError();
      return;
    }
    var result = parseJSON(text, { quiet: true });
    if (result.ok) {
      setStatus(
        '<span class="is-ok">Valid JSON \u2713</span>' +
        "<span>" + text.length + " characters</span>" +
        "<span>" + countLines(text) + " lines</span>"
      );
      hideError();
    } else {
      setStatus("<span>Invalid JSON — press Format for details</span>");
    }
  }

  /* ---------- actions ---------- */

  function format() {
    var text = input.value;
    if (!text.trim()) {
      showError("Paste some JSON first — the editor is empty.");
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    var result = parseJSON(text);
    if (!result.ok) {
      setStatus("<span>Invalid JSON — see the error below</span>");
      return;
    }
    var pretty = JSON.stringify(result.value, null, 2);
    input.value = pretty;
    hideError();
    setStatus(
      '<span class="is-ok">Formatted \u2713</span>' +
      "<span>2-space indent</span>" +
      "<span>" + countLines(pretty) + " lines</span>"
    );
    window.JivoraUI.track("tool_action", { tool: "json-formatter", action: "format" });
  }

  function minify() {
    var text = input.value;
    if (!text.trim()) {
      showError("Paste some JSON first — the editor is empty.");
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    var result = parseJSON(text);
    if (!result.ok) {
      setStatus("<span>Invalid JSON — see the error below</span>");
      return;
    }
    var compact = JSON.stringify(result.value);
    var before = text.length;
    input.value = compact;
    hideError();
    var diff = before > 0 ? Math.round((1 - compact.length / before) * 100) : 0;
    setStatus(
      '<span class="is-ok">Minified \u2713</span>' +
      "<span>" + before + " \u2192 " + compact.length + " characters</span>" +
      (diff > 0 ? "<span>" + diff + "% smaller</span>" : "")
    );
    window.JivoraUI.track("tool_action", { tool: "json-formatter", action: "minify" });
  }

  /* ---------- events ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    format();
  });

  minifyBtn.addEventListener("click", minify);

  copyBtn.addEventListener("click", function () {
    if (!input.value.trim()) {
      showError("Nothing to copy yet — paste or format some JSON first.");
      input.focus();
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, input.value, "tool_copy");
  });

  input.addEventListener("input", function () {
    hideError();
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(updateStatus, 300);
  });

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      hideError();
      setStatus(DEFAULT_STATUS);
      input.focus();
    }, 0);
  });

  /* Tab inserts two spaces inside the editor */
  input.addEventListener("keydown", function (e) {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      var start = input.selectionStart;
      var end = input.selectionEnd;
      input.value = input.value.slice(0, start) + "  " + input.value.slice(end);
      input.selectionStart = input.selectionEnd = start + 2;
      updateStatus();
    }
  });
})();
