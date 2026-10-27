/*
 * Pomodoro Timer — Jivora
 * Automatic focus / short break / long break cycling with a chime.
 */
(function () {
  "use strict";

  var form = document.getElementById("pt-form");
  if (!form) return;

  var focusInput = document.getElementById("pt-focus");
  var shortInput = document.getElementById("pt-short");
  var longInput = document.getElementById("pt-long");
  var startBtn = document.getElementById("pt-start");
  var skipBtn = document.getElementById("pt-skip");
  var resetBtn = document.getElementById("pt-reset");
  var errorEl = document.getElementById("pt-error");
  var errorText = errorEl.querySelector("span");
  var timeEl = document.getElementById("pt-time");
  var statusEl = document.getElementById("pt-status");
  var barEl = document.getElementById("pt-bar");
  var phaseEl = document.getElementById("pt-phase");
  var doneEl = document.getElementById("pt-done");
  var totalEl = document.getElementById("pt-total");

  var baseTitle = document.title;
  var phase = "focus"; /* focus | short | long */
  var state = "idle"; /* idle | running | paused */
  var endAt = 0;
  var remainingMs = 0;
  var totalMs = 0;
  var tick = null;
  var round = 1; /* which focus round is next: 1..4 */
  var focusDone = 0;
  var focusedMs = 0;

  var PHASE_NAME = { focus: "Focus", short: "Short break", long: "Long break" };

  function showError(msg) {
    errorText.textContent = msg;
    errorEl.classList.add("is-shown");
    window.clearTimeout(errorEl._timer);
    errorEl._timer = window.setTimeout(function () {
      errorEl.classList.remove("is-shown");
    }, 3600);
  }

  function lengthOf(which) {
    var el = which === "focus" ? focusInput : which === "short" ? shortInput : longInput;
    var v = parseInt(el.value, 10);
    if (!isFinite(v) || v < 1 || v > 180) return null;
    return v;
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
    document.title = state === "running" ? fmt(ms) + " · " + PHASE_NAME[phase] + " — " + baseTitle : baseTitle;
  }

  function chime() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = phase === "focus" ? 660 : 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1);
      window.setTimeout(function () { try { ctx.close(); } catch (e) {} }, 1400);
    } catch (e) { /* ignore */ }
  }

  function syncLabels() {
    statusEl.textContent = PHASE_NAME[phase] + " · round " + round + " of 4";
    phaseEl.textContent = PHASE_NAME[phase];
    doneEl.textContent = String(focusDone);
    totalEl.textContent = Math.round(focusedMs / 60000) + " min";
  }

  function beginPhase(which) {
    phase = which;
    var mins = lengthOf(which);
    if (mins === null) {
      stop();
      showError("Focus, short break and long break must each be 1–180 minutes.");
      return false;
    }
    totalMs = mins * 60000;
    remainingMs = totalMs;
    endAt = Date.now() + totalMs;
    syncLabels();
    paint(totalMs);
    return true;
  }

  function stop() {
    window.clearInterval(tick);
    tick = null;
    state = "idle";
    startBtn.textContent = "Start";
  }

  function nextPhase(countAsDone) {
    var endedPhase = phase;
    if (endedPhase === "focus") {
      if (countAsDone) {
        focusDone++;
        focusedMs += totalMs;
      }
      round = (focusDone % 4) + 1;
      chime();
      return beginPhase(focusDone > 0 && focusDone % 4 === 0 ? "long" : "short");
    }
    chime();
    return beginPhase("focus");
  }

  function loop() {
    if (state !== "running") return;
    var left = Math.max(0, endAt - Date.now());
    paint(left);
    if (left <= 0) {
      var ok = nextPhase(true);
      if (!ok) return;
    }
  }

  function start() {
    errorEl.classList.remove("is-shown");
    if (state === "paused") {
      endAt = Date.now() + remainingMs;
    } else if (state === "idle") {
      if (!beginPhase("focus")) return;
    }
    state = "running";
    startBtn.textContent = "Pause";
    window.clearInterval(tick);
    tick = window.setInterval(loop, 250);
    loop();
    window.JivoraUI.track("tool_action", { tool: "pomodoro-timer", action: "start" });
  }

  function pause() {
    remainingMs = Math.max(0, endAt - Date.now());
    state = "paused";
    window.clearInterval(tick);
    tick = null;
    startBtn.textContent = "Resume";
    paint(remainingMs);
  }

  function reset() {
    stop();
    phase = "focus";
    round = 1;
    focusDone = 0;
    focusedMs = 0;
    var mins = lengthOf("focus") || 25;
    totalMs = mins * 60000;
    remainingMs = totalMs;
    errorEl.classList.remove("is-shown");
    syncLabels();
    statusEl.textContent = "Focus · round 1 of 4";
    paint(totalMs);
  }

  /* ---------- events ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state === "running") pause();
    else start();
  });

  skipBtn.addEventListener("click", function () {
    if (state === "idle") return;
    var ok = nextPhase(state === "running");
    if (ok && state === "running") {
      endAt = Date.now() + totalMs;
      remainingMs = totalMs;
      paint(totalMs);
    } else if (ok && state === "paused") {
      remainingMs = totalMs;
      paint(totalMs);
    }
  });

  resetBtn.addEventListener("click", reset);

  var durInputs = [focusInput, shortInput, longInput];
  for (var i = 0; i < durInputs.length; i++) {
    durInputs[i].addEventListener("input", function () {
      errorEl.classList.remove("is-shown");
      if (state === "idle") reset();
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && state === "running") loop();
  });

  reset();
})();
