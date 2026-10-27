/*
 * QR Code Generator — Jivora
 * Self-contained QR encoder following ISO/IEC 18004:
 * byte mode, error-correction level M, versions 1–10.
 * No dependencies, no network calls — everything happens in your browser.
 */
(function () {
  "use strict";

  /* =========================================================
     1. GF(256) arithmetic (primitive polynomial 0x11D)
     ========================================================= */

  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);

  (function initGf() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  /* =========================================================
     2. Version tables — error-correction level M
     ========================================================= */

  var VERSIONS = [null,
    { data: 16,  ec: 10, g1: 1, d1: 16, g2: 0, d2: 0 },
    { data: 28,  ec: 16, g1: 1, d1: 28, g2: 0, d2: 0 },
    { data: 44,  ec: 26, g1: 1, d1: 44, g2: 0, d2: 0 },
    { data: 64,  ec: 18, g1: 2, d1: 32, g2: 0, d2: 0 },
    { data: 86,  ec: 24, g1: 2, d1: 43, g2: 0, d2: 0 },
    { data: 108, ec: 16, g1: 4, d1: 27, g2: 0, d2: 0 },
    { data: 124, ec: 18, g1: 4, d1: 31, g2: 0, d2: 0 },
    { data: 154, ec: 22, g1: 2, d1: 38, g2: 2, d2: 39 },
    { data: 182, ec: 22, g1: 3, d1: 36, g2: 2, d2: 37 },
    { data: 216, ec: 26, g1: 4, d1: 43, g2: 1, d2: 44 }
  ];

  /* alignment-pattern centre coordinates per version (index 0 and 1 = none) */
  var ALIGN = [
    [], [], [6, 18], [6, 22], [6, 26], [6, 30],
    [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
  ];

  /* =========================================================
     3. Reed–Solomon encoder
     ========================================================= */

  function rsGenerator(degree) {
    var poly = [1];
    for (var i = 0; i < degree; i++) {
      var next = [];
      for (var z = 0; z < poly.length + 1; z++) next.push(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly; /* leading coefficient first, length = degree + 1 */
  }

  function rsEncode(data, ecLen) {
    var gen = rsGenerator(ecLen);
    var rem = [];
    var i;
    for (i = 0; i < ecLen; i++) rem.push(0);

    for (i = 0; i < data.length; i++) {
      var factor = data[i] ^ rem[0];
      rem.shift();
      rem.push(0);
      if (factor !== 0) {
        for (var j = 0; j < ecLen; j++) rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
    return rem;
  }

  /* =========================================================
     4. Encoding
     ========================================================= */

  function utf8Bytes(str) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
    var bin = unescape(encodeURIComponent(str));
    var arr = [];
    for (var i = 0; i < bin.length; i++) arr.push(bin.charCodeAt(i) & 0xff);
    return arr;
  }

  function encode(text) {
    var bytes = utf8Bytes(text);
    if (!bytes.length) throw new Error("empty");

    /* choose the smallest version that fits */
    var version = 0;
    for (var v = 1; v <= 10; v++) {
      var countBits = v <= 9 ? 8 : 16;
      var needed = 4 + countBits + bytes.length * 8;
      if (needed <= VERSIONS[v].data * 8) { version = v; break; }
    }
    if (!version) throw new Error("too-long");

    var info = VERSIONS[version];
    var bits = [];

    function push(val, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    }

    push(4, 4);                                   /* byte mode */
    push(bytes.length, version <= 9 ? 8 : 16);    /* character count */
    for (var b = 0; b < bytes.length; b++) push(bytes[b], 8);

    var capBits = info.data * 8;
    var term = Math.min(4, capBits - bits.length);
    for (var t = 0; t < term; t++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    var data = [];
    var i;
    for (i = 0; i < bits.length; i += 8) {
      var byteVal = 0;
      for (var k = 0; k < 8; k++) byteVal = (byteVal << 1) | bits[i + k];
      data.push(byteVal);
    }
    var toggle = true;
    while (data.length < info.data) {
      data.push(toggle ? 0xec : 0x11);
      toggle = !toggle;
    }

    /* split into blocks, compute EC, interleave */
    var blocks = [];
    var idx = 0;
    function addBlocks(count, size) {
      for (var c = 0; c < count; c++) {
        blocks.push(data.slice(idx, idx + size));
        idx += size;
      }
    }
    addBlocks(info.g1, info.d1);
    if (info.g2) addBlocks(info.g2, info.d2);

    var ecBlocks = [];
    for (var bl = 0; bl < blocks.length; bl++) ecBlocks.push(rsEncode(blocks[bl], info.ec));

    var out = [];
    var maxLen = info.d2 > info.d1 ? info.d2 : info.d1;
    var li, bi;
    for (li = 0; li < maxLen; li++) {
      for (bi = 0; bi < blocks.length; bi++) {
        if (li < blocks[bi].length) out.push(blocks[bi][li]);
      }
    }
    for (li = 0; li < info.ec; li++) {
      for (bi = 0; bi < ecBlocks.length; bi++) out.push(ecBlocks[bi][li]);
    }

    return buildMatrix(version, out);
  }

  /* =========================================================
     5. Matrix construction
     ========================================================= */

  function buildMatrix(version, codewords) {
    var size = version * 4 + 17;
    var modules = [];
    var isFn = [];
    var x, y, i;

    for (y = 0; y < size; y++) {
      modules.push(new Uint8Array(size));
      isFn.push(new Uint8Array(size));
    }

    function setFn(cx, cy, dark) {
      if (cx < 0 || cy < 0 || cx >= size || cy >= size) return;
      isFn[cy][cx] = 1;
      modules[cy][cx] = dark ? 1 : 0;
    }

    function markFn(cx, cy) {
      if (cx < 0 || cy < 0 || cx >= size || cy >= size) return;
      isFn[cy][cx] = 1;
    }

    /* finder patterns with separators */
    function drawFinder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var dist = Math.max(Math.abs(dx), Math.abs(dy));
          setFn(cx + dx, cy + dy, dist !== 2 && dist !== 4);
        }
      }
    }
    drawFinder(3, 3);
    drawFinder(size - 4, 3);
    drawFinder(3, size - 4);

    /* timing patterns */
    for (i = 8; i <= size - 9; i++) {
      setFn(i, 6, i % 2 === 0);
      setFn(6, i, i % 2 === 0);
    }

    /* alignment patterns */
    var centers = ALIGN[version] || [];
    var lastCenter = size - 7;
    for (var a = 0; a < centers.length; a++) {
      for (var b2 = 0; b2 < centers.length; b2++) {
        var ax = centers[a];
        var ay = centers[b2];
        if ((ax === 6 && ay === 6) || (ax === 6 && ay === lastCenter) || (ax === lastCenter && ay === 6)) continue;
        for (var dy2 = -2; dy2 <= 2; dy2++) {
          for (var dx2 = -2; dx2 <= 2; dx2++) {
            setFn(ax + dx2, ay + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
          }
        }
      }
    }

    /* reserve format-info areas */
    for (i = 0; i <= 8; i++) { markFn(8, i); markFn(i, 8); }
    for (i = 0; i < 8; i++) markFn(size - 1 - i, 8);
    for (i = 0; i < 7; i++) markFn(8, size - 1 - i);
    markFn(8, size - 8); /* dark module */

    /* version information (v7+) */
    if (version >= 7) {
      var vBits = versionBits(version);
      for (i = 0; i < 18; i++) {
        var vb = (vBits >>> i) & 1;
        var col = size - 11 + (i % 3);
        var row = Math.floor(i / 3);
        setFn(col, row, vb);
        setFn(row, col, vb);
      }
    }

    /* place codewords in the zig-zag order */
    var bitIndex = 0;
    var totalBits = codewords.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var px = right - j;
          var upward = ((right + 1) & 2) === 0;
          var py = upward ? size - 1 - vert : vert;
          if (!isFn[py][px] && bitIndex < totalBits) {
            modules[py][px] = (codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1;
            bitIndex++;
          }
        }
      }
    }

    /* choose the mask with the lowest penalty */
    function applyMask(mask) {
      for (var my = 0; my < size; my++) {
        for (var mx = 0; mx < size; mx++) {
          if (isFn[my][mx]) continue;
          var invert;
          switch (mask) {
            case 0: invert = (mx + my) % 2 === 0; break;
            case 1: invert = my % 2 === 0; break;
            case 2: invert = mx % 3 === 0; break;
            case 3: invert = (mx + my) % 3 === 0; break;
            case 4: invert = (Math.floor(mx / 3) + Math.floor(my / 2)) % 2 === 0; break;
            case 5: invert = ((mx * my) % 2 + (mx * my) % 3) === 0; break;
            case 6: invert = ((mx * my) % 2 + (mx * my) % 3) % 2 === 0; break;
            default: invert = ((mx + my) % 2 + (mx * my) % 3) % 2 === 0; break;
          }
          if (invert) modules[my][mx] ^= 1;
        }
      }
    }

    function drawFormat(mask) {
      var dataBits = (0 << 3) | mask; /* ECL M = 0b00 */
      var rem = dataBits;
      for (var f = 0; f < 10; f++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((dataBits << 10) | rem) ^ 0x5412;
      function bit(k) { return (bits >>> k) & 1; }

      /* first copy */
      for (var q = 0; q <= 5; q++) setFn(8, q, bit(q));
      setFn(8, 7, bit(6));
      setFn(8, 8, bit(7));
      setFn(7, 8, bit(8));
      for (q = 9; q < 15; q++) setFn(14 - q, 8, bit(q));

      /* second copy */
      for (q = 0; q < 8; q++) setFn(size - 1 - q, 8, bit(q));
      for (q = 8; q < 15; q++) setFn(8, size - 15 + q, bit(q));

      setFn(8, size - 8, 1); /* always dark */
    }

    function penalty() {
      var score = 0;
      var px2, py2;

      /* rule 1 — runs of five or more */
      for (py2 = 0; py2 < size; py2++) {
        var rc = modules[py2][0];
        var run = 1;
        for (px2 = 1; px2 < size; px2++) {
          if (modules[py2][px2] === rc) {
            run++;
            if (run === 5) score += 3;
            else if (run > 5) score += 1;
          } else { rc = modules[py2][px2]; run = 1; }
        }
      }
      for (px2 = 0; px2 < size; px2++) {
        var rc2 = modules[0][px2];
        var run2 = 1;
        for (py2 = 1; py2 < size; py2++) {
          if (modules[py2][px2] === rc2) {
            run2++;
            if (run2 === 5) score += 3;
            else if (run2 > 5) score += 1;
          } else { rc2 = modules[py2][px2]; run2 = 1; }
        }
      }

      /* rule 2 — 2×2 blocks of the same colour */
      for (py2 = 0; py2 < size - 1; py2++) {
        for (px2 = 0; px2 < size - 1; px2++) {
          var c = modules[py2][px2];
          if (c === modules[py2][px2 + 1] && c === modules[py2 + 1][px2] && c === modules[py2 + 1][px2 + 1]) {
            score += 3;
          }
        }
      }

      /* rule 3 — finder-like 1:1:3:1:1 patterns with a 4-module light margin */
      var P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
      var P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      function scan(getter, start) {
        var ok1 = true;
        var ok2 = true;
        for (var k = 0; k < 11; k++) {
          var val = getter(start + k);
          if (val !== P1[k]) ok1 = false;
          if (val !== P2[k]) ok2 = false;
          if (!ok1 && !ok2) return 0;
        }
        return (ok1 ? 40 : 0) + (ok2 ? 40 : 0);
      }
      for (py2 = 0; py2 < size; py2++) {
        (function (rowIdx) {
          for (var sx = 0; sx + 11 <= size; sx++) {
            score += scan(function (idx) { return modules[rowIdx][idx]; }, sx);
          }
        })(py2);
      }
      for (px2 = 0; px2 < size; px2++) {
        (function (colIdx) {
          for (var sy = 0; sy + 11 <= size; sy++) {
            score += scan(function (idx) { return modules[idx][colIdx]; }, sy);
          }
        })(px2);
      }

      /* rule 4 — proportion of dark modules */
      var dark = 0;
      for (py2 = 0; py2 < size; py2++) {
        for (px2 = 0; px2 < size; px2++) dark += modules[py2][px2];
      }
      var percent = (dark * 100) / (size * size);
      score += Math.floor(Math.abs(percent - 50) / 5) * 10;

      return score;
    }

    var bestMask = 0;
    var bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      applyMask(m);
      drawFormat(m);
      var sc = penalty();
      if (sc < bestScore) { bestScore = sc; bestMask = m; }
      applyMask(m); /* undo — XOR is its own inverse */
    }
    applyMask(bestMask);
    drawFormat(bestMask);

    return { size: size, modules: modules, version: version, mask: bestMask };
  }

  function versionBits(version) {
    var rem = version;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    return ((version << 12) | rem) & 0x3ffff;
  }

  /* =========================================================
     6. Canvas rendering
     ========================================================= */

  function render(qr, canvas) {
    var quiet = 4;
    var total = qr.size + quiet * 2;
    var cell = Math.max(4, Math.floor(560 / total));
    canvas.width = total * cell;
    canvas.height = total * cell;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0b1020";
    for (var y = 0; y < qr.size; y++) {
      for (var x = 0; x < qr.size; x++) {
        if (qr.modules[y][x]) {
          ctx.fillRect((x + quiet) * cell, (y + quiet) * cell, cell, cell);
        }
      }
    }
  }

  /* =========================================================
     7. UI wiring
     ========================================================= */

  var form = document.getElementById("qr-form");
  if (!form) return;

  var input = document.getElementById("qr-input");
  var canvas = document.getElementById("qr-canvas");
  var card = document.getElementById("qr-card");
  var errorEl = document.getElementById("qr-error");
  var errorText = errorEl.querySelector("span");
  var typeLabel = document.getElementById("qr-type-label");
  var downloadBtn = document.getElementById("qr-download");
  var currentQR = null;
  var type = "text";
  var timer = null;

  var PLACEHOLDERS = {
    text: "Anything you want to encode — a note, a code, a message…",
    url: "e.g. https://your-site.com",
    phone: "e.g. +91 98765 43210",
    email: "e.g. hello@example.com"
  };
  var LABELS = {
    text: "plain text",
    url: "web link",
    phone: "dials on scan",
    email: "opens email"
  };

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
  }

  function hideError() {
    errorEl.classList.remove("is-shown");
  }

  function buildValue(raw) {
    var v = String(raw || "").replace(/^\s+|\s+$/g, "");
    if (!v) throw new Error("Enter something to generate a QR code.");

    if (type === "url") {
      if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = "https://" + v;
      return v;
    }
    if (type === "phone") {
      v = v.replace(/^tel:/i, "");
      var digits = v.replace(/[\s()\-.]/g, "");
      if (!digits) throw new Error("Enter a phone number to encode.");
      return "tel:" + digits;
    }
    if (type === "email") {
      var cleaned = v.replace(/\s+/g, "").replace(/^mailto:/i, "");
      if (cleaned.indexOf("@") === -1 || cleaned.indexOf(".") === -1) {
        throw new Error("That doesn't look like an email address — it needs an @ and a domain.");
      }
      return "mailto:" + cleaned;
    }
    return v;
  }

  function generate() {
    var value;
    try {
      value = buildValue(input.value);
    } catch (err) {
      currentQR = null;
      card.hidden = true;
      showError(err.message);
      return;
    }

    var qr;
    try {
      qr = encode(value);
    } catch (err2) {
      currentQR = null;
      card.hidden = true;
      if (err2 && err2.message === "too-long") {
        showError("That's too much content for one QR code — try up to about 210 characters (fewer if you're using emoji).");
      } else {
        showError("Couldn't build that QR code. Please try shorter or simpler content.");
      }
      return;
    }

    currentQR = qr;
    render(qr, canvas);
    card.hidden = false;
    hideError();
  }

  function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(generate, 140);
  }

  /* content type buttons */
  var typeButtons = form.querySelectorAll(".seg__btn");
  for (var t = 0; t < typeButtons.length; t++) {
    typeButtons[t].addEventListener("click", function (e) {
      var btn = e.currentTarget;
      type = btn.getAttribute("data-type");
      for (var i = 0; i < typeButtons.length; i++) {
        var on = typeButtons[i] === btn;
        typeButtons[i].classList.toggle("is-on", on);
        typeButtons[i].setAttribute("aria-pressed", on ? "true" : "false");
      }
      input.setAttribute("placeholder", PLACEHOLDERS[type] || "");
      typeLabel.textContent = LABELS[type] || "";
      generate();
    });
  }

  input.addEventListener("input", schedule);

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      type = "text";
      var buttons = form.querySelectorAll(".seg__btn");
      for (var i = 0; i < buttons.length; i++) {
        var on = buttons[i].getAttribute("data-type") === "text";
        buttons[i].classList.toggle("is-on", on);
        buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
      }
      input.setAttribute("placeholder", PLACEHOLDERS.text);
      typeLabel.textContent = LABELS.text;
      generate();
    }, 0);
  });

  downloadBtn.addEventListener("click", function () {
    if (!currentQR) {
      generate();
      if (!currentQR) return;
    }
    try {
      var url = canvas.toDataURL("image/png");
      var link = document.createElement("a");
      link.href = url;
      link.download = "jivora-qr.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.JivoraUI.flashButton(downloadBtn, "&#10003; Downloaded!");
      if (window.JivoraAnalytics) {
        window.JivoraAnalytics.track("tool_download", { tool: "qr-code-generator", format: "png" });
      }
    } catch (e) {
      showError("Your browser blocked the download — try right-clicking the code and choosing “Save image as…”.");
    }
  });

  /* first render */
  generate();
})();
