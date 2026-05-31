export const Audio = (() => {
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

export function tripleStopBeep() {
  const gap = 0.8;
  const beepSeconds = 0.5;
  Audio.presetBeep(2, beepSeconds);
  Audio.presetBeep(2, beepSeconds, gap);
  Audio.presetBeep(2, beepSeconds, gap * 2);
  return (gap * 2) + beepSeconds;
}
