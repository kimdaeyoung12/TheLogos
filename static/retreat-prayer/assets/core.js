export const LIVE_STATUSES = Object.freeze([
  "draft",
  "scheduled",
  "live",
  "paused",
  "completed",
]);

export const DEFAULT_TIME_ZONE = "Asia/Seoul";

export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateStorageId(storage, key) {
  const current = storage?.getItem?.(key);
  if (current && /^[a-zA-Z0-9-]{16,80}$/.test(current)) return current;
  const next = createId();
  storage?.setItem?.(key, next);
  return next;
}

export function isLocalPreview(config, hostname = globalThis.location?.hostname || "") {
  return (config.demoAllowedHosts || []).includes(hostname);
}

export function hasProductionConfig(config) {
  return Boolean(
    config?.supabaseUrl?.startsWith("https://") &&
      config?.supabasePublishableKey &&
      !config.supabaseUrl.includes("YOUR_PROJECT_REF") &&
      !config.supabasePublishableKey.includes("YOUR_")
  );
}

export function zonedDateKey(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getDday(retreatDate, date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  if (!retreatDate) return null;
  const today = zonedDateKey(date, timeZone);
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${retreatDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.ceil((end - start) / 86_400_000);
}

export function formatDday(days) {
  if (days === null) return "수련회 일정 준비 중";
  if (days > 0) return `수련회 D-${days}`;
  if (days === 0) return "오늘은 수련회 날입니다";
  return "수련회를 위해 계속 기도합니다";
}

export function formatKoreanDate(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

export function formatKoreanTime(date, timeZone = DEFAULT_TIME_ZONE) {
  if (!date) return "일정 준비 중";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatRemaining(seconds) {
  const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (safe > 60) return `${minutes}분`;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function parseProgramSteps(snapshot) {
  const source = Array.isArray(snapshot) ? snapshot : snapshot?.steps;
  if (!Array.isArray(source)) return [];
  const mediaById = new Map(
    (Array.isArray(snapshot?.media) ? snapshot.media : [])
      .filter((item) => item?.id)
      .map((item) => [String(item.id), item]),
  );
  return source
    .map((step, index) => ({
      id: String(step.id || `step-${index + 1}`),
      label: String(step.label || `기도 ${index + 1}`),
      kind: String(step.kind || "prayer"),
      scriptureReference: String(step.scriptureReference || step.scripture_reference || ""),
      content: String(step.content || ""),
      durationSeconds: Math.max(0, Number(step.durationSeconds || step.duration_seconds || 0)),
      mediaId: step.mediaId || step.media_id || null,
      media: mediaById.get(String(step.mediaId || step.media_id || "")) || null,
    }))
    .filter((step) => step.content && step.durationSeconds >= 0);
}

export function deriveLiveView(liveState, now = Date.now()) {
  const status = LIVE_STATUSES.includes(liveState?.status) ? liveState.status : "draft";
  const steps = parseProgramSteps(liveState?.program_snapshot);
  const fallbackIndex = Math.max(0, Math.min(Number(liveState?.stage_index) || 0, Math.max(steps.length - 1, 0)));

  if (!steps.length) {
    return { status, steps, stageIndex: 0, step: null, remainingSeconds: 0, progress: 0 };
  }

  if (status !== "live" || liveState?.mode !== "auto" || !liveState?.started_at) {
    const step = steps[fallbackIndex];
    const anchor = Date.parse(liveState?.stage_started_at || liveState?.updated_at || new Date(now).toISOString());
    const elapsed = status === "paused" ? 0 : Math.max(0, (now - anchor) / 1000);
    const remainingSeconds = status === "paused"
      ? Number(liveState?.paused_remaining_seconds ?? step.durationSeconds)
      : Math.max(0, step.durationSeconds - elapsed);
    return {
      status,
      steps,
      stageIndex: fallbackIndex,
      step,
      remainingSeconds,
      progress: step.durationSeconds ? Math.min(1, elapsed / step.durationSeconds) : 0,
    };
  }

  const start = Date.parse(liveState.started_at);
  const pauseSeconds = Math.max(0, Number(liveState.accumulated_pause_seconds) || 0);
  let elapsed = Math.max(0, (now - start) / 1000 - pauseSeconds);
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (elapsed < step.durationSeconds || index === steps.length - 1) {
      const over = Math.min(elapsed, step.durationSeconds);
      return {
        status: elapsed >= step.durationSeconds && index === steps.length - 1 ? "completed" : status,
        steps,
        stageIndex: index,
        step,
        remainingSeconds: Math.max(0, step.durationSeconds - over),
        progress: step.durationSeconds ? Math.min(1, over / step.durationSeconds) : 0,
      };
    }
    elapsed -= step.durationSeconds;
  }

  return {
    status: "completed",
    steps,
    stageIndex: steps.length - 1,
    step: steps.at(-1),
    remainingSeconds: 0,
    progress: 1,
  };
}

export function countUniquePresenceSessions(presenceState) {
  const sessions = new Set();
  Object.values(presenceState || {}).flat().forEach((presence) => {
    const id = presence?.session_id;
    if (typeof id === "string" && /^[a-zA-Z0-9-]{16,80}$/.test(id)) sessions.add(id);
  });
  return sessions.size;
}

export function normalizePrayerSubmission(input) {
  const displayName = String(input?.displayName || "").normalize("NFKC").trim().replace(/\s+/g, " ");
  const body = String(input?.body || "").normalize("NFKC").trim().replace(/\r\n?/g, "\n");
  const isAnonymous = Boolean(input?.isAnonymous);
  const consent = Boolean(input?.consent);
  const errors = {};

  if (!isAnonymous && displayName.length < 1) errors.displayName = "이름 또는 닉네임을 입력해주세요.";
  if (!isAnonymous && displayName.length > 40) errors.displayName = "이름 또는 닉네임은 40자 이내로 입력해주세요.";
  if (body.length < 10) errors.body = "기도제목을 10자 이상 작성해주세요.";
  if (body.length > 800) errors.body = "기도제목은 800자 이내로 작성해주세요.";
  if (!consent) errors.consent = "공개 및 관리자 검토에 동의해주세요.";

  return {
    value: { displayName: isAnonymous ? "" : displayName.slice(0, 40), body: body.slice(0, 800), isAnonymous, consent },
    errors,
    valid: Object.keys(errors).length === 0,
  };
}

export function isYouTubeUrl(value) {
  try {
    const url = new URL(value);
    return ["youtube.com", "www.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function setText(element, value) {
  if (element) element.textContent = value ?? "";
}

export function setVisible(element, visible) {
  if (!element) return;
  element.hidden = !visible;
  element.setAttribute("aria-hidden", visible ? "false" : "true");
}
