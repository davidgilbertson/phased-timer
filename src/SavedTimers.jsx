import {useRef} from "react";
import {SettingsIcon} from "./SettingsIcon.jsx";
import {TimerValuesList} from "./TimerValuesList.jsx";
import {timerKey} from "./timerUtils.js";

const LONG_PRESS_MS = 700;

export function SavedTimers({
  savedTimers,
  selectedSavedTimerIndex,
  running,
  timer,
  onSelectTimer,
  onToggleSavedTimer,
  onUpdateSavedTimers,
  onOpenSettings,
  setConfirmPanel,
}) {
  const longPressTimeoutRef = useRef(null);
  const longPressHandledRef = useRef(false);

  function startLongPress(savedTimer, index) {
    if (running) return;
    longPressHandledRef.current = false;
    longPressTimeoutRef.current = setTimeout(() => {
      const newTimer = timer;
      if (timerKey(savedTimer) === timerKey(newTimer)) return;
      longPressHandledRef.current = true;
      setConfirmPanel({
        title: "Update saved timer?",
        body: <TimerValuesList oldTimer={savedTimer} newTimer={newTimer}/>,
        confirm() {
          onUpdateSavedTimers(savedTimers.map((timerItem, timerIndex) => timerIndex === index ? newTimer : timerItem));
        },
      });
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = null;
  }

  return (
    <div className="saved-timers">
      <div className="list">
        {savedTimers.map((savedTimer, index) => (
          <button
            className={`pill ${index === selectedSavedTimerIndex ? "selected" : ""}`.trim()}
            key={`${timerKey(savedTimer)}-${index}`}
            type="button"
            onPointerDown={() => startLongPress(savedTimer, index)}
            onPointerUp={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onClick={() => {
              if (longPressHandledRef.current) return;
              onSelectTimer(savedTimer);
            }}
          >
            {timerKey(savedTimer)}
          </button>
        ))}
      </div>
      <button className="save-button" type="button" onClick={onToggleSavedTimer}>
        {selectedSavedTimerIndex === -1 ? "Save" : "Unsave"}
      </button>
      <button className="settings-button" type="button" aria-label="Open settings" title="Settings" onClick={onOpenSettings}>
        <SettingsIcon/>
      </button>
    </div>
  );
}
