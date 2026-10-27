/*
 * Base64 Encoder — Jivora
 * UTF-8 safe text → Base64 with optional URL-safe alphabet.
 */
(function () {
  "use strict";

  var form = document.getElementById("b64e-form");
  if (!form) return;

  var input = document.getElementById("b64e-input");
  var outEl = document.getElementById("b64e-out");
  var statusEl = document.getElementById("b64e-status");
  var copyBtn = document.getElementById("b64e-copy");
  var urlSafe = document.getElementById("b64e-urlsafe");
  var lastOutput = "";

  function encode(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    var b64 = btoa(binary);
    if (urlSafe.checked) {
      b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    return b64;
  }

  function utf8Bytes(text) {
    return new TextEncoder().encode(text).length;
  }

  function render() {
    var text = input.value;

    if (!text) {
      outEl.textContent = "\u2014";
      statusEl.textContent = "Waiting for input…";
      lastOutput = "";
      return;
    }

    try {
      var encoded = encode(text);
      lastOutput = encoded;
      outEl.textContent = encoded;
      statusEl.innerHTML =
        "<span class=\"is-ok\">Encoded \u2713</span>" +
        "<span>" + utf8Bytes(text) + " UTF-8 bytes \u2192 " + encoded.length + " Base64 chars</span>" +
        (urlSafe.checked ? "<span>URL-safe alphabet</span>" : "<span>standard alphabet</span>");
    } catch (e) {
      outEl.textContent = "\u2014";
      statusEl.textContent = "Couldn't encode that text.";
      lastOutput = "";
    }
  }

  /* ---------- events ---------- */

  input.addEventListener("input", render);
  urlSafe.addEventListener("change", render);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    render();
    window.JivoraUI.track("tool_action", { tool: "base64-encoder", action: "encode" });
  });

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
