import {
  createId,
  deriveLiveView,
  formatRemaining,
  setText,
  setVisible,
  zonedDateKey,
} from "./core.js";
import { createPrayerService } from "./backend.js";

const config = globalThis.RETREAT_PRAYER_CONFIG || {};
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  service: null,
  mode: "unknown",
  snapshot: null,
  profile: null,
  route: "live",
  leaseToken: null,
  leaseExpiresAt: null,
  serverOffsetMs: 0,
  presenceCount: null,
  presenceSynced: false,
  presenceDisconnect: null,
  liveUnsubscribe: null,
  liveConnected: false,
  leaseInterval: null,
  pendingAdminSession: null,
  confirmation: null,
};

const panelMeta = {
  live: ["Live Prayer", "실시간 공동기도 진행"],
  program: ["Run of Show", "공동기도 순서 구성"],
  content: ["Daily Prayer", "오늘의 콘텐츠"],
  requests: ["Moderation", "기도제목 승인"],
  media: ["Music & Media", "음악 관리"],
  accounts: ["Admin Access", "Admin 계정 관리"],
  operations: ["System & Audit", "운영 상태"],
};

function toast(message, timeout = 2800) {
  const element = $("#admin-toast");
  setText(element, message);
  setVisible(element, true);
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => setVisible(element, false), timeout);
}

function ownsControllerLease() {
  return Boolean(state.leaseToken && Date.parse(state.leaseExpiresAt) > Date.now() + state.serverOffsetMs);
}

function showGate(name) {
  ["loading", "config", "login", "password"].forEach((gate) => setVisible($(`#admin-${gate}`), gate === name));
  setVisible($("#admin-console"), false);
}

function showConsole() {
  ["loading", "config", "login", "password"].forEach((gate) => setVisible($(`#admin-${gate}`), false));
  setVisible($("#admin-console"), true);
  routeAdmin(state.route);
}

function routeAdmin(route) {
  if (!panelMeta[route]) route = "live";
  state.route = route;
  $$('[data-admin-route]').forEach((button) => {
    if (button.dataset.adminRoute === route) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  Object.keys(panelMeta).forEach((key) => setVisible($(`#admin-panel-${key}`), key === route));
  setText($("#admin-section-eyebrow"), panelMeta[route][0]);
  setText($("#admin-section-title"), panelMeta[route][1]);
  $(".admin-sidebar")?.classList.remove("is-open");
  $("#admin-menu-button")?.setAttribute("aria-expanded", "false");
}

function renderProfile() {
  const profile = state.profile || {};
  setText($("#admin-name"), profile.display_name || "Admin");
  setText($("#admin-role"), profile.role === "owner" ? "대표 관리자" : "진행 관리자");
  setText($("#admin-avatar"), (profile.display_name || "관").slice(0, 1));
  const ownerOnly = profile.role === "owner";
  setVisible($("#admin-invite-form"), ownerOnly);
  setVisible($('[data-admin-route="accounts"]'), ownerOnly);
}

function renderOps() {
  const live = state.snapshot?.liveSession;
  const view = deriveLiveView(live, Date.now() + state.serverOffsetMs);
  const activeMedia = state.snapshot?.media?.find((item) => String(item.id) === String(view.step?.mediaId));
  const isLive = ["live", "paused"].includes(live?.status);
  setText($("#ops-live-status"), isLive ? live.status.toUpperCase() : live?.status?.toUpperCase() || "READY");
  setText($("#ops-presence-count"), state.presenceSynced ? `${state.presenceCount} 연결` : "확인 중");
  setText($("#ops-connection"), state.liveConnected ? "안정" : "확인 중");
  setText($("#ops-card-realtime"), state.liveConnected ? "연결됨" : "재연결 확인 중");
  setText($("#ops-card-clock"), `${Math.round(state.serverOffsetMs)}ms`);
  setText($("#ops-card-controller"), state.leaseToken ? state.profile?.display_name || "현재 Admin" : "제어권 없음");
  const liveOverride = live?.media?.stage_index === view.stageIndex ? live.media : null;
  setText($("#ops-card-media"), liveOverride?.stopped ? "Admin이 종료함" : liveOverride?.label || activeMedia?.label || "재생 없음");
}

function renderController() {
  const ownsLease = ownsControllerLease();
  setText($("#controller-state"), ownsLease ? "현재 이 콘솔이 Live Control을 보유하고 있습니다" : "Live Control 제어권이 필요합니다");
  setText($("#controller-detail"), ownsLease ? `제어권은 ${new Intl.DateTimeFormat("ko-KR", { timeZone: config.timeZone || "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(state.leaseExpiresAt))}까지 자동 갱신됩니다.` : "한 번에 한 명의 Admin만 참여자 화면을 변경할 수 있습니다.");
  setText($("#claim-controller-button"), ownsLease ? "제어권 갱신" : "제어권 요청");
  $$('[data-live-action]').forEach((button) => { button.disabled = !ownsLease; });
  $("#controller-banner .status-dot")?.classList.toggle("status-dot--live", ownsLease);
  renderOps();
}

function renderCueList(view) {
  const list = $("#cue-list");
  list.replaceChildren();
  view.steps.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "cue-item";
    if (index === view.stageIndex) item.classList.add("cue-item--current");
    if (index < view.stageIndex) item.classList.add("cue-item--done");
    const dot = document.createElement("span");
    dot.className = "cue-item__dot";
    dot.textContent = index < view.stageIndex ? "✓" : "";
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = step.label;
    const copy = document.createElement("small");
    copy.textContent = step.content;
    body.append(title, copy);
    const duration = document.createElement("span");
    duration.textContent = `${Math.round(step.durationSeconds / 60)}분`;
    item.append(dot, body, duration);
    list.append(item);
  });
}

function renderLive() {
  const live = state.snapshot?.liveSession;
  const view = deriveLiveView(live, Date.now() + state.serverOffsetMs);
  const step = view.step;
  setText($("#program-version"), `v${live?.version ?? "—"}`);
  setText($("#program-stage-label"), step?.label || "현재 단계 없음");
  setText($("#program-reference"), step?.scriptureReference || "");
  setText($("#program-content"), step?.content || "송출 내용을 준비하고 있습니다.");
  setText($("#program-remaining"), live?.status === "paused" ? "PAUSED" : formatRemaining(view.remainingSeconds));
  setText($("#program-participants"), state.presenceSynced ? `${state.presenceCount}개의 활성 연결` : "활성 연결 확인 중");
  const next = view.steps[view.stageIndex + 1];
  setText($("#preview-stage-number"), next ? `${view.stageIndex + 2} / ${view.steps.length}` : "마지막");
  setText($("#preview-stage-label"), next?.label || "다음 단계 없음");
  setText($("#preview-content"), next?.content || "현재 단계 이후 기도회가 마무리됩니다.");
  setText($("#preview-duration"), next ? `${Math.round(next.durationSeconds / 60)}분` : "—");
  setText($("#control-now"), step?.label || "—");
  setText($("#control-next"), next?.label || "기도회 종료");
  const ownsLease = ownsControllerLease();
  const running = ["live", "paused"].includes(live?.status);
  $$('[data-live-action="start"]').forEach((button) => {
    setVisible(button, !running);
    button.disabled = !ownsLease || running;
  });
  $$('[data-live-action="previous"]').forEach((button) => { setVisible(button, running); button.disabled = !ownsLease || !running || view.stageIndex <= 0; });
  $$('[data-live-action="next"]').forEach((button) => { setVisible(button, running); button.disabled = !ownsLease || !running || view.stageIndex >= view.steps.length - 1; });
  $$('[data-live-action="extend"]').forEach((button) => { setVisible(button, running); button.disabled = !ownsLease || !running; });
  $$('[data-live-action="media_start"]').forEach((button) => { setVisible(button, running); button.disabled = !ownsLease || !running || !step?.mediaId; });
  $$('[data-live-action="media_stop"]').forEach((button) => { setVisible(button, running); button.disabled = !ownsLease || !running || !step?.mediaId; });
  $$('[data-live-action="pause"]').forEach((button) => {
    setVisible(button, running);
    button.disabled = !ownsLease || !running;
    button.textContent = live?.status === "paused" ? "계속 진행" : "일시정지";
  });
  $$('[data-action="confirm-complete"]').forEach((button) => setVisible(button, running));
  $(".mobile-emergency-controls")?.classList.toggle("is-start-only", !running);
  renderCueList(view);
  renderOps();
}

function formatScheduleInput(value) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timeZone || "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const data = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${data.year}-${data.month}-${data.day}T${data.hour}:${data.minute}`;
}

function scheduleInputToIso(value) {
  if ((config.timeZone || "Asia/Seoul") === "Asia/Seoul") return new Date(`${value}:00+09:00`).toISOString();
  return new Date(value).toISOString();
}

function createProgramStepRow(step = {}, index = 0) {
  const row = document.createElement("article");
  row.className = "program-step";
  row.dataset.stepId = step.id || createId();
  row.setAttribute("aria-label", `기도 단계 ${index + 1}`);

  const field = (labelText, control) => {
    const label = document.createElement("label");
    label.append(labelText, control);
    return label;
  };
  const input = (name, value = "", attributes = {}) => {
    const control = document.createElement("input");
    control.name = name;
    control.value = value;
    Object.entries(attributes).forEach(([key, attributeValue]) => control.setAttribute(key, String(attributeValue)));
    return control;
  };

  const label = input("label", step.label || "", { maxlength: 80, required: true });
  const kind = document.createElement("select");
  kind.name = "kind";
  [["scripture", "말씀"], ["prayer", "기도"], ["request", "등록 기도제목"]].forEach(([value, textValue]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = textValue;
    option.selected = (step.kind || "prayer") === value;
    kind.append(option);
  });
  const minutes = input("minutes", String(Math.max(1, Math.round((step.durationSeconds || step.duration_seconds || 180) / 60))), {
    type: "number", min: 1, max: 60, step: 1, required: true,
  });
  const reference = input("reference", step.scriptureReference || step.scripture_reference || "", { maxlength: 80 });
  const media = document.createElement("select");
  media.name = "mediaId";
  const noMedia = document.createElement("option");
  noMedia.value = "";
  noMedia.textContent = "음악 없음";
  media.append(noMedia);
  (state.snapshot?.media || []).filter((item) => item.kind === "audio").forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    option.selected = String(step.mediaId || step.media_id || "") === String(item.id);
    media.append(option);
  });
  const content = document.createElement("textarea");
  content.name = "content";
  content.rows = 3;
  content.maxLength = 1200;
  content.required = true;
  content.value = step.content || "";
  const contentField = field("참여자에게 보일 말씀 또는 기도제목", content);
  contentField.className = "program-step__content";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "program-step__remove";
  remove.dataset.action = "remove-program-step";
  remove.setAttribute("aria-label", `${index + 1}번째 단계 삭제`);
  remove.textContent = "×";

  row.append(
    field("단계 이름", label),
    field("종류", kind),
    field("시간(분)", minutes),
    field("연결할 음악", media),
    remove,
    field("말씀 표기", reference),
    contentField
  );
  return row;
}

function updateProgramStepControls() {
  const rows = $$(".program-step", $("#program-steps"));
  rows.forEach((row, index) => {
    row.setAttribute("aria-label", `기도 단계 ${index + 1}`);
    const button = $(".program-step__remove", row);
    button.disabled = rows.length <= 1;
    button.setAttribute("aria-label", `${index + 1}번째 단계 삭제`);
  });
}

function renderProgramEditor() {
  const live = state.snapshot?.liveSession;
  const view = deriveLiveView(live, Date.now() + state.serverOffsetMs);
  $("#program-title").value = live?.program_snapshot?.title || "저녁 공동기도";
  $("#program-schedule").value = formatScheduleInput(live?.scheduled_for);
  $("#program-mode").value = live?.mode || "manual";
  const container = $("#program-steps");
  container.replaceChildren();
  const steps = view.steps.length ? view.steps : [{ label: "말씀", kind: "scripture", durationSeconds: 180, content: "" }];
  steps.forEach((step, index) => container.append(createProgramStepRow(step, index)));
  updateProgramStepControls();
}

function fillDailyForm() {
  const daily = state.snapshot?.dailyPrayer;
  $("#content-date").value = daily?.prayer_date || zonedDateKey(new Date(Date.now() + state.serverOffsetMs), config.timeZone);
  $("#content-reference").value = daily?.scripture_reference || "";
  $("#content-scripture").value = daily?.scripture_text || "";
  $("#content-topic").value = daily?.prayer_topic || "";
}

function fillSettingsForm() {
  const settings = state.snapshot?.settings || {};
  $("#settings-church-name").value = settings.church_name || config.churchName || "";
  $("#settings-retreat-date").value = settings.retreat_date || "";
  $("#settings-retreat-end-date").value = settings.retreat_end_date || config.retreatEndDate || "";
  $("#settings-prayer-time").value = String(settings.daily_prayer_time ?? config.dailyPrayerTime ?? "").slice(0, 5);
}

function renderModeration() {
  const items = state.snapshot?.pendingRequests || [];
  const list = $("#moderation-list");
  list.replaceChildren();
  setText($("#pending-count"), `${items.length}건 대기`);
  setVisible($("#moderation-empty"), items.length === 0);
  items.forEach((request) => {
    const card = document.createElement("article");
    card.className = "moderation-card";
    const content = document.createElement("div");
    const meta = document.createElement("div");
    meta.className = "moderation-card__meta";
    const author = document.createElement("strong");
    author.textContent = request.is_anonymous ? `${request.display_name || "제출자"} · 공개 시 익명` : request.display_name || "이름 없음";
    const time = document.createElement("time");
    time.dateTime = request.created_at;
    time.textContent = new Date(request.created_at).toLocaleString("ko-KR");
    meta.append(author, time);
    const body = document.createElement("p");
    body.className = "moderation-card__body";
    body.textContent = request.body;
    const notice = document.createElement("p");
    notice.className = "moderation-card__notice";
    notice.textContent = /@|\d{2,3}[-\s]\d{3,4}/.test(request.body) ? "연락처로 보이는 내용이 있습니다. 공개 전 확인해주세요." : "민감정보 징후가 자동 감지되지 않았습니다. 직접 검토가 필요합니다.";
    content.append(meta, body, notice);
    const actions = document.createElement("div");
    actions.className = "moderation-actions";
    [["approved", "승인", "approve"], ["hidden", "숨김", ""], ["rejected", "삭제", "reject"]].forEach(([status, label, className]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = "moderate";
      button.dataset.requestId = request.id;
      button.dataset.status = status;
      button.className = className;
      button.textContent = label;
      actions.append(button);
    });
    card.append(content, actions);
    list.append(card);
  });

  const publishedList = $("#published-request-list");
  publishedList.replaceChildren();
  const published = state.snapshot?.requests || [];
  if (!published.length) {
    const empty = document.createElement("p");
    empty.className = "form-status";
    empty.textContent = "현재 공개 중인 기도제목이 없습니다.";
    publishedList.append(empty);
  }
  published.forEach((request) => {
    const row = document.createElement("div");
    row.className = "admin-list-row";
    const content = document.createElement("div");
    const author = document.createElement("strong");
    author.textContent = request.is_anonymous ? "익명" : request.display_name || "이름 없음";
    const body = document.createElement("span");
    body.className = "published-request-copy";
    body.textContent = request.body;
    content.append(author, body);
    const actions = document.createElement("div");
    actions.className = "published-request-actions";
    [["hidden", "숨김"], ["deleted", "삭제"]].forEach(([status, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = "moderate";
      button.dataset.requestId = request.id;
      button.dataset.status = status;
      button.textContent = label;
      actions.append(button);
    });
    row.append(content, actions);
    publishedList.append(row);
  });
}

function renderMedia() {
  const list = $("#media-list");
  list.replaceChildren();
  const items = state.snapshot?.media || [];
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "form-status";
    empty.textContent = "등록된 음악이 없습니다.";
    list.append(empty);
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "admin-list-row";
    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.label;
    const detail = document.createElement("small");
    detail.textContent = item.kind === "youtube"
      ? "YouTube 연결 · 더 이상 공동기도에서 재생하지 않음"
      : `업로드 음원 · ${item.start_seconds || 0}초부터`;
    content.append(title, detail);
    row.append(content);
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = "delete-media";
    button.dataset.mediaId = item.id;
    button.textContent = "삭제";
    button.disabled = ["live", "paused"].includes(state.snapshot?.liveSession?.status);
    if (button.disabled) button.title = "진행 중인 기도회를 종료한 뒤 음악을 삭제할 수 있습니다.";
    row.append(button);
    list.append(row);
  });
}

function renderAccounts() {
  const accounts = state.snapshot?.accounts || [];
  const list = $("#account-list");
  list.replaceChildren();
  const activeCount = accounts.filter((account) => account.active).length;
  setText($("#account-count"), `${activeCount} / 5 · 등록 ${accounts.length}`);
  const inviteButton = $("button[type='submit']", $("#admin-invite-form"));
  if (inviteButton) inviteButton.disabled = activeCount >= 5;
  if (activeCount >= 5) setText($(".form-status", $("#admin-invite-form")), "활성 Admin 5명이 모두 등록되어 있습니다.");
  accounts.forEach((account) => {
    const row = document.createElement("div");
    row.className = "admin-list-row";
    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${account.display_name || "이름 없음"} · ${account.role === "owner" ? "대표 관리자" : "Admin"}`;
    const detail = document.createElement("small");
    detail.textContent = `${account.email || account.user_id} · ${account.active ? "활성" : "비활성"}`;
    content.append(title, detail);
    row.append(content);
    if (state.profile?.role === "owner" && account.role !== "owner") {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = account.active ? "disable-admin" : "activate-admin";
      button.dataset.userId = account.user_id;
      button.textContent = account.active ? "비활성화" : "다시 활성화";
      row.append(button);
    }
    list.append(row);
  });
}

function renderAudit() {
  const list = $("#audit-list");
  list.replaceChildren();
  const items = state.snapshot?.audit || [];
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "form-status";
    empty.textContent = "표시할 중요 작업 이력이 없습니다.";
    list.append(empty);
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "audit-row";
    const time = document.createElement("time");
    time.dateTime = item.created_at;
    time.textContent = new Date(item.created_at).toLocaleString("ko-KR");
    const action = document.createElement("strong");
    action.textContent = item.action;
    const admin = document.createElement("span");
    admin.textContent = item.admin_name || (item.admin_id ? "Admin" : "System");
    row.append(time, action, admin);
    list.append(row);
  });
}

async function refreshAudit() {
  try {
    state.snapshot.audit = await state.service.getAudit();
    renderAudit();
  } catch (error) {
    toast(error.message || "작업 이력을 새로 불러오지 못했습니다.", 4200);
  }
}

function renderAll() {
  renderProfile();
  renderController();
  renderLive();
  renderProgramEditor();
  fillSettingsForm();
  fillDailyForm();
  renderModeration();
  renderMedia();
  renderAccounts();
  renderAudit();
}

async function openConsole(loginResult) {
  state.profile = loginResult?.profile || null;
  state.snapshot = await state.service.getAdminSnapshot();
  state.profile ||= state.snapshot.profile;
  state.serverOffsetMs = Date.parse(state.snapshot.serverNow) - Date.now();
  if (state.mode === "production") {
    const accountResult = await state.service.manageAdmin("list").catch((error) => {
      if (state.profile?.role === "owner") toast(error.message || "Admin 계정 목록을 불러오지 못했습니다.", 4800);
      return [];
    });
    state.snapshot.accounts = Array.isArray(accountResult) ? accountResult : accountResult.accounts || [];
  }
  try {
    state.presenceDisconnect = await state.service.observePresence("live", (presence) => {
      state.presenceSynced = Boolean(presence.synced);
      state.presenceCount = presence.count;
      renderLive();
    });
  } catch {
    state.presenceSynced = false;
    state.presenceCount = null;
    toast("활성 연결 수를 확인할 수 없습니다. 기도회 제어 기능은 계속 사용할 수 있습니다.", 4800);
  }
  state.liveUnsubscribe = state.service.subscribeLive(
    (liveSession) => {
      if (Number(liveSession?.version ?? -1) < Number(state.snapshot.liveSession?.version ?? -1)) return;
      state.snapshot.liveSession = liveSession;
      renderLive();
      toast("참여자 화면과 진행 상태가 다시 동기화되었습니다.");
    },
    (status) => {
      state.liveConnected = status === "connected";
      renderOps();
      if (status === "reconnecting") toast("참여자 화면 동기화 연결을 다시 확인하고 있습니다.", 4200);
    }
  );
  renderAll();
  showConsole();
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $("button[type='submit']", form);
  button.disabled = true;
  setText($("#admin-login-error"), "");
  try {
    const result = await state.service.adminLogin(form.email.value.trim(), form.password.value);
    await openConsole(result);
  } catch (error) {
    setText($("#admin-login-error"), error.message || "로그인하지 못했습니다.");
  } finally {
    button.disabled = false;
  }
}

async function setInitialPassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $("button[type='submit']", form);
  const password = form.password.value;
  setText($("#admin-password-error"), "");
  if (password.length < 10) {
    setText($("#admin-password-error"), "비밀번호는 10자 이상으로 설정해주세요.");
    return;
  }
  if (password !== form.passwordConfirm.value) {
    setText($("#admin-password-error"), "두 비밀번호가 일치하지 않습니다.");
    return;
  }
  button.disabled = true;
  try {
    const result = await state.service.updateAdminPassword(password);
    history.replaceState(null, "", location.pathname);
    await openConsole(result);
  } catch (error) {
    setText($("#admin-password-error"), error.message || "비밀번호를 설정하지 못했습니다.");
  } finally {
    button.disabled = false;
  }
}

async function claimController({ quiet = false } = {}) {
  state.leaseToken ||= createId();
  try {
    const result = await state.service.claimController(state.leaseToken);
    const payload = typeof result === "string" ? JSON.parse(result) : result;
    if (!payload?.acquired) throw new Error(payload?.message || "다른 Admin이 제어 중입니다.");
    state.leaseExpiresAt = payload.expires_at;
    renderController();
    renderLive();
    if (!quiet) toast("Live Control 제어권을 확보했습니다.");
    clearInterval(state.leaseInterval);
    state.leaseInterval = setInterval(() => claimController({ quiet: true }), 20_000);
  } catch (error) {
    state.leaseToken = null;
    state.leaseExpiresAt = null;
    renderController();
    if (!quiet) toast(error.message || "제어권을 확보하지 못했습니다.", 4200);
  }
}

async function applyLiveAction(button) {
  if (!state.leaseToken) return toast("먼저 Live Control 제어권을 요청해주세요.");
  let action = button.dataset.liveAction;
  if (action === "pause" && state.snapshot.liveSession.status === "paused") action = "resume";
  const payload = action === "extend" ? { seconds: Number(button.dataset.seconds) || 60 } : {};
  button.disabled = true;
  try {
    const result = await state.service.applyLiveAction(
      state.leaseToken,
      action,
      payload,
      state.snapshot.liveSession.version
    );
    state.snapshot.liveSession = typeof result === "string" ? JSON.parse(result) : result;
    renderLive();
    toast(action === "next" ? "다음 단계를 참여자 화면에 송출했습니다." : "공동기도 진행 상태를 변경했습니다.");
  } catch (error) {
    toast(error.message || "진행 상태를 변경하지 못했습니다.", 4200);
  } finally {
    button.disabled = false;
  }
}

async function saveDailyContent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("#content-save-status");
  setText(status, "게시 내용을 저장하고 있습니다.");
  try {
    const saved = await state.service.saveDailyPrayer({
      prayer_date: form.prayerDate.value,
      scripture_reference: form.scriptureReference.value.trim() || null,
      scripture_text: form.scriptureText.value.trim() || null,
      prayer_topic: form.prayerTopic.value.trim(),
      published: true,
    });
    state.snapshot.dailyPrayer = saved;
    setText(status, "오늘의 기도 콘텐츠를 게시했습니다.");
  } catch (error) {
    setText(status, error.message || "저장하지 못했습니다.");
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const status = $("#settings-save-status");
  const retreatDate = $("#settings-retreat-date").value;
  const retreatEndDate = $("#settings-retreat-end-date").value;
  if (retreatEndDate && retreatEndDate < retreatDate) {
    setText(status, "수련회 종료일은 시작일보다 빠를 수 없습니다.");
    $("#settings-retreat-end-date").focus();
    return;
  }
  try {
    const saved = await state.service.saveSettings({
      church_name: $("#settings-church-name").value.trim(),
      retreat_date: retreatDate,
      retreat_end_date: retreatEndDate || null,
      daily_prayer_time: $("#settings-prayer-time").value || null,
    });
    state.snapshot.settings = saved;
    setText(status, "공동체 이름과 수련회·기도 일정을 저장했습니다.");
  } catch (error) {
    setText(status, error.message || "기본 일정을 저장하지 못했습니다.");
  }
}

async function saveProgram(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("#program-save-status");
  const running = ["live", "paused"].includes(state.snapshot?.liveSession?.status);
  if (running && !ownsControllerLease()) {
    setText(status, "진행 중인 기도회를 수정하려면 먼저 Live Control 제어권을 요청해주세요.");
    $("#claim-controller-button")?.focus();
    return;
  }
  const rows = $$(".program-step", $("#program-steps"));
  const steps = rows.map((row) => ({
    id: row.dataset.stepId || createId(),
    label: $("[name='label']", row).value.trim(),
    kind: $("[name='kind']", row).value,
    scripture_reference: $("[name='reference']", row).value.trim(),
    content: $("[name='content']", row).value.trim(),
    duration_seconds: Number($("[name='minutes']", row).value) * 60,
    media_id: $("[name='mediaId']", row).value || null,
  }));
  if (!steps.length || steps.some((step) => !step.label || !step.content || step.duration_seconds < 60)) {
    setText(status, "각 단계의 이름, 내용, 시간을 확인해주세요.");
    return;
  }
  try {
    setText(status, "기도회 구성을 게시하고 있습니다.");
    const result = await state.service.saveProgram({
      programId: state.snapshot?.liveSession?.program_id || null,
      title: $("#program-title").value.trim(),
      scheduledFor: scheduleInputToIso($("#program-schedule").value),
      mode: $("#program-mode").value,
      steps,
      leaseToken: state.leaseToken,
      expectedVersion: state.snapshot?.liveSession?.version ?? null,
    });
    state.snapshot.liveSession = result.live_session || result.liveSession;
    if (result.program) {
      state.snapshot.programs ||= [];
      const index = state.snapshot.programs.findIndex((item) => item.id === result.program.id);
      if (index >= 0) state.snapshot.programs[index] = result.program;
      else state.snapshot.programs.unshift(result.program);
    }
    renderLive();
    renderProgramEditor();
    if (result.applied_to_running_session) {
      setText(status, "현재 단계와 남은 시간은 유지하고, 진행 중인 기도회의 내용과 음악을 갱신했습니다.");
      toast("수정한 기도 내용이 참여자 화면에 실시간으로 송출되었습니다.");
    } else {
      setText(status, "다음 공동기도 구성을 게시했습니다.");
      toast("참여자 Waiting Room의 다음 일정이 갱신되었습니다.");
    }
  } catch (error) {
    setText(status, error.message || "기도회 구성을 게시하지 못했습니다.");
  }
}

async function moderate(button) {
  button.disabled = true;
  try {
    const updated = await state.service.moderateRequest(button.dataset.requestId, button.dataset.status);
    state.snapshot.pendingRequests = state.snapshot.pendingRequests.filter((item) => String(item.id) !== button.dataset.requestId);
    state.snapshot.requests ||= [];
    if (button.dataset.status === "approved" && !state.snapshot.requests.some((item) => String(item.id) === String(updated.id))) {
      state.snapshot.requests.unshift(updated);
    }
    if (["hidden", "rejected", "deleted"].includes(button.dataset.status)) {
      state.snapshot.requests = state.snapshot.requests.filter((item) => String(item.id) !== button.dataset.requestId);
    }
    renderModeration();
    toast(button.dataset.status === "approved" ? "기도제목을 공개했습니다." : "기도제목 상태를 변경했습니다.");
  } catch (error) {
    toast(error.message || "기도제목을 처리하지 못했습니다.", 4200);
  } finally {
    button.disabled = false;
  }
}

function openModerationDeleteConfirmation(button) {
  const isPublished = (state.snapshot?.requests || []).some((item) => String(item.id) === button.dataset.requestId);
  state.confirmation = {
    type: "moderate-delete",
    requestId: button.dataset.requestId,
    status: button.dataset.status,
  };
  setText($("#admin-confirm-title"), isPublished ? "공개된 기도제목을 삭제할까요?" : "이 기도제목을 반려할까요?");
  setText($("#admin-confirm-message"), isPublished
    ? "참여자 목록에서 즉시 사라지며, 처리 이력은 Audit Trail에 남습니다."
    : "승인 대기열에서 사라지며, 처리 이력은 Audit Trail에 남습니다.");
  setText($("#admin-confirm-button"), isPublished ? "기도제목 삭제" : "제출 반려");
  const dialog = $("#admin-confirm-dialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

async function uploadAudio(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $(".form-status", form);
  const file = form.audioFile.files[0];
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) {
    setText(status, "음원 파일은 20MB 이하여야 합니다.");
    return;
  }
  try {
    setText(status, "음원을 업로드하고 있습니다.");
    const uploaded = await state.service.uploadAudio(file);
    const item = await state.service.saveMedia({
      kind: "audio",
      label: form.label.value.trim(),
      source_url: uploaded.publicUrl,
      storage_path: uploaded.path,
      start_seconds: 0,
      active: true,
    });
    state.snapshot.media.unshift(item);
    form.reset();
    renderMedia();
    renderProgramEditor();
    setText(status, uploaded.previewOnly ? "미리보기 목록에 추가했습니다. 실제 파일은 업로드되지 않았습니다." : "음원을 등록했습니다.");
  } catch (error) {
    setText(status, error.message || "업로드하지 못했습니다.");
  }
}

function openMediaDeleteConfirmation(id) {
  const media = (state.snapshot?.media || []).find((item) => String(item.id) === String(id));
  if (!media) return toast("삭제할 음악을 찾을 수 없습니다.", 4200);
  if (["live", "paused"].includes(state.snapshot?.liveSession?.status)) {
    toast("진행 중인 기도회를 종료한 뒤 음악을 삭제해주세요.", 4200);
    return;
  }
  state.confirmation = { type: "delete-media", mediaId: id };
  setText($("#admin-confirm-title"), `‘${media.label}’ 음악을 삭제할까요?`);
  setText($("#admin-confirm-message"), "기도회 구성에서 이 음악의 연결을 해제하고, 업로드한 음원 파일도 삭제합니다. 이 작업은 되돌릴 수 없습니다.");
  setText($("#admin-confirm-button"), "음악 삭제");
  const dialog = $("#admin-confirm-dialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

async function deleteMedia(id) {
  try {
    const result = await state.service.deleteMedia(id);
    state.snapshot.media = (state.snapshot.media || []).filter((item) => String(item.id) !== String(id));
    for (const program of state.snapshot.programs || []) {
      program.steps = (program.steps || []).map((step) => String(step.media_id) === String(id)
        ? { ...step, media_id: null }
        : step);
    }
    renderMedia();
    renderProgramEditor();
    toast(result.storageCleanupFailed
      ? "음악 목록에서는 삭제했지만 저장소 파일 정리에 실패했습니다. 운영 상태에서 확인해주세요."
      : "음악과 업로드 파일을 삭제했습니다.", 4800);
  } catch (error) {
    toast(error.message || "음악을 삭제하지 못했습니다.", 4200);
  }
}

async function inviteAdmin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $(".form-status", form);
  try {
    setText(status, "초대 메일을 준비하고 있습니다.");
    const account = await state.service.manageAdmin("invite", {
      email: form.email.value.trim(),
      displayName: form.displayName.value.trim(),
    });
    state.snapshot.accounts.push(account.user || account);
    form.reset();
    renderAccounts();
    setText(status, "Admin 초대를 보냈습니다.");
  } catch (error) {
    setText(status, error.message || "Admin을 초대하지 못했습니다.");
  }
}

async function disableAdmin(userId) {
  try {
    await state.service.manageAdmin("disable", { userId });
    const account = state.snapshot.accounts.find((item) => item.user_id === userId);
    if (account) account.active = false;
    renderAccounts();
    toast("Admin 계정을 비활성화했습니다.");
  } catch (error) {
    toast(error.message || "계정을 비활성화하지 못했습니다.", 4200);
  }
}

function openCompleteConfirmation() {
  state.confirmation = { type: "complete" };
  setText($("#admin-confirm-title"), "기도회를 종료할까요?");
  setText($("#admin-confirm-message"), "종료하면 모든 참여자 화면이 기도 종료 상태로 전환됩니다.");
  setText($("#admin-confirm-button"), "기도회 종료");
  const dialog = $("#admin-confirm-dialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function openDisableConfirmation(userId) {
  const account = state.snapshot?.accounts?.find((item) => item.user_id === userId);
  if (!account) return;
  state.confirmation = { type: "disable-admin", userId };
  setText($("#admin-confirm-title"), `${account.display_name} Admin을 비활성화할까요?`);
  setText($("#admin-confirm-message"), "비활성화하면 이 계정은 즉시 Admin 데이터와 운영 기능에 접근할 수 없습니다.");
  setText($("#admin-confirm-button"), "계정 비활성화");
  const dialog = $("#admin-confirm-dialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

async function handleClick(event) {
  const route = event.target.closest("[data-admin-route]");
  if (route) {
    routeAdmin(route.dataset.adminRoute);
    if (route.dataset.adminRoute === "operations") await refreshAudit();
    return;
  }
  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget) {
    const action = actionTarget.dataset.action;
    if (action === "open-preview") {
      const result = await state.service.previewAdminLogin();
      return openConsole(result);
    }
    if (action === "logout") {
      await state.service.adminLogout();
      location.reload();
      return;
    }
    if (action === "toggle-admin-menu") {
      const sidebar = $(".admin-sidebar");
      sidebar.classList.toggle("is-open");
      actionTarget.setAttribute("aria-expanded", String(sidebar.classList.contains("is-open")));
    }
    if (action === "edit-program") routeAdmin("program");
    if (action === "add-program-step") {
      const container = $("#program-steps");
      container.append(createProgramStepRow({}, container.children.length));
      updateProgramStepControls();
    }
    if (action === "remove-program-step") {
      actionTarget.closest(".program-step")?.remove();
      updateProgramStepControls();
    }
    if (action === "claim-controller") await claimController();
    if (action === "confirm-complete") openCompleteConfirmation();
    if (action === "moderate") {
      if (["rejected", "deleted"].includes(actionTarget.dataset.status)) openModerationDeleteConfirmation(actionTarget);
      else await moderate(actionTarget);
    }
    if (action === "disable-admin") openDisableConfirmation(actionTarget.dataset.userId);
    if (action === "delete-media") openMediaDeleteConfirmation(actionTarget.dataset.mediaId);
    if (action === "activate-admin") {
      try {
        await state.service.manageAdmin("activate", { userId: actionTarget.dataset.userId });
        const account = state.snapshot.accounts.find((item) => item.user_id === actionTarget.dataset.userId);
        if (account) account.active = true;
        renderAccounts();
        toast("Admin 계정을 다시 활성화했습니다.");
      } catch (error) {
        toast(error.message || "계정을 활성화하지 못했습니다.", 4200);
      }
    }
  }
  const liveAction = event.target.closest("[data-live-action]");
  if (liveAction) await applyLiveAction(liveAction);
}

async function boot() {
  showGate("loading");
  try {
    state.service = await createPrayerService(config, { admin: true });
    state.mode = state.service.mode;
    setVisible($("#admin-preview-ribbon"), state.mode === "preview");
    setVisible($("#admin-preview-button"), state.mode === "preview");
    if (state.mode === "production") {
      const restored = await state.service.getAdminSession();
      if (restored) {
        const inviteEntry = restored.user?.user_metadata?.retreat_prayer_needs_password_setup === true
          || location.hash.includes("type=invite")
          || new URLSearchParams(location.search).has("code");
        if (inviteEntry) {
          state.pendingAdminSession = restored;
          showGate("password");
          return;
        }
        await openConsole(restored);
        return;
      }
    }
    showGate("login");
  } catch (error) {
    if (error.code === "CONFIG_REQUIRED") showGate("config");
    else {
      showGate("login");
      setText($("#admin-login-error"), error.message || "Admin 연결을 준비하지 못했습니다.");
    }
  }
}

document.addEventListener("click", handleClick);
$("#admin-login-form")?.addEventListener("submit", login);
$("#admin-password-form")?.addEventListener("submit", setInitialPassword);
$("#daily-content-form")?.addEventListener("submit", saveDailyContent);
$("#app-settings-form")?.addEventListener("submit", saveSettings);
$("#program-form")?.addEventListener("submit", saveProgram);
$("#audio-upload-form")?.addEventListener("submit", uploadAudio);
$("#admin-invite-form")?.addEventListener("submit", inviteAdmin);
$("#admin-confirm-dialog")?.addEventListener("close", async (event) => {
  if (event.target.returnValue !== "confirm") {
    state.confirmation = null;
    return;
  }
  if (state.confirmation?.type === "complete") {
    const fakeButton = document.createElement("button");
    fakeButton.dataset.liveAction = "complete";
    await applyLiveAction(fakeButton);
  }
  if (state.confirmation?.type === "disable-admin") await disableAdmin(state.confirmation.userId);
  if (state.confirmation?.type === "moderate-delete") {
    const fakeButton = document.createElement("button");
    fakeButton.dataset.requestId = state.confirmation.requestId;
    fakeButton.dataset.status = state.confirmation.status;
    await moderate(fakeButton);
  }
  if (state.confirmation?.type === "delete-media") await deleteMedia(state.confirmation.mediaId);
  state.confirmation = null;
});
globalThis.addEventListener("pagehide", () => {
  state.presenceDisconnect?.();
  state.liveUnsubscribe?.();
  clearInterval(state.leaseInterval);
});

setInterval(() => {
  if (!state.snapshot) return;
  const now = new Date(Date.now() + state.serverOffsetMs);
  setText($("#ops-server-time"), now.toLocaleTimeString("ko-KR", { hour12: false }));
  if (state.route === "live") renderLive();
  renderController();
}, 1000);

boot();
