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
  const backendSource = await readFile(new URL("../static/retreat-prayer/assets/backend.js", import.meta.url), "utf8");
  const adminSource = await readFile(new URL("../static/retreat-prayer/assets/admin.js", import.meta.url), "utf8");
  assert.match(backendSource, /status === "SUBSCRIBED"\) reconcile\(\)/);
  assert.match(backendSource, /await this\.fetchLiveSession\(\)/);
  assert.match(appSource, /Number\(liveSession\?\.version \?\? -1\) < Number\(previousVersion \?\? -1\)/);
  assert.match(adminSource, /Number\(liveSession\?\.version \?\? -1\) < Number\(state\.snapshot\.liveSession\?\.version \?\? -1\)/);
});

test("#live 직접 진입은 참여 확정 전 Home과 일반 Presence를 유지한다", () => {
  assert.match(appSource, /showView\(route === "live" \? "home" : route,[\s\S]*?updatePresence: false/);
  assert.match(appSource, /await setPresenceContext\("space"\)/);
  assert.match(appSource, /if \(!state\.joinedLive && routeFromHash\(\) === "live"\) showView\("home"\)/);
});

test("공동기도 프로그램과 수동 음악 송출에는 공개 필드만 스냅샷한다", () => {
  assert.match(migrationSource, /program_snapshot = jsonb_build_object\('title', trim\(p_title\), 'steps', sanitized_steps, 'media', media_snapshot\)/);
  assert.doesNotMatch(migrationSource, /current_state\.media := to_jsonb\(selected_media\)/);
  assert.match(migrationSource, /'source_url', selected_media\.source_url[\s\S]*?'stage_index', current_state\.stage_index/);
});

test("기도제목 공개 변경은 본문 없는 revision으로만 알리고 RLS 목록을 다시 조회한다", async () => {
  const backendSource = await readFile(new URL("../static/retreat-prayer/assets/backend.js", import.meta.url), "utf8");
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
