import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../static/retreat-prayer/assets/core.js", import.meta.url), "utf8");
const core = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
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
const adminScriptSource = await readFile(new URL("../static/retreat-prayer/assets/admin.js", import.meta.url), "utf8");
const manageAdminSource = await readFile(new URL("../supabase/functions/manage-admin/index.ts", import.meta.url), "utf8");
const participantHtmlSource = await readFile(new URL("../static/retreat-prayer/index.html", import.meta.url), "utf8");
const participantStylesSource = await readFile(new URL("../static/retreat-prayer/assets/styles.css", import.meta.url), "utf8");
const adminHtmlSource = await readFile(new URL("../static/retreat-prayer/admin/index.html", import.meta.url), "utf8");

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
  const count = core.countUniquePresenceSessions({
    tabA: [{ session_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }],
    tabB: [{ session_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }],
    tabC: [{ session_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }],
    invalid: [{ session_id: "short" }],
  });
  assert.equal(count, 2);
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

test("오늘의 기도에는 승인형 기도제목 등록 동선이 있다", () => {
  assert.match(participantHtmlSource, /class="ritual-share-invitation"[\s\S]*?data-action="open-submit"/);
});

test("같이 기도하기는 선택 Dialog 없이 음악을 켜고 바로 진입한다", () => {
  assert.doesNotMatch(participantHtmlSource, /id="join-dialog"/);
  assert.match(appSource, /function enterLivePrayer\(\)[\s\S]*?if \(firstJoin\)[\s\S]*?state\.audioEnabled = true[\s\S]*?showView\("live"\)/);
  assert.doesNotMatch(appSource, /function enterLivePrayer\(\)[\s\S]*?showView\("live"\);\s*void startConfiguredMedia\(\)/);
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

test("모바일 메뉴는 명시적인 닫기 상태와 키보드 복구를 제공한다", async () => {
  const headerSource = await readFile(new URL("../layouts/partials/header.html", import.meta.url), "utf8");
  assert.match(headerSource, /aria-controls="mobile-menu" aria-expanded="false"/);
  assert.match(headerSource, /open \? '메뉴 닫기' : '메뉴 열기'/);
  assert.match(headerSource, /mobileLabel\.textContent = open \? '닫기' : '메뉴'/);
  assert.match(headerSource, /event\.key === 'Escape'/);
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
  assert.match(backendSource, /status === "SUBSCRIBED"\) reconcile\(\)/);
  assert.match(backendSource, /await this\.fetchLiveSession\(\)/);
  assert.match(backendSource, /channel\("retreat-prayer:live-state", \{ config: \{ private: true \} \}\)/);
  assert.match(backendSource, /channel\("retreat-prayer:public-content", \{ config: \{ private: true \} \}\)/);
  assert.match(appSource, /await state\.service\.prepareRealtime\?\.\(\);[\s\S]*?state\.service\.subscribeLive/);
  assert.match(privateRealtimeMigrationSource, /retreat_prayer_postgres_changes_read[\s\S]*?retreat-prayer:live-state[\s\S]*?retreat-prayer:public-content/);
  assert.match(appSource, /Number\(liveSession\?\.version \?\? -1\) < Number\(previousVersion \?\? -1\)/);
  assert.match(adminSource, /Number\(liveSession\?\.version \?\? -1\) < Number\(state\.snapshot\.liveSession\?\.version \?\? -1\)/);
});

test("#live 직접 진입도 선택창 없이 공동기도 화면으로 이어진다", () => {
  assert.match(appSource, /showView\(route === "live" \? "home" : route,[\s\S]*?updatePresence: false/);
  assert.match(appSource, /await setPresenceContext\("space"\)/);
  assert.match(appSource, /if \(route === "live"\) enterLivePrayer\(\)/);
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
  assert.match(appSource, /state\.contentUnsubscribe = state\.service\.subscribeContent/);
  assert.match(appSource, /visibilityState === "visible"\) revalidatePublicContent\(\)/);
});
