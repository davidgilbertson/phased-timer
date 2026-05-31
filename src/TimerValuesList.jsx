export function TimerValuesList({oldTimer, newTimer}) {
  return (
    <div className="timer-values-list">
      {[
        {label: "Hold", key: "hold"},
        {label: "Rest", key: "rest"},
        {label: "Reps", key: "reps"},
      ].map(({label, key}) => (
        <div className="row" key={key}>
          <div className="label">{label}</div>
          <div className="value old">{oldTimer[key]}</div>
          <div className="arrow">→</div>
          <div className="value new">{newTimer[key]}</div>
        </div>
      ))}
    </div>
  );
}
