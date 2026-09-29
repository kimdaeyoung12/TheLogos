// Own only the temporary fade; preserve the element's normal volume on stop.
export function createAudioFade(audio, {
  durationMs = 1500,
  now = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
} = {}) {
  let timer = null;
  let generation = 0;
  let targetVolume = null;
  let context = null;
  let gain = null;
  let ready = Promise.resolve();

  function setVolume(value) {
    if (gain) gain.gain.value = value;
    else audio.volume = value;
  }

  function cancel() {
    generation += 1;
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (targetVolume !== null) setVolume(targetVolume);
    targetVolume = null;
  }

  function prepare() {
    cancel();
    targetVolume = gain ? gain.gain.value : audio.volume;
    setVolume(0);
    // iOS may ignore HTMLMediaElement.volume. Route through Web Audio only
    // when needed; source creation is permanent for this element.
    if (!gain && audio.volume !== 0 && AudioContextClass) {
      const nextContext = new AudioContextClass();
      try {
        const nextGain = nextContext.createGain();
        nextGain.gain.value = 0;
        audio.crossOrigin = 'anonymous';
        nextContext.createMediaElementSource(audio).connect(nextGain);
        nextGain.connect(nextContext.destination);
        context = nextContext;
        gain = nextGain;
      } catch (error) {
        void nextContext.close().catch(() => {});
        throw error;
      }
    }
    ready = context && context.state !== 'running' ? context.resume() : Promise.resolve();
    // The caller consumes the rejection together with audio.play().
    void ready.catch(() => {});
    return generation;
  }

  function start(token) {
    if (token !== generation || targetVolume === null) return;
    const startedAt = now();
    const tick = () => {
      if (token !== generation) return;
      const progress = Math.min(1, Math.max(0, (now() - startedAt) / durationMs));
      // Smoothstep avoids an abrupt change in the rate at either end.
      setVolume(targetVolume * progress * progress * (3 - 2 * progress));
      if (progress < 1) timer = setTimer(tick, 40);
      else { timer = null; targetVolume = null; }
    };
    tick();
  }

  return { prepare, start, cancel, whenReady: () => ready, isCurrent: (token) => token === generation };
}
