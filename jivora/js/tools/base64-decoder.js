/*
 * Base64 Decoder — Jivora
 * Repairs URL-safe input, decodes bytes and interprets them as UTF-8,
 * with a clear message when the payload isn't text.
 */
(function () {
  "use strict";

  var form = document.getElementById("b64d-form");
  if (!form) return;

  var input = document.getElementById("b64d-input");
  var outEl = document.getElementById("b64d-out");
  var statusEl = document.getElementById("b64d-status");
  var errorEl = document.getElementById("b64d-error");
  var errorText = errorEl.querySelector("span");
  var copyBtn = document.getElementById("b64d-copy");
  var lastOutput = "";

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
    window.clearTimeout(errorEl._timer);
    errorEl._timer = window.setTimeout(function () {
      errorEl.classList.remove("is-shown");
    }, 6000);
  }

  function hideError() {
    errorEl.classList.remove("is-shown");
    input.removeAttribute("aria-invalid");
  }

  function normalize(raw) {
    var s = raw.replace(/\s+/g, "");
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    var rem = s.length % 4;
    if (rem === 2) s += "==";
    else if (rem === 3) s += "=";
    else if (rem === 1) throw new Error("length");
    return s;
  }

  function looksLikeBase64(s) {
    if (!s) return false;
    return /^[A-Za-z0-9+/=_-]+$/.test(s);
  }

  function decode() {
    var raw = input.value.trim();

    if (!raw) {
      hideError();
      outEl.textContent = "\u2014";
      statusEl.textContent = "Waiting for input\u2026";
      lastOutput = "";
      return;
    }

    if (!looksLikeBase64(raw.replace(/\s+/g, ""))) {
      input.setAttribute("aria-invalid", "true");
      showError("That doesn't look like Base64 — it should only contain letters, numbers, + / = (or - _).");
      outEl.textContent = "\u2014";
      statusEl.textContent = "Invalid input";
      lastOutput = "";
      return;
    }

    var s;
    try {
      s = normalize(raw);
    } catch (e) {
      input.setAttribute("aria-invalid", "true");
      showError("That Base64 string has an invalid length — it may have been truncated.");
      outEl.textContent = "\u2014";
      statusEl.textContent = "Invalid input";
      lastOutput = "";
      return;
    }

    var binary;
    try {
      binary = atob(s);
    } catch (e) {
      input.setAttribute("aria-invalid", "true");
      showError("We couldn't decode that — check that the whole string was copied.");
      outEl.textContent = "\u2014";
      statusEl.textContent = "Invalid Base64";
      lastOutput = "";
      return;
    }

    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    hideError();

    /* try UTF-8 text first */
    try {
      var text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      lastOutput = text;
      outEl.textContent = text;
      statusEl.innerHTML =
        '<span class="is-ok">Decoded \u2713</span>' +
        "<span>" + raw.replace(/\s+/g, "").length + " chars \u2192 " + bytes.length + " bytes</span>" +
        "<span>UTF-8 text</span>";
      return;
    } catch (e) { /* not text — report honestly below */ }

    /* not valid UTF-8: show a short hex preview instead of garbage */
    var previewBytes = [];
    for (var p = 0; p < Math.min(bytes.length, 64); p++) {
      previewBytes.push((bytes[p] < 16 ? "0" : "") + bytes[p].toString(16));
    }
    var preview = previewBytes.join(" ");
    if (bytes.length > 64) preview += " \u2026";

    lastOutput = preview;
    outEl.textContent = preview;
    statusEl.innerHTML =
      "<span>Decoded " + bytes.length + " bytes</span>" +
      "<span>This payload isn't UTF-8 text — showing the first bytes in hex (it may be an image or compressed data).</span>";
  }

  /* ---------- events ---------- */

  input.addEventListener("input", decode);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    decode();
    if (lastOutput) {
      window.JivoraUI.track("tool_action", { tool: "base64-decoder", action: "decode" });
    }
  });

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      hideError();
      decode();
      input.focus();
    }, 0);
  });

  copyBtn.addEventListener("click", function () {
    if (!lastOutput) {
      window.JivoraUI.flashButton(copyBtn, "Paste something first");
      input.focus();
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, lastOutput, "tool_copy");
  });

  decode();
})();
