import {useEffect, useMemo, useRef, useState} from "react";
import {registerSW} from "virtual:pwa-register";
import {Audio, tripleStopBeep} from "./audio.js";
import {ConfirmPanel} from "./ConfirmPanel.jsx";
import {DialControl} from "./DialControl.jsx";
import {SavedTimers} from "./SavedTimers.jsx";
import {SettingsPanel} from "./SettingsPanel.jsx";
import {
  countdownSec,
  loadInitialState,
  normalizeTimer,
  saveCountdown,
  saveCurrentDurations,
  saveSavedTimers,
  saveTimerIfMissing,
  shareUrl,
  timerKey,
} from "./timerUtils.js";

const UPDATED_BANNER_FLAG = "phased_timer_updated";
const BANNER_MS = 3000;

export function App() {
  const initialStateRef = useRef(null);
  if (!initialStateRef.current) initialStateRef.current = loadInitialState();

  const [timer, setTimer] = useState(initialStateRef.current.timer);
  const [countdown, setCountdown] = useState(initialStateRef.current.countdown);
  const [savedTimers, setSavedTimers] = useState(initialStateRef.current.savedTimers);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [count, setCount] = useState(0);
  const [switchDeadline, setSwitchDeadline] = useState(null);
  const [now, setNow] = useState(performance.now());
  const [banner, setBanner] = useState(null);
  const [confirmPanel, setConfirmPanel] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const backgroundFlashRef = useRef(null);
  const backgroundFlashAnimationRef = useRef(null);
  const pendingTimeoutRef = useRef(null);
  const preStartTimersRef = useRef([]);
  const preStartBeepsRef = useRef([]);
  const animationFrameRef = useRef(null);
  const runningRef = useRef(running);
  const phaseRef = useRef(phase);
  const countRef = useRef(count);
  const timerRef = useRef(timer);
  const countdownRef = useRef(countdown);
  const bannerTimeoutRef = useRef(null);

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
    countdownRef.current = countdown;
    saveCountdown(countdown);
  }, [countdown]);

  useEffect(() => {
    document.body.classList.toggle("timer-running", running);
  }, [running]);

  useEffect(() => {
    if (localStorage.getItem(UPDATED_BANNER_FLAG) === "1") {
      localStorage.removeItem(UPDATED_BANNER_FLAG);
      showBanner("Updated to a new version", "downloaded");
    }

    registerSW({
      immediate: true,
      onRegisteredSW(_, registration) {
        if (!registration) return;
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing || !navigator.serviceWorker.controller) return;
          setBanner({body: "Downloading a new version", className: ""});
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

  function updateCountdown(nextCountdown) {
    if (runningRef.current) return;
    setCountdown(countdownSec(nextCountdown));
  }

  function showBanner(body, className = "") {
    clearTimeout(bannerTimeoutRef.current);
    setBanner({body, className});
    bannerTimeoutRef.current = setTimeout(() => setBanner(null), BANNER_MS);
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
    const countdownSeconds = countdownRef.current;
    const short = 0.2;
    for (let i = 0; i < countdownSeconds; i++) {
      preStartBeepsRef.current.push(Audio.presetBeep(2, short, i));
    }
    preStartBeepsRef.current.push(Audio.presetBeep(7, 0.7, countdownSeconds));
    preStartTimersRef.current.push(setTimeout(() => {
      if (!runningRef.current) return;
      preStartBeepsRef.current = [];
      clearPreStartTimers();
      startHoldPhase();
    }, countdownSeconds * 1000));
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

  async function copyShareUrl() {
    if (running) return;
    const url = shareUrl(timer);
    await navigator.clipboard.writeText(url);
    showBanner(
      <>
        <span>Copied URL to clipboard</span>
        <span className="copied-url">{url.replace(/^https?:\/\//, "")}</span>
      </>,
      "copied",
    );
  }

  return (
    <>
      <div className="background-flash" ref={backgroundFlashRef}></div>
      {!settingsOpen && banner && <div className={`update-banner ${banner.className}`.trim()}>{banner.body}</div>}
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

        <SavedTimers
          savedTimers={savedTimers}
          selectedSavedTimerIndex={selectedSavedTimerIndex}
          running={running}
          timer={timer}
          onSelectTimer={persistTimer}
          onToggleSavedTimer={toggleSavedTimer}
          onUpdateSavedTimers={updateSavedTimers}
          onOpenSettings={() => setSettingsOpen(true)}
          setConfirmPanel={setConfirmPanel}
        />
      </div>
      <SettingsPanel
        open={settingsOpen}
        banner={banner}
        countdown={countdown}
        onCountdownChange={updateCountdown}
        onShare={copyShareUrl}
        onClose={() => setSettingsOpen(false)}
      />
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
