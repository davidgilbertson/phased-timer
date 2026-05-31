export function HelpPage() {
  return (
    <main className="help-page">
      <header>
        <h1>Phased Timer</h1>
        <a href="/">Open timer</a>
      </header>

      <section>
        <h2>Timer</h2>
        <p>Set hold, rest, and reps, then start. The app counts down first, then alternates hold and rest phases until the final rep completes.</p>
      </section>

      <section>
        <h2>Saved Timers</h2>
        <p>Save useful timings as quick presets. Tap a saved timer to load it, or long-press one to update it with the current values.</p>
      </section>

      <section>
        <h2>Settings</h2>
        <p>Use the gear to set the start countdown, send feedback, or copy a timer URL. The URL keeps the current hold, rest, and rep values, so a physio or trainer can configure a timer and send it to someone else.</p>
      </section>
    </main>
  );
}
