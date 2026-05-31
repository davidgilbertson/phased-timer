export function StepControl({
  value,
  onDecrement,
  onIncrement,
  decrementDisabled = false,
  incrementDisabled = false,
  decrementAriaLabel = "Decrease value",
  incrementAriaLabel = "Increase value",
  units = null,
}) {
  return (
    <div className="step-control">
      <button
        type="button"
        onClick={onDecrement}
        disabled={decrementDisabled}
        aria-label={decrementAriaLabel}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14"/>
        </svg>
      </button>
      <div className="value">
        <span>{value}</span>
        {units && <span className="units">{units}</span>}
      </div>
      <button
        type="button"
        onClick={onIncrement}
        disabled={incrementDisabled}
        aria-label={incrementAriaLabel}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14"/>
          <path d="M5 12h14"/>
        </svg>
      </button>
    </div>
  );
}
