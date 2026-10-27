/*
 * Image to PDF — Jivora
 * Assembles a PDF document from images entirely in the browser.
 * JPGs are embedded byte-for-byte (DCTDecode, no re-encode); PNG/WebP
 * are rasterised on a canvas and stored as FlateDecode RGB streams.
 * The PDF structure (objects, xref, trailer) is written by hand.
 */
(function () {
  "use strict";

  var MAX_BYTES = 20 * 1024 * 1024;
  var MAX_FILES = 20;
  var OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

  var dropzone = document.getElementById("i2p-dropzone");
  var fileInput = document.getElementById("i2p-file");
  var form = document.getElementById("i2p-form");
  var listEl = document.getElementById("i2p-list");
  var modeSel = document.getElementById("i2p-mode");
  var maxSel = document.getElementById("i2p-max");
  var clearBtn = document.getElementById("i2p-clear");
  var errorEl = document.getElementById("i2p-error");
  var errorText = errorEl.querySelector("span");
  var resultEl = document.getElementById("i2p-result");

  if (!dropzone || !form) return;

  var EMPTY_HTML =
    '<p class="result__empty">Choose one or more images above — your PDF download will appear here.</p>';

  var state = { files: [], outUrl: null };
  var working = false;

  /* ---------- small helpers ---------- */

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

  function revokeOut() {
    if (state.outUrl) { URL.revokeObjectURL(state.outUrl); state.outUrl = null; }
  }

  function readBytes(file) {
    if (file.arrayBuffer) {
      return file.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    }
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(new Uint8Array(fr.result)); };
      fr.onerror = function () { reject(new Error("read")); };
      fr.readAsArrayBuffer(file);
    });
  }

  /* ---------- image sources ---------- */

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

  /* minimal JPEG marker scan: size + component count (1=gray, 3=RGB, 4=CMYK) */
  function jpegInfo(u8) {
    if (u8.length < 12 || u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
    var i = 2;
    while (i + 9 < u8.length) {
      if (u8[i] !== 0xFF) { i++; continue; }
      var marker = u8[i + 1];
      if (marker === 0xFF || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
        i += 2;
        continue;
      }
      if (marker === 0xD9 || marker === 0xDA) break; /* EOI or scan — SOF must come first */
      var len = (u8[i + 2] << 8) | u8[i + 3];
      var isSOF = marker >= 0xC0 && marker <= 0xCF &&
                  marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
      if (isSOF) {
        var comps = u8[i + 9];
        var h = ((u8[i + 5] << 8) | u8[i + 6]);
        var w = ((u8[i + 7] << 8) | u8[i + 8]);
        return { w: w, h: h, comps: comps };
      }
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }

  function deflate(u8) {
    if (typeof window.CompressionStream !== "function") return Promise.resolve(null);
    try {
      var stream = new Blob([u8]).stream().pipeThrough(new window.CompressionStream("deflate"));
      return new Response(stream).arrayBuffer().then(function (ab) {
        return new Uint8Array(ab);
      })["catch"](function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function rasterize(file) {
    var max = parseInt(maxSel.value, 10) || 0;
    return loadSource(file).then(function (src) {
      var w = src.width;
      var h = src.height;
      if (max && (w > max || h > max)) {
        var s = max / Math.max(w, h);
        w = Math.max(1, Math.round(w * s));
        h = Math.max(1, Math.round(h * s));
      }

      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      /* flatten transparency onto white so it prints correctly */
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(src.img, 0, 0, w, h);
      if (src.url) URL.revokeObjectURL(src.url);
      if (src.img.close) src.img.close();

      var src4 = ctx.getImageData(0, 0, w, h).data;
      var rgb = new Uint8Array(w * h * 3);
      for (var i = 0, j = 0; i < src4.length; i += 4) {
        rgb[j++] = src4[i];
        rgb[j++] = src4[i + 1];
        rgb[j++] = src4[i + 2];
      }

      return deflate(rgb).then(function (z) {
        return {
          kind: "rgb",
          data: z || rgb,
          compressed: !!z,
          w: w,
          h: h,
          cs: "/DeviceRGB"
        };
      });
    });
  }

  function prepare(file) {
    if (file.type === "image/jpeg") {
      return readBytes(file).then(function (u8) {
        var info = jpegInfo(u8);
        if (info && info.w > 0 && info.h > 0 &&
            (info.comps === 1 || info.comps === 3 || info.comps === 4)) {
          return {
            kind: "jpeg",
            data: u8,
            compressed: false,
            w: info.w,
            h: info.h,
            cs: info.comps === 1 ? "/DeviceGray" : (info.comps === 3 ? "/DeviceRGB" : "/DeviceCMYK")
          };
        }
        /* unusual JPEG (bad markers / odd component count): rasterise instead */
        return rasterize(file);
      });
    }
    return rasterize(file);
  }

  /* ---------- PDF writer ---------- */

  function geomFor(p, mode) {
    if (mode === "natural") {
      return { pw: p.w, ph: p.h, cm: n(p.w) + " 0 0 " + n(p.h) + " 0 0" };
    }
    var landscape = p.w >= p.h;
    var pw = landscape ? 841.89 : 595.28;
    var ph = landscape ? 595.28 : 841.89;
    var s = Math.min(pw / p.w, ph / p.h);
    var tx = (pw - p.w * s) / 2;
    var ty = (ph - p.h * s) / 2;
    return { pw: pw, ph: ph, cm: n(s) + " 0 0 " + n(s) + " " + n(tx) + " " + n(ty) };
  }

  function n(x) {
    return String(Math.round(x * 100000) / 100000);
  }

  function pad10(x) {
    var s = String(x);
    while (s.length < 10) s = "0" + s;
    return s;
  }

  function buildPdf(pages, mode) {
    var enc = new TextEncoder();
    var parts = [];
    var pos = 0;
    var offsets = [];

    function push(bytes) { parts.push(bytes); pos += bytes.length; }
    function pushStr(s) { var b = enc.encode(s); parts.push(b); pos += b.length; }

    pushStr("%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n");

    var count = pages.length;
    var kids = [];
    for (var i = 0; i < count; i++) kids.push((3 + i * 3) + " 0 R");

    offsets[1] = pos;
    pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    offsets[2] = pos;
    pushStr("2 0 obj\n<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + count + " >>\nendobj\n");

    for (var p = 0; p < count; p++) {
      var page = pages[p];
      var pageNum = 3 + p * 3;
      var contentNum = pageNum + 1;
      var imgNum = pageNum + 2;
      var geom = geomFor(page, mode);

      var content = "q\n" + geom.cm + " cm\n/Im0 Do\nQ\n";
      var contentBytes = enc.encode(content);

      offsets[pageNum] = pos;
      pushStr(pageNum + " 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
        n(geom.pw) + " " + n(geom.ph) +
        "] /Resources << /XObject << /Im0 " + imgNum + " 0 R >> >> /Contents " +
        contentNum + " 0 R >>\nendobj\n");

      offsets[contentNum] = pos;
      pushStr(contentNum + " 0 obj\n<< /Length " + contentBytes.length + " >>\nstream\n");
      push(contentBytes);
      pushStr("endstream\nendobj\n");

      var filter = page.compressed ? " /Filter /FlateDecode"
        : (page.kind === "jpeg" ? " /Filter /DCTDecode" : "");

      offsets[imgNum] = pos;
      pushStr(imgNum + " 0 obj\n<< /Type /XObject /Subtype /Image /Width " +
        page.w + " /Height " + page.h + " /ColorSpace " + page.cs +
        " /BitsPerComponent 8" + filter + " /Length " + page.data.length +
        " >>\nstream\n");
      push(page.data);
      pushStr("\nendstream\nendobj\n");
    }

    var xrefPos = pos;
    var total = 2 + count * 3;
    pushStr("xref\n0 " + (total + 1) + "\n0000000000 65535 f \n");
    for (var o = 1; o <= total; o++) {
      pushStr(pad10(offsets[o]) + " 00000 n \n");
    }
    pushStr("trailer\n<< /Size " + (total + 1) + " /Root 1 0 R >>\nstartxref\n" +
      xrefPos + "\n%%EOF\n");

    var out = new Uint8Array(pos);
    var off = 0;
    for (var k = 0; k < parts.length; k++) {
      out.set(parts[k], off);
      off += parts[k].length;
    }
    return out;
  }

  /* ---------- file list ---------- */

  function renderList() {
    if (!state.files.length) {
      listEl.innerHTML = "";
      listEl.hidden = true;
      return;
    }
    var html = "";
    for (var i = 0; i < state.files.length; i++) {
      var f = state.files[i];
      html +=
        '<div class="result-row">' +
          '<span class="result-row__k">' + esc(f.name) + "</span>" +
          '<span class="result-row__v">' + esc(bytes(f.size)) + "</span>" +
        "</div>";
    }
    listEl.innerHTML = html;
    listEl.hidden = false;
  }

  function handleFiles(fileList) {
    var all = [];
    for (var i = 0; i < fileList.length; i++) all.push(fileList[i]);

    var accepted = [];
    var rejectedType = 0;
    var rejectedSize = 0;

    for (var j = 0; j < all.length && accepted.length < MAX_FILES; j++) {
      var f = all[j];
      if (OK_TYPES.indexOf(f.type) === -1) { rejectedType++; continue; }
      if (f.size > MAX_BYTES) { rejectedSize++; continue; }
      accepted.push(f);
    }
    var overflow = all.length - rejectedType - rejectedSize - accepted.length;

    state.files = accepted;
    renderList();
    revokeOut();
    resultEl.innerHTML = EMPTY_HTML;

    if (rejectedType) {
      showError("Skipped " + rejectedType + " file" + (rejectedType === 1 ? "" : "s") +
        " that " + (rejectedType === 1 ? "is" : "are") + " not a JPG, PNG or WebP image.");
      return;
    }
    if (rejectedSize) {
      showError("Skipped " + rejectedSize + " file" + (rejectedSize === 1 ? "" : "s") +
        " larger than 20 MB.");
      return;
    }
    if (overflow > 0) {
      showError("Only the first " + MAX_FILES + " images were kept — that's the per-document limit.");
      return;
    }
    hideError();
  }

  /* ---------- build ---------- */

  function createPdf() {
    if (working) return;
    if (!state.files.length) {
      showError("Choose at least one image first.");
      dropzone.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }
    hideError();
    revokeOut();
    working = true;

    var files = state.files.slice();
    var mode = modeSel.value;
    var pages = [];
    var chain = Promise.resolve();

    files.forEach(function (f, idx) {
      chain = chain.then(function () {
        resultEl.innerHTML = '<p class="result__empty">Building PDF… page ' +
          (idx + 1) + " of " + files.length + "</p>";
        return prepare(f);
      }).then(function (page) {
        pages.push(page);
      });
    });

    chain.then(function () {
      var pdfBytes = buildPdf(pages, mode);
      var blob = new Blob([pdfBytes], { type: "application/pdf" });
      working = false;
      renderResult(blob, files, mode);
    })["catch"](function () {
      working = false;
      resultEl.innerHTML = EMPTY_HTML;
      showError("Something went wrong building the PDF — try fewer or smaller images.");
    });
  }

  function renderResult(blob, files, mode) {
    state.outUrl = URL.createObjectURL(blob);

    var totalIn = 0;
    for (var i = 0; i < files.length; i++) totalIn += files[i].size;

    var outName = files.length === 1
      ? baseName(files[0].name) + ".pdf"
      : "jivora-images.pdf";

    var modeLabel = mode === "a4" ? "A4 pages" : "original size";

    resultEl.innerHTML =
      '<div class="savings">' +
        "<div>" +
          '<p class="savings__big">' + esc(bytes(blob.size)) + "</p>" +
          '<p class="savings__sub">' + files.length + " page" + (files.length === 1 ? "" : "s") +
            " \u00B7 " + modeLabel + " \u00B7 " + bytes(totalIn) + " of images \u2192 " +
            bytes(blob.size) + " PDF</p>" +
        "</div>" +
      "</div>" +
      '<div class="actions">' +
        '<a class="btn btn--primary" id="i2p-download" href="' + state.outUrl +
          '" download="' + esc(outName) + '">Download PDF</a>' +
        '<button class="btn btn--ghost" type="button" id="i2p-again">Choose other images</button>' +
      "</div>";

    window.JivoraUI.track("tool_action", {
      tool: "image-to-pdf",
      action: "create",
      pages: files.length
    });
  }

  /* ---------- events ---------- */

  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files.length) handleFiles(fileInput.files);
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
    if (dt && dt.files && dt.files.length) handleFiles(dt.files);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    createPdf();
  });

  clearBtn.addEventListener("click", function () {
    state.files = [];
    fileInput.value = "";
    renderList();
    revokeOut();
    hideError();
    resultEl.innerHTML = EMPTY_HTML;
    dropzone.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  resultEl.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest("#i2p-download")) {
      window.JivoraUI.track("tool_action", { tool: "image-to-pdf", action: "download" });
      return;
    }
    if (t.closest("#i2p-again")) {
      state.files = [];
      fileInput.value = "";
      renderList();
      revokeOut();
      hideError();
      resultEl.innerHTML = EMPTY_HTML;
      dropzone.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
})();
