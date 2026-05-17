import {registerSW} from "virtual:pwa-register";

const Audio = (() => {
  let ctx;
  const debugSounds = {
    1: {type: "square", attack: 0.02, release: 0.05, freq: 500},
    2: {type: "triangle", attack: 0.02, release: 0.05, freq: 500},
    3: {type: "sine", attack: 0.02, release: 0.05, freq: 500},
    4: {type: "sawtooth", attack: 0.02, release: 0.05, freq: 500},
    5: {type: "triangle", attack: 0.08, release: 0.12, freq: 500},
    6: {type: "sine", attack: 0.08, release: 0.12, freq: 500},
    7: {type: "triangle", attack: 0.005, release: 0.2, freq: 600},
    8: {type: "sine", attack: 0.15, release: 0.2, freq: 600},
  };

  function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function beep(freq = 880, dur = 0.7, options = {}, delay = 0) {
    const c = ensure();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = options.type ?? "square";
    o.frequency.value = freq;
    const now = c.currentTime + delay;
    const attack = Math.min(options.attack ?? 0.02, dur * 0.5);
    const release = Math.min(options.release ?? 0.05, Math.max(0.01, dur * 0.8));
    const releaseStart = Math.max(now + attack, now + dur - release);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(1, now + attack);
    g.gain.setValueAtTime(1, releaseStart);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(c.destination);
    o.start(now);
    o.stop(now + dur + 0.02);
    return {oscillator: o, endTime: now + dur + 0.02};
  }

  function debugBeep(id, dur = 0.7, delay = 0) {
    const sound = debugSounds[id];
    if (!sound) return;
    return beep(sound.freq, dur, sound, delay);
  }

  function presetBeep(id, dur = 0.7, delay = 0) {
    return debugBeep(String(id), dur, delay);
  }

  function cancelBeep(scheduledBeep) {
    const c = ensure();
    if (scheduledBeep.endTime > c.currentTime) scheduledBeep.oscillator.stop(c.currentTime);
  }

  return {beep, debugBeep, presetBeep, cancelBeep};
})();

const holdInput = document.getElementById("holdSec");
const restInput = document.getElementById("restSec");
const repsInput = document.getElementById("reps");
const btnToggle = document.getElementById("btnToggle");
const dialHold = document.getElementById("dialHold");
const dialRest = document.getElementById("dialRest");
const dialReps = document.getElementById("dialReps");
const backgroundFlash = document.getElementById("backgroundFlash");
const updateBanner = document.getElementById("updateBanner");
const savedTimerList = document.getElementById("savedTimerList");
const btnSaveTimer = document.getElementById("btnSaveTimer");
const btnShare = document.getElementById("btnShare");
const UPDATED_BANNER_FLAG = "phased_timer_updated";
const stepButtons = [
  {button: document.getElementById("holdDown"), input: holdInput, delta: -1},
  {button: document.getElementById("holdUp"), input: holdInput, delta: 1},
  {button: document.getElementById("restDown"), input: restInput, delta: -1},
  {button: document.getElementById("restUp"), input: restInput, delta: 1},
  {button: document.getElementById("repsDown"), input: repsInput, delta: -1},
  {button: document.getElementById("repsUp"), input: repsInput, delta: 1},
];

let running = false;
let phase = "idle";
let switchDeadline = null;
let pendingTimeout = null;
let count = 0;
let holdSeconds = Number(holdInput.value);
let restSeconds = Number(restInput.value);
let repsTarget = Number(repsInput.value);
let preStartTimers = [];
let preStartBeeps = [];
let animationFrame = null;
let savedTimers = [];

function showUpdateBanner(text, className = "") {
  updateBanner.textContent = text;
  updateBanner.className = `update-banner ${className}`.trim();
  updateBanner.hidden = false;
}

function hideUpdateBanner() {
  updateBanner.hidden = true;
}

function sec(v) {
  return Math.max(1, Math.floor(Number(v) || 1));
}

function saveDurations() {
  holdSeconds = sec(holdInput.value);
  restSeconds = sec(restInput.value);
  repsTarget = getReps();
  saveCurrentDurations();
  renderSavedTimers();
}

function saveCurrentDurations() {
  localStorage.setItem("chime_hold", holdSeconds);
  localStorage.setItem("chime_rest", restSeconds);
  localStorage.setItem("chime_reps", repsTarget);
}

function loadDurations() {
  // TODO: Remove the chime_on/chime_off fallback after deployed clients have had time to migrate.
  const hold = parseInt(localStorage.getItem("chime_hold") ?? localStorage.getItem("chime_on"), 10);
  const rest = parseInt(localStorage.getItem("chime_rest") ?? localStorage.getItem("chime_off"), 10);
  const reps = parseInt(localStorage.getItem("chime_reps"), 10);
  if (!isNaN(hold)) holdInput.value = hold;
  if (!isNaN(rest)) restInput.value = rest;
  if (!isNaN(reps)) repsInput.value = Math.max(1, reps);
  return !isNaN(hold) || !isNaN(rest) || !isNaN(reps);
}

function getReps() {
  return Math.max(1, Math.floor(Number(repsInput.value) || 5));
}

function timerKey(timer) {
  return `${timer.hold} · ${timer.rest} · ${timer.reps}`;
}

function currentTimer() {
  return {
    hold: sec(holdInput.value),
    rest: sec(restInput.value),
    reps: getReps(),
  };
}

function saveSavedTimers() {
  localStorage.setItem("chime_saved_timers", JSON.stringify(savedTimers));
}

function saveTimerIfMissing(timer) {
  const key = timerKey(timer);
  if (savedTimers.some(savedTimer => timerKey(savedTimer) === key)) return false;
  savedTimers.push(timer);
  saveSavedTimers();
  return true;
}

function loadSavedTimers() {
  const savedTimersJson = localStorage.getItem("chime_saved_timers");
  savedTimers = JSON.parse(savedTimersJson || "[]");
  return savedTimersJson != null;
}

function matchingSavedTimerIndex() {
  const key = timerKey(currentTimer());
  return savedTimers.findIndex(timer => timerKey(timer) === key);
}

function queryTimer() {
  const params = new URLSearchParams(window.location.search);
  const timer = {};
  const hold = parseInt(params.get("hold"), 10);
  const rest = parseInt(params.get("rest"), 10);
  const reps = parseInt(params.get("reps"), 10);
  if (!isNaN(hold) && hold > 0) timer.hold = hold;
  if (!isNaN(rest) && rest > 0) timer.rest = rest;
  if (!isNaN(reps) && reps > 0) timer.reps = reps;
  return Object.keys(timer).length === 0 ? null : timer;
}

function applyQueryTimer(hadStoredDuration) {
  const timer = queryTimer();
  if (!timer) return false;

  const previousTimer = currentTimer();
  if (timer.hold != null) holdInput.value = timer.hold;
  if (timer.rest != null) restInput.value = timer.rest;
  if (timer.reps != null) repsInput.value = timer.reps;

  const nextTimer = currentTimer();
  if (hadStoredDuration && timerKey(previousTimer) !== timerKey(nextTimer)) {
    saveTimerIfMissing(previousTimer);
  }
  saveTimerIfMissing(nextTimer);
  window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  return true;
}

function shareUrl() {
  const url = new URL(window.location.href);
  const timer = currentTimer();
  url.search = "";
  url.searchParams.set("hold", timer.hold);
  url.searchParams.set("rest", timer.rest);
  url.searchParams.set("reps", timer.reps);
  return url.toString();
}

function renderShareIcon() {
  const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
  btnShare.innerHTML = isApple
      ? `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 15V3"/>
          <path d="m7 8 5-5 5 5"/>
          <path d="M7 11H5v10h14V11h-2"/>
        </svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <path d="m8.6 10.6 6.8-4.2"/>
          <path d="m8.6 13.4 6.8 4.2"/>
        </svg>`;
}

function renderSavedTimers() {
  const selectedIndex = matchingSavedTimerIndex();
  btnSaveTimer.textContent = selectedIndex === -1 ? "Save" : "Unsave";
  savedTimerList.textContent = "";

  for (let i = 0; i < savedTimers.length; i++) {
    const timer = savedTimers[i];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "saved-timer-pill";
    button.textContent = timerKey(timer);
    button.classList.toggle("selected", i === selectedIndex);
    button.addEventListener("click", () => {
      holdInput.value = timer.hold;
      restInput.value = timer.rest;
      repsInput.value = timer.reps;
      saveDurations();
      updateDialVisuals();
    });
    savedTimerList.append(button);
  }
}

function syncToggleButton() {
  btnToggle.textContent = running ? "Stop" : "Start";
  btnToggle.classList.toggle("start", !running);
  btnToggle.classList.toggle("stop", running);
  document.body.classList.toggle("timer-running", running);
}

function setDialProgress(el, progress) {
  el.style.setProperty("--progress", progress);
}

function flashBackground(color) {
  backgroundFlash.style.setProperty("--flash-color", color);
  backgroundFlash.classList.remove("flash");
  void backgroundFlash.offsetWidth;
  backgroundFlash.classList.add("flash");
}

function updateDialVisuals() {
  if (!running) {
    setDialProgress(dialHold, 1);
    setDialProgress(dialRest, 1);
    setDialProgress(dialReps, 1);
    holdInput.value = holdSeconds;
    restInput.value = restSeconds;
    repsInput.value = repsTarget;
    return;
  }

  if (phase === "idle" || switchDeadline == null) {
    setDialProgress(dialHold, 1);
    setDialProgress(dialRest, 1);
    setDialProgress(dialReps, 1);
    holdInput.value = holdSeconds;
    restInput.value = restSeconds;
    repsInput.value = repsTarget;
    return;
  }

  const holdDuration = holdSeconds * 1000;
  const restDuration = restSeconds * 1000;
  const left = Math.max(0, (switchDeadline ?? performance.now()) - performance.now());

  setDialProgress(dialHold, phase === "hold" ? left / holdDuration : 0);
  setDialProgress(dialRest, phase === "rest" ? left / restDuration : 1);
  const completedRounds = phase === "rest" ? count : Math.max(0, count - 1);
  setDialProgress(dialReps, Math.max(0, 1 - (completedRounds / repsTarget)));
  holdInput.value = phase === "hold" ? Math.ceil(left / 1000) : holdSeconds;
  restInput.value = phase === "rest" ? Math.ceil(left / 1000) : restSeconds;
  repsInput.value = repsTarget - completedRounds;
}

function animate() {
  updateDialVisuals();
  animationFrame = running ? requestAnimationFrame(animate) : null;
}

function startAnimation() {
  if (animationFrame != null) return;
  animationFrame = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (animationFrame == null) return;
  cancelAnimationFrame(animationFrame);
  animationFrame = null;
}

function setPhase(newPhase) {
  phase = newPhase;
  document.body.dataset.phase = phase;
  updateDialVisuals();
}

function handleDeadline() {
  if (!running) return;
  if (phase === "hold") {
    if (count >= repsTarget) {
      // Final rep completed: triple stop beep, then stop.
      flashBackground("var(--dial-reps)");
      tripleStopBeep();
      stop();
      return;
    } else {
      startRestPhase();
    }
  } else {
    Audio.presetBeep(7);
    startHoldPhase();
  }
}

function scheduleNext() {
  clearTimeout(pendingTimeout);
  const now = performance.now();
  const durMs = (phase === "hold" ? holdSeconds : restSeconds) * 1000;
  switchDeadline = now + durMs;
  pendingTimeout = setTimeout(handleDeadline, durMs);
}

function startHoldPhase() {
  setPhase("hold");
  flashBackground("var(--dial-hold)");
  count++;
  scheduleNext();
  updateDialVisuals();
}

function startRestPhase() {
  setPhase("rest");
  flashBackground("var(--dial-rest)");
  Audio.presetBeep(2);
  scheduleNext();
  updateDialVisuals();
}

function start() {
  if (running) return;
  running = true;
  count = 0;
  holdSeconds = sec(holdInput.value);
  restSeconds = sec(restInput.value);
  repsTarget = getReps();
  syncToggleButton();
  startAnimation();
  // Three short pre-start beeps 600ms apart; then actually start.
  clearPreStartTimers();
  const gap = 0.6; // seconds
  const short = 0.2; // seconds
  preStartBeeps.push(Audio.presetBeep(2, short));
  preStartBeeps.push(Audio.presetBeep(2, short, gap));
  preStartBeeps.push(Audio.presetBeep(2, short, gap * 2));
  preStartBeeps.push(Audio.presetBeep(7, 0.7, gap * 3));
  preStartTimers.push(setTimeout(() => {
    if (!running) return;
    preStartBeeps = [];
    clearPreStartTimers();
    startHoldPhase();
  }, gap * 3 * 1000));
}

function stop() {
  running = false;
  syncToggleButton();
  clearTimeout(pendingTimeout);
  pendingTimeout = null;
  clearPreStartTimers();
  stopAnimation();
  setPhase("idle");
  updateDialVisuals();
}

btnToggle.addEventListener("click", () => {
  if (running) stop();
  else start();
});

btnSaveTimer.addEventListener("click", () => {
  if (running) return;
  const selectedIndex = matchingSavedTimerIndex();
  if (selectedIndex === -1) {
    saveTimerIfMissing(currentTimer());
  } else {
    savedTimers.splice(selectedIndex, 1);
    saveSavedTimers();
  }
  renderSavedTimers();
});

btnShare.addEventListener("click", async () => {
  if (running) return;
  const url = shareUrl();
  if (navigator.share) {
    await navigator.share({
      title: "Phased Timer",
      url,
    });
  } else {
    await navigator.clipboard.writeText(url);
  }
});

if (localStorage.getItem(UPDATED_BANNER_FLAG) === "1") {
  localStorage.removeItem(UPDATED_BANNER_FLAG);
  showUpdateBanner("Updated to a new version", "downloaded");
  setTimeout(hideUpdateBanner, 2000);
}

registerSW({
  immediate: true,
  onRegisteredSW(_, registration) {
    if (!registration) return;
    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing || !navigator.serviceWorker.controller) return;
      showUpdateBanner("Downloading a new version");
      installing.addEventListener("statechange", () => {
        if (installing.state !== "installed") return;
        localStorage.setItem(UPDATED_BANNER_FLAG, "1");
      });
    });
  },
});

for (const {button, input, delta} of stepButtons) {
  button.addEventListener("click", () => {
    if (running) return;
    input.value = Math.max(1, sec(input.value) + delta);
    saveDurations();
    if (!running) updateDialVisuals();
  });
}

holdInput.addEventListener("input", () => {
  if (!running) saveDurations();
});
restInput.addEventListener("input", () => {
  if (!running) saveDurations();
});

repsInput.addEventListener("input", () => {
  if (!running) saveDurations();
});

document.addEventListener("visibilitychange", () => {
  if (!running || switchDeadline == null) return;
  const rem = Math.max(0, switchDeadline - performance.now());
  clearTimeout(pendingTimeout);
  pendingTimeout = setTimeout(handleDeadline, rem);
});

const hadStoredDuration = loadDurations();
loadSavedTimers();
const hadQueryTimer = applyQueryTimer(hadStoredDuration);
holdSeconds = sec(holdInput.value);
restSeconds = sec(restInput.value);
repsTarget = getReps();
if (hadStoredDuration || hadQueryTimer) saveCurrentDurations();
setPhase("idle");
updateDialVisuals();
syncToggleButton();
renderSavedTimers();
renderShareIcon();

function tripleStopBeep() {
  const gap = 0.8; // seconds between beeps
  Audio.presetBeep(2, 0.5);
  Audio.presetBeep(2, 0.5, gap);
  Audio.presetBeep(2, 0.5, gap * 2);
}

function clearPreStartTimers() {
  for (const t of preStartTimers) clearTimeout(t);
  for (const beep of preStartBeeps) {
    if (beep) Audio.cancelBeep(beep);
  }
  preStartTimers = [];
  preStartBeeps = [];
}
