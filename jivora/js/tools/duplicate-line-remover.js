/*
 * Duplicate Line Remover — Jivora
 * Live dedupe with keep-first/keep-last, optional case and space
 * insensitivity, and an empty-line drop toggle.
 */
(function () {
  "use strict";

  var form = document.getElementById("dl-form");
  if (!form) return;

  var input = document.getElementById("dl-text");
  var keepSel = document.getElementById("dl-keep");
  var caseChk = document.getElementById("dl-case");
  var trimChk = document.getElementById("dl-trim");
  var emptyChk = document.getElementById("dl-empty");
  var outEl = document.getElementById("dl-out");
  var statusEl = document.getElementById("dl-status");
  var copyBtn = document.getElementById("dl-copy");
  var inEl = document.getElementById("dl-in");
  var removedEl = document.getElementById("dl-removed");
  var keptEl = document.getElementById("dl-kept");
  var lastOutput = "";

  function keyOf(line, trim, ignoreCase) {
    var k = trim ? line.replace(/^[ \t]+|[ \t]+$/g, "") : line;
    return ignoreCase ? k.toLocaleLowerCase() : k;
  }

  function process(text) {
    var lines = text.split("\n");
    var dropEmpty = emptyChk.checked;
    var trim = trimChk.checked;
    var ignoreCase = caseChk.checked;
    var keepLast = keepSel.value === "last";

    var blanks = 0;
    for (var b = 0; b < lines.length; b++) {
      if (lines[b].replace(/^[ \t]+|[ \t]+$/g, "") === "") blanks++;
    }

    var out;
    if (keepLast) {
      /* keep the last occurrence: mark earlier repeats, then emit survivors in order */
      var seenLast = Object.create(null);
      for (var i = lines.length - 1; i >= 0; i--) {
        var raw = lines[i];
        var isEmpty = raw.replace(/^[ \t]+|[ \t]+$/g, "") === "";
        if (isEmpty) {
          if (dropEmpty) lines[i] = null;
          /* blanks are kept as-is — never treated as duplicates */
          continue;
        }
        var k = keyOf(raw, trim, ignoreCase);
        if (seenLast[k]) {
          lines[i] = null;
        } else {
          seenLast[k] = true;
        }
      }
      out = [];
      for (var j = 0; j < lines.length; j++) {
        if (lines[j] !== null) out.push(lines[j]);
      }
    } else {
      var seen = Object.create(null);
      out = [];
      for (var m = 0; m < lines.length; m++) {
        var line = lines[m];
        var empty = line.replace(/^[ \t]+|[ \t]+$/g, "") === "";
        if (empty && dropEmpty) continue;
        var key = keyOf(line, trim, ignoreCase);
        if (empty) {
          out.push(line);
          continue;
        }
        if (seen[key]) continue;
        seen[key] = true;
        out.push(line);
      }
    }

    var result = out.join("\n");
    var inCount = dropEmpty ? lines.length - blanks : lines.length;
    var keptCount = out.length;
    var removed = Math.max(0, inCount - keptCount);
    return { text: result, inCount: inCount, kept: keptCount, removed: removed, blanks: blanks };
  }

  function render() {
    var text = input.value;
    if (!text) {
      outEl.textContent = "Your deduplicated list appears here.";
      statusEl.textContent = "Paste a list to get started.";
      inEl.textContent = "0";
      removedEl.textContent = "0";
      keptEl.textContent = "0";
      lastOutput = "";
      return;
    }

    var res = process(text);
    lastOutput = res.text;
    outEl.textContent = res.text;
    inEl.textContent = String(res.inCount);
    removedEl.textContent = String(res.removed);
    keptEl.textContent = String(res.kept);

    if (res.removed === 0) {
      statusEl.innerHTML = '<span class="is-ok">No duplicates found</span><span>every line is unique</span>';
    } else {
      statusEl.innerHTML =
        '<span class="is-ok">' + res.removed + " duplicate" + (res.removed === 1 ? "" : "s") + " removed</span>" +
        "<span>" + res.inCount + " \u2192 " + res.kept + " lines</span>";
    }
  }

  /* ---------- events ---------- */

  input.addEventListener("input", render);
  keepSel.addEventListener("change", render);

  var toggles = [caseChk, trimChk, emptyChk];
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
      window.JivoraUI.flashButton(copyBtn, "Paste a list first");
      input.focus();
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastOutput, "tool_copy");
  });

  render();
})();
