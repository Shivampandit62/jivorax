/*
 * Stopwatch — Jivora
 * Elapsed time is derived from timestamps (performance.now when available),
 * so a throttled background tab never loses a hundredth of a second.
 */
(function () {
  "use strict";

  var form = document.getElementById("sw-form");
  if (!form) return;

  var toggleBtn = document.getElementById("sw-toggle");
  var lapBtn = document.getElementById("sw-lap");
  var resetBtn = document.getElementById("sw-reset");
  var timeEl = document.getElementById("sw-time");
  var lapCountEl = document.getElementById("sw-lapcount");
  var bestEl = document.getElementById("sw-best");
  var worstEl = document.getElementById("sw-worst");
  var lapsEl = document.getElementById("sw-laps");
  var statusEl = document.getElementById("sw-status");

  var baseTitle = document.title;
  var clock = window.performance && window.performance.now
    ? function () { return window.performance.now(); }
    : function () { return Date.now(); };

  var state = "idle"; /* idle | running | paused */
  var accumulated = 0;
  var startedAt = 0;
  var lastLapAt = 0;
  var laps = [];
  var tick = null;
  var frame = 0;

  /* ---------- formatting ---------- */

  function fmt(ms) {
    var total = Math.max(0, ms);
    var cs = Math.floor(total / 10) % 100;
    var s = Math.floor(total / 1000) % 60;
    var m = Math.floor(total / 60000) % 60;
    var h = Math.floor(total / 3600000);
    var out = (m < 10 ? "0" : "") + m + ":" +
      (s < 10 ? "0" : "") + s + "." +
      (cs < 10 ? "0" : "") + cs;
    return h > 0 ? h + ":" + out : out;
  }

  /* short form for lap gaps: 05.12 instead of 00:05.12 */
  function fmtGap(ms) {
    var out = fmt(ms);
    if (out.indexOf("00:") === 0) out = out.slice(3);
    return out;
  }

  function elapsed() {
    if (state === "running") return accumulated + (clock() - startedAt);
    return accumulated;
  }

  /* ---------- painting ---------- */

  function paint() {
    var t = elapsed();
    timeEl.textContent = fmt(t);
    frame++;
    if (frame % 4 === 0) {
      document.title = state === "running" ? fmt(t) + " — " + baseTitle : baseTitle;
    }
  }

  function paintStats() {
    lapCountEl.textContent = String(laps.length);
    if (!laps.length) {
      bestEl.textContent = "—";
      worstEl.textContent = "—";
      return;
    }
    var best = laps[0].split;
    var worst = laps[0].split;
    for (var i = 1; i < laps.length; i++) {
      if (laps[i].split < best) best = laps[i].split;
      if (laps[i].split > worst) worst = laps[i].split;
    }
    bestEl.textContent = fmt(best);
    worstEl.textContent = fmt(worst);
  }

  function paintLaps() {
    lapsEl.innerHTML = "";
    for (var i = laps.length - 1; i >= 0; i--) {
      var row = document.createElement("div");
      row.className = "result-row";
      row.innerHTML =
        '<span class="result-row__k">Lap ' + laps[i].n + "</span>" +
        '<span class="result-row__v">' + fmt(laps[i].total) + " (+" + fmtGap(laps[i].split) + ")</span>";
      lapsEl.appendChild(row);
    }
    lapsEl.style.display = laps.length ? "" : "none";
  }

  function say(html) {
    statusEl.innerHTML = html;
  }

  function runningStatus() {
    say('<span class="is-ok">Running</span><span>' + laps.length +
      " lap" + (laps.length === 1 ? "" : "s") + " recorded</span>");
  }

  /* ---------- controls ---------- */

  function start() {
    if (state !== "paused") accumulated = 0;
    startedAt = clock();
    state = "running";
    toggleBtn.textContent = "Pause";
    lapBtn.disabled = false;
    window.clearInterval(tick);
    tick = window.setInterval(paint, 50);
    paint();
    runningStatus();
    window.JivoraUI.track("tool_action", { tool: "stopwatch", action: "start" });
  }

  function pause() {
    accumulated = elapsed();
    state = "paused";
    window.clearInterval(tick);
    tick = null;
    toggleBtn.textContent = "Resume";
    lapBtn.disabled = true;
    paint();
    say("<span>Paused at " + fmt(accumulated) + "</span>");
    window.JivoraUI.track("tool_action", { tool: "stopwatch", action: "pause" });
  }

  function lap() {
    if (state !== "running") return;
    var t = elapsed();
    laps.push({
      n: laps.length + 1,
      total: t,
      split: t - lastLapAt
    });
    lastLapAt = t;
    paintLaps();
    paintStats();
    runningStatus();
    window.JivoraUI.track("tool_action", { tool: "stopwatch", action: "lap" });
  }

  function reset() {
    window.clearInterval(tick);
    tick = null;
    state = "idle";
    accumulated = 0;
    startedAt = 0;
    lastLapAt = 0;
    laps = [];
    frame = 0;
    toggleBtn.textContent = "Start";
    lapBtn.disabled = true;
    document.title = baseTitle;
    paint();
    paintLaps();
    paintStats();
    say("Press Start to begin — Lap records a split.");
    window.JivoraUI.track("tool_action", { tool: "stopwatch", action: "reset" });
  }

  /* ---------- events ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state === "running") pause();
    else start();
  });

  lapBtn.addEventListener("click", lap);
  resetBtn.addEventListener("click", reset);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && state === "running") paint();
  });

  /* first paint */
  paint();
  paintLaps();
  paintStats();
})();
