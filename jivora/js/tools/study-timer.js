/*
 * Study Timer — Jivora
 * Timestamp-based countdown so background-tab throttling can't lose time.
 */
(function () {
  "use strict";

  var form = document.getElementById("st-form");
  if (!form) return;

  var minutesInput = document.getElementById("st-minutes");
  var startBtn = document.getElementById("st-start");
  var resetBtn = document.getElementById("st-reset");
  var errorEl = document.getElementById("st-error");
  var errorText = errorEl.querySelector("span");
  var timeEl = document.getElementById("st-time");
  var statusEl = document.getElementById("st-status");
  var barEl = document.getElementById("st-bar");
  var doneEl = document.getElementById("st-done");
  var totalEl = document.getElementById("st-total");

  var baseTitle = document.title;
  var state = "idle"; /* idle | running | paused */
  var endAt = 0;
  var remainingMs = 0;
  var totalMs = 0;
  var tick = null;
  var completed = 0;
  var focusedMinutes = 0;

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
    window.clearTimeout(errorEl._timer);
    errorEl._timer = window.setTimeout(function () {
      errorEl.classList.remove("is-shown");
    }, 3600);
  }

  function fmt(ms) {
    var total = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function paint(ms) {
    timeEl.textContent = fmt(ms);
    var pct = totalMs > 0 ? (1 - ms / totalMs) * 100 : 0;
    barEl.style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + "%";
    document.title = state === "running" ? fmt(ms) + " — " + baseTitle : baseTitle;
  }

  function chime() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1);
      window.setTimeout(function () { try { ctx.close(); } catch (e) {} }, 1400);
    } catch (e) { /* audio is a nicety, never a blocker */ }
  }

  function remaining() {
    if (state === "running") return Math.max(0, endAt - Date.now());
    return remainingMs;
  }

  function finish() {
    window.clearInterval(tick);
    tick = null;
    state = "idle";
    remainingMs = 0;
    completed++;
    focusedMinutes += Math.round(totalMs / 60000);
    doneEl.textContent = String(completed);
    totalEl.textContent = focusedMinutes + " min";
    startBtn.textContent = "Start";
    statusEl.textContent = "Time's up! Session complete 🎉";
    paint(0);
    chime();
    window.JivoraUI.track("tool_action", { tool: "study-timer", action: "complete" });
  }

  function loop() {
    var left = remaining();
    paint(left);
    if (left <= 0) finish();
  }

  function start() {
    var mins = parseInt(minutesInput.value, 10);
    if (!isFinite(mins) || mins < 1 || mins > 180) {
      showError("Set a focus length between 1 and 180 minutes.");
      minutesInput.setAttribute("aria-invalid", "true");
      minutesInput.focus();
      return;
    }
    minutesInput.removeAttribute("aria-invalid");
    errorEl.classList.remove("is-shown");

    if (state === "paused" && remainingMs > 0) {
      endAt = Date.now() + remainingMs;
    } else if (state === "idle") {
      totalMs = mins * 60000;
      endAt = Date.now() + totalMs;
    }

    state = "running";
    startBtn.textContent = "Pause";
    statusEl.textContent = "Focusing — stay with it";
    window.clearInterval(tick);
    tick = window.setInterval(loop, 250);
    loop();
    window.JivoraUI.track("tool_action", { tool: "study-timer", action: "start" });
  }

  function pause() {
    remainingMs = remaining();
    state = "paused";
    window.clearInterval(tick);
    tick = null;
    startBtn.textContent = "Resume";
    statusEl.textContent = "Paused";
    paint(remainingMs);
  }

  function reset() {
    window.clearInterval(tick);
    tick = null;
    state = "idle";
    var mins = parseInt(minutesInput.value, 10);
    if (!isFinite(mins) || mins < 1 || mins > 180) mins = 25;
    totalMs = mins * 60000;
    remainingMs = totalMs;
    startBtn.textContent = "Start";
    statusEl.textContent = "Ready when you are";
    paint(totalMs);
  }

  /* ---------- events ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state === "running") pause();
    else start();
  });

  resetBtn.addEventListener("click", reset);

  minutesInput.addEventListener("input", function () {
    errorEl.classList.remove("is-shown");
    minutesInput.removeAttribute("aria-invalid");
    if (state === "idle") reset();
  });

  var presets = form.querySelectorAll("[data-preset]");
  for (var i = 0; i < presets.length; i++) {
    presets[i].addEventListener("click", function (e) {
      minutesInput.value = e.currentTarget.getAttribute("data-preset");
      if (state !== "running") reset();
      errorEl.classList.remove("is-shown");
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && state === "running") loop();
  });

  /* first paint */
  reset();
})();
