const DEFAULT_DELAYS = [2_000, 5_000, 15_000, 30_000];

export class RealtimeSetupCoordinator {
  constructor({
    install,
    onFailure = () => {},
    onSuccess = () => {},
    delays = DEFAULT_DELAYS,
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = (timer) => clearTimeout(timer),
  }) {
    if (typeof install !== "function") throw new TypeError("Realtime install function is required.");
    this.install = install;
    this.onFailure = onFailure;
    this.onSuccess = onSuccess;
    this.delays = delays.length ? delays : DEFAULT_DELAYS;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.delayIndex = 0;
    this.timer = null;
    this.inFlight = null;
    this.ready = false;
    this.stopped = false;
  }

  start() {
    if (this.stopped) return Promise.resolve(false);
    if (this.ready) return Promise.resolve(true);
    if (this.inFlight) return this.inFlight;
    this.inFlight = Promise.resolve()
      .then(() => this.install())
      .then(() => {
        if (this.stopped) return false;
        this.ready = true;
        this.delayIndex = 0;
        if (this.timer !== null) this.clearTimer(this.timer);
        this.timer = null;
        this.onSuccess();
        return true;
      })
      .catch((error) => {
        if (!this.stopped) {
          this.onFailure(error);
          this.schedule();
        }
        return false;
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  schedule() {
    if (this.stopped || this.ready || this.timer !== null) return;
    const delay = this.delays[Math.min(this.delayIndex, this.delays.length - 1)];
    this.delayIndex += 1;
    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.start();
    }, delay);
  }

  retry(error) {
    if (this.stopped) return false;
    this.ready = false;
    this.onFailure(error);
    this.schedule();
    return true;
  }

  stop() {
    this.stopped = true;
    this.ready = false;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }
}
