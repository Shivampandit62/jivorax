/*
 * PNG to JPG — Jivora
 * Re-encodes a PNG as JPG on a canvas with a quality slider and a
 * background colour for transparent pixels. Fully client-side.
 */
(function () {
  "use strict";

  var MAX_BYTES = 20 * 1024 * 1024;

  var dropzone = document.getElementById("p2j-dropzone");
  var fileInput = document.getElementById("p2j-file");
  var qualityInput = document.getElementById("p2j-quality");
  var qualityVal = document.getElementById("p2j-quality-val");
  var bgInput = document.getElementById("p2j-bg");
  var errorEl = document.getElementById("p2j-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("p2j-result");

  if (!dropzone) return;

  var EMPTY_HTML =
    '<p class="result__empty">Choose a PNG above — the original and converted JPG will appear here with their exact file sizes.</p>';

  var state = { file: null, origUrl: null, outUrl: null };
  var job = 0;
  var reTimer = null;

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

  function readBg() {
    var raw = (bgInput.value || "").trim();
    if (/^[0-9a-fA-F]{6}$/.test(raw)) raw = "#" + raw;
    if (!/^#[0-9a-fA-F]{6}$/.test(raw)) return null;
    return raw.toLowerCase();
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

  function toJpgBlob(canvas, quality) {
    return new Promise(function (resolve) {
      try {
        canvas.toBlob(function (blob) {
          resolve(blob && blob.type === "image/jpeg" ? blob : null);
        }, "image/jpeg", quality);
      } catch (e) {
        resolve(null);
      }
    });
  }

  /* ---------- conversion ---------- */

  function convert() {
    var file = state.file;
    if (!file) return;

    var bg = readBg();
    if (!bg) {
      showError("Background must be a hex colour like #ffffff.");
      bgInput.setAttribute("aria-invalid", "true");
      return;
    }
    bgInput.removeAttribute("aria-invalid");

    var myJob = ++job;
    hideError();
    if (!resultEl.querySelector(".compare")) {
      resultEl.innerHTML = '<p class="result__empty">Converting to JPG…</p>';
    }

    loadSource(file).then(function (src) {
      if (myJob !== job) {
        if (src.url) URL.revokeObjectURL(src.url);
        if (src.img.close) src.img.close();
        return;
      }

      var canvas = document.createElement("canvas");
      canvas.width = src.width;
      canvas.height = src.height;
      var ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, src.width, src.height);
      ctx.drawImage(src.img, 0, 0, src.width, src.height);
      if (src.url) URL.revokeObjectURL(src.url);
      if (src.img.close) src.img.close();

      var quality = (parseInt(qualityInput.value, 10) || 85) / 100;
      return toJpgBlob(canvas, quality).then(function (blob) {
        if (myJob !== job) return;
        if (!blob) {
          resultEl.innerHTML = EMPTY_HTML;
          showError("Your browser couldn't encode that image. Try a smaller PNG file.");
          return;
        }
        render(file, blob, src.width, src.height);
      });
    })["catch"](function () {
      if (myJob !== job) return;
      resultEl.innerHTML = EMPTY_HTML;
      showError("We couldn't read that image — it may be damaged or not a valid PNG.");
    });
  }

  function render(file, blob, w, h) {
    revokeUrls();
    state.origUrl = URL.createObjectURL(file);
    state.outUrl = URL.createObjectURL(blob);

    var delta = file.size - blob.size;
    var pct = file.size > 0 ? Math.round((delta / file.size) * 100) : 0;
    var grew = delta <= 0;
    var q = qualityInput.value + "%";

    var headline = grew
      ? (pct < 0 ? "+" + Math.abs(pct) + "%" : "Same size")
      : "\u2212" + pct + "%";

    var sub = bytes(file.size) + " \u2192 " + bytes(blob.size) +
      (grew ? "" : " \u00B7 saved " + bytes(delta)) +
      " \u00B7 quality " + q;

    var outName = baseName(file.name) + ".jpg";

    resultEl.innerHTML =
      '<div class="compare">' +
        "<figure>" +
          '<img class="compare__img" src="' + state.origUrl + '" alt="Original PNG preview">' +
          "<figcaption><span>Original PNG</span><span class=\"size-pill\">" + esc(bytes(file.size)) + "</span></figcaption>" +
        "</figure>" +
        "<figure>" +
          '<img class="compare__img" src="' + state.outUrl + '" alt="Converted JPG preview">' +
          "<figcaption><span>Converted JPG</span><span class=\"size-pill\">" + esc(bytes(blob.size)) + "</span></figcaption>" +
        "</figure>" +
      "</div>" +
      '<div class="savings' + (grew ? " is-negative" : "") + '">' +
        "<div>" +
          '<p class="savings__big">' + headline + "</p>" +
          '<p class="savings__sub">' + esc(sub) + "</p>" +
        "</div>" +
      "</div>" +
      '<div class="actions">' +
        '<a class="btn btn--primary" id="p2j-download" href="' + state.outUrl + '" download="' + esc(outName) + '">' +
          "Download JPG" +
        "</a>" +
        '<button class="btn btn--ghost" type="button" id="p2j-again">Choose another</button>' +
      "</div>";

    window.JivoraUI.track("tool_action", {
      tool: "png-to-jpg",
      action: "convert",
      quality: parseInt(q, 10)
    });
  }

  /* ---------- file handling ---------- */

  function handleFile(file) {
    if (!file) return;
    hideError();

    if (file.type !== "image/png") {
      showError("That file isn't a PNG — please choose a .png image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      showError("That image is larger than 20 MB. Please pick a smaller file.");
      return;
    }

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

  qualityInput.addEventListener("input", function () {
    qualityVal.textContent = qualityInput.value + "%";
    if (!state.file) return;
    window.clearTimeout(reTimer);
    reTimer = window.setTimeout(convert, 250);
  });

  bgInput.addEventListener("input", function () {
    bgInput.removeAttribute("aria-invalid");
    hideError();
    if (!state.file) return;
    window.clearTimeout(reTimer);
    reTimer = window.setTimeout(convert, 400);
  });

  resultEl.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest("#p2j-download")) {
      window.JivoraUI.track("tool_action", { tool: "png-to-jpg", action: "download" });
      return;
    }
    if (t.closest("#p2j-again")) {
      state.file = null;
      revokeUrls();
      fileInput.value = "";
      hideError();
      job++;
      resultEl.innerHTML = EMPTY_HTML;
      dropzone.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  qualityVal.textContent = qualityInput.value + "%";
})();
