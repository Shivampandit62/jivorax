/*
 * Image Cropper — Jivora
 * Coordinate-based cropping with ratio presets and a live preview
 * drawn straight from the loaded source canvas. All client-side.
 */
(function () {
  "use strict";

  var MAX_BYTES = 20 * 1024 * 1024;
  var OK_TYPES = ["image/jpeg", "image/png", "image/webp"];
  var RATIO = { "1:1": 1, "4:5": 4 / 5, "16:9": 16 / 9, "3:2": 3 / 2 };

  var dropzone = document.getElementById("cr-dropzone");
  var fileInput = document.getElementById("cr-file");
  var form = document.getElementById("cr-form");
  var presetSel = document.getElementById("cr-preset");
  var wInput = document.getElementById("cr-w");
  var hInput = document.getElementById("cr-h");
  var xInput = document.getElementById("cr-x");
  var yInput = document.getElementById("cr-y");
  var resetBtn = document.getElementById("cr-reset");
  var errorEl = document.getElementById("cr-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("cr-result");

  if (!dropzone || !form) return;

  var EMPTY_HTML =
    '<p class="result__empty">Choose an image above — a live crop preview will appear here.</p>';

  var state = {
    file: null,
    canvas: null,      /* full-size source drawn once */
    W: 0,
    H: 0,
    outUrl: null,
    cropped: null      /* last cropped blob */
  };
  var previewCtx = null;
  var capEl = null;
  var posEl = null;
  var bigEl = null;
  var subEl = null;
  var actionsEl = null;
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

  function baseName(name) {
    var i = name.lastIndexOf(".");
    return i > 0 ? name.slice(0, i) : name;
  }

  function extOf(type) {
    if (type === "image/png") return "png";
    if (type === "image/webp") return "webp";
    return "jpg";
  }

  function revokeOut() {
    if (state.outUrl) { URL.revokeObjectURL(state.outUrl); state.outUrl = null; }
  }

  /* ---------- rectangle handling ---------- */

  function readInt(input, fallback) {
    var v = parseInt(input.value, 10);
    return isFinite(v) ? v : fallback;
  }

  function rect() {
    var w = Math.min(Math.max(1, readInt(wInput, state.W)), state.W);
    var h = Math.min(Math.max(1, readInt(hInput, state.H)), state.H);
    var x = Math.min(Math.max(0, readInt(xInput, 0)), state.W - w);
    var y = Math.min(Math.max(0, readInt(yInput, 0)), state.H - h);
    return { x: x, y: y, w: w, h: h };
  }

  function applyRect(r) {
    xInput.value = String(r.x);
    yInput.value = String(r.y);
    wInput.value = String(r.w);
    hInput.value = String(r.h);
  }

  function presetRatio() {
    var p = presetSel.value;
    return p === "free" ? 0 : RATIO[p];
  }

  /* ---------- preview ---------- */

  function updatePreview() {
    if (!state.canvas || !previewCtx) return;

    var r = rect();
    applyRect(r);

    var preview = previewCtx.canvas;
    if (preview.width !== r.w || preview.height !== r.h) {
      preview.width = r.w;
      preview.height = r.h;
    }
    previewCtx.drawImage(state.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);

    if (capEl) capEl.textContent = r.w + " \u00D7 " + r.h + " px";
    if (posEl) posEl.textContent = "x " + r.x + " \u00B7 y " + r.y;
    if (bigEl) bigEl.textContent = r.w + " \u00D7 " + r.h;
    if (subEl) {
      var extra = state.cropped ? " \u00B7 cropped " + bytes(state.cropped.size) : "";
      subEl.textContent = "Original " + state.W + " \u00D7 " + state.H +
        " \u00B7 " + bytes(state.file.size) + extra;
    }
  }

  /* ---------- result shell ---------- */

  function renderShell() {
    resultEl.innerHTML =
      '<div class="compare" style="grid-template-columns: 1fr;">' +
        "<figure>" +
          '<canvas id="cr-preview" style="width: 100%; height: auto; display: block;"></canvas>' +
          '<figcaption><span id="cr-cap">\u2014</span><span class="size-pill" id="cr-pos">x 0 \u00B7 y 0</span></figcaption>' +
        "</figure>" +
      "</div>" +
      '<div class="savings">' +
        "<div>" +
          '<p class="savings__big" id="cr-big">\u2014</p>' +
          '<p class="savings__sub" id="cr-sub"></p>' +
        "</div>" +
      "</div>" +
      '<div class="actions" id="cr-actions"></div>';

    previewCtx = document.getElementById("cr-preview").getContext("2d");
    previewCtx.imageSmoothingQuality = "high";
    capEl = document.getElementById("cr-cap");
    posEl = document.getElementById("cr-pos");
    bigEl = document.getElementById("cr-big");
    subEl = document.getElementById("cr-sub");
    actionsEl = document.getElementById("cr-actions");
    state.cropped = null;
    revokeOut();
  }

  /* ---------- cropping ---------- */

  function crop() {
    if (!state.canvas) return;
    hideError();

    var myJob = ++job;
    var r = rect();

    var out = document.createElement("canvas");
    out.width = r.w;
    out.height = r.h;
    var ctx = out.getContext("2d");
    if (!ctx) {
      showError("Your browser couldn't create a canvas for cropping.");
      return;
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(state.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);

    var type = state.file.type;
    var quality = type === "image/png" ? 1 : 0.92;

    new Promise(function (resolve) {
      try {
        out.toBlob(function (blob) {
          resolve(blob && blob.type === type ? blob : null);
        }, type, quality);
      } catch (e) {
        resolve(null);
      }
    }).then(function (blob) {
      if (myJob !== job) return;
      if (!blob) {
        showError("Your browser couldn't encode that image. Try a JPG or PNG file.");
        return;
      }
      revokeOut();
      state.cropped = blob;
      state.outUrl = URL.createObjectURL(blob);

      var outName = baseName(state.file.name) + "-cropped." + extOf(type);
      actionsEl.innerHTML =
        '<a class="btn btn--primary" id="cr-download" href="' + state.outUrl + '" download="' + esc(outName) + '">' +
          "Download cropped image" +
        "</a>" +
        '<button class="btn btn--ghost" type="button" id="cr-again">Choose another</button>';

      updatePreview();
      window.JivoraUI.track("tool_action", {
        tool: "image-cropper",
        action: "crop",
        width: r.w,
        height: r.h
      });
    });
  }

  /* ---------- file loading ---------- */

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

    var myJob = ++job;
    resultEl.innerHTML = '<p class="result__empty">Loading image…</p>';

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
      ctx.drawImage(src.img, 0, 0, src.width, src.height);
      if (src.url) URL.revokeObjectURL(src.url);
      if (src.img.close) src.img.close();

      state.file = file;
      state.canvas = canvas;
      state.W = src.width;
      state.H = src.height;
      presetSel.value = "free";

      renderShell();
      applyRect({ x: 0, y: 0, w: src.width, h: src.height });
      updatePreview();
    })["catch"](function () {
      if (myJob !== job) return;
      resultEl.innerHTML = EMPTY_HTML;
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

  presetSel.addEventListener("change", function () {
    var ratio = presetRatio();
    if (ratio && state.W) {
      var r = rect();
      var nh = Math.max(1, Math.round(r.w / ratio));
      if (nh > state.H) {
        nh = state.H;
        wInput.value = String(Math.max(1, Math.round(state.H * ratio)));
      }
      hInput.value = String(nh);
    }
    state.cropped = null;
    if (actionsEl) actionsEl.innerHTML = "";
    hideError();
    updatePreview();
  });

  wInput.addEventListener("input", function () {
    var ratio = presetRatio();
    var w = readInt(wInput, 0);
    if (ratio && w > 0) hInput.value = String(Math.max(1, Math.round(w / ratio)));
    state.cropped = null;
    if (actionsEl) actionsEl.innerHTML = "";
    hideError();
    updatePreview();
  });

  hInput.addEventListener("input", function () {
    var ratio = presetRatio();
    var h = readInt(hInput, 0);
    if (ratio && h > 0) wInput.value = String(Math.max(1, Math.round(h * ratio)));
    state.cropped = null;
    if (actionsEl) actionsEl.innerHTML = "";
    hideError();
    updatePreview();
  });

  xInput.addEventListener("input", function () {
    state.cropped = null;
    if (actionsEl) actionsEl.innerHTML = "";
    updatePreview();
  });

  yInput.addEventListener("input", function () {
    state.cropped = null;
    if (actionsEl) actionsEl.innerHTML = "";
    updatePreview();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!state.canvas) {
      showError("Choose an image first.");
      return;
    }
    crop();
  });

  resetBtn.addEventListener("click", function () {
    if (!state.W) return;
    presetSel.value = "free";
    state.cropped = null;
    applyRect({ x: 0, y: 0, w: state.W, h: state.H });
    if (actionsEl) actionsEl.innerHTML = "";
    hideError();
    updatePreview();
  });

  resultEl.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest("#cr-download")) {
      window.JivoraUI.track("tool_action", { tool: "image-cropper", action: "download" });
      return;
    }
    if (t.closest("#cr-again")) {
      state.file = null;
      state.canvas = null;
      state.W = 0;
      state.H = 0;
      revokeOut();
      fileInput.value = "";
      hideError();
      job++;
      resultEl.innerHTML = EMPTY_HTML;
      dropzone.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
})();
