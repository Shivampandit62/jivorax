/*
 * JPG to PNG — Jivora
 * Re-encodes a JPG as a lossless PNG on a canvas, entirely locally.
 */
(function () {
  "use strict";

  var MAX_BYTES = 20 * 1024 * 1024;

  var dropzone = document.getElementById("j2p-dropzone");
  var fileInput = document.getElementById("j2p-file");
  var errorEl = document.getElementById("j2p-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("j2p-result");

  if (!dropzone) return;

  var EMPTY_HTML =
    '<p class="result__empty">Choose a JPG above — the original and converted PNG will appear here with their exact file sizes.</p>';

  var state = { file: null, src: null, origUrl: null, outUrl: null };
  var job = 0;

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
    window.clearTimeout(errorEl._timer);
    errorEl._timer = window.setTimeout(function () {
      errorEl.classList.remove("is-shown");
    }, 5000);
  }

  function hideError() {
    errorEl.classList.remove("is-shown");
  }

  function bytes(n) {
    return window.JivoraUI ? window.JivoraUI.formatBytes(n) : n + " B";
  }

  function revokeUrls() {
    if (state.origUrl) { URL.revokeObjectURL(state.origUrl); state.origUrl = null; }
    if (state.outUrl) { URL.revokeObjectURL(state.outUrl); state.outUrl = null; }
  }

  function baseName(name) {
    var i = name.lastIndexOf(".");
    return i > 0 ? name.slice(0, i) : name;
  }

  function closeSource() {
    if (state.src) {
      if (state.src.url) URL.revokeObjectURL(state.src.url);
      if (state.src.img && state.src.img.close) state.src.img.close();
      state.src = null;
    }
  }

  /* ---------- loading ---------- */

  function loadViaElement(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        resolve({ img: img, width: img.naturalWidth, height: img.naturalHeight, url: url });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("decode"));
      };
      img.src = url;
    });
  }

  function loadSource(file) {
    if (window.createImageBitmap) {
      return window.createImageBitmap(file).then(function (bmp) {
        return { img: bmp, width: bmp.width, height: bmp.height };
      }, function () { return loadViaElement(file); });
    }
    return loadViaElement(file);
  }

  function toPngBlob(canvas) {
    return new Promise(function (resolve) {
      try {
        canvas.toBlob(function (blob) {
          resolve(blob && blob.type === "image/png" ? blob : null);
        }, "image/png");
      } catch (e) {
        resolve(null);
      }
    });
  }

  /* ---------- conversion ---------- */

  function convert() {
    var file = state.file;
    if (!file) return;

    var myJob = ++job;
    hideError();
    resultEl.innerHTML = '<p class="result__empty">Converting to PNG…</p>';

    loadSource(file).then(function (src) {
      if (myJob !== job) {
        if (src.url) URL.revokeObjectURL(src.url);
        if (src.img.close) src.img.close();
        return;
      }
      state.src = src;

      var canvas = document.createElement("canvas");
      canvas.width = src.width;
      canvas.height = src.height;
      var ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(src.img, 0, 0, src.width, src.height);
      if (src.url) URL.revokeObjectURL(src.url);
      if (src.img.close) src.img.close();
      state.src = null;

      return toPngBlob(canvas).then(function (blob) {
        if (myJob !== job) return;
        if (!blob) {
          resultEl.innerHTML = EMPTY_HTML;
          showError("Your browser couldn't encode that image. Try a smaller JPG file.");
          return;
        }
        render(file, blob, src.width, src.height);
      });
    })["catch"](function () {
      if (myJob !== job) return;
      resultEl.innerHTML = EMPTY_HTML;
      showError("We couldn't read that image — it may be damaged or not a valid JPG.");
    });
  }

  function render(file, blob, w, h) {
    revokeUrls();
    state.origUrl = URL.createObjectURL(file);
    state.outUrl = URL.createObjectURL(blob);

    var delta = file.size - blob.size;
    var pct = file.size > 0 ? Math.round((delta / file.size) * 100) : 0;
    var grew = delta <= 0;

    var headline = grew
      ? (pct < 0 ? "+" + Math.abs(pct) + "%" : "Same size")
      : "\u2212" + pct + "%";

    var sub = bytes(file.size) + " \u2192 " + bytes(blob.size) + " \u00B7 " + w + "\u00D7" + h + " px";

    var note = grew
      ? '<p class="field-note" style="margin-top:10px;">Larger as expected — PNG is lossless, so every pixel is preserved exactly. Screenshots and photos are usually smaller as JPG.</p>'
      : "";

    var outName = baseName(file.name) + ".png";

    resultEl.innerHTML =
      '<div class="compare">' +
        "<figure>" +
          '<img class="compare__img" src="' + state.origUrl + '" alt="Original JPG preview">' +
          "<figcaption><span>Original JPG</span><span class=\"size-pill\">" + esc(bytes(file.size)) + "</span></figcaption>" +
        "</figure>" +
        "<figure>" +
          '<img class="compare__img" src="' + state.outUrl + '" alt="Converted PNG preview">' +
          "<figcaption><span>Converted PNG</span><span class=\"size-pill\">" + esc(bytes(blob.size)) + "</span></figcaption>" +
        "</figure>" +
      "</div>" +
      '<div class="savings' + (grew ? " is-negative" : "") + '">' +
        "<div>" +
          '<p class="savings__big">' + headline + "</p>" +
          '<p class="savings__sub">' + esc(sub) + "</p>" +
        "</div>" +
      "</div>" +
      note +
      '<div class="actions">' +
        '<a class="btn btn--primary" id="j2p-download" href="' + state.outUrl + '" download="' + esc(outName) + '">' +
          "Download PNG" +
        "</a>" +
        '<button class="btn btn--ghost" type="button" id="j2p-again">Choose another</button>' +
      "</div>";

    window.JivoraUI.track("tool_action", { tool: "jpg-to-png", action: "convert" });
  }

  /* ---------- file handling ---------- */

  function handleFile(file) {
    if (!file) return;
    hideError();

    if (file.type !== "image/jpeg") {
      showError("That file isn't a JPG — please choose a .jpg or .jpeg image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      showError("That image is larger than 20 MB. Please pick a smaller file.");
      return;
    }

    closeSource();
    state.file = file;
    convert();
  }

  /* ---------- events ---------- */

  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  dropzone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropzone.classList.add("is-drag");
  });
  dropzone.addEventListener("dragleave", function () {
    dropzone.classList.remove("is-drag");
  });
  dropzone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropzone.classList.remove("is-drag");
    var dt = e.dataTransfer;
    if (dt && dt.files && dt.files[0]) handleFile(dt.files[0]);
  });

  resultEl.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest("#j2p-download")) {
      window.JivoraUI.track("tool_action", { tool: "jpg-to-png", action: "download" });
      return;
    }
    if (t.closest("#j2p-again")) {
      state.file = null;
      closeSource();
      revokeUrls();
      fileInput.value = "";
      hideError();
      job++;
      resultEl.innerHTML = EMPTY_HTML;
      dropzone.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
})();
