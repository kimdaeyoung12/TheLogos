// Replication events may omit unchanged large JSON values. Treat them as
// invalidations and publish only complete, version-checked database reads.
export function isCompleteLiveSession(row) {
  if (!row || !Number.isFinite(row.version) || !["draft", "scheduled", "live", "paused", "completed"].includes(row.status)) return false;
  if (!["live", "paused"].includes(row.status)) return true;
  const steps = Array.isArray(row.program_snapshot) ? row.program_snapshot : row.program_snapshot?.steps;
  return Array.isArray(steps) && steps.length > 0
    && Number.isInteger(row.stage_index) && row.stage_index >= 0 && row.stage_index < steps.length
    && steps.every((step) => step && typeof step.content === "string" && step.content.trim().length > 0);
}

export function createLiveSync({ fetchSession, onSession, onStatus = () => {},
  setTimer = setTimeout, clearTimer = clearTimeout, retryDelay = () => 2000 + Math.random() * 1000 }) {
  let active = true;
  let running = false;
  let requested = false;
  let requestGeneration = 0;
  let unversionedGeneration = 0;
  let targetVersion = -1;
  let deliveredVersion = -1;
  let timer = null;

  async function drain() {
    if (!active || running) return;
    running = true;
    requested = false;
    const readGeneration = requestGeneration;
    let failed = false;
    try {
      const row = await fetchSession();
      if (!active) return;
      if (!isCompleteLiveSession(row) || row.version < targetVersion || row.version < deliveredVersion) {
        throw new Error("기도회 전체 내용을 다시 확인하고 있습니다.");
      }
      deliveredVersion = row.version;
      requested = unversionedGeneration > readGeneration;
      onSession(row);
      onStatus("connected");
    } catch (error) {
      failed = true;
      if (active) onStatus("reconnecting", error);
    } finally {
      running = false;
      if (active && failed) timer = setTimer(() => { timer = null; void drain(); }, retryDelay());
      else if (active && requested) void drain();
    }
  }

  return {
    request(version) {
      if (!active) return;
      requestGeneration++;
      if (Number.isFinite(version)) targetVersion = Math.max(targetVersion, version);
      else unversionedGeneration = requestGeneration;
      requested = true;
      if (timer !== null) { clearTimer(timer); timer = null; }
      void drain();
    },
    stop() {
      active = false;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
}
