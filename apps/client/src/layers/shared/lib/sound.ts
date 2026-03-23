let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** Short tick sound for discrete slider value changes (800Hz sine, 4ms, gain 0.05). */
export function playSliderTick(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 800;
    gain.gain.value = 0.05;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.004);
  } catch {
    // Silently fail — sound is non-critical
  }
}

/** Ascending 3-note chime for successful agent creation (C5-E5-G5, staggered 33ms). */
export function playCelebration(): void {
  try {
    const ctx = getAudioContext();
    const notes = [523, 659, 784]; // C5, E5, G5
    const stagger = 0.033;

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      gain.gain.value = 0.08;

      // Fade out over 300ms
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * stagger);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * stagger + 0.3);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(ctx.currentTime + i * stagger);
      oscillator.stop(ctx.currentTime + i * stagger + 0.3);
    });
  } catch {
    // Silently fail — sound is non-critical
  }
}
