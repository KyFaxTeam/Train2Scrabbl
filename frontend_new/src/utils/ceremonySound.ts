// Sons de cérémonie du Panthéon : déclic de cadenas + fanfare de cuivres synthétiques
export function playCeremony(ctx: AudioContext, type: 'unlock' | 'fanfare') {
  const master = ctx.createGain();
  master.gain.value = type === 'unlock' ? 0.12 : 0.16;
  master.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.03;

  const note = (freq: number, start: number, dur: number, wave: OscillatorType, vol: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2600;
    o.type = wave;
    o.frequency.setValueAtTime(freq, t0 + start);
    g.gain.setValueAtTime(0.0001, t0 + start);
    g.gain.exponentialRampToValueAtTime(vol, t0 + start + 0.025);
    g.gain.setValueAtTime(vol, t0 + start + dur * 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
    o.connect(f);
    f.connect(g);
    g.connect(master);
    o.start(t0 + start);
    o.stop(t0 + start + dur + 0.05);
  };

  if (type === 'unlock') {
    // « clic-clac » métallique du cadenas qui cède
    note(1400, 0, 0.05, 'square', 0.6);
    note(2100, 0.07, 0.06, 'square', 0.5);
    note(880, 0.16, 0.25, 'triangle', 0.6);
    setTimeout(() => ctx.close().catch(() => undefined), 800);
    return;
  }

  // Ta-ta-ta TAAA… ta-TAAAA, puis accord final de do majeur
  const phrase: [number, number, number][] = [
    [392.0, 0, 0.13],
    [392.0, 0.15, 0.13],
    [392.0, 0.3, 0.13],
    [523.25, 0.45, 0.48],
    [659.25, 0.95, 0.16],
    [783.99, 1.13, 0.62],
  ];
  phrase.forEach(([freq, start, dur]) => {
    note(freq, start, dur, 'sawtooth', 0.45);
    note(freq * 2, start, dur, 'triangle', 0.18);
  });
  [523.25, 659.25, 783.99, 1046.5].forEach((freq) => note(freq, 1.85, 1.7, 'triangle', 0.32));
  note(130.81, 1.85, 1.7, 'sawtooth', 0.28);
  note(261.63, 1.85, 1.7, 'sawtooth', 0.2);
  setTimeout(() => ctx.close().catch(() => undefined), 4200);
}

/** Fanfare seule (à jouer sur un clic : sans geste de l'utilisateur, le navigateur coupe le son). */
export function playFanfare() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    playCeremony(new AudioCtx(), 'fanfare');
  } catch {
    // Audio non critique
  }
}
