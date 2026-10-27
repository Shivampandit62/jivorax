/*
 * Countdown Timer — Jivora
 * Timestamp-based countdown so background-tab throttling can't lose time,
 * with a progress bar, an end-time readout and a chime at zero.
 */
(function () {
  "use strict";

  var form = document.getElementById("ct-form");
  if (!form) return;

  var minutesInput = document.getElementById("ct-minutes");
  var secondsInput = document.getElementById("ct-seconds");
  var startBtn = document.getElementById("ct-start");
  var resetBtn = document.getElementById("ct-reset");
  var errorEl = document.getElementById("ct-error");
  var errorText = errorEl.querySelector("span");
  var timeEl = document.getElementById("ct-time");
  var statusEl = document.getElementById("ct-status");
  var barEl = document.getElementById("ct-bar");
  var durationEl = document.getElementById("ct-duration");
  var endsEl = document.getElementById("ct-ends");
  var doneEl = document.getElementById("ct-done");

  var baseTitle = document.title;
  var state = "idle"; /* idle | running | paused */
  var endAt = 0;
  var remainingMs = 0;
  var totalMs = 0;
  var tick = null;
  var completed = 0;
  var lastEndLabel = "";

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
    window.clearTimeout(errorEl._timer);
    errorEl._timer = window.setTimeout(function () {
      errorEl.classList.remove("is-shown");
    }, 4000);
  }

  function hideError() {
    errorEl.classList.remove("is-shown");
    minutesInput.removeAttribute("aria-invalid");
    secondsInput.removeAttribute("aria-invalid");
  }

  function readFields() {
    var m = parseInt(minutesInput.value, 10);
    var s = parseInt(secondsInput.value, 10);
    return { m: isFinite(m) ? m : 0, s: isFinite(s) ? s : 0 };
  }

  /* clamped total used for the live display and for reset */
  function totalSeconds() {
    var f = readFields();
    var m = Math.max(0, Math.min(600, f.m));
    var s = Math.max(0, Math.min(59, f.s));
    return m * 60 + s;
  }

  /* strict check run before a countdown may start */
  function validDuration() {
    var f = readFields();
    if (f.m < 0 || f.m > 600) return { ok: false, field: minutesInput };
    if (f.s < 0 || f.s > 59) return { ok: false, field: secondsInput };
    var secs = f.m * 60 + f.s;
    if (secs < 1) return { ok: false, field: minutesInput };
    if (secs > 36000) return { ok: false, field: secondsInput };
    return { ok: true, secs: secs };
  }

  function fmt(ms) {
    var total = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor(total / 60) % 60;
    var s = total % 60;
    var mm = (m < 10 ? "0" : "") + m;
    var ss = (s < 10 ? "0" : "") + s;
    return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
  }

  function paint(ms) {
    timeEl.textContent = fmt(ms);
    var pct = totalMs > 0 ? (1 - ms / totalMs) * 100 : 0;
    barEl.style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + "%";
    if (state === "running") {
      document.title = fmt(ms) + " — " + baseTitle;
    } else {
      document.title = baseTitle;
    }
  }

  function paintDurations() {
    durationEl.textContent = fmt(totalMs);
    endsEl.textContent = lastEndLabel || "—";
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
    doneEl.textContent = String(completed);
    startBtn.textContent = "Start";
    statusEl.textContent = "Time's up! That's " + completed + " timer" + (completed === 1 ? "" : "s") + " completed.";
    paint(0);
    chime();
    window.JivoraUI.track("tool_action", { tool: "countdown-timer", action: "complete" });
  }

  function loop() {
    var left = remaining();
    paint(left);
    if (left <= 0) finish();
  }

  function start() {
    var check = validDuration();
    if (!check.ok) {
      showError("Set a duration between 1 second and 10 hours (600 minutes).");
      check.field.setAttribute("aria-invalid", "true");
      check.field.focus();
      return;
    }
    hideError();

    if (state === "paused" && remainingMs > 0) {
      endAt = Date.now() + remainingMs;
    } else if (state === "idle") {
      totalMs = check.secs * 1000;
      endAt = Date.now() + totalMs;
      lastEndLabel = "";
      try {
        lastEndLabel = new Date(endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch (e) {
        lastEndLabel = "";
      }
      paintDurations();
    }

    state = "running";
    startBtn.textContent = "Pause";
    statusEl.textContent = "Counting down — switch tabs and it stays accurate.";
    window.clearInterval(tick);
    tick = window.setInterval(loop, 200);
    loop();
    window.JivoraUI.track("tool_action", { tool: "countdown-timer", action: "start" });
  }

  function pause() {
    remainingMs = remaining();
    state = "paused";
    window.clearInterval(tick);
    tick = null;
    startBtn.textContent = "Resume";
    statusEl.textContent = "Paused — " + fmt(remainingMs) + " left.";
    paint(remainingMs);
    window.JivoraUI.track("tool_action", { tool: "countdown-timer", action: "pause" });
  }

  function reset() {
    window.clearInterval(tick);
    tick = null;
    state = "idle";
    var secs = totalSeconds();
    totalMs = secs * 1000;
    remainingMs = totalMs;
    lastEndLabel = "";
    startBtn.textContent = "Start";
    statusEl.textContent = "Set a duration and press Start.";
    hideError();
    paintDurations();
    paint(totalMs);
  }

  /* ---------- events ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state === "running") pause();
    else start();
  });

  resetBtn.addEventListener("click", reset);

  function fieldChanged() {
    hideError();
    if (state === "idle") reset();
  }

  minutesInput.addEventListener("input", fieldChanged);
  secondsInput.addEventListener("input", fieldChanged);

  var presets = form.querySelectorAll("[data-min]");
  for (var i = 0; i < presets.length; i++) {
    presets[i].addEventListener("click", function (e) {
      minutesInput.value = e.currentTarget.getAttribute("data-min");
      secondsInput.value = "0";
      if (state !== "running") reset();
      hideError();
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && state === "running") loop();
  });

  /* first paint */
  reset();
})();
