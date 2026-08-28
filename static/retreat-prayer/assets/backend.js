import {
  countUniquePresenceSessions,
  createId,
  hasProductionConfig,
  isLocalPreview,
  zonedDateKey,
} from "./core.js";

const DEMO_REQUESTS = [
  {
    id: "demo-request-1",
    display_name: "청년부A",
    is_anonymous: false,
    body: "처음 수련회에 참석하는 지체들이 낯설지 않게 공동체 안에서 따뜻한 환대를 경험하도록 기도해주세요.",
    approved_at: "2026-08-27T12:00:00Z",
    created_at: "2026-08-27T10:00:00Z",
    status: "approved",
  },
  {
    id: "demo-request-2",
    display_name: "익명",
    is_anonymous: true,
    body: "말씀을 듣는 동안 마음이 열리고, 이번 수련회가 하나님을 더욱 깊이 알아가는 시간이 되도록 기도해주세요.",
    approved_at: "2026-08-27T12:30:00Z",
    created_at: "2026-08-27T11:00:00Z",
    status: "approved",
  },
  {
    id: "demo-request-3",
    display_name: "교사팀",
    is_anonymous: false,
    body: "섬기는 모든 리더와 교사에게 지혜와 건강을 주시고, 준비 과정에서도 서로를 사랑으로 세워가도록 기도해주세요.",
    approved_at: "2026-08-27T13:00:00Z",
    created_at: "2026-08-27T11:30:00Z",
    status: "approved",
  },
];

const DEMO_STEPS = [
  {
    id: "welcome",
    label: "마음을 모으는 시간",
    kind: "scripture",
    scripture_reference: "시편 133:1",
    content: "보라 형제가 연합하여 동거함이 어찌 그리 선하고 아름다운고",
    duration_seconds: 180,
  },
  {
    id: "gratitude",
    label: "감사",
    kind: "prayer",
    scripture_reference: "데살로니가전서 5:18",
    content: "수련회를 준비하게 하신 은혜를 기억하며, 각자의 자리에서 감사로 기도합니다.",
    duration_seconds: 240,
  },
  {
    id: "retreat",
    label: "수련회를 위한 기도",
    kind: "prayer",
    scripture_reference: "에베소서 3:17–19",
    content: "모든 지체가 그리스도의 사랑의 넓이와 길이와 높이와 깊이를 알아가도록 기도합니다.",
    duration_seconds: 300,
  },
  {
    id: "community",
    label: "서로를 위한 중보",
    kind: "request",
    scripture_reference: "갈라디아서 6:2",
    content: "서로의 짐을 함께 지며, 나누어진 기도제목을 한마음으로 중보합니다.",
    duration_seconds: 300,
  },
  {
    id: "closing",
    label: "공동체 기도",
    kind: "prayer",
    scripture_reference: "골로새서 3:14",
    content: "이 모든 것 위에 사랑을 더하여 공동체가 온전히 하나 되도록 기도합니다.",
    duration_seconds: 180,
  },
];

function clone(value) {
  return globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

async function throwFunctionError(error, fallback) {
  let payload = null;
  try {
    payload = await error?.context?.json?.();
  } catch {
    // The platform may return a non-JSON gateway error.
  }
  throw new Error(payload?.error || error?.message || fallback);
}

function createDemoState(config) {
  const now = Date.now();
  const stored = globalThis.localStorage?.getItem("retreat-prayer-demo-state");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.dailyPrayer && parsed?.liveSession) return parsed;
    } catch {
      // Ignore corrupt local preview data and restore the safe fixture.
    }
  }
  return {
    contentRevision: 1,
    settings: {
      id: 1,
      app_name: config.appName,
      church_name: config.churchName,
      retreat_date: config.retreatDate || "2026-09-09",
      time_zone: config.timeZone,
      daily_prayer_time: config.dailyPrayerTime,
      emergency_notice: "",
    },
    dailyPrayer: {
      id: "demo-daily",
      prayer_date: zonedDateKey(new Date(now), config.timeZone),
      scripture_reference: "빌립보서 4:6–7",
      scripture_text: "아무 것도 염려하지 말고 다만 모든 일에 기도와 간구로, 너희 구할 것을 감사함으로 하나님께 아뢰라.",
      prayer_topic: "수련회를 준비하는 모든 손길에 지혜와 평안을 주시고, 참여하는 지체들의 마음을 말씀 앞에 부드럽게 열어주소서.",
      published: true,
    },
    liveSession: {
      id: 1,
      status: "live",
      mode: "manual",
      scheduled_for: new Date(now - 5 * 60_000).toISOString(),
      program_snapshot: { title: "저녁 공동기도", steps: DEMO_STEPS },
      stage_index: 1,
      stage_started_at: new Date(now - 92_000).toISOString(),
      started_at: new Date(now - 5 * 60_000).toISOString(),
      accumulated_pause_seconds: 0,
      paused_remaining_seconds: null,
      announcement: "",
      media: null,
      version: 4,
      updated_at: new Date(now - 92_000).toISOString(),
    },
    requests: clone(DEMO_REQUESTS),
    pendingRequests: [
      {
        id: "demo-pending-1",
        display_name: "김OO",
        is_anonymous: false,
        body: "수련회 기간 동안 안전하게 이동하고 모든 일정이 평안히 진행되도록 기도해주세요.",
        created_at: new Date(now - 3_600_000).toISOString(),
        status: "pending",
      },
    ],
    media: [],
    accounts: [
      { user_id: "demo-owner", display_name: "대표 관리자", role: "owner", active: true },
      { user_id: "demo-admin", display_name: "진행 관리자", role: "admin", active: true },
    ],
    audit: [],
  };
}

class PreviewService {
  constructor(config) {
    this.config = config;
    this.mode = "preview";
    this.state = createDemoState(config);
    this.state.contentRevision ||= 1;
    this.liveListeners = new Set();
    this.contentListeners = new Set();
    this.sessionId = null;
    this.previewChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel("retreat-prayer-preview") : null;
    this.previewChannel?.addEventListener("message", (event) => {
      if (!event.data?.liveSession) return;
      const previousRevision = this.state.contentRevision;
      this.state = clone(event.data);
      this.emitLive();
      if (this.state.contentRevision !== previousRevision) this.emitContent();
    });
  }

  persist() {
    globalThis.localStorage?.setItem("retreat-prayer-demo-state", JSON.stringify(this.state));
    this.previewChannel?.postMessage(clone(this.state));
  }

  async loadPublicData() {
    await this.syncLive();
    return clone({
      settings: this.state.settings,
      dailyPrayer: this.state.dailyPrayer,
      liveSession: this.state.liveSession,
      requests: this.state.requests.filter((item) => item.status === "approved"),
      media: this.state.media,
      contentRevision: this.state.contentRevision,
      serverNow: new Date().toISOString(),
    });
  }

  async syncLive() {
    const live = this.state.liveSession;
    const now = Date.now();
    if (live.mode === "auto" && live.status === "scheduled" && Date.parse(live.scheduled_for) <= now) {
      live.status = "live";
      live.stage_index = 0;
      live.started_at = live.scheduled_for;
      live.stage_started_at = live.scheduled_for;
      live.version += 1;
      live.updated_at = new Date(now).toISOString();
      this.persist();
      this.emitLive();
    }
    if (live.mode !== "auto" || live.status !== "live" || !live.started_at) return clone(live);
    const total = (live.program_snapshot?.steps || []).reduce((sum, step) => sum + Number(step.duration_seconds || 0), 0);
    const elapsed = (Date.now() - Date.parse(live.started_at)) / 1000 - Number(live.accumulated_pause_seconds || 0);
    if (total > 0 && elapsed >= total) {
      live.status = "completed";
      live.stage_index = Math.max(0, (live.program_snapshot?.steps?.length || 1) - 1);
      live.version += 1;
      live.updated_at = new Date().toISOString();
      this.persist();
      this.emitLive();
    }
    return clone(live);
  }

  async getServerTime() {
    return new Date().toISOString();
  }

  async connectPresence({ sessionId, context }, onState) {
    this.sessionId = sessionId;
    onState({ synced: false, count: null, status: "connecting" });
    const timeout = setTimeout(() => {
      onState({ synced: true, count: context === "live" ? 12 : 9, status: "connected" });
    }, 350);
    return () => clearTimeout(timeout);
  }

  async observePresence(context, onState) {
    onState({ synced: true, count: context === "live" ? 12 : 9, status: "connected" });
    return () => {};
  }

  subscribeLive(listener, onStatus = () => {}) {
    this.liveListeners.add(listener);
    onStatus("connected");
    return () => this.liveListeners.delete(listener);
  }

  emitLive() {
    this.liveListeners.forEach((listener) => listener(clone(this.state.liveSession)));
  }

  publicContentSnapshot() {
    return clone({
      settings: this.state.settings,
      dailyPrayer: this.state.dailyPrayer,
      requests: this.state.requests.filter((item) => item.status === "approved"),
      contentRevision: this.state.contentRevision,
      serverNow: new Date().toISOString(),
    });
  }

  async fetchPublicContent() {
    return this.publicContentSnapshot();
  }

  subscribeContent(listener, onStatus = () => {}) {
    this.contentListeners.add(listener);
    onStatus("connected");
    queueMicrotask(() => {
      if (this.contentListeners.has(listener)) listener(this.publicContentSnapshot());
    });
    return () => this.contentListeners.delete(listener);
  }

  emitContent() {
    const snapshot = this.publicContentSnapshot();
    this.contentListeners.forEach((listener) => listener(snapshot));
  }

  async submitPrayerRequest(payload) {
    const request = {
      id: createId(),
      display_name: payload.isAnonymous ? "익명" : payload.displayName,
      is_anonymous: payload.isAnonymous,
      body: payload.body,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    this.state.pendingRequests.unshift(request);
    this.persist();
    return { id: request.id, status: "pending" };
  }

  async previewAdminLogin() {
    return { user: { id: "demo-owner", email: "preview@local.test" }, profile: this.state.accounts[0] };
  }

  async getAdminSession() {
    return null;
  }

  async updateAdminPassword() {
    return this.previewAdminLogin();
  }

  async adminLogin() {
    throw new Error("로컬 미리보기에서는 ‘미리보기 콘솔 열기’를 사용해주세요.");
  }

  async adminLogout() {}

  async getAdminSnapshot() {
    return clone({
      ...this.state,
      profile: this.state.accounts[0],
      presenceCount: 12,
      serverNow: new Date().toISOString(),
    });
  }

  async getAudit() {
    return clone(this.state.audit || []);
  }

  async claimController(token) {
    return { acquired: true, lease_token: token, expires_at: new Date(Date.now() + 30_000).toISOString() };
  }

  async applyLiveAction(token, action, payload = {}) {
    const live = this.state.liveSession;
    const steps = live.program_snapshot.steps;
    const now = new Date().toISOString();
    if (action === "start") {
      live.status = "live";
      live.stage_index = 0;
      live.started_at = now;
      live.stage_started_at = now;
      live.paused_at = null;
      live.paused_remaining_seconds = null;
      live.accumulated_pause_seconds = 0;
      live.media = null;
    } else if (action === "resume") {
      live.status = "live";
      live.stage_started_at = now;
    } else if (action === "pause") {
      live.status = "paused";
    } else if (action === "next") {
      live.stage_index = Math.min(steps.length - 1, live.stage_index + 1);
      live.stage_started_at = now;
      live.media = null;
    } else if (action === "previous") {
      live.stage_index = Math.max(0, live.stage_index - 1);
      live.stage_started_at = now;
      live.media = null;
    } else if (action === "extend") {
      steps[live.stage_index].duration_seconds += Math.max(30, Number(payload.seconds) || 60);
    } else if (action === "complete") {
      live.status = "completed";
    } else if (action === "media_start") {
      const mediaId = steps[live.stage_index].media_id;
      const media = this.state.media.find((item) => String(item.id) === String(mediaId));
      if (!media) throw new Error("현재 단계에 연결된 음악이 없습니다.");
      live.media = { ...clone(media), stage_index: live.stage_index };
    } else if (action === "media_stop") {
      live.media = { stopped: true, stage_index: live.stage_index };
    } else if (action === "announce") {
      live.announcement = String(payload.message || "").slice(0, 240);
    }
    live.version += 1;
    live.updated_at = now;
    this.state.audit.unshift({
      id: createId(),
      action,
      created_at: now,
      details: payload,
      admin_name: "대표 관리자",
    });
    this.persist();
    this.emitLive();
    return clone(live);
  }

  async saveDailyPrayer(payload) {
    this.state.dailyPrayer = { ...this.state.dailyPrayer, ...payload, published: true };
    this.state.contentRevision += 1;
    this.persist();
    this.emitContent();
    return clone(this.state.dailyPrayer);
  }

  async saveSettings(payload) {
    this.state.settings = { ...this.state.settings, ...payload, updated_at: new Date().toISOString() };
    this.state.contentRevision += 1;
    this.persist();
    this.emitContent();
    return clone(this.state.settings);
  }

  async saveProgram(payload) {
    const now = new Date().toISOString();
    const programId = payload.programId || this.state.liveSession.program_id || createId();
    const program = {
      id: programId,
      title: payload.title,
      scheduled_for: payload.scheduledFor,
      mode: payload.mode,
      steps: clone(payload.steps),
      status: "published",
      updated_at: now,
    };
    const index = (this.state.programs || []).findIndex((item) => item.id === programId);
    this.state.programs ||= [];
    if (index >= 0) this.state.programs[index] = program;
    else this.state.programs.unshift(program);
    this.state.liveSession = {
      ...this.state.liveSession,
      status: "scheduled",
      mode: payload.mode,
      scheduled_for: payload.scheduledFor,
      program_id: programId,
      program_snapshot: { title: payload.title, steps: clone(payload.steps) },
      stage_index: 0,
      started_at: null,
      stage_started_at: null,
      paused_at: null,
      paused_remaining_seconds: null,
      accumulated_pause_seconds: 0,
      version: this.state.liveSession.version + 1,
      updated_at: now,
    };
    this.persist();
    this.emitLive();
    return { program: clone(program), live_session: clone(this.state.liveSession) };
  }

  async moderateRequest(id, status) {
    const pendingIndex = this.state.pendingRequests.findIndex((item) => item.id === id);
    const approvedIndex = this.state.requests.findIndex((item) => item.id === id);
    const source = pendingIndex >= 0 ? this.state.pendingRequests[pendingIndex] : this.state.requests[approvedIndex];
    if (!source) throw new Error("기도제목을 찾을 수 없습니다.");
    const wasPublic = source.status === "approved";
    source.status = status;
    if (status === "approved") {
      source.approved_at = new Date().toISOString();
      if (pendingIndex >= 0) {
        this.state.pendingRequests.splice(pendingIndex, 1);
        this.state.requests.unshift(source);
      }
    }
    if (["hidden", "rejected", "deleted"].includes(status) && approvedIndex >= 0) {
      this.state.requests.splice(approvedIndex, 1);
    }
    if (["hidden", "rejected", "deleted"].includes(status) && pendingIndex >= 0) {
      this.state.pendingRequests.splice(pendingIndex, 1);
    }
    if (wasPublic || status === "approved") this.state.contentRevision += 1;
    this.persist();
    if (wasPublic || status === "approved") this.emitContent();
    return clone(source);
  }

  async saveMedia(payload) {
    const record = { id: createId(), active: true, ...payload };
    this.state.media.unshift(record);
    this.persist();
    return clone(record);
  }

  async deactivateMedia(id) {
    const record = this.state.media.find((item) => String(item.id) === String(id));
    if (!record) throw new Error("음악을 찾을 수 없습니다.");
    record.active = false;
    this.persist();
    return clone(record);
  }

  async uploadAudio(file) {
    return { path: `preview/${file.name}`, publicUrl: "", previewOnly: true };
  }

  async manageAdmin(action, payload = {}) {
    if (action === "list") return clone(this.state.accounts);
    if (action === "invite") {
      if (this.state.accounts.filter((item) => item.active).length >= 5) throw new Error("활성 Admin은 최대 5명입니다.");
      const account = {
        user_id: createId(),
        display_name: payload.displayName,
        email: payload.email,
        role: "admin",
        active: true,
      };
      this.state.accounts.push(account);
      this.persist();
      return clone(account);
    }
    if (action === "disable") {
      const account = this.state.accounts.find((item) => item.user_id === payload.userId);
      if (!account || account.role === "owner") throw new Error("대표 관리자는 비활성화할 수 없습니다.");
      account.active = false;
      this.persist();
      return clone(account);
    }
    if (action === "activate") {
      if (this.state.accounts.filter((item) => item.active).length >= 5) throw new Error("활성 Admin은 최대 5명입니다.");
      const account = this.state.accounts.find((item) => item.user_id === payload.userId);
      if (!account) throw new Error("Admin 계정을 찾을 수 없습니다.");
      account.active = true;
      this.persist();
      return clone(account);
    }
    throw new Error("지원하지 않는 Admin 작업입니다.");
  }
}

class SupabaseService {
  constructor(config, supabase) {
    this.config = config;
    this.supabase = supabase;
    this.mode = "production";
    this.presenceChannel = null;
    this.liveChannel = null;
  }

  async ensureAnonymousSession() {
    const { data: sessionData, error: sessionError } = await this.supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      const { error } = await this.supabase.auth.signInAnonymously();
      if (error) throw error;
    }
    await this.supabase.realtime.setAuth();
  }

  async fetchPublicContent(serverNow = null, attempt = 0) {
    const effectiveNow = serverNow || await this.getServerTime();
    const settingsResult = await this.supabase
      .from("app_settings")
      .select("id, app_name, church_name, retreat_date, time_zone, daily_prayer_time, emergency_notice, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (settingsResult.error) throw settingsResult.error;
    const today = zonedDateKey(new Date(effectiveNow), settingsResult.data?.time_zone || this.config.timeZone);
    const revisionBefore = await this.supabase
      .from("content_revisions")
      .select("revision")
      .eq("id", 1)
      .maybeSingle();
    if (revisionBefore.error) throw revisionBefore.error;
    const [dailyResult, requestsResult] = await Promise.all([
      this.supabase
        .from("daily_prayers")
        .select("id, prayer_date, scripture_reference, scripture_text, prayer_topic, published, created_at, updated_at")
        .eq("prayer_date", today)
        .eq("published", true)
        .maybeSingle(),
      this.supabase
        .from("prayer_requests")
        .select("id, display_name, is_anonymous, body, approved_at, created_at, status")
        .eq("status", "approved")
        .order("approved_at", { ascending: false }),
    ]);
    const revisionAfter = await this.supabase
      .from("content_revisions")
      .select("revision")
      .eq("id", 1)
      .maybeSingle();
    const error = [dailyResult, requestsResult, revisionAfter].find((result) => result.error)?.error;
    if (error) throw error;
    if (Number(revisionBefore.data?.revision) !== Number(revisionAfter.data?.revision)) {
      if (attempt < 2) return this.fetchPublicContent(null, attempt + 1);
      throw new Error("공개 기도 콘텐츠가 변경되어 다시 확인해야 합니다.");
    }
    return {
      settings: settingsResult.data,
      dailyPrayer: dailyResult.data,
      requests: requestsResult.data || [],
      contentRevision: Number(revisionAfter.data?.revision || 0),
      serverNow: effectiveNow,
    };
  }

  async loadPublicData(serverNow = null) {
    await this.syncLive();
    const [publicContent, liveResult, mediaResult] = await Promise.all([
      this.fetchPublicContent(serverNow),
      this.supabase
        .from("live_sessions")
        .select("id, status, mode, scheduled_for, program_id, program_snapshot, stage_index, started_at, stage_started_at, paused_at, accumulated_pause_seconds, paused_remaining_seconds, announcement, media, version, updated_at")
        .eq("id", 1)
        .maybeSingle(),
      this.supabase
        .from("media_assets")
        .select("id, kind, label, source_url, storage_path, start_seconds, active, created_at")
        .eq("active", true),
    ]);
    const error = [liveResult, mediaResult].find((result) => result.error)?.error;
    if (error) throw error;
    return {
      ...publicContent,
      liveSession: liveResult.data,
      media: mediaResult.data || [],
    };
  }

  async syncLive() {
    const { data, error } = await this.supabase.rpc("sync_automatic_live_session");
    if (error) throw error;
    return data;
  }

  async getServerTime() {
    const { data, error } = await this.supabase.rpc("server_now");
    if (error) throw error;
    return data;
  }

  async connectPresence({ sessionId, tabId, context }, onState) {
    await this.ensureAnonymousSession();
    onState({ synced: false, count: null, status: "connecting" });
    const topic = context === "live" ? `${this.config.presenceTopic}:live` : this.config.presenceTopic;
    const channel = this.supabase.channel(topic, {
      config: { private: true, presence: { key: tabId } },
    });
    channel.on("presence", { event: "sync" }, () => {
      onState({
        synced: true,
        count: countUniquePresenceSessions(channel.presenceState()),
        status: "connected",
      });
    });
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ session_id: sessionId, context, joined_at: new Date().toISOString() });
      }
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        onState({ synced: false, count: null, status: "reconnecting" });
      }
    });
    this.presenceChannel = channel;
    return async () => {
      await channel.untrack().catch(() => {});
      await this.supabase.removeChannel(channel);
    };
  }

  async observePresence(context, onState) {
    await this.supabase.realtime.setAuth();
    onState({ synced: false, count: null, status: "connecting" });
    const topic = context === "live" ? `${this.config.presenceTopic}:live` : this.config.presenceTopic;
    const channel = this.supabase.channel(topic, { config: { private: true } });
    channel.on("presence", { event: "sync" }, () => {
      onState({
        synced: true,
        count: countUniquePresenceSessions(channel.presenceState()),
        status: "connected",
      });
    });
    channel.subscribe((status) => {
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        onState({ synced: false, count: null, status: "reconnecting" });
      }
    });
    return () => this.supabase.removeChannel(channel);
  }

  async fetchLiveSession() {
    const { data, error } = await this.supabase
      .from("live_sessions")
      .select("id, status, mode, scheduled_for, program_id, program_snapshot, stage_index, started_at, stage_started_at, paused_at, accumulated_pause_seconds, paused_remaining_seconds, announcement, media, version, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  subscribeLive(listener, onStatus = () => {}) {
    let active = true;
    let reconciling = false;
    let reconcileTimer = null;
    const reconcile = async () => {
      if (!active || reconciling) return;
      reconciling = true;
      try {
        const current = await this.fetchLiveSession();
        if (active && current) listener(current);
        if (active) onStatus("connected");
      } catch (error) {
        if (active) {
          onStatus("reconnecting", error);
          clearTimeout(reconcileTimer);
          reconcileTimer = setTimeout(reconcile, 5_000);
        }
      } finally {
        reconciling = false;
      }
    };
    const channel = this.supabase
      .channel("retreat-prayer:live-state")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_sessions", filter: "id=eq.1" },
        (payload) => listener(payload.new)
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") reconcile();
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) onStatus("reconnecting");
      });
    this.liveChannel = channel;
    return () => {
      active = false;
      clearTimeout(reconcileTimer);
      return this.supabase.removeChannel(channel);
    };
  }

  subscribeContent(listener, onStatus = () => {}) {
    let active = true;
    let reconciling = false;
    let reconcileRequested = false;
    let reconcileTimer = null;
    const reconcile = async () => {
      if (!active) return;
      if (reconciling) {
        reconcileRequested = true;
        return;
      }
      reconciling = true;
      reconcileRequested = false;
      try {
        const content = await this.fetchPublicContent();
        if (active) listener(content);
        if (active) onStatus("connected");
      } catch (error) {
        if (active) {
          onStatus("reconnecting", error);
          clearTimeout(reconcileTimer);
          reconcileTimer = setTimeout(reconcile, 5_000);
        }
      } finally {
        reconciling = false;
        if (active && reconcileRequested) queueMicrotask(reconcile);
      }
    };
    const channel = this.supabase
      .channel("retreat-prayer:public-content")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "content_revisions", filter: "id=eq.1" },
        reconcile,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") reconcile();
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) onStatus("reconnecting");
      });
    return () => {
      active = false;
      clearTimeout(reconcileTimer);
      return this.supabase.removeChannel(channel);
    };
  }

  async submitPrayerRequest(payload) {
    await this.ensureAnonymousSession();
    const { data, error } = await this.supabase.functions.invoke("submit-prayer-request", { body: payload });
    if (error) await throwFunctionError(error, "기도제목을 전달하지 못했습니다.");
    return data;
  }

  async getAdminSession() {
    const { data: sessionData, error: sessionError } = await this.supabase.auth.getSession();
    if (sessionError || !sessionData.session?.user || sessionData.session.user.is_anonymous) return null;
    const { data: profile, error: profileError } = await this.supabase
      .from("admin_profiles")
      .select("user_id, display_name, role, active")
      .eq("user_id", sessionData.session.user.id)
      .eq("active", true)
      .maybeSingle();
    if (profileError || !profile) return null;
    await this.supabase.realtime.setAuth(sessionData.session.access_token);
    return { user: sessionData.session.user, session: sessionData.session, profile };
  }

  async updateAdminPassword(password) {
    const { data, error } = await this.supabase.auth.updateUser({
      password,
      data: { retreat_prayer_needs_password_setup: false },
    });
    if (error) throw error;
    const session = await this.getAdminSession();
    if (!session) throw new Error("활성 Admin 권한을 확인할 수 없습니다.");
    return { ...session, user: data.user || session.user };
  }

  async adminLogin(email, password) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data: profile, error: profileError } = await this.supabase
      .from("admin_profiles")
      .select("user_id, display_name, role, active")
      .eq("user_id", data.user.id)
      .eq("active", true)
      .single();
    if (profileError) {
      await this.supabase.auth.signOut();
      throw new Error("활성 Admin 권한을 확인할 수 없습니다.");
    }
    await this.supabase.realtime.setAuth(data.session.access_token);
    return { ...data, profile };
  }

  async adminLogout() {
    await this.supabase.auth.signOut();
  }

  async getAdminSnapshot() {
    const { data: authData, error: authError } = await this.supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Admin 로그인이 필요합니다.");
    const [profile, publicData, pending, programs, audit, now] = await Promise.all([
      this.supabase.from("admin_profiles").select("*").eq("user_id", authData.user.id).eq("active", true).single(),
      this.loadPublicData(),
      this.supabase
        .from("prayer_requests")
        .select("id, display_name, is_anonymous, body, status, approved_at, created_at")
        .eq("status", "pending")
        .order("created_at")
        .limit(50),
      this.supabase.from("prayer_programs").select("*").in("status", ["draft", "published"]).order("scheduled_for"),
      this.supabase.from("admin_audit").select("*").order("created_at", { ascending: false }).limit(40),
      this.supabase.rpc("server_now"),
    ]);
    const error = [profile, pending, programs, audit, now].find((result) => result.error)?.error;
    if (error) throw error;
    return {
      ...publicData,
      profile: profile.data,
      pendingRequests: pending.data || [],
      programs: programs.data || [],
      audit: audit.data || [],
      serverNow: now.data,
    };
  }

  async getAudit() {
    const { data, error } = await this.supabase
      .from("admin_audit")
      .select("id, admin_id, action, target_type, target_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    return data || [];
  }

  async claimController(token) {
    const { data, error } = await this.supabase.rpc("claim_live_controller", { p_lease_token: token });
    if (error) throw error;
    return data;
  }

  async applyLiveAction(token, action, payload = {}, expectedVersion = null) {
    const { data, error } = await this.supabase.rpc("apply_live_action", {
      p_lease_token: token,
      p_expected_version: expectedVersion,
      p_action: action,
      p_payload: payload,
    });
    if (error) throw error;
    return data;
  }

  async saveDailyPrayer(payload) {
    const { data, error } = await this.supabase
      .from("daily_prayers")
      .upsert(payload, { onConflict: "prayer_date" })
      .select("id, prayer_date, scripture_reference, scripture_text, prayer_topic, published, created_at, updated_at")
      .single();
    if (error) throw error;
    return data;
  }

  async saveSettings(payload) {
    const { data, error } = await this.supabase
      .from("app_settings")
      .update(payload)
      .eq("id", 1)
      .select("id, app_name, church_name, retreat_date, time_zone, daily_prayer_time, emergency_notice, updated_at")
      .single();
    if (error) throw error;
    return data;
  }

  async saveProgram(payload) {
    const { data, error } = await this.supabase.rpc("configure_prayer_program", {
      p_program_id: payload.programId || null,
      p_title: payload.title,
      p_scheduled_for: payload.scheduledFor,
      p_mode: payload.mode,
      p_steps: payload.steps,
    });
    if (error) throw error;
    return data;
  }

  async moderateRequest(id, status) {
    const { data, error } = await this.supabase
      .from("prayer_requests")
      .update({ status, approved_at: status === "approved" ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id, display_name, is_anonymous, body, status, approved_at, created_at")
      .single();
    if (error) throw error;
    return data;
  }

  async saveMedia(payload) {
    const { data, error } = await this.supabase
      .from("media_assets")
      .insert(payload)
      .select("id, kind, label, source_url, storage_path, start_seconds, active, created_at")
      .single();
    if (error) throw error;
    return data;
  }

  async deactivateMedia(id) {
    const { data, error } = await this.supabase
      .from("media_assets")
      .update({ active: false })
      .eq("id", id)
      .select("id, kind, label, source_url, storage_path, start_seconds, active, created_at")
      .single();
    if (error) throw error;
    return data;
  }

  async uploadAudio(file) {
    const path = `${new Date().toISOString().slice(0, 10)}/${createId()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error } = await this.supabase.storage.from("prayer-audio").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = this.supabase.storage.from("prayer-audio").getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
  }

  async manageAdmin(action, payload = {}) {
    const { data, error } = await this.supabase.functions.invoke("manage-admin", { body: { action, ...payload } });
    if (error) await throwFunctionError(error, "Admin 작업을 처리하지 못했습니다.");
    return data;
  }
}

export async function createPrayerService(config, { admin = false } = {}) {
  if (hasProductionConfig(config)) {
    const { createClient } = await import(config.supabaseModuleUrl);
    const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: admin,
        storageKey: admin ? "retreat-prayer-admin-auth" : "retreat-prayer-participant-auth",
      },
    });
    return new SupabaseService(config, supabase);
  }
  if (isLocalPreview(config)) return new PreviewService(config);
  const error = new Error("기도 플랫폼의 실시간 연결이 아직 설정되지 않았습니다.");
  error.code = "CONFIG_REQUIRED";
  throw error;
}
