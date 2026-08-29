import {
  deriveLiveView,
  formatDailyPrayerInvitation,
  formatDday,
  formatKoreanDate,
  formatKoreanTime,
  formatRemaining,
  getDday,
  getOrCreateStorageId,
  normalizePrayerSubmission,
  setText,
  setVisible,
  zonedDateKey,
} from "./core.js?v=20260829-4";
import { createPrayerService } from "./backend.js?v=20260829-4";
import { PrayerPresenceCanvas } from "./presence-canvas.js?v=20260829-4";
import { RealtimeSetupCoordinator } from "./realtime-setup.js?v=20260829-4";

const config = globalThis.RETREAT_PRAYER_CONFIG || {};
const REALTIME_STAGGER_MAX_MS = 16_000;
const PRESENCE_STAGGER_MAX_MS = 16_000;
const REALTIME_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000];
const state = {
  service: null,
  data: null,
  view: "loading",
  serviceMode: "unknown",
  serverOffsetMs: 0,
  presenceCount: null,
  presenceSynced: false,
  presenceStatus: "connecting",
  livePresenceContext: "가 함께 기도 중입니다",
  presenceDisconnect: null,
  presenceContext: null,
  presenceDesiredContext: null,
  presenceSnapshots: new Map(),
  presenceGeneration: 0,
  presenceUpdateInFlight: 0,
  liveUnsubscribe: null,
  contentUnsubscribe: null,
  realtimeCoordinator: null,
  realtimeReady: false,
  restartingRealtime: false,
  bootGeneration: 0,
  presenceCanvas: null,
  miniCanvas: null,
  sessionId: null,
  tabId: null,
  joinedLive: false,
  audioEnabled: false,
  activeMediaKey: null,
  personalFocus: null,
  requestOrder: "curated",
  announcedMilestones: new Set(),
  syncingAutomaticState: false,
  automaticSyncRetryAt: 0,
  currentDateKey: null,
  refreshingDaily: false,
  refreshingContent: false,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const views = {
  loading: $("#view-loading"),
  config: $("#view-config"),
  home: $("#view-home"),
  live: $("#view-live"),
  today: $("#view-today"),
  personal: $("#view-personal-focus"),
  requests: $("#view-requests"),
  complete: $("#view-complete"),
};

function announce(message) {
  setText($("#app-announcer"), "");
  requestAnimationFrame(() => setText($("#app-announcer"), message));
}

function showConnection(message, { connected = false, persistent = false, status = null } = {}) {
  const banner = $("#connection-banner");
  const dot = $(".status-dot", banner);
  setText($("#connection-message"), message);
  dot?.classList.toggle("status-dot--live", connected);
  banner.dataset.state = status || (connected ? "connected" : "reconnecting");
  banner.setAttribute("aria-label", message);
  banner.title = message;
  setVisible(banner, true);
  clearTimeout(showConnection.timeout);
  if (!persistent) showConnection.timeout = setTimeout(() => setVisible(banner, false), 2600);
}

function setCurrentNav(name) {
  $$('[data-route]').forEach((item) => {
    const active = item.dataset.route === name;
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
}

function getRealtimeStaggerDelay(scope, maximumDelayMs = REALTIME_STAGGER_MAX_MS) {
  const seed = `${state.tabId || "tab"}:${scope}`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % (maximumDelayMs + 1);
}

function waitForRealtimeStagger(scope, minimumDelayMs = 0, maximumDelayMs = REALTIME_STAGGER_MAX_MS) {
  const delay = minimumDelayMs + getRealtimeStaggerDelay(scope, maximumDelayMs);
  return delay > 0 ? new Promise((resolve) => setTimeout(resolve, delay)) : Promise.resolve();
}

async function setPresenceContext(context, { stagger = true, minimumDelayMs = 0 } = {}) {
  if (!state.service) return;
  const generation = ++state.presenceGeneration;
  state.presenceDesiredContext = context;
  if (state.presenceContext === context && state.presenceDisconnect && state.presenceUpdateInFlight === 0) {
    const snapshot = state.presenceSnapshots.get(context);
    if (snapshot) {
      state.presenceSynced = snapshot.synced;
      state.presenceCount = snapshot.count;
      state.presenceStatus = snapshot.status;
      renderPresence();
    }
    return;
  }
  state.presenceSynced = false;
  state.presenceCount = null;
  state.presenceStatus = "connecting";
  renderPresence();
  if (stagger) await waitForRealtimeStagger(`presence:${context}`, minimumDelayMs, PRESENCE_STAGGER_MAX_MS);
  if (generation !== state.presenceGeneration || state.presenceDesiredContext !== context) return;
  const receivePresence = (presence) => {
    const snapshot = {
      synced: Boolean(presence.synced),
      count: presence.count,
      status: presence.status || (presence.synced ? "connected" : "connecting"),
    };
    state.presenceSnapshots.set(context, snapshot);
    if (generation !== state.presenceGeneration || state.presenceDesiredContext !== context) return;
    state.presenceSynced = snapshot.synced;
    state.presenceCount = snapshot.count;
    state.presenceStatus = snapshot.status;
    renderPresence();
    if (presence.status === "reconnecting") {
      showConnection("실시간 연결을 다시 확인하고 있습니다.", { persistent: true });
    } else if (presence.status === "connected") {
      showConnection("공동체의 기도 공간과 다시 연결되었습니다.", { connected: true });
    }
  };
  state.presenceUpdateInFlight += 1;
  try {
    if (state.presenceDisconnect && typeof state.service.updatePresenceContext === "function") {
      await state.service.updatePresenceContext(
        { sessionId: state.sessionId, tabId: state.tabId, context },
        receivePresence,
      );
      if (generation !== state.presenceGeneration || state.presenceDesiredContext !== context) return;
      state.presenceContext = context;
      return;
    }
    const disconnect = await state.service.connectPresence(
      { sessionId: state.sessionId, tabId: state.tabId, context },
      receivePresence,
    );
    if (generation !== state.presenceGeneration) {
      await disconnect();
      return;
    }
    state.presenceDisconnect = disconnect;
    state.presenceContext = context;
  } catch (error) {
    if (generation === state.presenceGeneration) {
      state.presenceContext = null;
      state.presenceStatus = "unavailable";
      renderPresence();
    }
    throw error;
  } finally {
    state.presenceUpdateInFlight = Math.max(0, state.presenceUpdateInFlight - 1);
  }
}

function showView(name, { updateHash = true, focusMain = true, updatePresence = true } = {}) {
  if (!views[name]) name = "home";
  Object.entries(views).forEach(([key, element]) => setVisible(element, key === name));
  state.view = name;
  const isFocus = ["live", "personal"].includes(name);
  document.body.classList.toggle("is-focus", isFocus);
  setCurrentNav(name === "personal" || name === "complete" ? "" : name);
  if (updateHash && !["personal", "complete", "config", "loading"].includes(name)) {
    history.replaceState(null, "", `#${name}`);
  }
  if (focusMain) $("#prayer-main")?.focus({ preventScroll: true });
  if (updatePresence && state.realtimeReady) {
    setPresenceContext(name === "live" ? "live" : "space").catch(handleError);
  }
  if (name === "live" && state.data) renderLive();
}

function renderPresence() {
  const text = state.presenceSynced && Number.isFinite(state.presenceCount)
    ? `${state.presenceCount}명의 지체`
    : state.presenceStatus === "reconnecting" || state.presenceStatus === "unavailable"
      ? "인원 확인 일시 중단"
      : "연결 확인 중";
  const liveText = state.presenceSynced && Number.isFinite(state.presenceCount)
    ? `${state.presenceCount}명의 지체`
    : state.presenceStatus === "reconnecting" || state.presenceStatus === "unavailable"
      ? "인원 확인 일시 중단"
      : "인원 확인 중";
  setText($("#presence-count"), text);
  setText($("#header-presence"), text);
  setText($("#live-presence-count"), liveText);
  setText($("#live-presence-context"), state.presenceSynced ? state.livePresenceContext : "");
  setText(
    $("#live-connection-state"),
    state.presenceSynced
      ? "지체 수 동기화됨"
      : state.presenceStatus === "reconnecting" || state.presenceStatus === "unavailable"
        ? "연결이 돌아오면 인원 수를 다시 확인합니다"
        : "인원 수 확인 중",
  );
  const visualCount = state.presenceSynced ? state.presenceCount || 0 : 0;
  state.presenceCanvas?.setCount(visualCount);
  state.miniCanvas?.setCount(visualCount);
}

function setLivePresenceContext(message) {
  state.livePresenceContext = message;
  setText($("#live-presence-context"), state.presenceSynced ? message : "");
}

function getNextPrayerCopy() {
  const live = state.data?.liveSession;
  const now = Date.now() + state.serverOffsetMs;
  const view = deriveLiveView(live, now);
  if ((live?.status === "live" || live?.status === "paused") && view.status !== "completed") {
    return "지금 공동기도가 진행 중입니다.";
  }
  if (live?.scheduled_for && Date.parse(live.scheduled_for) > now) {
    return `다음 공동기도는 ${formatKoreanTime(live.scheduled_for, config.timeZone)}에 시작됩니다.`;
  }
  const configuredPrayerTime = state.data?.settings?.daily_prayer_time ?? config.dailyPrayerTime;
  return formatDailyPrayerInvitation(configuredPrayerTime);
}

function maybeSyncAutomaticState(view) {
  const live = state.data?.liveSession;
  const serverNow = Date.now() + state.serverOffsetMs;
  const shouldStart = live?.mode === "auto" && live?.status === "scheduled" && Date.parse(live?.scheduled_for) <= serverNow;
  const shouldComplete = live?.mode === "auto" && live?.status === "live" && view?.status === "completed";
  if (state.syncingAutomaticState || serverNow < state.automaticSyncRetryAt || (!shouldStart && !shouldComplete)) return;
  state.syncingAutomaticState = true;
  state.service.syncLive()
    .then((synced) => {
      if (synced) state.data.liveSession = synced;
      state.automaticSyncRetryAt = 0;
      renderHome();
      if (state.view === "live") renderLive();
    })
    .catch((error) => {
      state.automaticSyncRetryAt = Date.now() + state.serverOffsetMs + 30_000;
      handleError(error);
    })
    .finally(() => { state.syncingAutomaticState = false; });
}

function renderHome() {
  const { settings, dailyPrayer, liveSession } = state.data;
  const liveView = deriveLiveView(liveSession, Date.now() + state.serverOffsetMs);
  const liveNow = ["live", "paused"].includes(liveSession?.status) && liveView.status !== "completed";
  maybeSyncAutomaticState(liveView);
  const retreatDate = settings?.retreat_date || config.retreatDate;
  const serverDate = new Date(Date.now() + state.serverOffsetMs);
  setText($("#dday-label"), formatDday(getDday(retreatDate, serverDate, settings?.time_zone || config.timeZone)));
  setText($("#next-prayer-copy"), getNextPrayerCopy());
  const hasPublishedDaily = Boolean(dailyPrayer);
  const hasScripture = Boolean(dailyPrayer?.scripture_text?.trim() || dailyPrayer?.scripture_reference?.trim());
  setVisible($("#home-scripture-card"), !hasPublishedDaily || hasScripture);
  setText($("#home-scripture"), hasPublishedDaily ? dailyPrayer?.scripture_text || "" : "오늘의 말씀이 곧 준비됩니다.");
  setText($("#home-scripture-reference"), dailyPrayer?.scripture_reference || "");
  setText($("#home-topic"), dailyPrayer?.prayer_topic || "오늘 함께 기도할 제목이 곧 준비됩니다.");
  setText(
    $("#home-live-cta"),
    liveNow ? "◌  지금 함께 기도하기" : "◌  같이 기도하기"
  );
}

function renderToday() {
  const daily = state.data?.dailyPrayer;
  const hasPublishedDaily = Boolean(daily);
  const hasScripture = Boolean(daily?.scripture_text?.trim() || daily?.scripture_reference?.trim());
  setText($("#today-date"), formatKoreanDate(new Date(Date.now() + state.serverOffsetMs), state.data?.settings?.time_zone || config.timeZone));
  setVisible($("#today-scripture-card"), !hasPublishedDaily || hasScripture);
  $(".ritual-layout")?.classList.toggle("ritual-layout--without-scripture", hasPublishedDaily && !hasScripture);
  setText($("#today-scripture"), hasPublishedDaily ? daily?.scripture_text || "" : "오늘의 말씀이 곧 준비됩니다.");
  setText($("#today-scripture-reference"), daily?.scripture_reference || "");
  setText($("#today-topic"), daily?.prayer_topic || "오늘 함께 기도할 제목이 곧 준비됩니다.");
}

function getOrderedRequests() {
  const requests = [...(state.data?.requests || [])];
  if (state.requestOrder === "latest") {
    requests.sort((a, b) => Date.parse(b.approved_at || b.created_at) - Date.parse(a.approved_at || a.created_at));
  } else if (state.requestOrder === "random") {
    const timeZone = state.data?.settings?.time_zone || config.timeZone;
    const dayKey = zonedDateKey(new Date(Date.now() + state.serverOffsetMs), timeZone);
    const hash = (value) => {
      let result = 2166136261;
      for (const character of value) result = Math.imul(result ^ character.codePointAt(0), 16777619);
      return result >>> 0;
    };
    requests.sort((a, b) => hash(`${dayKey}:${a.id}`) - hash(`${dayKey}:${b.id}`));
  }
  return requests;
}

function renderRequests() {
  const list = $("#request-list");
  const requests = getOrderedRequests();
  list.replaceChildren();
  setText($("#request-count-label"), requests.length ? `${requests.length}개의 기도제목이 공동체에 나누어졌습니다.` : "공개된 기도제목이 없습니다.");
  setVisible($("#request-empty"), requests.length === 0);
  requests.forEach((request) => {
    const article = document.createElement("article");
    article.className = "request-card";
    const author = document.createElement("p");
    author.className = "request-card__author";
    author.textContent = request.is_anonymous ? "익명" : request.display_name || "익명";
    const body = document.createElement("p");
    body.className = "request-card__body";
    body.textContent = request.body;
    const button = document.createElement("button");
    button.className = "text-link";
    button.type = "button";
    button.dataset.action = "focus-request";
    button.dataset.requestId = request.id;
    button.textContent = "이 제목으로 기도하기  →";
    article.append(author, body, button);
    list.append(article);
  });
}

function renderLive() {
  const live = state.data?.liveSession;
  const view = deriveLiveView(live, Date.now() + state.serverOffsetMs);
  const step = view.step;
  maybeSyncAutomaticState(view);
  if (live?.status === "completed" || view.status === "completed") {
    if (state.view === "live") completePrayer("오늘의 공동기도를 마쳤습니다.");
    return;
  }
  if (!["live", "paused"].includes(live?.status)) {
    setText($("#live-stage-number"), "공동기도 준비");
    setText($("#live-stage-label"), "함께 기다리는 시간");
    setText($("#live-scripture-reference"), "");
    setText($("#live-heading"), getNextPrayerCopy());
    setText($("#live-timer"), "시작되면 같은 기도 흐름으로 이어집니다");
    setText($("#live-mode-label"), live?.mode === "auto" ? "사전 설정에 따라 시작됩니다" : "진행자가 곧 시작합니다");
    setLivePresenceContext("이 함께 기다리고 있습니다");
    $("#live-progress").value = 0;
    if (state.activeMediaKey !== null) {
      state.activeMediaKey = null;
      stopMediaPlayback();
    }
    return;
  }
  if (!step) {
    setText($("#live-stage-label"), "공동기도 준비 중");
    setText($("#live-heading"), "진행자가 기도 내용을 준비하고 있습니다.");
    setText($("#live-timer"), "잠시만 기다려주세요");
    return;
  }
  setText($("#live-stage-number"), `단계 ${view.stageIndex + 1} / ${view.steps.length}`);
  setText($("#live-stage-label"), step.label);
  setText($("#live-scripture-reference"), step.scriptureReference);
  setText($("#live-heading"), step.content);
  setText($("#live-timer"), view.status === "paused" ? "기도 흐름이 잠시 머물러 있습니다" : formatRemaining(view.remainingSeconds));
  setText($("#live-mode-label"), live.mode === "auto" ? "사전 설정에 따라 진행 중" : "진행자와 함께하는 기도");
  setLivePresenceContext("가 함께 기도 중입니다");
  $("#live-progress").value = view.progress;

  const media = getCurrentMedia(view);
  const mediaKey = media ? `${view.stageIndex}:${media.id || media.source_url}` : `${view.stageIndex}:none`;
  if (mediaKey !== state.activeMediaKey) {
    state.activeMediaKey = mediaKey;
    stopMediaPlayback();
    if (state.joinedLive && state.audioEnabled && media) startConfiguredMedia(view).catch(handleError);
  }

  const milestone = view.remainingSeconds <= 0 ? 0 : view.remainingSeconds <= 60 ? 60 : view.remainingSeconds <= 300 ? 300 : null;
  const milestoneKey = `${view.stageIndex}:${milestone}`;
  if (milestone !== null && !state.announcedMilestones.has(milestoneKey)) {
    state.announcedMilestones.add(milestoneKey);
    if (milestone === 300) announce("현재 기도 단계가 5분 남았습니다.");
    if (milestone === 60) announce("현재 기도 단계가 1분 남았습니다.");
    if (milestone === 0) announce("현재 기도 단계가 마무리되었습니다.");
  }

}

function renderAll() {
  renderHome();
  renderToday();
  renderRequests();
  renderLive();
  renderPresence();
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function startTodayPrayer() {
  const daily = state.data?.dailyPrayer;
  state.personalFocus = {
    type: "today",
    author: "오늘의 기도",
    body: daily?.prayer_topic || "수련회를 위해 함께 기도합니다.",
    scripture: daily?.scripture_text || "",
    reference: daily?.scripture_reference || "",
  };
  renderPersonalFocus();
  showView("personal", { updateHash: false });
}

function focusRequest(id) {
  const request = state.data?.requests?.find((item) => String(item.id) === String(id));
  if (!request) return;
  const daily = state.data?.dailyPrayer;
  state.personalFocus = {
    type: "request",
    requestId: request.id,
    author: request.is_anonymous ? "익명의 기도제목" : `${request.display_name || "익명"}님의 기도제목`,
    body: request.body,
    scripture: daily?.scripture_text || "",
    reference: daily?.scripture_reference || "",
  };
  renderPersonalFocus();
  showView("personal", { updateHash: false });
}

function renderPersonalFocus() {
  const focus = state.personalFocus;
  if (!focus) return;
  setText($("#personal-focus-context"), focus.type === "today" ? "오늘의 기도" : "한 사람을 위한 중보");
  setText($("#personal-focus-author"), focus.author);
  setText($("#personal-focus-title"), focus.body);
  setText($("#personal-focus-scripture"), focus.scripture);
  setText($("#personal-focus-reference"), focus.reference);
  setVisible($("#personal-focus-scripture"), Boolean(focus.scripture));
  setVisible($("#personal-focus-reference"), Boolean(focus.reference));
}

function clearPersonalFocus() {
  state.personalFocus = null;
  setText($("#personal-focus-context"), "집중 기도");
  setText($("#personal-focus-author"), "");
  setText($("#personal-focus-title"), "");
  setText($("#personal-focus-scripture"), "");
  setText($("#personal-focus-reference"), "");
}

function applyPublicContent(content) {
  const currentRevision = Number(state.data?.contentRevision || 0);
  const nextRevision = Number(content?.contentRevision || 0);
  if (nextRevision < currentRevision) return;

  if (content.serverNow) state.serverOffsetMs = Date.parse(content.serverNow) - Date.now();
  state.data.settings = content.settings;
  state.data.dailyPrayer = content.dailyPrayer;
  state.data.requests = content.requests || [];
  state.data.contentRevision = nextRevision;
  state.currentDateKey = zonedDateKey(
    new Date(Date.now() + state.serverOffsetMs),
    content.settings?.time_zone || config.timeZone,
  );
  renderHome();
  renderToday();
  renderRequests();

  if (state.personalFocus?.type !== "request") return;
  const request = state.data.requests.find((item) => String(item.id) === String(state.personalFocus.requestId));
  if (!request) {
    clearPersonalFocus();
    if (state.view === "personal") showView("requests");
    queueMicrotask(() => showConnection("이 기도제목은 더 이상 공개되지 않아 목록에서 제거되었습니다."));
    announce("공개 상태가 변경된 기도제목을 화면에서 제거했습니다.");
    return;
  }
  state.personalFocus = {
    ...state.personalFocus,
    author: request.is_anonymous ? "익명의 기도제목" : `${request.display_name || "익명"}님의 기도제목`,
    body: request.body,
  };
  if (state.view === "personal") renderPersonalFocus();
}

function completePrayer(message) {
  setText($("#complete-message"), message || "각자의 자리에서 드린 기도가 공동체 안에 조용히 더해졌습니다.");
  setText($("#complete-next"), getNextPrayerCopy());
  pauseMedia();
  showView("complete", { updateHash: false });
}

function stopMediaPlayback() {
  const audio = $("#prayer-audio");
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

function pauseMedia() {
  stopMediaPlayback();
  state.audioEnabled = false;
  $("#audio-toggle")?.setAttribute("aria-pressed", "false");
  $("#audio-toggle")?.setAttribute("aria-label", "음악 켜기");
}

function getCurrentMedia(view = deriveLiveView(state.data?.liveSession, Date.now() + state.serverOffsetMs)) {
  if (!["live", "paused"].includes(state.data?.liveSession?.status)) return null;
  const legacy = state.data?.liveSession?.media;
  if (legacy?.stage_index === view.stageIndex) {
    if (legacy.stopped) return null;
    if (legacy.source_url) return legacy;
  }
  if (view?.step?.media?.source_url && view.step.media.active !== false) return view.step.media;
  const mediaId = view?.step?.mediaId;
  return mediaId ? state.data?.media?.find((item) => String(item.id) === String(mediaId) && item.active) : null;
}

async function startConfiguredMedia(view) {
  const mediaConfig = getCurrentMedia(view);
  if (!state.audioEnabled || !mediaConfig?.source_url) return;
  stopMediaPlayback();
  if (mediaConfig.kind === "youtube") {
    showConnection("YouTube 음악은 광고 없는 재생을 보장할 수 없어 재생하지 않습니다.", { persistent: true, status: "warning" });
    return;
  }
  const audio = $("#prayer-audio");
  audio.src = mediaConfig.source_url;
  audio.currentTime = Number(mediaConfig.start_seconds) || 0;
  await audio.play().catch(() => {
    state.audioEnabled = false;
    $("#audio-toggle")?.setAttribute("aria-pressed", "false");
    $("#audio-toggle")?.setAttribute("aria-label", "음악 켜기");
    showConnection("브라우저가 음악 재생을 막았습니다. 음악 버튼을 눌러 다시 시작해주세요.", { persistent: true, status: "warning" });
  });
}

async function toggleAudio() {
  state.audioEnabled = !state.audioEnabled;
  $("#audio-toggle")?.setAttribute("aria-pressed", String(state.audioEnabled));
  $("#audio-toggle")?.setAttribute("aria-label", state.audioEnabled ? "음악 끄기" : "음악 켜기");
  if (state.audioEnabled) await startConfiguredMedia();
  else pauseMedia();
}

function enterLivePrayer({ updatePresence = true } = {}) {
  const firstJoin = !state.joinedLive;
  const enteringFromAnotherView = state.view !== "live";
  if (firstJoin) {
    state.audioEnabled = true;
    state.joinedLive = true;
    $("#audio-toggle")?.setAttribute("aria-pressed", "true");
    $("#audio-toggle")?.setAttribute("aria-label", "음악 끄기");
  }
  if (enteringFromAnotherView) state.activeMediaKey = null;
  showView("live", { updatePresence });
  announce("공동기도 화면에 들어왔습니다. 설정된 음악이 있으면 함께 재생됩니다.");
}

function showFormErrors(errors) {
  const fields = [
    ["displayName", "#request-name", "#request-name-error"],
    ["body", "#request-body", "#request-body-error"],
    ["consent", "#request-consent", "#request-consent-error"],
  ];
  fields.forEach(([key, inputSelector, errorSelector]) => {
    const input = $(inputSelector);
    const message = errors[key] || "";
    setText($(errorSelector), message);
    input?.setAttribute("aria-invalid", message ? "true" : "false");
  });
}

async function submitPrayerRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const normalized = normalizePrayerSubmission({
    displayName: form.displayName.value,
    body: form.body.value,
    isAnonymous: form.isAnonymous.checked,
    consent: form.consent.checked,
  });
  showFormErrors(normalized.errors);
  if (!normalized.valid) {
    const firstKey = Object.keys(normalized.errors)[0];
    const selector = firstKey === "displayName" ? "#request-name" : firstKey === "body" ? "#request-body" : "#request-consent";
    $(selector)?.focus();
    return;
  }
  const button = $("#request-submit-button");
  button.disabled = true;
  setText($("#request-form-status"), "기도제목을 안전하게 전달하고 있습니다.");
  try {
    await state.service.submitPrayerRequest({
      ...normalized.value,
      sessionId: state.sessionId,
    });
    form.reset();
    setText($("#request-character-count"), "0 / 800");
    showFormErrors({});
    setText($("#request-form-status"), "기도제목이 관리자에게 전달되었습니다. 검토 후 공동체 기도제목으로 공개됩니다.");
    announce("기도제목이 관리자에게 전달되었습니다.");
    setTimeout(() => closeDialog($("#submit-dialog")), 1800);
  } catch (error) {
    setText($("#request-form-status"), error.message || "기도제목을 전달하지 못했습니다. 잠시 후 다시 시도해주세요.");
  } finally {
    button.disabled = false;
  }
}

function routeFromHash() {
  const candidate = location.hash.slice(1);
  return ["home", "live", "today", "requests"].includes(candidate) ? candidate : "home";
}

function handleRoute(route) {
  if (route === "live") return enterLivePrayer();
  if (state.view === "live") {
    stopMediaPlayback();
    state.activeMediaKey = null;
  }
  showView(route);
}

function handleClick(event) {
  const routeTarget = event.target.closest("[data-route]");
  if (routeTarget) {
    event.preventDefault();
    handleRoute(routeTarget.dataset.route);
    return;
  }
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  if (action === "retry") boot();
  if (action === "join-live") enterLivePrayer();
  if (action === "toggle-audio") toggleAudio();
  if (action === "start-today") startTodayPrayer();
  if (action === "focus-request") focusRequest(actionTarget.dataset.requestId);
  if (action === "exit-personal-focus") showView(state.personalFocus?.type === "request" ? "requests" : "today");
  if (action === "complete-personal-prayer") completePrayer();
  if (action === "open-submit") {
    const dialog = $("#submit-dialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  if (action === "close-submit") closeDialog($("#submit-dialog"));
}

function handleError(error) {
  console.error(error);
  showConnection(error?.message || "연결 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.", { persistent: true, status: "error" });
}

function receiveLiveSession(liveSession) {
  const previousVersion = state.data?.liveSession?.version;
  if (Number(liveSession?.version ?? -1) < Number(previousVersion ?? -1)) return;
  state.data.liveSession = liveSession;
  state.announcedMilestones.clear();
  renderHome();
  renderLive();
  if (previousVersion !== undefined && liveSession.version !== previousVersion) {
    announce("공동기도 진행 내용이 새로 동기화되었습니다.");
  }
}

function handleLiveRealtimeStatus(status, error) {
  if (status === "reconnecting") {
    showConnection("공동기도 진행 연결을 다시 확인하고 있습니다. 마지막으로 받은 내용을 유지합니다.", { persistent: true });
  }
  if (status === "failed") {
    showConnection("공동기도 진행 연결을 다시 준비하고 있습니다. 마지막으로 받은 내용을 유지합니다.", { persistent: true, status: "error" });
    void restartRealtimeSubscriptions(error || new Error("Realtime Postgres Changes subscription became unavailable."));
  }
  if (status === "connected") showConnection("공동기도 진행과 다시 연결되었습니다.", { connected: true });
}

function handleContentRealtimeStatus(status) {
  if (status === "reconnecting") {
    showConnection("공개 기도제목과 오늘의 말씀을 다시 확인하고 있습니다. 마지막으로 받은 내용을 잠시 유지합니다.", { persistent: true });
  }
  if (status === "connected") showConnection("공개 기도 콘텐츠를 다시 확인했습니다.", { connected: true });
}

async function reconcileRealtimeSnapshot(service = state.service) {
  const [liveSession, publicContent] = await Promise.all([
    typeof service?.fetchLiveSession === "function"
      ? service.fetchLiveSession()
      : Promise.resolve(state.data?.liveSession),
    service.fetchPublicContent(),
  ]);
  if (service !== state.service) return false;
  if (liveSession) receiveLiveSession(liveSession);
  if (publicContent) applyPublicContent(publicContent);
  return true;
}

async function restartRealtimeSubscriptions(error) {
  if (state.restartingRealtime || !state.realtimeCoordinator) return;
  const coordinator = state.realtimeCoordinator;
  state.restartingRealtime = true;
  state.realtimeReady = false;
  const previousLiveUnsubscribe = state.liveUnsubscribe;
  const previousContentUnsubscribe = state.contentUnsubscribe;
  state.liveUnsubscribe = null;
  state.contentUnsubscribe = null;
  try {
    await Promise.allSettled([previousLiveUnsubscribe?.(), previousContentUnsubscribe?.()]);
    if (state.realtimeCoordinator === coordinator) coordinator.retry(error);
  } finally {
    state.restartingRealtime = false;
  }
}

async function installRealtimeSubscriptions(service, coordinator) {
  await service.prepareRealtime?.();
  if (state.service !== service || state.realtimeCoordinator !== coordinator) return;
  let nextLiveUnsubscribe = null;
  let nextContentUnsubscribe = null;
  const isCurrentInstall = () => state.service === service && state.realtimeCoordinator === coordinator;
  try {
    nextLiveUnsubscribe = await service.subscribeParticipantUpdates(
      (liveSession) => {
        if (isCurrentInstall()) receiveLiveSession(liveSession);
      },
      (publicContent) => {
        if (isCurrentInstall()) applyPublicContent(publicContent);
      },
      (status, error) => {
        if (isCurrentInstall()) handleLiveRealtimeStatus(status, error);
      },
      (status, error) => {
        if (isCurrentInstall()) handleContentRealtimeStatus(status, error);
      },
    );
    if (state.service !== service || state.realtimeCoordinator !== coordinator) {
      await nextLiveUnsubscribe?.();
      return;
    }
    await reconcileRealtimeSnapshot(service);
  } catch (error) {
    await Promise.allSettled([nextLiveUnsubscribe?.(), nextContentUnsubscribe?.()]);
    throw error;
  }

  if (state.service !== service || state.realtimeCoordinator !== coordinator) {
    await Promise.allSettled([nextLiveUnsubscribe?.(), nextContentUnsubscribe?.()]);
    return;
  }

  const previousLiveUnsubscribe = state.liveUnsubscribe;
  const previousContentUnsubscribe = state.contentUnsubscribe;
  state.liveUnsubscribe = nextLiveUnsubscribe;
  state.contentUnsubscribe = nextContentUnsubscribe;
  await Promise.allSettled([previousLiveUnsubscribe?.(), previousContentUnsubscribe?.()]);
}

function createRealtimeCoordinator(service) {
  state.realtimeCoordinator?.stop();
  let coordinator;
  coordinator = new RealtimeSetupCoordinator({
    install: () => installRealtimeSubscriptions(service, coordinator),
    delays: REALTIME_RETRY_DELAYS_MS.map((delay) => delay + getRealtimeStaggerDelay("retry")),
    onFailure: (error) => {
      console.error(error);
      if (!state.presenceDisconnect) {
        state.presenceStatus = "unavailable";
        renderPresence();
      }
      showConnection("실시간 연결을 준비하지 못했지만, 마지막으로 받은 기도 내용은 계속 볼 수 있습니다.", { persistent: true, status: "error" });
    },
    onSuccess: () => {
      if (state.realtimeCoordinator !== coordinator) return;
      state.realtimeReady = true;
      setPresenceContext(state.view === "live" ? "live" : "space", {
        minimumDelayMs: REALTIME_STAGGER_MAX_MS,
      }).catch(handleError);
    },
  });
  return coordinator;
}

async function startRealtimeAfterStagger(coordinator) {
  await waitForRealtimeStagger("startup");
  if (state.realtimeCoordinator !== coordinator) return;
  await coordinator.start();
}

async function boot() {
  const generation = ++state.bootGeneration;
  showView("loading", { updateHash: false, focusMain: false });
  try {
    state.realtimeCoordinator?.stop();
    const previousLiveUnsubscribe = state.liveUnsubscribe;
    const previousContentUnsubscribe = state.contentUnsubscribe;
    const previousPresenceDisconnect = state.presenceDisconnect;
    state.realtimeCoordinator = null;
    state.liveUnsubscribe = null;
    state.contentUnsubscribe = null;
    state.presenceDisconnect = null;
    await Promise.allSettled([
      previousLiveUnsubscribe?.(),
      previousContentUnsubscribe?.(),
      previousPresenceDisconnect?.(),
    ]);
    if (generation !== state.bootGeneration) return;
    state.presenceContext = null;
    state.presenceDesiredContext = null;
    state.presenceSnapshots.clear();
    state.realtimeReady = false;
    state.restartingRealtime = false;
    state.presenceGeneration += 1;
    state.sessionId = getOrCreateStorageId(localStorage, "retreat-prayer-session-id");
    state.tabId = getOrCreateStorageId(sessionStorage, "retreat-prayer-tab-id");
    const service = await createPrayerService(config);
    if (generation !== state.bootGeneration) return;
    state.service = service;
    state.serviceMode = service.mode;
    setVisible($("#preview-ribbon"), state.serviceMode === "preview");
    const serverTime = await service.getServerTime();
    if (generation !== state.bootGeneration || state.service !== service) return;
    state.serverOffsetMs = Date.parse(serverTime) - Date.now();
    const publicData = await service.loadPublicData(serverTime);
    if (generation !== state.bootGeneration || state.service !== service) return;
    state.data = publicData;
    state.currentDateKey = zonedDateKey(new Date(serverTime), state.data?.settings?.time_zone || config.timeZone);
    renderAll();
    state.realtimeCoordinator = createRealtimeCoordinator(service);
    const route = routeFromHash();
    showView(route === "live" ? "home" : route, { updateHash: false, focusMain: false, updatePresence: false });
    if (route === "live") enterLivePrayer({ updatePresence: false });
    void startRealtimeAfterStagger(state.realtimeCoordinator);
  } catch (error) {
    if (generation !== state.bootGeneration) return;
    if (error?.code === "CONFIG_REQUIRED") {
      showView("config", { updateHash: false });
      setVisible($("#preview-ribbon"), false);
      return;
    }
    handleError(error);
    showView("config", { updateHash: false });
  }
}

async function refreshForNewChurchDay() {
  if (!state.data || state.refreshingDaily) return;
  const timeZone = state.data?.settings?.time_zone || config.timeZone;
  const dateKey = zonedDateKey(new Date(Date.now() + state.serverOffsetMs), timeZone);
  if (dateKey === state.currentDateKey) return;
  state.refreshingDaily = true;
  try {
    const serverTime = await state.service.getServerTime();
    state.serverOffsetMs = Date.parse(serverTime) - Date.now();
    const fresh = await state.service.loadPublicData(serverTime);
    state.data = fresh;
    state.currentDateKey = dateKey;
    renderAll();
    announce("새로운 하루의 말씀과 기도제목이 준비되었습니다.");
  } catch (error) {
    handleError(error);
  } finally {
    state.refreshingDaily = false;
  }
}

async function revalidatePublicContent({ reportError = false } = {}) {
  if (!state.data || state.refreshingContent || !state.service?.fetchPublicContent) return;
  state.refreshingContent = true;
  try {
    applyPublicContent(await state.service.fetchPublicContent());
  } catch (error) {
    if (reportError) handleError(error);
  } finally {
    state.refreshingContent = false;
  }
}

document.addEventListener("click", handleClick);
$("#prayer-request-form")?.addEventListener("submit", submitPrayerRequest);
$("#request-body")?.addEventListener("input", (event) => {
  setText($("#request-character-count"), `${event.target.value.length} / 800`);
});
$("#request-anonymous")?.addEventListener("change", (event) => {
  $("#request-name").disabled = event.target.checked;
  if (event.target.checked) {
    setText($("#request-name-error"), "");
    $("#request-name").setAttribute("aria-invalid", "false");
  }
});
$("#request-sort")?.addEventListener("change", (event) => {
  state.requestOrder = event.target.value;
  renderRequests();
});
globalThis.addEventListener("hashchange", () => {
  if (!state.data) return;
  handleRoute(routeFromHash());
});
globalThis.addEventListener("offline", () => showConnection("인터넷 연결이 끊겼습니다. 마지막으로 받은 기도 내용을 유지합니다.", { persistent: true, status: "offline" }));
globalThis.addEventListener("online", () => {
  showConnection("연결을 다시 확인하고 있습니다.", { connected: true });
  revalidatePublicContent({ reportError: true });
  void state.realtimeCoordinator?.start();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") revalidatePublicContent();
});
globalThis.addEventListener("pagehide", () => {
  state.bootGeneration += 1;
  state.presenceGeneration += 1;
  state.presenceDesiredContext = null;
  state.realtimeCoordinator?.stop();
  state.realtimeCoordinator = null;
  const previousPresenceDisconnect = state.presenceDisconnect;
  const previousLiveUnsubscribe = state.liveUnsubscribe;
  const previousContentUnsubscribe = state.contentUnsubscribe;
  state.presenceDisconnect = null;
  state.liveUnsubscribe = null;
  state.contentUnsubscribe = null;
  void Promise.allSettled([
    previousPresenceDisconnect?.(),
    previousLiveUnsubscribe?.(),
    previousContentUnsubscribe?.(),
  ]);
  state.presenceCanvas?.stop();
  state.miniCanvas?.stop();
});
globalThis.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  state.presenceCanvas?.start();
  state.miniCanvas?.start();
  void boot();
});

state.presenceCanvas = new PrayerPresenceCanvas($("#presence-canvas"), { count: 0 });
if (!state.presenceCanvas.start()) setVisible($("#presence-fallback"), true);
state.miniCanvas = new PrayerPresenceCanvas($("#mini-presence-canvas"), { count: 0, variant: "live-backdrop" });
if (!state.miniCanvas.start()) setVisible($("#live-presence-fallback"), true);

setInterval(() => {
  if (!state.data) return;
  if (state.view === "live") renderLive();
  if (state.view === "home") renderHome();
}, 1000);
setInterval(refreshForNewChurchDay, 30_000);
setInterval(revalidatePublicContent, 60_000);

boot();
