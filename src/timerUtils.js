const DEFAULT_TIMER = {hold: 15, rest: 5, reps: 5};
const DEFAULT_COUNTDOWN = 3;

export function sec(v) {
  return Math.max(1, Math.floor(Number(v) || 1));
}

export function countdownSec(v) {
  return Math.max(0, Math.floor(Number(v) || 0));
}

export function normalizeTimer(timer) {
  return {
    hold: sec(timer.hold),
    rest: sec(timer.rest),
    reps: sec(timer.reps),
  };
}

export function timerKey(timer) {
  return `${timer.hold} · ${timer.rest} · ${timer.reps}`;
}

export function saveCurrentDurations(timer) {
  localStorage.setItem("chime_hold", timer.hold);
  localStorage.setItem("chime_rest", timer.rest);
  localStorage.setItem("chime_reps", timer.reps);
}

export function saveSavedTimers(savedTimers) {
  localStorage.setItem("chime_saved_timers", JSON.stringify(savedTimers));
}

export function saveCountdown(countdown) {
  localStorage.setItem("chime_countdown", countdown);
}

export function saveTimerIfMissing(savedTimers, timer) {
  const key = timerKey(timer);
  if (savedTimers.some(savedTimer => timerKey(savedTimer) === key)) return savedTimers;
  return [...savedTimers, timer];
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

export function loadInitialState() {
  // TODO: Remove the chime_on/chime_off fallback after deployed clients have had time to migrate.
  const storedHold = parseInt(localStorage.getItem("chime_hold") ?? localStorage.getItem("chime_on"), 10);
  const storedRest = parseInt(localStorage.getItem("chime_rest") ?? localStorage.getItem("chime_off"), 10);
  const storedReps = parseInt(localStorage.getItem("chime_reps"), 10);
  const storedCountdown = parseInt(localStorage.getItem("chime_countdown"), 10);
  const hadStoredDuration = !isNaN(storedHold) || !isNaN(storedRest) || !isNaN(storedReps);
  const storedTimer = normalizeTimer({
    hold: isNaN(storedHold) ? DEFAULT_TIMER.hold : storedHold,
    rest: isNaN(storedRest) ? DEFAULT_TIMER.rest : storedRest,
    reps: isNaN(storedReps) ? DEFAULT_TIMER.reps : storedReps,
  });
  const countdown = isNaN(storedCountdown) ? DEFAULT_COUNTDOWN : countdownSec(storedCountdown);

  let timer = storedTimer;
  let savedTimers = JSON.parse(localStorage.getItem("chime_saved_timers") || "[]");
  const timerFromQuery = queryTimer();
  if (timerFromQuery) {
    timer = normalizeTimer({...storedTimer, ...timerFromQuery});
    if (hadStoredDuration && timerKey(storedTimer) !== timerKey(timer)) {
      savedTimers = saveTimerIfMissing(savedTimers, storedTimer);
    }
    savedTimers = saveTimerIfMissing(savedTimers, timer);
    saveSavedTimers(savedTimers);
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }

  if (hadStoredDuration || timerFromQuery) saveCurrentDurations(timer);

  return {timer, savedTimers, countdown};
}

export function shareUrl(timer) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("hold", timer.hold);
  url.searchParams.set("rest", timer.rest);
  url.searchParams.set("reps", timer.reps);
  return url.toString();
}
