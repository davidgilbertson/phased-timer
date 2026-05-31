export function DialControl({id, label, unit, value, progress, onChange, onStep}) {
  return (
    <div className="dial-control">
      <div className="dial" id={id} style={{"--progress": progress}}>
        <div className="inner">
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
      <div className="buttons">
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
