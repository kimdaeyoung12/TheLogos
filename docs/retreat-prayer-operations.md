# 수련회 공동기도 플랫폼 운영 안내

## 공개 경로와 보안 경계

- 참여자 화면: `/retreat-prayer/`
- 관리자 화면: `/retreat-prayer/admin/`
- 기존 사이트 메뉴, 홈페이지, 사이트맵에는 이 경로를 추가하지 않는다.
- 두 화면 모두 `noindex, nofollow, noarchive` 메타를 사용한다.
- **특정 URL만 아는 방식은 비공개 인증이 아니라 unlisted 공개**다. URL을 전달받은 사람은 참여자 화면에 들어올 수 있다.
- 관리자 화면과 API는 URL 비공개 여부와 무관하게 Supabase Auth, RLS, 대표 관리자 권한으로 보호한다.

운영 Supabase 설정이 없으면 공개 호스트에서 앱은 샘플 데이터로 열리지 않고 “운영 연결이 필요합니다” 상태로 중단된다. 로컬호스트에서만 화면 검수를 위한 미리보기 데이터가 허용된다.

현재 운영 프로젝트는 `retreat-prayer`(`bxgqhdqseahujiadvhyk`, Seoul)이며 정적 앱은 이 프로젝트의 공개 publishable key만 사용한다. 데이터베이스 비밀번호, secret key, 제출 제한 salt는 저장소에 기록하지 않는다.

## 1. Supabase 프로젝트 준비

1. 다른 서비스의 테이블·권한과 충돌하지 않도록 전용 프로젝트만 사용한다. 저장소는 위 프로젝트에 연결되어 있다.
2. `20260828010000_retreat_prayer.sql`, 원격 카탈로그 단언을 담은 `20260828020000_retreat_prayer_security_validation.sql`, lint 보정용 `20260828030000_retreat_prayer_lint_cleanup.sql`, 일정 미정 상태를 지원하는 `20260828040000_retreat_prayer_schedule_pending.sql`, 초대 전용 Auth 훅을 구성하는 `20260828050000_retreat_prayer_invite_only_auth.sql`, 선택형 말씀을 지원하는 `20260829010000_retreat_prayer_optional_scripture.sql`, 진행 중 콘텐츠 교정을 허용하는 `20260829020000_retreat_prayer_live_content_edit.sql`, private Postgres Changes 구독 권한을 추가하는 `20260829030000_retreat_prayer_private_realtime_changes.sql`, 진행 중 콘텐츠 저장을 안전하게 제한하는 `20260829040000_retreat_prayer_safe_live_content_edit.sql`, 등록 음악을 참조 해제 후 삭제하는 `20260829050000_retreat_prayer_media_delete.sql`, 활성 Admin 상한을 10명으로 올리는 `20260829060000_retreat_prayer_admin_limit_10.sql`을 차례로 적용한다. validation migration 실패는 운영 권한 구성이 완성되지 않았다는 뜻이다.
3. Anonymous Sign-ins를 켠다. 일반 사용자는 로그인 UI를 보지 않지만, private Realtime Presence 채널에 들어가기 위한 최소 권한 토큰으로만 사용한다.
4. 전역 `auth.enable_signup`과 `auth.email.enable_signup`은 모두 켠다. 전역 가입을 끄면 익명 Presence 세션도 막히고, 이메일 제공자를 끄면 기존 Admin 로그인도 `Email logins are disabled`로 막히기 때문이다. 대신 `hook_restrict_retreat_prayer_signup` Before User Created 훅이 익명 사용자와 서버가 발급한 일회성 nonce가 있는 Admin 초대만 허용하고 나머지 영구 계정 생성을 거부한다. Site URL과 Redirect URL은 운영·로컬 Admin 경로로 제한한다.
5. Admin 비밀번호는 10~72자와 대·소문자, 숫자, Supabase 허용 기호를 요구하고 이메일 확인·안전한 비밀번호 변경·TOTP MFA 등록을 켠다.
6. `submit-prayer-request`, `manage-admin` Edge Function은 JWT 검증을 켠 상태로 배포한다.
7. Realtime Settings에서 **Allow public access**를 끈다. 앱 채널도 항상 `private: true`로 연결한다. 현재 운영 프로젝트에는 private-only 설정이 적용되어 있다.
8. Admin 초대 메일이 임의의 주소에도 도착해야 한다면 운영 SMTP와 발신 도메인을 설정하고 초대를 1회 검증한다. Supabase 기본 SMTP만으로 운영 범위를 넓히지 않는다.

```powershell
npx supabase@latest link --project-ref bxgqhdqseahujiadvhyk
npx supabase@latest db push --linked
npx supabase@latest functions deploy --project-ref bxgqhdqseahujiadvhyk --use-api
```

## 2. Edge Function 환경 변수

호스팅 환경에서는 `SUPABASE_URL`과 `SUPABASE_SECRET_KEYS`가 제공된다. 함수는 `SUPABASE_SECRET_KEYS` JSON의 `default` 값을 사용하며, 로컬 호환을 위해서만 `SUPABASE_SECRET_KEY`와 legacy `SUPABASE_SERVICE_ROLE_KEY`를 차선으로 읽는다. 아래 세 값은 별도로 설정한다.

```powershell
npx supabase@latest secrets set ALLOWED_ORIGINS=https://thelogos.dev,https://www.thelogos.dev --project-ref bxgqhdqseahujiadvhyk
npx supabase@latest secrets set PRAYER_RATE_LIMIT_SALT=<32자 이상의 무작위 비밀값> --project-ref bxgqhdqseahujiadvhyk
npx supabase@latest secrets set ADMIN_REDIRECT_URL=https://thelogos.dev/retreat-prayer/admin/ --project-ref bxgqhdqseahujiadvhyk
```

`PRAYER_RATE_LIMIT_SALT`는 브라우저 세션과 보조 IP 정보를 원문으로 저장하지 않고 단방향 해시하는 데 사용한다. 이 값과 secret key를 `static/` 아래에 두면 안 된다. 현재 운영 프로젝트는 새 publishable/secret 키를 사용하며 legacy `anon`·`service_role` JWT 키가 비활성화되어 있다.

## 3. 대표 관리자와 Admin 계정

실제 대표 관리자 이메일과 표시 이름은 공개 저장소가 아니라 Supabase Auth와 `admin_profiles`에만 유지한다. 초대 메일의 링크를 열고 **10~72자이며 영문 대문자·소문자·숫자·Supabase 허용 특수문자를 각각 포함한** 첫 비밀번호를 설정하면 Admin 콘솔을 사용할 수 있다. 초대·복구 링크의 인증 코드는 일회용이므로, 비밀번호 설정에 실패한 뒤 같은 링크를 다시 열지 않는다. 관리자 로그인 화면의 **초대 링크에서 비밀번호 설정에 실패했나요? → 새 비밀번호 설정 링크 받기**에서 초대받은 이메일로 새 링크를 발급한다. 메일이 오지 않거나 복구 링크도 실패하면 Supabase Dashboard에서 사용자를 삭제해 임의로 재생성하지 말고, Auth 사용자와 `admin_profiles` 행을 함께 확인한다.

첫 대표 관리자를 수동으로 복구해야 할 때에만 Supabase Auth Dashboard에서 이메일 사용자를 만든 뒤 SQL Editor에서 해당 사용자를 대표 관리자로 연결한다.

```sql
insert into public.admin_profiles (user_id, display_name, role, active)
select id, '대표 관리자 표시 이름', 'owner', true
from auth.users
where email = 'owner@example.org';
```

추가 Admin은 다음 순서로 만든다.

1. 대표 관리자로 `/retreat-prayer/admin/`에 로그인한다.
2. 왼쪽 메뉴의 **Admin 계정 관리**로 이동한다.
3. 이메일과 표시 이름을 입력하고 **Admin 초대 보내기**를 누른다.
4. 초대받은 사람은 이메일 링크를 열어 10~72자이며 영문 대문자·소문자·숫자·허용 특수문자를 각각 포함한 첫 비밀번호를 설정한다.
5. 이후 같은 관리자 URL에서 이메일과 비밀번호로 로그인한다.

초대·활성화·비활성화는 대표 관리자만 할 수 있다. 활성 계정은 대표 관리자를 포함해 최대 10개이며, 자기 자신과 마지막 대표 관리자는 비활성화할 수 없다. 실제 권한은 초대 메타데이터가 아니라 `admin_profiles`의 활성 상태와 RLS가 판단한다. 5명으로 되돌릴 때에는 UI와 Edge Function을 먼저 낮추고 활성 Admin을 5명 이하로 정리한 다음 별도 보상 migration으로 DB 제한을 낮춘다.

Supabase 기본 SMTP는 프로젝트 팀 구성원 주소 위주의 제한된 시험 발송용이다. 교회 구성원의 임의 이메일 주소로 Admin 초대를 보내려면 먼저 운영 SMTP와 발신 도메인을 연결하고 테스트해야 한다. Admin 초대 함수는 이메일과 일회성 nonce의 SHA-256 해시만 10분간 보관하고, Auth 훅이 계정 생성 순간 이를 원자적으로 소비한다.

현재 기본 일정은 공동체 `시광교회 2청년부`, 수련회 `2026-10-08`~`2026-10-10`이다. 공동기도 시각은 아직 미정이며 공개 화면에는 “다음 공동기도 일정은 곧 안내됩니다.”라고 표시된다. 결정된 뒤 **오늘의 콘텐츠 → 기본 일정**에서 시각만 저장한다. D-Day는 수련회 시작일을 기준으로 계산한다.

## 4. 정적 앱 연결

`static/retreat-prayer/config.example.js`를 참고해 `static/retreat-prayer/config.js`의 공개 설정만 채운다. 운영 파일은 이미 `bxgqhdqseahujiadvhyk.supabase.co`와 해당 프로젝트의 publishable key에 연결되어 있다.

```js
supabaseUrl: "https://PROJECT_REF.supabase.co",
supabasePublishableKey: "sb_publishable_...",
```

publishable key는 브라우저에 노출되는 공개 키이며, 실제 데이터 접근 권한은 RLS가 결정한다. service-role key는 절대 이 파일에 넣지 않는다.

## 5. 공개 전 검수

- `npm run test:retreat-prayer`
- `bin\\hugo.exe --gc --minify`
- Docker가 있는 로컬 또는 disposable DB에서 `supabase test db`로 `supabase/tests/retreat_prayer_security.test.sql` 실행
- 운영 배포에서는 validation migration이 RLS, browser role grant, Presence 정책, Storage bucket, Cron, Realtime publication을 모두 단언하는지 확인
- 실제 HTTP로 익명 Auth·공개 조회는 성공하고 직접 `prayer_requests` INSERT와 익명 Admin 호출은 403인지 확인
- 허용 Origin의 함수 preflight는 204, 비허용 Origin은 403인지 확인
- 익명 Auth JWT로 private Presence 채널 join이 성공하는지 확인
- 참여자 화면에서 Presence 동기화 전 숫자가 표시되지 않는지 확인
- 브라우저 두 개와 여러 탭에서 같은 session id가 중복 집계되지 않는지 확인
- 기도제목이 제출 직후 공개되지 않고 승인 대기열에만 나타나는지 확인
- 두 브라우저에서 승인한 제목이 즉시 나타나고, 숨김·삭제한 제목은 열린 목록과 집중 기도 화면에서도 즉시 제거되는지 확인
- 네트워크를 끊은 동안 기도제목 공개 상태를 바꾼 뒤 재연결했을 때 RLS를 거친 최신 목록으로 복구되는지 확인
- 일반 사용자가 Admin 테이블, 대기 기도제목, 음원 업로드에 접근할 수 없는지 확인
- 두 Admin의 동시 제어 요청에서 한 명만 lease를 얻는지 확인
- NEXT 중복 클릭은 version mismatch로 거부되는지 확인
- 운영 Supabase 설정을 제거한 공개 호스트에서 샘플 데이터 대신 구성 오류 화면이 나오는지 확인
- WebGL, JavaScript 오류, 네트워크 끊김, 음악 실패가 기도 콘텐츠 자체를 가리지 않는지 확인

## 6. 운영 중 대응

- 관리자 제어권 lease는 30초이며 콘솔이 20초마다 갱신한다. 제어 Admin이 이탈하면 다른 Admin이 만료 후 제어권을 요청할 수 있다.
- Presence 숫자는 로그인된 인원이나 실제 사람 수가 아니라 heartbeat로 동기화된 **고유 활성 브라우저 세션 수**다.
- 기도제목 원문은 승인 전에 관리자만 볼 수 있고, 기본 공개 만료 시점은 제출 후 180일이다. 만료된 행은 공개 RLS에서 즉시 제외된다. pg_cron 작업 `retreat-prayer-purge-expired`가 매일 00:15 KST에 만료 기도제목, 수명이 지난 제출 제한 해시, 30일 지난 익명 Auth 사용자를 물리 삭제한다. 교회 개인정보 정책에 맞게 보관 기간을 더 짧게 조정할 수 있다.
- 음원이 실패해도 기도 진행은 계속한다. 참여자의 로컬 음량과 음소거 선택은 Admin이 강제로 바꾸지 않는다.
- 등록 음악 삭제는 진행 중인 기도회가 없을 때만 허용한다. 삭제하면 기도회 구성의 해당 음악 연결을 해제하고 `prayer-audio` 저장소 파일도 정리하며, `media.delete` Audit Trail을 남긴다.
- 긴급 종료, 승인, Admin 변경 등의 주요 작업은 `admin_audit`에 남긴다.
- 공개 콘텐츠 변경은 본문이 없는 `content_revisions` 숫자만 Realtime으로 알린다. 참여자 브라우저는 이 신호나 재연결을 받으면 승인된 기도제목과 오늘의 말씀을 RLS를 통해 다시 조회한다.
- `live_sessions`와 `content_revisions` 갱신은 하나의 private 채널과 익명 Auth 토큰을 사용한다. Realtime 알림이 일시적으로 누락되더라도 60초 간격의 재검증과 탭 복귀 시 재검증으로 공개 콘텐츠를 회복한다.
- 여러 지체가 같은 시각에 접속할 때 Realtime 초기 구독과 첫 Presence 연결은 각각 브라우저별 최대 16초 안에서 분산한다. 화면과 기도 콘텐츠는 먼저 표시하고, 인원 수는 백그라운드 연결이 모이는 동안 차분하게 갱신한다.
- 참여자 브라우저는 공동기도·공개 콘텐츠 갱신 채널과 Presence 채널을 합쳐 Realtime 채널 2개만 사용한다. 첫 Presence 연결은 갱신 채널보다 16초 늦게 시작해 다시 최대 16초에 걸쳐 모이도록 한다. Home ↔ 공동기도 전환에서는 Presence 채널을 떠나 재가입하지 않고 동일 채널의 익명 상태만 갱신하므로 기도 시작 시각의 재가입 폭주를 피한다. Admin 제어 화면은 동일 Presence 채널을 읽기 전용으로 관찰한다.
- Supabase의 클라이언트당 Presence 호출 제한을 넘지 않도록 화면 상태 갱신은 최소 6.5초 간격으로 직렬화하고, 그 사이 여러 번 화면을 오가면 마지막 상태만 전송한다. 네트워크 재연결 뒤에는 현재 화면의 상태를 다시 등록한다.
- 50명이 한 시각에 페이지를 열어도 말씀·기도제목은 먼저 보이지만, 분산 연결 때문에 전체 Presence 인원 수가 안정되는 데에는 최악의 경우 약 30초가 걸릴 수 있다. 이 구간을 연결 실패로 오인해 새로고침을 반복하지 않도록 운영 전에 안내한다.
- 현재 익명 인증은 Supabase 기본 제한에 따라 동일 IP에서 시간당 30회까지다. 서로 다른 네트워크에서 접속하는 50명 운영에는 직접적인 제한이 아니지만, 한 장소·한 공유망에서 리허설할 때는 이 제한과 기도제목 제출 제한을 별도로 점검한다.
- 오늘의 말씀과 본문 표기는 선택 항목이다. 둘 다 비어 있으면 참여자 화면은 빈 카드나 준비 중 문구를 만들지 않고 말씀 영역을 생략한다.
- YouTube/YouTube Music은 임베드 광고를 끌 수 없고 숨겨진 플레이어나 오디오 재송출 방식도 지원 정책과 충돌하므로 등록·재생하지 않는다. 공동기도에는 사용 권한을 확보한 직접 업로드 음원만 사용한다.
- 진행 중 `기도회 구성 게시`는 Live Control 제어권과 최신 상태 버전을 가진 Admin만 사용할 수 있다. 제목, 말씀·기도제목, 연결 음원만 즉시 갱신하며 단계·타이머와 `시간 연장` 결과는 서버 값으로 유지한다. 단계 수·순서·종류 변경은 종료 후에만 허용한다.

## MVP 이후 후보

수련회 이후 감사 내용이나 “기도 이후 이야기”는 별도 동의·보관 정책을 정한 뒤 추가한다. 현재 화면에는 미래 기능을 비활성 메뉴로 노출하지 않는다.
