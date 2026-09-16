// Web Audio API Synthesizer (offline, zero dependency)
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playSynthSound(type: 'pop' | 'success' | 'failure' | 'alarm' | 'click' | 'clickEcho') {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'success') {
      const playTone = (freq: number, delay: number, duration: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        g.gain.setValueAtTime(0.15, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration);
        o.start(ctx.currentTime + delay);
        o.stop(ctx.currentTime + delay + duration);
      };
      playTone(523.25, 0, 0.12); // C5
      playTone(659.25, 0.08, 0.12); // E5
      playTone(784.00, 0.16, 0.2); // G5
    } else if (type === 'failure') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'alarm') {
      const playBeep = (freq: number, delay: number, dur: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        g.gain.setValueAtTime(0.12, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + dur);
        o.start(ctx.currentTime + delay);
        o.stop(ctx.currentTime + delay + dur);
      };
      playBeep(880, 0, 0.1);
      playBeep(880, 0.15, 0.1);
      playBeep(880, 0.4, 0.1);
      playBeep(880, 0.55, 0.1);
    } else if (type === 'click' || type === 'clickEcho') {
      // Mesmo timbre do 'click' padrão das páginas/outros elementos.
      // 'clickEcho' repete o clique uma vez, baixo e curto, como eco leve.
      const playClick = (delay: number, vol: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(600, ctx.currentTime + delay);
        o.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + delay + 0.05);
        g.gain.setValueAtTime(vol, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.05);
        o.start(ctx.currentTime + delay);
        o.stop(ctx.currentTime + delay + 0.05);
      };
      playClick(0, 0.08);
      if (type === 'clickEcho') playClick(0.09, 0.03);
    }
  } catch (err) {
    console.debug('AudioContext not allowed yet:', err);
  }
}
