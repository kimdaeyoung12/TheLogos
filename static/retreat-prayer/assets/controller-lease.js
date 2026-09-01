const DEFAULT_HEARTBEAT_MS = 20_000;
const DEFAULT_RETRY_MS = 5_000;

export class ControllerLeaseCoordinator {
  constructor({
    claim,
    check = claim,
    createToken,
    classifyError = () => "transient",
    onUpdate = () => {},
    heartbeatMs = DEFAULT_HEARTBEAT_MS,
    retryMs = DEFAULT_RETRY_MS,
    now = () => Date.now(),
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = (timer) => clearTimeout(timer),
  }) {
    if (typeof claim !== "function") throw new TypeError("A controller lease claim function is required.");
    if (typeof check !== "function") throw new TypeError("A controller lease status function is required.");
    if (typeof createToken !== "function") throw new TypeError("A controller lease token factory is required.");
    this.claim = claim;
    this.check = check;
    this.createToken = createToken;
    this.classifyError = classifyError;
    this.onUpdate = onUpdate;
    this.heartbeatMs = heartbeatMs;
    this.retryMs = retryMs;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.token = null;
    this.expiresAt = null;
    this.status = "idle";
    this.details = null;
    this.timer = null;
    this.inFlight = null;
    this.generation = 0;
    this.paused = false;
  }

  hasToken() {
    return Boolean(this.token);
  }

  ownsLease() {
    return Boolean(this.token && Date.parse(this.expiresAt) > this.now());
  }

  snapshot(error = null, message = null) {
    return {
      token: this.token,
      expiresAt: this.expiresAt,
      owned: this.ownsLease(),
      status: this.status,
      error,
      message,
      details: this.details,
    };
  }

  emit(error = null, message = null) {
    this.onUpdate(this.snapshot(error, message));
  }

  clearScheduled() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  schedule(delay) {
    this.clearScheduled();
    if (this.paused || !this.token) return;
    const generation = this.generation;
    this.timer = this.setTimer(() => {
      this.timer = null;
      if (this.paused || generation !== this.generation) return;
      void this.renew({ quiet: true });
    }, delay);
  }

  request({ quiet = false } = {}) {
    return this.run({ operation: this.claim, allowCreate: true, quiet, checking: false });
  }

  renew({ quiet = true } = {}) {
    if (!this.token) return Promise.resolve({ acquired: false, attempted: false, classification: "idle" });
    return this.run({ operation: this.check, allowCreate: false, quiet, checking: true });
  }

  restore(token) {
    if (!token) return Promise.resolve({ acquired: false, attempted: false, classification: "idle" });
    this.token = token;
    return this.renew({ quiet: true });
  }

  run({ operation, allowCreate, quiet, checking }) {
    this.paused = false;
    if (this.inFlight) return this.inFlight;
    if (!this.token && allowCreate) this.token = this.createToken();
    if (!this.token) return Promise.resolve({ acquired: false, attempted: false, classification: "idle" });

    this.clearScheduled();
    const token = this.token;
    const generation = this.generation;
    this.status = this.ownsLease() ? "renewing" : checking ? "checking" : "requesting";
    this.emit();

    const task = Promise.resolve()
      .then(() => operation(token))
      .then((payload) => {
        if (generation !== this.generation || token !== this.token) {
          return { acquired: false, attempted: true, classification: "superseded" };
        }
        if (!payload?.acquired) {
          this.expiresAt = null;
          this.details = payload || null;
          this.status = payload?.available ? "available" : "held";
          this.emit(null, payload?.message || "다른 Admin이 현재 기도회를 제어하고 있습니다.");
          this.schedule(this.heartbeatMs);
          return {
            acquired: false,
            attempted: true,
            classification: payload?.available ? "available" : "held",
            message: payload?.message,
            payload,
          };
        }
        this.expiresAt = payload.expires_at;
        this.details = payload;
        this.status = "owned";
        this.emit();
        this.schedule(this.heartbeatMs);
        return { acquired: true, attempted: true, classification: "owned", expiresAt: this.expiresAt, payload };
      })
      .catch((error) => {
        if (generation !== this.generation || token !== this.token) {
          return { acquired: false, attempted: true, classification: "superseded", error };
        }
        const classification = this.classifyError(error) === "auth" ? "auth" : "transient";
        if (classification === "auth") {
          this.token = null;
          this.expiresAt = null;
          this.details = null;
          this.status = "unauthorized";
          this.emit(error);
          return { acquired: false, attempted: true, classification, error, quiet };
        }
        this.status = this.ownsLease() ? "degraded" : "reconnecting";
        this.emit(error);
        this.schedule(this.retryMs);
        return { acquired: false, attempted: true, classification, error, quiet };
      })
      .finally(() => {
        if (this.inFlight === task) this.inFlight = null;
      });
    this.inFlight = task;
    return task;
  }

  pause() {
    this.paused = true;
    this.generation += 1;
    this.clearScheduled();
    this.inFlight = null;
  }

  resume() {
    this.paused = false;
    return this.renew({ quiet: true });
  }

  dispose() {
    this.pause();
    this.token = null;
    this.expiresAt = null;
    this.status = "idle";
    this.details = null;
    this.emit();
  }
}
