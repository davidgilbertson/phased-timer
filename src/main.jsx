import {useEffect, useMemo, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import {registerSW} from "virtual:pwa-register";
import "./style.css";

const UPDATED_BANNER_FLAG = "phased_timer_updated";
const LONG_PRESS_MS = 700;
const DEFAULT_TIMER = {hold: 15, rest: 5, reps: 5};

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

function sec(v) {
  return Math.max(1, Math.floor(Number(v) || 1));
}

function normalizeTimer(timer) {
  return {
    hold: sec(timer.hold),
    rest: sec(timer.rest),
    reps: sec(timer.reps),
  };
}

function timerKey(timer) {
  return `${timer.hold} · ${timer.rest} · ${timer.reps}`;
}

function saveCurrentDurations(timer) {
  localStorage.setItem("chime_hold", timer.hold);
  localStorage.setItem("chime_rest", timer.rest);
  localStorage.setItem("chime_reps", timer.reps);
}

function saveSavedTimers(savedTimers) {
  localStorage.setItem("chime_saved_timers", JSON.stringify(savedTimers));
}

function saveTimerIfMissing(savedTimers, timer) {
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

function loadInitialState() {
  // TODO: Remove the chime_on/chime_off fallback after deployed clients have had time to migrate.
  const storedHold = parseInt(localStorage.getItem("chime_hold") ?? localStorage.getItem("chime_on"), 10);
  const storedRest = parseInt(localStorage.getItem("chime_rest") ?? localStorage.getItem("chime_off"), 10);
  const storedReps = parseInt(localStorage.getItem("chime_reps"), 10);
  const hadStoredDuration = !isNaN(storedHold) || !isNaN(storedRest) || !isNaN(storedReps);
  const storedTimer = normalizeTimer({
    hold: isNaN(storedHold) ? DEFAULT_TIMER.hold : storedHold,
    rest: isNaN(storedRest) ? DEFAULT_TIMER.rest : storedRest,
    reps: isNaN(storedReps) ? DEFAULT_TIMER.reps : storedReps,
  });

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

  return {timer, savedTimers};
}

function shareUrl(timer) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("hold", timer.hold);
  url.searchParams.set("rest", timer.rest);
  url.searchParams.set("reps", timer.reps);
  return url.toString();
}

function tripleStopBeep() {
  const gap = 0.8;
  const beepSeconds = 0.5;
  Audio.presetBeep(2, beepSeconds);
  Audio.presetBeep(2, beepSeconds, gap);
  Audio.presetBeep(2, beepSeconds, gap * 2);
  return (gap * 2) + beepSeconds;
}

function ShareIcon() {
  const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
  if (isApple) {
    return (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 15V3"/>
        <path d="m7 8 5-5 5 5"/>
        <path d="M7 11H5v10h14V11h-2"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <path d="m8.6 10.6 6.8-4.2"/>
      <path d="m8.6 13.4 6.8 4.2"/>
    </svg>
  );
}

function ConfirmPanel({confirmPanel, onClose}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (confirmPanel && !dialog.open) dialog.showModal();
    if (!confirmPanel && dialog.open) dialog.close();
  }, [confirmPanel]);

  if (!confirmPanel) return null;

  return (
    <dialog
      ref={dialogRef}
      className="confirm-panel"
      onClick={event => {
        if (event.target === event.currentTarget) onClose(false);
      }}
      onClose={() => onClose(false)}
    >
      <h2>{confirmPanel.title}</h2>
      <div className="confirm-panel-body">{confirmPanel.body}</div>
      <div className="confirm-panel-actions">
        <button className="confirm-panel-button neutral" type="button" onClick={() => onClose(false)}>
          {confirmPanel.cancelText ?? "Cancel"}
        </button>
        <button className="confirm-panel-button primary" type="button" onClick={() => onClose(true)}>
          {confirmPanel.confirmText ?? "OK"}
        </button>
      </div>
    </dialog>
  );
}

function TimerValuesList({oldTimer, newTimer}) {
  return (
    <div className="timer-values-list">
      {[
        {label: "Hold", key: "hold"},
        {label: "Rest", key: "rest"},
        {label: "Reps", key: "reps"},
      ].map(({label, key}) => (
        <div className="timer-values-row" key={key}>
          <div className="timer-value-label">{label}</div>
          <div className="timer-value old">{oldTimer[key]}</div>
          <div className="timer-value-arrow">→</div>
          <div className="timer-value new">{newTimer[key]}</div>
        </div>
      ))}
    </div>
  );
}

function DialControl({id, label, unit, value, progress, onChange, onStep}) {
  return (
    <div className="dial-control">
      <div className="dial" id={id} style={{"--progress": progress}}>
        <div className="dial-inner">
          <label htmlFor={`${id}Input`}>{label}</label>
          <input
            id={`${id}Input`}
            type="number"
            min="1"
            step="1"
            value={value}
            inputMode="numeric"
            onChange={event => onChange(event.target.value)}
          />
          <span className="field-unit">{unit}</span>
        </div>
      </div>
      <div className="dial-buttons">
        <button className="step-button" type="button" aria-label={`Decrease ${label.toLowerCase()}`} onClick={() => onStep(-1)}>
          −
        </button>
        <button className="step-button" type="button" aria-label={`Increase ${label.toLowerCase()}`} onClick={() => onStep(1)}>
          +
        </button>
      </div>
    </div>
  );
}

function App() {
  const initialStateRef = useRef(null);
  if (!initialStateRef.current) initialStateRef.current = loadInitialState();

  const [timer, setTimer] = useState(initialStateRef.current.timer);
  const [savedTimers, setSavedTimers] = useState(initialStateRef.current.savedTimers);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [count, setCount] = useState(0);
  const [switchDeadline, setSwitchDeadline] = useState(null);
  const [now, setNow] = useState(performance.now());
  const [banner, setBanner] = useState(null);
  const [confirmPanel, setConfirmPanel] = useState(null);

  const backgroundFlashRef = useRef(null);
  const backgroundFlashAnimationRef = useRef(null);
  const pendingTimeoutRef = useRef(null);
  const preStartTimersRef = useRef([]);
  const preStartBeepsRef = useRef([]);
  const animationFrameRef = useRef(null);
  const longPressTimeoutRef = useRef(null);
  const longPressHandledRef = useRef(false);
  const runningRef = useRef(running);
  const phaseRef = useRef(phase);
  const countRef = useRef(count);
  const timerRef = useRef(timer);

  const selectedSavedTimerIndex = useMemo(() => {
    const key = timerKey(timer);
    return savedTimers.findIndex(savedTimer => timerKey(savedTimer) === key);
  }, [savedTimers, timer]);

  const display = useMemo(() => {
    if (!running || phase === "idle" || switchDeadline == null) {
      return {
        holdValue: timer.hold,
        restValue: timer.rest,
        repsValue: timer.reps,
        holdProgress: 1,
        restProgress: 1,
        repsProgress: 1,
      };
    }

    const holdDuration = timer.hold * 1000;
    const restDuration = timer.rest * 1000;
    const left = Math.max(0, switchDeadline - now);
    const completedRounds = phase === "rest" ? count : Math.max(0, count - 1);

    return {
      holdValue: phase === "hold" ? Math.ceil(left / 1000) : timer.hold,
      restValue: phase === "rest" ? Math.ceil(left / 1000) : timer.rest,
      repsValue: timer.reps - completedRounds,
      holdProgress: phase === "hold" ? left / holdDuration : 0,
      restProgress: phase === "rest" ? left / restDuration : 1,
      repsProgress: Math.max(0, 1 - (completedRounds / timer.reps)),
    };
  }, [count, now, phase, running, switchDeadline, timer]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    phaseRef.current = phase;
    document.body.dataset.phase = phase;
  }, [phase]);

  useEffect(() => {
    countRef.current = count;
  }, [count]);

  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  useEffect(() => {
    document.body.classList.toggle("timer-running", running);
  }, [running]);

  useEffect(() => {
    if (localStorage.getItem(UPDATED_BANNER_FLAG) === "1") {
      localStorage.removeItem(UPDATED_BANNER_FLAG);
      setBanner({text: "Updated to a new version", className: "downloaded"});
      setTimeout(() => setBanner(null), 2000);
    }

    registerSW({
      immediate: true,
      onRegisteredSW(_, registration) {
        if (!registration) return;
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing || !navigator.serviceWorker.controller) return;
          setBanner({text: "Downloading a new version", className: ""});
          installing.addEventListener("statechange", () => {
            if (installing.state !== "installed") return;
            localStorage.setItem(UPDATED_BANNER_FLAG, "1");
          });
        });
      },
    });
  }, []);

  useEffect(() => {
    function handleVisibilityChange() {
      if (!runningRef.current || switchDeadline == null) return;
      const remainingMs = Math.max(0, switchDeadline - performance.now());
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = setTimeout(handleDeadline, remainingMs);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [switchDeadline]);

  useEffect(() => {
    if (!running) {
      if (animationFrameRef.current != null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      return;
    }

    function animate() {
      setNow(performance.now());
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current != null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [running]);

  function persistTimer(nextTimer) {
    setTimer(nextTimer);
    saveCurrentDurations(nextTimer);
  }

  function updateTimer(partialTimer) {
    if (runningRef.current) return;
    persistTimer(normalizeTimer({...timerRef.current, ...partialTimer}));
  }

  function updateSavedTimers(nextSavedTimers) {
    setSavedTimers(nextSavedTimers);
    saveSavedTimers(nextSavedTimers);
  }

  function clearPreStartTimers() {
    for (const t of preStartTimersRef.current) clearTimeout(t);
    for (const beep of preStartBeepsRef.current) {
      if (beep) Audio.cancelBeep(beep);
    }
    preStartTimersRef.current = [];
    preStartBeepsRef.current = [];
  }

  function flashBackground(color, holdMs = 200) {
    backgroundFlashRef.current.style.setProperty("--flash-color", color);
    if (backgroundFlashAnimationRef.current) backgroundFlashAnimationRef.current.cancel();

    const fadeMs = 200;
    const duration = fadeMs + holdMs + fadeMs;
    backgroundFlashAnimationRef.current = backgroundFlashRef.current.animate(
      [
        {opacity: 0, offset: 0},
        {opacity: 1, offset: fadeMs / duration},
        {opacity: 1, offset: (fadeMs + holdMs) / duration},
        {opacity: 0, offset: 1},
      ],
      {duration, easing: "linear"},
    );
    backgroundFlashAnimationRef.current.addEventListener("finish", () => {
      backgroundFlashAnimationRef.current = null;
    }, {once: true});
  }

  function scheduleNext(nextPhase) {
    clearTimeout(pendingTimeoutRef.current);
    const durationMs = (nextPhase === "hold" ? timerRef.current.hold : timerRef.current.rest) * 1000;
    const deadline = performance.now() + durationMs;
    setSwitchDeadline(deadline);
    pendingTimeoutRef.current = setTimeout(handleDeadline, durationMs);
  }

  function startHoldPhase() {
    setPhase("hold");
    flashBackground("var(--dial-hold)");
    setCount(countRef.current + 1);
    scheduleNext("hold");
  }

  function startRestPhase() {
    setPhase("rest");
    flashBackground("var(--dial-rest)");
    Audio.presetBeep(2);
    scheduleNext("rest");
  }

  function handleDeadline() {
    if (!runningRef.current) return;
    if (phaseRef.current === "hold") {
      if (countRef.current >= timerRef.current.reps) {
        const finalFlashHoldMs = tripleStopBeep() * 1000;
        stop();
        flashBackground("var(--dial-reps)", finalFlashHoldMs);
      } else {
        startRestPhase();
      }
    } else {
      Audio.presetBeep(7);
      startHoldPhase();
    }
  }

  function start() {
    if (runningRef.current) return;
    const nextTimer = normalizeTimer(timerRef.current);
    persistTimer(nextTimer);
    setRunning(true);
    setCount(0);
    clearPreStartTimers();
    const gap = 0.6;
    const short = 0.2;
    preStartBeepsRef.current.push(Audio.presetBeep(2, short));
    preStartBeepsRef.current.push(Audio.presetBeep(2, short, gap));
    preStartBeepsRef.current.push(Audio.presetBeep(2, short, gap * 2));
    preStartBeepsRef.current.push(Audio.presetBeep(7, 0.7, gap * 3));
    preStartTimersRef.current.push(setTimeout(() => {
      if (!runningRef.current) return;
      preStartBeepsRef.current = [];
      clearPreStartTimers();
      startHoldPhase();
    }, gap * 3 * 1000));
  }

  function stop() {
    setRunning(false);
    runningRef.current = false;
    if (backgroundFlashAnimationRef.current) {
      backgroundFlashAnimationRef.current.cancel();
      backgroundFlashAnimationRef.current = null;
    }
    clearTimeout(pendingTimeoutRef.current);
    pendingTimeoutRef.current = null;
    clearPreStartTimers();
    setSwitchDeadline(null);
    setPhase("idle");
    setNow(performance.now());
  }

  function toggleSavedTimer() {
    if (running) return;
    if (selectedSavedTimerIndex === -1) {
      updateSavedTimers(saveTimerIfMissing(savedTimers, timer));
    } else {
      updateSavedTimers(savedTimers.filter((_, index) => index !== selectedSavedTimerIndex));
    }
  }

  async function share() {
    if (running) return;
    const url = shareUrl(timer);
    if (navigator.share) {
      await navigator.share({
        title: "Phased Timer",
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  function startSavedTimerLongPress(savedTimer, index) {
    if (running) return;
    longPressHandledRef.current = false;
    longPressTimeoutRef.current = setTimeout(() => {
      const newTimer = timerRef.current;
      if (timerKey(savedTimer) === timerKey(newTimer)) return;
      longPressHandledRef.current = true;
      setConfirmPanel({
        title: "Update saved timer?",
        body: <TimerValuesList oldTimer={savedTimer} newTimer={newTimer}/>,
        confirm() {
          updateSavedTimers(savedTimers.map((timerItem, timerIndex) => timerIndex === index ? newTimer : timerItem));
        },
      });
    }, LONG_PRESS_MS);
  }

  function cancelSavedTimerLongPress() {
    clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = null;
  }

  return (
    <>
      <div className="background-flash" ref={backgroundFlashRef}></div>
      {banner && <div className={`update-banner ${banner.className}`.trim()}>{banner.text}</div>}
      <div className="app">
        <h1>Phased Timer</h1>

        <DialControl
          id="dialHold"
          label="Hold"
          unit="seconds"
          value={display.holdValue}
          progress={display.holdProgress}
          onChange={value => updateTimer({hold: value})}
          onStep={delta => updateTimer({hold: timer.hold + delta})}
        />

        <DialControl
          id="dialRest"
          label="Rest"
          unit="seconds"
          value={display.restValue}
          progress={display.restProgress}
          onChange={value => updateTimer({rest: value})}
          onStep={delta => updateTimer({rest: timer.rest + delta})}
        />

        <DialControl
          id="dialReps"
          label="Reps"
          unit="repeats"
          value={display.repsValue}
          progress={display.repsProgress}
          onChange={value => updateTimer({reps: value})}
          onStep={delta => updateTimer({reps: timer.reps + delta})}
        />

        <button className={`toggle-button ${running ? "stop" : "start"}`} type="button" onClick={running ? stop : start}>
          {running ? "Stop" : "Start"}
        </button>

        <div className="saved-timers">
          <div className="saved-timer-list">
            {savedTimers.map((savedTimer, index) => (
              <button
                className={`saved-timer-pill ${index === selectedSavedTimerIndex ? "selected" : ""}`.trim()}
                key={`${timerKey(savedTimer)}-${index}`}
                type="button"
                onPointerDown={() => startSavedTimerLongPress(savedTimer, index)}
                onPointerUp={cancelSavedTimerLongPress}
                onPointerCancel={cancelSavedTimerLongPress}
                onPointerLeave={cancelSavedTimerLongPress}
                onClick={() => {
                  if (longPressHandledRef.current) return;
                  persistTimer(savedTimer);
                }}
              >
                {timerKey(savedTimer)}
              </button>
            ))}
          </div>
          <button className="save-timer-button" type="button" onClick={toggleSavedTimer}>
            {selectedSavedTimerIndex === -1 ? "Save" : "Unsave"}
          </button>
          <button className="share-button" type="button" aria-label="Share timer" title="Share" onClick={share}>
            <ShareIcon/>
          </button>
        </div>
      </div>
      <ConfirmPanel
        confirmPanel={confirmPanel}
        onClose={confirmed => {
          if (confirmed) confirmPanel.confirm();
          setConfirmPanel(null);
        }}
      />
    </>
  );
}

createRoot(document.getElementById("root")).render(<App/>);
