import {useEffect, useRef} from "react";
import {StepControl} from "./StepControl.jsx";

export function SettingsPanel({open, banner, countdown, onCountdownChange, onCopyUrl, onClose}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="confirm-panel settings-panel"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={onClose}
    >
      {banner && <div className={`update-banner ${banner.className}`.trim()}>{banner.body}</div>}
      <div className="heading-row">
        <h2>Settings</h2>
        <button className="close-button" type="button" onClick={onClose} aria-label="Close settings">
          &times;
        </button>
      </div>

      <div className="settings-body">
        <section className="settings-row">
          <div>
            <h3>Countdown</h3>
            <p>Seconds before the first hold.</p>
          </div>
          <StepControl
            value={countdown}
            onDecrement={() => onCountdownChange(countdown - 1)}
            onIncrement={() => onCountdownChange(countdown + 1)}
            decrementDisabled={countdown <= 0}
            decrementAriaLabel="Decrease countdown"
            incrementAriaLabel="Increase countdown"
          />
        </section>

        <section className="settings-row">
          <div>
            <h3>URL</h3>
            <p>Copy a link for this timer.</p>
          </div>
          <button className="text-button" type="button" onClick={onCopyUrl}>
            Copy URL
          </button>
        </section>

        <div className="settings-links">
          <a href="/help">Help</a>
          <a href="https://github.com/davidgilbertson/phased-timer/issues" target="_blank" rel="noreferrer">
            Feedback
          </a>
        </div>
      </div>
    </dialog>
  );
}
