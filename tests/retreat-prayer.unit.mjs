import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../static/retreat-prayer/assets/core.js", import.meta.url), "utf8");
const core = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const realtimeSetupSource = await readFile(new URL("../static/retreat-prayer/assets/realtime-setup.js", import.meta.url), "utf8");
const { RealtimeSetupCoordinator } = await import(`data:text/javascript;base64,${Buffer.from(realtimeSetupSource).toString("base64")}`);
const appSource = await readFile(new URL("../static/retreat-prayer/assets/app.js", import.meta.url), "utf8");
const migrationSource = await readFile(
  new URL("../supabase/migrations/20260828010000_retreat_prayer.sql", import.meta.url),
  "utf8",
);
const validationMigrationSource = await readFile(
  new URL("../supabase/migrations/20260828020000_retreat_prayer_security_validation.sql", import.meta.url),
  "utf8",
);
const schedulePendingMigrationSource = await readFile(
  new URL("../supabase/migrations/20260828040000_retreat_prayer_schedule_pending.sql", import.meta.url),
  "utf8",
);
const inviteOnlyAuthMigrationSource = await readFile(
  new URL("../supabase/migrations/20260828050000_retreat_prayer_invite_only_auth.sql", import.meta.url),
  "utf8",
);
const optionalScriptureMigrationSource = await readFile(
  new URL("../supabase/migrations/20260829010000_retreat_prayer_optional_scripture.sql", import.meta.url),
  "utf8",
);
const liveContentEditMigrationSource = await readFile(
  new URL("../supabase/migrations/20260829020000_retreat_prayer_live_content_edit.sql", import.meta.url),
  "utf8",
);
const privateRealtimeMigrationSource = await readFile(
  new URL("../supabase/migrations/20260829030000_retreat_prayer_private_realtime_changes.sql", import.meta.url),
  "utf8",
);
const safeLiveContentMigrationSource = await readFile(
  new URL("../supabase/migrations/20260829040000_retreat_prayer_safe_live_content_edit.sql", import.meta.url),
  "utf8",
);
const mediaDeleteMigrationSource = await readFile(
  new URL("../supabase/migrations/20260829050000_retreat_prayer_media_delete.sql", import.meta.url),
  "utf8",
);
const adminLimitMigrationSource = await readFile(
  new URL("../supabase/migrations/20260829060000_retreat_prayer_admin_limit_10.sql", import.meta.url),
  "utf8",
);
const edgeSecretHelperSource = await readFile(
  new URL("../supabase/functions/_shared/supabase-key.ts", import.meta.url),
  "utf8",
);
const runtimeConfigSource = await readFile(
  new URL("../static/retreat-prayer/config.js", import.meta.url),
  "utf8",
);
const supabaseConfigSource = await readFile(
  new URL("../supabase/config.toml", import.meta.url),
  "utf8",
);
const backendSource = await readFile(new URL("../static/retreat-prayer/assets/backend.js", import.meta.url), "utf8");
const { SupabaseService } = await import(new URL("../static/retreat-prayer/assets/backend.js", import.meta.url));
const adminScriptSource = await readFile(new URL("../static/retreat-prayer/assets/admin.js", import.meta.url), "utf8");
const manageAdminSource = await readFile(new URL("../supabase/functions/manage-admin/index.ts", import.meta.url), "utf8");
const participantHtmlSource = await readFile(new URL("../static/retreat-prayer/index.html", import.meta.url), "utf8");
const participantStylesSource = await readFile(new URL("../static/retreat-prayer/assets/styles.css", import.meta.url), "utf8");
const presenceCanvasSource = await readFile(new URL("../static/retreat-prayer/assets/presence-canvas.js", import.meta.url), "utf8");
const adminHtmlSource = await readFile(new URL("../static/retreat-prayer/admin/index.html", import.meta.url), "utf8");
const designSource = await readFile(new URL("../DESIGN.md", import.meta.url), "utf8");

async function assertUniqueIds(relativeHtmlPath) {
  const html = await readFile(new URL(relativeHtmlPath, import.meta.url), "utf8");
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${relativeHtmlPath} contains duplicate ids`);
  return new Set(ids);
}

async function assertLiteralIdReferencesExist(relativeJsPath, htmlIds) {
  const javascript = await readFile(new URL(relativeJsPath, import.meta.url), "utf8");
  const references = [...javascript.matchAll(/\$\("#([a-zA-Z][a-zA-Z0-9_-]*)"\)/g)].map((match) => match[1]);
  references.forEach((id) => assert.ok(htmlIds.has(id), `${relativeJsPath} references missing #${id}`));
}

const steps = [
  { id: "one", label: "말씀", content: "첫 번째 단계", duration_seconds: 120 },
  { id: "two", label: "기도", content: "두 번째 단계", duration_seconds: 180 },
];

test("자동 진행은 서버 기준 경과 시간으로 현재 단계를 계산한다", () => {
  const startedAt = Date.parse("2026-08-28T12:00:00Z");
  const view = core.deriveLiveView({
    status: "live",
    mode: "auto",
    started_at: new Date(startedAt).toISOString(),
    program_snapshot: { steps },
    accumulated_pause_seconds: 0,
  }, startedAt + 150_000);

  assert.equal(view.stageIndex, 1);
  assert.equal(view.step.id, "two");
  assert.equal(Math.round(view.remainingSeconds), 150);
});

test("일반 첫 화면 조회는 자동 진행 행 잠금 RPC를 매번 호출하지 않는다", () => {
  const loadPublicDataBody = backendSource.slice(
    backendSource.indexOf("async loadPublicData(serverNow = null)"),
    backendSource.indexOf("async syncLive()"),
  );
  assert.doesNotMatch(loadPublicDataBody, /syncLive\(\)/);
  assert.match(appSource, /const shouldStart[\s\S]*?const shouldComplete[\s\S]*?state\.service\.syncLive\(\)/);
});

test("수동 진행은 stage_started_at과 서버 오프셋이 반영된 now를 사용한다", () => {
  const anchor = Date.parse("2026-08-28T12:00:00Z");
  const view = core.deriveLiveView({
    status: "live",
    mode: "manual",
    stage_index: 0,
    stage_started_at: new Date(anchor).toISOString(),
    program_snapshot: { steps },
  }, anchor + 61_000);

  assert.equal(view.stageIndex, 0);
  assert.equal(Math.round(view.remainingSeconds), 59);
});

test("Presence는 탭 수가 아니라 고유 브라우저 session_id 수를 센다", () => {
  const presenceState = {
    tabA: [{ session_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", context: "live" }],
    tabB: [{ session_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", context: "space" }],
    tabC: [{ session_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", context: "space" }],
    invalid: [{ session_id: "short" }],
  };
  assert.equal(core.countUniquePresenceSessions(presenceState), 2);
  assert.equal(core.countUniquePresenceSessions(presenceState, "live"), 1);
});

test("Presence 상태 전환이 겹쳐도 마지막 화면의 context가 서버에 마지막으로 기록된다", async () => {
  const pendingTracks = [];
  const channel = {
    track(payload) {
      return new Promise((resolve) => pendingTracks.push({ payload, resolve }));
    },
    presenceState() {
      return {};
    },
  };
  const service = new SupabaseService({}, {});
  service.presenceMinTrackIntervalMs = 0;
  service.presenceChannel = channel;
  const states = [];

  const liveUpdate = service.updatePresenceContext(
    { sessionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", context: "live" },
    (state) => states.push(["live", state]),
  );
  await new Promise((resolve) => setImmediate(resolve));
  const spaceUpdate = service.updatePresenceContext(
    { sessionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", context: "space" },
    (state) => states.push(["space", state]),
  );

  assert.equal(pendingTracks.length, 1);
  assert.equal(pendingTracks[0].payload.context, "live");
  pendingTracks.shift().resolve("ok");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pendingTracks.length, 1);
  assert.equal(pendingTracks[0].payload.context, "space");
  pendingTracks.shift().resolve("ok");
  await Promise.all([liveUpdate, spaceUpdate]);

  assert.equal(service.presenceContext, "space");
  assert.equal(states.some(([label, state]) => label === "live" && state.synced), false);
  assert.equal(states.some(([label, state]) => label === "space" && state.synced), true);
});

test("Presence context track 대기 중 sync는 새 화면의 동기화 완료로 표시하지 않는다", async () => {
  let syncCallback;
  let resolveContextTrack;
  let trackCalls = 0;
  const channel = {
    on(event, _filter, callback) {
      if (event === "presence") syncCallback = callback;
      return this;
    },
    subscribe(callback) {
      queueMicrotask(() => callback("SUBSCRIBED"));
      return this;
    },
    track() {
      trackCalls += 1;
      if (trackCalls === 1) return Promise.resolve("ok");
      return new Promise((resolve) => { resolveContextTrack = resolve; });
    },
    presenceState() {
      return { liveMember: [{ session_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", context: "live" }] };
    },
  };
  const supabase = {
    auth: { async getSession() { return { data: { session: { access_token: "test" } }, error: null }; } },
    realtime: { async setAuth() {} },
    channel() { return channel; },
    async removeChannel() {},
  };
  const service = new SupabaseService({ presenceTopic: "retreat-prayer:presence" }, supabase);
  service.presenceMinTrackIntervalMs = 0;
  const states = [];
  const disconnect = await service.connectPresence(
    {
      sessionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      tabId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      context: "space",
    },
    (nextState) => states.push(nextState),
  );
  states.length = 0;

  const update = service.updatePresenceContext(
    { sessionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", context: "live" },
    (nextState) => states.push(nextState),
  );
  await new Promise((resolve) => setImmediate(resolve));
  syncCallback();
  assert.equal(states.some((nextState) => nextState.synced), false);

  resolveContextTrack("ok");
  await update;
  assert.equal(states.filter((nextState) => nextState.synced).length, 1);
  await disconnect();
});

test("첫 Presence track이 실패하면 연결 완료로 표시하지 않고 채널을 정리한다", async () => {
  let removed = false;
  const channel = {
    on() { return this; },
    subscribe(callback) {
      queueMicrotask(() => callback("SUBSCRIBED"));
      return this;
    },
    async track() { return "timed out"; },
    async untrack() { return "ok"; },
    presenceState() { return {}; },
  };
  const supabase = {
    auth: { async getSession() { return { data: { session: { access_token: "test" } }, error: null }; } },
    realtime: { async setAuth() {} },
    channel() { return channel; },
    async removeChannel() { removed = true; },
  };
  const service = new SupabaseService({ presenceTopic: "retreat-prayer:presence" }, supabase);
  const states = [];

  await assert.rejects(
    service.connectPresence(
      {
        sessionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        tabId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        context: "space",
      },
      (state) => states.push(state),
    ),
    /timed out/,
  );

  assert.equal(states.some((state) => state.synced), false);
  assert.equal(removed, true);
  assert.equal(service.presenceChannel, null);
});

test("Presence 채널이 재연결되면 마지막 화면 context를 다시 track한다", async () => {
  let subscribeCallback;
  const trackedContexts = [];
  const channel = {
    on() { return this; },
    subscribe(callback) {
      subscribeCallback = callback;
      queueMicrotask(() => callback("SUBSCRIBED"));
      return this;
    },
    async track(payload) {
      trackedContexts.push(payload.context);
      return "ok";
    },
    presenceState() { return {}; },
  };
  const supabase = {
    auth: { async getSession() { return { data: { session: { access_token: "test" } }, error: null }; } },
    realtime: { async setAuth() {} },
    channel() { return channel; },
    async removeChannel() {},
  };
  const service = new SupabaseService({ presenceTopic: "retreat-prayer:presence" }, supabase);
  service.presenceMinTrackIntervalMs = 0;
  const disconnect = await service.connectPresence(
    {
      sessionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      tabId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      context: "space",
    },
    () => {},
  );
  await service.updatePresenceContext(
    { sessionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", context: "live" },
    () => {},
  );

  subscribeCallback("SUBSCRIBED");
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(trackedContexts, ["space", "live", "live"]);
  await disconnect();
});

test("Asia/Seoul 자정은 UTC 날짜와 독립적으로 오늘의 기도 키를 바꾼다", () => {
  assert.equal(core.zonedDateKey(new Date("2026-08-28T14:59:59Z"), "Asia/Seoul"), "2026-08-28");
  assert.equal(core.zonedDateKey(new Date("2026-08-28T15:00:00Z"), "Asia/Seoul"), "2026-08-29");
});

test("공동기도 시각이 미정이면 임의의 21시 대신 안내 예정 상태를 표시한다", () => {
  assert.equal(core.formatDailyPrayerInvitation(null), "다음 공동기도 일정은 곧 안내됩니다.");
  assert.equal(
    core.formatDailyPrayerInvitation("21:00:00"),
    "다음 공동기도는 매일 오후 9:00에 시작됩니다.",
  );
});

test("기도제목 입력은 필수 동의와 길이 제한을 조용히 우회하지 못한다", () => {
  const tooLong = core.normalizePrayerSubmission({
    displayName: "가".repeat(41),
    body: "나".repeat(801),
    consent: true,
  });
  assert.equal(tooLong.valid, false);
  assert.match(tooLong.errors.displayName, /40자/);
  assert.match(tooLong.errors.body, /800자/);

  const valid = core.normalizePrayerSubmission({
    displayName: "  청년부   A  ",
    body: "수련회 가운데 말씀의 은혜를 깊이 누리도록 기도해주세요.",
    consent: true,
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.value.displayName, "청년부 A");

  const anonymous = core.normalizePrayerSubmission({
    displayName: "브라우저 밖으로 보내지 않을 이름",
    body: "익명으로 공동체에 나누고 싶은 충분히 긴 기도제목입니다.",
    isAnonymous: true,
    consent: true,
  });
  assert.equal(anonymous.valid, true);
  assert.equal(anonymous.value.displayName, "");
});

test("공동기도 스냅샷은 단계별 공개 음악 정보까지 함께 고정한다", () => {
  const mediaId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const parsed = core.parseProgramSteps({
    steps: [{ ...steps[0], media_id: mediaId }],
    media: [{ id: mediaId, kind: "audio", source_url: "https://example.test/prayer.mp3", active: true }],
  });
  assert.equal(parsed[0].mediaId, mediaId);
  assert.equal(parsed[0].media.source_url, "https://example.test/prayer.mp3");
});

test("공개 배포는 완전한 Supabase 설정이 없으면 운영 모드가 되지 않는다", () => {
  assert.equal(core.hasProductionConfig({ supabaseUrl: "", supabasePublishableKey: "" }), false);
  assert.equal(core.hasProductionConfig({
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_example",
  }), true);
});

test("운영 설정에는 전용 프로젝트의 공개 키만 들어간다", () => {
  assert.match(runtimeConfigSource, /supabaseUrl: "https:\/\/bxgqhdqseahujiadvhyk\.supabase\.co"/);
  assert.match(runtimeConfigSource, /supabasePublishableKey: "sb_publishable_/);
  assert.doesNotMatch(runtimeConfigSource, /sb_secret_/);
  assert.doesNotMatch(runtimeConfigSource, /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
  assert.match(runtimeConfigSource, /churchName: "시광교회 2청년부"/);
  assert.match(runtimeConfigSource, /retreatDate: "2026-10-08"/);
  assert.match(runtimeConfigSource, /retreatEndDate: "2026-10-10"/);
  assert.match(runtimeConfigSource, /dailyPrayerTime: ""/);
});

test("일정 미정 migration은 수련회 기간과 nullable 공동기도 시각을 보존한다", () => {
  assert.match(migrationSource, /retreat_end_date date/);
  assert.match(migrationSource, /daily_prayer_time time,/);
  assert.match(migrationSource, /constraint app_settings_retreat_date_range_check/);
  assert.match(schedulePendingMigrationSource, /alter column daily_prayer_time drop not null/);
  assert.match(schedulePendingMigrationSource, /set daily_prayer_time = null/);
  assert.match(schedulePendingMigrationSource, /set scheduled_for = null,[\s\S]*?status = 'draft'/);
});

test("초대 Admin은 이메일 로그인할 수 있지만 공개 회원가입은 할 수 없다", () => {
  const authSection = supabaseConfigSource.slice(
    supabaseConfigSource.indexOf("[auth]"),
    supabaseConfigSource.indexOf("[auth.rate_limit]"),
  );
  const emailSection = supabaseConfigSource.slice(
    supabaseConfigSource.indexOf("[auth.email]"),
    supabaseConfigSource.indexOf("[auth.mfa.totp]"),
  );
  assert.match(authSection, /enable_signup = true/);
  assert.match(authSection, /enable_anonymous_sign_ins = true/);
  assert.match(emailSection, /enable_signup = true/);
  assert.match(supabaseConfigSource, /\[auth\.hook\.before_user_created\][\s\S]*?enabled = true[\s\S]*?hook_restrict_retreat_prayer_signup/);
  assert.match(inviteOnlyAuthMigrationSource, /if user_is_anonymous then[\s\S]*?return '\{\}'::jsonb/);
  assert.match(inviteOnlyAuthMigrationSource, /delete from public\.admin_invite_nonces[\s\S]*?returning nonce_hash into consumed_nonce/);
  assert.match(inviteOnlyAuthMigrationSource, /grant execute on function public\.hook_restrict_retreat_prayer_signup\(jsonb\)[\s\S]*?to supabase_auth_admin/);
  assert.match(manageAdminSource, /createInviteNonce\(\)[\s\S]*?admin_invite_nonces/);
  assert.match(manageAdminSource, /retreat_prayer_invite_nonce: inviteNonce/);
});

test("Admin 초대 비밀번호 실패 후 새 설정 링크를 받고 정책을 미리 확인할 수 있다", () => {
  assert.match(adminHtmlSource, /id="admin-password-recovery-form"[\s\S]*?새 비밀번호 설정 링크 받기/);
  assert.match(adminHtmlSource, /10~72자이며 영문 대문자·소문자·숫자·허용 특수문자/);
  assert.match(adminScriptSource, /const PASSWORD_SYMBOLS = [\s\S]*?password\.length < 10 \|\| password\.length > 72[\s\S]*?hasAllowedSymbol/);
  assert.match(backendSource, /requestAdminPasswordReset\(email\)[\s\S]*?resetPasswordForEmail\(email,[\s\S]*?redirectTo: redirectUrl\.href/);
  assert.match(adminScriptSource, /type=invite[\s\S]*?type=recovery[\s\S]*?URLSearchParams\(location\.search\)\.has\("code"\)/);
  assert.match(adminScriptSource, /requestAdminPasswordReset\(email\)[\s\S]*?등록된 Admin 이메일이라면/);
});

test("오늘의 말씀은 비워 게시할 수 있고 참여자 화면은 빈 말씀 카드를 생략한다", () => {
  assert.match(optionalScriptureMigrationSource, /alter column scripture_reference drop not null/);
  assert.match(optionalScriptureMigrationSource, /alter column scripture_text drop not null/);
  assert.match(appSource, /setVisible\(\$\("#home-scripture-card"\), !hasPublishedDaily \|\| hasScripture\)/);
  assert.match(appSource, /ritual-layout--without-scripture/);
  assert.match(participantHtmlSource, /id="today-scripture-card"/);
});

test("연결 상태는 본문을 가리지 않는 작은 아이콘으로만 표시한다", () => {
  const statusBannerStart = participantStylesSource.indexOf(".status-banner {");
  const statusBannerBlock = participantStylesSource.slice(statusBannerStart, participantStylesSource.indexOf("}\n", statusBannerStart) + 2);
  assert.match(participantHtmlSource, /id="connection-message" class="sr-only"/);
  assert.match(statusBannerBlock, /width: 34px;[\s\S]*?height: 34px;/);
  assert.doesNotMatch(statusBannerBlock, /left: 50%/);
  assert.match(appSource, /banner\.setAttribute\("aria-label", message\)/);
});

test("공동기도는 기도문 뒤의 절제된 3D Presence와 정확한 활성 연결 문구를 제공한다", () => {
  assert.match(participantHtmlSource, /class="live-presence-backdrop" aria-hidden="true"[\s\S]*?id="mini-presence-canvas"/);
  assert.match(participantHtmlSource, /class="focus-presence-window" aria-label="함께 기도 중인 지체 수"/);
  assert.match(participantHtmlSource, /id="live-presence-fallback"[\s\S]*?hidden/);
  assert.match(participantStylesSource, /\.live-presence-backdrop \{[\s\S]*?pointer-events: none;[\s\S]*?mask-image:/);
  assert.match(participantStylesSource, /\.live-presence-backdrop::after[\s\S]*?radial-gradient/);
  assert.match(participantStylesSource, /\.focus-content \{[\s\S]*?z-index: 2/);
  assert.match(participantStylesSource, /\.focus-footer \{[\s\S]*?position: fixed;[\s\S]*?pointer-events: none/);
  assert.match(participantStylesSource, /\.focus-presence-window \{[\s\S]*?border-radius: 999px;[\s\S]*?pointer-events: none;[\s\S]*?animation: focus-presence-float 8s/);
  assert.match(participantStylesSource, /\.focus-view \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto;[\s\S]*?overflow: hidden/);
  assert.match(participantStylesSource, /orientation: landscape[\s\S]*?align-content: start/);
  assert.match(appSource, /\$\("#live-presence-count"\), liveText/);
  assert.match(appSource, /\$\{state\.presenceCount\}명의 지체/);
  assert.match(appSource, /livePresenceContext: "가 함께 기도 중입니다"/);
  assert.match(appSource, /지체 수 동기화됨/);
  assert.doesNotMatch(appSource, /명의 지체이 함께 기도 중입니다/);
  assert.match(appSource, /\$\("#live-presence-context"\), state\.presenceSynced \? state\.livePresenceContext : ""/);
  assert.match(appSource, /function setLivePresenceContext\(message\)/);
  assert.match(appSource, /variant: "live-backdrop"/);
  assert.match(appSource, /if \(!state\.miniCanvas\.start\(\)\) setVisible\(\$\("#live-presence-fallback"\), true\)/);
  assert.match(presenceCanvasSource, /variant === "live-backdrop" \? 36/);
  assert.match(presenceCanvasSource, /variant === "live-backdrop" \? 1000 \/ 15/);
  assert.match(presenceCanvasSource, /variant === "live-backdrop" \? 1\.25 : 2/);
});

test("Realtime 준비가 실패해도 내용을 유지하고 멱등형 재설치를 예약한다", () => {
  assert.match(appSource, /new RealtimeSetupCoordinator\(\{[\s\S]*?install: \(\) => installRealtimeSubscriptions\(service, coordinator\)/);
  assert.match(appSource, /마지막으로 받은 기도 내용은 계속 볼 수 있습니다/);
  assert.match(appSource, /state\.presenceStatus = "unavailable";[\s\S]*?renderPresence\(\)/);
  assert.match(appSource, /await reconcileRealtimeSnapshot\(service\)/);
  assert.match(appSource, /fetchLiveSession[\s\S]*?fetchPublicContent/);
  assert.match(realtimeSetupSource, /\[2_000, 5_000, 15_000, 30_000\]/);
  assert.match(realtimeSetupSource, /if \(this\.inFlight\) return this\.inFlight/);
});

test("50명 규모의 동시 접속은 Realtime과 Presence를 각각 16초 구간에 분산한다", () => {
  assert.match(appSource, /const REALTIME_STAGGER_MAX_MS = 16_000/);
  assert.match(appSource, /const PRESENCE_STAGGER_MAX_MS = 16_000/);
  assert.match(appSource, /getRealtimeStaggerDelay\(scope, maximumDelayMs = REALTIME_STAGGER_MAX_MS\)/);
  assert.match(appSource, /waitForRealtimeStagger\(`presence:\$\{context\}`, minimumDelayMs, PRESENCE_STAGGER_MAX_MS\)/);
  assert.match(appSource, /updatePresence && state\.realtimeReady/);
  assert.match(appSource, /await waitForRealtimeStagger\("startup"\)/);
  assert.match(appSource, /onSuccess:[\s\S]*?state\.realtimeReady = true;[\s\S]*?minimumDelayMs: REALTIME_STAGGER_MAX_MS/);
  assert.match(appSource, /state\.service\.updatePresenceContext\([\s\S]*?sessionId: state\.sessionId[\s\S]*?context/);
  assert.match(backendSource, /queuePresenceTrack\([\s\S]*?channel\.track[\s\S]*?updatePresenceContext\([\s\S]*?queuePresenceTrack/);
  assert.match(appSource, /delays: REALTIME_RETRY_DELAYS_MS\.map\(\(delay\) => delay \+ getRealtimeStaggerDelay\("retry"\)\)/);
  assert.match(appSource, /enterLivePrayer\(\{ updatePresence: false \}\)/);
  assert.match(appSource, /await service\.subscribeParticipantUpdates\([\s\S]*?isCurrentInstall\(\)[\s\S]*?receiveLiveSession[\s\S]*?applyPublicContent/);
  assert.match(backendSource, /subscribeParticipantUpdates\([\s\S]*?channel\("retreat-prayer:live-state", \{ config: \{ private: true \} \}\)[\s\S]*?table: "live_sessions"[\s\S]*?table: "content_revisions"/);
  assert.match(appSource, /setInterval\(revalidatePublicContent, 60_000\)/);
});

test("Presence 전환 대기 중 화면이 바뀌면 오래된 예약과 인원 표시를 취소한다", () => {
  assert.match(appSource, /const generation = \+\+state\.presenceGeneration;\s*state\.presenceDesiredContext = context/);
  assert.match(appSource, /state\.presenceSynced = false;\s*state\.presenceCount = null;[\s\S]*?await waitForRealtimeStagger/);
  assert.match(appSource, /generation !== state\.presenceGeneration \|\| state\.presenceDesiredContext !== context/);
  assert.match(appSource, /state\.presenceContext === context && state\.presenceDisconnect && state\.presenceUpdateInFlight === 0[\s\S]*?state\.presenceSnapshots\.get\(context\)[\s\S]*?return/);
  assert.match(backendSource, /queuePresenceTrack\(channel, version,[\s\S]*?presenceContextVersion[\s\S]*?"superseded"/);
});

test("Realtime 조정기는 첫 실패 뒤 두 번째 설치에 성공하고 중복 설치하지 않는다", async () => {
  let attempts = 0;
  let failures = 0;
  let successes = 0;
  const scheduled = [];
  const coordinator = new RealtimeSetupCoordinator({
    install: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("first attempt fails");
    },
    onFailure: () => { failures += 1; },
    onSuccess: () => { successes += 1; },
    setTimer: (callback, delay) => {
      const timer = { callback, delay };
      scheduled.push(timer);
      return timer;
    },
    clearTimer: () => {},
  });

  assert.equal(await coordinator.start(), false);
  assert.equal(attempts, 1);
  assert.equal(failures, 1);
  assert.equal(scheduled[0].delay, 2_000);
  scheduled.shift().callback();
  assert.equal(await coordinator.start(), true);
  assert.equal(attempts, 2);
  assert.equal(successes, 1);
  assert.equal(await coordinator.start(), true);
  assert.equal(attempts, 2);
  assert.equal(coordinator.retry(new Error("runtime failure")), true);
  assert.equal(coordinator.ready, false);
  assert.equal(failures, 2);
  assert.equal(scheduled[0].delay, 2_000);
});

test("A–Z 디자인 어휘는 절제된 공동체 별자리 결정으로 수렴한다", () => {
  const alphabetEntries = designSource.match(/^- [A-Z] — /gm) || [];
  assert.equal(alphabetEntries.length, 26);
  assert.match(designSource, /Sober Constellation — 절제된 공동체의 별자리/);
  assert.match(designSource, /Clarity[\s\S]*?Editorial[\s\S]*?Focus[\s\S]*?Hierarchy[\s\S]*?Negative Space[\s\S]*?Quietude[\s\S]*?Sobriety[\s\S]*?Unity/);
  assert.match(designSource, /말씀\/기도제목 > 남은 시간 > 공동체 Presence > 장식/);
});

test("오늘의 기도에는 승인형 기도제목 등록 동선이 있다", () => {
  assert.match(participantHtmlSource, /class="ritual-share-invitation"[\s\S]*?data-action="open-submit"/);
});

test("같이 기도하기는 선택 Dialog 없이 음악을 켜고 바로 진입한다", () => {
  assert.doesNotMatch(participantHtmlSource, /id="join-dialog"/);
  assert.match(appSource, /function enterLivePrayer\(\{ updatePresence = true \} = \{\}\)[\s\S]*?if \(firstJoin\)[\s\S]*?state\.audioEnabled = true[\s\S]*?showView\("live", \{ updatePresence \}\)/);
  assert.doesNotMatch(appSource, /function enterLivePrayer[\s\S]*?showView\("live"[^;]*;\s*void startConfiguredMedia\(\)/);
  assert.match(appSource, /if \(route === "live"\) return enterLivePrayer\(\)/);
});

test("YouTube 계열은 등록·숨김 재생하지 않고 업로드 음원만 운영한다", () => {
  assert.doesNotMatch(adminHtmlSource, /id="youtube-form"/);
  assert.match(adminHtmlSource, /YouTube · YouTube Music은 공동기도 음악으로 연결하지 않습니다/);
  assert.match(adminHtmlSource, /음원 직접 업로드/);
  assert.doesNotMatch(participantHtmlSource, /id="youtube-player"/);
  assert.doesNotMatch(appSource, /youtube-nocookie\.com\/embed/);
  assert.match(appSource, /YouTube 음악은 광고 없는 재생을 보장할 수 없어 재생하지 않습니다/);
});

test("등록 음악 삭제는 확인 후 서버 권한으로 연결과 업로드 파일을 함께 정리한다", () => {
  assert.match(adminScriptSource, /button\.dataset\.action = "delete-media"/);
  assert.match(adminScriptSource, /type: "delete-media", mediaId: id/);
  assert.match(adminScriptSource, /state\.service\.deleteMedia\(id\)/);
  assert.match(backendSource, /rpc\("delete_media_asset", \{ p_media_id: id \}\)/);
  assert.match(backendSource, /storage\.from\("prayer-audio"\)\.remove\(\[media\.storage_path\]\)/);
  assert.match(mediaDeleteMigrationSource, /if current_status in \('live', 'paused'\)/);
  assert.match(mediaDeleteMigrationSource, /update public\.prayer_programs[\s\S]*?step\.value - 'media_id'/);
  assert.match(mediaDeleteMigrationSource, /delete from public\.media_assets where id = p_media_id/);
  assert.match(mediaDeleteMigrationSource, /'media\.delete'/);
  assert.match(mediaDeleteMigrationSource, /grant execute on function public\.delete_media_asset\(uuid\) to authenticated/);
});

test("모바일 메뉴는 명시적인 닫기 상태와 키보드 복구를 제공한다", async () => {
  const headerSource = await readFile(new URL("../layouts/partials/header.html", import.meta.url), "utf8");
  assert.match(headerSource, /aria-controls="mobile-menu" aria-expanded="false"/);
  assert.match(headerSource, /open \? '메뉴 닫기' : '메뉴 열기'/);
  assert.match(headerSource, /mobileLabel\.textContent = open \? '닫기' : '메뉴'/);
  assert.match(headerSource, /event\.key === 'Escape'/);
});

test("BFCache 복귀 시 참여자와 Admin 실시간 연결을 다시 초기화한다", () => {
  assert.match(appSource, /addEventListener\("pagehide", \(\) => \{\s*state\.bootGeneration \+= 1;\s*state\.presenceGeneration \+= 1;\s*state\.presenceDesiredContext = null;[\s\S]*?const previousPresenceDisconnect = state\.presenceDisconnect/);
  assert.match(appSource, /addEventListener\("pageshow", \(event\) => \{[\s\S]*?event\.persisted[\s\S]*?void boot\(\)/);
  assert.match(adminScriptSource, /addEventListener\("pageshow", \(event\) => \{[\s\S]*?event\.persisted\) void boot\(\)/);
  assert.match(adminScriptSource, /async function boot\(\)[\s\S]*?Promise\.allSettled\(\[state\.presenceDisconnect\?\.\(\), state\.liveUnsubscribe\?\.\(\)\]\)[\s\S]*?state\.leaseToken = null/);
});

test("Admin 진행 조작의 응답이 불명확하면 최신 상태를 읽고 제어권을 다시 요청한다", () => {
  assert.match(adminScriptSource, /async function applyLiveAction[\s\S]*?catch \(error\)[\s\S]*?state\.leaseToken = null[\s\S]*?await state\.service\.fetchLiveSession\(\)[\s\S]*?제어권을 다시 요청해주세요/);
});

test("활성 Admin 상한 10명은 DB·Edge Function·화면에서 일관되게 적용된다", () => {
  assert.match(adminLimitMigrationSource, /enforce_admin_safety[\s\S]*?pg_advisory_xact_lock\(hashtextextended\('retreat-prayer-admin-limit', 0\)\)[\s\S]*?active_count >= 10/);
  assert.match(adminLimitMigrationSource, /the last active owner cannot be changed/);
  assert.match(adminLimitMigrationSource, /the last active owner cannot be deleted/);
  assert.match(manageAdminSource, /const MAX_ACTIVE_ADMINS = 10/);
  assert.match(manageAdminSource, /count \|\| 0\) >= MAX_ACTIVE_ADMINS/);
  assert.match(adminScriptSource, /const MAX_ACTIVE_ADMINS = 10/);
  assert.match(backendSource, /const MAX_ACTIVE_ADMINS = 10/);
  assert.match(adminHtmlSource, /활성 계정은 최대 10개입니다[\s\S]*?id="account-count">0 \/ 10/);
});

test("Edge Function은 hosted secret key를 우선하고 legacy 값은 로컬 호환 fallback으로만 사용한다", () => {
  assert.match(edgeSecretHelperSource, /Deno\.env\.get\("SUPABASE_SECRET_KEYS"\)/);
  assert.match(edgeSecretHelperSource, /JSON\.parse\(hostedKeys\)/);
  assert.match(edgeSecretHelperSource, /keys\.default/);
  assert.match(edgeSecretHelperSource, /SUPABASE_SECRET_KEY/);
  assert.match(edgeSecretHelperSource, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("원격 보안 검증 migration은 핵심 권한과 운영 자원을 배포 시 단언한다", () => {
  assert.match(validationMigrationSource, /prayer_requests direct INSERT is exposed/);
  assert.match(validationMigrationSource, /private Presence policies are incomplete/);
  assert.match(validationMigrationSource, /where id = 'prayer-audio' and public is true/);
  assert.match(validationMigrationSource, /retreat-prayer-purge-expired/);
  assert.match(validationMigrationSource, /Realtime publication is incomplete/);
});

test("참여자와 Admin 화면의 id 및 JavaScript 참조가 일치한다", async () => {
  const participantIds = await assertUniqueIds("../static/retreat-prayer/index.html");
  const adminIds = await assertUniqueIds("../static/retreat-prayer/admin/index.html");
  await assertLiteralIdReferencesExist("../static/retreat-prayer/assets/app.js", participantIds);
  await assertLiteralIdReferencesExist("../static/retreat-prayer/assets/admin.js", adminIds);
});

test("공개 RLS 정책은 anon 요청에서 Admin 전용 판별 함수를 호출하지 않는다", () => {
  assert.match(migrationSource, /daily_prayers_public_read[\s\S]*?using \(published\);/);
  assert.match(migrationSource, /prayer_requests_approved_read[\s\S]*?using \(status = 'approved' and expires_at > clock_timestamp\(\)\);/);
  assert.match(migrationSource, /media_assets_public_read[\s\S]*?using \(active\);/);
  assert.match(migrationSource, /daily_prayers_admin_read[\s\S]*?is_active_admin\(\)/);
  assert.match(migrationSource, /prayer_requests_admin_read[\s\S]*?is_active_admin\(\)/);
  assert.match(migrationSource, /media_assets_admin_read[\s\S]*?is_active_admin\(\)/);
});

test("실시간 제어 RPC는 NULL lease와 누락된 version을 거부한다", () => {
  assert.match(migrationSource, /if p_lease_token is null then[\s\S]*?lease token is required/);
  assert.match(migrationSource, /lease\.controller_id is distinct from caller/);
  assert.match(migrationSource, /lease\.lease_token is distinct from p_lease_token/);
  assert.match(migrationSource, /if p_expected_version is null then[\s\S]*?expected live state version is required/);
  assert.match(migrationSource, /current_state\.version is distinct from p_expected_version/);
});

test("직접 연 공동기도 화면에서도 예약된 자동 진행을 서버와 동기화한다", () => {
  const renderLiveBody = appSource.slice(
    appSource.indexOf("function renderLive()"),
    appSource.indexOf("function renderTodayPrayer()"),
  );
  assert.match(renderLiveBody, /maybeSyncAutomaticState\(view\);/);
  assert.match(appSource, /if \(state\.view === "live"\) renderLive\(\);/);
});

test("실시간 재구독은 현재 상태를 다시 조회하고 버전이 오래된 응답은 무시한다", async () => {
  const adminSource = await readFile(new URL("../static/retreat-prayer/assets/admin.js", import.meta.url), "utf8");
  assert.match(backendSource, /subscribeParticipantUpdates\([\s\S]*?\.on\("system", \{\},[\s\S]*?payload\?\.extension !== "postgres_changes"[\s\S]*?payload\.status === "ok"/);
  assert.match(backendSource, /table: "live_sessions"[\s\S]*?table: "content_revisions"/);
  assert.match(backendSource, /needsRecovery = true;[\s\S]*?onLiveStatus\(initialSettled \? "failed" : "reconnecting"/);
  assert.match(backendSource, /await this\.supabase\.removeChannel\(channel\);[\s\S]*?throw error/);
  assert.match(appSource, /await service\.prepareRealtime\?\.\(\);[\s\S]*?await service\.subscribeParticipantUpdates/);
  assert.doesNotMatch(appSource, /typeof state\.service\.subscribeParticipantUpdates/);
  assert.match(appSource, /restartRealtimeSubscriptions[\s\S]*?state\.realtimeCoordinator === coordinator[\s\S]*?coordinator\.retry\(error\)/);
  assert.match(appSource, /installRealtimeSubscriptions\(service, coordinator\)[\s\S]*?state\.service !== service \|\| state\.realtimeCoordinator !== coordinator[\s\S]*?nextLiveUnsubscribe/);
  assert.match(privateRealtimeMigrationSource, /retreat_prayer_postgres_changes_read[\s\S]*?retreat-prayer:live-state[\s\S]*?retreat-prayer:public-content/);
  assert.match(appSource, /Number\(liveSession\?\.version \?\? -1\) < Number\(previousVersion \?\? -1\)/);
  assert.match(adminSource, /Number\(liveSession\?\.version \?\? -1\) < Number\(state\.snapshot\.liveSession\?\.version \?\? -1\)/);
});

test("#live 직접 진입도 선택창 없이 공동기도 화면으로 이어진다", () => {
  assert.match(appSource, /showView\(route === "live" \? "home" : route,[\s\S]*?updatePresence: false/);
  assert.match(appSource, /if \(route === "live"\) enterLivePrayer\(\{ updatePresence: false \}\)/);
  assert.match(appSource, /void startRealtimeAfterStagger\(state\.realtimeCoordinator\)/);
  assert.match(appSource, /onSuccess:[\s\S]*?setPresenceContext\(state\.view === "live" \? "live" : "space", \{[\s\S]*?minimumDelayMs: REALTIME_STAGGER_MAX_MS/);
  assert.doesNotMatch(appSource, /await setPresenceContext\("space"\)[\s\S]*?enterLivePrayer/);
});

test("진행 중 구성 게시에는 구조를 고정하고 내용과 음악 교정만 허용한다", () => {
  assert.match(safeLiveContentMigrationSource, /if live\.status in \('live', 'paused'\) then[\s\S]*?lease\.controller_id is distinct from caller/);
  assert.match(safeLiveContentMigrationSource, /live\.version is distinct from p_expected_version/);
  assert.match(safeLiveContentMigrationSource, /p_program_id is distinct from live\.program_id/);
  assert.match(safeLiveContentMigrationSource, /existing\.value \|\| jsonb_build_object[\s\S]*?'label'[\s\S]*?'content'[\s\S]*?'media_id'/);
  assert.doesNotMatch(safeLiveContentMigrationSource.match(/select coalesce\(jsonb_agg\([\s\S]*?into live_merged_steps/)?.[0] || "", /'duration_seconds'/);
  assert.match(safeLiveContentMigrationSource, /kind = 'audio'/);
  assert.match(safeLiveContentMigrationSource, /program\.update_live_content/);
  assert.match(safeLiveContentMigrationSource, /'applied_to_running_session', true/);
  assert.match(backendSource, /p_lease_token: payload\.leaseToken \|\| null[\s\S]*?p_expected_version: payload\.expectedVersion \?\? null/);
  assert.match(adminScriptSource, /running && !ownsControllerLease\(\)[\s\S]*?Live Control 제어권/);
});

test("공동기도 프로그램과 수동 음악 송출에는 공개 필드만 스냅샷한다", () => {
  assert.match(migrationSource, /program_snapshot = jsonb_build_object\('title', trim\(p_title\), 'steps', sanitized_steps, 'media', media_snapshot\)/);
  assert.doesNotMatch(migrationSource, /current_state\.media := to_jsonb\(selected_media\)/);
  assert.match(migrationSource, /'source_url', selected_media\.source_url[\s\S]*?'stage_index', current_state\.stage_index/);
});

test("기도제목 공개 변경은 본문 없는 revision으로만 알리고 RLS 목록을 다시 조회한다", async () => {
  assert.match(migrationSource, /create table public\.content_revisions/);
  assert.match(migrationSource, /when 'INSERT' then publish_change := new\.status = 'approved'/);
  assert.match(migrationSource, /when 'UPDATE' then publish_change := old\.status = 'approved' or new\.status = 'approved'/);
  assert.match(migrationSource, /alter publication supabase_realtime add table public\.live_sessions, public\.content_revisions/);
  assert.match(backendSource, /table: "content_revisions"[\s\S]*?reconcile/);
  assert.match(backendSource, /from\("prayer_requests"\)[\s\S]*?\.eq\("status", "approved"\)/);
  assert.match(backendSource, /revisionBefore[\s\S]*?revisionAfter/);
});

test("공개 해제된 집중 기도제목은 복사된 본문까지 지우고 목록으로 이동한다", () => {
  assert.match(appSource, /function clearPersonalFocus\(\)[\s\S]*?personal-focus-title"\), ""/);
  assert.match(appSource, /if \(!request\) \{[\s\S]*?clearPersonalFocus\(\);[\s\S]*?showView\("requests"\)/);
  assert.match(appSource, /setInterval\(revalidatePublicContent, 60_000\)/);
  assert.match(appSource, /visibilityState === "visible"\) revalidatePublicContent\(\)/);
});
