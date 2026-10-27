/*
 * UUID Generator — Jivora
 * RFC 9562 version 4 UUIDs from crypto.randomUUID / crypto.getRandomValues.
 */
(function () {
  "use strict";

  var form = document.getElementById("uuid-form");
  if (!form) return;

  var countInput = document.getElementById("uuid-count");
  var upperBox = document.getElementById("uuid-upper");
  var outEl = document.getElementById("uuid-out");
  var statusEl = document.getElementById("uuid-status");
  var errorEl = document.getElementById("uuid-error");
  var errorText = errorEl.querySelector("span");
  var copyBtn = document.getElementById("uuid-copy");

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
    window.clearTimeout(errorEl._timer);
    errorEl._timer = window.setTimeout(function () {
      errorEl.classList.remove("is-shown");
    }, 4000);
  }

  function randomBytes(n) {
    var arr = new Uint8Array(n);
    window.crypto.getRandomValues(arr);
    return arr;
  }

  function uuidV4() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    /* manual RFC 9562 v4 from secure random bytes */
    var b = randomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40; /* version 4 */
    b[8] = (b[8] & 0x3f) | 0x80; /* variant 1 */
    var hex = [];
    for (var i = 0; i < 16; i++) hex.push((b[i] < 16 ? "0" : "") + b[i].toString(16));
    return (
      hex.slice(0, 4).join("") + "-" +
      hex.slice(4, 6).join("") + "-" +
      hex.slice(6, 8).join("") + "-" +
      hex.slice(8, 10).join("") + "-" +
      hex.slice(10, 16).join("")
    );
  }

  function generate() {
    var count = parseInt(countInput.value, 10);
    if (!isFinite(count) || count < 1 || count > 100) {
      countInput.setAttribute("aria-invalid", "true");
      showError("Choose a count between 1 and 100.");
      countInput.focus();
      return;
    }
    countInput.removeAttribute("aria-invalid");
    errorEl.classList.remove("is-shown");

    var list = [];
    for (var i = 0; i < count; i++) {
      var id = uuidV4();
      if (upperBox.checked) id = id.toUpperCase();
      list.push(id);
    }

    outEl.value = list.join("\n");
    outEl.rows = Math.max(4, Math.min(12, count));
    statusEl.innerHTML =
      '<span class="is-ok">Generated \u2713</span>' +
      "<span>" + count + " UUID" + (count === 1 ? "" : "s") + "</span>" +
      "<span>version 4 · variant 1 · 122 random bits</span>";
  }

  /* ---------- events ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    generate();
    window.JivoraUI.track("tool_action", { tool: "uuid-generator", action: "generate" });
  });

  upperBox.addEventListener("change", function () {
    if (outEl.value) generate();
  });

  copyBtn.addEventListener("click", function () {
    if (!outEl.value) {
      showError("Generate some UUIDs first, then copy them.");
      return;
    }
    window.JivoraUI.copyFromButton(copyBtn, outEl.value, "tool_copy");
  });

  generate();
})();
