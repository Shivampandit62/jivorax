/*
 * HTML Formatter — Jivora
 * Tag-aware pretty printer and whitespace minifier.
 * script/style/pre/textarea contents are always preserved verbatim.
 */
(function () {
  "use strict";

  var form = document.getElementById("hf-form");
  if (!form) return;

  var input = document.getElementById("hf-input");
  var statusEl = document.getElementById("hf-status");
  var errorEl = document.getElementById("hf-error");
  var errorMsg = errorEl.querySelector(".editor-error__msg");
  var errorCode = errorEl.querySelector("code");
  var minifyBtn = document.getElementById("hf-minify");
  var copyBtn = document.getElementById("hf-copy");

  var DEFAULT_STATUS = "Paste your markup above, then choose Format or Minify.";
  var INDENT = "  ";

  var VOID = {
    area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1,
    link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1
  };
  var RAW = { script: 1, style: 1, pre: 1, textarea: 1 };

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

  /* index of the ">" that closes the tag starting at `start` (quote-aware) */
  function findTagEnd(html, start) {
    var i = start + 1;
    var quote = null;
    while (i < html.length) {
      var ch = html.charAt(i);
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === ">") {
        return i;
      }
      i++;
    }
    return -1;
  }

  /* ---------- pretty printer ---------- */

  function format(html) {
    var out = [];
    var depth = 0;
    var i = 0;
    var n = html.length;
    var opens = 0;
    var closes = 0;

    function emit(line) {
      if (line === null || line === undefined) return;
      var t = String(line).replace(/\s+$/, "");
      if (t.trim() === "") return;
      out.push(new Array(depth + 1).join(INDENT) + t);
    }

    while (i < n) {
      var ch = html.charAt(i);

      /* comment */
      if (html.substr(i, 4) === "<!--") {
        var cEnd = html.indexOf("-->", i + 4);
        var cStop = cEnd === -1 ? n : cEnd + 3;
        var comment = html.slice(i, cStop);
        var cLines = comment.split("\n");
        for (var c = 0; c < cLines.length; c++) emit(cLines[c]);
        i = cStop;
        continue;
      }

      /* doctype / other < ! … > declarations */
      if (html.charAt(i) === "<" && html.charAt(i + 1) === "!") {
        var dEnd = findTagEnd(html, i);
        if (dEnd === -1) { emit(html.slice(i)); break; }
        emit(html.slice(i, dEnd + 1));
        i = dEnd + 1;
        continue;
      }

      /* tag */
      if (ch === "<" && /[a-zA-Z/]/.test(html.charAt(i + 1) || "")) {
        var end = findTagEnd(html, i);
        if (end === -1) { emit(html.slice(i)); break; }
        var tag = html.slice(i, end + 1);
        var m = tag.match(/^<\s*(\/)?\s*([a-zA-Z][^\s/>]*)/);
        var closing = !!(m && m[1]);
        var name = m ? m[2].toLowerCase() : "";
        var selfClose = /\/>$/.test(tag);
        var isVoid = VOID[name] === 1;

        if (closing) {
          if (depth > 0) depth--;
          closes++;
          emit(tag);
          i = end + 1;
          continue;
        }

        if (selfClose || isVoid) {
          emit(tag);
          i = end + 1;
          continue;
        }

        /* raw-text element: keep content verbatim */
        if (RAW[name] === 1) {
          var closeRe = new RegExp("</\\s*" + name + "\\s*>", "i");
          var rest = html.slice(end + 1);
          var cm = rest.match(closeRe);
          emit(tag);
          opens++;
          if (cm) {
            var content = rest.slice(0, cm.index);
            var lines = content.split("\n");
            for (var l = 0; l < lines.length; l++) {
              var raw = lines[l].replace(/\s+$/, "");
              if (raw.trim() !== "") out.push(new Array(depth + 2).join(INDENT) + raw);
            }
            depth++;
            var fullClose = rest.substr(cm.index, cm[0].length);
            emit(fullClose);
            closes++;
            i = end + 1 + cm.index + cm[0].length;
            continue;
          }
          /* no closing tag found — treat as a normal open tag */
          depth++;
          i = end + 1;
          continue;
        }

        emit(tag);
        opens++;
        depth++;
        i = end + 1;
        continue;
      }

      /* text node */
      var next = html.indexOf("<", i);
      if (next === -1) next = n;
      var text = html.slice(i, next).replace(/\s+/g, " ").trim();
      if (text) emit(text);
      i = next;
    }

    return { text: out.join("\n"), opens: opens, closes: closes };
  }

  /* ---------- minifier ---------- */

  function minify(html) {
    var blocks = [];
    /* park raw-text blocks so their contents stay untouched */
    var protectedHtml = html.replace(
      /<(script|style|pre|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      function (whole) {
        blocks.push(whole);
        return "\u0000BLOCK" + (blocks.length - 1) + "\u0000";
      }
    );

    /* drop comments (conditional comments kept) */
    protectedHtml = protectedHtml.replace(/<!--(?!\[if)[\s\S]*?-->/g, "");
    /* collapse whitespace between tags and inside text nodes */
    protectedHtml = protectedHtml.replace(/>\s+</g, "><");
    protectedHtml = protectedHtml.replace(/>[^<>]+</g, function (m) {
      var inner = m.slice(1, -1).replace(/\s+/g, " ");
      return ">" + inner.trim() + "<";
    });
    protectedHtml = protectedHtml.replace(/^\s+|\s+$/g, "");

    return protectedHtml.replace(/\u0000BLOCK(\d+)\u0000/g, function (_, idx) {
      return blocks[Number(idx)];
    });
  }

  /* ---------- actions ---------- */

  function doFormat() {
    var html = input.value;
    if (!html.trim()) {
      showError("Paste some HTML first — the editor is empty.");
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    hideError();

    var r = format(html);
    input.value = r.text;

    var lines = r.text.split("\n").length;
    var imbalance = r.opens - r.closes;

    setStatus(
      '<span class="is-ok">Formatted \u2713</span>' +
      "<span>" + lines + " lines</span>" +
      "<span>" + r.opens + " open / " + r.closes + " close</span>"
    );

    if (imbalance > 0) {
      showError(
        imbalance + " opening tag" + (imbalance === 1 ? "" : "s") + " may be unclosed.",
        "Check for a missing </tag> — the indentation will show where depth runs away."
      );
    } else if (imbalance < 0) {
      showError(
        Math.abs(imbalance) + " closing tag" + (imbalance === -1 ? "" : "s") + " without a matching opening tag.",
        "Look for a stray closing tag above."
      );
    }

    window.JivoraUI.track("tool_action", { tool: "html-formatter", action: "format" });
  }

  function doMinify() {
    var html = input.value;
    if (!html.trim()) {
      showError("Paste some HTML first — the editor is empty.");
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    hideError();

    var before = html.length;
    var after = minify(html);
    input.value = after;

    var saved = before > 0 ? Math.round((1 - after.length / before) * 100) : 0;
    setStatus(
      '<span class="is-ok">Minified \u2713</span>' +
      "<span>" + before + " \u2192 " + after.length + " chars</span>" +
      (saved > 0 ? "<span>" + saved + "% smaller</span>" : "")
    );

    window.JivoraUI.track("tool_action", { tool: "html-formatter", action: "minify" });
  }

  /* ---------- events ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    doFormat();
  });

  minifyBtn.addEventListener("click", doMinify);

  copyBtn.addEventListener("click", function () {
    if (!input.value.trim()) {
      showError("Nothing to copy yet — paste or format some HTML first.");
      input.focus();
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, input.value, "tool_copy");
  });

  input.addEventListener("input", function () {
    hideError();
    window.clearTimeout(input._statusTimer);
    input._statusTimer = window.setTimeout(function () {
      if (!input.value.trim()) setStatus(DEFAULT_STATUS);
    }, 400);
  });

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      hideError();
      setStatus(DEFAULT_STATUS);
      input.focus();
    }, 0);
  });
})();
