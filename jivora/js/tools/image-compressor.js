/*
 * Image Compressor — Jivora
 * Reads an image, resizes/re-encodes it on an off-screen canvas and
 * offers the smaller file for download. Nothing is ever uploaded.
 */
(function () {
  "use strict";

  var MAX_BYTES = 20 * 1024 * 1024;
  var OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

  var dropzone = document.getElementById("img-dropzone");
  var fileInput = document.getElementById("img-file");
  var qualityInput = document.getElementById("img-quality");
  var qualityVal = document.getElementById("img-quality-val");
  var maxwSelect = document.getElementById("img-maxw");
  var errorEl = document.getElementById("img-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("img-result");

  var EMPTY_HTML =
    '<p class="result__empty">Choose an image above — the original and compressed sizes will appear here, ready to download.</p>';

  var state = { file: null, origUrl: null, outUrl: null };
  var job = 0;
  var reTimer = null;

  /* ---------- helpers ---------- */

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

  /* ---------- image loading ---------- */

  function loadSource(file) {
    if (window.createImageBitmap) {
      return window.createImageBitmap(file).then(function (bmp) {
        return { img: bmp, width: bmp.width, height: bmp.height, close: true };
      }, function () { return loadViaElement(file); });
    }
    return loadViaElement(file);
  }

  function loadViaElement(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        resolve({ img: img, width: img.naturalWidth, height: img.naturalHeight, close: true, url: url });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("decode"));
      };
      img.src = url;
    });
  }

  /* ---------- encoding ---------- */

  function toBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      try {
        canvas.toBlob(function (blob) {
          resolve(blob && blob.type === type ? blob : null);
        }, type, quality);
      } catch (e) {
        resolve(null);
      }
    });
  }

  /*
   * Pick the best candidate for the input format:
   *  - JPG  -> JPG at the chosen quality
   *  - WebP -> WebP at the chosen quality
   *  - PNG  -> PNG (lossless) *and* WebP, keep whichever is smaller
   */
  function encodeBest(canvas, inputType, quality) {
    if (inputType === "image/jpeg") {
      return toBlob(canvas, "image/jpeg", quality).then(function (b) {
        return { blob: b, ext: "jpg", converted: false };
      });
    }
    if (inputType === "image/webp") {
      return toBlob(canvas, "image/webp", quality).then(function (b) {
        return b
          ? { blob: b, ext: "webp", converted: false }
          : { blob: null, ext: "webp", converted: false };
      });
    }
    /* PNG: lossless re-encode vs lossy WebP */
    return Promise.all([
      toBlob(canvas, "image/png", 1),
      toBlob(canvas, "image/webp", quality)
    ]).then(function (pair) {
      var png = pair[0];
      var webp = pair[1];
      if (webp && (!png || webp.size < png.size)) {
        return { blob: webp, ext: "webp", converted: true };
      }
      return { blob: png, ext: "png", converted: false };
    });
  }

  /* ---------- compression pipeline ---------- */

  function compress() {
    var file = state.file;
    if (!file) return;

    var myJob = ++job;
    hideError();
    resultEl.innerHTML = '<p class="result__empty">Compressing…</p>';

    loadSource(file).then(function (src) {
      if (myJob !== job) { if (src.close && src.url) URL.revokeObjectURL(src.url); return; }

      var maxW = parseInt(maxwSelect.value, 10) || 0;
      var w = src.width;
      var h = src.height;
      if (maxW && w > maxW) {
        h = Math.max(1, Math.round(h * (maxW / w)));
        w = maxW;
      }

      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.imageSmoothingQuality = "high";
      if (file.type === "image/jpeg") {
        /* flatten transparency onto white for JPEG output */
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(src.img, 0, 0, w, h);
      if (src.close && src.url) URL.revokeObjectURL(src.url);
      if (src.close && src.img.close) src.img.close();

      var quality = (parseInt(qualityInput.value, 10) || 80) / 100;
      return encodeBest(canvas, file.type, quality).then(function (res) {
        if (myJob !== job) return;
        if (!res || !res.blob) {
          resultEl.innerHTML = EMPTY_HTML;
          showError("Your browser couldn't encode that image. Try a JPG or PNG file.");
          return;
        }
        render(file, res, src.width, src.height, w, h);
      });
    })["catch"](function () {
      if (myJob !== job) return;
      resultEl.innerHTML = EMPTY_HTML;
      showError("We couldn't read that image — it may be damaged or in an unsupported format.");
    });
  }

  /* ---------- rendering ---------- */

  function render(file, res, ow, oh, nw, nh) {
    var origSize = file.size;
    var newSize = res.blob.size;

    revokeUrls();
    state.origUrl = URL.createObjectURL(file);
    state.outUrl = URL.createObjectURL(res.blob);

    var saved = origSize - newSize;
    var pct = origSize > 0 ? Math.round((saved / origSize) * 100) : 0;
    var grew = saved <= 0;
    var resized = nw !== ow || nh !== oh;

    var headline = grew
      ? (pct < 0 ? "+" + Math.abs(pct) + "%" : "No change")
      : "\u2212" + pct + "%";

    var sub = bytes(origSize) + " \u2192 " + bytes(newSize);
    if (grew) {
      sub += " — this image was already well optimized";
    } else {
      sub += " \u00B7 saved " + bytes(saved);
    }
    if (resized) {
      sub += " \u00B7 resized to " + nw + "\u00D7" + nh + " px";
    }

    var note = res.converted
      ? '<p class="field-note" style="margin-top:10px;">Converted from PNG to WebP for a smaller file — the preview and pixels keep transparency.</p>'
      : "";

    var outName = baseName(file.name) + "-compressed." + res.ext;

    resultEl.innerHTML =
      '<div class="compare">' +
        '<figure>' +
          '<img class="compare__img" src="' + state.origUrl + '" alt="Original image preview">' +
          "<figcaption><span>Original</span><span class=\"size-pill\">" + esc(bytes(origSize)) + "</span></figcaption>" +
        "</figure>" +
        '<figure>' +
          '<img class="compare__img" src="' + state.outUrl + '" alt="Compressed image preview">' +
          "<figcaption><span>Compressed</span><span class=\"size-pill\">" + esc(bytes(newSize)) + "</span></figcaption>" +
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
        '<a class="btn btn--primary" id="img-download" href="' + state.outUrl + '" download="' + esc(outName) + '">' +
          "Download image" +
        "</a>" +
        '<button class="btn btn--ghost" type="button" id="img-again">Choose another</button>' +
      "</div>";

    window.JivoraUI.track("tool_action", {
      tool: "image-compressor",
      action: "compress",
      saved_percent: pct
    });
  }

  /* ---------- file handling ---------- */

  function handleFile(file) {
    if (!file) return;
    hideError();

    if (OK_TYPES.indexOf(file.type) === -1) {
      showError("That file type isn't supported — please choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      showError("That image is larger than 20 MB. Please pick a smaller file.");
      return;
    }

    state.file = file;
    compress();
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
    reTimer = window.setTimeout(compress, 250);
  });

  maxwSelect.addEventListener("change", function () {
    if (!state.file) return;
    window.clearTimeout(reTimer);
    reTimer = window.setTimeout(compress, 120);
  });

  resultEl.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest("#img-download")) {
      window.JivoraUI.track("tool_action", { tool: "image-compressor", action: "download" });
      return;
    }
    if (t.closest("#img-again")) {
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
