/*
 * JSON Validator — Jivora
 * Syntax validation with line/column errors plus a structure summary.
 */
(function () {
  "use strict";

  var form = document.getElementById("jv-form");
  if (!form) return;

  var input = document.getElementById("jv-input");
  var statusEl = document.getElementById("jv-status");
  var errorEl = document.getElementById("jv-error");
  var errorMsg = errorEl.querySelector(".editor-error__msg");
  var errorCode = errorEl.querySelector("code");
  var copyBtn = document.getElementById("jv-copy");
  var resultEl = document.getElementById("jv-result");

  var DEFAULT_STATUS = "Paste your JSON above and press Validate — the verdict appears here.";
  var EMPTY_RESULT =
    '<p class="result__empty">Valid JSON gets a full structure breakdown here — types, key count, depth and size.</p>';

  var statusTimer = null;
  var lastReport = "";

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(html) {
    statusEl.innerHTML = html;
  }

  function showError(msg, detail) {
    errorMsg.textContent = msg;
    errorCode.textContent = detail || "";
    errorCode.style.display = detail ? "" : "none";
    errorEl.classList.add("is-shown");
    input.setAttribute("aria-invalid", "true");
  }

  function hideError() {
    errorEl.classList.remove("is-shown");
    input.removeAttribute("aria-invalid");
  }

  function friendly(raw) {
    var m = String(raw);
    if (/Unexpected end of JSON input|end of data/i.test(m)) {
      return "The JSON ends too early — a value, quote or closing bracket is missing.";
    }
    if (/Expected property name/i.test(m)) {
      return 'Object keys must be double-quoted and separated by commas — no trailing commas before "}".';
    }
    if (/Unexpected token/i.test(m)) {
      return "Unexpected character — the usual causes are a trailing comma, a missing comma, or an unquoted key.";
    }
    if (/is not valid JSON|invalid/i.test(m)) {
      return "That is not valid JSON — check quotes, commas and brackets.";
    }
    return "We couldn't read that as JSON.";
  }

  function locate(text, raw) {
    var m = String(raw);
    var lineCol = m.match(/line (\d+) column (\d+)/i);
    if (lineCol) return { line: Number(lineCol[1]), column: Number(lineCol[2]) };
    var pos = m.match(/position (\d+)/i);
    if (!pos) return null;
    var p = Math.min(Number(pos[1]), text.length);
    var before = text.slice(0, p);
    return {
      line: before.split("\n").length,
      column: p - before.lastIndexOf("\n")
    };
  }

  function snippet(text, loc) {
    var lines = text.split("\n");
    var line = lines[loc.line - 1];
    if (line === undefined) return "";
    var trimmed = line.length > 90 ? line.slice(0, 90) + "…" : line;
    var pad = Math.min(Math.max(loc.column - 1, 0), trimmed.length);
    return trimmed + "\n" + new Array(pad + 1).join(" ") + "^";
  }

  /* ---------- structure analysis ---------- */

  function analyse(value) {
    var stats = {
      objects: 0, arrays: 0, keys: 0, strings: 0,
      numbers: 0, booleans: 0, nulls: 0, depth: 0
    };

    function walk(v, depth) {
      if (depth > stats.depth) stats.depth = depth;
      if (v === null) { stats.nulls++; return; }
      if (Array.isArray(v)) {
        stats.arrays++;
        for (var i = 0; i < v.length; i++) walk(v[i], depth + 1);
        return;
      }
      if (typeof v === "object") {
        stats.objects++;
        for (var k in v) {
          if (Object.prototype.hasOwnProperty.call(v, k)) {
            stats.keys++;
            walk(v[k], depth + 1);
          }
        }
        return;
      }
      if (typeof v === "number") stats.numbers++;
      else if (typeof v === "boolean") stats.booleans++;
      else stats.strings++;
    }

    walk(value, 1);
    return stats;
  }

  function rootType(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "Array";
    var t = typeof value;
    return t === "object" ? "Object" : t.charAt(0).toUpperCase() + t.slice(1);
  }

  function renderValid(text, value) {
    var stats = analyse(value);
    var bytes = 0;
    try {
      bytes = new Blob([text]).size;
    } catch (e) {
      bytes = text.length;
    }

    var rows = [
      ["Root type", rootType(value)],
      ["Object keys", String(stats.keys)],
      ["Arrays", String(stats.arrays)],
      ["Strings", String(stats.strings)],
      ["Numbers", String(stats.numbers)],
      ["Booleans / null", stats.booleans + " / " + stats.nulls],
      ["Max depth", String(stats.depth)],
      ["Size", bytes + " bytes"]
    ];

    var html =
      '<p class="result__label">Structure</p>' +
      '<p class="result__primary grad-text">Valid JSON \u2713</p>' +
      '<p class="result__caption">' + esc(rootType(value)) + " · depth " + stats.depth + " · " + bytes + " bytes</p>" +
      '<div class="result__rows">';

    var lines = [
      "Valid JSON",
      "Root type: " + rootType(value),
      "Object keys: " + stats.keys,
      "Arrays: " + stats.arrays,
      "Strings: " + stats.strings,
      "Numbers: " + stats.numbers,
      "Booleans/null: " + stats.booleans + "/" + stats.nulls,
      "Max depth: " + stats.depth,
      "Size: " + bytes + " bytes"
    ];

    for (var r = 0; r < rows.length; r++) {
      html +=
        '<div class="result-row"><span class="result-row__k">' + esc(rows[r][0]) +
        '</span><span class="result-row__v">' + esc(rows[r][1]) + "</span></div>";
    }
    html += "</div>";

    resultEl.innerHTML = html;
    lastReport = lines.join("\n");
  }

  /* ---------- validation ---------- */

  function validate(loud) {
    var text = input.value;

    if (!text.trim()) {
      setStatus(DEFAULT_STATUS);
      hideError();
      resultEl.innerHTML = EMPTY_RESULT;
      lastReport = "";
      if (loud) showError("Paste some JSON first — the editor is empty.");
      return false;
    }

    try {
      var value = JSON.parse(text);
      hideError();
      setStatus(
        '<span class="is-ok">Valid JSON \u2713</span>' +
        "<span>" + text.length + " characters</span>" +
        "<span>press Validate for the structure</span>"
      );
      renderValid(text, value);
      return true;
    } catch (err) {
      var raw = err && err.message ? err.message : String(err);
      var loc = locate(text, raw);
      var detail = "";
      if (loc) {
        detail = "Line " + loc.line + ", column " + loc.column;
        var snip = snippet(text, loc);
        if (snip) detail += ":\n" + snip;
      }
      showError(friendly(raw), detail);
      setStatus("<span>Invalid JSON — see the error above</span>");
      if (loud) {
        resultEl.innerHTML =
          '<p class="result__empty">Fix the error and validate again — the structure summary appears once it\'s valid.</p>';
      }
      lastReport = "Invalid JSON\n" + friendly(raw) + (detail ? "\n" + detail : "");
      return false;
    }
  }

  /* ---------- events ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (validate(true)) {
      window.JivoraUI.track("tool_action", { tool: "json-validator", action: "validate" });
    }
  });

  input.addEventListener("input", function () {
    hideError();
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(function () { validate(false); }, 350);
  });

  copyBtn.addEventListener("click", function () {
    if (!lastReport) {
      showError("Validate some JSON first, then copy the report.");
      input.focus();
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastReport, "tool_copy");
  });

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      hideError();
      setStatus(DEFAULT_STATUS);
      resultEl.innerHTML = EMPTY_RESULT;
      lastReport = "";
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
    }
  });
})();
