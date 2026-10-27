/*
 * Image Resizer — Jivora
 * Loads an image, resizes it on an off-screen canvas to exact
 * dimensions (with aspect lock) and offers the result for download.
 */
(function () {
  "use strict";

  var MAX_BYTES = 20 * 1024 * 1024;
  var OK_TYPES = ["image/jpeg", "image/png", "image/webp"];
  var MAX_DIM = 8000;

  var dropzone = document.getElementById("rs-dropzone");
  var fileInput = document.getElementById("rs-file");
  var form = document.getElementById("rs-form");
  var widthInput = document.getElementById("rs-width");
  var heightInput = document.getElementById("rs-height");
  var lockChk = document.getElementById("rs-lock");
  var origBtn = document.getElementById("rs-orig");
  var errorEl = document.getElementById("rs-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("rs-result");

  if (!dropzone || !form) return;

  var EMPTY_HTML =
    '<p class="result__empty">Choose an image above — set the dimensions, then compare both file sizes here before downloading.</p>';

  var state = { file: null, src: null, origW: 0, origH: 0, origUrl: null, outUrl: null };

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

  /* ---------- image loading (same strategy as the compressor) ---------- */

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

  /* ---------- dimension fields ---------- */

  function setDims(w, h) {
    widthInput.value = String(w);
    heightInput.value = String(h);
  }

  function readDim(input) {
    var v = parseInt(input.value, 10);
    if (!isFinite(v) || v < 1) return 0;
    return v;
  }

  /* ---------- resize pipeline ---------- */

  function resize() {
    if (!state.file || !state.src) return;

    var w = readDim(widthInput);
    var h = readDim(heightInput);
    if (!w || !h) {
      showError("Enter a width and height between 1 and " + MAX_DIM + " pixels.");
      (!w ? widthInput : heightInput).setAttribute("aria-invalid", "true");
      return;
    }
    if (w > MAX_DIM || h > MAX_DIM) {
      showError("Maximum dimension is " + MAX_DIM + " pixels per side.");
      return;
    }
    widthInput.removeAttribute("aria-invalid");
    heightInput.removeAttribute("aria-invalid");
    hideError();

    var file = state.file;
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    if (!ctx) {
      showError("Your browser couldn't create a canvas for resizing.");
      return;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (file.type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(state.src.img, 0, 0, w, h);

    var type = file.type;
    var quality = type === "image/png" ? 1 : 0.92;

    toBlob(canvas, type, quality).then(function (blob) {
      if (!blob) {
        showError("Your browser couldn't encode that image. Try a JPG or PNG file.");
        return;
      }
      render(blob, w, h);
    });
  }

  function render(blob, w, h) {
    var file = state.file;
    revokeUrls();
    state.origUrl = URL.createObjectURL(file);
    state.outUrl = URL.createObjectURL(blob);

    var delta = file.size - blob.size;
    var pct = file.size > 0 ? Math.round((delta / file.size) * 100) : 0;
    var grew = delta <= 0;
    var upscaled = w > state.origW || h > state.origH;

    var headline = grew
      ? (pct < 0 ? "+" + Math.abs(pct) + "%" : "Same size")
      : "\u2212" + pct + "%";

    var sub = state.origW + "\u00D7" + state.origH + " \u2192 " + w + "\u00D7" + h + " px \u00B7 " +
      bytes(file.size) + " \u2192 " + bytes(blob.size);

    var note = upscaled
      ? '<p class="field-note" style="margin-top:10px;">This enlarges the image beyond its original size — the result may look slightly softer, since new detail cannot be invented.</p>'
      : "";

    var outName = baseName(file.name) + "-" + w + "x" + h + "." + extOf(file.type);

    resultEl.innerHTML =
      '<div class="compare">' +
        "<figure>" +
          '<img class="compare__img" src="' + state.origUrl + '" alt="Original image preview">' +
          "<figcaption><span>Original</span><span class=\"size-pill\">" + esc(bytes(file.size)) + "</span></figcaption>" +
        "</figure>" +
        "<figure>" +
          '<img class="compare__img" src="' + state.outUrl + '" alt="Resized image preview">' +
          "<figcaption><span>Resized</span><span class=\"size-pill\">" + esc(bytes(blob.size)) + "</span></figcaption>" +
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
        '<a class="btn btn--primary" id="rs-download" href="' + state.outUrl + '" download="' + esc(outName) + '">' +
          "Download image" +
        "</a>" +
        '<button class="btn btn--ghost" type="button" id="rs-again">Choose another</button>' +
      "</div>";

    window.JivoraUI.track("tool_action", {
      tool: "image-resizer",
      action: "resize",
      width: w,
      height: h
    });
  }

  function extOf(type) {
    if (type === "image/png") return "png";
    if (type === "image/webp") return "webp";
    return "jpg";
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

    closeSource();
    loadSource(file).then(function (src) {
      state.file = file;
      state.src = src;
      state.origW = src.width;
      state.origH = src.height;
      setDims(src.width, src.height);
      resultEl.innerHTML = EMPTY_HTML;
      widthInput.focus();
    })["catch"](function () {
      showError("We couldn't read that image — it may be damaged or in an unsupported format.");
    });
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

  widthInput.addEventListener("input", function () {
    widthInput.removeAttribute("aria-invalid");
    hideError();
    if (!lockChk.checked || !state.origW) return;
    var w = readDim(widthInput);
    if (w) heightInput.value = String(Math.max(1, Math.round(w * (state.origH / state.origW))));
  });

  heightInput.addEventListener("input", function () {
    heightInput.removeAttribute("aria-invalid");
    hideError();
    if (!lockChk.checked || !state.origH) return;
    var h = readDim(heightInput);
    if (h) widthInput.value = String(Math.max(1, Math.round(h * (state.origW / state.origH))));
  });

  origBtn.addEventListener("click", function () {
    if (!state.origW) return;
    setDims(state.origW, state.origH);
    hideError();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    resize();
  });

  resultEl.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest("#rs-download")) {
      window.JivoraUI.track("tool_action", { tool: "image-resizer", action: "download" });
      return;
    }
    if (t.closest("#rs-again")) {
      closeSource();
      state.file = null;
      state.origW = 0;
      state.origH = 0;
      revokeUrls();
      fileInput.value = "";
      widthInput.value = "";
      heightInput.value = "";
      hideError();
      resultEl.innerHTML = EMPTY_HTML;
      dropzone.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
})();
